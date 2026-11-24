// src/components/community/SharedVideoPreview.tsx - 공유 영상을 중앙 스테이지에서 바로 재생하는 뷰.
// 사이드바의 공유 탭에서 영상을 고르면 별도 모달 없이 이 컴포넌트가 미리보기 자리를 대신한다.
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, ExternalLink, Share2 } from 'lucide-react';
import type { VideoShareItem } from '../../types/share.ts';
import { formatViewCount, formatTimeAgo } from '../../services/youtubeService.ts';
import { useI18n } from '../../i18n/index.tsx';
import { notify } from '../../services/toastService.ts';

interface SharedVideoPreviewProps {
  item: VideoShareItem;
  onClose: () => void;
}

export const SharedVideoPreview = ({ item, onClose }: SharedVideoPreviewProps) => {
  const { dict, locale, ui } = useI18n();
  const [copied, setCopied] = useState(false);

  const youtubeUrl = `https://www.youtube.com/watch?v=${item.youtubeVideoId}`;
  const embedUrl = `https://www.youtube-nocookie.com/embed/${item.youtubeVideoId}?autoplay=1&rel=0`;

  // 다른 영상으로 바꾸면 이전 '복사 완료' 표시가 남지 않게 한다.
  useEffect(() => {
    setCopied(false);
  }, [item.youtubeVideoId]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(youtubeUrl);
      setCopied(true);
      notify.success(dict.community?.copiedToast || ui('영상 링크를 복사했어요.'));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      notify.error(dict.toasts.linkCopyFailed);
    }
  };

  return (
    <>
      <div className="sv2-stage-meta sv2-shared-meta">
        <div className="sv2-shared-meta-left">
          <span className="sv2-shared-preview-tag">{ui('공유 영상 미리보기')}</span>
          <strong className="sv2-shared-preview-title" title={item.title}>
            {item.title}
          </strong>
        </div>
        <button type="button" className="sv2-shared-back" onClick={onClose}>
          <ArrowLeft size={14} /> {ui('스튜디오로 돌아가기')}
        </button>
      </div>

      <div className="sv2-shared-frame">
        <iframe
          key={item.youtubeVideoId}
          src={embedUrl}
          title={item.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>

      <div className="sv2-shared-details">
        <div className="sv2-shared-stats">
          <span className="sv2-shared-author">{item.authorName}</span>
          <span>·</span>
          <span>{formatViewCount(item.viewCount, locale)}</span>
          <span>·</span>
          <span>{formatTimeAgo(item.createdAt, locale)}</span>
        </div>
        <div className="sv2-shared-actions">
          <button type="button" className="sv2-shared-action" onClick={handleCopyLink}>
            {copied ? <Check size={14} color="#03b26c" /> : <Share2 size={14} />}
            {copied
              ? dict.community?.copiedToast || ui('복사 완료')
              : dict.community?.copyLink || ui('링크 복사')}
          </button>
          <a
            href={youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="sv2-shared-action sv2-shared-action-youtube"
          >
            <ExternalLink size={14} />
            <span>{dict.community?.playOnYouTube || ui('유튜브에서 시청하기')}</span>
          </a>
        </div>
      </div>
    </>
  );
};
