// services/videoStitcher.ts - 브라우저 기반 극적 구간 컷 & 이어붙이기(Stitching) 엔진 (16:9 유튜브 규격 & 무결점 병합)

import type { FinalVideoResult, HighlightSegment, VideoItem } from '../types/video.ts';

export interface StitchVideosParams {
  videos: VideoItem[];
  allSegments: HighlightSegment[];
  onProgress?: (progressPercent: number, currentMessage: string) => void;
  signal?: AbortSignal;
}

// 여러 영상에서 추출된 극적 구간들을 순차적으로 잘라 16:9 유튜브 규격의 단일 영상으로 병합
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
  ctx.fillStyle = '#0f172a';
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
  videoElem.playsInline = true;
  videoElem.crossOrigin = 'anonymous';

  // 오디오 소스 연결
  if (audioCtx && audioDest) {
    try {
      const audioSourceNode = audioCtx.createMediaElementSource(videoElem);
      audioSourceNode.connect(audioDest);
    } catch (e) {
      console.warn('[VideoStitcher] AudioElementSource 연결 실패:', e);
    }
  }

  let recorderStarted = false;

  // 16:9 캔버스에 비디오 프레임을 스마트 커버 크롭(인물 상체/얼굴 포커스)하여 그리는 헬퍼
  const drawCoverFrame = () => {
    const srcW = videoElem.videoWidth || targetWidth;
    const srcH = videoElem.videoHeight || targetHeight;

    // 16:9 비율을 꽉 채우기 위한 스케일 계산 (검은 여백 제거)
    const scale = Math.max(targetWidth / srcW, targetHeight / srcH);
    const renderW = srcW * scale;
    const renderH = srcH * scale;

    const offsetX = (targetWidth - renderW) / 2;
    let offsetY = (targetHeight - renderH) / 2;

    // 세로 영상(9:16 등)인 경우 인물의 얼굴/상체 보호를 위해 상단 35% 포커스로 위아래 크롭
    if (srcH > srcW) {
      const excessHeight = renderH - targetHeight;
      offsetY = -excessHeight * 0.35;
    }

    ctx.drawImage(videoElem, 0, 0, srcW, srcH, offsetX, offsetY, renderW, renderH);
  };

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
      await new Promise<void>((resolve) => {
        let timeout: ReturnType<typeof setTimeout> | null = setTimeout(() => {
          resolve();
        }, 1500);

        videoElem.onseeked = () => {
          if (timeout) clearTimeout(timeout);
          resolve();
        };
        videoElem.currentTime = segment.start;
      });

      // 시크 완료 후 첫 프레임을 캔버스에 미리 그려놓기
      drawCoverFrame();

      // 오디오 컨텍스트 재개
      if (audioCtx && audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      // 3. 비디오 재생 시작
      await videoElem.play();

      // ★ [핵심 버그 수정]: 영상이 '실제로 재생을 시작한 순간'에만 레코더를 시작/재개!
      // 시크나 소스 로딩 중 발생하는 지연 시간이 녹화 영상에 멈춤 화면으로 뻥튀기되는 현상 완벽 방지
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
        const maxRealDurationMs = (segment.duration + 0.5) * 1000;

        const checkTime = () => {
          if (signal?.aborted) {
            cancelAnimationFrame(animId);
            videoElem.pause();
            if (recorder.state === 'recording') recorder.pause();
            reject(new Error('작업 취소'));
            return;
          }

          // 16:9 프레임 그리기
          drawCoverFrame();

          // 진행률 실시간 반영
          const clipElapsed = Math.max(0, videoElem.currentTime - segment.start);
          const currentTotal = recordedDurationSoFar + clipElapsed;
          const pct = Math.min(99, Math.round((currentTotal / (totalSegmentsDuration || 1)) * 100));
          onProgress?.(pct, clipMessage);

          const realElapsedMs = performance.now() - segmentStartTime;

          // 목표 종료 시간에 도달했거나 영상이 끝난 경우 즉시 일시정지
          if (
            videoElem.currentTime >= segment.end - 0.03 ||
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
