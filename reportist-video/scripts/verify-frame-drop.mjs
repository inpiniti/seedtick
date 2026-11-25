// 내보내기 프레임 드랍 회귀 검증.
// 실제 서비스 모듈(mp4KeyframeDecoder.ts / offlineFrameDecoder.ts)을 TypeScript로
// 트랜스파일한 뒤 WebCodecs/DOM을 최소 스텁으로 대체해 실행한다.
//
//   npm run verify:frame-drop
//
// 검증 항목:
//   1. 오프라인 디코더의 30fps CFR 커버 프레임 (중복 0 / 누락 0 / 시각 오차 < 1프레임)
//   2. iPhone HEVC Main 10 코덱 문자열 (hvc1.2.4.L123.B0)
//   3. QuickTime .MOV ctts v0 음수 오프셋 + 타임라인 정규화
//   4. Blob 단위 파싱 캐시
//   5. edts/elst 미디어 오프셋 반영
//   6. Dolby Vision(dvh1) 샘플 엔트리 파싱
//   7. 키프레임 디코딩 진행 기반 타임아웃 / 정지 시 타임아웃·자원 정리
//   8. 미해제 VideoFrame 서피스 풀 고갈 회피 (즉시 draw + close)
//   9. 리오더 버퍼(flush 전 무출력)에서 decodeQueueSize 데드락 회피
//   10. prefer-hardware 정체 → prefer-software 재시도
//   11. 프레임별 진행 콜백 즉시 전달
//   12. 부분 프레임 과반 확보 시 정체 무시하고 반환

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const servicesDir = path.join(root, 'src', 'services');

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  :: ${detail}` : ''}`);
  if (!ok) failures++;
};

// ---------------------------------------------------------------------------
// WebCodecs / DOM 최소 스텁
// ---------------------------------------------------------------------------
const createdCanvases = [];

class FakeVideoFrame {
  constructor(timestamp) {
    this.timestamp = timestamp;
    this.displayWidth = 1280;
    this.displayHeight = 720;
    this.codedWidth = 1280;
    this.codedHeight = 720;
    this.closed = false;
  }
  close() {
    this.closed = true;
  }
}

class FakeEncodedVideoChunk {
  constructor(init) {
    Object.assign(this, init);
  }
}

class FakeVideoDecoder {
  static isConfigSupported = async () => ({ supported: true });
  static outputDelayMs = 2;
  static maxOutputs = Infinity; // 0이면 출력 정지, 1이면 첫 프레임만 출력 (타임아웃 재현)
  static maxOpenFrames = Infinity; // 미해제 VideoFrame이 이 값 이상이면 서피스 풀 고갈로 출력 정지
  static holdUntilFlush = false; // 리오더 버퍼(DPB): flush() 전까지 프레임을 붙잡는다
  static stallHardware = false; // prefer-hardware만 정체하고 prefer-software는 정상 동작
  static staggerOutputs = false; // 프레임을 순차적으로 내보내 유휴 타임아웃 연장을 검증
  static instances = [];

