// App.tsx - Reportist Video 메인 애플리케이션 (i18n 다국어 지원)

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './App.css';
import { Toaster } from '@yusufceng1z/ding-react';
import { notify } from './services/toastService.ts';
import { ProStudioView } from './components/studio/ProStudioView.tsx';
import { CenterStudioView } from './components/studio-v2/CenterStudioView.tsx';
import {
  fetchVideoCapableModels,
  analyzeVideoHighlights,
  parseAndValidateSegments,
  FALLBACK_VIDEO_MODELS,
  DEFAULT_CONFIG,
} from './services/gatewayClient.ts';
import { enrichModelMetrics, pickDefaultModel } from './services/modelMetrics.ts';
import { isByokActive } from './services/userApiKeyService.ts';
import { cancelVideoAnalysisJob } from './services/analyzerQueueService.ts';
import { extractVideoMetadata as extractVideoVisualDimensions, extractVideoFramesForAnalysis, getAnalysisFrameBudget } from './services/videoCompressor.ts';
import {
  extractVideoMetadata as extractMediaMetadata,
  formatVideoDate,
  formatDateByPattern,
  formatDateWithAge,
  getStoredDateFormat,
  getStoredShowAge,
  getStoredBirthDate,
  extractGpsFromVideoFile,
  sortSegmentsByRecordedTime,
  getStoredAutoSortByRecordedTime,
} from './services/videoMetadata.ts';
import {
  refineSubtitlesWithContext,
  getStoredSubtitleTone,
} from './services/subtitleRefineService.ts';
import { primeAudioContext } from './services/audioPrimer.ts';
import { backgroundGuard } from './services/backgroundKeepAlive.ts';
import { computeBridgeDurationMap } from './services/chapterBridgeModel.ts';
import { captureVideoFrameAtTime, createCanvasFromImageDataUrl, renderThumbnailArtwork } from './services/thumbnailGenerator.ts';
import type { FreeModelMeta, ReasoningEffortOption } from './types/gateway.ts';
import type {
  VideoItem,
  OverallStep,
  ProcessingProgress,
  VideoTaskProgress,
  VideoTaskStage,
  FinalVideoResult,
  HighlightSegment,
  HighlightMode,
  VideoOverlayOptions,
  ExportResolution,
  VideoOrientation,
  PortraitPlatform,
} from './types/video.ts';
import { resolveFrameSpec, normalizeOrientation, resolvePortraitPlatform } from './services/frameSpec.ts';
import {
  getStoredSelectedModel,
  setStoredSelectedModel,
  getStoredSelectedEffort,
  setStoredSelectedEffort,
} from './services/modelPreferenceStorage.ts';
import { isMobileStorageEnvironment } from './services/deviceStoragePolicy.ts';
import {
  getStoredHighlightMode,
  normalizeHighlightMode,
  setStoredHighlightMode,
} from './services/highlightModeStorage.ts';
import { AlertCircle } from 'lucide-react';
import { useI18n } from './i18n/index.tsx';

const INITIAL_VIDEO_MODELS = enrichModelMetrics(FALLBACK_VIDEO_MODELS);
const INITIAL_DEFAULT_MODEL = pickDefaultModel(INITIAL_VIDEO_MODELS);

// Center-Stage 스튜디오 V2가 기본 뷰다. 레거시 12단계 UI는 ?studio=v1 로 되돌아갈 수 있다.
const STUDIO_V2_ENABLED =
  typeof window === 'undefined' ||
  new URLSearchParams(window.location.search).get('studio') !== 'v1';

