import type { FinalVideoResult, HighlightSegment, VideoItem } from '../types/video.ts';
import { playBgmSynthLoop } from './audioSynth.ts';

export interface StitchVideosParams {
  videos: VideoItem[];
  allSegments: HighlightSegment[];
  onProgress?: (progressPercent: number, currentMessage: string) => void;
  signal?: AbortSignal;
  bgmPresetId?: string;
  bgmVolume?: number;
}

// 여러 영상에서 추출된 극적 구간들을 순차적으로 잘라 16:9 유튜브 규격의 단일 영상으로 병합
export async function stitchHighlightedSegments({
  videos,
  allSegments,
  onProgress,
  signal,
  bgmPresetId,
  bgmVolume = 0.35,
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
  videoElem.muted = true; // 브라우저 자동재생 정책 방어 (사용자 제스처 만료 시에도 항상 재생 허용)
  videoElem.volume = 0;
  videoElem.playsInline = true;

  // 오디오 소스 연결 (지원되는 경우)
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
  if (bgmPresetId && bgmPresetId !== 'none' && audioCtx && audioDest) {
    try {
      bgmController = playBgmSynthLoop(audioCtx, audioDest, bgmPresetId, bgmVolume);
    } catch (e) {
      console.warn('[VideoStitcher] BGM 신스 연결 건너뜀:', e);
    }
  }

  // 16:9 캔버스(1280x720)에 원본 영상을 소스 영역 스마트 크롭으로 100% 꽉 채워 그림
  // (음수 대상 좌표나 우측 검은 여백 버그를 원천 방지하고 정중앙/인물 상반신 완벽 정렬)
  const drawCoverFrame = (vItem?: VideoItem) => {
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
      // 높이를 꽉 채우고, 좌우 초과 영역을 중앙에서 균등하게 잘라냄
      sHeight = vH;
      sWidth = Math.round(vH * targetAspect);
      sx = Math.round((vW - sWidth) / 2);
      sy = 0;
    } else if (srcAspect < targetAspect) {
      // 2) 16:9보다 세로로 길쭉한 영상 (예: 9:16 쇼츠/릴스, 4:3)
      // 너비를 꽉 채우고, 상하 초과 영역을 잘라냄
      sWidth = vW;
      sHeight = Math.round(vW / targetAspect);
      sx = 0;

      if (vH > vW) {
        // 세로 영상(9:16)은 인물의 얼굴과 상체가 주로 위쪽에 위치하므로
        // 상단 25% 지점 중심 스마트 편향 크롭 (인물 머리 잘림 방지)
        const excessHeight = vH - sHeight;
        sy = Math.round(excessHeight * 0.25);
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
      if (Math.abs(videoElem.currentTime - segment.start) > 0.05) {
        await new Promise<void>((resolve) => {
          let timeout: ReturnType<typeof setTimeout> | null = setTimeout(() => {
            resolve();
          }, 1200);

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
      drawCoverFrame(videoItem);

      // 오디오 컨텍스트 재개 (실패하더라도 전체 영상 병합이 중단되지 않도록 보호)
      if (audioCtx && audioCtx.state === 'suspended') {
        try {
          await audioCtx.resume();
        } catch {
          // 브라우저 자동재생 제약 시 조용히 통과
        }
      }

      // 3. 비디오 재생 시작 (무음 강제로 언제나 안전하게 재생 보장)
      try {
        await videoElem.play();
      } catch (playErr) {
        console.warn('[VideoStitcher] 비디오 재생 재시도:', playErr);
        videoElem.muted = true;
        await videoElem.play();
      }

      // ★ [핵심 버그 수정]: 영상이 '실제로 재생을 시작한 순간'에만 레코더를 시작/재개!
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

          // 16:9 프레임 그리기 (소스 스마트 크롭)
          drawCoverFrame(videoItem);

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
