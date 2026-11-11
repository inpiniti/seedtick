import React, { useEffect, useRef } from 'react';
import { Film, Upload, Trash2, X, Plus, Clock, FileVideo, Calendar, MapPin, Link2, AlertTriangle } from 'lucide-react';
import type { VideoItem } from '../../types/video.ts';
import { useI18n } from '../../i18n/index.tsx';
import { useModalScrollLock } from '../../hooks/useModalScrollLock.ts';

interface VideoListModalProps {
  isOpen: boolean;
  onClose: () => void;
  videos: VideoItem[];
  onRemoveVideo: (id: string) => void;
  onAddFilesClick: () => void;
  onFilesSelected?: (files: File[]) => void;
  onRelinkVideo?: (id: string, file: File) => void;
  onRelinkBatch?: (files: File[]) => void;
}

export const VideoListModal: React.FC<VideoListModalProps> = ({
  isOpen,
  onClose,
  videos,
  onRemoveVideo,
  onAddFilesClick,
  onFilesSelected,
  onRelinkVideo,
  onRelinkBatch,
}) => {
  const { dict, interpolate } = useI18n();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Lock background scroll and completely block touch/drag leakages behind popup
  useModalScrollLock(isOpen, {
    overlayRef,
    scrollableSelector: '.video-list-modal-body, [data-modal-scrollable="true"]',
  });

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleDragPrevent = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onFilesSelected) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  if (!isOpen) return null;

  const totalDuration = videos.reduce((acc, v) => acc + (v.duration || 0), 0);
  const totalSizeBytes = videos.reduce((acc, v) => acc + (v.sizeBytes || 0), 0);

  return (
    <div
      ref={overlayRef}
      className="model-modal-backdrop"
      onClick={onClose}
      onDragOver={handleDragPrevent}
      onDragEnter={handleDragPrevent}
      onDragLeave={handleDragPrevent}
      onDrop={handleDrop}
    >
      <div
        className="model-modal-card video-list-modal-card"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onDragOver={handleDragPrevent}
        onDragEnter={handleDragPrevent}
        onDrop={handleDrop}
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-list-modal-title"
      >
        {/* Modal Header */}
        <div className="model-modal-header">
          <div className="model-modal-title-row">
            <div className="model-modal-icon-badge">
              <Film size={22} color="#0f172a" />
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

        {/* 누락 파일 일괄 재연결 알림 배너 */}
        {videos.some((v) => !v.url || (v.file && v.file.size === 0) || v.error || v.isMissingFile) && (
          <div className="toss-relink-modal-banner" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
            <div className="toss-relink-modal-title">
              <span style={{ fontSize: '14px' }}>💡</span>
              <span style={{ color: '#475569', fontSize: '12px' }}>
                {videos.every((v) => v.segments && v.segments.length > 0)
                  ? (dict.videoListModal.relinkBannerSafe || '기기 메모리 보호를 위해 원본은 분리되었지만 클립 편집점은 안전하게 보존되어 있어요')
                  : interpolate(dict.videoListModal.relinkBannerNeed || '원본 영상 {count}개 재연결 필요', {
                      count: videos.filter((v) => !v.url || (v.file && v.file.size === 0) || v.error || v.isMissingFile).length,
                    })}
              </span>
            </div>
            {onRelinkBatch && (
              <label className="toss-relink-btn-batch" style={{ padding: '5px 10px', fontSize: '11.5px', borderRadius: '8px' }}>
                <Link2 size={13} />
                <span>{dict.videoListModal.relinkBatchBtn || '일괄 재연결'}</span>
                <input
                  type="file"
                  multiple
                  accept="video/*,image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      onRelinkBatch(Array.from(e.target.files));
                      e.target.value = '';
                    }
                  }}
                />
              </label>
            )}
          </div>
        )}

        {/* Video List Body */}
        <div
          className="video-list-modal-body"
          data-modal-scrollable="true"
          onTouchMove={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
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
                        {(!vid.url || (vid.file && vid.file.size === 0) || vid.error || vid.isMissingFile) && (
                          vid.segments && vid.segments.length > 0 ? (
                            <span className="toss-video-modal-meta-badge" style={{ background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }}>
                              <span>{interpolate(dict.videoListModal.clipsPreserved || '✓ 클립 보관됨 ({count}개)', { count: vid.segments.length })}</span>
                            </span>
                          ) : (
                            <span className="toss-video-modal-meta-badge" style={{ background: '#fef2f2', color: '#ef4444', borderColor: '#fca5a5' }}>
                              <span>{dict.videoListModal.reselectFile || '⚠️ 파일 재선택 필요'}</span>
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {(!vid.url || (vid.file && vid.file.size === 0) || vid.error || vid.isMissingFile) && onRelinkVideo && (
                      <label className="toss-btn-relink-inline">
                        <Link2 size={12} />
                        <span>{dict.videoListModal.relinkBtn || '연결'}</span>
                        <input
                          type="file"
                          accept="video/*,image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              onRelinkVideo(vid.id, e.target.files[0]);
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      className="toss-btn-delete-sm"
                      onClick={() => onRemoveVideo(vid.id)}
                      title={dict.videoListModal.deleteVideo}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
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