  constructor(callbacks) {
    this.callbacks = callbacks;
    this.decodeQueueSize = 0;
    this.pending = 0;
    this.outputCount = 0;
    this.frames = [];
    this.queued = [];
    this.isHardware = false;
    this.closed = false;
    FakeVideoDecoder.instances.push(this);
  }
  configure(config) {
    this.config = config;
    this.isHardware = config.hardwareAcceleration === 'prefer-hardware';
  }
  emit(chunk) {
    // 실제 하드웨어 디코더처럼 비동기로 출력 (프레임 드랍 재현에 중요)
    const staggerIndex = this.decodeQueueSize;
    const delayMs = FakeVideoDecoder.staggerOutputs
      ? FakeVideoDecoder.outputDelayMs * staggerIndex
      : FakeVideoDecoder.outputDelayMs;
    setTimeout(() => {
      // 출력 정지 상태에서는 큐도 비워지지 않아야 실제 디코더 행정(정지)을 재현한다.
      if (this.closed || this.outputCount >= FakeVideoDecoder.maxOutputs) return;
      if (this.isHardware && FakeVideoDecoder.stallHardware) return;
      const openFrames = this.frames.filter((f) => !f.closed).length;
      if (openFrames >= FakeVideoDecoder.maxOpenFrames) return;
      this.decodeQueueSize--;
      this.pending--;
      this.outputCount++;
      const frame = new FakeVideoFrame(chunk.timestamp);
      this.frames.push(frame);
      this.callbacks.output(frame);
    }, delayMs);
  }
  decode(chunk) {
    this.decodeQueueSize++;
    this.pending++;
    this.queued.push(chunk);
    if (FakeVideoDecoder.holdUntilFlush) return;
    this.emit(chunk);
  }
  async flush() {
    if (FakeVideoDecoder.holdUntilFlush) {
      const chunks = this.queued.splice(0);
      for (const chunk of chunks) this.emit(chunk);
    }
    // 타임아웃으로 close()된 경우 대기 중인 디코딩이 영원히 붙잡지 않도록 한다.
    while (this.pending > 0 && !this.closed) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
  }
  close() {
    this.closed = true;
    this.decodeQueueSize = 0;
    this.pending = 0;
  }
}

const fakeDocument = {
  createElement(tag) {
    if (tag !== 'canvas') throw new Error(`unexpected element: ${tag}`);
    const canvas = {
      width: 0,
      height: 0,
      getContext() {
        if (!canvas._ctx) {
          canvas._ctx = {
            imageSmoothingEnabled: true,
            imageSmoothingQuality: '',
            lastDrawnTs: null,
            clearRect() {},
            save() {},
            translate() {},
            rotate() {},
            restore() {},
            drawImage(frame) {
              canvas._ctx.lastDrawnTs = frame.timestamp;
            },
          };
        }
        return canvas._ctx;
      },
      toDataURL: () => 'data:image/jpeg;base64,AAAA',
    };
    createdCanvases.push(canvas);
    return canvas;
  },
};

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  Blob,
  ArrayBuffer,
  DataView,
  Uint8Array,
  Set,
  Map,
  WeakMap,
  Promise,
  Math,
  Number,
  String,
  Object,
  Error,
  Date,
  performance,
  document: fakeDocument,
  VideoDecoder: FakeVideoDecoder,
  VideoFrame: FakeVideoFrame,
  EncodedVideoChunk: FakeEncodedVideoChunk,
};

function loadTsModule(file, requireShim) {
  const source = fs.readFileSync(file, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const module = { exports: {} };
  const context = vm.createContext({
    ...sandbox,
    module,
    exports: module.exports,
    require: requireShim,
  });
  vm.runInContext(outputText, context, { filename: file });
  return module.exports;
}

const mp4 = loadTsModule(path.join(servicesDir, 'mp4KeyframeDecoder.ts'), (id) => {
  throw new Error(`unexpected import in mp4KeyframeDecoder: ${id}`);
});
const offline = loadTsModule(path.join(servicesDir, 'offlineFrameDecoder.ts'), (id) => {
  if (id.includes('mp4KeyframeDecoder')) return mp4;
  throw new Error(`unexpected import in offlineFrameDecoder: ${id}`);
});

// ---------------------------------------------------------------------------
// 최소 MP4/MOV 생성기 (mvhd/trak/stbl/stsd/ctts/stss/edts)
// ---------------------------------------------------------------------------
const u16 = (n) => {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(n, 0);
  return b;
};
const u32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0, 0);
  return b;
};
const i32 = (n) => {
  const b = Buffer.alloc(4);
  b.writeInt32BE(n, 0);
  return b;
};
const box = (type, ...parts) =>
  Buffer.concat([u32(8 + Buffer.concat(parts).length), Buffer.from(type, 'ascii'), ...parts]);
const full = (type, ...parts) =>
  box(type, Buffer.concat([Buffer.from([0, 0, 0, 0]), ...parts]));

