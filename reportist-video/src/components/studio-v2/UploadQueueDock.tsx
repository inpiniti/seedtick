import { Scissors, UploadCloud, X } from 'lucide-react';
import type { VideoItem, VideoTaskProgress } from '../../types/video.ts';
import { useI18n } from '../../i18n/index.tsx';
import { formatShootDate } from './types.ts';

// components/studio-v2/UploadQueueDock.tsx
// 분석 전/중 좌측 원본 리스트. 썸네일 + 촬영일만 최소 표시하고,
// 분석이 끝나면 카드가 빠지고 전체 도크가 부드럽게 사라진다.
// 분석 중에는 progress.videoTasks(영상별 독립 슬롯)를 읽어 카드마다
// 다른 단계/진행률을 보여준다.

interface UploadQueueDockProps {
  videos: VideoItem[];
  isProcessing: boolean;
  isPreparingVideos?: boolean;
  collapsed: boolean;
  landedVideos?: Set<string>;
  videoTasks?: VideoTaskProgress[];
  onFilesSelected: (files: File[]) => void;
  onRemoveVideo: (id: string) => void;
  onStartAnalysis: () => void;
  onCancel: () => void;
}

type UiFn = (source: string, params?: Record<string, string | number>) => string;

function taskBadge(task: VideoTaskProgress | undefined, hasSegments: boolean, ui: UiFn) {
  if (!task) {
    if (hasSegments) return { label: ui('컷 완료'), done: true, active: false, pct: 100, queued: false };
    return { label: ui('대기 중'), done: false, active: false, pct: 0, queued: false };
  }
  const pct = Math.max(0, Math.min(100, Math.floor(task.progressPercent)));
  switch (task.stage) {
    case 'extracting':
      return {
        label: ui('프레임 추출 {pct}%', { pct }),
        done: false,
        active: true,
        pct,
        queued: false,
      };
    case 'queued': {
      const pos = Math.max(0, task.queuePosition ?? 0);
      return {
        label: ui('대기열 {pos}번', { pos }),
        done: false,
        active: true,
        pct,
        queued: true,
      };
    }
    case 'analyzing':
      return {
        label: ui('AI 분석 중 {pct}%', { pct }),
        done: false,
        active: true,
        pct,
        queued: false,
      };
    case 'done':
    case 'reused':
      return { label: ui('컷 완료'), done: true, active: false, pct: 100, queued: false };
    default:
      return { label: ui('대기 중'), done: false, active: false, pct: 0, queued: false };
  }
}

export const UploadQueueDock = ({
  videos,
  isProcessing,
  isPreparingVideos,
  collapsed,
  landedVideos,
  videoTasks,
  onFilesSelected,
  onRemoveVideo,
  onStartAnalysis,
  onCancel,
}: UploadQueueDockProps) => {
  const { ui } = useI18n();
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('video/'));
    if (files.length) onFilesSelected(files);
  };

  const hasPending = videos.some((v) => (v.segments?.length ?? 0) === 0);
  const taskByVideoId = buildTaskMap(videoTasks);
  const doneCount = videoTasks
    ? videoTasks.filter((t) => t.stage === 'done' || t.stage === 'reused').length
    : videos.filter((v) => (v.segments?.length ?? 0) > 0).length;

  return (
    <div className="sv2-dock" data-collapsed={collapsed} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
      <div className="sv2-dock-inner">
        <div className="sv2-dock-head">
          <span className="sv2-dock-title">{ui('원본 영상')}</span>
          <span className="sv2-dock-count">
            {isProcessing && videoTasks
              ? ui('완료 {done}/{total}', { done: doneCount, total: videos.length })
              : ui('{count}개', { count: videos.length })}
          </span>
        </div>

        <div className="sv2-dock-list">
          {videos.length === 0 && (
            <div className="sv2-dock-empty">
              <UploadCloud size={30} />
              <span>
                {ui('영상을 끌어다 놓거나')}
                <br />
                {ui('상단의 [영상 추가]를 눌러주세요')}
              </span>
            </div>
          )}

          {videos.map((video) => {
            const segment = video.segments?.[0];
            const segmentCount = video.segments?.length ?? 0;
            const task = taskByVideoId.get(video.id);
            const badge = taskBadge(task, segmentCount > 0, ui);
            const done = segmentCount > 0 || badge.done;
            const label = done && segmentCount > 0 && (task?.stage === 'done' || task?.stage === 'reused' || !task)
              ? ui('컷 {count}개 완료', { count: segmentCount })
              : badge.label;
            const shootDate = formatShootDate(segment) || video.metadataDate || '';
            return (
              <div
                key={video.id}
                className="sv2-upload-card"
                data-cut-card-id={video.id}
                data-active={badge.active}
                data-done={done}
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
                  <span className="sv2-upload-badge" data-done={done} data-queued={badge.queued}>
                    {label}
                  </span>
                  {isProcessing && !done && (
                    <div className="sv2-progress-bar" data-queued={badge.queued}>
                      <div className="sv2-progress-fill" style={{ width: `${badge.pct}%` }} />
                    </div>
                  )}
                </div>
                {!isProcessing && (
                  <button
                    type="button"
                    className="sv2-upload-card-remove"
                    onClick={() => onRemoveVideo(video.id)}
                    aria-label={ui('영상 삭제')}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="sv2-dock-footer">
          {isProcessing ? (
            <button type="button" className="sv2-btn" onClick={onCancel}>
              {ui('분석 중지')}
            </button>
          ) : (
            <button
              type="button"
              className="sv2-btn sv2-btn-primary"
              onClick={onStartAnalysis}
              disabled={videos.length === 0 || !hasPending || isPreparingVideos}
            >
              <Scissors size={16} /> {ui('AI 컷 분석')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

function buildTaskMap(tasks?: VideoTaskProgress[]): Map<string, VideoTaskProgress> {
  const map = new Map<string, VideoTaskProgress>();
  if (!tasks) return map;
  for (const task of tasks) map.set(task.videoId, task);
  return map;
}
