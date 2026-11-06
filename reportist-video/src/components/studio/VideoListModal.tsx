import React, { useEffect } from 'react';
import { Film, Upload, Trash2, X, Plus, Clock, FileVideo, Calendar, MapPin } from 'lucide-react';
import type { VideoItem } from '../../types/video.ts';
import { useI18n } from '../../i18n/index.tsx';

interface VideoListModalProps {
  isOpen: boolean;
  onClose: () => void;
  videos: VideoItem[];
  onRemoveVideo: (id: string) => void;
  onAddFilesClick: () => void;
}

export const VideoListModal: React.FC<VideoListModalProps> = ({
  isOpen,
  onClose,
  videos,
  onRemoveVideo,
  onAddFilesClick,
}) => {
  const { dict, interpolate } = useI18n();

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalDuration = videos.reduce((acc, v) => acc + (v.duration || 0), 0);
  const totalSizeBytes = videos.reduce((acc, v) => acc + (v.sizeBytes || 0), 0);

  return (
    <div className="toss-modal-overlay" onClick={onClose}>
      <div
        className="toss-modal-card toss-video-list-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="toss-video-modal-header">
          <div className="flex items-center gap-2">
            <div className="toss-video-modal-icon-badge">
              <Film size={18} className="text-blue-600" />
            </div>
            <div>
              <h3 className="toss-video-modal-title">
                {interpolate(dict.videoListModal.title, { count: videos.length })}
              </h3>
              <p className="toss-video-modal-desc">
                {dict.videoListModal.desc}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="toss-btn-icon"
            onClick={onClose}
            title={dict.common.close}
          >
            <X size={18} />
          </button>
        </div>

        {/* Top Summary */}
        {videos.length > 0 && (
          <div className="toss-video-modal-summary">
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="flex items-center gap-1">
                <Clock size={13} className="text-slate-400" />
                {dict.videoListModal.totalDurationLabel} <strong>{totalDuration.toFixed(1)}{dict.common.timeSec}</strong>
              </span>
              <span>•</span>
              <span>
                {dict.videoListModal.totalSizeLabel} <strong>{(totalSizeBytes / (1024 * 1024)).toFixed(1)} {dict.common.fileSizeMb}</strong>
              </span>
            </div>
            <button
              type="button"
              className="toss-btn-secondary toss-btn-xs"
              onClick={onAddFilesClick}
            >
              <Plus size={13} />
              <span>{dict.videoListModal.addMoreVideos}</span>
            </button>
          </div>
        )}

        {/* Video List */}
        <div className="toss-video-modal-body">
          {videos.length === 0 ? (
            <div className="toss-video-modal-empty" onClick={onAddFilesClick}>
              <div className="toss-empty-circle-icon">
                <Upload size={24} className="text-blue-500" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 mb-1">
                {dict.videoListModal.emptyTitle}
              </h4>
              <p className="text-xs text-slate-400 mb-4">
                {dict.videoListModal.emptyDesc}
              </p>
              <button type="button" className="toss-btn-primary toss-btn-sm">
                <Plus size={14} />
                <span>{dict.videoListModal.selectFiles}</span>
              </button>
            </div>
          ) : (
            <div className="toss-video-modal-list">
              {videos.map((vid, idx) => (
                <div key={vid.id} className="toss-video-modal-item">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {vid.thumbnailUrl ? (
                      <img
                        src={vid.thumbnailUrl}
                        alt=""
                        className="toss-video-modal-thumb"
                      />
                    ) : (
                      <div className="toss-video-modal-thumb-fallback">
                        <FileVideo size={20} className="text-slate-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="toss-video-modal-badge shrink-0">#{idx + 1}</span>
                        <span
                          className="text-xs font-bold text-slate-800 truncate block flex-1"
                          title={vid.name}
                        >
                          {vid.name}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-x-2 gap-y-1 flex-wrap">
                        <span className="shrink-0">{vid.duration.toFixed(1)}{dict.common.timeSec}</span>
                        <span className="text-slate-300 shrink-0">•</span>
                        <span className="shrink-0">
                          {vid.width > 0 && vid.height > 0
                            ? `${vid.width}×${vid.height}`
                            : dict.videoListModal.analyzingResolution}
                        </span>
                        <span className="text-slate-300 shrink-0">•</span>
                        <span className="shrink-0">{((vid.sizeBytes || 0) / (1024 * 1024)).toFixed(1)}{dict.common.fileSizeMb}</span>
                        {vid.metadataDate && (
                          <span className="inline-flex items-center gap-1 text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-sans text-[10px] font-medium shrink-0 whitespace-nowrap">
                            <Calendar size={11} className="shrink-0" />
                            <span>{vid.metadataDate}</span>
                          </span>
                        )}
                        {vid.locationName && (
                          <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-sans text-[10px] font-medium shrink-0 whitespace-nowrap">
                            <MapPin size={11} className="shrink-0" />
                            <span>{vid.locationName}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="toss-btn-delete-sm shrink-0"
                    onClick={() => onRemoveVideo(vid.id)}
                    title={dict.videoListModal.deleteVideo}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="toss-video-modal-footer">
          {videos.length > 0 && (
            <button
              type="button"
              className="toss-btn-secondary"
              onClick={onAddFilesClick}
            >
              <Plus size={14} />
              <span>{dict.videoListModal.addMoreVideos}</span>
            </button>
          )}
          <button
            type="button"
            className="toss-btn-primary ml-auto"
            onClick={onClose}
          >
            {dict.common.close}
          </button>
        </div>
      </div>
    </div>
  );
};
