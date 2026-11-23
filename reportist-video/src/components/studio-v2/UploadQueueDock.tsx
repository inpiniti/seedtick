import { Sparkles, UploadCloud, X } from 'lucide-react';
import type { VideoItem } from '../../types/video.ts';
import { formatShootDate } from './types.ts';

// components/studio-v2/UploadQueueDock.tsx
// 분석 전/중 좌측 원본 리스트. 썸네일 + 촬영일만 최소 표시하고,
// 분석이 끝나면 카드가 빠지고 전체 도크가 부드럽게 사라진다.

interface UploadQueueDockProps {
  videos: VideoItem[];
  isProcessing: boolean;
  isPreparingVideos?: boolean;
  collapsed: boolean;
  landedVideos?: Set<string>;
  onFilesSelected: (files: File[]) => void;
  onRemoveVideo: (id: string) => void;
  onStartAnalysis: () => void;
  onCancel: () => void;
}

export const UploadQueueDock = ({
  videos,
  isProcessing,
  isPreparingVideos,
  collapsed,
  landedVideos,
  onFilesSelected,
  onRemoveVideo,
  onStartAnalysis,
  onCancel,
}: UploadQueueDockProps) => {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('video/'));
    if (files.length) onFilesSelected(files);
  };

  const hasPending = videos.some((v) => (v.segments?.length ?? 0) === 0);

  return (
    <div className="sv2-dock" data-collapsed={collapsed} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
      <div className="sv2-dock-inner">
        <div className="sv2-dock-head">
          <span className="sv2-dock-title">원본 영상</span>
          <span className="sv2-dock-count">{videos.length}개</span>
        </div>

        <div className="sv2-dock-list">
          {videos.length === 0 && (
            <div className="sv2-dock-empty">
              <UploadCloud size={30} />
              <span>영상을 끌어다 놓거나<br />상단의 [영상 추가]를 눌러주세요</span>
            </div>
          )}

          {videos.map((video) => {
            const segment = video.segments?.[0];
            const done = (video.segments?.length ?? 0) > 0;
            const shootDate = formatShootDate(segment) || video.metadataDate || '';
            return (
              <div
                key={video.id}
                className="sv2-upload-card"
                data-cut-card-id={video.id}
                data-landed={landedVideos?.has(video.id) ?? false}
              >
                {video.thumbnailUrl ? (
                  <img className="sv2-upload-thumb" src={video.thumbnailUrl} alt="" />
                ) : (
                  <div className="sv2-upload-thumb" />
                )}
                <div className="sv2-upload-meta">
                  <div className="sv2-upload-name" title={video.name}>{video.name}</div>
                  <div className="sv2-upload-date">{shootDate}</div>
                  <span className="sv2-upload-badge" data-done={done}>
                    {done ? `컷 ${video.segments.length}개 완료` : isProcessing ? '분석 중…' : '대기 중'}
                  </span>
                  {!done && isProcessing && (
                    <div className="sv2-progress-bar">
                      <div className="sv2-progress-fill" style={{ width: '38%' }} />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="sv2-upload-card-remove"
                  onClick={() => onRemoveVideo(video.id)}
                  aria-label="영상 삭제"
                >
                  <X size={13} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="sv2-dock-footer">
          {isProcessing ? (
            <button type="button" className="sv2-btn" onClick={onCancel}>
              분석 중지
            </button>
          ) : (
            <button
              type="button"
              className="sv2-btn sv2-btn-primary"
              onClick={onStartAnalysis}
              disabled={videos.length === 0 || !hasPending || isPreparingVideos}
            >
              <Sparkles size={16} /> AI 컷 분석
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
