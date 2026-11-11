// src/components/patch/PatchNotesModal.tsx - Patch Notes Dialog Modal
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Tag,
  GitCommit,
  CheckCircle2,
  Calendar,
  Layers,
  Search,
} from 'lucide-react';
import {
  PATCH_RELEASES,
  CURRENT_APP_VERSION,
  type PatchRelease,
  type PatchCommit,
} from '../../data/patchNotes.ts';
import { getLocalizedPatchReleases } from '../../data/patchNotesLocalization.ts';
import { useModalScrollLock } from '../../hooks/useModalScrollLock.ts';
import { useI18n } from '../../i18n/index.tsx';
import { notify } from '../../services/toastService.ts';

export interface PatchNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PatchNotesModal: React.FC<PatchNotesModalProps> = ({ isOpen, onClose }) => {
  const { dict, interpolate, locale } = useI18n();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [filterType, setFilterType] = useState<'all' | 'major'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const localizedReleases = useMemo(() => getLocalizedPatchReleases(locale), [locale]);

  // 10회 클릭 시 개발자 모드 전환 기능
  const versionClickCountRef = useRef<number>(0);
  const versionClickTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (versionClickTimerRef.current) {
        window.clearTimeout(versionClickTimerRef.current);
      }
    };
  }, []);

  const handleVersionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    versionClickCountRef.current += 1;

    if (versionClickTimerRef.current) {
      window.clearTimeout(versionClickTimerRef.current);
    }

    // 3초 내에 추가 클릭이 없으면 클릭 카운트 초기화
    versionClickTimerRef.current = window.setTimeout(() => {
      versionClickCountRef.current = 0;
    }, 3000);

    if (versionClickCountRef.current >= 10) {
      versionClickCountRef.current = 0;
      if (versionClickTimerRef.current) {
        window.clearTimeout(versionClickTimerRef.current);
      }

      const isDev = localStorage.getItem('reportist_feedback_admin_mode') === 'true';
      const confirmMessage = isDev
        ? '현재 개발자 모드가 활성화되어 있습니다. 개발자 모드를 해제하시겠습니까?'
        : '개발자 모드로 전환하시겠습니까?';

      if (window.confirm(confirmMessage)) {
        const nextState = !isDev;
        localStorage.setItem('reportist_feedback_admin_mode', String(nextState));
        window.dispatchEvent(new Event('reportist_admin_mode_change'));
        window.dispatchEvent(new Event('storage'));
        notify.info(nextState ? '개발자 모드로 전환되었습니다.' : '개발자 모드가 해제되었습니다.');
      }
    }
  };
  
  // 첫 2개 버전은 기본적으로 펼침 상태
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (localizedReleases.length > 0) initial[localizedReleases[0].version] = true;
    if (localizedReleases.length > 1) initial[localizedReleases[1].version] = true;
    return initial;
  });

  useModalScrollLock(isOpen, {
    overlayRef,
    scrollableSelector: '.toss-patch-modal-body, [data-modal-scrollable="true"]',
  });

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const toggleExpand = (version: string) => {
    setExpandedVersions((prev) => ({
      ...prev,
      [version]: !prev[version],
    }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    localizedReleases.forEach((r) => {
      all[r.version] = true;
    });
    setExpandedVersions(all);
  };

  const collapseAll = () => {
    setExpandedVersions({});
  };

  const filteredReleases = useMemo(() => {
    return localizedReleases.filter((rel) => {
      if (filterType === 'major' && rel.type !== 'major') {
        return false;
      }
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const inVersion = rel.version.toLowerCase().includes(q);
      const inTitle = rel.title.toLowerCase().includes(q);
      const inSummary = rel.summary.toLowerCase().includes(q);
      const inCommits = rel.commits.some(
        (c) =>
          c.message.toLowerCase().includes(q) ||
          c.rawSubject.toLowerCase().includes(q) ||
          c.hash.toLowerCase().includes(q)
      );

      return inVersion || inTitle || inSummary || inCommits;
    });
  }, [localizedReleases, filterType, searchQuery]);

  const totalCommitsCount = useMemo(() => {
    return localizedReleases.reduce((acc, r) => acc + r.totalCommits, 0);
  }, [localizedReleases]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="model-modal-backdrop"
      onClick={onClose}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div
        className="model-modal-card toss-patch-dialog-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="patch-dialog-title"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="model-modal-header" style={{ borderBottom: '1px solid #eef2f6', paddingBottom: '16px' }}>
          <div className="model-modal-title-row">
            <div className="model-modal-icon-badge" style={{ backgroundColor: '#eff6ff', color: '#3182f6' }}>
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 className="model-modal-title" id="patch-dialog-title" style={{ margin: 0 }}>
                  {dict.patchNotes?.title || '패치 노트'}
                </h2>
                <span
                  className="toss-patch-current-version-badge"
                  onClick={handleVersionClick}
                >
                  v{CURRENT_APP_VERSION} {dict.patchNotes?.latestBadge || '최신'}
                </span>
              </div>
              <p className="model-modal-subtitle">
                {dict.patchNotes?.subtitle || 'Reportist Video의 모든 업데이트와 새로운 기능들을 모아봤어요.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="model-modal-close-btn"
            onClick={onClose}
            aria-label={dict.common?.close || '닫기'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Filter and Search Bar */}
        <div className="toss-patch-control-bar">
          <div className="toss-patch-tabs">
            <button
              type="button"
              className={`toss-patch-tab-btn ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              {dict.patchNotes?.allReleases || '전체 릴리즈'} ({localizedReleases.length})
            </button>
            <button
              type="button"
              className={`toss-patch-tab-btn ${filterType === 'major' ? 'active' : ''}`}
              onClick={() => setFilterType('major')}
            >
              {dict.patchNotes?.majorUpdates || '주요 업데이트'} ({localizedReleases.filter((r) => r.type === 'major').length})
            </button>
          </div>

          <div className="toss-patch-actions-row">
            <div className="toss-patch-search-box">
              <Search size={14} color="#94a3b8" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={dict.patchNotes?.searchPlaceholder || '기능 또는 키워드 검색...'}
                className="toss-patch-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="toss-patch-search-clear"
                  onClick={() => setSearchQuery('')}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="toss-patch-toggle-btns">
              <button
                type="button"
                className="toss-patch-text-btn"
                onClick={expandAll}
                title={dict.patchNotes?.expandAll || '모두 펼치기'}
              >
                {dict.patchNotes?.expandAll || '모두 펼치기'}
              </button>
              <span className="toss-patch-divider">|</span>
              <button
                type="button"
                className="toss-patch-text-btn"
                onClick={collapseAll}
                title={dict.patchNotes?.collapseAll || '모두 접기'}
              >
                {dict.patchNotes?.collapseAll || '모두 접기'}
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div
          className="toss-patch-modal-body"
          data-modal-scrollable="true"
          onTouchMove={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          {filteredReleases.length === 0 ? (
            <div className="toss-patch-empty-state">
              <Search size={32} color="#cbd5e1" />
              <p className="toss-patch-empty-title">
                {dict.patchNotes?.noResults || '일치하는 패치 내역이 없어요'}
              </p>
              <p className="toss-patch-empty-desc">
                {dict.patchNotes?.noResultsDesc || '다른 검색어로 검색해보세요.'}
              </p>
            </div>
          ) : (
            <div className="toss-patch-timeline">
              {filteredReleases.map((release, idx) => {
                const isExpanded = !!expandedVersions[release.version];
                const isLatest = idx === 0 && !searchQuery && filterType === 'all';

                return (
                  <div
                    key={release.version}
                    className={`toss-patch-card ${release.type === 'major' ? 'major-card' : ''} ${
                      isLatest ? 'latest-card' : ''
                    }`}
                  >
                    {/* Card Header */}
                    <div
                      className="toss-patch-card-header"
                      onClick={() => toggleExpand(release.version)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="toss-patch-card-left">
                        <div className="toss-patch-badge-group">
                          <span
                            className={`toss-patch-ver-tag ${
                              release.type === 'major' ? 'major' : 'patch'
                            }`}
                          >
                            v{release.version}
                          </span>
                          {isLatest && (
                            <span className="toss-patch-tag-latest">
                              <CheckCircle2 size={11} />
                              {dict.patchNotes?.latestBadge || '최신 버전'}
                            </span>
                          )}
                          {release.type === 'major' ? (
                            <span className="toss-patch-tag-major">
                              {dict.patchNotes?.majorUpdates || '주요 업데이트'}
                            </span>
                          ) : (
                            <span className="toss-patch-tag-minor">
                              {dict.patchNotes?.minorUpdates || '개선 & 버그 수정'}
                            </span>
                          )}
                          <span className="toss-patch-date">
                            <Calendar size={12} />
                            {release.date}
                          </span>
                        </div>
                        <h3 className="toss-patch-title">{release.title}</h3>
                        <p className="toss-patch-summary">{release.summary}</p>
                      </div>

                      <div className="toss-patch-card-right">
                        <span className="toss-patch-commit-count">
                          {interpolate
                            ? interpolate(dict.patchNotes?.changesCount || '{count}개 변경', {
                                count: release.totalCommits,
                              })
                            : `${release.totalCommits}개 변경`}
                        </span>
                        <div className="toss-patch-expand-icon">
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>
                    </div>

                    {/* Card Commits List (Expanded) */}
                    {isExpanded && (
                      <div className="toss-patch-commit-list">
                        <div className="toss-patch-commit-list-header">
                          <GitCommit size={14} color="#64748b" />
                          <span>
                            {dict.patchNotes?.commitDetails || '상세 커밋 내역'} ({release.commits.length})
                          </span>
                        </div>
                        <div className="toss-patch-commit-items">
                          {release.commits.map((commit) => {
                            const badgeStyle = getCommitBadgeStyle(commit.type);

                            return (
                              <div key={commit.hash} className="toss-patch-commit-item">
                                <span
                                  className="toss-patch-commit-badge"
                                  style={{
                                    backgroundColor: badgeStyle.bg,
                                    color: badgeStyle.text,
                                  }}
                                >
                                  {commit.type}
                                </span>
                                {commit.scope && (
                                  <span className="toss-patch-commit-scope">
                                    ({commit.scope})
                                  </span>
                                )}
                                <span className="toss-patch-commit-msg">
                                  {commit.message}
                                </span>
                                <span className="toss-patch-commit-hash">
                                  #{commit.hash}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="model-modal-footer toss-patch-footer">
          <div className="toss-patch-footer-info">
            {interpolate
              ? interpolate(dict.patchNotes?.footerInfo || '총 {releases}개의 릴리즈 · {commits}개의 커밋 반영됨', {
                  releases: localizedReleases.length,
                  commits: totalCommitsCount,
                })
              : `총 ${localizedReleases.length}개의 릴리즈 · ${totalCommitsCount}개의 커밋 반영됨`}
          </div>
          <button
            type="button"
            className="toss-modal-btn-close"
            onClick={onClose}
            style={{ minWidth: '100px' }}
          >
            {dict.patchNotes?.confirmButton || dict.common?.confirm || '확인'}
          </button>
        </div>
      </div>
    </div>
  );
};

function getCommitBadgeStyle(type: string): { bg: string; text: string } {
  switch (type.toLowerCase()) {
    case 'feat':
      return { bg: '#eff6ff', text: '#2563eb' };
    case 'fix':
      return { bg: '#fef2f2', text: '#dc2626' };
    case 'perf':
      return { bg: '#faf5ff', text: '#9333ea' };
    case 'style':
      return { bg: '#f0fdf4', text: '#16a34a' };
    case 'refactor':
      return { bg: '#f8fafc', text: '#475569' };
    case 'revert':
      return { bg: '#fff7ed', text: '#ea580c' };
    default:
      return { bg: '#f1f5f9', text: '#64748b' };
  }
}
