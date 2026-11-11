import React, { useRef } from 'react';
import { ChevronUp, ChevronDown, Trash2, Film, CheckCircle2, Link2, AlertCircle } from 'lucide-react';
import type { VideoItem } from '../../types/video.ts';
import { useI18n } from '../../i18n/index.tsx';

interface VideoCardProps {
  video: VideoItem;
  index: number;
  totalCount: number;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (id: string) => void;
  onRelink?: (id: string, file: File) => void;
  disabled?: boolean;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  index,
  totalCount,
  onMoveUp,
  onMoveDown,
  onRemove,
  onRelink,
  disabled = false,
}) => {
  const { dict, interpolate } = useI18n();
  const relinkInputRef = useRef<HTMLInputElement>(null);
  // 시간 포맷 (mm:ss)
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // 파일 크기 포맷 (MB)
  const formatSize = (bytes: number) => {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="video-card">
      {/* 썸네일 및 재생 시간 */}
      <div className="video-thumb-container">
        {video.thumbnailUrl ? (
          <img src={video.thumbnailUrl} alt={video.name} className="video-thumb-img" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500">
            <Film className="w-6 h-6" />
          </div>
        )}
        <div className="video-thumb-duration">{formatDuration(video.duration)}</div>
      </div>

      {/* 비디오 정보 */}
      <div className="video-info">
        <div className="video-name" title={video.name}>
          <span className="text-slate-400 font-mono text-xs mr-1.5">#{index + 1}</span>
          {video.name}
        </div>
        <div className="video-meta-tags">
          <span className="video-meta-pill">{formatSize(video.sizeBytes)}</span>
          {video.width > 0 && video.height > 0 && (
            <span className="video-meta-pill">
              {video.width}×{video.height}
            </span>
          )}
          {video.segments.length > 0 && (
            <span
              className="video-meta-pill"
              style={{
                color: '#059669',
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                fontWeight: 600,
              }}
            >
              <CheckCircle2 size={12} />
              {interpolate(dict.upload?.cardClipsCount || '극적 구간 {count}개', { count: video.segments.length })}
            </span>
          )}
          {video.isMissingFile && (
            <span className="toss-relink-badge">
              <AlertCircle size={12} style={{ color: '#d97706' }} />
              {dict.upload?.cardRelinkNeeded || '원본 연결 필요'}
            </span>
          )}
        </div>
      </div>

      {/* 조작 버튼: 위/아래 순서 변경 및 삭제 */}
      <div className="video-card-actions">
        {video.isMissingFile && onRelink && (
          <>
            <button
              type="button"
              className="toss-btn-relink-card"
              title={dict.upload?.cardRelinkTitle || '로컬 영상 파일 다시 연결하기'}
              onClick={() => relinkInputRef.current?.click()}
            >
              <Link2 size={13} />
              <span>{dict.upload?.cardRelinkBtn || '연결'}</span>
            </button>
            <input
              ref={relinkInputRef}
              type="file"
              accept="video/*,image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  onRelink(video.id, e.target.files[0]);
                  e.target.value = '';
                }
              }}
            />
          </>
        )}
        <button
          type="button"
          className="action-icon-btn"
          title={dict.upload?.moveUp || '앞 순서로 이동'}
          disabled={disabled || index === 0}
          onClick={() => onMoveUp(index)}
        >
          <ChevronUp className="w-4 h-4" />
        </button>

        <button
          type="button"
          className="action-icon-btn"
          title={dict.upload?.moveDown || '다음 순서로 이동'}
          disabled={disabled || index === totalCount - 1}
          onClick={() => onMoveDown(index)}
        >
          <ChevronDown className="w-4 h-4" />
        </button>

        <button
          type="button"
          className="action-icon-btn danger"
          title={dict.upload?.removeFromList || '목록에서 제거'}
          disabled={disabled}
          onClick={() => onRemove(video.id)}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
