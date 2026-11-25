import { useEffect, useState } from 'react';
import { MapPin, RotateCcw, RotateCw, Scissors, Trash2 } from 'lucide-react';
import type { HighlightSegment } from '../../types/video.ts';
import { useI18n } from '../../i18n/index.tsx';
import { Tooltip } from '../ui/Tooltip.tsx';
import { formatShootDate } from './types.ts';

// components/studio-v2/CutInspectorPanel.tsx
// 타임라인 컷을 클릭했을 때 오른쪽 인스펙터에 표시되는 회전·삭제 패널.

interface CutInspectorPanelProps {
  segment: HighlightSegment | null;
  thumbnailUrl?: string;
  onUpdateSegment: (segmentId: string, patch: Partial<HighlightSegment>) => void;
  onDelete: (segmentId: string) => void;
  onTrim: (segment: HighlightSegment) => void;
  onOpenLocation: (segmentId: string) => void;
}

export const CutInspectorPanel = ({
  segment,
  thumbnailUrl,
  onUpdateSegment,
  onDelete,
  onTrim,
  onOpenLocation,
}: CutInspectorPanelProps) => {
  const { ui, t } = useI18n();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 다른 컷으로 바꾸면 이전 컷의 삭제 확인 상태가 남지 않게 한다.
  useEffect(() => setConfirmDelete(false), [segment?.id]);

  if (!segment) {
    return (
      <div className="sv2-map-empty">
        <Scissors size={26} />
        <strong>{ui('선택된 컷이 없어요')}</strong>
        <span>{ui('타임라인의 컷을 누르면 이곳에서 회전하거나 삭제할 수 있어요.')}</span>
      </div>
    );
  }

  const rotation = ((segment.rotation ?? 0) % 360 + 360) % 360;
  const rotate = (delta: number) =>
    onUpdateSegment(segment.id, {
      rotation: ((rotation + delta) % 360 + 360) % 360,
    });
  const isQuarterTurn = rotation === 90 || rotation === 270;

  return (
    <div className="sv2-inspector-body">
      <div className="sv2-inspector-preview">
        <div className="sv2-cut-thumb-wrap">
          {thumbnailUrl ? (
            <img
              className="sv2-cut-thumb"
              src={thumbnailUrl}
              alt={ui('컷 미리보기')}
              style={{
                transform: rotation
                  ? `rotate(${rotation}deg)${isQuarterTurn ? ' scale(0.6)' : ''}`
                  : undefined,
              }}
            />
          ) : (
            <div className="sv2-cut-thumb" />
          )}
        </div>
        <div>
          <div className="sv2-inspector-date">
            {segment.subtitleTitle || segment.reason || ui('컷')}
          </div>
          <div className="sv2-dock-count" style={{ marginTop: 6 }}>
            {formatShootDate(segment) || segment.sourceVideoName}
          </div>
        </div>
      </div>

      <div className="sv2-inspector-section">
        <div className="sv2-field-label">{t('dramaticClips.rotateLabel')}</div>
        <div className="sv2-cut-rotate-row">
          <Tooltip content={t('dramaticClips.rotateCcw')}>
            <button
              type="button"
              className="sv2-cut-rotate-btn"
              onClick={() => rotate(-90)}
              aria-label={ui('반시계 90도 회전')}
            >
              <RotateCcw size={16} />
            </button>
          </Tooltip>
          {rotation !== 0 ? (
            <Tooltip content={t('dramaticClips.rotateReset')}>
              <button
                type="button"
                className="sv2-cut-angle"
                onClick={() => onUpdateSegment(segment.id, { rotation: 0 })}
              >
                {rotation}°
              </button>
            </Tooltip>
          ) : (
            <span className="sv2-cut-angle" data-zero="true">
              0°
            </span>
          )}
          <Tooltip content={t('dramaticClips.rotateCw')}>
            <button
              type="button"
              className="sv2-cut-rotate-btn"
              onClick={() => rotate(90)}
              aria-label={ui('시계 90도 회전')}
            >
              <RotateCw size={16} />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="sv2-inspector-section">
        <div className="sv2-field-label">{ui('빠른 편집')}</div>
        <div className="sv2-cut-actions">
          <button type="button" className="sv2-cut-action-btn" onClick={() => onTrim(segment)}>
            <Scissors size={15} /> {t('dramaticClips.trimEdit')}
          </button>
          <button
            type="button"
            className="sv2-cut-action-btn"
            onClick={() => onOpenLocation(segment.id)}
          >
            <MapPin size={15} /> {ui('촬영 위치 수정')}
          </button>
        </div>
        {!confirmDelete ? (
          <button
            type="button"
            className="sv2-cut-delete-btn"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={15} /> {ui('삭제')}
          </button>
        ) : (
          <div className="sv2-cut-confirm">
            <strong>{ui('이 컷을 삭제할까요?')}</strong>
            <span>{ui('삭제하면 되돌릴 수 없어요.')}</span>
            <div className="sv2-cut-confirm-actions">
              <button
                type="button"
                className="sv2-btn sv2-btn-sm"
                onClick={() => setConfirmDelete(false)}
              >
                {ui('취소')}
              </button>
              <button
                type="button"
                className="sv2-btn sv2-btn-sm sv2-cut-confirm-delete"
                onClick={() => {
                  setConfirmDelete(false);
                  onDelete(segment.id);
                }}
              >
                <Trash2 size={13} /> {ui('삭제')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
