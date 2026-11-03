// services/thumbnailGenerator.ts - 16:9 YouTube 고화질 썸네일 생성 및 커스텀 스타일 엔진

export interface ThumbnailRenderOptions {
  titleText: string;
  channelText?: string;
  badgeText?: string;
  showTitle?: boolean;
  showBadge?: boolean;
  showChannel?: boolean;
  stylePreset?: 'youtube-bold' | 'cinematic-clean' | 'banner-box';
  textColor?: string;
  accentColor?: string;
}

export const DEFAULT_THUMBNAIL_OPTIONS: ThumbnailRenderOptions = {
  titleText: '',
  channelText: 'Reportist',
  badgeText: '✨ AI 하이라이트',
  showTitle: true,
  showBadge: true,
  showChannel: true,
  stylePreset: 'youtube-bold',
  textColor: '#ffffff',
  accentColor: '#3182f6',
};

/**
 * 비디오 URL과 특정 타임스탬프에서 16:9 (1280x720) 해상도로 배경 프레임을 캡처합니다.
 */
export async function captureVideoFrameAtTime(
  videoUrl: string,
  timestamp: number,
  cropOffsetYRatio = 0.2,
  targetWidth = 1280,
  targetHeight = 720
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };

    const onError = () => {
      cleanup();
      reject(new Error('비디오 프레임 추출에 실패했습니다.'));
    };

    const onSeeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          reject(new Error('Canvas context 생성 실패'));
          return;
        }

        const vW = video.videoWidth || 1280;
        const vH = video.videoHeight || 720;
        const targetAspect = targetWidth / targetHeight; // 16:9 = 1.777...
        const videoAspect = vW / vH;

        let sx = 0;
        let sy = 0;
        let sWidth = vW;
        let sHeight = vH;

        if (videoAspect > targetAspect) {
          // 비디오가 16:9보다 더 넓은 가로 영상 -> 좌우 중앙 크롭
          sWidth = Math.round(vH * targetAspect);
          sx = Math.round((vW - sWidth) / 2);
        } else if (videoAspect < targetAspect) {
          // 세로 영상(9:16) 또는 4:3 영상 -> 상하 크롭
          sHeight = Math.round(vW / targetAspect);
          if (videoAspect < 1.0) {
            // 세로 영상: 인물 얼굴을 보호하기 위해 상단 편향 크롭
            const maxSy = Math.max(0, vH - sHeight);
            sy = Math.round(maxSy * Math.max(0, Math.min(1, cropOffsetYRatio)));
          } else {
            // 4:3 등 일반 가로 영상: 중앙 정렬
            sy = Math.round((vH - sHeight) / 2);
          }
        }

        sx = Math.max(0, Math.min(sx, Math.max(0, vW - sWidth)));
        sy = Math.max(0, Math.min(sy, Math.max(0, vH - sHeight)));

        // 1280x720 캔버스에 그리기
        ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

        cleanup();
        resolve(canvas);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onloadedmetadata = () => {
      const dur = video.duration || 1;
      const targetTime = Math.max(0, Math.min(dur - 0.05, timestamp));

      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('비디오 프레임 추출 타임아웃'));
      }, 5000);

      video.addEventListener('seeked', onSeeked);
      video.addEventListener('error', onError);
      video.currentTime = targetTime;
    };

    video.onerror = onError;
  });
}

/**
 * 텍스트를 줄바꿈하여 여러 줄 배열로 반환합니다.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  // 사용자가 직접 줄바꿈(\n)을 넣은 경우 먼저 분리
  const rawLines = text.split('\n');
  const result: string[] = [];

  for (const rawLine of rawLines) {
    if (!rawLine) {
      result.push('');
      continue;
    }

    const words = rawLine.split(' ');
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        result.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      result.push(currentLine);
    }
  }

  return result;
}

/**
 * 캡처된 배경 캔버스 위에 유튜브 스타일의 고품질 텍스트 및 그라데이션 오버레이를 합성합니다.
 */
