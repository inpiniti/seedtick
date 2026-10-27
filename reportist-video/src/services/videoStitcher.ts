// services/videoStitcher.ts - 브라우저 기반 극적 구간 컷 & 이어붙이기(Stitching) 엔진

import type { FinalVideoResult, HighlightSegment, VideoItem } from '../types/video.ts';

export interface StitchVideosParams {
  videos: VideoItem[];
  allSegments: HighlightSegment[];
  onProgress?: (progressPercent: number, currentMessage: string) => void;
  signal?: AbortSignal;
}

// 여러 영상에서 추출된 극적 구간들을 순차적으로 잘라 하나의 단일 영상으로 병합
export async function stitchHighlightedSegments({
  videos,
  allSegments,
  onProgress,
  signal,
}: StitchVideosParams): Promise<FinalVideoResult> {
  if (allSegments.length === 0) {
    throw new Error('이어붙일 하이라이트 구간이 없습니다.');
  }

  // 비디오 ID 매핑 테이블 구성
  const videoMap = new Map<string, VideoItem>();
  for (const v of videos) {
    videoMap.set(v.id, v);
  }

  // 캔버스 크기 결정 (첫 번째 유효 비디오 기준 최대 1080p 맞춤)
  const firstVideo = videos[0];
  const maxWidth = 1280;
  const baseAspect = (firstVideo?.height || 720) / (firstVideo?.width || 1280);
  const targetWidth = Math.min(maxWidth, firstVideo?.width || 1280);
  const targetHeight = Math.round((targetWidth * baseAspect) / 2) * 2;

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('캔버스 렌더링 컨텍스트를 생성할 수 없습니다.');
  }

  // 오디오 컨텍스트 및 목적지 스트림 생성 (가능한 경우)
  let audioCtx: AudioContext | null = null;
  let audioDest: MediaStreamAudioDestinationNode | null = null;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

  // MediaRecorder 지원 타입 선택
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
    videoBitsPerSecond: 2_500_000, // 고화질 2.5Mbps
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

  // 녹화 시작
  recorder.start(250);

  // 워커 비디오 엘리먼트 준비
  const videoElem = document.createElement('video');
  videoElem.muted = true; // 브라우저 자동재생 정책 방어
  videoElem.playsInline = true;
  videoElem.crossOrigin = 'anonymous';

  // 오디오 소스 연결
  let audioSourceNode: MediaElementAudioSourceNode | null = null;
  if (audioCtx && audioDest) {
    try {
      audioSourceNode = audioCtx.createMediaElementSource(videoElem);
      audioSourceNode.connect(audioDest);
    } catch (e) {
      console.warn('[VideoStitcher] AudioElementSource 연결 실패:', e);
    }
  }

  try {
    for (let i = 0; i < allSegments.length; i++) {
      if (signal?.aborted) {
        throw new Error('사용자에 의해 작업이 취소되었습니다.');
      }

      const segment = allSegments[i];
      const videoItem = videoMap.get(segment.sourceVideoId);
      if (!videoItem) continue;

      const clipMessage = `구간 ${i + 1}/${allSegments.length} 병합 중: [${videoItem.name}] (${segment.start.toFixed(1)}s ~ ${segment.end.toFixed(1)}s)`;
      onProgress?.(
        Math.min(99, Math.round((recordedDurationSoFar / (totalSegmentsDuration || 1)) * 100)),
        clipMessage
      );

      // 비디오 소스 교체 및 시작 위치로 시크
      if (videoElem.src !== videoItem.url) {
        videoElem.src = videoItem.url;
        await new Promise<void>((resolve, reject) => {
          videoElem.onloadedmetadata = () => resolve();
          videoElem.onerror = () => reject(new Error(`비디오 로드 실패: ${videoItem.name}`));
        });
      }

      // 지정된 구간 시작 위치로 seek
      videoElem.currentTime = segment.start;
      await new Promise<void>((resolve) => {
        videoElem.onseeked = () => resolve();
      });

      // 오디오 컨텍스트 재개
      if (audioCtx && audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      // 재생 및 캔버스 드로잉
      await videoElem.play();

      await new Promise<void>((resolve, reject) => {
        let animId: number;

        const checkTime = () => {
          if (signal?.aborted) {
            cancelAnimationFrame(animId);
            videoElem.pause();
            reject(new Error('작업 취소'));
            return;
          }

          // 캔버스에 프레임 그리기 (레터박스 유지)
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, targetWidth, targetHeight);

          const hRatio = targetWidth / (videoElem.videoWidth || targetWidth);
          const vRatio = targetHeight / (videoElem.videoHeight || targetHeight);
          const ratio = Math.min(hRatio, vRatio);
          const centerShiftX = (targetWidth - (videoElem.videoWidth || targetWidth) * ratio) / 2;
          const centerShiftY = (targetHeight - (videoElem.videoHeight || targetHeight) * ratio) / 2;

          ctx.drawImage(
            videoElem,
            0,
            0,
            videoElem.videoWidth,
            videoElem.videoHeight,
            centerShiftX,
            centerShiftY,
            videoElem.videoWidth * ratio,
            videoElem.videoHeight * ratio
          );

          // 진행률 실시간 반영
          const clipElapsed = Math.max(0, videoElem.currentTime - segment.start);
          const currentTotal = recordedDurationSoFar + clipElapsed;
          const pct = Math.min(99, Math.round((currentTotal / (totalSegmentsDuration || 1)) * 100));
          onProgress?.(pct, clipMessage);

          if (videoElem.currentTime >= segment.end || videoElem.ended) {
            cancelAnimationFrame(animId);
            videoElem.pause();
            recordedDurationSoFar += segment.duration;
            resolve();
          } else {
            animId = requestAnimationFrame(checkTime);
          }
        };

        animId = requestAnimationFrame(checkTime);
      });
    }

    onProgress?.(99, '최종 하이라이트 영상 파일 생성 중...');

    // 레코더 중지 및 Blob 완성 대기
    const finalBlob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const resultBlob = new Blob(chunks, { type: mimeType || 'video/webm' });
        resolve(resultBlob);
      };
      recorder.stop();
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
