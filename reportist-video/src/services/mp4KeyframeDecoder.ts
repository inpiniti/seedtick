// services/mp4KeyframeDecoder.ts - MP4/MOV 컨테이너에서 키프레임만 바이트 슬라이스로 읽어
// WebCodecs VideoDecoder로 디코딩하여 프레임을 추출합니다.
//
// 이 모듈은 <video> 엘리먼트를 일체 사용하지 않습니다.
//   iOS Safari/WebKit은 <video preload="auto" src="blob:...">로 영상을 여러 번 시크하면
//   전체(또는 상당 부분)를 Library/Caches (MediaCache)에 디스크로 스필합니다.
//   이 경로는 분석/썸네일 프레임 추출에서 MediaCache 기록을 0으로 만드는 것이 목적입니다.
//
// 동작 원리:
//   1. 상위 atom 헤더(8~16B)만 순회하여 moov 박스를 찾습니다.
//   2. moov 전체를 메모리로 읽습니다 (stbl 샘플 테이블 포함, 최대 32MB 이하인 경우에만).
//      iPhone .mov / 카메라 MP4의 moov는 보통 수백 KB ~ 수 MB입니다.
//   3. trak(hdlr=vide)의 stsd(코덱 구성 레코드 avcC/hvcC 등), stts/ctts/stsz/stsc/stco/co64/stss를 파싱해
//      샘플별 offset/size/presentation time/keyframe 여부를 복원합니다.
//   4. 요청한 타임스탬프에 가장 가까운 키프레임만 골라 해당 바이트만 slice().arrayBuffer()로 읽어
//      VideoDecoder(type='key')로 디코딩합니다. (수 MB)
//
// 파싱이나 디코딩이 실패하면 null을 반환합니다. 호출자는 <video> 기반 폴백으로 전환하세요.

export interface DecodedVideoFrame {
  timeSec: number;   // 요청한 타겟 시간(초)
  dataUrl: string;   // 회전(tkhd 매트릭스) 적용된 JPEG data URL
  width: number;     // 반환된 이미지 너비(px)
  height: number;    // 반환된 이미지 높이(px)
}

export interface DecodeKeyframesOptions {
  /** 반환 이미지 최대 너비 (기본 420px, 비율 유지) */
  targetWidth?: number;
  /** JPEG 품질 (기본 0.65) */
  jpegQuality?: number;
  /** 전체 디코딩 타임아웃 (기본 15000ms). 초과 시 null 반환 */
  timeoutMs?: number;
  /** 프레임 하나가 디코딩될 때마다 호출 */
  onFrameDecoded?: (done: number, total: number) => void;
}

interface ParsedVideoSample {
  offset: number;
  size: number;
  ctsSec: number;
  isKey: boolean;
}

interface ParsedVideoTrack {
  codec: string;
  codedWidth: number;
  codedHeight: number;
  description?: Uint8Array;
  timescale: number;
  durationSec: number;
  rotation: number; // 0 | 90 | 180 | 270
  samples: ParsedVideoSample[];
}

const FOURCC = (view: DataView, offset: number): string =>
  String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3)
  );

const isVideoDecoderUsable = (): boolean =>
  typeof VideoDecoder === 'function' && typeof VideoFrame === 'function';

export function isWebCodecsKeyframeDecodeAvailable(): boolean {
  return isVideoDecoderUsable();
}

interface BoxView {
  view: DataView;
  buffer: ArrayBuffer;
  type: string;
  start: number;   // box start (header 포함)
  headerSize: number;
  payloadStart: number;
  payloadSize: number;
  end: number;
}