function buildMp4({
  n = 180,
  timescale = 600,
  deltaTicks = 20,
  keyEvery = 30,
  cttsOffset = 0,
  mediaTime = null,
  entryType = 'hvc1',
} = {}) {
  const keyframes = [];
  for (let i = 0; i < n; i += keyEvery) keyframes.push(i + 1); // stss는 1-based

  const hvcC = Buffer.from([
    0x01, 0x02, 0x20, 0x00, 0x00, 0x00, 0xb0, 0x00, 0x00, 0x00, 0x00, 0x00, 123,
  ]);
  const visual = Buffer.concat([
    Buffer.alloc(8),
    Buffer.alloc(4),
    Buffer.alloc(12),
    u16(1280),
    u16(720),
    Buffer.alloc(50),
  ]);
  const sampleEntry = box(entryType, visual, box('hvcC', hvcC));
  const stsd = full('stsd', u32(1), sampleEntry);
  const stts = full('stts', u32(1), u32(n), u32(deltaTicks));
  const ctts = full('ctts', u32(1), u32(n), u32(cttsOffset));
  const stsz = full('stsz', u32(4), u32(n));
  const stsc = full('stsc', u32(1), u32(1), u32(n), u32(1));
  const stss = full('stss', u32(keyframes.length), ...keyframes.map(u32));
  const mdhd = full('mdhd', u32(0), u32(0), u32(timescale), u32(n * deltaTicks));
  const hdlr = full('hdlr', u32(0), Buffer.from('vide', 'ascii'), Buffer.alloc(12));
  const tkhd = full(
    'tkhd',
    u32(0),
    u32(0),
    u32(1),
    u32(0),
    u32(n * deltaTicks),
    Buffer.alloc(8),
    Buffer.alloc(2),
    Buffer.alloc(2),
    Buffer.alloc(2),
    Buffer.alloc(2),
    i32(0x00010000), i32(0), i32(0),
    i32(0), i32(0x00010000), i32(0),
    i32(0), i32(0), i32(0x40000000),
    u32(1280 << 16),
    u32(720 << 16)
  );
  const mvhd = full('mvhd', u32(0), u32(0), u32(timescale), u32(n * deltaTicks), Buffer.alloc(80));

  const buildMoov = (chunkOffset) => {
    const stco = full('stco', u32(1), u32(chunkOffset));
    const stbl = box('stbl', stsd, stts, ctts, stsz, stsc, stco, stss);
    const minf = box('minf', stbl);
    const mdia = box('mdia', mdhd, hdlr, minf);
    const edts =
      mediaTime === null
        ? Buffer.alloc(0)
        : box('edts', full('elst', u32(1), u32(n * deltaTicks), i32(mediaTime), u32(0x00010000)));
    const trak = box('trak', tkhd, edts, mdia);
    return box('moov', mvhd, trak);
  };

  const moovSize = buildMoov(0).length;
  const moov = buildMoov(moovSize);
  const samples = Buffer.alloc(n * 4, 0xaa);
  return new Blob([moov, samples]);
}

// ---------------------------------------------------------------------------
// 검증
// ---------------------------------------------------------------------------
console.log('=== 1. 오프라인 디코더 30fps CFR 커버 프레임 ===');
{
  const canvasIndex = createdCanvases.length;
  const blob = buildMp4({ n: 180, keyEvery: 30, cttsOffset: 0 });
  const source = await offline.createOfflineFrameSource(blob, 1.5, 3.0);
  check('오프라인 디코더 활성화', !!source);
  if (source) {
    const ctx = createdCanvases[canvasIndex]._ctx;
    const drawn = [];
    const frames = 45; // (3.0 - 1.5) * 30
    for (let f = 0; f < frames; f++) {
      const decoded = await source.next(1.5 + f / 30);
      check(`next() 프레임 반환 #${f}`, !!decoded, decoded ? '' : 'null');
      drawn.push(ctx.lastDrawnTs / 1_000_000);
    }
    source.close();
    const unique = new Set(drawn.map((t) => t.toFixed(4))).size;
    const duplicates = drawn.filter((t, i) => i > 0 && t === drawn[i - 1]).length;
    const maxErr = Math.max(...drawn.map((t, i) => Math.abs(t - (1.5 + i / 30))));
    check('고유 프레임 45장 (누락 0)', unique === 45, `unique=${unique}`);
    check('중복 프레임 0장', duplicates === 0, `duplicates=${duplicates}`);
    check('시각 오차 < 1프레임', maxErr < 1 / 30, `maxErr=${maxErr.toFixed(6)}s`);
    check('첫 프레임이 구간 시작을 커버', Math.abs(drawn[0] - 1.5) < 1 / 30, `first=${drawn[0]}`);
    check('마지막 프레임이 구간 끝을 커버', Math.abs(drawn.at(-1) - (1.5 + 44 / 30)) < 1 / 30, `last=${drawn.at(-1)}`);
  }
}

