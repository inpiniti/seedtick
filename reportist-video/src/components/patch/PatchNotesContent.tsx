// src/components/patch/PatchNotesContent.tsx - 패치노트 본문 (모달/설정창 공용)
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GitCommit,
  Search,
  X,
} from 'lucide-react';
import { PATCH_RELEASES, type PatchRelease } from '../../data/patchNotes.ts';
import { CURRENT_APP_VERSION } from '../../data/appVersion.ts';
import { getLocalizedPatchReleases } from '../../data/patchNotesLocalization.ts';
import { useI18n } from '../../i18n/index.tsx';
import { notify } from '../../services/toastService.ts';
import { Tooltip } from '../ui/Tooltip.tsx';

export interface PatchNotesContentProps {
  /** 독립 모달에서만 쓰는 '확인' 버튼. 설정창에 녹일 때는 생략한다. */
  onClose?: () => void;
}

export const PatchNotesContent: React.FC<PatchNotesContentProps> = ({ onClose }) => {
  const { dict, interpolate, locale } = useI18n();
  const [filterType, setFilterType] = useState<'all' | 'major'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 패치노트 번역은 로케일별 JSON 청크로 분리되어 있어, 현재 언어만 로드한다.
  const [localizedReleases, setLocalizedReleases] = useState<PatchRelease[]>(PATCH_RELEASES);

  useEffect(() => {
    if (locale === 'ko') {
      setLocalizedReleases(PATCH_RELEASES);
      return;
    }
    let cancelled = false;
    void getLocalizedPatchReleases(locale).then((releases) => {
      if (!cancelled) setLocalizedReleases(releases);
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  // 버전 배지 10회 클릭으로 개발자 모드 전환 (설정창에 녹아도 동일하게 동작)
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
        ? dict.toasts.devModeConfirmOff
        : dict.toasts.devModeConfirmOn;

      if (window.confirm(confirmMessage)) {
        const nextState = !isDev;
        localStorage.setItem('reportist_feedback_admin_mode', String(nextState));
        window.dispatchEvent(new Event('reportist_admin_mode_change'));
        window.dispatchEvent(new Event('storage'));
        notify.info(nextState ? dict.toasts.devModeOn : dict.toasts.devModeOff);
      }
    }
  };

  // 첫 2개 버전은 기본적으로 펼침 상태
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (PATCH_RELEASES.length > 0) initial[PATCH_RELEASES[0].version] = true;
    if (PATCH_RELEASES.length > 1) initial[PATCH_RELEASES[1].version] = true;
    return initial;
  });

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

  return (
    <>
      {/* Body (탭·검색도 본문과 함께 스크롤) */}
      <div
        className="toss-patch-modal-body"
        data-modal-scrollable="true"
        onTouchMove={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
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
              {dict.patchNotes?.majorUpdates || '주요 업데이트'} (
              {localizedReleases.filter((r) => r.type === 'major').length})
            </button>
          </div>

          <div className="toss-patch-actions-row">
            <div className="toss-patch-search-box">
              <Search size={14} style={{ color: 'var(--ui-text-subtle)' }} />
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
              <Tooltip content={dict.patchNotes?.expandAll || '모두 펼치기'}>
                <button
                  type="button"
                  className="toss-patch-text-btn"
                  onClick={expandAll}
                >
                  {dict.patchNotes?.expandAll || '모두 펼치기'}
                </button>
              </Tooltip>
              <span className="toss-patch-divider">|</span>
              <Tooltip content={dict.patchNotes?.collapseAll || '모두 접기'}>
                <button
                  type="button"
                  className="toss-patch-text-btn"
                  onClick={collapseAll}
                >
                  {dict.patchNotes?.collapseAll || '모두 접기'}
                </button>
              </Tooltip>
            </div>

            {/* 10회 클릭 개발자 모드 토글 — 독립 모달/설정창 어디서나 동작 */}
            <Tooltip content={dict.patchNotes?.latestBadge || '최신 버전'}>
              <span
                className="toss-patch-current-version-badge"
                onClick={handleVersionClick}
              >
                v{CURRENT_APP_VERSION} {dict.patchNotes?.latestBadge || '최신'}
              </span>
            </Tooltip>
          </div>
        </div>

        {filteredReleases.length === 0 ? (
          <div className="toss-patch-empty-state">
            <Search size={32} style={{ color: 'var(--ui-text-subtle)' }} />
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

                  {isExpanded && (
                    <div className="toss-patch-commit-list">
                      <div className="toss-patch-commit-list-header">
                        <GitCommit size={14} style={{ color: 'var(--ui-text-muted)' }} />
                        <span>
                          {dict.patchNotes?.commitDetails || '상세 커밋 내역'} (
                          {release.commits.length})
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
            ? interpolate(
                dict.patchNotes?.footerInfo ||
                  '총 {releases}개의 릴리즈 · {commits}개의 커밋 반영됨',
                {
                  releases: localizedReleases.length,
                  commits: totalCommitsCount,
                }
              )
            : `총 ${localizedReleases.length}개의 릴리즈 · ${totalCommitsCount}개의 커밋 반영됨`}
        </div>
        {onClose && (
          <button
            type="button"
            className="toss-modal-btn-close"
            onClick={onClose}
            style={{ minWidth: '100px' }}
          >
            {dict.patchNotes?.confirmButton || dict.common?.confirm || '확인'}
          </button>
        )}
      </div>
    </>
  );
};

function getCommitBadgeStyle(type: string): { bg: string; text: string } {
  // 색을 토큰으로 넘겨 다크 모드에서도 배지 대비가 유지되게 한다.
  switch (type.toLowerCase()) {
    case 'feat':
      return { bg: 'var(--ui-surface-muted)', text: 'var(--ui-ink)' };
    case 'fix':
      return { bg: 'var(--ui-danger-surface)', text: 'var(--ui-danger)' };
    case 'perf':
      return { bg: 'var(--ui-surface-sunken)', text: 'var(--ui-ink)' };
    case 'style':
      return { bg: 'var(--ui-success-surface)', text: 'var(--ui-success-ink)' };
    case 'refactor':
      return { bg: 'var(--ui-surface-sunken)', text: 'var(--ui-text-muted)' };
    case 'revert':
      return { bg: 'var(--ui-warning-surface)', text: 'var(--ui-warning-ink)' };
    default:
      return { bg: 'var(--ui-surface-muted)', text: 'var(--ui-text-muted)' };
  }
}

export default PatchNotesContent;
