// src/components/community/YouTubePlayerModal.tsx - YouTube Video Player Modal
import React, { useState } from 'react';
import { X, ExternalLink, Share2, Check, Eye, User, Calendar } from 'lucide-react';
import type { VideoShareItem } from '../../types/share.ts';
import { formatViewCount, formatTimeAgo } from '../../services/youtubeService.ts';
import { useI18n } from '../../i18n/index.tsx';

interface YouTubePlayerModalProps {
  item: VideoShareItem | null;
  onClose: () => void;
}

export const YouTubePlayerModal: React.FC<YouTubePlayerModalProps> = ({ item, onClose }) => {
  const { dict, locale } = useI18n();
  const [copied, setCopied] = useState(false);

  if (!item) return null;

  const youtubeUrl = `https://www.youtube.com/watch?v=${item.youtubeVideoId}`;
  const embedUrl = `https://www.youtube-nocookie.com/embed/${item.youtubeVideoId}?autoplay=1&rel=0`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(youtubeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse shrink-0"></span>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
              {item.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            title={dict.common.close}
          >
            <X size={18} />
          </button>
        </div>

        {/* 16:9 Video Player Container */}
        <div className="relative w-full bg-black aspect-video shrink-0">
          <iframe
            src={embedUrl}
            title={item.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full border-0"
          />
        </div>

        {/* Video Info Section */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                {item.title}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-500 mt-1.5">
                <span className="flex items-center gap-1 font-medium text-slate-700">
                  <User size={14} className="text-blue-600" />
                  {item.authorName}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Eye size={14} />
                  {formatViewCount(item.viewCount, locale)}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {formatTimeAgo(item.createdAt, locale)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                {copied ? <Check size={14} className="text-emerald-600" /> : <Share2 size={14} />}
                <span>{copied ? (dict.community?.copiedToast || '복사 완료') : (dict.community?.copyLink || '링크 복사')}</span>
              </button>

              <a
                href={youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-sm transition-colors"
              >
                <ExternalLink size={14} />
                <span>{dict.community?.playOnYouTube || '유튜브에서 시청하기'}</span>
              </a>
            </div>
          </div>

          {item.description && (
            <div className="p-3.5 bg-slate-50 rounded-xl text-xs sm:text-sm text-slate-600 leading-relaxed border border-slate-100">
              {item.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