console.log('=== 2. iPhone HEVC Main 10 코덱 문자열 ===');
{
  const hvcC = new Uint8Array([
    0x01, 0x02, 0x20, 0x00, 0x00, 0x00, 0xb0, 0x00, 0x00, 0x00, 0x00, 0x00, 123,
  ]);
  const candidates = mp4.buildHevcCodecCandidates('hvc1', hvcC);
  check('hvc1.2.4.L123.B0 생성', candidates[0] === 'hvc1.2.4.L123.B0', candidates.join(', '));
  check('hev1 대안 후보 포함', candidates.some((c) => c.startsWith('hev1.2.4.L123.B0')));
}

console.log('=== 3. QuickTime .MOV ctts v0 음수 오프셋 ===');
{
  const blob = buildMp4({ n: 120, keyEvery: 30, cttsOffset: -1000 });
  const track = await mp4.parseMp4VideoTrack(blob);
  check('트랙 파싱 성공', !!track);
  if (track) {
    const expectedCts = -1000 / 600;
    check(
      'CTS가 음수 오프셋으로 파싱됨',
      Math.abs(track.samples[0].ctsSec - track.presentationOffsetSec - expectedCts) < 1e-6,
      `movie time=${(track.samples[0].ctsSec - track.presentationOffsetSec).toFixed(6)}`
    );
    check(' 타임스탬프가 0 이상으로 정규화', track.samples.every((s) => s.ctsSec >= 0));
    check(
      '정규화 오프셋 반영',
      Math.abs(track.presentationOffsetSec - 1000 / 600) < 1e-6,
      `offset=${track.presentationOffsetSec.toFixed(6)}`
    );
    check(
      '폭주 타임스탬프 없음',
      track.samples.every((s) => Number.isFinite(s.ctsSec) && s.ctsSec < 10)
    );
    const cached = await mp4.parseMp4VideoTrack(blob);
    check('Blob 단위 파싱 캐시', cached === track);
  }
}

console.log('=== 4. edts/elst 미디어 오프셋 ===');
{
  const blob = buildMp4({ n: 120, keyEvery: 30, mediaTime: 600 });
  const track = await mp4.parseMp4VideoTrack(blob);
  check('presentationOffsetSec = 1.0', track && Math.abs(track.presentationOffsetSec - 1) < 1e-6);
  const canvasIndex = createdCanvases.length;
  const source = await offline.createOfflineFrameSource(blob, 1.5, 2.5);
  check('오프셋 반영 디코더 생성', !!source);
  if (source) {
    const ctx = createdCanvases[canvasIndex]._ctx;
    const decoded = await source.next(1.5);
    check(
      'movie 시간 기준 첫 프레임 커버',
      !!decoded && Math.abs(ctx.lastDrawnTs / 1_000_000 - 2.5) < 1 / 30,
      `drawn=${ctx.lastDrawnTs / 1_000_000}`
    );
    source.close();
  }
}

console.log('=== 5. Dolby Vision(dvh1) 샘플 엔트리 ===');
{
  const track = await mp4.parseMp4VideoTrack(buildMp4({ n: 60, entryType: 'dvh1' }));
  check('dvh1 → hvc1 코덱으로 파싱', track?.codec === 'hvc1', `codec=${track?.codec}`);
  check('해상도 파싱', track?.codedWidth === 1280 && track?.codedHeight === 720);
}

