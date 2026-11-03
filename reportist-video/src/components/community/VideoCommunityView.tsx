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
    <div className="flex-1 w-full bg-[#f8fafc] overflow-y-auto min-h-0 flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-slate-900/90 text-white text-xs font-semibold rounded-2xl shadow-xl backdrop-blur-sm animate-in fade-in slide-in-from-bottom-3 duration-200 flex items-center gap-2">
          <Sparkles size={14} className="text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Banner / Hero Area */}
      <div className="w-full bg-white border-b border-slate-200/80 px-4 sm:px-8 py-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[11px] font-bold text-red-600 bg-red-50 rounded-md border border-red-200">
                COMMUNITY
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {cDict?.headerTitle || '공유된 영상 둘러보기'}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {cDict?.headerDesc ||
                'Reportist Video로 제작하여 유튜브에 공유된 하이라이트 영상들입니다.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {onOpenStudio && (
              <button
                type="button"
                onClick={onOpenStudio}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
              >
                <Film size={14} />
                <span>{cDict?.studioTab || '스튜디오로 이동'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] rounded-xl shadow-sm transition-all"
            >
              <Plus size={15} />
              <span>{cDict?.shareMyVideo || '+ 내 영상 공유하기'}</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="max-w-7xl mx-auto mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={cDict?.searchPlaceholder || '영상 제목 또는 작성자 검색...'}
              className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm bg-slate-100/80 hover:bg-slate-100 focus:bg-white rounded-xl border border-slate-200/80 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl self-start sm:self-auto border border-slate-200/60">
            <button
              type="button"
              onClick={() => setSortOrder('latest')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                sortOrder === 'latest'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Clock size={13} />
              <span>{cDict?.sortLatest || '최신순'}</span>
            </button>
            <button
              type="button"
              onClick={() => setSortOrder('views')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                sortOrder === 'views'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Flame size={13} className={sortOrder === 'views' ? 'text-amber-500' : ''} />
              <span>{cDict?.sortViews || '조회수순'}</span>
            </button>
            <button
              type="button"
              onClick={loadVideos}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              title="새로고침"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-6 flex-1">
        {/* Supabase Notice Banner if using fallback */}
        {isUsingFallback && (
          <div className="mb-6 p-3.5 bg-amber-50/80 border border-amber-200/90 rounded-2xl flex items-start gap-3 text-xs text-amber-800">
            <Database size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold">Supabase DB 연동 안내: </span>
              <span>
                현재 Supabase 테이블(<code>video_shares</code>)이 아직 생성되지 않아 로컬 저장소로 구동 중입니다.
                제공된 SQL 마이그레이션(<code>migration_video_shares.sql</code>)을 실행하시면 모든 사용자와 실시간 공유됩니다.
              </span>
            </div>
          </div>
        )}

        {/* Video Grid */}
        {isLoading && videos.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex flex-col gap-2.5 animate-pulse">
                <div className="w-full aspect-video bg-slate-200 rounded-2xl"></div>
                <div className="flex gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-200 shrink-0"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : videos.length === 0 ? (
          /* Empty State */
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner mb-4">
              <Film size={28} />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">
              {searchQuery
                ? cDict?.emptySearch || '검색 결과와 일치하는 영상이 없어요.'
                : cDict?.emptyTitle || '공유된 영상이 아직 없어요'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mb-5 leading-relaxed">
              {searchQuery
                ? '다른 검색어를 입력하시거나 검색창을 지워보세요.'
                : cDict?.emptyDesc ||
                  '직접 만든 하이라이트 영상을 유튜브에 올리고 첫 번째로 공유해 보세요!'}
            </p>
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-200/80 hover:bg-slate-200 rounded-xl transition-all"
              >
                전체 목록 보기
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsShareModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all"
              >
                <Plus size={14} />
                <span>{cDict?.shareMyVideo || '+ 내 영상 공유하기'}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {videos.map((video) => (
              <div
                key={video.id}
                onClick={() => handleSelectVideo(video)}
                className="group flex flex-col cursor-pointer bg-transparent rounded-2xl transition-all duration-200"
              >
                {/* 16:9 Thumbnail Container */}
                <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-900 shadow-sm border border-slate-200/80 group-hover:shadow-md group-hover:-translate-y-0.5 transition-all">
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />

                  {/* Dark hover overlay with play icon */}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                      <Play size={22} fill="white" className="ml-0.5" />
                    </div>
                  </div>

                  {/* Duration Badge if available */}
                  {video.durationSec != null && video.durationSec > 0 && (
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/80 text-white text-[11px] font-mono font-medium backdrop-blur-xs">
                      {Math.floor(video.durationSec / 60)}:
                      {String(video.durationSec % 60).padStart(2, '0')}
                    </div>
                  )}
                </div>

                {/* Details Section */}
                <div className="flex gap-3 pt-3 px-1">
                  {/* Channel Avatar */}
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-700 to-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs border border-white/40">
                    {video.authorName.charAt(0).toUpperCase()}
                  </div>

                  {/* Video Meta Info */}
                  <div className="flex-1 min-w-0">
                    <h3
                      className="text-sm font-bold text-slate-900 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors"
                      title={video.title}
                    >
                      {video.title}
                    </h3>
                    <p className="text-xs text-slate-600 truncate mt-1 font-medium">
                      {video.authorName}
                    </p>
                    <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                      <span>{formatViewCount(video.viewCount, locale)}</span>
                      <span>•</span>
                      <span>{formatTimeAgo(video.createdAt, locale)}</span>
                    </div>
                  </div>

                  {/* Quick Action (Copy Link) */}
                  <button
                    type="button"
                    onClick={(e) => handleCopyLink(e, video.youtubeVideoId)}
                    className="self-start p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title={cDict?.copyLink || '링크 복사'}
                  >
                    <Share2 size={14} />
                  </button>
                </div>
              </div>
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