export function App() {
  const { dict, locale, interpolate, ui } = useI18n();

  // 1. 모델 상태 (재시작 시에도 유지되도록 localStorage 연동)
  const [models, setModels] = useState<FreeModelMeta[]>(INITIAL_VIDEO_MODELS);
  const [selectedModel, setSelectedModelState] = useState<string>(() => {
    return getStoredSelectedModel() || (INITIAL_DEFAULT_MODEL?.id ?? '');
  });
  const [selectedEffort, setSelectedEffortState] = useState<ReasoningEffortOption>(() => {
    // 컷 타임스탬프 추출에는 장문 thinking이 필요 없어 기본 추론 강도를 낮춘다.
    return (getStoredSelectedEffort() as ReasoningEffortOption) || 'low';
  });
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(true);

  const setSelectedModel = useCallback((modelId: string) => {
    setSelectedModelState(modelId);
    setStoredSelectedModel(modelId);
  }, []);

  const setSelectedEffort = useCallback((effort: ReasoningEffortOption) => {
    setSelectedEffortState(effort);
    setStoredSelectedEffort(effort);
  }, []);

  // 2. 비디오 목록 및 처리 상태
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [currentStep, setCurrentStep] = useState<OverallStep>('upload');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 개별 영상 위치/장소명 수정 핸들러
  const handleUpdateVideoLocation = useCallback(
    (id: string, locationName: string) => {
      const previousName = (videos.find((v) => v.id === id)?.locationName ?? '').trim();
      // AI 분석이 저장해 둔 지명은 영상의 locationName과 다를 수 있다(GPS 자동 추출 등).
      // 이름이 다르다고 건너뛰면 예전 지명이 컷·자막에 그대로 남으므로 해당 영상의
      // 모든 세그먼트를 조건 없이 새 장소로 갱신한다.
      const updateSeg = (seg: HighlightSegment): HighlightSegment =>
        seg.sourceVideoId === id ? { ...seg, locationName } : seg;

      setVideos((prev) =>
        prev.map((v) =>
          v.id === id
            ? { ...v, locationName, segments: v.segments.map(updateSeg) }
            : v
        )
      );

      // finalResult.segments까지 함께 갱신해 상위 동기화·자동 저장에 옛 지명이 남지 않게 한다.
      setFinalResult((prev) => {
        if (!prev?.segments?.length) return prev;
        return { ...prev, segments: prev.segments.map(updateSeg) };
      });

      // 오버레이의 기본 장소 문구가 이전 지명이었으면 같이 바꾼다.
      // (이 값은 컷에 장소가 없을 때의 폴백이라 여기 남으면 브릿지·내보내기에 그대로 나타난다.)
      setCurrentOverlayOptions((prev) => {
        if (!prev) return prev;
        const cur = (prev.subtitleLocationText ?? '').trim();
        if (!cur || cur === previousName) {
          return { ...prev, subtitleLocationText: locationName };
        }
        return prev;
      });
    },
    [videos]
  );

  // 개별 영상 회전 각도 변경 (스탭 3). 원본 회전 값을 저장하고, 이미 분석된 세그먼트가 있으면
  // 같은 각도로 함께 갱신해 컷·전체 보기·내보내기 결과가 원본 미리보기와 어긋나지 않게 한다.
  const handleUpdateVideoRotation = useCallback((id: string, rotation: number) => {
    const safeRotation = ((rotation % 360) + 360) % 360;
    setVideos((prev) =>
      prev.map((v) =>
        v.id === id
          ? {
              ...v,
              rotation: safeRotation,
              segments: v.segments.map((s) => ({ ...s, rotation: safeRotation })),
            }
          : v
      )
    );
    // 회전도 위치와 마찬가지로 finalResult.segments까지 갱신해 상위 동기화에 덮어써지지 않게 한다.
    setFinalResult((prev) => {
      if (!prev?.segments?.length) return prev;
      let changed = false;
      const nextSegments = prev.segments.map((seg) => {
        if (seg.sourceVideoId !== id || seg.rotation === safeRotation) return seg;
        changed = true;
        return { ...seg, rotation: safeRotation };
      });
      return changed ? { ...prev, segments: nextSegments } : prev;
    });
  }, []);

  // UI 언어 변경/프로젝트 복원 시 영상 목록의 촬영일 표기(월 이름·나이 단위)를 현재 언어로 갱신
  const metadataDateLocaleKey = useMemo(
    () =>
      videos
        .map((video) => `${video.id}:${video.recordedTimestamp ?? video.file?.lastModified ?? ''}`)
        .join('|'),
    [videos]
  );

  useEffect(() => {
    setVideos((prev) => {
      let changed = false;
      const next = prev.map((video) => {
        const ts = video.recordedTimestamp || video.file?.lastModified;
        if (!ts) return video;
        const targetDate = new Date(ts);
        const base = formatDateByPattern(targetDate, getStoredDateFormat(), locale);
        const metadataDate = formatDateWithAge(
          base,
          targetDate,
          getStoredShowAge(),
          getStoredBirthDate(),
          locale
        );
        if (metadataDate === video.metadataDate) return video;
        changed = true;
        return { ...video, metadataDate };
      });
      return changed ? next : prev;
    });
  }, [locale, metadataDateLocaleKey]);

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
  // 진행 중인 자체 분석 대기열(reportist-analyzer) 작업 ID 집합 (병렬 작업 전부 취소)
  const activeQueueJobIdsRef = useRef<Set<string>>(new Set());

  // 4. 출력 방향(가로 16:9 / 세로 9:16)과 세로 플랫폼 프리셋
  const [currentOrientation, setCurrentOrientation] = useState<VideoOrientation>('landscape');
  const [currentPortraitPlatform, setCurrentPortraitPlatform] = useState<PortraitPlatform>('instagram');

  // 편집 설정 상태
  const [currentOverlayOptions, setCurrentOverlayOptions] = useState<VideoOverlayOptions | null>(null);
  const [currentBgmPresetId, setCurrentBgmPresetId] = useState<string>('none');
  const [currentBgmVolume, setCurrentBgmVolume] = useState<number>(0.3);
  const [currentCustomAudio, setCurrentCustomAudio] = useState<File | null>(null);
  const [currentLibraryTrackId, setCurrentLibraryTrackId] = useState<string | null>(null);
  // 하이라이트 방식 (감성 하이라이트 / 1초 컷 편집) — 프로젝트에 저장되고 기기에도 마지막 선택을 기억한다.
  const [currentHighlightMode, setCurrentHighlightMode] = useState<HighlightMode>(getStoredHighlightMode);

  // 편집 오버레이 옵션 변경 핸들러 (실제 값이 같으면 참조 유지하여 무한 리렌더링 및 저장 루프 방지)
  const handleOverlayOptionsChange = useCallback((newOpts: VideoOverlayOptions) => {
    setCurrentOverlayOptions((prev) => {
      if (!prev) return newOpts;
      if (
        prev.titleText === newOpts.titleText &&
        prev.channelText === newOpts.channelText &&
        prev.showTitle === newOpts.showTitle &&
        prev.showChannel === newOpts.showChannel &&
        prev.showSubtitle === newOpts.showSubtitle &&
        prev.showDate === newOpts.showDate &&
        prev.subtitleDateText === newOpts.subtitleDateText &&
        prev.subtitleLocationText === newOpts.subtitleLocationText &&
        prev.showIntro === newOpts.showIntro &&
        prev.showOutro === newOpts.showOutro &&
        prev.introTemplate === newOpts.introTemplate &&
        prev.introDurationSec === newOpts.introDurationSec &&
        prev.outroTemplate === newOpts.outroTemplate &&
        prev.outroDurationSec === newOpts.outroDurationSec &&
        prev.outroText === newOpts.outroText &&
        prev.showChapterBridge === newOpts.showChapterBridge &&
        prev.chapterBridgeDateTemplate === newOpts.chapterBridgeDateTemplate &&
        prev.chapterBridgeLocationTemplate === newOpts.chapterBridgeLocationTemplate &&
        prev.bgmFitToVideo === newOpts.bgmFitToVideo &&
        prev.showCredit === newOpts.showCredit &&
        prev.introVideoFile === newOpts.introVideoFile &&
        prev.outroVideoFile === newOpts.outroVideoFile
      ) {
        return prev;
      }
      return newOpts;
    });
  }, []);

  const handleHighlightModeChange = useCallback((mode: HighlightMode) => {
    setStoredHighlightMode(mode);
    setCurrentHighlightMode((prev) => (prev !== mode ? mode : prev));
  }, []);

  // 배경음악 변경 핸들러 (실제 값이 같으면 상태 유지하여 무한 리렌더링 방지)
  const handleBgmChange = useCallback(
    (bgmId: string, vol: number, libraryTrackId?: string | null) => {
      setCurrentBgmPresetId((prev) => (prev !== bgmId ? bgmId : prev));
      setCurrentBgmVolume((prev) => (Math.abs(prev - vol) > 0.001 ? vol : prev));
      if (libraryTrackId !== undefined) {
        setCurrentLibraryTrackId((prev) => (prev !== libraryTrackId ? libraryTrackId : prev));
      }
    },
    []
  );

  // 커스텀 오디오 파일 변경 핸들러
  const handleCustomAudioChange = useCallback((file: File | null) => {
    setCurrentCustomAudio((prev) => (prev !== file ? file : prev));
  }, []);


  const activeMetadataBatchCountRef = useRef<number>(0);
  // 메타데이터/썸네일 추출 배치가 진행 중인지 UI에 알리기 위한 상태 (다음 단계 차단에 사용)
  const [activeVideoMetaBatches, setActiveVideoMetaBatches] = useState(0);

  // 새 작업 시작 (통합 스튜디오에서 영상 업로드부터 바로 시작)
  // orientation/platform은 프로젝트 생성 시점의 포맷 선택 모달에서 전달된다 (없으면 가로 16:9).
  const handleStartNewProject = (orientation?: VideoOrientation, platform?: PortraitPlatform) => {
    const urlsToRevoke: string[] = [];
    videos.forEach((v: VideoItem) => {
      if (v.url && v.url.startsWith('blob:')) urlsToRevoke.push(v.url);
    });
    if (finalResult?.url && finalResult.url.startsWith('blob:')) {
      urlsToRevoke.push(finalResult.url);
    }

    setVideos([]);
    setFinalResult(null);
    setCurrentStep('upload');
    setCurrentOrientation(orientation === 'portrait' ? 'portrait' : 'landscape');
    setCurrentPortraitPlatform(resolvePortraitPlatform(platform));
    setCurrentOverlayOptions(null);
    setCurrentBgmPresetId('none');
    setCurrentBgmVolume(0.3);
    setCurrentCustomAudio(null);
    setCurrentLibraryTrackId(null);
    setCurrentHighlightMode(getStoredHighlightMode());

    if (urlsToRevoke.length > 0) {
      setTimeout(() => {
        urlsToRevoke.forEach((u) => {
          try {
            URL.revokeObjectURL(u);
          } catch {}
        });
      }, 1000);
    }
  };

  // 초기 모델 목록 로드 (사용자가 이전에 선택한 모델 설정 기억 및 복원)
  useEffect(() => {
    let isMounted = true;
    async function loadModels() {
      setIsLoadingModels(true);
      try {
        const fetched = await fetchVideoCapableModels(DEFAULT_CONFIG);
        if (isMounted && fetched.length > 0) {
          const enriched = enrichModelMetrics(fetched);
          setModels(enriched);

          // 자체 AI 키(BYOK)가 활성이면 저장된 BYOK 모델 ID는 무료 목록에 없으므로
          // 아래 기본 모델 선택 로직이 이를 덮어쓰지 않도록 그대로 유지한다.
          if (isByokActive()) return;

          // 사용자가 명시적으로 저장/선택한 모델만 복원한다.
          // 초기 렌더링 시 폴백 목록으로 자동 정해진 selectedModel을 저장된 설정으로 오인해 그대로
          // 유지하면, 실시간 데이터에서 학습 사용(training === true)으로 확인된 모델이 기본값으로
          // 남는다. 저장된 설정이 없으면 항상 최신 목록에서 기본 모델을 다시 고른다.
          const storedModelId = getStoredSelectedModel();
          const foundStoredModel = storedModelId
            ? enriched.find((m) => m.id === storedModelId)
            : null;

          if (foundStoredModel) {
            setSelectedModelState(foundStoredModel.id);
            if (!getStoredSelectedEffort() && foundStoredModel.defaultEffort) {
              setSelectedEffortState(foundStoredModel.defaultEffort as ReasoningEffortOption);
            }
          } else {
            const defaultModel = pickDefaultModel(enriched);
            if (defaultModel) {
              setSelectedModelState(defaultModel.id);
              setStoredSelectedModel(defaultModel.id);
              if (defaultModel.defaultEffort && !getStoredSelectedEffort()) {
                setSelectedEffortState(defaultModel.defaultEffort as ReasoningEffortOption);
                setStoredSelectedEffort(defaultModel.defaultEffort as ReasoningEffortOption);
              }
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

  // 파일 업로드 핸들러 (16~100개 이상 대량 업로드 시에도 리렌더링 폭주 및 디코더 크래시가 없도록 배치 등록 & 동시성 제한 큐 적용)
  const handleFilesSelected = async (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    setErrorMessage(null);

    const isMobileEnv = isMobileStorageEnvironment();

    const createdItems: Array<{ videoId: string; file: File; item: VideoItem }> = newFiles.map(
      (file, idx) => {
        const videoId = `vid-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`;
        const blobUrl = URL.createObjectURL(file);
        const item: VideoItem = {
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
        return { videoId, file, item };
      }
    );

    // 메타데이터 추출이 진행되는 동안 자동 저장(performSave)이 중첩 실행되지 않도록 잠금
    activeMetadataBatchCountRef.current += 1;
    setActiveVideoMetaBatches((count) => count + 1);

    // 1회 배치 상태 업데이트로 N번 연속 리렌더링 방지
    setVideos((prev) => [...prev, ...createdItems.map((c) => c.item)]);

    // 모바일(iPhone XR 등)은 하드웨어 디코더 및 메모리 보호를 위해 동시성 1개 직렬 처리, 데스크톱은 최대 2개
    let cursor = 0;
    const workerCount = Math.min(isMobileEnv ? 1 : 2, createdItems.length);
    const pendingUpdates = new Map<
      string,
      {
        duration: number;
        width: number;
        height: number;
        thumbnailUrl: string;
        metadataDate: string;
        recordedTimestamp?: number;
        latitude?: number;
        longitude?: number;
        locationName?: string;
      }
    >();

    const flushPendingVideoUpdates = () => {
      if (pendingUpdates.size === 0) return;
      const snapshot = new Map(pendingUpdates);
      pendingUpdates.clear();
      setVideos((prev) =>
        prev.map((v) => {
          const upd = snapshot.get(v.id);
          return upd ? { ...v, ...upd } : v;
        })
      );
    };

    const runWorker = async () => {
      while (cursor < createdItems.length) {
        const currentIndex = cursor++;
        const { videoId, file } = createdItems[currentIndex];
        try {
          // 1. 단일 패스 바이너리 스캔으로 촬영일/GPS뿐만 아니라 duration, width, height, rotation까지 즉각 추출 (0.05ms, 디코더 부하 0)
          const mediaMeta = await extractMediaMetadata(file).catch(() => ({
            duration: undefined,
            width: undefined,
            height: undefined,
            rotation: undefined,
            dateStr: formatVideoDate(file).dateStr,
            fullDateStr: '',
            recordedTimestamp: file.lastModified || Date.now(),
            latitude: undefined,
            longitude: undefined,
            locationQuery: undefined,
            locationName: undefined,
          }));

          let duration = mediaMeta.duration || 0;
          let width = mediaMeta.width || 0;
          let height = mediaMeta.height || 0;

          // 썸네일은 모든 영상에 대해 추출 (모바일도 워커 직렬 처리 + videoCompressor의 디코더 슬롯 1개 제한으로 보호)
          const visualMeta = await extractVideoVisualDimensions(file, false).catch(() => ({
            duration: 0,
            width: 0,
            height: 0,
            thumbnailUrl: '',
          }));
          if (!duration) duration = visualMeta.duration;
          if (!width) width = visualMeta.width;
          if (!height) height = visualMeta.height;
          const thumbnailUrl = visualMeta.thumbnailUrl;

          pendingUpdates.set(videoId, {
            duration,
            width,
            height,
            thumbnailUrl,
            metadataDate: mediaMeta.dateStr,
            recordedTimestamp: mediaMeta.recordedTimestamp,
            latitude: mediaMeta.latitude,
            longitude: mediaMeta.longitude,
            locationName: mediaMeta.locationName,
          });

          // 첫 번째 영상(프리뷰 즉시 반영)이거나 4개 단위 배치마다 상태 반영하여 리렌더링 폭주 차단
          if (currentIndex === 0 || pendingUpdates.size >= 4 || currentIndex === createdItems.length - 1) {
            flushPendingVideoUpdates();
          }

          // 모바일 환경에서는 각 영상 처리 사이에 짧은 틱(40ms)을 주어 WebKit 미디어 스레드/가비지 컬렉터가 숨을 쉴 수 있게 보장
          if (isMobileEnv) {
            await new Promise((r) => setTimeout(r, 40));
          }
        } catch (err) {
          console.warn('Metadata extraction error:', err);
        }
      }
    };

    try {
      await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
      flushPendingVideoUpdates();
    } finally {
      activeMetadataBatchCountRef.current = Math.max(0, activeMetadataBatchCountRef.current - 1);
      setActiveVideoMetaBatches((count) => Math.max(0, count - 1));
    }
  };

  // 원본 영상 삭제: 영상뿐 아니라 해당 영상에서 파생된 컷과 결과 메타데이터까지 함께 정리한다.
  // (스튜디오 V2에서는 역비행 연출이 끝난 뒤 이 핸들러를 호출한다.)
  const handleRemove = (id: string) => {
    const item = videos.find((v) => v.id === id);
    if (item?.url?.startsWith('blob:')) {
      URL.revokeObjectURL(item.url);
    }
    const nextVideos = videos.filter((v) => v.id !== id);
    setVideos(nextVideos);

    if (!finalResult) return;

    const removedSegments = finalResult.segments.filter((s) => s.sourceVideoId === id);
    const remainingSegments = finalResult.segments.filter((s) => s.sourceVideoId !== id);
    if (remainingSegments.length === 0) {
      setFinalResult(null);
      setCurrentStep('upload');
      return;
    }

    const bridgeMap = finalResult.bridgeDurationMap;
    const removedBridgeSeconds = bridgeMap
      ? removedSegments.reduce((sum, s) => sum + (bridgeMap[s.id] ?? 0), 0)
      : 0;
    const removedClipSeconds = removedSegments.reduce((sum, s) => sum + (s.duration || 0), 0);
    const remainingIds = new Set(remainingSegments.map((s) => s.id));
    const nextBridgeMap = bridgeMap
      ? Object.fromEntries(Object.entries(bridgeMap).filter(([segId]) => remainingIds.has(segId)))
      : bridgeMap;

    setFinalResult({
      ...finalResult,
      segments: remainingSegments,
      bridgeDurationMap: nextBridgeMap,
      duration: Math.max(
        0,
        Math.round((finalResult.duration - removedClipSeconds - removedBridgeSeconds) * 10) / 10
      ),
      originalTotalDuration: nextVideos.reduce((sum, v) => sum + (v.duration || 0), 0),
      aiThumbnailRecommendations: finalResult.aiThumbnailRecommendations?.filter(
        (r) => r.videoId !== id
      ),
      bestSourceVideoId: finalResult.bestSourceVideoId === id ? undefined : finalResult.bestSourceVideoId,
    });
  };

  // 단일 영상 로컬 파일 재연결
  const handleRelinkSingleVideo = (videoId: string, newFile: File) => {
    const newUrl = URL.createObjectURL(newFile);
    setVideos((prev) =>
      prev.map((v) => {
        if (v.id !== videoId) return v;
        if (v.url && v.url.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(v.url);
          } catch {}
        }
        return {
          ...v,
          file: newFile,
          url: newUrl,
          sizeBytes: newFile.size,
          isMissingFile: false,
          error: undefined,
          status: v.segments.length > 0 ? 'analyzed' : 'idle',
        };
      })
    );
  };

  // 누락 영상 파일 일괄 자동 매칭 및 재연결
  const handleRelinkBatch = (files: File[]) => {
    let matchedCount = 0;
    setVideos((prev) =>
      prev.map((v) => {
        const isMissing = !v.url || (v.file && v.file.size === 0) || v.isMissingFile;
        if (!isMissing) return v;

        // 매칭: 파일명이 같거나(대소문자 무시) 파일 크기가 일치하는 파일 탐색
        const match =
          files.find((f) => f.name.toLowerCase() === v.name.toLowerCase()) ||
          files.find((f) => f.size === v.sizeBytes);

        if (match) {
          matchedCount++;
          if (v.url && v.url.startsWith('blob:')) {
            try {
              URL.revokeObjectURL(v.url);
            } catch {}
          }
          const newUrl = URL.createObjectURL(match);
          return {
            ...v,
            file: match,
            url: newUrl,
            sizeBytes: match.size,
            isMissingFile: false,
            error: undefined,
            status: v.segments.length > 0 ? 'analyzed' : 'idle',
          };
        }
        return v;
      })
    );

    if (matchedCount > 0) {
      notify.success(
        interpolate(
          dict.videoListModal?.relinkBatchSuccess || '{count}개의 영상 파일이 정상적으로 재연결되었습니다.',
          { count: matchedCount }
        )
      );
    } else {
      notify.warning(
        dict.videoListModal?.relinkBatchNone ||
          '선택하신 파일 중 이름이나 용량이 일치하는 영상이 없습니다. 개별 연결을 사용해 주세요.'
      );
    }
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

  // 유효한 비디오 Blob URL 확인 및 복구
  const refreshVideoBlobUrls = (videoList: VideoItem[]): VideoItem[] => {
    return videoList.map((v) => {
      let url = v.url;
      const hasValidFile = Boolean(v.file instanceof Blob && v.file.size > 0);
      if ((!url || url.trim() === '') && hasValidFile) {
        url = URL.createObjectURL(v.file);
      }
      return {
        ...v,
        url,
      };
    });
  };

  // 처리 시작 전 비디오 상태 전수 검증
  const validateVideosForProcessing = (videoList: VideoItem[]): void => {
    if (videoList.length === 0) {
      throw new Error('처리할 영상이 없습니다.');
    }

    // 1) 실제 파일 데이터(Blob/File)가 소실된 비디오 검사
    const missingFileVideos = videoList.filter(
      (v) => (!v.file || !(v.file instanceof Blob) || v.file.size === 0) && (!v.url || v.url.trim() === '')
    );
    if (missingFileVideos.length > 0) {
      const names = missingFileVideos.map((v) => v.name).join(', ');
      throw new Error(
        `[${names}] 영상의 원본 파일 데이터가 없습니다.\n모바일 브라우저 재접속 또는 메모리 정리 시 브라우저 보안 정책상 파일이 언로드되므로, 원본 영상을 다시 선택해 주세요.`
      );
    }
  };

  // 하이라이트 생성 시작
  const handleStartProcessing = async (
    overlayOpts?: VideoOverlayOptions,
    customAudio?: File | null,
    bgmPresetId = 'none',
    bgmVol = 0.35,
    highlightMode: HighlightMode = currentHighlightMode,
    sourceVideos?: VideoItem[]
  ) => {
    const videosToProcess = sourceVideos ?? videos;
    if (videosToProcess.length === 0) return;

    // 선택한 방식을 즉시 기기에도 기억해 둔다.
    setStoredHighlightMode(highlightMode);
    setCurrentHighlightMode((prev) => (prev !== highlightMode ? highlightMode : prev));

    // 1. 영상 URL 갱신 및 파일 유효성 사전 검사
    const readyVideos = refreshVideoBlobUrls(videosToProcess);
    try {
      validateVideosForProcessing(readyVideos);
    } catch (vErr) {
      const msg = vErr instanceof Error ? vErr.message : '영상을 확인할 수 없습니다.';
      setErrorMessage(msg);
      return;
    }
    setVideos(readyVideos);

    // iOS Safari는 사용자 제스처 안에서만 오디오를 잠금 해제할 수 있으므로
    // 병합 단계(AudioContext 사용) 전에 미리 준비해 둔다.
    primeAudioContext();

    // 화면 꺼짐 방지(Screen Wake Lock) 및 백그라운드 프로세스 동결 방지 가드 가동
    void backgroundGuard.start();

    setCurrentStep('processing');
    setErrorMessage(null);
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const totalVideos = readyVideos.length;
    const updatedVideos = [...readyVideos];
    const logs: string[] = [];

    // 진행률 완전 초기화 (이전 실행 결과로 인한 99%/100% 잔여값 방지)
    setProgress({
      step: 'processing',
      currentPhase: 'extract',
      currentVideoIndex: 0,
      totalVideos,
      progressPercent: 0,
      statusMessage: `${1}/${totalVideos} [${readyVideos[0]?.name || ''}] ${dict.header.analyzingAi}...`,
      reasoningLogs: [],
      liveReasoning: '',
      liveContent: '',
    });

    const addLog = (msg: string) => {
      const time = new Date().toTimeString().slice(0, 8);
      const logEntry = `[${time}] ${msg}`;
      logs.push(logEntry);
      setProgress((prev) => ({
        ...prev,
        reasoningLogs: [...logs],
      }));
    };

    // 백그라운드 탭 복귀 및 무응답 감지용 활성 타임스탬프
    let lastActivityTimestamp = Date.now();
    // 병렬 분석 중인 영상별 AbortController (화면 복귀 시 정체 감지에 사용)
    const activeControllers = new Map<number, AbortController>();
    let isStallRecovering = false;

    // 화면 복귀(크롬 탭 복귀, 모바일 앱 복귀) 시 정체 감지 및 자동 재개 리스너
    const handleVisibilityOrFocus = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'visible' && !signal.aborted) {
        const idleDuration = Date.now() - lastActivityTimestamp;
        // 마지막 활동으로부터 10초 이상 지났는데 아직 분석 중인 경우 백그라운드 소켓 단절로 판단하여 즉각 재시도
        if (idleDuration > 10000 && activeControllers.size > 0 && !isStallRecovering) {
          isStallRecovering = true;
          addLog('🔄 화면 복귀 감지: 백그라운드 동안 정체된 AI 연결을 감지하여 자동으로 즉시 재개합니다.');
          for (const controller of activeControllers.values()) {
            try {
              controller.abort(new Error('화면 복귀로 인한 연결 재개'));
            } catch {
              // ignore
            }
          }
        }
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityOrFocus);
      window.addEventListener('focus', handleVisibilityOrFocus);
      window.addEventListener('pageshow', handleVisibilityOrFocus);
    }

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
      cropOffsetXRatio?: number;
      rotation?: number;
    }> = [];

    // 영상별 진행률(0~100)을 합산해 전체 진행률을 계산한다.
    // 병렬 분석 중에도 "완료된 영상 비율"만큼 정확히 전진하므로 특정 영상이 늦게 끝나도
    // 진행률이 99%에서 멈추지 않는다.
    const VIDEO_ANALYSIS_CONCURRENCY = 4;
    const videoProgressPct = new Array<number>(totalVideos).fill(0);
    const getOverallPct = () =>
      totalVideos > 0 ? videoProgressPct.reduce((sum, pct) => sum + pct, 0) / totalVideos : 0;
    const commitVideoProgress = (index: number, pct: number) => {
      videoProgressPct[index] = Math.max(videoProgressPct[index], Math.min(100, Math.max(0, pct)));
    };

    // 병렬 작업 슬롯: 워커는 자기 인덱스만 갱신하고, 화면 반영은 아래 집계기 1곳에서만 수행한다.
    // 기존처럼 워커마다 statusMessage를 덮어쓰면 1/3 · 2/3 · 3/3이 0.1초마다 번갈아 깜빡인다.
    const videoTasks: VideoTaskProgress[] = readyVideos.map((v) => ({
      videoId: v.id,
      name: v.name,
      thumbnailUrl: v.thumbnailUrl,
      stage: 'pending',
      progressPercent: 0,
    }));
    const setTask = (index: number, patch: Partial<VideoTaskProgress>) => {
      Object.assign(videoTasks[index], patch);
    };
    const activeStage = (stage: VideoTaskStage) =>
      stage === 'extracting' || stage === 'queued' || stage === 'analyzing';

    // 추론 2줄 박스는 가장 먼저 시작한 활성 영상 1개에 고정하고, 그 영상이 끝날 때만 다음으로 넘어간다.
    let focusedVideoIndex = 0;
    const pickFocusedIndex = () => {
      const current = videoTasks[focusedVideoIndex];
      if (current && activeStage(current.stage)) return focusedVideoIndex;
      const next = videoTasks.findIndex((task) => activeStage(task.stage));
      if (next >= 0) focusedVideoIndex = next;
      return focusedVideoIndex;
    };

    const aggregateStatusMessage = () => {
      const done = videoTasks.filter((t) => t.stage === 'done' || t.stage === 'reused').length;
      if (done >= totalVideos) return ui('모든 영상 분석을 마쳤어요');
      if (totalVideos <= 1) {
        const task = videoTasks[pickFocusedIndex()];
        if (task?.stage === 'extracting') return ui('프레임을 추출하고 있어요');
        if (task?.stage === 'queued') return ui('AI 분석 대기열에서 기다리고 있어요');
        if (task?.stage === 'analyzing') return ui('AI가 하이라이트를 찾고 있어요');
        return ui('하이라이트를 준비하고 있어요');
      }
      return ui('영상 {total}개 동시 분석 중 · 완료 {done}/{total}', { total: totalVideos, done });
    };

    // 200ms 단일 집계 타이머: 영상 수와 무관하게 setProgress는 이 곳에서만 호출된다.
    const flushAggregateProgress = () => {
      const activeTasks = videoTasks.filter((t) => activeStage(t.stage));
      const allQueued = activeTasks.length > 0 && activeTasks.every((t) => t.stage === 'queued');
      const focusIdx = pickFocusedIndex();
      const focused = focusIdx >= 0 ? videoTasks[focusIdx] : undefined;
      const currentPhase: ProcessingProgress['currentPhase'] = videoTasks.some(
        (t) => t.stage === 'queued' || t.stage === 'analyzing'
      )
        ? 'analyze'
        : 'extract';

      setProgress((prev) => ({
        ...prev,
        step: 'processing',
        currentPhase,
        currentVideoIndex: focusIdx >= 0 ? focusIdx : 0,
        totalVideos,
        progressPercent: Math.min(99, Math.floor(getOverallPct())),
        statusMessage: aggregateStatusMessage(),
        isQueued: allQueued,
        queuePosition: allQueued ? focused?.queuePosition : undefined,
        estimatedWaitSec: allQueued ? focused?.estimatedWaitSec : undefined,
        jobId: allQueued ? prev.jobId : undefined,
        liveReasoning: focused?.liveText || '',
        liveContent: '',
        videoTasks: videoTasks.map((task) => ({ ...task })),
        focusedVideoId: focused?.videoId,
      }));
    };

    // 병렬 완료 순서와 무관하게 영상 번호 순으로 제목/썸네일을 확정하기 위한 결과 슬롯
    const videoMetaResults: Array<{
      suggestedTitle?: string;
      thumbTime: number;
      reason: string;
      crop: number;
      cropX: number;
      rotation: number;
      cleanDataUrl: string;
    } | null> = new Array(totalVideos).fill(null);

    try {
      const analyzeOneVideo = async (i: number) => {
        if (signal.aborted) throw new Error(dict.logs.cancelledByUser);

        const currentVideo = updatedVideos[i];
        let videoLocalPct = 0;

        // 워커는 자기 슬롯만 갱신한다. 화면 반영은 아래 단일 집계 타이머가 담당한다.
        const publish = (patch?: Partial<VideoTaskProgress>) => {
          commitVideoProgress(i, videoLocalPct);
          setTask(i, { progressPercent: videoLocalPct, ...patch });
        };

        // 자체 인메모리 큐(reportist-analyzer) 대기 상태 (영상별 독립)
        let queueInfo: {
          isQueued: boolean;
          position?: number;
          etaSec?: number;
          jobId?: string;
        } = { isQueued: false };
        let queueLoggedStatus: string | null = null;
        const resetQueueState = () => {
          if (queueInfo.jobId) activeQueueJobIdsRef.current.delete(queueInfo.jobId);
          queueInfo = { isQueued: false };
          queueLoggedStatus = null;
        };

        let liveReasoning = '';
        let liveContent = '';

        const syncLiveText = () => {
          const text = liveReasoning || liveContent;
          if (videoTasks[i].liveText !== text) setTask(i, { liveText: text });
        };

        const resetLiveStream = () => {
          liveReasoning = '';
          liveContent = '';
          setTask(i, { liveText: '' });
        };

        const isSameAnalysisMode =
          normalizeHighlightMode(currentVideo.analysisMode) === highlightMode;
        if (
          currentVideo.status === 'analyzed' &&
          currentVideo.segments &&
          currentVideo.segments.length > 0 &&
          isSameAnalysisMode
        ) {
          addLog(interpolate(dict.logs.reusingSegments, { name: currentVideo.name, count: currentVideo.segments.length }));
          videoLocalPct = 100;
          publish({ stage: 'reused' });
          return;
        }

        // 1-A. 주요 프레임 다중 이미지 추출
        resetLiveStream();
        publish({ stage: 'extracting' });

        addLog(interpolate(dict.logs.extractingFrames, {
          name: currentVideo.name,
          duration: currentVideo.duration.toFixed(1),
          frames: getAnalysisFrameBudget(currentVideo.duration, highlightMode),
        }));

        const frames = await extractVideoFramesForAnalysis(
          { url: currentVideo.url, file: currentVideo.file },
          currentVideo.duration,
          (pct) => {
            if (signal.aborted) return;
            // 해당 영상 지분의 15%를 프레임 추출에 배정
            videoLocalPct = Math.max(videoLocalPct, (pct / 100) * 15);
            publish();
          },
          currentVideo.rotation,
          highlightMode
        );

        // 메타데이터 추출이 지연/실패해 duration이 0으로 남아 있던 경우 프레임 타임스탬프로 보정해
        // AI 구간 클램핑이 [0, 0]으로 무효화되어 컷이 0개가 되는 문제를 방지한다.
        const effectiveDuration =
          Number.isFinite(currentVideo.duration) && currentVideo.duration > 0
            ? currentVideo.duration
            : frames.length > 0
            ? Math.max(
                1.0,
                Math.round(
                  (Math.max(...frames.map((f) => (Number.isFinite(f.timestamp) ? f.timestamp : 0))) + 0.5) * 10
                ) / 10
              )
            : 3.0;
        if (!Number.isFinite(currentVideo.duration) || currentVideo.duration <= 0) {
          currentVideo.duration = effectiveDuration;
        }

        videoLocalPct = Math.max(videoLocalPct, 15);

        addLog(interpolate(dict.logs.framesExtracted, {
          name: currentVideo.name,
          model: selectedModel.replace(':free', ''),
        }));

        resetLiveStream();

        // 1-B. AI Gateway 다중 프레임 분석
        // [멈춤 제로(Zero-Freeze) & 가짜 최저 속도 보장 엔진]: AI 추론이 길어져도 해당 영상 지분 내에서 숫자가 절대 멈추지 않음
        const analyzeStartTime = Date.now();

        // 진행률·상태 문구는 자기 슬롯에만 기록한다. 1/3·2/3·3/3이 서로를 덮어쓰지 않도록
        // 화면 반영은 200ms 단일 집계 타이머(flushAggregateProgress)가 전담한다.
        const updateAnalyzeProgress = (bonus = 0) => {
          if (signal.aborted) return;

          if (queueInfo.isQueued) {
            setTask(i, {
              stage: 'queued',
              queuePosition: queueInfo.position,
              estimatedWaitSec: queueInfo.etaSec,
            });
            return;
          }

          const elapsedSec = (Date.now() - analyzeStartTime) / 1000;
          const remainingToMax = Math.max(0, 99 - videoLocalPct);
          const adaptiveStep = Math.max(0.02, remainingToMax * 0.0035);

          if (videoLocalPct < 98.8) {
            videoLocalPct = Math.min(98.9, videoLocalPct + adaptiveStep + bonus);
          } else {
            videoLocalPct = Math.min(99, videoLocalPct + 0.002);
          }

          publish({
            stage: 'analyzing',
            elapsedSec,
            queuePosition: undefined,
            estimatedWaitSec: undefined,
          });
        };

        publish({ stage: 'analyzing', elapsedSec: 0 });

        // 100ms마다 자기 슬롯만 갱신 (화면 rerender는 상위 집계기가 담당)
        const analyzeSmoothTimer = window.setInterval(() => updateAnalyzeProgress(0), 100);
        // Worker 하트비트: 백그라운드 탭에서도 슬롯 갱신 유지
        const unbindHeartbeat = backgroundGuard.onTick(() => updateAnalyzeProgress(0));

        let segments: any[] = [];
        let videoSuccess = false;
        const maxVideoAttempts = 2; // 개별 비디오당 최대 2회 시도

        try {
          for (let attempt = 0; attempt < maxVideoAttempts && !videoSuccess; attempt++) {
            if (signal.aborted) break;

            // 재시도 시 이전 시도의 대기열 순번/작업 ID 및 잔여 추론 텍스트가 남지 않도록 초기화
            resetQueueState();
            if (attempt > 0) {
              resetLiveStream();
              setProgress((prev) => ({
                ...prev,
                liveReasoning: '',
                liveContent: '',
              }));
            }

            const videoController = new AbortController();
            activeControllers.set(i, videoController);
            const videoSignal = videoController.signal;
            const onParentAbort = () => videoController.abort();
            signal.addEventListener('abort', onParentAbort, { once: true });

            isStallRecovering = false;
            lastActivityTimestamp = Date.now();

            try {
              segments = await analyzeVideoHighlights({
                frames,
                videoDuration: effectiveDuration,
                videoId: currentVideo.id,
                videoName: currentVideo.name,
                model: selectedModel,
                reasoningEffort: selectedEffort,
                config: DEFAULT_CONFIG,
                signal: videoSignal,
                metadataDate: currentVideo.metadataDate,
                latitude: currentVideo.latitude,
                longitude: currentVideo.longitude,
                locationName: currentVideo.locationName,
                locale,
                highlightMode,
                onStreamOpen: () => {
                  lastActivityTimestamp = Date.now();
                  addLog(interpolate(dict.logs.streamConnected, { name: currentVideo.name }));
                },
                onReasoningDelta: (_chunk, fullText) => {
                  lastActivityTimestamp = Date.now();
                  if (!liveReasoning) {
                    addLog(interpolate(dict.logs.reasoningStarted, { name: currentVideo.name }));
                  }
                  liveReasoning = fullText;
                  syncLiveText();
                  updateAnalyzeProgress(0.01);
                },
                onContentDelta: (_chunk, fullText) => {
                  lastActivityTimestamp = Date.now();
                  if (!liveContent) {
                    addLog(interpolate(dict.logs.jsonStarted, { name: currentVideo.name }));
                  }
                  liveContent = fullText;
                  syncLiveText();
                  updateAnalyzeProgress(0.01);
                },
                onFallback: (reason) => {
                  lastActivityTimestamp = Date.now();
                  console.warn(`[Video] Stream fallback (${currentVideo.name}):`, reason);
                  addLog(interpolate(dict.logs.streamFallback, { name: currentVideo.name }));
                },
                onActivity: () => {
                  lastActivityTimestamp = Date.now();
                },
                onQueueUpdate: (info) => {
                  lastActivityTimestamp = Date.now();

                  // 자체 대기열 워커가 흘려보내는 실시간 추론 미리보기를
                  // 진행 로그 영역에 그대로 노출한다. (추론 시작 즉시 표시)
                  const reasoningPreview = (info.reasoningPreview || '').trim();
                  if (reasoningPreview && reasoningPreview !== liveReasoning) {
                    if (!liveReasoning) {
                      addLog(interpolate(dict.logs.reasoningStarted, { name: currentVideo.name }));
                    }
                    liveReasoning = reasoningPreview;
                    syncLiveText();
                  }

                  queueInfo = {
                    isQueued: info.status === 'queued',
                    position: info.queuePosition,
                    etaSec: info.estimatedWaitSec,
                    jobId: info.jobId,
                  };
                  if (info.jobId) activeQueueJobIdsRef.current.add(info.jobId);

                  if (info.status !== queueLoggedStatus) {
                    queueLoggedStatus = info.status;
                    if (info.status === 'queued') {
                      const position = Math.max(0, info.queuePosition ?? 0);
                      const etaSec = Math.max(0, Math.round(info.estimatedWaitSec ?? 0));
                      addLog(ui('⏳ [{name}] 대기열에 등록되었습니다. 내 앞 대기자 {position}명 · 예상 대기 {eta}초', {
                        name: currentVideo.name,
                        position,
                        eta: etaSec,
                      }));
                    } else if (info.status === 'processing') {
                      addLog(ui('🚀 [{name}] 대기열 순서가 되어 분석을 시작합니다.', {
                        name: currentVideo.name,
                      }));
                    }
                  }

                  updateAnalyzeProgress(0);
                },
                onQueueFallback: (reason) => {
                  lastActivityTimestamp = Date.now();
                  // 폴링 도중 실패한 경우 서버에 남은 작업을 정리해 중복 분석을 막는다.
                  if (queueInfo.jobId) {
                    void cancelVideoAnalysisJob(queueInfo.jobId);
                  }
                  if (queueInfo.jobId) activeQueueJobIdsRef.current.delete(queueInfo.jobId);
                  queueInfo = { isQueued: false };
                  console.warn(`[Video] Queue fallback (${currentVideo.name}):`, reason);
                  addLog(ui('ℹ️ [{name}] 대기열을 사용할 수 없어 기존 AI 게이트웨이로 연결합니다.', {
                    name: currentVideo.name,
                  }));
                  updateAnalyzeProgress(0);
                },
              });

              if (segments && segments.length > 0) {
                videoSuccess = true;
              }
            } catch (vidErr: unknown) {
              if (signal.aborted) throw vidErr;
              const errMsg = vidErr instanceof Error ? vidErr.message : String(vidErr);
              console.warn(`[Video] Video ${currentVideo.name} attempt ${attempt + 1} failed:`, errMsg);

              // 실패한 시도의 대기열 작업이 서버에 남아 있으면 정리한다.
              if (queueInfo.jobId) {
                void cancelVideoAnalysisJob(queueInfo.jobId);
              }
              resetQueueState();

              if (attempt < maxVideoAttempts - 1) {
                addLog(`🔄 [${currentVideo.name}] 백그라운드 지연/연결 정체 감지로 자동 재개합니다 (${attempt + 2}/${maxVideoAttempts})`);
                await new Promise((r) => setTimeout(r, 600));
              } else {
                // 2회 실패 시 파이프라인 전체 중단 방지를 위해 스마트 로컬 클라이맥스 자동 대체
                addLog(`⚠️ [${currentVideo.name}] AI 응답 불가로 최적 스마트 로컬 클라이맥스 구간으로 자동 복구하여 작업을 이어갑니다.`);
                segments = await analyzeVideoHighlights({
                  frames,
                  videoDuration: effectiveDuration,
                  videoId: currentVideo.id,
                  videoName: currentVideo.name,
                  model: 'smart-local-fallback',
                  reasoningEffort: 'none',
                  config: DEFAULT_CONFIG,
                  signal: undefined,
                  metadataDate: currentVideo.metadataDate,
                  latitude: currentVideo.latitude,
                  longitude: currentVideo.longitude,
                  locationName: currentVideo.locationName,
                  locale,
                  highlightMode,
                  useQueue: false,
                });
                videoSuccess = true;
              }
            } finally {
              signal.removeEventListener('abort', onParentAbort);
              activeControllers.delete(i);
            }
          }
        } finally {
          window.clearInterval(analyzeSmoothTimer);
          unbindHeartbeat();
        }

        // 어떤 경로로도 업로드된 영상이 0컷으로 누락되지 않도록 최소 1컷 불변식을 보장한다.
        if (!segments || segments.length === 0) {
          segments = parseAndValidateSegments(
            '',
            effectiveDuration,
            currentVideo.id,
            currentVideo.name,
            currentVideo.metadataDate,
            currentVideo.latitude,
            currentVideo.longitude,
            currentVideo.locationName,
            highlightMode
          );
        }

        // 분석이 끝난 뒤에는 대기열 상태를 즉시 지워 다음 영상/모달에 남지 않게 한다.
        resetQueueState();

        // 해당 영상 분석 성공 완료 시: 자기 슬롯을 완료로 표시 (집계기가 완료 수를 계산한다)
        // 전체 진행률 상한은 flushAggregateProgress의 Math.min(99, ...)가 담당하므로
        // 병렬 완료 순서와 무관하게 모든 영상이 100%로 표시되어야 한다.
        videoLocalPct = 100;
        publish({
          stage: 'done',
          queuePosition: undefined,
          estimatedWaitSec: undefined,
        });

        syncLiveText();
        if (liveReasoning) {
          addLog(interpolate(dict.logs.reasoningComplete, {
            name: currentVideo.name,
            chars: liveReasoning.length.toLocaleString(),
          }));
        }

        currentVideo.segments = segments;
        currentVideo.analysisMode = highlightMode;
        currentVideo.status = 'analyzed';
        setVideos([...updatedVideos]);

        // AI 추천 타이틀 및 베스트 썸네일 정보 수집 (최종 반영은 영상 순서대로)
        const segSuggestedTitle = (segments as any)?.suggestedTitle;
        const segThumbTime = (segments as any)?.bestThumbnailTimestamp;
        const segThumbReason = (segments as any)?.bestThumbnailReason;

        // AI가 추천한 타임스탬프와 가장 가까운 클린 키프레임 추출 (오버레이 없는 순수 이미지)
        const closestFrame = typeof segThumbTime === 'number' && frames.length > 0
          ? frames.reduce((prev, curr) =>
              Math.abs(curr.timestamp - segThumbTime) < Math.abs(prev.timestamp - segThumbTime) ? curr : prev
            , frames[0])
          : frames[0];

        videoMetaResults[i] = {
          suggestedTitle: segSuggestedTitle,
          thumbTime: typeof segThumbTime === 'number' ? segThumbTime : (closestFrame?.timestamp ?? 0.5),
          reason: segThumbReason || segments[0]?.reason || 'AI가 선정한 하이라이트 순간',
          crop: segments[0]?.cropOffsetYRatio ?? 0.2,
          cropX: segments[0]?.cropOffsetXRatio ?? 0.5,
          rotation: segments[0]?.rotation ?? 0,
          cleanDataUrl: closestFrame?.dataUrl || '',
        };

        // 분석이 끝난 영상의 추출 프레임 배열을 즉시 비워 가비지 컬렉션 유도
        frames.length = 0;

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
      };

      // 2~4개 영상을 동시에 분석한다. 한 영상이 끝나면 워커가 다음 대기 영상을 즉시 집어간다.
      // 각 워커가 프레임 추출도 바로 수행하므로, 어떤 영상의 AI 응답을 기다리는 동안
      // 다음 영상의 프레임 추출이 함께 진행된다(파이프라이닝).
      let nextVideoIndex = 0;
      const runVideoWorker = async () => {
        while (!signal.aborted) {
          const index = nextVideoIndex++;
          if (index >= totalVideos) return;
          await analyzeOneVideo(index);
        }
      };

      // 워커와 무관하게 200ms마다 딱 한 번만 화면을 갱신한다.
      flushAggregateProgress();
      const aggregateTimer = window.setInterval(flushAggregateProgress, 200);
      const unbindAggregateHeartbeat = backgroundGuard.onTick(flushAggregateProgress);
      try {
        await Promise.all(
          Array.from(
            { length: Math.min(VIDEO_ANALYSIS_CONCURRENCY, totalVideos) },
            () => runVideoWorker()
          )
        );
      } finally {
        window.clearInterval(aggregateTimer);
        unbindAggregateHeartbeat();
        flushAggregateProgress();
      }
      if (signal.aborted) throw new Error(dict.logs.cancelledByUser);

      // 병렬 완료 순서와 무관하게 영상 번호 순으로 제목/썸네일 우선순위를 확정한다.
      for (let i = 0; i < videoMetaResults.length; i++) {
        const meta = videoMetaResults[i];
        if (!meta) continue;
        if (meta.suggestedTitle && !aiDiscoveredTitle) aiDiscoveredTitle = meta.suggestedTitle;

        // 대량 영상(예: 16~100개) 분석 시 cleanDataUrl 문자열 누적을 방지하기 위해 상위 24개까지만 보관
        aiThumbnailRecommendations.push({
          videoId: updatedVideos[i].id,
          videoName: updatedVideos[i].name,
          timestamp: meta.thumbTime,
          reason: meta.reason,
          cleanDataUrl: aiThumbnailRecommendations.length < 24 ? meta.cleanDataUrl : '',
          cropOffsetYRatio: meta.crop,
          cropOffsetXRatio: meta.cropX,
          rotation: meta.rotation,
        });

        if (!bestThumbTimestamp || i === 0) {
          bestThumbTimestamp = meta.thumbTime;
          bestThumbVideoId = updatedVideos[i].id;
          bestThumbCropOffsetYRatio = meta.crop;
          bestThumbRotation = meta.rotation;
          bestThumbReason = meta.reason;
          bestThumbCleanDataUrl = meta.cleanDataUrl;
        }
      }

      // 2. 실시간 타임라인 시퀀스 구성 (초기 인코딩 없이 즉시 실시간 프리뷰 진입)
      // 영상별 AI 추론 미리보기가 남아 있으면 후처리 단계 안내 문구를 가려 99%에서 멈춘 것처럼 보이므로 비운다.
      setProgress((prev) => ({
        ...prev,
        liveReasoning: '',
        liveContent: '',
        statusMessage: ui('전체 흐름에 맞춰 자막을 다듬고 있어요...'),
      }));

      const rawSegments = updatedVideos.flatMap((v) => v.segments);
      if (rawSegments.length === 0) {
        throw new Error(dict.logs.noClimaxFound);
      }
      const allSegments = getStoredAutoSortByRecordedTime()
        ? sortSegmentsByRecordedTime(rawSegments, new Map(updatedVideos.map((v) => [v.id, v])))
        : rawSegments;

      // 2-1. 전체 맥락 기반 자막 브이로그화 정제 (감성 브이로그 디폴트 톤 적용)
      try {
        const storedTone = getStoredSubtitleTone();
        addLog(`✨ 전체 맥락을 분석하여 브이로그 자막으로 다듬는 중... (${storedTone})`);
        const refinedMap = await refineSubtitlesWithContext({
          segments: allSegments,
          tone: storedTone,
          videoTitle: aiDiscoveredTitle || '',
          locale,
          model: selectedModel,
          signal,
          highlightMode,
          onProgress: (done, total) =>
            setProgress((prev) => ({
              ...prev,
              statusMessage: ui('자막을 다듬고 있어요... ({done}/{total})', { done, total }),
            })),
        });

        for (const seg of allSegments) {
          if (refinedMap[seg.id]) {
            seg.subtitleTitle = refinedMap[seg.id];
          }
        }
        for (const uv of updatedVideos) {
          for (const s of uv.segments) {
            if (refinedMap[s.id]) {
              s.subtitleTitle = refinedMap[s.id];
            }
          }
        }
        setVideos([...updatedVideos]);
        addLog('✨ 전체 맥락에 어울리는 자연스러운 브이로그 자막으로 다듬었습니다.');
      } catch (refineErr) {
        console.warn('[Subtitle] Contextual refine error:', refineErr);
      }

      // AI가 추천한 제목이 있고, 사용자가 직접 수정한 제목이 없으면 자동 적용
      const isDefaultOrEmptyTitle =
        !overlayOpts?.titleText ||
        !overlayOpts.titleText.trim() ||
        overlayOpts.titleText.trim() === dict.player.defaultTitleText.trim();

      if (aiDiscoveredTitle && isDefaultOrEmptyTitle) {
        if (!overlayOpts) {
          overlayOpts = {
            showTitle: true,
            titleText: aiDiscoveredTitle,
            showChannel: true,
            channelText: dict.player.defaultChannelText,
            showSubtitle: true,
            showDate: true,
            subtitleDateText: '',
            subtitleLocationText: '',
            showIntro: true,
            showOutro: true,
            showChapterBridge: true,
            introVideoFile: null,
            outroVideoFile: null,
          };
        } else {
          overlayOpts.titleText = aiDiscoveredTitle;
          overlayOpts.showTitle = true;
        }
      }

      // 3. 16:9 유튜브 고화질 썸네일 자동 생성
      setProgress((prev) => ({
        ...prev,
        step: 'processing',
        currentPhase: 'analyze',
        currentVideoIndex: totalVideos - 1,
        totalVideos,
        progressPercent: Math.floor(getOverallPct()),
        statusMessage: ui('AI 추천 썸네일 및 실시간 타임라인 준비 중...'),
        reasoningLogs: [...logs],
      }));

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
        const effectiveCropX = bestSeg?.cropOffsetXRatio ?? 0.5;
        const thumbFrame = resolveFrameSpec(currentOrientation, '720p', currentPortraitPlatform);
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
              thumbFrame.width,
              thumbFrame.height,
              effectiveRotation,
              effectiveCropX
            );
          } catch (sourceErr) {
            console.warn('Source video high-res frame capture failed, falling back to AI clean keyframe dataUrl:', sourceErr);
          }
        }

        // 2단계: 소스 비디오 직접 캡처 실패 시, AI 분석 단계에서 이미 추출해 둔 100% 클린 키프레임 사용 (오버레이 절대 미포함)
        if (!bgCanvas && bestThumbCleanDataUrl) {
          try {
            // bestThumbCleanDataUrl(AI 분석 키프레임)은 WebCodecs 디코딩 시
            // tkhd 회전이 이미 적용돼 있으므로 여기서 rotation을 다시 주면 이중 회전이 된다.
            bgCanvas = await createCanvasFromImageDataUrl(
              bestThumbCleanDataUrl,
              thumbFrame.width,
              thumbFrame.height,
              effectiveCrop,
              0,
              effectiveCropX
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
              thumbFrame.width,
              thumbFrame.height,
              0,
              0.5
            );
          } catch {}
        }

        if (bgCanvas) {
          cleanThumbnailUrl = bgCanvas.toDataURL('image/jpeg', 0.95);

          const finalTitle =
            (aiDiscoveredTitle && isDefaultOrEmptyTitle)
              ? aiDiscoveredTitle
              : overlayOpts?.titleText || aiDiscoveredTitle || dict.player.defaultTitleText;

          // 썸네일 아트워크 생성 (상단 왼쪽 문구, 오른쪽 문구, 날짜 등 일체 미포함)
          const thumbCanvas = renderThumbnailArtwork(bgCanvas, {
            titleText: finalTitle,
            channelText: '',
            badgeText: '',
            showTitle: Boolean(finalTitle?.trim()),
            showBadge: false,
            showChannel: false,
            stylePreset: 'youtube-bold',
          }, thumbFrame.width, thumbFrame.height);

          generatedThumbnailUrl = thumbCanvas.toDataURL('image/jpeg', 0.95);
          addLog(`🎉 AI 추천 썸네일 완성: ${bestThumbReason || '베스트 순간'}`);
        }
      } catch (thumbErr) {
        console.warn('Thumbnail generation warning:', thumbErr);
      }

      const bridgeMap = computeBridgeDurationMap(allSegments, overlayOpts);
      const introDur = overlayOpts?.showIntro ? 1.6 : 0;
      const outroDur = overlayOpts?.showOutro ? 1.8 : 0;
      const segsAndBridgesDur = allSegments.reduce(
        (sum, s) => sum + s.duration + (bridgeMap[s.id] ?? 0),
        0
      );
      const computedDuration = Math.round((introDur + segsAndBridgesDur + outroDur) * 10) / 10;
      const origTotalDuration = updatedVideos.reduce((sum, v) => sum + (v.duration || 0), 0);

      const result: FinalVideoResult = {
        blob: new Blob([]),
        url: '',
        duration: computedDuration,
        introDuration: introDur,
        outroDuration: outroDur,
        bridgeDurationMap: bridgeMap,
        segments: allSegments,
        originalTotalDuration: origTotalDuration,
        fileSize: 0,
        thumbnailUrl: generatedThumbnailUrl,
        cleanThumbnailUrl,
        suggestedTitle: aiDiscoveredTitle,
        bestThumbnailTime: bestThumbTimestamp,
        bestSourceVideoId: bestThumbVideoId,
        bestThumbnailReason: bestThumbReason,
        bestThumbnailCropOffsetYRatio: bestThumbCropOffsetYRatio,
        bestThumbnailRotation: bestThumbRotation,
        bestThumbnailCleanDataUrl: bestThumbCleanDataUrl,
        aiThumbnailRecommendations,
      };

      addLog(`✨ 실시간 하이라이트 타임라인 구성 완료 (${allSegments.length}개 구간, 총 ${computedDuration.toFixed(1)}초)`);

      setFinalResult(result);
      setProgress((prev) => ({
        ...prev,
        progressPercent: 100,
      }));
      setCurrentStep('result');
      window.location.hash = '#studio';
    } catch (err: unknown) {
      setProgress((prev) => ({
        ...prev,
        progressPercent: 0,
        statusMessage: '',
      }));
      if (signal.aborted) {
        console.info('Processing cancelled by user.');
        // handleCancel이 부분 결과를 저장했을 수 있으므로 완료된 영상이 있으면 결과 화면을 유지한다.
        const anyCompleted = updatedVideos.some(
          (v) => (v.segments?.length ?? 0) > 0
        );
        setCurrentStep(finalResult || anyCompleted ? 'result' : 'upload');
      } else {
        const msg = err instanceof Error ? err.message : dict.logs.genericError;
        console.error('Processing error:', err);
        const analyzedCount = updatedVideos.filter((v) => v.status === 'analyzed' && v.segments && v.segments.length > 0).length;
        const resumeNotice = analyzedCount > 0
          ? `\n\n💡 총 ${totalVideos}개 중 ${analyzedCount}개 영상의 분석 결과가 안전하게 보존되어 있어요. 다시 시작하시면 완료된 영상은 0초 만에 건너뛰고 멈춘 위치부터 즉시 이어져요.`
          : '';
        setErrorMessage(`${msg}${resumeNotice}`);
        setCurrentStep(finalResult ? 'result' : 'upload');
      }
    } finally {
      backgroundGuard.stop();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
        window.removeEventListener('focus', handleVisibilityOrFocus);
        window.removeEventListener('pageshow', handleVisibilityOrFocus);
      }
    }
  };

  // 번들된 6개의 16:9 데모 클립을 개별 File로 로드해 프로젝트에 넣는다.
  // 온보딩에서는 영상 준비(이 함수)와 AI 분석(사용자가 'AI 컷 분석' 클릭)을 단계별로 안내한다.
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const loadSampleVideos = async (): Promise<VideoItem[]> => {
    setErrorMessage(null);
    handleStartNewProject();
    const sampleClipIds = ['01', '02', '03', '04', '05', '06'] as const;
    const baseTime = Date.now();
    const blobs = await Promise.all(
      sampleClipIds.map(async (clipId) => {
        const res = await fetch(`${import.meta.env.BASE_URL}media/samples/demo-${clipId}.mp4`);
        if (!res.ok) {
          throw new Error(`샘플 영상(${clipId})을 불러오지 못했습니다 (${res.status})`);
        }
        return { clipId, blob: await res.blob() };
      })
    );

    const sampleItems: VideoItem[] = await Promise.all(
      blobs.map(async ({ clipId, blob }, idx) => {
        const recordedAtMs = baseTime + idx * 60_000;
        const file = new File([blob], `penguincut-demo-${clipId}.mp4`, {
          type: 'video/mp4',
          lastModified: recordedAtMs,
        });
        const url = URL.createObjectURL(file);
        let duration = 2.0;
        let width = 960;
        let height = 540;
        // 일반 업로드와 동일하게 대표 프레임을 뽑아 카드·컷 비행 연출에 사용한다.
        let thumbnailUrl = '';
        try {
          const meta = await extractVideoVisualDimensions(file, false);
          if (Number.isFinite(meta.duration) && meta.duration > 0) duration = meta.duration;
          if (meta.width > 0) width = meta.width;
          if (meta.height > 0) height = meta.height;
          if (meta.thumbnailUrl) thumbnailUrl = meta.thumbnailUrl;
        } catch {
          // 메타데이터 추출 실패 시 번들 클립의 기본 스펙(2.0s, 960x540)으로 진행한다.
        }
        return {
          id: `vid-sample-${baseTime}-${clipId}`,
          file,
          url,
          name: file.name,
          sizeBytes: file.size,
          duration,
          width,
          height,
          thumbnailUrl,
          recordedAtMs,
          status: 'idle',
          segments: [],
        };
      })
    );

    setVideos(sampleItems);
    return sampleItems;
  };

  // 첫 방문자가 파일을 찾지 못해 이탈하는 문제를 막는 원클릭 샘플 체험 (로드 + 분석까지 한 번에).
  const handleTrySampleVideo = async () => {
    if (isLoadingSample) return;
    setIsLoadingSample(true);
    try {
      const sampleItems = await loadSampleVideos();
      await handleStartProcessing(undefined, null, 'preset', 0.3, currentHighlightMode, sampleItems);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : '샘플 체험을 시작하지 못했습니다.'
      );
    } finally {
      setIsLoadingSample(false);
    }
  };

  // 최종 내보내기(인코딩 및 병합) 핸들러
  const handleReStitch = async (
    updatedSegments: HighlightSegment[],
    bgmPresetId = 'none',
    bgmVolume = 0.35,
    customAudioFile?: File | null,
    overlayOptions?: VideoOverlayOptions,
    resolution?: ExportResolution
  ): Promise<FinalVideoResult | null> => {
    if (updatedSegments.length === 0) return null;

    // 1. 영상 URL 갱신 및 파일 유효성 사전 검사
    const readyVideos = refreshVideoBlobUrls(videos);
    try {
      validateVideosForProcessing(readyVideos);
    } catch (vErr) {
      const msg = vErr instanceof Error ? vErr.message : '영상을 확인할 수 없습니다.';
      setErrorMessage(msg);
      return null;
    }
    setVideos(readyVideos);

    // 내보내기 클릭(제스처) 안에서 오디오를 미리 잠금 해제한다.
    primeAudioContext();

    // 내보내기/인코딩 중 화면 꺼짐 및 프로세스 동결 방지
    void backgroundGuard.start();

    setIsReStitching(true);
    setReStitchProgress({
      progressPercent: 0,
      statusMessage: interpolate(dict.logs.stitchingProgress, { count: updatedSegments.length }) || '영상 내보내기를 준비하고 있어요...',
    });
    setErrorMessage(null);

    try {
      // 병합 엔진(WebCodecs + mp4-muxer)은 내보내기 시점에만 필요하므로 지연 로딩한다.
      const { stitchHighlightedSegments } = await import('./services/videoStitcher.ts');
      const result = await stitchHighlightedSegments({
        videos: readyVideos,
        allSegments: updatedSegments,
        bgmPresetId,
        bgmVolume,
        customAudioFile,
        overlayOptions,
        resolution,
        orientation: currentOrientation,
        portraitPlatform: currentPortraitPlatform,
        onProgress: (pct, msg) => {
          setReStitchProgress({
            progressPercent: pct,
            statusMessage: msg,
          });
        },
      });

      result.thumbnailUrl = finalResult?.thumbnailUrl;
      result.cleanThumbnailUrl = finalResult?.cleanThumbnailUrl;
      result.suggestedTitle = finalResult?.suggestedTitle;
      result.bestThumbnailTime = finalResult?.bestThumbnailTime;
      result.bestSourceVideoId = finalResult?.bestSourceVideoId;
      result.bestThumbnailReason = finalResult?.bestThumbnailReason;
      result.bestThumbnailCropOffsetYRatio = finalResult?.bestThumbnailCropOffsetYRatio;
      result.bestThumbnailRotation = finalResult?.bestThumbnailRotation;
      result.bestThumbnailCleanDataUrl = finalResult?.bestThumbnailCleanDataUrl;
      result.aiThumbnailRecommendations = finalResult?.aiThumbnailRecommendations;

      const oldResultUrl = finalResult?.url;
      setFinalResult(result);
      if (oldResultUrl && oldResultUrl.startsWith('blob:')) {
        setTimeout(() => {
          try {
            URL.revokeObjectURL(oldResultUrl);
          } catch {}
        }, 1500);
      }
      return result;
    } catch (err) {
      console.error('Export stitching error:', err);
      setErrorMessage(err instanceof Error ? err.message : dict.logs.reStitchError);
      return null;
    } finally {
      setIsReStitching(false);
      backgroundGuard.stop();
    }
  };

  // 취소 핸들러
  const handleCancel = () => {
    // 병렬로 등록된 대기열 작업을 모두 취소해 순번을 반환한다.
    for (const queueJobId of activeQueueJobIdsRef.current) {
      void cancelVideoAnalysisJob(queueJobId);
    }
    activeQueueJobIdsRef.current.clear();

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setProgress((prev) => ({
      ...prev,
      progressPercent: 0,
      statusMessage: '',
      liveReasoning: '',
      liveContent: '',
      isQueued: false,
      queuePosition: undefined,
      estimatedWaitSec: undefined,
      jobId: undefined,
    }));
    // 분석 도중 중지하더라도 이미 완료되어 타임라인에 착지한 영상은 부분 결과로 보존한다.
    const completedVideos = videos.filter((v) => (v.segments?.length ?? 0) > 0);
    const partialSegments = completedVideos.flatMap((v) => v.segments);
    let hasPartialResult = false;
    if (!finalResult && partialSegments.length > 0) {
      const sortedSegments = getStoredAutoSortByRecordedTime()
        ? sortSegmentsByRecordedTime(
            partialSegments,
            new Map(completedVideos.map((v) => [v.id, v]))
          )
        : partialSegments;
      const bridgeMap = computeBridgeDurationMap(sortedSegments, currentOverlayOptions ?? undefined);
      const introDur = currentOverlayOptions?.showIntro ? 1.6 : 0;
      const outroDur = currentOverlayOptions?.showOutro ? 1.8 : 0;
      const segmentsDuration = sortedSegments.reduce(
        (sum, s) => sum + s.duration + (bridgeMap[s.id] ?? 0),
        0
      );
      setFinalResult({
        blob: new Blob([]),
        url: '',
        duration: Math.round((introDur + segmentsDuration + outroDur) * 10) / 10,
        introDuration: introDur,
        outroDuration: outroDur,
        bridgeDurationMap: bridgeMap,
        segments: sortedSegments,
        originalTotalDuration: completedVideos.reduce((sum, v) => sum + (v.duration || 0), 0),
        fileSize: 0,
      });
      hasPartialResult = true;
    }
    setCurrentStep(finalResult || hasPartialResult ? 'result' : 'upload');
  };

  const handleReset = (orientation?: VideoOrientation, platform?: PortraitPlatform) => {
    handleStartNewProject(orientation, platform);
  };


  // V2 / 레거시가 동일한 상태·핸들러를 공유하도록 props를 한 곳에서 조립한다.
  const sharedStudioProps = {
    result: finalResult,
    onUpdateFinalResult: setFinalResult,
    videos,
    models,
    selectedModel,
    onSelectModel: setSelectedModel,
    selectedEffort,
    onSelectEffort: setSelectedEffort,
    isLoadingModels,
    onFilesSelected: handleFilesSelected,
    onRemoveVideo: handleRemove,
    onUpdateVideoLocation: handleUpdateVideoLocation,
    onUpdateVideoRotation: handleUpdateVideoRotation,
    onStartAiAnalysis: handleStartProcessing,
    isProcessing: currentStep === 'processing',
    isPreparingVideos: activeVideoMetaBatches > 0,
    progress,
    onCancelProcessing: handleCancel,
    onReset: handleReset,
    onReStitch: handleReStitch,
    isReStitching,
    reStitchProgress,
    onStartNewProject: handleStartNewProject,
    onTrySampleVideo: handleTrySampleVideo,
    onLoadSampleVideos: loadSampleVideos,
    isLoadingSample,
    initialOverlayOptions: currentOverlayOptions,
    initialHighlightMode: currentHighlightMode,
    onHighlightModeChange: handleHighlightModeChange,
    initialBgmPresetId: currentBgmPresetId,
    initialBgmVolume: currentBgmVolume,
    initialCustomAudioFile: currentCustomAudio,
    initialSelectedLibraryTrackId: currentLibraryTrackId,
    onOverlayOptionsChange: handleOverlayOptionsChange,
    onBgmChange: handleBgmChange,
    onCustomAudioChange: handleCustomAudioChange,
    onRelinkVideo: handleRelinkSingleVideo,
    onRelinkBatch: handleRelinkBatch,
    orientation: currentOrientation,
    portraitPlatform: currentPortraitPlatform,
  };

  return (
    <div className="toss-app-root">
      <Toaster position="top-center" theme="dark" />
      {errorMessage && (
        <div className="studio-error-banner flex-col items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300">
          <div className="flex items-center gap-2 w-full">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span className="font-bold text-xs text-red-200">
              {dict.common.errorStitching || '영상 병합 중 오류가 발생했습니다'}
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(errorMessage).catch(() => {});
                notify.success(dict.common.reportCopied || '진단 리포트가 클립보드에 복사되었습니다.');
              }}
              className="ml-auto text-[10px] font-bold px-2 py-0.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded border border-red-500/30"
            >
              {dict.common.copyReport || '리포트 복사'}
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

      {STUDIO_V2_ENABLED ? (
        <CenterStudioView
          {...sharedStudioProps}
          onOrientationChange={setCurrentOrientation}
          onPortraitPlatformChange={setCurrentPortraitPlatform}
        />
      ) : (
        <ProStudioView {...sharedStudioProps} />
      )}

    </div>
  );
}

export default App;
