// components/studio-v2/timelineModel.ts
// 타임라인 3트랙의 시간 배치를 계산하는 순수 함수.
// 미리보기 재생·스크러빙·내보내기 미리보기가 동일한 모델을 사용한다.

import type { HighlightSegment, VideoOverlayOptions } from '../../types/video.ts';

export interface TimelineItem {
  key: string;
  kind: 'intro' | 'segment' | 'outro';
  start: number;
  end: number;
  segment?: HighlightSegment;
}

export interface TimelineModel {
  items: TimelineItem[];
  total: number;
  introDuration: number;
  outroDuration: number;
}

export function buildTimeline(
  segments: HighlightSegment[],
  overlayOptions: VideoOverlayOptions
): TimelineModel {
  const introDuration = overlayOptions.showIntro
    ? Math.max(0.5, overlayOptions.introDurationSec ?? 2)
    : 0;
  const outroDuration = overlayOptions.showOutro
    ? Math.max(0.5, overlayOptions.outroDurationSec ?? 2.2)
    : 0;

  let cursor = introDuration;
  const items: TimelineItem[] = [];

  if (introDuration > 0) {
    items.push({ key: '__intro__', kind: 'intro', start: 0, end: introDuration });
  }

  segments.forEach((segment, index) => {
    const duration = Math.max(0.1, segment.duration || 0.1);
    items.push({
      key: segment.id || `segment-${index}`,
      kind: 'segment',
      start: cursor,
      end: cursor + duration,
      segment,
    });
    cursor += duration;
  });

  if (outroDuration > 0) {
    items.push({
      key: '__outro__',
      kind: 'outro',
      start: cursor,
      end: cursor + outroDuration,
    });
    cursor += outroDuration;
  }

  return { items, total: cursor, introDuration, outroDuration };
}

export function resolveTimelineItem(model: TimelineModel, time: number): TimelineItem | null {
  const t = Math.max(0, Math.min(time, Math.max(0, model.total - 0.0001)));
  for (const item of model.items) {
    if (t >= item.start && t < item.end) return item;
  }
  return model.items[model.items.length - 1] ?? null;
}

// ---------- 시간 ↔ 픽셀 결정적 레이아웃 ----------
// 칩 너비는 텍스트 길이가 아니라 "시간 비례 + 최소 가독 폭"으로 계산한다.
// 인트로/아웃트로가 꺼져도 칩은 DOM에 남으므로, 0초와 끝 시점은
// 각각 첫 컷의 왼쪽 경계 / 마지막 컷의 오른쪽 경계에 정확히 붙는다.
export const TIMELINE_PX_PER_SEC = 52;
export const TIMELINE_MIN_CHIP_WIDTH = 78;
export const TIMELINE_CHIP_GAP = 5;

export interface TimelineSpan {
  key: string;
  kind: 'intro' | 'segment' | 'outro';
  start: number;
  end: number;
  left: number;
  right: number;
  width: number;
  /** 실제 시간 구간이 존재하는가 (인트로/아웃트로 꺼짐이면 false). */
  active: boolean;
}

export interface TimelineLayout {
  spans: TimelineSpan[];
  active: TimelineSpan[];
  totalWidth: number;
  total: number;
}

export function buildTimelineLayout(model: TimelineModel): TimelineLayout {
  const spans: TimelineSpan[] = [];
  let cursor = 0;

  const push = (key: string, kind: TimelineSpan['kind'], start: number, end: number) => {
    const width = Math.max(
      TIMELINE_MIN_CHIP_WIDTH,
      Math.round((end - start) * TIMELINE_PX_PER_SEC)
    );
    spans.push({
      key,
      kind,
      start,
      end,
      left: cursor,
      right: cursor + width,
      width,
      active: end > start,
    });
    cursor += width + TIMELINE_CHIP_GAP;
  };

  push('__intro__', 'intro', 0, model.introDuration);
  for (const item of model.items) {
    if (item.kind === 'segment') push(item.key, 'segment', item.start, item.end);
  }
  push('__outro__', 'outro', Math.max(0, model.total - model.outroDuration), model.total);

  return {
    spans,
    active: spans.filter((span) => span.active),
    totalWidth: Math.max(TIMELINE_MIN_CHIP_WIDTH, cursor - TIMELINE_CHIP_GAP),
    total: model.total,
  };
}

/** 초 단위 재생 위치 → 레인 기준 픽셀 X (컷 경계에서 정확히 일치). */
export function timeToTimelineX(layout: TimelineLayout, time: number): number {
  const active = layout.active;
  if (active.length === 0) return 0;
  const t = Math.max(0, Math.min(time, layout.total));
  for (const span of active) {
    if (t >= span.start && t <= span.end) {
      return span.width > 0
        ? span.left + ((t - span.start) / (span.end - span.start)) * span.width
        : span.left;
    }
  }
  return t < active[0].start ? active[0].left : active[active.length - 1].right;
}

/** 레인 기준 픽셀 X → 초 단위 재생 위치 (룰러 클릭·드래그 역산). */
export function timelineXToTime(layout: TimelineLayout, x: number): number {
  const active = layout.active;
  if (active.length === 0) return 0;
  const first = active[0];
  const last = active[active.length - 1];
  if (x <= first.left) return first.start;
  if (x >= last.right) return last.end;
  for (const span of active) {
    if (x >= span.left && x <= span.right) {
      return span.width > 0
        ? span.start + ((x - span.left) / span.width) * (span.end - span.start)
        : span.start;
    }
  }
  return last.end;
}
