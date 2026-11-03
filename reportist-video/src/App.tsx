// App.tsx - Reportist Video 메인 애플리케이션 (i18n 다국어 지원)

import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { ProStudioView } from './components/studio/ProStudioView.tsx';
import {
  fetchVideoCapableModels,
  analyzeVideoHighlights,
  FALLBACK_VIDEO_MODELS,
  DEFAULT_CONFIG,
} from './services/gatewayClient.ts';
import { enrichModelMetrics, pickDefaultModel } from './services/modelMetrics.ts';
import { extractVideoMetadata, extractVideoFramesForAnalysis } from './services/videoCompressor.ts';
import { formatVideoDate, extractGpsFromVideoFile } from './services/videoMetadata.ts';
import { primeAudioContext, stitchHighlightedSegments } from './services/videoStitcher.ts';
import { captureVideoFrameAtTime, renderThumbnailArtwork } from './services/thumbnailGenerator.ts';
import type { FreeModelMeta, ReasoningEffortOption } from './types/gateway.ts';
import type {
  VideoItem,
  OverallStep,
  ProcessingProgress,
  FinalVideoResult,
  HighlightSegment,
  VideoOverlayOptions,
} from './types/video.ts';
import { AlertCircle } from 'lucide-react';
import { useI18n } from './i18n/index.tsx';

const INITIAL_VIDEO_MODELS = enrichModelMetrics(FALLBACK_VIDEO_MODELS);
const INITIAL_DEFAULT_MODEL = pickDefaultModel(INITIAL_VIDEO_MODELS);

