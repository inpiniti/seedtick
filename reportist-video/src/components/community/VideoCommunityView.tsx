// src/components/community/VideoCommunityView.tsx - YouTube-Style Video Community Screen
import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  Play,
  Share2,
  ExternalLink,
  Flame,
  Clock,
  Sparkles,
  Database,
  Film,
  RefreshCw,
} from 'lucide-react';
import type { VideoShareItem, VideoSortOrder } from '../../types/share.ts';
import { fetchSharedVideos, incrementVideoShareView } from '../../services/videoShareService.ts';
import { formatViewCount, formatTimeAgo } from '../../services/youtubeService.ts';
import { YouTubePlayerModal } from './YouTubePlayerModal.tsx';
import { ShareVideoModal } from './ShareVideoModal.tsx';
import { useI18n } from '../../i18n/index.tsx';

interface VideoCommunityViewProps {
  onOpenStudio?: () => void;
}

export const VideoCommunityView: React.FC<VideoCommunityViewProps> = ({ onOpenStudio }) => {
  const { dict, locale } = useI18n();
  const cDict = dict.community;

  const [videos, setVideos] = useState<VideoShareItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUsingFallback, setIsUsingFallback] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<VideoSortOrder>('latest');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoShareItem | null>(null);

  // 모달 오픈 시 브라우저 뒤로가기 연동 (뒤로가기 시 웹페이지를 빠져나가지 않고 모달만 닫힘)
  useEffect(() => {
    const isAnyModalOpen = Boolean(isShareModalOpen || selectedVideo);
    if (!isAnyModalOpen) return;

    window.history.pushState({ communityModal: true }, '', window.location.hash);

    const handlePopState = () => {
      setIsShareModalOpen(false);
      setSelectedVideo(null);
    };

    window.addEventListener('popstate', handlePopState, { once: true });
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isShareModalOpen, selectedVideo]);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2500);
  }, []);

  // 비디오 목록 로드
  const loadVideos = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchSharedVideos(sortOrder, searchQuery);
      setVideos(res.items);
      setIsUsingFallback(res.isUsingFallback);
    } catch (err) {
      console.warn('Failed to load shared videos:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sortOrder, searchQuery]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  // 비디오 카드 클릭 (플레이어 열기 및 조회수 1 증가)
  const handleSelectVideo = (video: VideoShareItem) => {
    setSelectedVideo(video);
    // 조회수 즉시 +1 UI 반영
    setVideos((prev) =>
      prev.map((v) => (v.id === video.id ? { ...v, viewCount: v.viewCount + 1 } : v))
    );
    // 백그라운드 DB 갱신
    incrementVideoShareView(video.id).catch(() => {});
  };

  // 영상 공유 완료 후 핸들러
  const handleShareSuccess = (newItem: VideoShareItem) => {
    setVideos((prev) => [newItem, ...prev]);
    showToast(cDict?.successToast || '영상이 성공적으로 공유되었어요!');
  };

  // 링크 복사
  const handleCopyLink = async (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
    try {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      await navigator.clipboard.writeText(url);
      showToast(cDict?.copiedToast || '영상 링크를 복사했어요.');
    } catch {
      // ignore
    }
  };

  return (
    <div className="toss-community-wrapper">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="toss-toast-float">
          <Sparkles size={15} color="#fbbf24" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="toss-community-inner">
        {/* 1. Toss Style Header Card */}
        <section className="toss-community-header-card">
          <div className="toss-community-header-top">
            <div className="toss-community-header-left">
              <div className="toss-community-badge-row">
                <span className="toss-community-badge youtube">
                  <Play size={10} fill="currentColor" />
                  YouTube
                </span>
                <span className="toss-community-badge">COMMUNITY</span>
              </div>
              <h1 className="toss-community-title">
                {cDict?.headerTitle || '공유된 영상 둘러보기'}
              </h1>
              <p className="toss-community-desc">
                {cDict?.headerDesc ||
                  'Reportist Video로 제작하여 유튜브에 공유된 하이라이트 영상들을 만나보세요.'}
              </p>
            </div>

            <div className="toss-community-header-actions">
              {onOpenStudio && (
                <button
                  type="button"
                  onClick={onOpenStudio}
                  className="toss-btn-studio-switch"
                >
                  <Film size={14} />
                  <span>{cDict?.studioTab || '스튜디오로 이동'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsShareModalOpen(true)}
                className="toss-btn-share-primary"
              >
                <Plus size={16} />
                <span>{cDict?.shareMyVideo || '영상 공유하기'}</span>
              </button>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="toss-community-filter-row">
            {/* Search Box */}
            <div className="toss-community-search-box">
              <Search size={15} className="toss-community-search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={cDict?.searchPlaceholder || '영상 제목 또는 작성자 검색...'}
                className="toss-community-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="toss-community-search-clear"
                  title="검색어 지우기"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sort & Refresh Actions */}
            <div className="toss-community-filter-actions">
              <div className="toss-community-filter-pills">
                <button
                  type="button"
                  onClick={() => setSortOrder('latest')}
                  className={`toss-community-sort-btn ${sortOrder === 'latest' ? 'active' : ''}`}
                >
                  <Clock size={13} />
                  <span>{cDict?.sortLatest || '최신순'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSortOrder('views')}
                  className={`toss-community-sort-btn ${sortOrder === 'views' ? 'active' : ''}`}
                >
                  <Flame size={13} color={sortOrder === 'views' ? '#f59e0b' : undefined} />
                  <span>{cDict?.sortViews || '조회수순'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={loadVideos}
                className="toss-community-refresh-icon-btn"
                title={dict.common?.retry || '새로고침'}
              >
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </section>

        {/* 2. Supabase DB 연동 안내 (테이블 미생성 시) */}
        {isUsingFallback && (
          <div className="toss-preview-card-box" style={{ borderColor: '#fed7aa', backgroundColor: '#fffbeb' }}>
            <Database size={18} color="#ea580c" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '12.5px', color: '#9a3412', lineHeight: '1.45' }}>
              <strong>Supabase DB 안내: </strong>
              현재 Supabase 테이블(<code>video_shares</code>) 생성 전이어서 임시 저장소로 표시 중입니다.
              SQL 마이그레이션(<code>migration_video_shares.sql</code>)을 실행하시면 모든 사용자와 실시간 공유됩니다.
            </div>
          </div>
        )}

        {/* 3. 영상 갤러리 그리드 또는 빈 화면 */}
        {videos.length === 0 ? (
          <div className="toss-community-empty">
            <div className="toss-community-empty-icon">
              <Film size={30} />
            </div>
            <h3 className="toss-community-empty-title">
              {searchQuery
                ? (cDict?.emptySearch || '검색 결과와 일치하는 영상이 없어요')
                : (cDict?.emptyTitle || '공유된 영상이 아직 없어요')}
            </h3>
            <p className="toss-community-empty-desc">
              {searchQuery
                ? (cDict?.emptySearchDesc || (locale === 'ko' ? '다른 검색어를 입력하시거나 검색창을 지워보세요.' : 'Try another search term or clear the search field.'))
                : (cDict?.emptyDesc ||
                  '직접 만든 하이라이트 영상을 유튜브에 올리고 첫 번째로 공유해 보세요!')}
            </p>
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="toss-btn-studio-switch"
              >
                {cDict?.viewAll || (locale === 'ko' ? '전체 목록 보기' : 'View All')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsShareModalOpen(true)}
                className="toss-btn-share-primary"
              >
                <Plus size={15} />
                <span>{cDict?.shareMyVideo || '영상 공유하기'}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="toss-community-grid">
            {videos.map((video) => (
              <article
                key={video.id}
                onClick={() => handleSelectVideo(video)}
                className="toss-video-card"
              >
                <div className="toss-video-thumb-container">
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    loading="lazy"
                    className="toss-video-thumb-img"
                  />
                  <div className="toss-video-play-overlay">
                    <div className="toss-video-play-circle">
                      <Play size={24} fill="white" style={{ marginLeft: 2 }} />
                    </div>
                  </div>
                  <span className="toss-video-yt-badge">
                    <Play size={9} fill="white" />
                    YouTube
                  </span>
                  {video.durationSec != null && video.durationSec > 0 && (
                    <span className="toss-video-duration-badge">
                      {Math.floor(video.durationSec / 60)}:
                      {String(video.durationSec % 60).padStart(2, '0')}
                    </span>
                  )}
                </div>

                <div className="toss-video-card-body">
                  <div className="toss-video-avatar">
                    {video.authorName ? video.authorName.charAt(0).toUpperCase() : 'R'}
                  </div>
                  <div className="toss-video-details">
                    <h3 className="toss-video-title" title={video.title}>
                      {video.title}
                    </h3>
                    <div className="toss-video-author">{video.authorName}</div>
                    <div className="toss-video-meta-row">
                      <div className="toss-video-meta-info">
                        <span>{formatViewCount(video.viewCount, locale)}</span>
                        <span>·</span>
                        <span>{formatTimeAgo(video.createdAt, locale)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleCopyLink(e, video.youtubeVideoId)}
                        className="toss-video-quick-share"
                        title={cDict?.copyLink || '링크 복사'}
                      >
                        <Share2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <YouTubePlayerModal
        item={selectedVideo}
        onClose={() => setSelectedVideo(null)}
      />

      <ShareVideoModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        onSuccess={handleShareSuccess}
      />
    </div>
  );
};
