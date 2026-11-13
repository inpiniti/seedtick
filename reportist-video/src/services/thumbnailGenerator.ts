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
  channelText: '',
  badgeText: '',
  showTitle: true,
  showBadge: false,
  showChannel: false,
  stylePreset: 'youtube-bold',
  textColor: '#ffffff',
  accentColor: '#0f172a',
};

/**
 * 비디오 URL과 특정 타임스탬프에서 16:9 (1280x720) 해상도로 배경 프레임을 캡처합니다.
 */
export async function captureVideoFrameAtTime(
  videoUrl: string,
  timestamp: number,
  cropOffsetYRatio = 0.2,
  targetWidth = 1280,
  targetHeight = 720,
  rotation = 0
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.style.position = 'fixed';
    video.style.top = '-9999px';
    video.style.left = '-9999px';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    if (typeof document !== 'undefined' && document.body) {
      document.body.appendChild(video);
    }

    if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
      video.crossOrigin = 'anonymous';
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isFinished = false;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      video.removeEventListener('loadedmetadata', startSeeking);
      video.removeEventListener('loadeddata', onDataLoaded);
      try {
        video.pause();
        video.removeAttribute('src');
        video.srcObject = null;
        video.load();
      } catch {}
      if (video.parentNode) {
        video.parentNode.removeChild(video);
      }
    };

    const onError = () => {
      if (isFinished) return;
      isFinished = true;
      cleanup();
      reject(new Error('비디오 프레임 추출에 실패했습니다.'));
    };

    const drawFrame = () => {
      if (isFinished) return;
      isFinished = true;
      cleanup();
      try {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context 생성 실패'));
          return;
        }

        const rawVW = video.videoWidth || 1280;
        const rawVH = video.videoHeight || 720;
        const normRot = ((rotation % 360) + 360) % 360;
        const isSideways = normRot === 90 || normRot === 270;
        const vW = isSideways ? rawVH : rawVW;
        const vH = isSideways ? rawVW : rawVH;

        const targetAspect = targetWidth / targetHeight; // 16:9 = 1.777...
        const scale = Math.max(targetWidth / vW, targetHeight / vH);
        const renderW = vW * scale;
        const renderH = vH * scale;

        const offsetX = (targetWidth - renderW) / 2;
        let offsetY: number;
        if (vH > vW) {
          const excessHeight = renderH - targetHeight;
          offsetY = -excessHeight * Math.max(0, Math.min(1, cropOffsetYRatio));
        } else {
          offsetY = (targetHeight - renderH) / 2;
        }

        if (normRot === 0) {
          const videoAspect = vW / vH;
          let sx = 0;
          let sy = 0;
          let sWidth = vW;
          let sHeight = vH;

          if (videoAspect > targetAspect) {
            sWidth = Math.round(vH * targetAspect);
            sx = Math.round((vW - sWidth) / 2);
          } else if (videoAspect < targetAspect) {
            sHeight = Math.round(vW / targetAspect);
            if (videoAspect < 1.0) {
              const maxSy = Math.max(0, vH - sHeight);
              sy = Math.round(maxSy * Math.max(0, Math.min(1, cropOffsetYRatio)));
            } else {
              sy = Math.round((vH - sHeight) / 2);
            }
          }

          sx = Math.max(0, Math.min(sx, Math.max(0, vW - sWidth)));
          sy = Math.max(0, Math.min(sy, Math.max(0, vH - sHeight)));

          ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
        } else {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, targetWidth, targetHeight);
          ctx.clip();

          const centerX = offsetX + renderW / 2;
          const centerY = offsetY + renderH / 2;

          ctx.translate(centerX, centerY);
          ctx.rotate((normRot * Math.PI) / 180);

          ctx.drawImage(
            video,
            (-rawVW * scale) / 2,
            (-rawVH * scale) / 2,
            rawVW * scale,
            rawVH * scale
          );
          ctx.restore();
        }

        resolve(canvas);
      } catch (err) {
        reject(err);
      }
    };

    const onSeeked = () => {
      drawFrame();
    };

    const onDataLoaded = () => {
      if (video.readyState >= 2 && Math.abs(video.currentTime - (targetTimeRef || 0)) < 0.1) {
        drawFrame();
      }
    };

    let targetTimeRef = 0;

    const startSeeking = () => {
      const dur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
      const safeTs = Number.isFinite(timestamp) ? timestamp : 0.05;
      const targetTime = Math.max(0.05, Math.min(dur - 0.05, safeTs));
      targetTimeRef = targetTime;

      // 타임아웃 안전장치: 7초 후 readyState가 있으면 즉시 그리고, 없으면 현재 프레임 시도
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (isFinished) return;
        if (video.readyState >= 2 || video.videoWidth > 0) {
          drawFrame();
        } else {
          cleanup();
          reject(new Error('비디오 프레임 추출 타임아웃'));
        }
      }, 7000);

      video.addEventListener('seeked', onSeeked);
      video.addEventListener('loadeddata', onDataLoaded);

      if (video.readyState >= 2 && Math.abs(video.currentTime - targetTime) < 0.05) {
        drawFrame();
        return;
      }

      try {
        video.currentTime = targetTime;
      } catch {
        // currentTime 세팅 실패 시 즉시 그리기 시도
        drawFrame();
      }
    };

    video.addEventListener('loadedmetadata', startSeeking);
    video.addEventListener('error', onError);

    // 메타데이터 로드 자체가 끝나지 않는 경우(iOS Safari에서 화면 밖 비디오 로딩 지연 등)에도
    // Promise가 영원히 대기하지 않도록 로드 단계부터 감시 타이머를 건다. (seek 단계 진입 시 7초 타이머로 교체)
    timeoutId = setTimeout(() => {
      if (isFinished) return;
      isFinished = true;
      cleanup();
      reject(new Error('비디오 메타데이터 로드 타임아웃'));
    }, 10000);

    video.src = videoUrl;

    if (video.readyState >= 1) {
      startSeeking();
    } else {
      video.load();
    }
  });
}