/** buffer 내부의 [start, end) 구간에서 박스들을 순회 */
function* iterateBoxes(
  buffer: ArrayBuffer,
  start: number,
  end: number
): Generator<BoxView> {
  const view = new DataView(buffer);
  let offset = start;
  let iterations = 0;
  while (offset + 8 <= end && iterations < 4000) {
    iterations++;
    let size = view.getUint32(offset, false);
    const type = FOURCC(view, offset + 4);
    let headerSize = 8;
    if (size === 1) {
      if (offset + 16 > end) break;
      size = Number(view.getBigUint64(offset + 8, false));
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (!Number.isFinite(size) || size < headerSize) break;
    const boxEnd = Math.min(offset + size, end);
    yield {
      view,
      buffer,
      type,
      start: offset,
      headerSize,
      payloadStart: offset + headerSize,
      payloadSize: Math.max(0, boxEnd - offset - headerSize),
      end: boxEnd,
    };
    offset = boxEnd;
  }
}

function findBox(
  buffer: ArrayBuffer,
  start: number,
  end: number,
  type: string
): BoxView | null {
  for (const box of iterateBoxes(buffer, start, end)) {
    if (box.type === type) return box;
  }
  return null;
}

function findBoxes(
  buffer: ArrayBuffer,
  start: number,
  end: number,
  type: string
): BoxView[] {
  const out: BoxView[] = [];
  for (const box of iterateBoxes(buffer, start, end)) {
    if (box.type === type) out.push(box);
  }
  return out;
}

const VIDEO_SAMPLE_ENTRY_TYPES = new Set([
  'avc1', 'avc3', 'hvc1', 'hev1', 'vp08', 'vp09', 'av01',
]);

const CODEC_CONFIG_BOX_TYPES = new Set(['avcC', 'hvcC', 'vpcC', 'av1C']);

const hex2 = (n: number) => n.toString(16).padStart(2, '0');

/**
 * moov 박스를 찾아 전체를 ArrayBuffer로 반환.
 * moov가 너무 크면(32MB 초과) null을 반환한다.
 */
async function readMoovBuffer(file: Blob): Promise<ArrayBuffer | null> {
  const fileSize = file.size;
  let offset = 0;
  let iterations = 0;

  while (offset + 8 <= fileSize && iterations < 200) {
    iterations++;
    const headerBuf = await file.slice(offset, Math.min(fileSize, offset + 16)).arrayBuffer();
    if (headerBuf.byteLength < 8) return null;
    const view = new DataView(headerBuf);

    let boxSize = view.getUint32(0, false);
    const boxType = FOURCC(view, 4);
    let headerSize = 8;

    if (boxSize === 1) {
      if (headerBuf.byteLength < 16) return null;
      boxSize = Number(view.getBigUint64(8, false));
      headerSize = 16;
    } else if (boxSize === 0) {
      boxSize = fileSize - offset;
    }

    if (!Number.isFinite(boxSize) || boxSize < headerSize) return null;

    if (boxType === 'moov') {
      const moovEnd = Math.min(fileSize, offset + boxSize);
      const moovLen = moovEnd - offset;
      const MAX_MOOV_READ = 32 * 1024 * 1024; // 32MB
      if (moovLen > MAX_MOOV_READ) return null;
      return await file.slice(offset, moovEnd).arrayBuffer();
    }

    offset += boxSize;
  }
  return null;
}

/** mdhd / mvhd 박스에서 (timescale, duration) 추출 */
function parseTimescaleAndDuration(box: BoxView): { timescale: number; durationSec: number } | null {
  const { view, payloadStart, payloadSize } = box;
  if (payloadSize < 16) return null;
  const version = view.getUint8(payloadStart);
  let offset = payloadStart + 4; // version + flags

  if (version === 1) {
    offset += 16; // creation_time(8) + modification_time(8)
  } else {
    offset += 8; // creation_time(4) + modification_time(4)
  }

  if (offset + 8 > payloadStart + payloadSize) return null;
  const timescale = view.getUint32(offset, false);
  offset += 4;
  let duration = 0;
  if (version === 1) {
    duration = Number(view.getBigUint64(offset, false));
  } else {
    duration = view.getUint32(offset, false);
  }
  if (!Number.isFinite(timescale) || timescale <= 0) return null;
  return { timescale, durationSec: duration / timescale };
}

/** tkhd 매트릭스에서 회전 각도(0/90/180/270) 추출 */
function parseRotationFromTkhd(box: BoxView): number {
  const { view, payloadStart, payloadSize } = box;
  if (payloadSize < 40) return 0;

  const version = view.getUint8(payloadStart);
  let offset = payloadStart + 4; // version + flags
  offset += version === 1 ? 16 : 8; // creation/modification time
  offset += 4; // track_ID
  offset += 4; // reserved
  offset += version === 1 ? 8 : 4; // duration
  offset += 10; // reserved(2) + layer(2) + alternate_group(2) + volume(2) + reserved(2)

  // matrix = 9 × int32 (16.16 / 2.30 고정소수점)
  if (offset + 36 > payloadStart + payloadSize) return 0;
  const a = view.getInt32(offset, false) / 65536;
  const b = view.getInt32(offset + 4, false) / 65536;

  const angleRad = Math.atan2(b, a);
  let degrees = Math.round((angleRad * 180) / Math.PI);
  degrees = ((degrees % 360) + 360) % 360;
  // 90° 배수로 정규화
  const snapped = Math.round(degrees / 90) * 90;
  return ((snapped % 360) + 360) % 360;
}

interface SampleTables {
  dtsTicks: number[];
  ctsTicks: number[];
  sizes: number[];
  offsets: number[];
  keyframeIndices: number[]; // 0-based sample indices
}

function parseStbl(buffer: ArrayBuffer, stbl: BoxView): SampleTables | null {
  const { payloadStart, payloadSize } = stbl;
  const end = payloadStart + payloadSize;

  const stts = findBox(buffer, payloadStart, end, 'stts');
  if (!stts) return null;
  const stsz = findBox(buffer, payloadStart, end, 'stsz');
  if (!stsz) return null;
  const stsc = findBox(buffer, payloadStart, end, 'stsc');
  if (!stsc) return null;
  const stco = findBox(buffer, payloadStart, end, 'stco');
  const co64 = stco ? null : findBox(buffer, payloadStart, end, 'co64');
  if (!stco && !co64) return null;
  const stss = findBox(buffer, payloadStart, end, 'stss');
  const ctts = findBox(buffer, payloadStart, end, 'ctts');

  const view = new DataView(buffer);

  // ---- stsz: 샘플 크기 ----
  const stszPayload = stsz.payloadStart;
  if (stsz.payloadSize < 12) return null;
  const uniformSampleSize = view.getUint32(stszPayload + 4, false);
  const sampleCount = view.getUint32(stszPayload + 8, false);
  if (sampleCount <= 0 || sampleCount > 500_000) return null;

  const sizes = new Array<number>(sampleCount);
  if (uniformSampleSize !== 0) {
    for (let i = 0; i < sampleCount; i++) sizes[i] = uniformSampleSize;
  } else {
    if (stsz.payloadSize < 12 + sampleCount * 4) return null;
    const sizeTableStart = stszPayload + 12;
    for (let i = 0; i < sampleCount; i++) {
      sizes[i] = view.getUint32(sizeTableStart + i * 4, false);
    }
  }

  // ---- stts: dts(누적) 복원 ----
  const dtsTicks = new Array<number>(sampleCount);
  {
    const sttsPayload = stts.payloadStart;
    if (stts.payloadSize < 8) return null;
    const entryCount = view.getUint32(sttsPayload + 4, false);
    let cursor = sttsPayload + 8;
    let sampleIndex = 0;
    let dts = 0;
    for (let i = 0; i < entryCount && sampleIndex < sampleCount; i++) {
      if (cursor + 8 > stts.payloadStart + stts.payloadSize) break;
      const count = view.getUint32(cursor, false);
      const delta = view.getUint32(cursor + 4, false);
      cursor += 8;
      for (let j = 0; j < count && sampleIndex < sampleCount; j++) {
        dtsTicks[sampleIndex] = dts;
        dts += delta;
        sampleIndex++;
      }
    }
    // 누락분 방어: 0으로 채움
    for (let i = 0; i < sampleCount; i++) {
      if (dtsTicks[i] === undefined) dtsTicks[i] = 0;
    }
  }

  // ---- ctts: composition time offset ----
  const ctsTicks = new Array<number>(sampleCount);
  if (ctts) {
    const cttsPayload = ctts.payloadStart;
    const cttsVersion = view.getUint8(cttsPayload);
    let cursor = cttsPayload + 8; // version/flags(4) + entry_count(4)
    if (ctts.payloadSize >= 8) {
      const entryCount = view.getUint32(cttsPayload + 4, false);
      let sampleIndex = 0;
      for (let i = 0; i < entryCount && sampleIndex < sampleCount; i++) {
        if (cursor + 8 > ctts.payloadStart + ctts.payloadSize) break;
        const count = view.getUint32(cursor, false);
        const rawOffset = view.getUint32(cursor + 4, false);
        // version 1부터 offset은 signed int32
        const offset = cttsVersion === 1 ? (rawOffset | 0) : rawOffset;
        cursor += 8;
        for (let j = 0; j < count && sampleIndex < sampleCount; j++) {
          ctsTicks[sampleIndex] = dtsTicks[sampleIndex] + offset;
          sampleIndex++;
        }
      }
    }
    for (let i = 0; i < sampleCount; i++) {
      if (ctsTicks[i] === undefined) ctsTicks[i] = dtsTicks[i];
    }
  } else {
    for (let i = 0; i < sampleCount; i++) ctsTicks[i] = dtsTicks[i];
  }

  // ---- stsc + stco/co64: 청크 오프셋 → 샘플 오프셋 ----
  const chunkOffsets: number[] = [];
  {
    const table = stco ?? co64!;
    const tablePayload = table.payloadStart;
    if (table.payloadSize < 8) return null;
    const entryCount = view.getUint32(tablePayload + 4, false);
    const bytesPerOffset = stco ? 4 : 8;
    if (table.payloadSize < 8 + entryCount * bytesPerOffset) return null;
    let cursor = tablePayload + 8;
    for (let i = 0; i < entryCount; i++) {
      chunkOffsets.push(
        stco ? view.getUint32(cursor, false) : Number(view.getBigUint64(cursor, false))
      );
      cursor += bytesPerOffset;
    }
  }

  const offsets = new Array<number>(sampleCount);
  {
    const stscPayload = stsc.payloadStart;
    if (stsc.payloadSize < 8) return null;
    const entryCount = view.getUint32(stscPayload + 4, false);
    if (stsc.payloadSize < 8 + entryCount * 12) return null;
    let sampleIndex = 0;
    for (let i = 0; i < entryCount && sampleIndex < sampleCount; i++) {
      const entryOffset = stscPayload + 8 + i * 12;
      const firstChunk = view.getUint32(entryOffset, false); // 1-based
      const samplesPerChunk = view.getUint32(entryOffset + 4, false);
      const nextFirstChunk =
        i + 1 < entryCount ? view.getUint32(stscPayload + 8 + (i + 1) * 12, false) : chunkOffsets.length + 1;

      for (let chunk = firstChunk; chunk < nextFirstChunk && sampleIndex < sampleCount; chunk++) {
        if (chunk < 1 || chunk - 1 >= chunkOffsets.length) return null;
        let offset = chunkOffsets[chunk - 1];
        for (let j = 0; j < samplesPerChunk && sampleIndex < sampleCount; j++) {
          offsets[sampleIndex] = offset;
          offset += sizes[sampleIndex];
          sampleIndex++;
        }
      }
    }
    if (sampleIndex !== sampleCount) {
      // stsc/stco가 샘플 수와 불일치하면 안전하게 포기
      return null;
    }
  }

  // ---- stss: 키프레임 목록 (없으면 전체가 키프레임) ----
  let keyframeIndices: number[] = [];
  if (stss) {
    const stssPayload = stss.payloadStart;
    if (stss.payloadSize >= 8) {
      const entryCount = view.getUint32(stssPayload + 4, false);
      if (stss.payloadSize >= 8 + entryCount * 4) {
        keyframeIndices = new Array<number>(entryCount);
        for (let i = 0; i < entryCount; i++) {
          keyframeIndices[i] = view.getUint32(stssPayload + 8 + i * 4, false) - 1; // 0-based
        }
        keyframeIndices.sort((a, b) => a - b);
      }
    }
  } else {
    keyframeIndices = Array.from({ length: sampleCount }, (_, i) => i);
  }

  return { dtsTicks, ctsTicks, sizes, offsets, keyframeIndices };
}

function parseStsdForCodec(buffer: ArrayBuffer, stbl: BoxView): {
  codec: string;
  codedWidth: number;
  codedHeight: number;
  description?: Uint8Array;
} | null {
  const end = stbl.payloadStart + stbl.payloadSize;
  const stsd = findBox(buffer, stbl.payloadStart, end, 'stsd');
  if (!stsd || stsd.payloadSize < 16) return null;

  const view = new DataView(buffer);
  const entriesStart = stsd.payloadStart + 8; // version/flags + entry_count
  const entriesEnd = stsd.payloadStart + stsd.payloadSize;
  if (entriesStart + 8 > entriesEnd) return null;

  let cursor = entriesStart;
  while (cursor + 8 <= entriesEnd) {
    const entrySize = view.getUint32(cursor, false);
    const entryType = FOURCC(view, cursor + 4);
    if (entrySize < 8) break;
    const entryEnd = Math.min(cursor + entrySize, entriesEnd);

    if (VIDEO_SAMPLE_ENTRY_TYPES.has(entryType)) {
      const visualStart = cursor + 8;
      // VisualSampleEntry: reserved(6)+data_reference_index(2)+pre_defined(2)+reserved(2)
      //   + pre_defined[3](12) + width(2) + height(2) ...
      const width = view.getUint16(visualStart + 24, false);
      const height = view.getUint16(visualStart + 26, false);

      // 코덱 구성 박스는 VisualSampleEntry 페이로드 시작 + 78바이트부터
      const configSearchStart = visualStart + 78;
      let codecConfig: { type: string; description: Uint8Array } | null = null;

      for (const box of iterateBoxes(buffer, configSearchStart, entryEnd)) {
        if (CODEC_CONFIG_BOX_TYPES.has(box.type) && box.payloadSize > 0) {
          codecConfig = {
            type: box.type,
            description: new Uint8Array(buffer, box.payloadStart, box.payloadSize).slice(),
          };
          break;
        }
      }

      let codec = '';
      if (entryType === 'avc1' || entryType === 'avc3') {
        if (codecConfig && codecConfig.description.length >= 4) {
          codec = `avc1.${hex2(codecConfig.description[1])}${hex2(codecConfig.description[2])}${hex2(codecConfig.description[3])}`;
        } else {
          codec = 'avc1';
        }
      } else if (entryType === 'hvc1' || entryType === 'hev1') {
        codec = 'hvc1';
      } else if (entryType === 'vp09') {
        codec = 'vp09';
      } else if (entryType === 'vp08') {
        codec = 'vp08';
      } else if (entryType === 'av01') {
        codec = 'av01';
      }

      // description: avcC/hvcC/vpcC/av1C 박스의 "페이로드" (박스 헤더 제외)
      return {
        codec,
        codedWidth: width,
        codedHeight: height,
        description: codecConfig?.description,
      };
    }

    cursor = entryEnd;
  }
  return null;
}

/** MP4/MOV 파일의 비디오 트랙 샘플 테이블을 파싱 */
async function parseMp4VideoTrack(file: Blob): Promise<ParsedVideoTrack | null> {
  const moovBuffer = await readMoovBuffer(file);
  if (!moovBuffer) return null;

  const moov = findBox(moovBuffer, 0, moovBuffer.byteLength, 'moov');
  if (!moov) return null;

  const moovEnd = moov.payloadStart + moov.payloadSize;
  const movieDurationBox = findBox(moovBuffer, moov.payloadStart, moovEnd, 'mvhd');
  const movieDuration = movieDurationBox ? parseTimescaleAndDuration(movieDurationBox) : null;

  for (const trak of findBoxes(moovBuffer, moov.payloadStart, moovEnd, 'trak')) {
    const trakEnd = trak.payloadStart + trak.payloadSize;
    const mdia = findBox(moovBuffer, trak.payloadStart, trakEnd, 'mdia');
    if (!mdia) continue;
    const mdiaEnd = mdia.payloadStart + mdia.payloadSize;

    // hdlr handler가 vide인 트랙만 선택
    const hdlr = findBox(moovBuffer, mdia.payloadStart, mdiaEnd, 'hdlr');
    if (hdlr) {
      const view = new DataView(moovBuffer);
      // version/flags(4) + pre_defined(4) + handler_type(4)
      if (hdlr.payloadSize >= 12) {
        const handler = FOURCC(view, hdlr.payloadStart + 8);
        if (handler !== 'vide') continue;
      }
    }

    const mdhd = findBox(moovBuffer, mdia.payloadStart, mdiaEnd, 'mdhd');
    const mdhdInfo = mdhd ? parseTimescaleAndDuration(mdhd) : null;
    const timescale = mdhdInfo?.timescale ?? 1000;

    const minf = findBox(moovBuffer, mdia.payloadStart, mdiaEnd, 'minf');
    if (!minf) continue;
    const minfEnd = minf.payloadStart + minf.payloadSize;
    const stbl = findBox(moovBuffer, minf.payloadStart, minfEnd, 'stbl');
    if (!stbl) continue;
    const stblEnd = stbl.payloadStart + stbl.payloadSize;

    const codecInfo = parseStsdForCodec(moovBuffer, stbl);
    if (!codecInfo) continue;

    const tables = parseStbl(moovBuffer, stbl);
    if (!tables) continue;

    const { offsets, sizes, ctsTicks, keyframeIndices } = tables;
    const sampleCount = sizes.length;
    if (sampleCount === 0) continue;

    const keyframeSet = new Set(keyframeIndices);
    const samples: ParsedVideoSample[] = new Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
      if (offsets[i] <= 0) return null; // 오프셋 불일치 트랙은 안전하게 포기
      samples[i] = {
        offset: offsets[i],
        size: sizes[i],
        ctsSec: ctsTicks[i] / timescale,
        isKey: keyframeSet.has(i),
      };
    }

    const tkhd = findBox(moovBuffer, trak.payloadStart, trakEnd, 'tkhd');
    const rotation = tkhd ? parseRotationFromTkhd(tkhd) : 0;

    const durationSec =
      mdhdInfo && mdhdInfo.durationSec > 0
        ? mdhdInfo.durationSec
        : movieDuration && movieDuration.durationSec > 0
          ? movieDuration.durationSec
          : samples.length > 0
            ? samples[samples.length - 1].ctsSec
            : 0;

    return {
      codec: codecInfo.codec,
      codedWidth: codecInfo.codedWidth,
      codedHeight: codecInfo.codedHeight,
      description: codecInfo.description,
      timescale,
      durationSec,
      rotation,
      samples,
    };
  }

  return null;
}

