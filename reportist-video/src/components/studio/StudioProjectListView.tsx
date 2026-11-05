import React, { useState } from 'react';
import {
  FolderOpen,
  Plus,
  Play,
  Copy,
  Trash2,
  Clock,
  Film,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  HardDrive,
  Calendar,
} from 'lucide-react';
import type { StudioProjectSummary } from '../../types/project.ts';
import { useI18n } from '../../i18n/index.tsx';

interface StudioProjectListViewProps {
  projects: StudioProjectSummary[];
  currentProjectId: string | null;
  isLoading: boolean;
  onOpenProject: (id: string) => void;
  onDuplicateProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onStartNewProject: () => void;
}

export const StudioProjectListView: React.FC<StudioProjectListViewProps> = ({
  projects,
  currentProjectId,
  isLoading,
  onOpenProject,
  onDuplicateProject,
  onDeleteProject,
  onStartNewProject,
}) => {
  const { dict, interpolate } = useI18n();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // 시간 포맷팅 헬퍼 (초 -> mm:ss)
  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // 상대 시간 계산 (방금 전, N분 전, N시간 전, 날짜)
  const formatRelativeTime = (timestamp: number) => {
    if (!timestamp) return '';
    const now = Date.now();
    const diff = Math.max(0, now - timestamp);
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;

    const d = new Date(timestamp);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  const pDict = dict.projects || {
    tabTitle: '보관함',
    pageTitle: '내 작업 보관함',
    pageDesc: '기기(IndexedDB)에 안전하게 저장된 스튜디오 작업물이에요. 새로고침해도 사라지지 않아요.',
    newProjectBtn: '새 작업 시작',
    emptyTitle: '아직 저장된 작업이 없어요',
    emptyDesc: '스튜디오에서 영상을 올리면 자동으로 안전하게 보관돼요.',
    startStudioBtn: '새 영상 만들러 가기',
    autoSaved: '저장됨',
    saving: '저장 중...',
    saveManualBtn: '저장',
    openBtn: '이어서 작업하기',
    duplicateBtn: '복제',
    deleteBtn: '삭제',
    currentBadge: '현재 작업 중',
    completedBadge: '하이라이트 완성',
    editingBadge: '편집 중',
    clipsCount: '{count}개 영상',
    deleteModalTitle: '작업물을 삭제할까요?',
    deleteModalDesc: '보관함에서 삭제된 작업물은 다시 복구할 수 없어요.',
    confirmDelete: '삭제하기',
    cancelDelete: '닫기',
    loadedToast: '작업물을 불러왔어요.',
    savedToast: '작업물이 저장되었어요.',
    newProjectConfirmTitle: '새 작업을 시작할까요?',
    newProjectConfirmDesc: '현재 진행 중인 작업은 보관함에 안전하게 보관돼요.',
    startNew: '시작하기',
  };

  const targetProjectToDelete = projects.find((p) => p.id === deleteTargetId);

  return (
    <div className="toss-projects-view-container">
      {/* 1. 상단 타이틀 & CTA 헤더 */}
      <div className="toss-projects-header">
        <div className="toss-projects-title-col">
          <div className="flex items-center gap-2">
            <h1 className="toss-projects-title">{pDict.pageTitle}</h1>
            <span className="toss-projects-count-pill">{projects.length}</span>
          </div>
          <p className="toss-projects-desc">{pDict.pageDesc}</p>
        </div>

        <div className="toss-projects-header-actions">
          <div className="toss-projects-storage-pill" title="브라우저 로컬 IndexedDB에 안전 저장">
            <HardDrive size={13} className="text-blue-600" />
            <span>기기 내 저장 (100% 로컬)</span>
          </div>
          <button
            type="button"
            className="toss-btn-primary toss-projects-new-btn"
            onClick={onStartNewProject}
          >
            <Plus size={16} />
            <span>{pDict.newProjectBtn}</span>
          </button>
        </div>
      </div>

      {/* 2. 메인 컨텐츠 영역 */}
      {isLoading ? (
        <div className="toss-projects-loading-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="toss-project-skeleton-card">
              <div className="toss-project-skeleton-thumb" />
              <div className="toss-project-skeleton-body">
                <div className="toss-project-skeleton-line short" />
                <div className="toss-project-skeleton-line" />
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        /* 빈 상태 (Empty State) */
        <div className="toss-projects-empty-card">
          <div className="toss-projects-empty-icon-wrap">
            <FolderOpen size={44} className="text-blue-500" />
          </div>
          <h2 className="toss-projects-empty-title">{pDict.emptyTitle}</h2>
          <p className="toss-projects-empty-desc">{pDict.emptyDesc}</p>
          <button
            type="button"
            className="toss-btn-primary toss-projects-empty-btn"
            onClick={onStartNewProject}
          >
            <Plus size={16} />
            <span>{pDict.startStudioBtn}</span>
          </button>
        </div>
      ) : (
        /* 프로젝트 카드 그리드 */
        <div className="toss-projects-grid">
          {projects.map((proj) => {
            const isCurrent = proj.id === currentProjectId;
            return (
              <div
                key={proj.id}
                className={`toss-project-card ${isCurrent ? 'current-active' : ''}`}
                onClick={() => onOpenProject(proj.id)}
              >
                {/* 썸네일 영역 */}
                <div className="toss-project-card-thumb-wrap">
                  {proj.thumbnailUrl ? (
                    <img
                      src={proj.thumbnailUrl}
                      alt={proj.title}
                      className="toss-project-card-thumb-img"
                      loading="lazy"
                    />
                  ) : (
                    <div className="toss-project-card-thumb-placeholder">
                      <Film size={36} className="text-slate-300" />
                    </div>
                  )}

                  {/* 재생 시간 뱃지 */}
                  {proj.duration > 0 && (
                    <div className="toss-project-duration-badge">
                      <Clock size={11} />
                      <span>{formatDuration(proj.duration)}</span>
                    </div>
                  )}

                  {/* 활성/완료 상태 뱃지 */}
                  <div className="toss-project-card-badges">
                    {isCurrent && (
                      <span className="toss-project-status-pill active">
                        <Sparkles size={11} />
                        {pDict.currentBadge}
                      </span>
                    )}
                    {proj.hasResult ? (
                      <span className="toss-project-status-pill completed">
                        <CheckCircle2 size={11} />
                        {pDict.completedBadge}
                      </span>
                    ) : (
                      <span className="toss-project-status-pill editing">
                        <Film size={11} />
                        {pDict.editingBadge}
                      </span>
                    )}
                  </div>
                </div>

                {/* 카드 본문 */}
                <div className="toss-project-card-body">
                  <div className="toss-project-card-meta-top">
                    <span className="toss-project-clips-count">
                      {interpolate(pDict.clipsCount, { count: proj.videoCount })}
                    </span>
                    <span className="toss-project-time">
                      <Calendar size={11} />
                      {formatRelativeTime(proj.updatedAt)}
                    </span>
                  </div>

                  <h3 className="toss-project-card-title" title={proj.title}>
                    {proj.title}
                  </h3>

                  {/* 카드 하단 액션 버튼 그룹 */}
                  <div
                    className="toss-project-card-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="toss-btn-primary toss-btn-sm toss-project-open-btn"
                      onClick={() => onOpenProject(proj.id)}
                    >
                      <Play size={13} fill="currentColor" />
                      <span>{pDict.openBtn}</span>
                    </button>

                    <button
                      type="button"
                      className="toss-btn-icon-subtle"
                      onClick={() => onDuplicateProject(proj.id)}
                      title={pDict.duplicateBtn}
                    >
                      <Copy size={15} />
                    </button>

                    <button
                      type="button"
                      className="toss-btn-icon-subtle danger"
                      onClick={() => setDeleteTargetId(proj.id)}
                      title={pDict.deleteBtn}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. 삭제 확인 다이얼로그 (토스 스타일) */}
      {deleteTargetId && (
        <div
          className="toss-modal-overlay"
          onClick={() => setDeleteTargetId(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="toss-modal-card toss-confirm-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="toss-confirm-icon-wrap danger">
              <AlertTriangle size={24} className="text-red-500" />
            </div>

            <h3 className="toss-confirm-title">{pDict.deleteModalTitle}</h3>
            <p className="toss-confirm-desc">
              {targetProjectToDelete?.title && (
                <strong className="block text-slate-800 mb-1">
                  "{targetProjectToDelete.title}"
                </strong>
              )}
              {pDict.deleteModalDesc}
            </p>

            <div className="toss-confirm-actions">
              <button
                type="button"
                className="toss-btn-secondary"
                onClick={() => setDeleteTargetId(null)}
              >
                {pDict.cancelDelete}
              </button>
              <button
                type="button"
                className="toss-btn-danger"
                onClick={() => {
                  if (deleteTargetId) {
                    onDeleteProject(deleteTargetId);
                    setDeleteTargetId(null);
                  }
                }}
              >
                {pDict.confirmDelete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};