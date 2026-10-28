// services/videoStitcher.ts - 16:9 유튜브 시네마틱 비디오 병합기, 자막/브랜딩 오버레이, 인트로/아웃트로 & 커스텀 BGM 지원

import type { FinalVideoResult, HighlightSegment, VideoItem, VideoOverlayOptions } from '../types/video.ts';
import { playBgmSynthLoop } from './audioSynth.ts';

export interface StitchVideosParams {
  videos: VideoItem[];
  allSegments: HighlightSegment[];
  onProgress?: (progressPercent: number, currentMessage: string) => void;
  signal?: AbortSignal;
  bgmPresetId?: string;
  bgmVolume?: number;
  customAudioFile?: File | null;
  overlayOptions?: VideoOverlayOptions;
}

// 여러 영상에서 추출된 극적 구간들을 순차적으로 잘라 16:9 유튜브 규격의 단일 영상으로 병합
export async function stitchHighlightedSegments({
  videos,
  allSegments,
  onProgress,
  signal,
  bgmPresetId,
  bgmVolume = 0.35,
  customAudioFile,
  overlayOptions,
}: StitchVideosParams): Promise<FinalVideoResult> {
  if (allSegments.length === 0) {
    throw new Error('이어붙일 하이라이트 구간이 없습니다.');
  }

  // 비디오 ID 매핑 테이블 구성
  const videoMap = new Map<string, VideoItem>();
  for (const v of videos) {
    videoMap.set(v.id, v);
  }

  // 1. 유튜브 최적화 16:9 표준 규격 (1280x720 HD) 고정
  const targetWidth = 1280;
  const targetHeight = 720;

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('캔버스 렌더링 컨텍스트를 생성할 수 없습니다.');
  }

  // 초기 캔버스 배경 설정
  ctx.fillStyle = '#080c14';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // 오디오 컨텍스트 및 목적지 스트림 생성 (가능한 경우)
  let audioCtx: AudioContext | null = null;
  let audioDest: MediaStreamAudioDestinationNode | null = null;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      audioDest = audioCtx.createMediaStreamDestination();
    }
  } catch (e) {
    console.warn('[VideoStitcher] AudioContext 초기화 실패 (무음 처리):', e);
  }

  // 30fps 비디오 스트림 캡처
  const canvasStream = canvas.captureStream(30);
  if (audioDest && audioDest.stream.getAudioTracks().length > 0) {
    canvasStream.addTrack(audioDest.stream.getAudioTracks()[0]);
  }

  // MediaRecorder 지원 코덱 선택
  let mimeType = 'video/webm;codecs=vp8,opus';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm;codecs=vp9';
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm';
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = '';
  }

  const chunks: Blob[] = [];
  const recorderOptions: MediaRecorderOptions = {
    videoBitsPerSecond: 2_800_000, // 고화질 2.8Mbps
  };
  if (mimeType) {
    recorderOptions.mimeType = mimeType;
  }

  const recorder = new MediaRecorder(canvasStream, recorderOptions);
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  const totalSegmentsDuration = allSegments.reduce((sum, s) => sum + s.duration, 0);
  let recordedDurationSoFar = 0;

  // 워커 비디오 엘리먼트 준비
  const videoElem = document.createElement('video');
  videoElem.muted = true; // 브라우저 자동재생 정책 방어
  videoElem.volume = 0;
  videoElem.playsInline = true;

  // 비디오 원본 오디오 소스 연결
  if (audioCtx && audioDest) {
    try {
      const audioSourceNode = audioCtx.createMediaElementSource(videoElem);
      audioSourceNode.connect(audioDest);
    } catch (e) {
      console.warn('[VideoStitcher] AudioElementSource 연결 실패 (무음 처리):', e);
    }
  }

  let recorderStarted = false;
  let bgmController: { stop: () => void } | null = null;

  // BGM 처리: 사용자 업로드 파일 우선, 없으면 신디사이저 프리셋 연결
  if (customAudioFile && audioCtx && audioDest) {
    try {
      const arrayBuffer = await customAudioFile.arrayBuffer();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const customSourceNode = audioCtx.createBufferSource();
      customSourceNode.buffer = decodedBuffer;
      customSourceNode.loop = true;

      const gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, bgmVolume)), audioCtx.currentTime);

      customSourceNode.connect(gainNode);
      gainNode.connect(audioDest);
      customSourceNode.start(0);

      bgmController = {
        stop: () => {
          try {
            customSourceNode.stop();
            customSourceNode.disconnect();
          } catch {}
        },
      };
    } catch (err) {
      console.warn('[VideoStitcher] 커스텀 BGM 디코딩 실패, 기본 신스 폴백:', err);
    }
  } else if (bgmPresetId && bgmPresetId !== 'none' && audioCtx && audioDest) {
    try {
      bgmController = playBgmSynthLoop(audioCtx, audioDest, bgmPresetId, bgmVolume);
    } catch (e) {
      console.warn('[VideoStitcher] BGM 신스 연결 건너뜀:', e);
    }
  }

  // 16:9 캔버스(1280x720)에 원본 영상을 소스 영역 스마트 크롭으로 100% 꽉 채워 그림
  const drawCoverFrame = (vItem?: VideoItem, segment?: HighlightSegment) => {
    const vW = videoElem.videoWidth || vItem?.width || targetWidth;
    const vH = videoElem.videoHeight || vItem?.height || targetHeight;

    const targetAspect = targetWidth / targetHeight; // 1280 / 720 = 16:9 (~1.777778)
    const srcAspect = vW / vH;

    let sx = 0;
    let sy = 0;
    let sWidth = vW;
    let sHeight = vH;

    if (srcAspect > targetAspect) {
      // 1) 16:9보다 좌우로 더 넓은 영상 (예: 21:9 시네마틱 뷰, 1920x800)
      sHeight = vH;
      sWidth = Math.round(vH * targetAspect);
      sx = Math.round((vW - sWidth) / 2);
      sy = 0;
    } else if (srcAspect < targetAspect) {
      // 2) 16:9보다 세로로 길쭉한 영상 (예: 9:16 쇼츠/릴스, 4:3)
      sWidth = vW;
      sHeight = Math.round(vW / targetAspect);
      sx = 0;

      if (vH > vW) {
        // 세로 영상(9:16)은 인물의 얼굴과 상체가 주로 위쪽에 위치하므로
        // 사용자가 지정한 크롭 상단 편향 반영 (기본값: 0.25)
        const excessHeight = vH - sHeight;
        const ratio = segment?.cropOffsetYRatio ?? 0.25;
        sy = Math.round(excessHeight * ratio);
      } else {
        // 4:3 등 일반 가로 영상은 상하 중앙 정렬
        sy = Math.round((vH - sHeight) / 2);
      }
    }

    // 소스 좌표 범위 안전 클램핑
    sx = Math.max(0, Math.min(sx, Math.max(0, vW - sWidth)));
    sy = Math.max(0, Math.min(sy, Math.max(0, vH - sHeight)));

    // 대상 캔버스는 항상 (0, 0, 1280, 720) 전체를 정확하게 채움
    ctx.drawImage(videoElem, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
  };

  // 자막 및 브랜딩 오버레이 (제목, 채널, 씬별 하단 날짜+제목 자막) 그리기
  const drawOverlays = (currentSegment?: HighlightSegment) => {
    if (!overlayOptions) return;

    // 1. 좌측 상단 영상 제목
    if (overlayOptions.showTitle && overlayOptions.titleText) {
      ctx.save();
      ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
      const text = overlayOptions.titleText;
      const metrics = ctx.measureText(text);
      const padX = 14;
      const boxW = metrics.width + padX * 2;
      const boxH = 38;
      const x = 32;
      const y = 28;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, boxW, boxH, 6);
      } else {
        ctx.rect(x, y, boxW, boxH);
      }
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x + padX, y + boxH / 2);
      ctx.restore();
    }

    // 2. 우측 상단 채널 이름
    if (overlayOptions.showChannel && overlayOptions.channelText) {
      ctx.save();
      ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(overlayOptions.channelText, targetWidth - 32, 47);
      ctx.restore();
    }

    // 3. 하단 중앙 씬별 날짜 + 씬 제목 자막
    if (overlayOptions.showSubtitle) {
      const datePart = currentSegment?.subtitleDate || overlayOptions.subtitleDateText || '';
      const titlePart = currentSegment?.subtitleTitle || currentSegment?.reason || '';
      const locPart = currentSegment?.locationName || overlayOptions.subtitleLocationText || '';
      
      const subParts = [datePart, titlePart, locPart ? `• ${locPart}` : ''].filter(Boolean);
      const subText = subParts.join(' ').trim();

      if (subText) {
        ctx.save();
        ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
        const metrics = ctx.measureText(subText);
        const padX = 20;
        const boxW = metrics.width + padX * 2;
        const boxH = 46;
        const x = (targetWidth - boxW) / 2;
        const y = targetHeight - 76;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, y, boxW, boxH, 8);
        } else {
          ctx.rect(x, y, boxW, boxH);
        }
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(subText, targetWidth / 2, y + boxH / 2);
        ctx.restore();
      }
    }
  };

  // 인트로/아웃트로 사용자 동영상 클립 합성 렌더링
  const renderCustomVideoClip = async (clipFile: File, label: string) => {
    onProgress?.(label === '시작 인트로' ? 1 : 98, `${label} 영상 로드 및 합성 중...`);
    const blobUrl = URL.createObjectURL(clipFile);
    try {
      videoElem.src = blobUrl;
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`${label} 비디오 로드 시간 초과`)), 10000);
        videoElem.onloadedmetadata = () => {
          clearTimeout(timeout);
          resolve();
        };
        videoElem.onerror = () => {
          clearTimeout(timeout);
          reject(new Error(`${label} 비디오 로드 실패`));
        };
      });

      videoElem.currentTime = 0;
      await videoElem.play();

      if (!recorderStarted) {
        recorder.start(100);
        recorderStarted = true;
      } else if (recorder.state === 'paused') {
        recorder.resume();
      }

      await new Promise<void>((resolve) => {
        let animId: number;
        const renderLoop = () => {
          if (videoElem.ended || videoElem.paused) {
            cancelAnimationFrame(animId);
            resolve();
            return;
          }
          drawCoverFrame();
          animId = requestAnimationFrame(renderLoop);
        };
        videoElem.onended = () => {
          cancelAnimationFrame(animId);
          resolve();
        };
        animId = requestAnimationFrame(renderLoop);
      });

      if (recorder.state === 'recording') {
        recorder.pause();
      }
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  };

  // 인트로 시퀀스 렌더링 (약 1.6초)
  const renderIntroSequence = async () => {
    if (!overlayOptions?.showIntro) return;
    onProgress?.(1, '시작 인트로 타이틀 시퀀스 생성 중...');

    const introFrames = 48; // 30fps 기준 약 1.6초
    if (!recorderStarted) {
      recorder.start(100);
      recorderStarted = true;
    } else if (recorder.state === 'paused') {
      recorder.resume();
    }

    for (let f = 0; f < introFrames; f++) {
      if (signal?.aborted) throw new Error('작업 취소');

      const progress = f / introFrames;
      const alpha = progress < 0.25 ? progress / 0.25 : progress > 0.8 ? (1 - progress) / 0.2 : 1.0;

      ctx.fillStyle = '#080c14';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      const grad = ctx.createRadialGradient(
        targetWidth / 2, targetHeight / 2, 30,
        targetWidth / 2, targetHeight / 2, 450
      );
      grad.addColorStop(0, `rgba(49, 130, 246, ${0.28 * alpha})`);
      grad.addColorStop(1, 'rgba(8, 12, 20, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

      const title = overlayOptions.titleText || '우리들의 소중한 순간';
      ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 12;
      ctx.fillText(title, targetWidth / 2, targetHeight / 2 - 20);

      const sub = [overlayOptions.subtitleDateText, overlayOptions.subtitleLocationText, overlayOptions.channelText].filter(Boolean).join(' • ');
      if (sub) {
        ctx.font = '600 19px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
        ctx.fillStyle = '#93c5fd';
        ctx.fillText(sub, targetWidth / 2, targetHeight / 2 + 30);
      }

      ctx.restore();
      await new Promise((r) => setTimeout(r, 33));
    }
  };

  // 아웃트로 시퀀스 렌더링 (약 1.8초)
  const renderOutroSequence = async () => {
    if (!overlayOptions?.showOutro) return;
    onProgress?.(98, '마무리 아웃트로 엔드 시퀀스 생성 중...');

    const outroFrames = 54; // 약 1.8초
    if (recorder.state === 'paused') {
      recorder.resume();
    }

    for (let f = 0; f < outroFrames; f++) {
      if (signal?.aborted) throw new Error('작업 취소');

      const progress = f / outroFrames;
      const alpha = progress < 0.2 ? progress / 0.2 : progress > 0.85 ? (1 - progress) / 0.15 : 1.0;

      ctx.fillStyle = '#080c14';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

      ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('시청해 주셔서 감사합니다', targetWidth / 2, targetHeight / 2 - 16);

      if (overlayOptions.channelText) {
        ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Pretendard Variable", sans-serif';
        ctx.fillStyle = '#3182f6';
        ctx.fillText(overlayOptions.channelText, targetWidth / 2, targetHeight / 2 + 28);
      }

      ctx.restore();
      await new Promise((r) => setTimeout(r, 33));
    }
  };

  try {
    // 0. 인트로 렌더링 (옵션 활성화 시: 영상 파일 우선, 없으면 타이틀 시퀀스)
    if (overlayOptions?.showIntro) {
      if (overlayOptions.introVideoFile) {
        await renderCustomVideoClip(overlayOptions.introVideoFile, '시작 인트로');
      } else {
        await renderIntroSequence();
      }
    }

    // 구간별 비디오 순차 병합
    for (let i = 0; i < allSegments.length; i++) {
      if (signal?.aborted) {
        throw new Error('사용자에 의해 작업이 취소되었습니다.');
      }

      const segment = allSegments[i];
      const videoItem = videoMap.get(segment.sourceVideoId);
      if (!videoItem) continue;

      const clipMessage = `구간 ${i + 1}/${allSegments.length} 병합 중: [${videoItem.name}] (${segment.start.toFixed(1)}s ~ ${segment.end.toFixed(1)}s)`;
      onProgress?.(
        Math.min(96, Math.round((recordedDurationSoFar / (totalSegmentsDuration || 1)) * 100)),
        clipMessage
      );

      // 1. 영상 소스 교체 및 로드
      if (videoElem.src !== videoItem.url) {
        videoElem.src = videoItem.url;
        await new Promise<void>((resolve, reject) => {
          let timeout: ReturnType<typeof setTimeout> | null = setTimeout(() => {
            reject(new Error(`비디오 로드 시간 초과: ${videoItem.name}`));
          }, 8000);

          videoElem.onloadedmetadata = () => {
            if (timeout) clearTimeout(timeout);
            resolve();
          };
          videoElem.onerror = () => {
            if (timeout) clearTimeout(timeout);
            reject(new Error(`비디오 로드 실패: ${videoItem.name}`));
          };
        });
      }

      // 2. 지정된 구간 시작 위치로 시크 대기
      if (Math.abs(videoElem.currentTime - segment.start) > 0.05) {
        await new Promise<void>((resolve) => {
          let timeout: ReturnType<typeof setTimeout> | null = setTimeout(() => {
            resolve();
          }, 1500);

          const onSeeked = () => {
            if (timeout) clearTimeout(timeout);
            videoElem.removeEventListener('seeked', onSeeked);
            resolve();
          };
          videoElem.addEventListener('seeked', onSeeked);
          videoElem.currentTime = segment.start;
        });
      }

      // 시크 완료 후 첫 프레임을 캔버스에 미리 그려놓기
      drawCoverFrame(videoItem, segment);
      drawOverlays(segment);

      // 오디오 컨텍스트 재개
      if (audioCtx && audioCtx.state === 'suspended') {
        try {
          await audioCtx.resume();
        } catch {}
      }

      // 3. 비디오 재생 시작
      try {
        await videoElem.play();
      } catch (playErr) {
        console.warn('[VideoStitcher] 비디오 재생 재시도:', playErr);
        videoElem.muted = true;
        await videoElem.play();
      }

      // ★ [핵심 버그 수정]: 비디오가 실제로 시작 시간을 넘어서 재생 중인지 검증!
      // 디코더가 멈춰있는 동안 녹화기가 켜져서 정지 프레임이 대량으로 찍히는 것을 원천 차단
      await new Promise<void>((resolve) => {
        let done = false;
        const checkAdvance = () => {
          if (!done && videoElem.currentTime > segment.start + 0.01) {
            done = true;
            videoElem.removeEventListener('timeupdate', checkAdvance);
            resolve();
          }
        };
        videoElem.addEventListener('timeupdate', checkAdvance);
        setTimeout(() => {
          if (!done) {
            done = true;
            videoElem.removeEventListener('timeupdate', checkAdvance);
            resolve();
          }
        }, 800);
      });

      // 검증된 후에 레코더 시작/재개!
      if (!recorderStarted) {
        recorder.start(100);
        recorderStarted = true;
      } else if (recorder.state === 'paused') {
        recorder.resume();
      }

      // 4. 구간 재생 및 실시간 캔버스 렌더링 루프
      await new Promise<void>((resolve, reject) => {
        let animId: number;
        const segmentStartTime = performance.now();
        const maxRealDurationMs = (segment.duration + 0.8) * 1000;

        const checkTime = () => {
          if (signal?.aborted) {
            cancelAnimationFrame(animId);
            videoElem.pause();
            if (recorder.state === 'recording') recorder.pause();
            reject(new Error('작업 취소'));
            return;
          }

          // 16:9 프레임 그리기 & 씬별 자막/오버레이 합성
          drawCoverFrame(videoItem, segment);
          drawOverlays(segment);

          // 진행률 실시간 반영
          const clipElapsed = Math.max(0, videoElem.currentTime - segment.start);
          const currentTotal = recordedDurationSoFar + clipElapsed;
          const pct = Math.min(97, Math.round((currentTotal / (totalSegmentsDuration || 1)) * 100));
          onProgress?.(pct, clipMessage);

          const realElapsedMs = performance.now() - segmentStartTime;

          // 목표 종료 시간에 도달했거나 영상이 끝난 경우 즉시 일시정지
          if (
            videoElem.currentTime >= segment.end - 0.04 ||
            videoElem.ended ||
            realElapsedMs >= maxRealDurationMs
          ) {
            cancelAnimationFrame(animId);
            videoElem.pause();
            // 다음 구간으로 넘어가기 전 레코더를 즉시 일시정지하여 정지 프레임 녹화 차단!
            if (recorder.state === 'recording') {
              recorder.pause();
            }
            recordedDurationSoFar += segment.duration;
            resolve();
          } else {
            animId = requestAnimationFrame(checkTime);
          }
        };

        animId = requestAnimationFrame(checkTime);
      });
    }

    // 마무리 아웃트로 렌더링 (옵션 활성화 시: 영상 파일 우선, 없으면 엔딩 시퀀스)
    if (overlayOptions?.showOutro) {
      if (overlayOptions.outroVideoFile) {
        await renderCustomVideoClip(overlayOptions.outroVideoFile, '종료 아웃트로');
      } else {
        await renderOutroSequence();
      }
    }

    onProgress?.(99, '16:9 고화질 하이라이트 영상 파일 생성 중...');

    // 레코더 중지 및 Blob 완성 대기
    const finalBlob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const resultBlob = new Blob(chunks, { type: mimeType || 'video/webm' });
        resolve(resultBlob);
      };
      if (recorder.state !== 'inactive') {
        recorder.stop();
      } else {
        resolve(new Blob(chunks, { type: mimeType || 'video/webm' }));
      }
    });

    const finalUrl = URL.createObjectURL(finalBlob);
    const originalTotalDuration = videos.reduce((sum, v) => sum + v.duration, 0);

    onProgress?.(100, '극적 하이라이트 영상이 완성되었습니다!');

    return {
      blob: finalBlob,
      url: finalUrl,
      duration: Math.round(totalSegmentsDuration * 10) / 10,
      segments: allSegments,
      originalTotalDuration: Math.round(originalTotalDuration * 10) / 10,
      fileSize: finalBlob.size,
    };
  } finally {
    try {
      if (bgmController) {
        bgmController.stop();
      }
      videoElem.pause();
      videoElem.src = '';
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close();
      }
    } catch {
      // ignore cleanup errors
    }
  }
}