console.log('=== 7. 키프레임 디코딩 타임아웃 / 자원 정리 ===');
{
  // 키프레임 4장(0/1/2/3초). 출력을 90ms 간격으로 내면 총 소요는 120ms를 넘지만
  // 매 프레임마다 유휴 타임아웃이 초기화되므로 성공해야 한다.
  const blob = buildMp4({ n: 120, keyEvery: 30 });
  {
    const instanceIndex = FakeVideoDecoder.instances.length;
    FakeVideoDecoder.outputDelayMs = 90;
    FakeVideoDecoder.maxOutputs = Infinity;
    FakeVideoDecoder.staggerOutputs = true; // 90/180/270/360ms 순차 출력
    const startedAt = Date.now();
    const decoded = await mp4.decodeKeyframesNearTimes(blob, [0, 1, 2, 3], {
      targetWidth: 320,
      timeoutMs: 120,
    });
    const elapsed = Date.now() - startedAt;
    check(
      '진행 중이면 타임아웃 연장',
      !!decoded && decoded.length === 4,
      `elapsed=${elapsed}ms decoded=${decoded?.length ?? 'null'}`
    );
    check('누적 소요가 단일 제한시간 초과', elapsed > 120, `elapsed=${elapsed}ms`);
    check('성공 경로 디코더 종료', FakeVideoDecoder.instances[instanceIndex]?.closed === true);
    FakeVideoDecoder.staggerOutputs = false;
  }

  // 출력이 전혀 없으면 제한시간 뒤 null 폴백 + 디코더 정리.
  {
    const instanceIndex = FakeVideoDecoder.instances.length;
    FakeVideoDecoder.outputDelayMs = 2;
    FakeVideoDecoder.maxOutputs = 0;
    const startedAt = Date.now();
    const decoded = await mp4.decodeKeyframesNearTimes(blob, [0, 1, 2, 3], {
      targetWidth: 320,
      timeoutMs: 100,
    });
    const elapsed = Date.now() - startedAt;
    check('출력 정지 시 null 폴백', decoded === null, `elapsed=${elapsed}ms`);
    check('타임아웃 후 디코더 close', FakeVideoDecoder.instances[instanceIndex]?.closed === true);
  }

  // 한 프레임만 내고 멈춘 경우, 이미 만든 VideoFrame도 타임아웃 시 닫혀야 한다.
  {
    const instanceIndex = FakeVideoDecoder.instances.length;
    FakeVideoDecoder.maxOutputs = 1;
    const decoded = await mp4.decodeKeyframesNearTimes(blob, [0, 1, 2, 3], {
      targetWidth: 320,
      timeoutMs: 100,
    });
    const decoderInstance = FakeVideoDecoder.instances[instanceIndex];
    check('부분 진행 후 정지도 null 폴백', decoded === null);
    check(
      '타임아웃 시 생성된 프레임 정리',
      !!decoderInstance?.frames.length && decoderInstance.frames.every((f) => f.closed),
      `frames=${decoderInstance?.frames.length ?? 0}`
    );
  }
  FakeVideoDecoder.maxOutputs = Infinity;
}

console.log('=== 8. 미해제 VideoFrame 서피스 풀 고갈 회피 ===');
{
  const blob = buildMp4({ n: 120, keyEvery: 30 });
  const instanceIndex = FakeVideoDecoder.instances.length;
  FakeVideoDecoder.outputDelayMs = 2;
  FakeVideoDecoder.maxOutputs = Infinity;
  FakeVideoDecoder.maxOpenFrames = 2; // 미해제 프레임 2장까지만 허용
  FakeVideoDecoder.holdUntilFlush = false;
  FakeVideoDecoder.stallHardware = false;
  const progress = [];
  const decoded = await mp4.decodeKeyframesNearTimes(blob, [0, 1, 2, 3], {
    targetWidth: 320,
    timeoutMs: 300,
    onFrameDecoded: (done, total) => progress.push([done, total]),
  });
  check(
    '서피스 풀 2장 제한에서도 4장 전부 디코딩',
    decoded?.length === 4,
    `decoded=${decoded?.length ?? 'null'}`
  );
  const decoderInstance = FakeVideoDecoder.instances[instanceIndex];
  check(
    '모든 VideoFrame 즉시 close',
    !!decoderInstance?.frames.length && decoderInstance.frames.every((f) => f.closed),
    `frames=${decoderInstance?.frames.length ?? 0}`
  );
  check(
    '프레임마다 진행 콜백 즉시 전달',
    progress.length === 4 && progress[3][0] === 4 && progress[3][1] === 4,
    JSON.stringify(progress)
  );
  FakeVideoDecoder.maxOpenFrames = Infinity;
}

