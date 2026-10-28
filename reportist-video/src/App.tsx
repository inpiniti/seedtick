// App.tsx - Reportist Video 메인 애플리케이션

import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { Header } from './components/header/Header.tsx';
import { DropZone } from './components/upload/DropZone.tsx';
import { VideoCard } from './components/upload/VideoCard.tsx';
import { ProgressPanel } from './components/processing/ProgressPanel.tsx';
import { ProStudioView } from './components/studio/ProStudioView.tsx';
import {
  fetchVideoCapableModels,
  analyzeVideoHighlights,
  FALLBACK_VIDEO_MODELS,
  DEFAULT_CONFIG,
} from './services/gatewayClient.ts';
import { extractVideoMetadata, extractVideoFramesForAnalysis } from './services/videoCompressor.ts';
import { stitchHighlightedSegments } from './services/videoStitcher.ts';
import type { FreeModelMeta, ReasoningEffortOption } from './types/gateway.ts';
import type {
  VideoItem,
  OverallStep,
  ProcessingProgress,
  FinalVideoResult,
  HighlightSegment,
} from './types/video.ts';
import { Play, Sparkles, AlertCircle } from 'lucide-react';

export function App() {
  // 1. 모델 상태
  const [models, setModels] = useState<FreeModelMeta[]>(FALLBACK_VIDEO_MODELS);
  const [selectedModel, setSelectedModel] = useState<string>('google/gemma-4-31b-it:free');
  const [selectedEffort, setSelectedEffort] = useState<ReasoningEffortOption>('high');
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(true);

  // 2. 비디오 목록 및 처리 상태
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [currentStep, setCurrentStep] = useState<OverallStep>('upload');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 3. 진행률 및 결과
  const [progress, setProgress] = useState<ProcessingProgress>({
    step: 'upload',
    currentPhase: 'extract',
    currentVideoIndex: 0,
    totalVideos: 0,
    progressPercent: 0,
    statusMessage: '',
  });
  const [finalResult, setFinalResult] = useState<FinalVideoResult | null>(null);

  // 취소용 AbortController
  const abortControllerRef = useRef<AbortController | null>(null);

  // 초기 모델 목록 로드
  useEffect(() => {
    let isMounted = true;
    async function loadModels() {
      setIsLoadingModels(true);
      try {
        const fetched = await fetchVideoCapableModels(DEFAULT_CONFIG);
        if (isMounted && fetched.length > 0) {
          setModels(fetched);
          // 기본 선택 모델 설정
          const defaultModel = fetched.find((m) => m.id.includes('gemma-4-31b')) || fetched[0];
          setSelectedModel(defaultModel.id);
          if (defaultModel.defaultEffort) {
            setSelectedEffort(defaultModel.defaultEffort as ReasoningEffortOption);
          }
        }
      } catch (err) {
        console.warn('모델 로드 실패:', err);
      } finally {
        if (isMounted) setIsLoadingModels(false);
      }
    }
    loadModels();
    return () => {
      isMounted = false;
    };
  }, []);

  // 파일 업로드 핸들러 (브라우저 로컬 메타데이터 추출)
  const handleFilesSelected = async (newFiles: File[]) => {
    setErrorMessage(null);
    for (const file of newFiles) {
      const videoId = `vid-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const blobUrl = URL.createObjectURL(file);

      // 기본 항목 추가
      const newItem: VideoItem = {
        id: videoId,
        file,
        url: blobUrl,
        name: file.name,
        sizeBytes: file.size,
        duration: 0,
        width: 0,
        height: 0,
        status: 'idle',
        segments: [],
      };

      setVideos((prev) => [...prev, newItem]);

      // 비동기 메타데이터 및 썸네일 추출
      extractVideoMetadata(file)
        .then((meta) => {
          setVideos((prev) =>
            prev.map((v) =>
              v.id === videoId
                ? {
                    ...v,
                    duration: meta.duration,
                    width: meta.width,
                    height: meta.height,
                    thumbnailUrl: meta.thumbnailUrl,
                  }
                : v
            )
          );
        })
        .catch((err) => {
          console.warn('메타데이터 추출 오류:', err);
        });
    }
  };

  // 비디오 순서 변경 및 삭제 핸들러
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setVideos((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      return next;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === videos.length - 1) return;
    setVideos((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      return next;
    });
  };

  const handleRemove = (id: string) => {
    setVideos((prev) => {
      const item = prev.find((v) => v.id === id);
      if (item) {
        URL.revokeObjectURL(item.url);
      }
      return prev.filter((v) => v.id !== id);
    });
  };

  // 4. 재병합 상태
  const [isReStitching, setIsReStitching] = useState<boolean>(false);

  // 하이라이트 생성 시작 (순차 압축 -> AI 분석 -> 컷 & 병합)
  const handleStartProcessing = async () => {
    if (videos.length === 0) return;

    setCurrentStep('processing');
    setErrorMessage(null);
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const totalVideos = videos.length;
    const updatedVideos = [...videos];
    const logs: string[] = [];

    const addLog = (msg: string) => {
      const time = new Date().toTimeString().slice(0, 8);
      const logEntry = `[${time}] ${msg}`;
      logs.push(logEntry);
      setProgress((prev) => ({
        ...prev,
        reasoningLogs: [...logs],
      }));
    };

    addLog(`🚀 AI 극적 장면 탐색 파이프라인 시작 (총 ${totalVideos}개 영상, 16:9 유튜브 규격)`);

    try {
      // 1. 영상별 순차 루프 (프레임 추출 & AI 분석)
      for (let i = 0; i < totalVideos; i++) {
        if (signal.aborted) throw new Error('작업이 취소되었습니다.');

        const currentVideo = updatedVideos[i];

        // 이미 분석된 구간이 있는 경우 중복 추출/추론 건너뛰기
        if (currentVideo.status === 'analyzed' && currentVideo.segments && currentVideo.segments.length > 0) {
          addLog(`⚡ [${currentVideo.name}] 기존 분석된 ${currentVideo.segments.length}개 극적 구간 재사용`);
          continue;
        }

        // 1-A. 브라우저 캔버스 주요 프레임 다중 이미지 추출
        setProgress({
          step: 'processing',
          currentPhase: 'extract',
          currentVideoIndex: i,
          totalVideos,
          progressPercent: Math.round(((i * 2) / (totalVideos * 2 + 1)) * 100),
          statusMessage: `${i + 1}/${totalVideos}번째 영상 [${currentVideo.name}] 주요 프레임 다중 이미지 추출 중...`,
          reasoningLogs: [...logs],
        });

        addLog(`📸 [${currentVideo.name}] (길이: ${currentVideo.duration.toFixed(1)}초) 14개 핵심 시각 프레임 추출 시작`);

        const frames = await extractVideoFramesForAnalysis(
          currentVideo.url,
          currentVideo.duration,
          (pct) => {
            if (signal.aborted) return;
            const overallPct = Math.round(((i * 2 + pct / 100) / (totalVideos * 2 + 1)) * 100);
            setProgress((prev) => ({
              ...prev,
              progressPercent: Math.min(99, overallPct),
            }));
          }
        );

        addLog(`🧠 [${currentVideo.name}] 프레임 추출 완료. AI 모델(${selectedModel.replace(':free', '')})로 시각 시퀀스 전달`);

        // 1-B. AI Gateway로 시각 프레임 분석 전송 (극적 구간 JSON 요청)
        setProgress({
          step: 'processing',
          currentPhase: 'analyze',
          currentVideoIndex: i,
          totalVideos,
          progressPercent: Math.round(((i * 2 + 1) / (totalVideos * 2 + 1)) * 100),
          statusMessage: `${i + 1}/${totalVideos}번째 영상 [${currentVideo.name}] AI 극적 장면 탐색 중...`,
          reasoningLogs: [...logs],
        });

        const segments = await analyzeVideoHighlights({
          frames,
          videoDuration: currentVideo.duration,
          videoId: currentVideo.id,
          videoName: currentVideo.name,
          model: selectedModel,
          reasoningEffort: selectedEffort,
          config: DEFAULT_CONFIG,
          signal,
        });

        currentVideo.segments = segments;
        currentVideo.status = 'analyzed';
        setVideos([...updatedVideos]);

        const segTotal = segments.reduce((sum, s) => sum + s.duration, 0);
        const savePct = Math.max(0, Math.round((1 - segTotal / (currentVideo.duration || 1)) * 100));
        addLog(`🎯 [${currentVideo.name}] ${segments.length}개 극적 구간 확정 (${currentVideo.duration.toFixed(1)}초 → ${segTotal.toFixed(1)}초, -${savePct}% 압축)`);
        segments.forEach((s, sIdx) => {
          addLog(`   ✨ #${sIdx + 1} [${s.start.toFixed(1)}s~${s.end.toFixed(1)}s] ${s.reason}`);
        });
      }

      // 2. 구간 컷 & 16:9 시네마틱 병합 단계
      const allSegments = updatedVideos.flatMap((v) => v.segments);
      if (allSegments.length === 0) {
        throw new Error('감지된 극적 하이라이트 구간이 없습니다.');
      }

      addLog(`✂️ 총 ${allSegments.length}개 구간을 16:9 유튜브 시네마틱 규격(1280x720)으로 무결점 병합 시작...`);

      setProgress({
        step: 'processing',
        currentPhase: 'stitch',
        currentVideoIndex: totalVideos - 1,
        totalVideos,
        progressPercent: 85,
        statusMessage: `총 ${allSegments.length}개 극적 구간을 16:9 유튜브 규격으로 병합하는 중...`,
        reasoningLogs: [...logs],
      });

      const result = await stitchHighlightedSegments({
        videos: updatedVideos,
        allSegments,
        onProgress: (pct, msg) => {
          if (signal.aborted) return;
          const overallPct = Math.round(85 + (pct / 100) * 14);
          setProgress((prev) => ({
            ...prev,
            progressPercent: Math.min(99, overallPct),
            statusMessage: msg,
          }));
        },
        signal,
      });

      addLog(`🎉 16:9 유튜브 하이라이트 영상 병합 완성! (총 ${result.duration.toFixed(1)}초, ${(result.fileSize / (1024 * 1024)).toFixed(1)}MB)`);

      setFinalResult(result);
      setCurrentStep('result');
    } catch (err: unknown) {
      if (signal.aborted) {
        console.info('사용자에 의해 작업이 취소되었습니다.');
        setCurrentStep('upload');
      } else {
        const msg = err instanceof Error ? err.message : '하이라이트 생성 중 오류가 발생했습니다.';
        console.error('처리 오류:', err);
        setErrorMessage(msg);
        setCurrentStep('upload');
      }
    }
  };

  // 사용자가 프로 스튜디오 타임라인에서 구간을 직접 수정/트리밍/BGM 변경했을 때 재렌더링
  const handleReStitch = async (
    updatedSegments: HighlightSegment[],
    bgmPresetId = 'acoustic',
    bgmVolume = 0.35
  ) => {
    if (updatedSegments.length === 0) return;
    setIsReStitching(true);
    setErrorMessage(null);

    try {
      const result = await stitchHighlightedSegments({
        videos,
        allSegments: updatedSegments,
        bgmPresetId,
        bgmVolume,
        onProgress: (pct, msg) => {
          console.info(`[ReStitch] ${pct}%: ${msg}`);
        },
      });

      // 기존 결과 URL 해제 후 새 결과 반영
      if (finalResult?.url) {
        URL.revokeObjectURL(finalResult.url);
      }
      setFinalResult(result);
    } catch (err) {
      console.error('구간 재병합 오류:', err);
      setErrorMessage(err instanceof Error ? err.message : '하이라이트 재병합에 실패했습니다.');
    } finally {
      setIsReStitching(false);
    }
  };

  // 취소 핸들러
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setCurrentStep('upload');
  };

  // 새로 만들기 리셋
  const handleReset = () => {
    if (finalResult?.url) {
      URL.revokeObjectURL(finalResult.url);
    }
    setFinalResult(null);
    setCurrentStep('upload');
  };

  return (
    <div className="app-container">
      {/* 상단 헤더 */}
      <Header
        models={models}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        selectedEffort={selectedEffort}
        onSelectEffort={setSelectedEffort}
        isLoadingModels={isLoadingModels}
      />

      <main className="main-content">
        {/* 오류 배너 */}
        {errorMessage && (
          <div className="flex items-center gap-2 p-3.5 mb-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1단계: 업로드 및 영상 목록 */}
        {currentStep === 'upload' && (
          <div>
            <div className="hero-section">
              <h1 className="hero-title">극적인 순간만 골라 하나의 영상으로</h1>
              <p className="hero-subtitle">
                여러 영상을 올리면 AI가 하이라이트 구간을 분석하고,
                브라우저에서 직접 이어붙여 완성된 영상을 만들어 드려요.
              </p>
            </div>

            {/* 드래그 앤 드롭 영역 */}
            <DropZone onFilesSelected={handleFilesSelected} />

            {/* 업로드된 비디오 목록 */}
            {videos.length > 0 && (
              <div>
                <div className="video-list-header">
                  <div className="video-list-title">
                    <span>업로드된 영상</span>
                    <span className="text-xs font-mono font-semibold bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full">
                      {videos.length}개
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    순서대로 이어붙여져요 (화살표로 순서 조절 가능)
                  </span>
                </div>

                <div className="video-grid">
                  {videos.map((video, idx) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      index={idx}
                      totalCount={videos.length}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>

                {/* 하단 실행 바 */}
                <div className="action-bottom-bar">
                  <div className="text-xs text-slate-500 font-mono">
                    총 재생 시간:{' '}
                    {Math.round(videos.reduce((acc, v) => acc + v.duration, 0))}초
                  </div>

                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleStartProcessing}
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    AI 하이라이트 영상 만들기
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2단계: 진행 상태 패널 */}
        {currentStep === 'processing' && (
          <ProgressPanel
            progress={progress}
            videos={videos}
            onCancel={handleCancel}
          />
        )}

        {/* 3단계: 프로 비디오 스튜디오 에디터 (Remotion / NLE 멀티트랙 타임라인, 오디오/BGM, 세부 인스펙터) */}
        {currentStep === 'result' && finalResult && (
          <ProStudioView
            result={finalResult}
            videos={videos}
            onReset={handleReset}
            onReStitch={handleReStitch}
            isReStitching={isReStitching}
          />
        )}
      </main>
    </div>
  );
}
export default App;
