// components/studio-v2/previewVideoSlots.ts
// 미리보기 <video> 슬롯 결정 로직을 React 밖으로 분리한 순수 함수 모듈.
//
// 모든 업로드 영상을 <video preload="auto">로 동시에 마운트하면 아이폰 HEVC/10-bit
// 원본 여러 개가 GPU 디코더 슬롯과 VRAM을 동시에 점유해 Chromium GPU 프로세스가
// 크래시(화면 백지 깜빡임)나 <video> 디코더 유실(컷 화면 검정)을 일으킨다.
// 이 모듈은 슬롯을 최대 2개(활성 1 + 다음 컷 예열 1)로 제한하는 규칙을 담당한다.

import type { HighlightSegment } from '../../types/video.ts';
import type { TimelineModel } from './timelineModel.ts';

export interface PreviewVideoSlot {
  videoId: string;
  /** 'auto' = 현재 컷(즉시 프레임 필요), 'metadata' = 예열/ 분석·내보내기 중. */
  preload: 'auto' | 'metadata';
}

export interface PreviewSlotOptions {
  /** 내보내기(재스티칭) 중에는 WebCodecs와 경합하지 않도록 예열 슬롯을 끈다. */
  isExporting?: boolean;
  /** AI 분석 중에도 백그라운드 디코더와 경합하지 않도록 예열 슬롯을 끈다. */
  isProcessing?: boolean;
}

function segmentItems(model: TimelineModel): Array<NonNullable<TimelineModel['items'][number]['segment']>> {
  const out: HighlightSegment[] = [];
  for (const item of model.items) {
    if (item.kind === 'segment' && item.segment) out.push(item.segment);
  }
  return out;
}

/**
 * 현재 재생 위치 기준으로 화면에 보여야 할 컷을 찾는다.
 * 인트로/아웃트로 구간이면 playhead 기준 가장 가까운 컷을 골라,
 * 컷 경계를 넘는 순간 검은 화면이 아니라 미리 예열된 영상이 바로 그려지게 한다.
 */
function focusSegmentAt(
  model: TimelineModel,
  activeSegment: HighlightSegment | null | undefined,
  playhead: number
): HighlightSegment | null {
  if (activeSegment) return activeSegment;
  const segments = segmentItems(model);
  if (segments.length === 0) return null;

  // 타임라인은 intro → segment... → outro 순서이므로 items 순서 = 시간 순서다.
  const items = model.items;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind !== 'segment' || !item.segment) continue;
    if (playhead <= item.end) return item.segment;
  }
  return segments[segments.length - 1];
}

/**
 * 마운트할 <video> 슬롯을 최대 2개로 제한한다.
 *
 * - 활성 컷의 원본 1개 + (예열 허용 시) 다음 컷의 원본 1개.
 * - 분석/내보내기 중에는 활성 1개만 `preload="metadata"`로 유지한다.
 * - 다음 컷이 같은 원본이면 예열 슬롯을 만들지 않는다.
 */
export function resolvePreviewVideoSlots(
  model: TimelineModel,
  activeSegment: HighlightSegment | null | undefined,
  playhead: number,
  options: PreviewSlotOptions = {}
): PreviewVideoSlot[] {
  const focus = focusSegmentAt(model, activeSegment, playhead);
  if (!focus?.sourceVideoId) return [];

  const constrained = Boolean(options.isExporting || options.isProcessing);
  const preload: PreviewVideoSlot['preload'] = constrained || activeSegment !== focus ? 'metadata' : 'auto';
  const slots: PreviewVideoSlot[] = [{ videoId: focus.sourceVideoId, preload }];
  if (constrained) return slots;

  const items = model.items;
  const focusIndex = items.findIndex(
    (item) => item.kind === 'segment' && item.segment?.id === focus.id
  );
  if (focusIndex >= 0) {
    for (let i = focusIndex + 1; i < items.length; i++) {
      const item = items[i];
      if (item.kind !== 'segment' || !item.segment) continue;
      if (item.segment.sourceVideoId !== focus.sourceVideoId) {
        slots.push({ videoId: item.segment.sourceVideoId, preload: 'metadata' });
      }
      break;
    }
  }
  return slots;
}

/** Re-call threshold for a paused scrub / cut selection. */
const PAUSED_SEEK_EPSILON = 0.03;
/** Re-call threshold while playing (only correct large timeline drift). */
const PLAYING_SEEK_EPSILON = 0.3;

/**
 * readyState가 1(HAVE_METADATA) 이상일 때 시크가 필요한지 판단한다.
 * 예전 코드는 readyState < 2에서 일찍 return 해 시크 자체가 호출되지 않고
 * readyState가 1에 영구 정지하는 데드락이 있었다.
 */
export function needsPreviewSeek(
  currentTime: number,
  targetTime: number,
  isPlaying: boolean
): boolean {
  if (!Number.isFinite(currentTime) || !Number.isFinite(targetTime)) return false;
  return Math.abs(currentTime - targetTime) > (isPlaying ? PLAYING_SEEK_EPSILON : PAUSED_SEEK_EPSILON);
}

/**
 * 0초 시작 컷에서 currentTime도 0이면 시크가 생략되어 첫 프레임 GPU 텍스처
 * 업로드가 누락될 수 있다. 아주 작은 값으로 1회 시크해 첫 프레임을 확정한다.
 */
export function firstFrameSeekTime(targetTime: number, hasSeekedOnce: boolean): number | null {
  if (hasSeekedOnce || !Number.isFinite(targetTime) || targetTime > 0.001) return null;
  return 0.001;
}
