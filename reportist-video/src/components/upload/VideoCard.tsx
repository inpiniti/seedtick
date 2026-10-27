// components/upload/VideoCard.tsx - 업로드된 개별 영상 카드 컴포넌트

import React from 'react';
import { ChevronUp, ChevronDown, Trash2, Film, CheckCircle2 } from 'lucide-react';
import type { VideoItem } from '../../types/video.ts';

interface VideoCardProps {
  video: VideoItem;
  index: number;
  totalCount: number;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  index,
  totalCount,
  onMoveUp,
  onMoveDown,
  onRemove,
  disabled = false,
}) => {
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
            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <CheckCircle2 className="w-3 h-3" />
              극적 구간 {video.segments.length}개
            </span>
          )}
        </div>
      </div>

      {/* 조작 버튼: 위/아래 순서 변경 및 삭제 */}
      <div className="video-card-actions">
        <button
          type="button"
          className="action-icon-btn"
          title="앞 순서로 이동"
          disabled={disabled || index === 0}
          onClick={() => onMoveUp(index)}
        >
          <ChevronUp className="w-4 h-4" />
        </button>

        <button
          type="button"
          className="action-icon-btn"
          title="다음 순서로 이동"
          disabled={disabled || index === totalCount - 1}
          onClick={() => onMoveDown(index)}
        >
          <ChevronDown className="w-4 h-4" />
        </button>

        <button
          type="button"
          className="action-icon-btn danger"
          title="목록에서 제거"
          disabled={disabled}
          onClick={() => onRemove(video.id)}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
