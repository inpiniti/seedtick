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

  constructor(callbacks) {
    this.callbacks = callbacks;
    this.decodeQueueSize = 0;
    this.pending = 0;
    this.closed = false;
  }
  configure(config) {
    this.config = config;
  }
  decode(chunk) {
    this.decodeQueueSize++;
    this.pending++;
    // 실제 하드웨어 디코더처럼 비동기로 출력 (프레임 드랍 재현에 중요)
    setTimeout(() => {
      this.decodeQueueSize--;
      this.pending--;
      if (!this.closed) this.callbacks.output(new FakeVideoFrame(chunk.timestamp));
    }, 2);
  }
  async flush() {
    while (this.pending > 0) await new Promise((resolve) => setTimeout(resolve, 1));
  }
  close() {
    this.closed = true;
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

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
