// src/components/community/SharedVideosPanel.tsx - 좌측 독에 녹여 쓰는 컴팩트 공유 영상 패널.
// 기존 VideoCommunityView(전체 화면)와 같은 서비스/모달을 재사용하되, 좁은 사이드바에 맞춘 레이아웃이다.
import { useCallback, useEffect, useState } from 'react';
import { Clock, Film, Flame, Play, Plus, RefreshCw, Search } from 'lucide-react';
import type { VideoShareItem, VideoSortOrder } from '../../types/share.ts';
import { fetchSharedVideos, incrementVideoShareView } from '../../services/videoShareService.ts';
import { formatViewCount, formatTimeAgo } from '../../services/youtubeService.ts';
import { ShareVideoModal } from './ShareVideoModal.tsx';
import { useI18n } from '../../i18n/index.tsx';
import { notify } from '../../services/toastService.ts';
import { Tooltip } from '../ui/Tooltip.tsx';

interface SharedVideosPanelProps {
  /** 현재 중앙 미리보기에서 재생 중인 공유 영상 id. 목록에서 선택 상태로 표시한다. */
  selectedVideoId?: string | null;
  /** 영상을 누르면 모달 대신 중앙 미리보기에서 바로 재생한다. */
  onSelectVideo: (video: VideoShareItem) => void;
}

/**
 * 내가 등록한 영상과 다른 사람이 공유한 영상을 함께 보여주는 패널.
 * 등록은 ShareVideoModal을 그대로 사용하고, 재생은 상위의 중앙 미리보기로 위임한다.
 */
export const SharedVideosPanel = ({
  selectedVideoId,
  onSelectVideo,
}: SharedVideosPanelProps) => {
  const { dict, locale, ui } = useI18n();
  const cDict = dict.community;

  const [videos, setVideos] = useState<VideoShareItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<VideoSortOrder>('latest');
  const [searchQuery, setSearchQuery] = useState('');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const loadVideos = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchSharedVideos(sortOrder, searchQuery);
      setVideos(res.items);
    } catch (err) {
      console.warn('[SharedVideosPanel] Failed to load shared videos:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sortOrder, searchQuery]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const handleSelectVideo = (video: VideoShareItem) => {
    setVideos((prev) =>
      prev.map((v) => (v.id === video.id ? { ...v, viewCount: v.viewCount + 1 } : v))
    );
    void incrementVideoShareView(video.id);
    onSelectVideo(video);
  };

  const handleShareSuccess = (newItem: VideoShareItem) => {
    setVideos((prev) => [newItem, ...prev]);
    notify.success(cDict?.successToast || ui('영상이 성공적으로 공유되었어요!'));
  };

  return (
    <div className="sv2-share">
      <div className="sv2-share-tools">
        <div className="sv2-share-search">
          <Search size={14} aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={cDict?.searchPlaceholder || ui('영상 제목 또는 작성자 검색...')}
            aria-label={cDict?.searchPlaceholder || ui('영상 제목 또는 작성자 검색...')}
          />
          {searchQuery && (
            <Tooltip content={ui('검색어 지우기')}>
              <button
                type="button"
                className="sv2-share-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label={ui('검색어 지우기')}
              >
                ✕
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="sv2-share-filters">
        <div className="sv2-share-sorts">
          <button
            type="button"
            className="sv2-share-sort"
            data-active={sortOrder === 'latest'}
            onClick={() => setSortOrder('latest')}
          >
            <Clock size={12} />
            {cDict?.sortLatest || ui('최신순')}
          </button>
          <button
            type="button"
            className="sv2-share-sort"
            data-active={sortOrder === 'views'}
            onClick={() => setSortOrder('views')}
          >
            <Flame size={12} color={sortOrder === 'views' ? '#f59e0b' : undefined} />
            {cDict?.sortViews || ui('조회수순')}
          </button>
        </div>
        <Tooltip content={dict.common?.retry || ui('새로고침')}>
          <button
            type="button"
            className="sv2-share-refresh"
            onClick={loadVideos}
            aria-label={dict.common?.retry || ui('새로고침')}
          >
            <RefreshCw size={13} className={isLoading ? 'sv2-spin' : ''} />
          </button>
        </Tooltip>
      </div>

      <div className="sv2-share-list">
        {isLoading ? (
          [0, 1, 2].map((i) => (
            <div key={i} className="sv2-share-card sv2-share-card-skeleton" aria-hidden="true">
              <div className="sv2-share-skeleton-thumb" />
              <div className="sv2-share-skeleton-lines">
                <div className="sv2-share-skeleton-line" />
                <div className="sv2-share-skeleton-line" style={{ width: '70%' }} />
              </div>
            </div>
          ))
        ) : videos.length === 0 ? (
          <div className="sv2-share-empty">
            <Film size={28} aria-hidden="true" />
            <strong>
              {searchQuery
                ? cDict?.emptySearch || ui('검색 결과와 일치하는 영상이 없어요')
                : cDict?.emptyTitle || ui('공유된 영상이 아직 없어요')}
            </strong>
            <p>
              {searchQuery
                ? cDict?.emptySearchDesc ||
                  (locale === 'ko'
                    ? ui('다른 검색어를 입력하시거나 검색창을 지워보세요.')
                    : 'Try another search term or clear the search field.')
                : cDict?.emptyDesc || ui('내 하이라이트 영상을 올리고 첫 번째로 공유해 보세요!')}
            </p>
            {searchQuery && (
              <button type="button" className="sv2-share-empty-btn" onClick={() => setSearchQuery('')}>
                {cDict?.viewAll || ui('전체 목록 보기')}
              </button>
            )}
          </div>
        ) : (
          videos.map((video) => (
            <Tooltip key={video.id} content={video.title}>
              <button
                type="button"
                className="sv2-share-card"
                data-selected={selectedVideoId === video.id}
                onClick={() => handleSelectVideo(video)}
              >
                <div className="sv2-share-thumb">
                  <img src={video.thumbnailUrl} alt="" loading="lazy" />
                  <span className="sv2-share-play" aria-hidden="true">
                    <Play size={14} fill="currentColor" />
                  </span>
                  {video.durationSec != null && video.durationSec > 0 && (
                    <span className="sv2-share-duration">
                      {Math.floor(video.durationSec / 60)}:
                      {String(video.durationSec % 60).padStart(2, '0')}
                    </span>
                  )}
                </div>
                <div className="sv2-share-meta">
                  <div className="sv2-share-title">{video.title}</div>
                  <div className="sv2-share-author">{video.authorName}</div>
                  <div className="sv2-share-stats">
                    {formatViewCount(video.viewCount, locale)} · {formatTimeAgo(video.createdAt, locale)}
                  </div>
                </div>
              </button>
            </Tooltip>
          ))
        )}
      </div>

      <div className="sv2-share-footer">
        <button
          type="button"
          className="sv2-btn sv2-btn-primary"
          onClick={() => setIsShareModalOpen(true)}
        >
          <Plus size={15} /> {cDict?.shareMyVideo || ui('영상 공유하기')}
        </button>
      </div>

      <ShareVideoModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        onSuccess={handleShareSuccess}
      />
    </div>
  );
};
