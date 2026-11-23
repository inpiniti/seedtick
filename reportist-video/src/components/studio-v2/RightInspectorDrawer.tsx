import { X } from 'lucide-react';
import type {
  HighlightSegment,
  VideoOrientation,
  VideoOverlayOptions,
} from '../../types/video.ts';
import { useI18n } from '../../i18n/index.tsx';
import type { InspectorTarget, PreviewRequest } from './types.ts';
import { LocationInspectorPanel } from './LocationInspectorPanel.tsx';
import { IntroOutroInspectorPanel } from './IntroOutroInspectorPanel.tsx';
import { MusicInspectorPanel, type MusicInspectorProps } from './MusicInspectorPanel.tsx';
import { ReferenceLocationMap } from './ReferenceLocationMap.tsx';

// ReferenceLocationMap은 정적 import 한다.
// React.lazy로 두면 미리보기의 '위치 수정'을 누르는 순간 동적 import가 발생하고,
// 배포 후 만료된 청크(CSS 포함)를 물고 있는 탭에서는 chunkLoadRecovery가
// window.location.reload()를 호출해 위치 수정 버튼이 새로고침으로 오인됐다.
// 지도를 정적으로 불러오면 위치 인스펙터를 열 때 동적 import가 일어나지 않는다.

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
  /** 음악 패널 상태·액션 (타임라인 음악 트랙과 동일한 값을 공유). */
  music: MusicInspectorProps;
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
  music,
  onClose,
}: RightInspectorDrawerProps) => {
  const { ui, t } = useI18n();
  const title =
    target?.type === 'location'
      ? ui('촬영 위치 수정')
      : target?.type === 'intro'
      ? ui('인트로 설정')
      : target?.type === 'outro'
      ? ui('아웃트로 설정')
      : target?.type === 'music'
      ? t('audioLibrary.title')
      : '';

  return (
    <aside className="sv2-inspector" data-open={Boolean(target)} aria-hidden={!target}>
      <div className="sv2-inspector-head">
        <div className="sv2-inspector-title">{title}</div>
        <button type="button" className="sv2-btn sv2-btn-ghost sv2-btn-icon" onClick={onClose} aria-label={ui('닫기')}>
          <X size={18} />
        </button>
      </div>

      {target?.type === 'location' && (
        <LocationInspectorPanel
          segment={segment}
          thumbnailUrl={thumbnailUrl}
          onUpdateSegment={onUpdateSegment}
          onApplyToVideo={onApplyToVideo}
          MapComponent={ReferenceLocationMap}
        />
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
      {target?.type === 'music' && <MusicInspectorPanel {...music} />}
    </aside>
  );
};
