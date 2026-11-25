// 미리보기 검정 화면/백지 깜빡임 회귀 검증.
//
//   npm run verify:preview-fallback
//
// 검증 항목:
//   1. <video> 슬롯이 업로드 수와 무관하게 항상 <= 2개 (활성 1 + 다음 컷 예열 1)
//   2. 분석/내보내기 중에는 예열 슬롯을 끄고 활성 1개만 metadata
//   3. readyState 1(HAVE_METADATA)에서도 시크가 실행되고, 0초 컷은 0.001초로 1회 시크
//   4. drawCompositorCoverFrame이 <video>뿐 아니라 <img>/ImageBitmap 소스도 같은 크롭으로 그림

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  :: ${detail}` : ''}`);
  if (!ok) failures++;
};

const sandbox = {
  console,
  Map,
  Set,
  WeakMap,
  Math,
  Number,
  String,
  Object,
  Promise,
  Error,
  Date,
  document: { createElement: () => ({ getContext: () => null }) },
};

function loadTsModule(file, requireShim = () => {}) {
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

const slots = loadTsModule(
  path.join(root, 'src', 'components', 'studio-v2', 'previewVideoSlots.ts')
);

const frameSpecStub = {
  COMPOSITOR_HEIGHT: 720,
  COMPOSITOR_WIDTH: 1280,
  OVERLAY_FONT_STACK: 'sans-serif',
  LANDSCAPE_PREVIEW_FRAME: { width: 1280, height: 720, orientation: 'landscape', unit: 1 },
  previewFrame: {},
  resolveFrameSpec: () => {},
  fitCanvasFontSize: () => 16,
  fitTextBlock: () => ({ fontSize: 16, lines: ['x'] }),
  overlayFont: () => '16px sans-serif',
};
const metadataStub = {
  formatDateByPattern: () => '',
  formatDateWithAge: () => '',
  getStoredBirthDate: () => undefined,
  getStoredDateFormat: () => 'YYYY.MM.DD',
  getStoredShowAge: () => false,
  parseDateTimeFromString: () => null,
};
const compositor = loadTsModule(path.join(root, 'src', 'services', 'previewCompositorBase.ts'), (id) => {
  if (id.includes('frameSpec')) return frameSpecStub;
  if (id.includes('videoMetadata')) return metadataStub;
  throw new Error(`unexpected import in previewCompositorBase: ${id}`);
});

// ---------------------------------------------------------------------------
console.log('=== 1. 미리보기 <video> 슬롯 상한 ===');
const seg = (id, sourceVideoId) => ({
  id,
  sourceVideoId,
  sourceVideoName: sourceVideoId,
  start: 0,
  end: 2,
  duration: 2,
  reason: '테스트',
});
const items = [
  { key: '__intro__', kind: 'intro', start: 0, end: 1 },
  { key: 'a', kind: 'segment', start: 1, end: 3, segment: seg('a', 'v1') },
  { key: 'b', kind: 'segment', start: 3, end: 5, segment: seg('b', 'v1') },
  { key: 'c', kind: 'segment', start: 5, end: 7, segment: seg('c', 'v2') },
  { key: 'd', kind: 'segment', start: 7, end: 9, segment: seg('d', 'v3') },
  { key: '__outro__', kind: 'outro', start: 9, end: 11 },
];
const model = { items, total: 11, introDuration: 1, outroDuration: 2 };

{
  const active = items[2].segment; // b: 다음 컷 c가 다른 원본(v2)
  const result = slots.resolvePreviewVideoSlots(model, active, 4, {});
  check('활성 1 + 다음 컷 예열 1', result.length === 2, JSON.stringify(result));
  check('활성 슬롯은 preload=auto', result[0]?.videoId === 'v1' && result[0]?.preload === 'auto');
  check('예열 슬롯은 preload=metadata', result[1]?.videoId === 'v2' && result[1]?.preload === 'metadata');
}
{
  // 같은 원본이 연속되면 예열 슬롯을 만들지 않는다.
  const result = slots.resolvePreviewVideoSlots(model, items[1].segment, 2, {});
  check('같은 원본 연속 시 슬롯 1개', result.length === 1, JSON.stringify(result));
}
{
  const result = slots.resolvePreviewVideoSlots(model, items[2].segment, 4, { isProcessing: true });
  check('분석 중 예열 슬롯 제거', result.length === 1 && result[0]?.preload === 'metadata', JSON.stringify(result));
  const exportResult = slots.resolvePreviewVideoSlots(model, items[2].segment, 4, { isExporting: true });
  check('내보내기 중 예열 슬롯 제거', exportResult.length === 1 && exportResult[0]?.preload === 'metadata');
}
{
  // 12개 영상/컷이 있어도 슬롯은 최대 2개.
  const many = {
    items: Array.from({ length: 12 }, (_, i) => ({
      key: `s${i}`,
      kind: 'segment',
      start: i * 2,
      end: i * 2 + 2,
      segment: seg(`s${i}`, `video-${i}`),
    })),
    total: 24,
    introDuration: 0,
    outroDuration: 0,
  };
  const result = slots.resolvePreviewVideoSlots(many, many.items[5].segment, 11, {});
  check('12개 원본에서도 슬롯 <= 2', result.length <= 2, `slots=${result.length}`);
}
{
  // 인트로 구간(활성 컷 없음)에서도 다음 컷 원본을 미리 연다.
  const result = slots.resolvePreviewVideoSlots(model, null, 0.5, {});
  check('인트로 중 다음 컷 예열', result.length === 1 && result[0]?.videoId === 'v1' && result[0]?.preload === 'metadata', JSON.stringify(result));
}
{
  const result = slots.resolvePreviewVideoSlots({ items: [], total: 0, introDuration: 0, outroDuration: 0 }, null, 0, {});
  check('컷 없음 → 슬롯 0개', result.length === 0);
}

// ---------------------------------------------------------------------------
console.log('=== 2. 시크 데드락 해소 ===');
{
  check('readyState 1에서도 같은 시점은 시크 불필요', slots.needsPreviewSeek(3, 3, false) === false);
  check('일시정지 중 0.03초 초과 시크', slots.needsPreviewSeek(3, 3.5, false) === true);
  check('재생 중 0.3초 이내 드리프트 무시', slots.needsPreviewSeek(3, 3.2, true) === false);
  check('재생 중 큰 드리프트 보정', slots.needsPreviewSeek(3, 4, true) === true);
  check('0초 컷 첫 프레임용 0.001초 시크', slots.firstFrameSeekTime(0, false) === 0.001);
  check('이미 시크했으면 재시크 없음', slots.firstFrameSeekTime(0, true) === null);
  check('0초가 아닌 컷은 첫 시크 없음', slots.firstFrameSeekTime(2.5, false) === null);
}

// ---------------------------------------------------------------------------
console.log('=== 3. 이미지 소스 공용 크롭 렌더링 ===');
{
  const drawCalls = [];
  const ctx = {
    save() {},
    beginPath() {},
    rect() {},
    clip() {},
    translate() {},
    rotate() {},
    restore() {},
    drawImage(...args) {
      drawCalls.push(args);
    },
  };
  const frame = frameSpecStub.LANDSCAPE_PREVIEW_FRAME;

  // <img> 소스 (naturalWidth/naturalHeight)
  const imgSource = { naturalWidth: 1920, naturalHeight: 1080 };
  compositor.drawCompositorCoverFrame(ctx, imgSource, undefined, undefined, frame);
  check('img 소스 drawImage 호출', drawCalls.length === 1);
  const args = drawCalls[0];
  check('img 소스가 그대로 전달됨', args[0] === imgSource);
  check('가로 프레임 전체 커버', args[1] === 0 && args[2] === 0 && args[3] === 1920 && args[4] === 1080 && args[7] === 1280 && args[8] === 720, args.join(','));

  // ImageBitmap 소스 (width/height)
  drawCalls.length = 0;
  const bitmapSource = { width: 1280, height: 720 };
  compositor.drawCompositorCoverFrame(ctx, bitmapSource, undefined, undefined, frame);
  check('ImageBitmap 소스 drawImage 호출', drawCalls.length === 1 && drawCalls[0][0] === bitmapSource);

  // 소스 크기가 0이면 VideoItem 크기로 폴백
  drawCalls.length = 0;
  compositor.drawCompositorCoverFrame(ctx, {}, { width: 640, height: 480 }, undefined, frame);
  check(
    '크기 0 소스는 VideoItem 크기 폴백',
    drawCalls.length === 1 && drawCalls[0][3] === 640 && drawCalls[0][4] === 360 && drawCalls[0][2] === 60,
    drawCalls[0]?.slice(1).join(',')
  );
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
