// components/studio/VideoListModal.tsx - 올린 원본 영상 목록 확인 및 추가/삭제 모달

import React, { useEffect } from 'react';
import { Film, Upload, Trash2, X, Plus, Clock, FileVideo } from 'lucide-react';
import type { VideoItem } from '../../types/video.ts';

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
  // ESC 키 닫기
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
        {/* 모달 헤더 */}
        <div className="toss-video-modal-header">
          <div className="flex items-center gap-2">
            <div className="toss-video-modal-icon-badge">
              <Film size={18} className="text-blue-600" />
            </div>
            <div>
              <h3 className="toss-video-modal-title">올린 원본 영상 ({videos.length}개)</h3>
              <p className="toss-video-modal-desc">
                AI가 분석할 동영상을 확인하고 추가하거나 제외할 수 있어요.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="toss-btn-icon"
            onClick={onClose}
            title="닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* 상단 요약 정보 */}
        {videos.length > 0 && (
          <div className="toss-video-modal-summary">
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="flex items-center gap-1">
                <Clock size={13} className="text-slate-400" />
                총 <strong>{totalDuration.toFixed(1)}초</strong>
              </span>
              <span>•</span>
              <span>
                총 <strong>{(totalSizeBytes / (1024 * 1024)).toFixed(1)} MB</strong>
              </span>
            </div>
            <button
              type="button"
              className="toss-btn-secondary toss-btn-xs"
              onClick={onAddFilesClick}
            >
              <Plus size={13} />
              <span>영상 추가하기</span>
            </button>
          </div>
        )}

        {/* 비디오 목록 영역 */}
        <div className="toss-video-modal-body">
          {videos.length === 0 ? (
            <div className="toss-video-modal-empty" onClick={onAddFilesClick}>
              <div className="toss-empty-circle-icon">
                <Upload size={24} className="text-blue-500" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 mb-1">
                올린 동영상이 아직 없어요
              </h4>
              <p className="text-xs text-slate-400 mb-4">
                여기를 누르거나 창 안으로 영상을 끌어다 놓아주세요.
              </p>
              <button type="button" className="toss-btn-primary toss-btn-sm">
                <Plus size={14} />
                <span>동영상 파일 선택하기</span>
              </button>
            </div>
          ) : (
            <div className="toss-video-modal-list">
              {videos.map((vid, idx) => (
                <div key={vid.id} className="toss-video-modal-item">
                  <div className="flex items-center gap-3 min-w-0">
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
                      <div className="flex items-center gap-1.5">
                        <span className="toss-video-modal-badge">#{idx + 1}</span>
                        <span
                          className="text-xs font-bold text-slate-800 truncate block"
                          title={vid.name}
                        >
                          {vid.name}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-2">
                        <span>{vid.duration.toFixed(1)}초</span>
                        <span>•</span>
                        <span>
                          {vid.width > 0 && vid.height > 0
                            ? `${vid.width}×${vid.height}`
                            : '해상도 분석 중'}
                        </span>
                        <span>•</span>
                        <span>{((vid.sizeBytes || 0) / (1024 * 1024)).toFixed(1)}MB</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="toss-btn-delete-sm ml-3 shrink-0"
                    onClick={() => onRemoveVideo(vid.id)}
                    title="이 영상 삭제"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 모달 푸터 */}
        <div className="toss-video-modal-footer">
          {videos.length > 0 && (
            <button
              type="button"
              className="toss-btn-secondary"
              onClick={onAddFilesClick}
            >
              <Plus size={14} />
              <span>동영상 더 추가하기</span>
            </button>
          )}
          <button
            type="button"
            className="toss-btn-primary ml-auto"
            onClick={onClose}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};
