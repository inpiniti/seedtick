import { lazy, Suspense } from 'react';
import { X } from 'lucide-react';
import type {
  HighlightSegment,
  VideoOrientation,
  VideoOverlayOptions,
} from '../../types/video.ts';
import type { InspectorTarget, PreviewRequest } from './types.ts';
import { LocationInspectorPanel } from './LocationInspectorPanel.tsx';
import { IntroOutroInspectorPanel } from './IntroOutroInspectorPanel.tsx';

// Leaflet 지도는 초기 번들에 포함되지 않도록 lazy 로드
const ReferenceLocationMap = lazy(() =>
  import('./ReferenceLocationMap.tsx').then((m) => ({ default: m.ReferenceLocationMap }))
);

interface RightInspectorDrawerProps {
  target: InspectorTarget;
  segment: HighlightSegment | null;
  thumbnailUrl?: string;
  overlayOptions: VideoOverlayOptions;
  orientation: VideoOrientation;
  onUpdateSegment: (segmentId: string, patch: Partial<HighlightSegment>) => void;
  onApplyToVideo: (sourceVideoId: string, locationName: string) => void;
  onOverlayChange: (patch: Partial<VideoOverlayOptions>) => void;
  onPreviewRequest: (request: PreviewRequest) => void;
  onClose: () => void;
}

export const RightInspectorDrawer = ({
  target,
  segment,
  thumbnailUrl,
  overlayOptions,
  orientation,
  onUpdateSegment,
  onApplyToVideo,
  onOverlayChange,
  onPreviewRequest,
  onClose,
}: RightInspectorDrawerProps) => {
  const title =
    target?.type === 'location'
      ? '촬영 위치 수정'
      : target?.type === 'intro'
      ? '인트로 설정'
      : target?.type === 'outro'
      ? '아웃트로 설정'
      : '';

  return (
    <aside className="sv2-inspector" data-open={Boolean(target)} aria-hidden={!target}>
      <div className="sv2-inspector-head">
        <div className="sv2-inspector-title">{title}</div>
        <button type="button" className="sv2-btn sv2-btn-ghost sv2-btn-icon" onClick={onClose} aria-label="닫기">
          <X size={18} />
        </button>
      </div>

      {target?.type === 'location' && (
        <Suspense fallback={<div className="sv2-map-empty">지도를 불러오는 중…</div>}>
          <LocationInspectorPanel
            segment={segment}
            thumbnailUrl={thumbnailUrl}
            onUpdateSegment={onUpdateSegment}
            onApplyToVideo={onApplyToVideo}
            MapComponent={ReferenceLocationMap}
          />
        </Suspense>
      )}
      {(target?.type === 'intro' || target?.type === 'outro') && (
        <IntroOutroInspectorPanel
          kind={target.type}
          overlayOptions={overlayOptions}
          orientation={orientation}
          onChange={onOverlayChange}
          onPreviewRequest={onPreviewRequest}
        />
      )}
    </aside>
  );
};
