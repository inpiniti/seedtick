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
import { extractVideoMetadata as extractVideoVisualDimensions, extractVideoFramesForAnalysis } from './services/videoCompressor.ts';
import {
  extractVideoMetadata as extractMediaMetadata,
  formatVideoDate,
  extractGpsFromVideoFile,
} from './services/videoMetadata.ts';
import { primeAudioContext, stitchHighlightedSegments } from './services/videoStitcher.ts';
import { captureVideoFrameAtTime, createCanvasFromImageDataUrl, renderThumbnailArtwork } from './services/thumbnailGenerator.ts';
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

      // 메타데이터(실제 촬영일자, 타임스탬프, GPS 좌표, 역지오코딩 장소명) 및 영상 해상도/썸네일 동시 추출
      Promise.all([
        extractVideoVisualDimensions(file).catch(() => ({
          duration: 0,
          width: 0,
          height: 0,
          thumbnailUrl: '',
        })),
        extractMediaMetadata(file).catch(() => ({
          dateStr: formatVideoDate(file).dateStr,
          fullDateStr: '',
          recordedTimestamp: file.lastModified || Date.now(),
          latitude: undefined,
          longitude: undefined,
          locationQuery: undefined,
          locationName: undefined,
        })),
      ]).then(([visualMeta, mediaMeta]) => {
        setVideos((prev) =>
          prev.map((v) =>
            v.id === videoId
              ? {
                  ...v,
                  duration: visualMeta.duration,
                  width: visualMeta.width,
                  height: visualMeta.height,
                  thumbnailUrl: visualMeta.thumbnailUrl,
                  metadataDate: mediaMeta.dateStr,
                  recordedTimestamp: mediaMeta.recordedTimestamp,
                  latitude: mediaMeta.latitude,
                  longitude: mediaMeta.longitude,
                  locationName: mediaMeta.locationName,
                }
              : v
          )
        );
      }).catch((err) => {
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

  // 4. 재병합 상태 및 진행률
  const [isReStitching, setIsReStitching] = useState<boolean>(false);
  const [reStitchProgress, setReStitchProgress] = useState<{
    progressPercent: number;
    statusMessage: string;
  }>({
    progressPercent: 0,
    statusMessage: '',
  });

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
    let bestThumbRotation = 0;
    let bestThumbReason = '';
    let bestThumbCleanDataUrl = '';
    const aiThumbnailRecommendations: Array<{
      videoId: string;
      videoName: string;
      timestamp: number;
      reason?: string;
      cleanDataUrl?: string;
      cropOffsetYRatio?: number;
      rotation?: number;
    }> = [];

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
          locationName: currentVideo.locationName,
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
        const segThumbReason = (segments as any)?.bestThumbnailReason;
        if (segSuggestedTitle && !aiDiscoveredTitle) {
          aiDiscoveredTitle = segSuggestedTitle;
        }

        // AI가 추천한 타임스탬프와 가장 가까운 클린 키프레임 추출 (오버레이 없는 순수 이미지)
        const closestFrame = typeof segThumbTime === 'number' && frames.length > 0
          ? frames.reduce((prev, curr) =>
              Math.abs(curr.timestamp - segThumbTime) < Math.abs(prev.timestamp - segThumbTime) ? curr : prev
            , frames[0])
          : frames[0];

        const candidateThumbTime = typeof segThumbTime === 'number' ? segThumbTime : (closestFrame?.timestamp ?? 0.5);
        const candidateReason = segThumbReason || segments[0]?.reason || 'AI가 선정한 하이라이트 순간';
        const candidateCrop = segments[0]?.cropOffsetYRatio ?? 0.2;
        const candidateRotation = segments[0]?.rotation ?? 0;
        const candidateCleanDataUrl = closestFrame?.dataUrl || '';

        aiThumbnailRecommendations.push({
          videoId: currentVideo.id,
          videoName: currentVideo.name,
          timestamp: candidateThumbTime,
          reason: candidateReason,
          cleanDataUrl: candidateCleanDataUrl,
          cropOffsetYRatio: candidateCrop,
          rotation: candidateRotation,
        });

        if (!bestThumbTimestamp || i === 0) {
          bestThumbTimestamp = candidateThumbTime;
          bestThumbVideoId = currentVideo.id;
          bestThumbCropOffsetYRatio = candidateCrop;
          bestThumbRotation = candidateRotation;
          bestThumbReason = candidateReason;
          bestThumbCleanDataUrl = candidateCleanDataUrl;
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
        stitchProgressPercent: 0,
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
            stitchProgressPercent: pct,
            statusMessage: msg,
          }));
        },
        signal,
      });

      // 3. 16:9 유튜브 고화질 썸네일 자동 생성
      addLog('✨ AI가 직접 추천한 베스트 썸네일 프레임 생성 중...');
      let generatedThumbnailUrl: string | undefined = undefined;
      let cleanThumbnailUrl: string | undefined = undefined;
      try {
        let bgCanvas: HTMLCanvasElement | null = null;
        const thumbVideo =
          updatedVideos.find((v) => v.id === bestThumbVideoId) || updatedVideos[0];
        const bestSeg =
          allSegments.find((s) => s.sourceVideoId === bestThumbVideoId) || allSegments[0];
        const effectiveRotation = bestThumbRotation || bestSeg?.rotation || 0;
        const effectiveCrop = bestThumbCropOffsetYRatio ?? bestSeg?.cropOffsetYRatio ?? 0.2;
        const targetTime =
          bestThumbTimestamp > 0.05
            ? bestThumbTimestamp
            : bestSeg
            ? bestSeg.start + Math.max(0.5, bestSeg.duration * 0.4)
            : 0.5;

        // 1단계: 원본 소스 비디오에서 직접 1280x720 고화질 캡처 시도 (순수 원본 영상, 자막/오버레이 전혀 없음)
        if (thumbVideo?.url) {
          try {
            bgCanvas = await captureVideoFrameAtTime(
              thumbVideo.url,
              targetTime,
              effectiveCrop,
              1280,
              720,
              effectiveRotation
            );
          } catch (sourceErr) {
            console.warn('Source video high-res frame capture failed, falling back to AI clean keyframe dataUrl:', sourceErr);
          }
        }

        // 2단계: 소스 비디오 직접 캡처 실패 시, AI 분석 단계에서 이미 추출해 둔 100% 클린 키프레임 사용 (오버레이 절대 미포함)
        if (!bgCanvas && bestThumbCleanDataUrl) {
          try {
            bgCanvas = await createCanvasFromImageDataUrl(
              bestThumbCleanDataUrl,
              1280,
              720,
              effectiveCrop,
              effectiveRotation
            );
          } catch (cleanDataErr) {
            console.warn('Failed to render from AI keyframe dataUrl:', cleanDataErr);
          }
        }

        // 3단계: 여전히 없으면 첫 번째 클린 키프레임 또는 0.1초 소스 캡처 시도 (절대로 result.url에는 접근하지 않음!)
        if (!bgCanvas && updatedVideos[0]?.url) {
          try {
            bgCanvas = await captureVideoFrameAtTime(
              updatedVideos[0].url,
              0.1,
              0.2,
              1280,
              720,
              0
            );
          } catch {}
        }

        if (bgCanvas) {
          cleanThumbnailUrl = bgCanvas.toDataURL('image/jpeg', 0.95);

          const finalTitle =
            overlayOpts?.titleText || aiDiscoveredTitle || dict.player.defaultTitleText;

          // 썸네일 아트워크 생성 (상단 왼쪽 문구, 오른쪽 문구, 날짜 등 일체 미포함)
          const thumbCanvas = renderThumbnailArtwork(bgCanvas, {
            titleText: finalTitle,
            channelText: '',
            badgeText: '',
            showTitle: Boolean(finalTitle?.trim()),
            showBadge: false,
            showChannel: false,
            stylePreset: 'youtube-bold',
          });

          generatedThumbnailUrl = thumbCanvas.toDataURL('image/jpeg', 0.95);
          addLog(`🎉 AI 추천 썸네일 완성: ${bestThumbReason || '베스트 순간'}`);
        }
      } catch (thumbErr) {
        console.warn('Thumbnail generation warning:', thumbErr);
      }

      result.thumbnailUrl = generatedThumbnailUrl;
      result.cleanThumbnailUrl = cleanThumbnailUrl;
      result.suggestedTitle = aiDiscoveredTitle;
      result.bestThumbnailTime = bestThumbTimestamp;
      result.bestSourceVideoId = bestThumbVideoId;
      result.bestThumbnailReason = bestThumbReason;
      result.bestThumbnailCropOffsetYRatio = bestThumbCropOffsetYRatio;
      result.bestThumbnailRotation = bestThumbRotation;
      result.bestThumbnailCleanDataUrl = bestThumbCleanDataUrl;
      result.aiThumbnailRecommendations = aiThumbnailRecommendations;

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
    setReStitchProgress({
      progressPercent: 0,
      statusMessage: interpolate(dict.logs.stitchingProgress, { count: updatedSegments.length }) || '영상 병합을 준비하고 있어요...',
    });
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
          setReStitchProgress({
            progressPercent: pct,
            statusMessage: msg,
          });
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
        <div className="studio-error-banner flex-col items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300">
          <div className="flex items-center gap-2 w-full">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="font-bold text-xs text-red-200">영상 병합 중 오류가 발생했습니다</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(errorMessage).catch(() => {});
                alert('진단 리포트가 클립보드에 복사되었습니다.');
              }}
              className="ml-auto text-[10px] font-bold px-2 py-0.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded border border-red-500/30"
            >
              리포트 복사
            </button>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-slate-400 hover:text-white p-1"
            >
              ✕
            </button>
          </div>
          <div className="w-full font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all bg-black/40 p-2.5 rounded-lg border border-red-500/20 text-red-100 max-h-60 overflow-y-auto">
            {errorMessage}
          </div>
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
        reStitchProgress={reStitchProgress}
      />
    </div>
  );
}

export default App;