export function App() {
  const { dict, locale, interpolate } = useI18n();

  // 1. 모델 상태
  const [models, setModels] = useState<FreeModelMeta[]>(INITIAL_VIDEO_MODELS);
  const [selectedModel, setSelectedModel] = useState<string>(
    INITIAL_DEFAULT_MODEL?.id ?? ''
  );
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
          const enriched = enrichModelMetrics(fetched);
          setModels(enriched);
          const defaultModel = pickDefaultModel(enriched);
          if (defaultModel) {
            setSelectedModel(defaultModel.id);
            if (defaultModel.defaultEffort) {
              setSelectedEffort(defaultModel.defaultEffort as ReasoningEffortOption);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load models:', err);
      } finally {
        if (isMounted) setIsLoadingModels(false);
      }
    }
    loadModels();
    return () => {
      isMounted = false;
    };
  }, []);

  // 파일 업로드 핸들러
  const handleFilesSelected = async (newFiles: File[]) => {
    setErrorMessage(null);
    for (const file of newFiles) {
      const videoId = `vid-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const blobUrl = URL.createObjectURL(file);

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

      // 메타데이터, 촬영일자, GPS 추출
      extractVideoMetadata(file)
        .then(async (meta) => {
          const { dateStr } = formatVideoDate(file);
          const gps = await extractGpsFromVideoFile(file);

          setVideos((prev) =>
            prev.map((v) =>
              v.id === videoId
                ? {
                    ...v,
                    duration: meta.duration,
                    width: meta.width,
                    height: meta.height,
                    thumbnailUrl: meta.thumbnailUrl,
                    metadataDate: dateStr,
                    latitude: gps?.latitude,
                    longitude: gps?.longitude,
                  }
                : v
            )
          );
        })
        .catch((err) => {
          console.warn('Metadata extraction error:', err);
        });
    }
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

  // 하이라이트 생성 시작
  const handleStartProcessing = async (
    overlayOpts?: VideoOverlayOptions,
    customAudio?: File | null,
    bgmPresetId = 'none',
    bgmVol = 0.35
  ) => {
    if (videos.length === 0) return;

    // iOS Safari는 사용자 제스처 안에서만 오디오를 잠금 해제할 수 있으므로
    // 병합 단계(AudioContext 사용) 전에 미리 준비해 둔다.
    primeAudioContext();

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

    let liveReasoning = '';
    let liveContent = '';
    let liveFlushTimer: number | null = null;

    const flushLiveStream = () => {
      if (liveFlushTimer !== null) {
        window.clearTimeout(liveFlushTimer);
        liveFlushTimer = null;
      }
      setProgress((prev) => ({
        ...prev,
        liveReasoning,
        liveContent,
      }));
    };

    const scheduleLiveStreamFlush = () => {
      if (liveFlushTimer !== null) return;
      liveFlushTimer = window.setTimeout(() => {
        liveFlushTimer = null;
        setProgress((prev) => ({
          ...prev,
          liveReasoning,
          liveContent,
        }));
      }, 100);
    };

    const resetLiveStream = () => {
      liveReasoning = '';
      liveContent = '';
      if (liveFlushTimer !== null) {
        window.clearTimeout(liveFlushTimer);
        liveFlushTimer = null;
      }
    };

    addLog(interpolate(dict.logs.pipelineStart, { count: totalVideos }));

    let aiDiscoveredTitle = '';
    let bestThumbVideoId = updatedVideos[0]?.id || '';
    let bestThumbTimestamp = 0;
    let bestThumbCropOffsetYRatio = 0.2;

    try {
      // 1. 영상별 순차 루프
      for (let i = 0; i < totalVideos; i++) {
        if (signal.aborted) throw new Error(dict.logs.cancelledByUser);

        const currentVideo = updatedVideos[i];

        if (currentVideo.status === 'analyzed' && currentVideo.segments && currentVideo.segments.length > 0) {
          addLog(interpolate(dict.logs.reusingSegments, { name: currentVideo.name, count: currentVideo.segments.length }));
          continue;
        }

        // 1-A. 주요 프레임 다중 이미지 추출
        resetLiveStream();
        setProgress({
          step: 'processing',
          currentPhase: 'extract',
          currentVideoIndex: i,
          totalVideos,
          progressPercent: Math.round(((i * 2) / (totalVideos * 2 + 1)) * 100),
          statusMessage: interpolate(dict.logs.statusExtracting, {
            index: i + 1,
            total: totalVideos,
            name: currentVideo.name,
          }),
          reasoningLogs: [...logs],
        });

        addLog(interpolate(dict.logs.extractingFrames, {
          name: currentVideo.name,
          duration: currentVideo.duration.toFixed(1),
          frames: 14,
        }));

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

        addLog(interpolate(dict.logs.framesExtracted, {
          name: currentVideo.name,
          model: selectedModel.replace(':free', ''),
        }));

        resetLiveStream();

        // 1-B. AI Gateway 다중 프레임 분석
        setProgress({
          step: 'processing',
          currentPhase: 'analyze',
          currentVideoIndex: i,
          totalVideos,
          progressPercent: Math.round(((i * 2 + 1) / (totalVideos * 2 + 1)) * 100),
          statusMessage: interpolate(dict.logs.statusAnalyzing, {
            index: i + 1,
            total: totalVideos,
            name: currentVideo.name,
          }),
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
          metadataDate: currentVideo.metadataDate,
          latitude: currentVideo.latitude,
          longitude: currentVideo.longitude,
          locale,
          onStreamOpen: () => {
            addLog(interpolate(dict.logs.streamConnected, { name: currentVideo.name }));
          },
          onReasoningDelta: (_chunk, fullText) => {
            if (!liveReasoning) {
              addLog(interpolate(dict.logs.reasoningStarted, { name: currentVideo.name }));
              setProgress((prev) => ({
                ...prev,
                statusMessage: interpolate(dict.logs.statusReasoning, {
                  index: i + 1,
                  total: totalVideos,
                  name: currentVideo.name,
                }),
              }));
            }
            liveReasoning = fullText;
            scheduleLiveStreamFlush();
          },
          onContentDelta: (_chunk, fullText) => {
            if (!liveContent) {
              addLog(interpolate(dict.logs.jsonStarted, { name: currentVideo.name }));
            }
            liveContent = fullText;
            scheduleLiveStreamFlush();
          },
          onFallback: (reason) => {
            console.warn(`[Video] Stream fallback (${currentVideo.name}):`, reason);
            addLog(interpolate(dict.logs.streamFallback, { name: currentVideo.name }));
          },
        });

        flushLiveStream();
        if (liveReasoning) {
          addLog(interpolate(dict.logs.reasoningComplete, {
            name: currentVideo.name,
            chars: liveReasoning.length.toLocaleString(),
          }));
        }

        currentVideo.segments = segments;
        currentVideo.status = 'analyzed';
        setVideos([...updatedVideos]);

        // AI 추천 타이틀 및 베스트 썸네일 정보 수집
        const segSuggestedTitle = (segments as any)?.suggestedTitle;
        const segThumbTime = (segments as any)?.bestThumbnailTimestamp;
        if (segSuggestedTitle && !aiDiscoveredTitle) {
          aiDiscoveredTitle = segSuggestedTitle;
        }
        if (typeof segThumbTime === 'number' && (!bestThumbTimestamp || i === 0)) {
          bestThumbTimestamp = segThumbTime;
          bestThumbVideoId = currentVideo.id;
          bestThumbCropOffsetYRatio = segments[0]?.cropOffsetYRatio ?? 0.2;
        }

        const segTotal = segments.reduce((sum, s) => sum + s.duration, 0);
        const savePct = Math.max(0, Math.round((1 - segTotal / (currentVideo.duration || 1)) * 100));
        addLog(interpolate(dict.logs.segmentsConfirmed, {
          name: currentVideo.name,
          count: segments.length,
          orig: currentVideo.duration.toFixed(1),
          seg: segTotal.toFixed(1),
          save: savePct,
        }));
        segments.forEach((s, sIdx) => {
          const cropName =
            s.cropOffsetYRatio && s.cropOffsetYRatio <= 0.25
              ? dict.logs.cropTopName
              : s.cropOffsetYRatio && s.cropOffsetYRatio <= 0.65
              ? dict.logs.cropCenterName
              : dict.logs.cropBottomName;
          addLog(`   ✨ #${sIdx + 1} [${s.start.toFixed(1)}s~${s.end.toFixed(1)}s] ${s.reason} (${cropName}${s.subtitleDate ? `, ${s.subtitleDate}` : ''})`);
        });
      }

      // 2. 구간 컷 & 16:9 병합 단계
      const allSegments = updatedVideos.flatMap((v) => v.segments);
      if (allSegments.length === 0) {
        throw new Error(dict.logs.noClimaxFound);
      }

      // AI가 추천한 제목이 있고, 사용자가 직접 수정한 제목이 없으면 자동 적용
      if (aiDiscoveredTitle) {
        if (!overlayOpts?.titleText || overlayOpts.titleText === dict.player.defaultTitleText) {
          if (overlayOpts) {
            overlayOpts.titleText = aiDiscoveredTitle;
            overlayOpts.showTitle = true;
          }
        }
      }

      addLog(interpolate(dict.logs.stitchingStart, { count: allSegments.length }));

      setProgress({
        step: 'processing',
        currentPhase: 'stitch',
        currentVideoIndex: totalVideos - 1,
        totalVideos,
        progressPercent: 85,
        statusMessage: interpolate(dict.logs.stitchingProgress, { count: allSegments.length }),
        reasoningLogs: [...logs],
      });

      const result = await stitchHighlightedSegments({
        videos: updatedVideos,
        allSegments,
        bgmPresetId,
        bgmVolume: bgmVol,
        customAudioFile: customAudio,
        overlayOptions: overlayOpts,
        onLog: addLog,
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

      // 3. 16:9 유튜브 고화질 썸네일 자동 생성
      addLog('✨ AI 추천 베스트 프레임으로 16:9 고화질 썸네일 생성 중...');
      let generatedThumbnailUrl: string | undefined = undefined;
      try {
        const thumbVideo =
          updatedVideos.find((v) => v.id === bestThumbVideoId) || updatedVideos[0];
        if (thumbVideo) {
          const targetTime =
            bestThumbTimestamp > 0
              ? bestThumbTimestamp
              : allSegments[0]
              ? allSegments[0].start + allSegments[0].duration * 0.35
              : 0;

          const bgCanvas = await captureVideoFrameAtTime(
            thumbVideo.url,
            targetTime,
            bestThumbCropOffsetYRatio
          );

          const finalTitle =
            overlayOpts?.titleText || aiDiscoveredTitle || dict.player.defaultTitleText;

          const thumbCanvas = renderThumbnailArtwork(bgCanvas, {
            titleText: finalTitle,
            channelText: overlayOpts?.channelText || dict.player.defaultChannelText,
            badgeText: '✨ AI 하이라이트',
            showTitle: true,
            showBadge: true,
            showChannel: Boolean(overlayOpts?.showChannel),
            stylePreset: 'youtube-bold',
          });

          generatedThumbnailUrl = thumbCanvas.toDataURL('image/jpeg', 0.95);
          addLog('🎉 16:9 유튜브 맞춤 썸네일 자동 완성!');
        }
      } catch (thumbErr) {
        console.warn('Thumbnail generation warning:', thumbErr);
      }

      result.thumbnailUrl = generatedThumbnailUrl;
      result.suggestedTitle = aiDiscoveredTitle;
      result.bestThumbnailTime = bestThumbTimestamp;
      result.bestSourceVideoId = bestThumbVideoId;

      addLog(interpolate(dict.logs.stitchingComplete, {
        duration: result.duration.toFixed(1),
        size: (result.fileSize / (1024 * 1024)).toFixed(1),
      }));

      setFinalResult(result);
      setCurrentStep('result');
    } catch (err: unknown) {
      if (liveFlushTimer !== null) {
        window.clearTimeout(liveFlushTimer);
        liveFlushTimer = null;
      }
      if (signal.aborted) {
        console.info('Processing cancelled by user.');
        setCurrentStep('upload');
      } else {
        const msg = err instanceof Error ? err.message : dict.logs.genericError;
        console.error('Processing error:', err);
        setErrorMessage(msg);
        setCurrentStep('upload');
      }
    }
  };

  // 재병합 핸들러
  const handleReStitch = async (
    updatedSegments: HighlightSegment[],
    bgmPresetId = 'none',
    bgmVolume = 0.35,
    customAudioFile?: File | null,
    overlayOptions?: VideoOverlayOptions
  ) => {
    if (updatedSegments.length === 0) return;

    // 재병합도 사용자 클릭(제스처) 안에서 오디오를 미리 잠금 해제한다.
    primeAudioContext();

    setIsReStitching(true);
    setErrorMessage(null);

    try {
      const result = await stitchHighlightedSegments({
        videos,
        allSegments: updatedSegments,
        bgmPresetId,
        bgmVolume,
        customAudioFile,
        overlayOptions,
        onLog: (msg) => console.info(`[ReStitch] ${msg}`),
        onProgress: (pct, msg) => {
          console.info(`[ReStitch] ${pct}%: ${msg}`);
        },
      });

      result.thumbnailUrl = finalResult?.thumbnailUrl;
      result.suggestedTitle = finalResult?.suggestedTitle;
      result.bestThumbnailTime = finalResult?.bestThumbnailTime;
      result.bestSourceVideoId = finalResult?.bestSourceVideoId;

      if (finalResult?.url) {
        URL.revokeObjectURL(finalResult.url);
      }
      setFinalResult(result);
    } catch (err) {
      console.error('Re-stitching error:', err);
      setErrorMessage(err instanceof Error ? err.message : dict.logs.reStitchError);
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
    <div className="toss-app-root">
      {errorMessage && (
        <div className="studio-error-banner">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="ml-auto text-slate-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      <ProStudioView
        result={finalResult}
        videos={videos}
        models={models}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
        selectedEffort={selectedEffort}
        onSelectEffort={setSelectedEffort}
        isLoadingModels={isLoadingModels}
        onFilesSelected={handleFilesSelected}
        onRemoveVideo={handleRemove}
        onStartAiAnalysis={handleStartProcessing}
        isProcessing={currentStep === 'processing'}
        progress={progress}
        onCancelProcessing={handleCancel}
        onReset={handleReset}
        onReStitch={handleReStitch}
        isReStitching={isReStitching}
      />
    </div>
  );
}

export default App;
