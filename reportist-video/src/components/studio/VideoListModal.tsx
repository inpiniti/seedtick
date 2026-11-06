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
    <div className="model-modal-backdrop" onClick={onClose}>
      <div
        className="model-modal-card video-list-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-list-modal-title"
      >
        {/* Modal Header */}
        <div className="model-modal-header">
          <div className="model-modal-title-row">
            <div className="model-modal-icon-badge">
              <Film size={22} color="#3182f6" />
            </div>
            <div className="model-modal-titles">
              <h2 id="video-list-modal-title" className="model-modal-title">
                {interpolate(dict.videoListModal.title, { count: videos.length })}
              </h2>
              <p className="model-modal-subtitle">
                {dict.videoListModal.desc}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="model-modal-close-btn"
            onClick={onClose}
            aria-label={dict.common.close}
          >
            <X size={18} />
          </button>
        </div>

        {/* Top Summary Bar */}
        {videos.length > 0 && (
          <div className="video-list-summary-bar">
            <div className="toss-video-modal-summary-stats">
              <span className="toss-video-modal-summary-item">
                <Clock size={13} className="text-slate-400 shrink-0" />
                <span>{dict.videoListModal.totalDurationLabel}</span>
                <strong>{totalDuration.toFixed(1)}{dict.common.timeSec}</strong>
              </span>
              <span className="toss-video-modal-summary-dot">•</span>
              <span className="toss-video-modal-summary-item">
                <span>{dict.videoListModal.totalSizeLabel}</span>
                <strong>{(totalSizeBytes / (1024 * 1024)).toFixed(1)} {dict.common.fileSizeMb}</strong>
              </span>
            </div>
            <button
              type="button"
              className="toss-btn-secondary toss-btn-xs toss-video-modal-summary-btn"
              onClick={onAddFilesClick}
            >
              <Plus size={13} className="shrink-0" />
              <span>{dict.videoListModal.addMoreVideos}</span>
            </button>
          </div>
        )}

        {/* Video List Body */}
        <div className="video-list-modal-body">
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
                  <div className="toss-video-modal-content">
                    {vid.thumbnailUrl ? (
                      <img
                        src={vid.thumbnailUrl}
                        alt=""
                        className="toss-video-modal-thumb"
                      />
                    ) : (
                      <div className="toss-video-modal-thumb-fallback">
                        <FileVideo size={18} className="text-slate-400" />
                      </div>
                    )}
                    <div className="toss-video-modal-info">
                      <div className="toss-video-modal-name-row">
                        <span className="toss-video-modal-badge">#{idx + 1}</span>
                        <span
                          className="toss-video-modal-name"
                          title={vid.name}
                        >
                          {vid.name}
                        </span>
                      </div>
                      <div className="toss-video-modal-meta">
                        <span>{vid.duration.toFixed(1)}{dict.common.timeSec}</span>
                        <span className="toss-video-modal-meta-dot">•</span>
                        <span>
                          {vid.width > 0 && vid.height > 0
                            ? `${vid.width}×${vid.height}`
                            : dict.videoListModal.analyzingResolution}
                        </span>
                        <span className="toss-video-modal-meta-dot">•</span>
                        <span>{((vid.sizeBytes || 0) / (1024 * 1024)).toFixed(1)}{dict.common.fileSizeMb}</span>
                        {vid.metadataDate && (
                          <span className="toss-video-modal-meta-badge date">
                            <Calendar size={10} className="shrink-0" />
                            <span>{vid.metadataDate}</span>
                          </span>
                        )}
                        {vid.locationName && (
                          <span className="toss-video-modal-meta-badge location">
                            <MapPin size={10} className="shrink-0" />
                            <span>{vid.locationName}</span>
                          </span>
                        )}
                        {(!vid.url || (vid.file && vid.file.size === 0) || vid.error) && (
                          <span className="toss-video-modal-meta-badge" style={{ background: '#fef2f2', color: '#ef4444', borderColor: '#fca5a5' }}>
                            <span>⚠️ 파일 재선택 필요</span>
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
        <div className="model-modal-footer video-list-modal-footer">
          {videos.length > 0 && (
            <button
              type="button"
              className="toss-modal-btn-close video-list-footer-add-btn"
              onClick={onAddFilesClick}
            >
              <Plus size={14} className="shrink-0" />
              <span>{dict.videoListModal.addMoreVideos}</span>
            </button>
          )}
          <button
            type="button"
            className="toss-modal-btn-close video-list-footer-close-btn"
            style={videos.length === 0 ? { width: '100%' } : {}}
            onClick={onClose}
          >
            {dict.common.close}
          </button>
        </div>
      </div>
    </div>
  );
};