/**
 * AI 분석 단계에서 추출된 클린 키프레임 Data URL(오버레이 일체 없음)로부터 16:9 규격 캔버스를 생성합니다.
 */
export async function createCanvasFromImageDataUrl(
  dataUrl: string,
  targetWidth = 1280,
  targetHeight = 720,
  cropOffsetYRatio = 0.2,
  rotation = 0
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context 생성 실패'));
          return;
        }

        const rawW = img.naturalWidth || img.width || 1280;
        const rawH = img.naturalHeight || img.height || 720;
        const normRot = ((rotation % 360) + 360) % 360;
        const isSideways = normRot === 90 || normRot === 270;
        const vW = isSideways ? rawH : rawW;
        const vH = isSideways ? rawW : rawH;

        const targetAspect = targetWidth / targetHeight;
        const scale = Math.max(targetWidth / vW, targetHeight / vH);
        const renderW = vW * scale;
        const renderH = vH * scale;

        const offsetX = (targetWidth - renderW) / 2;
        let offsetY: number;
        if (vH > vW) {
          const excessHeight = renderH - targetHeight;
          offsetY = -excessHeight * Math.max(0, Math.min(1, cropOffsetYRatio));
        } else {
          offsetY = (targetHeight - renderH) / 2;
        }

        if (normRot === 0) {
          const aspect = vW / vH;
          let sx = 0;
          let sy = 0;
          let sWidth = vW;
          let sHeight = vH;

          if (aspect > targetAspect) {
            sWidth = Math.round(vH * targetAspect);
            sx = Math.round((vW - sWidth) / 2);
          } else if (aspect < targetAspect) {
            sHeight = Math.round(vW / targetAspect);
            if (aspect < 1.0) {
              const maxSy = Math.max(0, vH - sHeight);
              sy = Math.round(maxSy * Math.max(0, Math.min(1, cropOffsetYRatio)));
            } else {
              sy = Math.round((vH - sHeight) / 2);
            }
          }

          sx = Math.max(0, Math.min(sx, Math.max(0, vW - sWidth)));
          sy = Math.max(0, Math.min(sy, Math.max(0, vH - sHeight)));

          ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
        } else {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, targetWidth, targetHeight);
          ctx.clip();

          const centerX = offsetX + renderW / 2;
          const centerY = offsetY + renderH / 2;

          ctx.translate(centerX, centerY);
          ctx.rotate((normRot * Math.PI) / 180);

          ctx.drawImage(
            img,
            (-rawW * scale) / 2,
            (-rawH * scale) / 2,
            rawW * scale,
            rawH * scale
          );
          ctx.restore();
        }

        resolve(canvas);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = (e) => reject(new Error('이미지 로드 실패: ' + e));
    img.src = dataUrl;
  });
}