/** 디코딩 프레임을 회전 적용 + 비율 유지 JPEG dataUrl로 변환 */
function drawFrameToDataUrl(
  frame: VideoFrame,
  rotation: number,
  targetWidth: number,
  jpegQuality: number
): { dataUrl: string; width: number; height: number } | null {
  try {
    const vw = frame.displayWidth || frame.codedWidth;
    const vh = frame.displayHeight || frame.codedHeight;
    if (!vw || !vh) return null;

    const normRot = ((rotation % 360) + 360) % 360;
    const isSideways = normRot === 90 || normRot === 270;
    const outW = isSideways ? vh : vw;
    const outH = isSideways ? vw : vh;
    const scale = Math.min(1, targetWidth / outW);
    const canvasW = Math.max(2, Math.round((outW * scale) / 2) * 2);
    const canvasH = Math.max(2, Math.round((outH * scale) / 2) * 2);

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;

    if (normRot === 0) {
      ctx.drawImage(frame, 0, 0, canvasW, canvasH);
    } else {
      ctx.save();
      ctx.translate(canvasW / 2, canvasH / 2);
      ctx.rotate((normRot * Math.PI) / 180);
      const rawW = Math.round(vw * scale);
      const rawH = Math.round(vh * scale);
      ctx.drawImage(frame, -rawW / 2, -rawH / 2, rawW, rawH);
      ctx.restore();
    }

    const dataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
    canvas.width = 1;
    canvas.height = 1;
    return { dataUrl, width: canvasW, height: canvasH };
  } catch (err) {
    console.warn('[mp4KeyframeDecoder] 프레임 드로우 실패:', err);
    return null;
  }
}