console.log('=== 9. 리오더 버퍼 decodeQueueSize 데드락 회피 ===');
{
  const blob = buildMp4({ n: 120, keyEvery: 30 });
  FakeVideoDecoder.outputDelayMs = 2;
  FakeVideoDecoder.maxOutputs = Infinity;
  FakeVideoDecoder.maxOpenFrames = Infinity;
  FakeVideoDecoder.holdUntilFlush = true; // flush() 전까지 프레임을 붙잡는 DPB 재현
  FakeVideoDecoder.stallHardware = false;
  const startedAt = Date.now();
  const decoded = await mp4.decodeKeyframesNearTimes(blob, [0, 1, 2, 3], {
    targetWidth: 320,
    timeoutMs: 300,
  });
  const elapsed = Date.now() - startedAt;
  check(
    'flush 전까지 출력 없어도 데드락 없이 성공',
    decoded?.length === 4,
    `elapsed=${elapsed}ms decoded=${decoded?.length ?? 'null'}`
  );
  FakeVideoDecoder.holdUntilFlush = false;
}

console.log('=== 10. 하드웨어 정체 → 소프트웨어 재시도 ===');
{
  const blob = buildMp4({ n: 120, keyEvery: 30 });
  const instanceIndex = FakeVideoDecoder.instances.length;
  FakeVideoDecoder.outputDelayMs = 2;
  FakeVideoDecoder.maxOutputs = Infinity;
  FakeVideoDecoder.maxOpenFrames = Infinity;
  FakeVideoDecoder.holdUntilFlush = false;
  FakeVideoDecoder.stallHardware = true;
  const decoded = await mp4.decodeKeyframesNearTimes(blob, [0, 1, 2, 3], {
    targetWidth: 320,
    timeoutMs: 300,
  });
  const instances = FakeVideoDecoder.instances.slice(instanceIndex);
  check(
    '하드웨어 정체 후 소프트웨어 재시도 성공',
    decoded?.length === 4,
    `decoded=${decoded?.length ?? 'null'}`
  );
  check('두 번 이상 디코더 생성', instances.length >= 2, `instances=${instances.length}`);
  check('두 번째 디코더는 소프트웨어', instances[1]?.isHardware === false);
  check('정체된 하드웨어 디코더 정리', instances[0]?.closed === true);
  FakeVideoDecoder.stallHardware = false;
}

console.log('=== 11. 부분 프레임 과반 확보 시 정체 무시하고 반환 ===');
{
  const blob = buildMp4({ n: 120, keyEvery: 30 });
  FakeVideoDecoder.outputDelayMs = 2;
  FakeVideoDecoder.maxOutputs = 2; // 4장 중 2장(과반)만 출력하고 정체
  FakeVideoDecoder.maxOpenFrames = Infinity;
  FakeVideoDecoder.holdUntilFlush = false;
  FakeVideoDecoder.stallHardware = false;
  const decoded = await mp4.decodeKeyframesNearTimes(blob, [0, 1, 2, 3], {
    targetWidth: 320,
    timeoutMs: 100,
  });
  check('과반 확보 시 부분 결과 반환', decoded?.length === 2, `decoded=${decoded?.length ?? 'null'}`);
  FakeVideoDecoder.maxOutputs = Infinity;
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
