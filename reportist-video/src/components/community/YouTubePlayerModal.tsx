// src/components/community/YouTubePlayerModal.tsx - YouTube Video Player Modal
import React, { useState } from 'react';
import { X, ExternalLink, Share2, Check, Eye, User, Calendar } from 'lucide-react';
import type { VideoShareItem } from '../../types/share.ts';
import { formatViewCount, formatTimeAgo } from '../../services/youtubeService.ts';
import { useI18n } from '../../i18n/index.tsx';
import { notify } from '../../services/toastService.ts';

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
      notify.success(dict.community?.copiedToast || '유튜브 링크를 복사했어요.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify.error(dict.toasts.linkCopyFailed);
    }
  };

  return (
    <div className="model-modal-backdrop" onClick={onClose}>
      <div
        className="toss-community-player-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="toss-modal-header">
          <div className="toss-modal-header-left">
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
            <h3 className="toss-modal-title">
              {item.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="toss-modal-close-btn"
            title={dict.common.close}
          >
            <X size={18} />
          </button>
        </div>

        {/* 16:9 Video Player Container */}
        <div className="toss-youtube-player-frame">
          <iframe
            src={embedUrl}
            title={item.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>

        {/* Video Info Section */}
        <div className="toss-player-details">
          <div className="toss-player-meta-bar">
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#191f28', margin: '0 0 6px', lineHeight: 1.35 }}>
                {item.title}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '12.5px', color: '#6b7684', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: '#191f28' }}>
                  <User size={14} color="#0f172a" />
                  {item.authorName}
                </span>
                <span>·</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Eye size={14} />
                  {formatViewCount(item.viewCount, locale)}
                </span>
                <span>·</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Calendar size={14} />
                  {formatTimeAgo(item.createdAt, locale)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="toss-player-actions">
              <button
                type="button"
                onClick={handleCopyLink}
                className="toss-btn-icon-text"
              >
                {copied ? <Check size={14} color="#03b26c" /> : <Share2 size={14} />}
                <span>{copied ? (dict.community?.copiedToast || '복사 완료') : (dict.community?.copyLink || '링크 복사')}</span>
              </button>

              <a
                href={youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="toss-btn-share-primary"
                style={{ backgroundColor: '#dc2626', textDecoration: 'none' }}
              >
                <ExternalLink size={14} />
                <span>{dict.community?.playOnYouTube || '유튜브에서 시청하기'}</span>
              </a>
            </div>
          </div>

          {item.description && (
            <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: 12, border: '1px solid #eef2f6', fontSize: '13px', color: '#4e5968', lineHeight: 1.5 }}>
              {item.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
