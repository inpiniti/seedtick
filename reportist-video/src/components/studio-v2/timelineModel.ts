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
