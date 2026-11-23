import { useEffect, useState } from 'react';
import { MapPin, RotateCcw, Trash2 } from 'lucide-react';
import type { HighlightSegment } from '../../types/video.ts';
import { formatShootDate } from './types.ts';

// components/studio-v2/LocationInspectorPanel.tsx
// 촬영 위치 수정 + 같은 원본 영상 일괄 적용 + 하단 참고 지도.

interface LocationInspectorPanelProps {
  segment: HighlightSegment | null;
  thumbnailUrl?: string;
  onUpdateSegment: (segmentId: string, patch: Partial<HighlightSegment>) => void;
  onApplyToVideo: (sourceVideoId: string, locationName: string) => void;
  MapComponent: React.ComponentType<{
    latitude?: number;
    longitude?: number;
    label?: string;
  }>;
}

export const LocationInspectorPanel = ({
  segment,
  thumbnailUrl,
  onUpdateSegment,
  onApplyToVideo,
  MapComponent,
}: LocationInspectorPanelProps) => {
  const [draft, setDraft] = useState('');
  const [applyToVideo, setApplyToVideo] = useState(true);

  useEffect(() => {
    setDraft(segment?.locationName || '');
  }, [segment?.id, segment?.locationName]);

  if (!segment) {
    return (
      <div className="sv2-map-empty">
        <MapPin size={26} />
        <strong>선택된 컷이 없어요</strong>
        <span>타임라인의 컷을 누르면 이곳에서 촬영 위치를 바꿀 수 있어요.</span>
      </div>
    );
  }

  const commit = (value: string) => {
    setDraft(value);
    onUpdateSegment(segment.id, { locationName: value });
    if (applyToVideo) onApplyToVideo(segment.sourceVideoId, value);
  };

  return (
    <div className="sv2-inspector-body">
      <div className="sv2-inspector-preview">
        {thumbnailUrl ? (
          <img className="sv2-inspector-thumb" src={thumbnailUrl} alt="컷 미리보기" />
        ) : (
          <div className="sv2-inspector-thumb" />
        )}
        <div>
          <div className="sv2-inspector-date">{formatShootDate(segment) || '날짜 정보 없음'}</div>
          <div className="sv2-dock-count" style={{ marginTop: 6 }}>
            {segment.sourceVideoName}
          </div>
        </div>
      </div>

      <div className="sv2-inspector-section">
        <label className="sv2-field-label" htmlFor="sv2-location-input">
          장소 이름
        </label>
        <input
          id="sv2-location-input"
          className="sv2-input"
          value={draft}
          placeholder="예: 디즈니랜드"
          onChange={(e) => commit(e.target.value)}
        />
        <label className="sv2-checkbox-row">
          <input
            type="checkbox"
            checked={applyToVideo}
            onChange={(e) => setApplyToVideo(e.target.checked)}
          />
          같은 원본 영상에서 뽑힌 컷에 모두 적용
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="sv2-btn sv2-btn-sm"
            onClick={() => commit(draft.trim())}
          >
            <RotateCcw size={13} /> 미리보기 갱신
          </button>
          <button
            type="button"
            className="sv2-btn sv2-btn-sm"
            onClick={() => commit('')}
          >
            <Trash2 size={13} /> 위치 지우기
          </button>
        </div>
      </div>

      <div className="sv2-field-label" style={{ padding: '12px 18px 6px' }}>
        참고 지도
      </div>
      <div className="sv2-map-wrap">
        <MapComponent
          latitude={segment.latitude}
          longitude={segment.longitude}
          label={draft || segment.locationName}
        />
      </div>
    </div>
  );
};