/**
 * MP4/MOV 파일에서 요청한 타임스탬프에 가장 가까운 키프레임을 디코딩하여 JPEG data URL 목록을 반환.
 *
 * @returns 성공 시 DecodedVideoFrame[] (요청 시간 순서, 실패 샘플은 제외될 수 있음).
 *          WebCodecs 미지원 / 파싱 실패 / 디코딩 실패 시 null → <video> 폴백을 사용하세요.
 */
export async function decodeKeyframesNearTimes(
  file: Blob,
  timesSec: number[],
  options: DecodeKeyframesOptions = {}
): Promise<DecodedVideoFrame[] | null> {
  if (!isVideoDecoderUsable()) return null;
  if (!file || file.size <= 0 || timesSec.length === 0) return null;

  const {
    targetWidth = 420,
    jpegQuality = 0.65,
    timeoutMs = 15_000,
    onFrameDecoded,
  } = options;

  let track: ParsedVideoTrack | null = null;
  try {
    track = await parseMp4VideoTrack(file);
  } catch (err) {
    console.warn('[mp4KeyframeDecoder] MP4 파싱 실패:', err);
    return null;
  }
  if (!track || track.samples.length === 0) {
    return null;
  }

  // keyframe 배열은 samples로부터 재구성 (cts 정렬)
  const keySamples = track.samples.filter((s) => s.isKey);
  if (keySamples.length === 0) return null;
  keySamples.sort((a, b) => a.ctsSec - b.ctsSec);

  // 요청 순서를 유지하며, 각 요청 시간에 가장 가까운 키프레임 선택
  const requestToKeyframe = new Map<number, number>(); // requestIndex -> keySamples index
  const uniqueDecodeList: Array<{ pos: number; ctsSec: number }> = [];
  const seen = new Set<number>();
  for (let i = 0; i < timesSec.length; i++) {
    const target = Number.isFinite(timesSec[i]) ? Math.max(0, timesSec[i]) : 0;
    let bestPos = 0;
    let bestDiff = Infinity;
    for (let k = 0; k < keySamples.length; k++) {
      const diff = Math.abs(keySamples[k].ctsSec - target);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestPos = k;
      } else if (keySamples[k].ctsSec > target && diff >= bestDiff) {
        // 단조 증가 구간에서는 조기 종료 가능 (키프레임이 cts 정렬됨)
        break;
      }
    }
    requestToKeyframe.set(i, bestPos);
    if (!seen.has(bestPos)) {
      seen.add(bestPos);
      uniqueDecodeList.push({ pos: bestPos, ctsSec: keySamples[bestPos].ctsSec });
    }
  }

  // 디코더 구성
  const buildConfig = (hardwareAcceleration: HardwareAcceleration): VideoDecoderConfig => ({
    codec: track.codec,
    codedWidth: track.codedWidth || undefined,
    codedHeight: track.codedHeight || undefined,
    description: track.description,
    hardwareAcceleration,
    optimizeForLatency: true,
  } as VideoDecoderConfig);

  let config: VideoDecoderConfig | null = null;
  try {
    const preferred = await VideoDecoder.isConfigSupported(buildConfig('prefer-hardware'));
    if (preferred?.supported) {
      config = buildConfig('prefer-hardware');
    } else {
      const fallback = await VideoDecoder.isConfigSupported(buildConfig('prefer-software'));
      if (fallback?.supported) config = buildConfig('prefer-software');
    }
  } catch {
    config = null;
  }
  if (!config) return null;

  // 디코딩 실행
  const decodeOnce = async (): Promise<Map<number, VideoFrame>> => {
    const framesByTimestamp = new Map<number, VideoFrame>();
    let decodeError: unknown = null;

    const decoder = new VideoDecoder({
      output: (frame) => {
        const ts = frame.timestamp;
        const existing = framesByTimestamp.get(ts);
        if (existing) {
          try { existing.close(); } catch {}
        }
        framesByTimestamp.set(ts, frame);
      },
      error: (err) => {
        decodeError = err;
      },
    });

    try {
      decoder.configure(config!);

      uniqueDecodeList.sort((a, b) => a.ctsSec - b.ctsSec);
      for (const item of uniqueDecodeList) {
        if (decodeError) break;
        const sample = keySamples[item.pos];
        // 바이트 슬라이스로 해당 키프레임만 읽기 (수 MB)
        const data = await file.slice(sample.offset, sample.offset + sample.size).arrayBuffer();
        decoder.decode(
          new EncodedVideoChunk({
            type: 'key',
            timestamp: Math.max(0, Math.round(sample.ctsSec * 1_000_000)),
            data,
          })
        );
      }
      await decoder.flush();
    } finally {
      try { decoder.close(); } catch {}
    }

    if (decodeError) {
      for (const frame of framesByTimestamp.values()) {
        try { frame.close(); } catch {}
      }
      throw decodeError;
    }
    return framesByTimestamp;
  };

  let framesByTimestamp: Map<number, VideoFrame>;
  try {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    framesByTimestamp = await Promise.race([
      decodeOnce(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('키프레임 디코딩 타임아웃')), timeoutMs);
      }),
    ]).finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    });
  } catch (err) {
    console.warn('[mp4KeyframeDecoder] 디코딩 실패:', err);
    return null;
  }

  // 요청 순서대로 결과 구성
  const results: DecodedVideoFrame[] = [];
  let decodedCount = 0;
  const totalTargets = timesSec.length;

  for (let i = 0; i < timesSec.length; i++) {
    const keyPos = requestToKeyframe.get(i);
    if (keyPos === undefined) continue;
    const sample = keySamples[keyPos];
    const tsMicros = Math.max(0, Math.round(sample.ctsSec * 1_000_000));
    const frame = framesByTimestamp.get(tsMicros);
    if (!frame) continue;

    const drawn = drawFrameToDataUrl(frame, track.rotation, targetWidth, jpegQuality);
    if (drawn) {
      results.push({
        timeSec: Number.isFinite(timesSec[i]) ? timesSec[i] : sample.ctsSec,
        dataUrl: drawn.dataUrl,
        width: drawn.width,
        height: drawn.height,
      });
    }
    decodedCount++;
    onFrameDecoded?.(decodedCount, totalTargets);
  }

  // VideoFrame 정리
  for (const frame of framesByTimestamp.values()) {
    try { frame.close(); } catch {}
  }

  return results;
}

export interface Mp4TrackInfo {
  durationSec: number;
  width: number;
  height: number;
  rotation: number; // 0 | 90 | 180 | 270
  codec: string;
}

/**
 * MP4/MOV 파일의 비디오 트랙 헤더(duration, 해상도, 회전, 코덱)만 가볍게 파싱.
 * moov 박스만 읽으므로 파일 전체를 메모리에 올리지 않는다.
 * 파싱 불가(non-MP4, 손상된 파일 등) 시 null.
 */
export async function getMp4TrackInfo(file: Blob): Promise<Mp4TrackInfo | null> {
  try {
    const track = await parseMp4VideoTrack(file);
    if (!track) return null;
    return {
      durationSec: track.durationSec,
      width: track.codedWidth,
      height: track.codedHeight,
      rotation: track.rotation,
      codec: track.codec,
    };
  } catch (err) {
    console.warn('[mp4KeyframeDecoder] 트랙 정보 파싱 실패:', err);
    return null;
  }
}