/**
 * 활성 비디오 엘리먼트(HTMLVideoElement)로부터 직접 16:9 프레임을 즉시 캡처합니다.
 */
export function captureVideoFrameFromElement(
  videoElement: HTMLVideoElement,
  cropOffsetYRatio = 0.2,
  targetWidth = 1280,
  targetHeight = 720,
  rotation = 0
): HTMLCanvasElement | null {
  try {
    if (!videoElement || videoElement.readyState < 2) return null;
    const rawVW = videoElement.videoWidth;
    const rawVH = videoElement.videoHeight;
    if (!rawVW || !rawVH) return null;

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const normRot = ((rotation % 360) + 360) % 360;
    const isSideways = normRot === 90 || normRot === 270;
    const vW = isSideways ? rawVH : rawVW;
    const vH = isSideways ? rawVW : rawVH;

    const targetAspect = targetWidth / targetHeight;
    const scale = Math.max(targetWidth / vW, targetHeight / vH);
    const renderW = vW * scale;
    const renderH = vH * scale;

    const offsetX = (targetWidth - renderW) / 2;
    let offsetY: number;
    if (vH > vW) {
      const excessHeight = renderH - targetHeight;
      offsetY = -excessHeight * Math.max(0, Math.min(1, cropOffsetYRatio));
    } else {
      offsetY = (targetHeight - renderH) / 2;
    }

    if (normRot === 0) {
      const videoAspect = vW / vH;
      let sx = 0;
      let sy = 0;
      let sWidth = vW;
      let sHeight = vH;

      if (videoAspect > targetAspect) {
        sWidth = Math.round(vH * targetAspect);
        sx = Math.round((vW - sWidth) / 2);
      } else if (videoAspect < targetAspect) {
        sHeight = Math.round(vW / targetAspect);
        if (videoAspect < 1.0) {
          const maxSy = Math.max(0, vH - sHeight);
          sy = Math.round(maxSy * Math.max(0, Math.min(1, cropOffsetYRatio)));
        } else {
          sy = Math.round((vH - sHeight) / 2);
        }
      }

      sx = Math.max(0, Math.min(sx, Math.max(0, vW - sWidth)));
      sy = Math.max(0, Math.min(sy, Math.max(0, vH - sHeight)));

      ctx.drawImage(videoElement, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, targetWidth, targetHeight);
      ctx.clip();

      const centerX = offsetX + renderW / 2;
      const centerY = offsetY + renderH / 2;

      ctx.translate(centerX, centerY);
      ctx.rotate((normRot * Math.PI) / 180);

      ctx.drawImage(
        videoElement,
        (-rawVW * scale) / 2,
        (-rawVH * scale) / 2,
        rawVW * scale,
        rawVH * scale
      );
      ctx.restore();
    }

    return canvas;
  } catch (err) {
    console.warn('captureVideoFrameFromElement failed:', err);
    return null;
  }
}

