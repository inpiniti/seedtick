// services/videoCompressor.ts - 브라우저 기반 초경량 비디오 압축 및 메타데이터 추출 엔진

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  thumbnailUrl: string;
}

// 비디오 파일로부터 재생 시간, 해상도, 대표 썸네일 추출
export async function extractVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    video.onloadedmetadata = () => {
      const duration = video.duration || 1;
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 360;

      // 썸네일을 위해 0.5초 또는 10% 지점으로 이동
      const seekTime = Math.min(1.0, duration * 0.1);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        const maxThumbWidth = 320;
        const scale = Math.min(1, maxThumbWidth / (video.videoWidth || 640));
        canvas.width = Math.round((video.videoWidth || 640) * scale);
        canvas.height = Math.round((video.videoHeight || 360) * scale);

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7);
          URL.revokeObjectURL(objectUrl);
          resolve({
            duration: video.duration || 1,
            width: video.videoWidth || 640,
            height: video.videoHeight || 360,
            thumbnailUrl,
          });
          return;
        }
      } catch (err) {
        console.warn('[VideoCompressor] 썸네일 생성 실패:', err);
      }

      URL.revokeObjectURL(objectUrl);
      resolve({
        duration: video.duration || 1,
        width: video.videoWidth || 640,
        height: video.videoHeight || 360,
        thumbnailUrl: '',
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('비디오 메타데이터를 읽어올 수 없습니다. 지원하는 영상 형식인지 확인해 주세요.'));
    };
  });
}

// AI Gateway 전송(Vercel 4.5MB 제한)을 위한 고속 브라우저 캔버스 리샘플링 압축
export async function compressVideoForAnalysis(
  videoUrl: string,
  totalDuration: number,
  onProgress?: (progressPercent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    video.onloadedmetadata = () => {
      try {
        // AI 분석에 최적화된 저해상도 설정 (너비 420px, 종횡비 유지)
        const targetWidth = 420;
        const aspectRatio = (video.videoHeight || 360) / (video.videoWidth || 640);
        const targetHeight = Math.round((targetWidth * aspectRatio) / 2) * 2; // 2의 배수

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('캔버스 컨텍스트를 생성할 수 없습니다.');
        }

        // 10fps 스트림 캡처
        const stream = canvas.captureStream(10);

        // 지원 코덱 확인 (webm vp8 / mp4)
        let mimeType = 'video/webm;codecs=vp8';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = '';
        }

        const recorderOptions: MediaRecorderOptions = {
          videoBitsPerSecond: 350_000, // 약 350kbps (수 분 영상도 2~3MB 이내)
        };
        if (mimeType) {
          recorderOptions.mimeType = mimeType;
        }

        const recorder = new MediaRecorder(stream, recorderOptions);
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        recorder.onstop = () => {
          const compressedBlob = new Blob(chunks, { type: mimeType || 'video/webm' });
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              resolve(reader.result);
            } else {
              reject(new Error('압축된 비디오 변환 실패'));
            }
          };
          reader.onerror = () => reject(new Error('파일 읽기 실패'));
          reader.readAsDataURL(compressedBlob);
        };

        // 빠른 압축을 위해 2배속 재생
        video.playbackRate = 2.0;

        let animationFrameId: number;
        const renderLoop = () => {
          if (video.paused || video.ended) return;
          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

          if (onProgress && totalDuration > 0) {
            const current = video.currentTime;
            const percent = Math.min(100, Math.round((current / totalDuration) * 100));
            onProgress(percent);
          }

          animationFrameId = requestAnimationFrame(renderLoop);
        };

        video.onended = () => {
          cancelAnimationFrame(animationFrameId);
          if (recorder.state === 'recording') {
            recorder.stop();
          }
        };

        video.onerror = () => {
          cancelAnimationFrame(animationFrameId);
          if (recorder.state === 'recording') recorder.stop();
          reject(new Error('비디오 압축 렌더링 중 오류가 발생했습니다.'));
        };

        recorder.start(200);
        video.play().then(() => {
          renderLoop();
        }).catch((err) => {
          reject(err);
        });

      } catch (err) {
        reject(err);
      }
    };

    video.onerror = () => {
      reject(new Error('압축할 비디오를 로드할 수 없습니다.'));
    };
  });
}