export function renderThumbnailArtwork(
  bgCanvas: HTMLCanvasElement | HTMLImageElement,
  options: ThumbnailRenderOptions,
  targetWidth = 1280,
  targetHeight = 720
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // 1. 배경 프레임 그리기
  ctx.drawImage(bgCanvas, 0, 0, targetWidth, targetHeight);

  // 2. 유튜브 시네마틱 비네팅 & 하단/상단 가독성 그라데이션
  // 상단 은은한 섀도우 (채널명/배지 가독성)
  const topGrad = ctx.createLinearGradient(0, 0, 0, 200);
  topGrad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  topGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, targetWidth, 200);

  // 하단 딥 다크 그라데이션 (타이틀 가독성 극대화)
  const bottomGrad = ctx.createLinearGradient(0, targetHeight - 380, 0, targetHeight);
  bottomGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  bottomGrad.addColorStop(0.35, 'rgba(0, 0, 0, 0.45)');
  bottomGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0.85)');
  bottomGrad.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, targetHeight - 380, targetWidth, 380);

  // 비네팅 (가장자리 어둡게)
  const vignette = ctx.createRadialGradient(
    targetWidth / 2,
    targetHeight / 2,
    targetWidth * 0.35,
    targetWidth / 2,
    targetHeight / 2,
    targetWidth * 0.72
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // 3. 상단 좌측 배지 (AI 하이라이트)
  if (options.showBadge && options.badgeText) {
    ctx.save();
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif';
    const badgeText = options.badgeText;
    const badgeMetrics = ctx.measureText(badgeText);
    const bPadX = 16;
    const bPadY = 9;
    const bW = badgeMetrics.width + bPadX * 2;
    const bH = 38;
    const bX = 48;
    const bY = 44;

    // 배지 배경 (선명한 블루 그라데이션)
    const bGrad = ctx.createLinearGradient(bX, bY, bX + bW, bY + bH);
    bGrad.addColorStop(0, '#2563eb');
    bGrad.addColorStop(1, '#4f46e5');
    ctx.fillStyle = bGrad;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;

    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(bX, bY, bW, bH, 8);
    } else {
      ctx.rect(bX, bY, bW, bH);
    }
    ctx.fill();

    // 배지 텍스트
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, bX + bPadX, bY + bH / 2);
    ctx.restore();
  }

  // 4. 상단 우측 채널명
  if (options.showChannel && options.channelText) {
    ctx.save();
    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(options.channelText, targetWidth - 48, 63);
    ctx.restore();
  }

  // 5. 메인 타이틀 텍스트 렌더링
  if (options.showTitle && options.titleText && options.titleText.trim()) {
    const rawTitle = options.titleText.trim();
    ctx.save();

    // 타이틀 길이에 따라 폰트 크기 자동 조절
    let fontSize = 54;
    if (rawTitle.length > 25) fontSize = 44;
    if (rawTitle.length > 40) fontSize = 38;

    ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "Pretendard", "Noto Sans KR", sans-serif`;

    const maxTextWidth = targetWidth - 110;
    const lines = wrapText(ctx, rawTitle, maxTextWidth).slice(0, 2); // 최대 2줄 표시

    const lineHeight = fontSize * 1.25;
    const totalTextHeight = lines.length * lineHeight;
    const startY = targetHeight - 56 - totalTextHeight + fontSize;

    lines.forEach((line, index) => {
      const lineY = startY + index * lineHeight;

      // 스타일 프리셋별 렌더링
      if (options.stylePreset === 'banner-box') {
        // 배경 박스 스타일 (유튜브 트렌드)
        const lineMetrics = ctx.measureText(line);
        const padX = 18;
        const boxH = fontSize * 1.25;
        const boxX = 48;
        const boxY = lineY - fontSize * 0.9;
        const boxW = lineMetrics.width + padX * 2;

        ctx.fillStyle = index === 0 ? 'rgba(0, 0, 0, 0.85)' : 'rgba(37, 99, 235, 0.95)';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(boxX, boxY, boxW, boxH, 8);
        } else {
          ctx.rect(boxX, boxY, boxW, boxH);
        }
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.fillText(line, boxX + padX, lineY);
      } else {
        // 기본 'youtube-bold' 또는 'cinematic-clean': 볼드 텍스트 + 깊은 외곽선 & 섀도우
        const textX = 48;

        // 두꺼운 블랙 스트로크 외곽선
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(6, Math.round(fontSize * 0.14));
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(line, textX, lineY);

        // 강한 드롭 섀도우
        ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;

        // 메인 텍스트 (화이트 또는 옐로우 강조)
        ctx.fillStyle = options.textColor || '#ffffff';
        ctx.textAlign = 'left';
        ctx.fillText(line, textX, lineY);

        // 첫 번째 줄 또는 특정 단어에 옐로우 하이라이트 효과 (옵션)
        if (index === 0 && lines.length > 1) {
          ctx.fillStyle = '#fef08a'; // 부드러운 옐로우
          ctx.fillText(line, textX, lineY);
        }
      }
    });

    ctx.restore();
  }

  return canvas;
}

/**
 * 썸네일을 파일로 즉시 다운로드합니다.
 */
export async function downloadThumbnailFile(
  target: HTMLCanvasElement | string,
  customTitle?: string
): Promise<void> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');

  const sanitizedTitle = (customTitle || 'highlight')
    .trim()
    .replace(/[^a-zA-Z0-9가-힣\s_-]/g, '')
    .slice(0, 20)
    .trim()
    .replace(/\s+/g, '_');

  const fileName = `reportist-thumbnail-16x9-${sanitizedTitle || 'video'}-${dateStr}-${timeStr}.jpg`;

  const handleBlob = (blob: Blob | null) => {
    if (!blob) return;

    // 모바일 공유 API 지원 (iOS Safari 사진 앱 저장)
    try {
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        navigator
          .share({ files: [file], title: customTitle || 'Reportist Thumbnail' })
          .catch(() => {
            triggerDownload(blob, fileName);
          });
        return;
      }
    } catch {
      // fallback
    }

    triggerDownload(blob, fileName);
  };

  if (typeof target === 'string') {
    try {
      const res = await fetch(target);
      const blob = await res.blob();
      handleBlob(blob);
    } catch {
      const a = document.createElement('a');
      a.href = target;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    return;
  }

  return new Promise((resolve) => {
    target.toBlob((blob) => {
      handleBlob(blob);
      resolve();
    }, 'image/jpeg', 0.95);
  });
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