/**
 * 텍스트를 줄바꿈하여 여러 줄 배열로 반환합니다.
 * - 단어(어절) 단위 줄바꿈을 기본으로 하되, 긴 단어는 글자 단위로 분할합니다.
 * - 사용자가 직접 입력한 줄바꿈(\n)을 존중합니다.
 * - 최대 줄 수(maxLines, 기본 3줄)를 초과하면 마지막 줄 끝에 말줄임표(...)를 붙입니다.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 3
): string[] {
  const rawParagraphs = text.split('\n');
  const lines: string[] = [];

  for (const paragraph of rawParagraphs) {
    if (!paragraph.trim()) {
      continue;
    }

    const words = paragraph.split(' ');
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (!word) continue;

      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth) {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = '';
        }

        // 단어 자체가 maxWidth보다 긴 경우 글자 단위로 안전하게 분할
        const singleWordMetrics = ctx.measureText(word);
        if (singleWordMetrics.width > maxWidth) {
          let charBuf = '';
          for (const char of word) {
            const testChar = charBuf + char;
            if (ctx.measureText(testChar).width > maxWidth && charBuf) {
              lines.push(charBuf);
              charBuf = char;
            } else {
              charBuf = testChar;
            }
          }
          currentLine = charBuf;
        } else {
          currentLine = word;
        }
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  if (lines.length > maxLines) {
    const trimmed = lines.slice(0, maxLines);
    let last = trimmed[maxLines - 1];
    while (last.length > 0 && ctx.measureText(last + '...').width > maxWidth) {
      last = last.slice(0, -1);
    }
    trimmed[maxLines - 1] = last ? `${last.trim()}...` : '...';
    return trimmed;
  }

  return lines;
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

  // 1. 순수 배경 프레임 그리기
  ctx.drawImage(bgCanvas, 0, 0, targetWidth, targetHeight);

  // 상단 왼쪽 문구, 오른쪽 문구, 날짜 등의 문구는 썸네일 이미지에 일체 표시되지 않아야 하므로 렌더링하지 않습니다.
  const shouldRenderTitle = Boolean(options.showTitle && options.titleText && options.titleText.trim());

  // 2. 타이틀 텍스트 준비 및 줄바꿈 (줄 수에 맞춰 하단 그라데이션 높이 동적 조절)
  let lines: string[] = [];
  const fontSize = 52; // 글씨 양에 따른 폰트 축소 없이 일관된 크기(52px) 유지
  const lineHeight = Math.round(fontSize * 1.25);

  if (shouldRenderTitle) {
    const rawTitle = options.titleText.trim();
    ctx.save();
    ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "Pretendard", "Noto Sans KR", sans-serif`;
    const maxTextWidth = targetWidth - 110;
    // 글씨가 길어지면 크기 축소 없이 2줄, 3줄로 자연스럽게 늘어남 (최대 3줄)
    lines = wrapText(ctx, rawTitle, maxTextWidth, 3);
    ctx.restore();
  }

  // 타이틀이 활성화된 경우에만 하단 가독성 그라데이션 및 비네팅 적용
  if (shouldRenderTitle && lines.length > 0) {
    // 텍스트 줄 수(1줄~3줄)에 맞춰 하단 그라데이션 높이를 동적으로 최적화
    const gradHeight = Math.max(380, 220 + lines.length * 75);
    const bottomGrad = ctx.createLinearGradient(0, targetHeight - gradHeight, 0, targetHeight);
    bottomGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    bottomGrad.addColorStop(0.3, 'rgba(0, 0, 0, 0.45)');
    bottomGrad.addColorStop(0.75, 'rgba(0, 0, 0, 0.85)');
    bottomGrad.addColorStop(1, 'rgba(0, 0, 0, 0.96)');
    ctx.fillStyle = bottomGrad;
    ctx.fillRect(0, targetHeight - gradHeight, targetWidth, gradHeight);

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
  }

  // 3. 메인 타이틀 텍스트 렌더링
  if (shouldRenderTitle && lines.length > 0) {
    ctx.save();
    ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "Pretendard", "Noto Sans KR", sans-serif`;

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

        ctx.fillStyle = index === 0 ? 'rgba(0, 0, 0, 0.85)' : 'rgba(15, 23, 42, 0.95)';
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
        ctx.lineWidth = Math.max(7, Math.round(fontSize * 0.15));
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

        // 첫 번째 줄에 옐로우 하이라이트 효과 (여러 줄일 때)
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
