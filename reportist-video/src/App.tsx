// App.tsx - Reportist Video 메인 애플리케이션 (i18n 다국어 지원)

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { computeBridgeDurationMap } from './services/hyperframesBridgeRenderer.ts';
import { captureVideoFrameAtTime, createCanvasFromImageDataUrl, renderThumbnailArtwork } from './services/thumbnailGenerator.ts';
import type { FreeModelMeta, ReasoningEffortOption } from './types/gateway.ts';
import type {
  VideoItem,
  OverallStep,
  ProcessingProgress,
  FinalVideoResult,
  HighlightSegment,
  VideoOverlayOptions,
  ExportResolution,
} from './types/video.ts';
import type { StudioProject, StudioProjectSummary } from './types/project.ts';
import {
  generateProjectId,
  getLastActiveProjectId,
  setLastActiveProjectId,
  saveProject,
  getProject,
  getAllProjectSummaries,
  deleteProject,
  duplicateProject,
} from './services/projectStorage.ts';
import { saveVideoToOPFS } from './services/opfsStorage.ts';
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

  // 4. 프로젝트 보관함 & IndexedDB 상태
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const [projectSummaries, setProjectSummaries] = useState<StudioProjectSummary[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(true);

  // 편집 설정 상태
  const [currentOverlayOptions, setCurrentOverlayOptions] = useState<VideoOverlayOptions | null>(null);
  const [currentBgmPresetId, setCurrentBgmPresetId] = useState<string>('none');
  const [currentBgmVolume, setCurrentBgmVolume] = useState<number>(0.3);
  const [currentCustomAudio, setCurrentCustomAudio] = useState<File | null>(null);

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
        prev.showChapterBridge === newOpts.showChapterBridge &&
        prev.bgmFitToVideo === newOpts.bgmFitToVideo
      ) {
        return prev;
      }
      return newOpts;
    });
  }, []);

  const isRestoringProjectRef = useRef<boolean>(false);
  const autoSaveTimerRef = useRef<number | null>(null);

  // 프로젝트 요약 목록 새로고침
  const refreshProjectSummaries = async () => {
    try {
      setIsLoadingProjects(true);
      const list = await getAllProjectSummaries();
      setProjectSummaries(list);
    } catch (err) {
      console.warn('Failed to list projects:', err);
    } finally {
      setIsLoadingProjects(false);
    }
  };

  // 특정 프로젝트 로드
  const handleOpenProject = async (projectId: string) => {
    try {
      if (projectId === currentProjectId && (videos.length > 0 || finalResult)) {
        return;
      }

      const project = await getProject(projectId);
      if (!project) return;

      isRestoringProjectRef.current = true;

      // 이전 ObjectURL 수집 (DOM 전환 후 비동기로 안전하게 해제하여 ERR_FILE_NOT_FOUND 방지)
      const urlsToRevoke: string[] = [];
      videos.forEach((v: VideoItem) => {
        if (v.url && v.url.startsWith('blob:')) urlsToRevoke.push(v.url);
      });
      if (finalResult?.url && finalResult.url.startsWith('blob:')) {
        urlsToRevoke.push(finalResult.url);
      }

      // 비디오 목록 복원 (유효한 Blob인 경우에만 ObjectURL 생성)
      const restoredVideos: VideoItem[] = (project.videos || []).map((v) => {
        const blob = v.fileBlob;
        const hasValidBlob = Boolean(blob instanceof Blob && blob.size > 0);
        const file =
          blob instanceof File
            ? blob
            : blob instanceof Blob && blob.size > 0
            ? new File([blob], v.name, {
                type: blob.type || 'video/mp4',
                lastModified: v.recordedTimestamp || Date.now(),
              })
            : new File([], v.name, { type: 'video/mp4' });
        const url = hasValidBlob ? URL.createObjectURL(file) : '';
        const safeThumb =
          v.thumbnailUrl && !v.thumbnailUrl.startsWith('blob:')
            ? v.thumbnailUrl
            : '';
        return {
          id: v.id,
          file,
          url,
          name: v.name,
          sizeBytes: v.sizeBytes,
          duration: v.duration,
          width: v.width,
          height: v.height,
          // 파일 데이터가 소실된 경우 status를 idle로 리셋하고 재연결 플래그 설정
          status: hasValidBlob ? v.status : 'idle',
          error: hasValidBlob ? undefined : '로컬 원본 영상 재연결이 필요합니다.',
          isMissingFile: !hasValidBlob,
          segments: v.segments || [],
          metadataDate: v.metadataDate,
          recordedTimestamp: v.recordedTimestamp,
          latitude: v.latitude,
          longitude: v.longitude,
          locationName: v.locationName,
          thumbnailUrl: safeThumb,
        };
      });

      // 최종 결과 복원 (실시간 타임라인 편집 모드: 세그먼트가 있거나 유효한 Blob인 경우 복원)
      let restoredResult: FinalVideoResult | null = null;
      const finalBlob = project.finalResult?.videoBlob;
      const hasValidFinalBlob = Boolean(finalBlob instanceof Blob && finalBlob.size > 0);
      const hasSegments = Boolean(
        project.finalResult?.segments && project.finalResult.segments.length > 0
      );
      if (project.finalResult && (hasValidFinalBlob || hasSegments)) {
        const url = hasValidFinalBlob && finalBlob ? URL.createObjectURL(finalBlob) : '';
        const safeFinalThumb =
          project.finalResult.thumbnailUrl && !project.finalResult.thumbnailUrl.startsWith('blob:')
            ? project.finalResult.thumbnailUrl
            : undefined;
        const safeCleanThumb =
          project.finalResult.cleanThumbnailUrl && !project.finalResult.cleanThumbnailUrl.startsWith('blob:')
            ? project.finalResult.cleanThumbnailUrl
            : undefined;
        restoredResult = {
          blob: hasValidFinalBlob && finalBlob ? finalBlob : new Blob([]),
          url,
          duration: project.finalResult.duration,
          width: project.finalResult.width || (project.finalResult.resolution === '1080p' ? 1920 : 1280),
          height: project.finalResult.height || (project.finalResult.resolution === '1080p' ? 1080 : 720),
          resolution: project.finalResult.resolution || project.exportResolution,
          segments: project.finalResult.segments || [],
          originalTotalDuration: project.duration || 0,
          fileSize: project.finalResult.fileSize || 0,
          thumbnailUrl: safeFinalThumb,
          cleanThumbnailUrl: safeCleanThumb,
          suggestedTitle: project.finalResult.suggestedTitle,
          bestThumbnailTime: project.finalResult.bestThumbnailTime,
          bestSourceVideoId: project.finalResult.bestSourceVideoId,
          bestThumbnailReason: project.finalResult.bestThumbnailReason,
          bestThumbnailCropOffsetYRatio: project.finalResult.bestThumbnailCropOffsetYRatio,
          bestThumbnailRotation: project.finalResult.bestThumbnailRotation,
          bestThumbnailCleanDataUrl: project.finalResult.bestThumbnailCleanDataUrl,
          aiThumbnailRecommendations: project.finalResult.aiThumbnailRecommendations,
        };
      }

      // 커스텀 오디오 복원
      let restoredAudioFile: File | null = null;
      if (project.customAudioBlob) {
        restoredAudioFile = new File(
          [project.customAudioBlob],
          project.customAudioName || 'audio.mp3',
          { type: project.customAudioBlob.type || 'audio/mpeg' }
        );
      }

      setVideos(restoredVideos);
      setFinalResult(restoredResult);
      setCurrentStep(restoredResult ? 'result' : 'upload');
      setCurrentProjectId(project.id);
      setLastActiveProjectId(project.id);

      if (project.overlayOptions) {
        setCurrentOverlayOptions(project.overlayOptions);
      }
      if (project.bgmPresetId) {
        setCurrentBgmPresetId(project.bgmPresetId);
      }
      if (typeof project.bgmVolume === 'number') {
        setCurrentBgmVolume(project.bgmVolume);
      }
      setCurrentCustomAudio(restoredAudioFile);

      if (project.selectedModel) {
        const isExcluded =
          project.selectedModel.toLowerCase().includes('gemma');
        if (!isExcluded) {
          setSelectedModel(project.selectedModel);
        }
      }
      if (project.selectedEffort) {
        setSelectedEffort(project.selectedEffort);
      }

      setSaveStatus('saved');
      await refreshProjectSummaries();

      // 브라우저 렌더러가 새 미디어 소스로 완전히 전환한 후 이전 ObjectURL 안전하게 해제
      if (urlsToRevoke.length > 0) {
        setTimeout(() => {
          urlsToRevoke.forEach((u) => {
            try {
              URL.revokeObjectURL(u);
            } catch {}
          });
        }, 1500);
      }
    } catch (err) {
      console.error('Failed to open project:', err);
    } finally {
      setTimeout(() => {
        isRestoringProjectRef.current = false;
      }, 500);
    }
  };

  // 새 작업 시작
  const handleStartNewProject = () => {
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
    setCurrentProjectId(generateProjectId());
    setLastActiveProjectId(null);
    setCurrentOverlayOptions(null);
    setCurrentBgmPresetId('none');
    setCurrentBgmVolume(0.3);
    setCurrentCustomAudio(null);

    if (urlsToRevoke.length > 0) {
      setTimeout(() => {
        urlsToRevoke.forEach((u) => {
          try {
            URL.revokeObjectURL(u);
          } catch {}
        });
      }, 1000);
    }
    setCurrentProjectId(null);
    setSaveStatus('idle');
  };

  // 프로젝트 복제
  const handleDuplicateProject = async (id: string) => {
    try {
      await duplicateProject(id);
      await refreshProjectSummaries();
    } catch (err) {
      console.error('Failed to duplicate project:', err);
    }
  };

  // 프로젝트 삭제
  const handleDeleteProject = async (id: string) => {
    try {
      await deleteProject(id);
      if (currentProjectId === id) {
        handleStartNewProject();
      }
      await refreshProjectSummaries();
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  // 자동 저장 수행
  const performSave = async () => {
    if (videos.length === 0 || currentStep === 'processing' || isRestoringProjectRef.current) {
      if (videos.length === 0) setSaveStatus('idle');
      return;
    }

    const projId = currentProjectId || generateProjectId();
    if (!currentProjectId) {
      setCurrentProjectId(projId);
    }

    setSaveStatus('saving');

    try {
      const storedVideos = videos.map((v) => ({
        id: v.id,
        name: v.name,
        sizeBytes: v.sizeBytes,
        duration: v.duration,
        width: v.width,
        height: v.height,
        status: v.status,
        segments: v.segments || [],
        metadataDate: v.metadataDate,
        recordedTimestamp: v.recordedTimestamp,
        latitude: v.latitude,
        longitude: v.longitude,
        locationName: v.locationName,
        thumbnailUrl: v.thumbnailUrl && !v.thumbnailUrl.startsWith('blob:') ? v.thumbnailUrl : undefined,
        fileBlob: v.file,
      }));

      const projectTitle =
        currentOverlayOptions?.titleText ||
        finalResult?.suggestedTitle ||
        (videos[0]?.name
          ? `${videos[0].name.replace(/\.[^/.]+$/, '')} ${dict.projects?.projectSuffix || '작업'}`
          : dict.projects?.newProjectTitle || '새 스튜디오 작업');

      const safeFinalThumb =
        finalResult?.thumbnailUrl && !finalResult.thumbnailUrl.startsWith('blob:')
          ? finalResult.thumbnailUrl
          : undefined;
      const safeVideoThumb =
        videos[0]?.thumbnailUrl && !videos[0].thumbnailUrl.startsWith('blob:')
          ? videos[0].thumbnailUrl
          : undefined;

      const projectData: StudioProject = {
        id: projId,
        title: projectTitle,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        thumbnailUrl: safeFinalThumb || safeVideoThumb,
        duration: finalResult?.duration || videos.reduce((acc, v) => acc + (v.duration || 0), 0),
        videoCount: videos.length,
        step: finalResult ? 'result' : 'upload',
        videos: storedVideos,
        finalResult: finalResult
          ? {
              videoBlob: finalResult.blob,
              duration: finalResult.duration,
              fileSize: finalResult.fileSize,
              width: finalResult.width || (finalResult.resolution === '1080p' ? 1920 : 1280),
              height: finalResult.height || (finalResult.resolution === '1080p' ? 1080 : 720),
              resolution: finalResult.resolution,
              segments: finalResult.segments,
              suggestedTitle: finalResult.suggestedTitle,
              thumbnailUrl: finalResult.thumbnailUrl,
              cleanThumbnailUrl: finalResult.cleanThumbnailUrl,
              bestThumbnailTime: finalResult.bestThumbnailTime,
              bestSourceVideoId: finalResult.bestSourceVideoId,
              bestThumbnailReason: finalResult.bestThumbnailReason,
              bestThumbnailCropOffsetYRatio: finalResult.bestThumbnailCropOffsetYRatio,
              bestThumbnailRotation: finalResult.bestThumbnailRotation,
              bestThumbnailCleanDataUrl: finalResult.bestThumbnailCleanDataUrl,
              aiThumbnailRecommendations: finalResult.aiThumbnailRecommendations,
            }
          : null,
        overlayOptions: currentOverlayOptions || undefined,
        bgmPresetId: currentBgmPresetId,
        bgmVolume: currentBgmVolume,
        customAudioBlob: currentCustomAudio,
        customAudioName: currentCustomAudio?.name,
        selectedModel,
        selectedEffort,
        exportResolution: finalResult?.resolution,
      };

      await saveProject(projectData);
      setLastActiveProjectId(projId);
      setSaveStatus('saved');
      await refreshProjectSummaries();
    } catch (err) {
      console.warn('Auto-save failed:', err);
      setSaveStatus('saved');
    }
  };

  // 변경 감지 시 자동 저장 (Debounced)
  useEffect(() => {
    if (videos.length === 0 || currentStep === 'processing' || isRestoringProjectRef.current) {
      if (videos.length === 0) {
        setSaveStatus('idle');
      }
      return;
    }

    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    setSaveStatus('saving');
    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      void performSave();
    }, 600);

    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [
    videos,
    finalResult,
    currentOverlayOptions,
    currentBgmPresetId,
    currentBgmVolume,
    currentCustomAudio,
    currentStep,
  ]);

  // 최초 마운트 시 저장소 초기화 및 마지막 활성 프로젝트 복원
  useEffect(() => {
    let isMounted = true;
    async function initProjects() {
      await refreshProjectSummaries();
      const lastId = getLastActiveProjectId();
      if (lastId && isMounted) {
        await handleOpenProject(lastId);
      } else if (isMounted && !currentProjectId) {
        setCurrentProjectId(generateProjectId());
      }
    }
    void initProjects();
    return () => {
      isMounted = false;
    };
  }, []);

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

  // 파일 업로드 핸들러 (16~100개 이상 대량 업로드 시에도 리렌더링 폭주 및 디코더 크래시가 없도록 배치 등록 & 동시성 제한 큐 적용)
  const handleFilesSelected = async (newFiles: File[]) => {
    if (newFiles.length === 0) return;
    setErrorMessage(null);

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

    // 1회 배치 상태 업데이트로 N번 연속 리렌더링 방지
    setVideos((prev) => [...prev, ...createdItems.map((c) => c.item)]);

    // 최대 2개 워커로 순차 메타데이터(해상도/썸네일/촬영일자/GPS) 추출하여 하드웨어 디코더 및 메모리 스파이크 원천 차단
    let cursor = 0;
    const workerCount = Math.min(2, createdItems.length);
    const runWorker = async () => {
      while (cursor < createdItems.length) {
        const currentIndex = cursor++;
        const { videoId, file } = createdItems[currentIndex];
        try {
          const [visualMeta, mediaMeta] = await Promise.all([
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
          ]);

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
        } catch (err) {
          console.warn('Metadata extraction error:', err);
        }
      }
    };

    void Promise.all(Array.from({ length: workerCount }, () => runWorker()));
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
    if (currentProjectId) {
      void saveVideoToOPFS(currentProjectId, videoId, newFile);
    }
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
          if (currentProjectId) {
            void saveVideoToOPFS(currentProjectId, v.id, match);
          }
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
      alert(`${matchedCount}개의 영상 파일이 정상적으로 재연결되었습니다.`);
    } else {
      alert('선택하신 파일 중 이름이나 용량이 일치하는 영상이 없습니다. 개별 연결을 사용해 주세요.');
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
    bgmVol = 0.35
  ) => {
    if (videos.length === 0) return;

    // 1. 영상 URL 갱신 및 파일 유효성 사전 검사
    const readyVideos = refreshVideoBlobUrls(videos);
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

    setCurrentStep('processing');
    setErrorMessage(null);
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const totalVideos = readyVideos.length;
    const updatedVideos = [...readyVideos];
    const logs: string[] = [];

    // 진행율 완전 초기화 (이전 실행 결과로 인한 99%/100% 잔여값 방지)
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

    // 1/N 균등 분할 진행율 엔진:
    // N개 영상일 때 각 영상은 정확히 1/N씩 균등 분할
    // (예: 3개 영상이면 1번 0%~33%, 2번 33%~66%, 3번 66%~99% -> 최종 완료 시 100%)
    let globalRunningPct = 0;

    try {
      // 1. 영상별 순차 루프
      for (let i = 0; i < totalVideos; i++) {
        if (signal.aborted) throw new Error(dict.logs.cancelledByUser);

        const currentVideo = updatedVideos[i];

        // 1/N 균등 분할 구간 계산 (예: 3개 영상 기준 0~33%, 33~66%, 66~100%)
        const videoStartPct = Math.floor((i / totalVideos) * 100);
        const videoEndPct = Math.floor(((i + 1) / totalVideos) * 100);
        const isLastVideo = i === totalVideos - 1;
        // AI 분석 중 도달할 수 있는 상한선 (완료 전 다음 영상 구간으로 넘치지 않도록 제한)
        const videoMaxAnalysisPct = isLastVideo ? 99 : Math.max(videoStartPct, videoEndPct - 1);
        const videoRange = Math.max(1, videoEndPct - videoStartPct);
        const extractSlice = Math.max(1, videoRange * 0.15); // 프레임 추출에 해당 영상 지분의 15% 배정

        if (currentVideo.status === 'analyzed' && currentVideo.segments && currentVideo.segments.length > 0) {
          addLog(interpolate(dict.logs.reusingSegments, { name: currentVideo.name, count: currentVideo.segments.length }));
          globalRunningPct = Math.max(globalRunningPct, isLastVideo ? 99 : videoEndPct);
          setProgress((prev) => ({
            ...prev,
            currentVideoIndex: i,
            progressPercent: Math.floor(globalRunningPct),
          }));
          continue;
        }

        // 1-A. 주요 프레임 다중 이미지 추출
        resetLiveStream();
        globalRunningPct = Math.max(globalRunningPct, videoStartPct);
        setProgress((prev) => ({
          ...prev,
          step: 'processing',
          currentPhase: 'extract',
          currentVideoIndex: i,
          totalVideos,
          progressPercent: Math.floor(globalRunningPct),
          statusMessage: interpolate(dict.logs.statusExtracting, {
            index: i + 1,
            total: totalVideos,
            name: currentVideo.name,
          }),
          reasoningLogs: [...logs],
        }));

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
            // 프레임 추출 중에도 1/N 구간 내에서 미세 전진
            const extractVisualPct = videoStartPct + (pct / 100) * extractSlice;
            globalRunningPct = Math.max(globalRunningPct, Math.min(videoMaxAnalysisPct, extractVisualPct));
            setProgress((prev) => ({
              ...prev,
              progressPercent: Math.floor(globalRunningPct),
            }));
          }
        );

        globalRunningPct = Math.max(globalRunningPct, videoStartPct + extractSlice);

        addLog(interpolate(dict.logs.framesExtracted, {
          name: currentVideo.name,
          model: selectedModel.replace(':free', ''),
        }));

        resetLiveStream();

        // 1-B. AI Gateway 다중 프레임 분석
        // [멈춤 제로(Zero-Freeze) & 가짜 최저 속도 보장 엔진]: AI 추론이 길어져도 1/N 구간 내에서 숫자가 절대 멈추지 않음
        const analyzeStartTime = Date.now();

        const updateAnalyzeProgress = (bonus = 0) => {
          if (signal.aborted) return;
          const elapsedSec = (Date.now() - analyzeStartTime) / 1000;
          const totalChars = (liveReasoning?.length || 0) + (liveContent?.length || 0);

          // 해당 영상의 AI 분석 여유 거리
          const remainingToMax = Math.max(0, videoMaxAnalysisPct - globalRunningPct);

          // 기본 전진 스텝: 남은 거리에 비례 (제논 점근) + 100ms당 최소 0.02% 보장
          const adaptiveStep = Math.max(0.02, remainingToMax * 0.0035);

          if (globalRunningPct < videoMaxAnalysisPct - 0.2) {
            globalRunningPct = Math.min(videoMaxAnalysisPct - 0.1, globalRunningPct + adaptiveStep + bonus);
          } else {
            // 상한선 직전 극초미세 전진
            globalRunningPct = Math.min(videoMaxAnalysisPct, globalRunningPct + 0.002);
          }

          const currentIntPct = Math.floor(globalRunningPct);

          // 심리학적 단계별 안내 문구 전환 (지루함 및 멈춤 느낌 원천 해소)
          let dynamicStageText = '';
          if (locale === 'ko') {
            if (elapsedSec < 8) dynamicStageText = '핵심 프레임 시각적 요소 분석 중';
            else if (elapsedSec < 18) dynamicStageText = '가장 극적인 클라이맥스 순간 탐색 중';
            else if (elapsedSec < 32) dynamicStageText = '인물 표정 및 하이라이트 감정선 분석 중';
            else if (elapsedSec < 48) dynamicStageText = '16:9 시네마틱 구도 및 최적 커팅 계산 중';
            else dynamicStageText = '베스트 하이라이트 구간 최종 정리 중';
          } else if (locale === 'ja') {
            if (elapsedSec < 8) dynamicStageText = '重要フレームの視覚要素を分析中';
            else if (elapsedSec < 18) dynamicStageText = '最も劇的なクライマックス瞬間を探索中';
            else if (elapsedSec < 32) dynamicStageText = '表情とハイライトの感情線を分析中';
            else if (elapsedSec < 48) dynamicStageText = '16:9シネマティック構図と最適カットを計算中';
            else dynamicStageText = 'ベストハイライト区間を最終整理中';
          } else {
            if (elapsedSec < 8) dynamicStageText = 'Analyzing key visual elements';
            else if (elapsedSec < 18) dynamicStageText = 'Detecting dramatic climax moments';
            else if (elapsedSec < 32) dynamicStageText = 'Evaluating facial cues & dynamics';
            else if (elapsedSec < 48) dynamicStageText = 'Calculating 16:9 cinematic framing';
            else dynamicStageText = 'Finalizing best highlight segments';
          }

          // 실시간 경과 시간 및 분석 글자 수 카운터 포맷팅
          const elapsedInt = Math.max(1, Math.floor(elapsedSec));
          const timeUnit = locale === 'ko' ? '초' : locale === 'ja' ? '秒' : 's';
          const charUnit = locale === 'ko' ? '자' : locale === 'ja' ? '文字' : ' chars';
          const counterSuffix = totalChars > 0
            ? ` (${elapsedInt}${timeUnit} · ${totalChars.toLocaleString()}${charUnit})`
            : ` (${elapsedInt}${timeUnit})`;

          const statusMsg = `${i + 1}/${totalVideos} [${currentVideo.name}] ${dynamicStageText}...${counterSuffix}`;

          setProgress((prev) => ({
            ...prev,
            progressPercent: currentIntPct,
            statusMessage: statusMsg,
          }));
        };

        setProgress((prev) => ({
          ...prev,
          step: 'processing',
          currentPhase: 'analyze',
          currentVideoIndex: i,
          totalVideos,
          progressPercent: Math.floor(globalRunningPct),
          statusMessage: `${i + 1}/${totalVideos} [${currentVideo.name}] ${dict.header.analyzingAi}... (0${locale === 'ko' ? '초' : locale === 'ja' ? '秒' : 's'})`,
          reasoningLogs: [...logs],
        }));

        // 100ms마다 실행되는 무정지(Zero-Freeze) 진행률 엔진
        const analyzeSmoothTimer = window.setInterval(() => updateAnalyzeProgress(0), 100);

        let segments: any[] = [];
        try {
          segments = await analyzeVideoHighlights({
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
              }
              liveReasoning = fullText;
              scheduleLiveStreamFlush();
              updateAnalyzeProgress(0.01);
            },
            onContentDelta: (_chunk, fullText) => {
              if (!liveContent) {
                addLog(interpolate(dict.logs.jsonStarted, { name: currentVideo.name }));
              }
              liveContent = fullText;
              scheduleLiveStreamFlush();
              updateAnalyzeProgress(0.01);
            },
            onFallback: (reason) => {
              console.warn(`[Video] Stream fallback (${currentVideo.name}):`, reason);
              addLog(interpolate(dict.logs.streamFallback, { name: currentVideo.name }));
            },
          });
        } finally {
          window.clearInterval(analyzeSmoothTimer);
        }

        // 해당 영상 분석 성공 완료 시: 1/N 목표치(videoEndPct)로 진입 (마지막 영상은 99% 유지)
        globalRunningPct = Math.max(globalRunningPct, isLastVideo ? 99 : videoEndPct);
        setProgress((prev) => ({
          ...prev,
          progressPercent: Math.floor(globalRunningPct),
        }));

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

        // 대량 영상(예: 16~100개) 분석 시 cleanDataUrl 문자열 누적을 방지하기 위해 상위 24개까지만 원본 DataURL 보관
        aiThumbnailRecommendations.push({
          videoId: currentVideo.id,
          videoName: currentVideo.name,
          timestamp: candidateThumbTime,
          reason: candidateReason,
          cleanDataUrl: aiThumbnailRecommendations.length < 24 ? candidateCleanDataUrl : '',
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
      }

      // 2. 실시간 타임라인 시퀀스 구성 (초기 인코딩 없이 즉시 실시간 프리뷰 진입)
      const allSegments = updatedVideos.flatMap((v) => v.segments);
      if (allSegments.length === 0) {
        throw new Error(dict.logs.noClimaxFound);
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
            showDate: false,
            subtitleDateText: '',
            subtitleLocationText: '',
            showIntro: false,
            showOutro: false,
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
      globalRunningPct = Math.max(globalRunningPct, 94);
      setProgress((prev) => ({
        ...prev,
        step: 'processing',
        currentPhase: 'analyze',
        currentVideoIndex: totalVideos - 1,
        totalVideos,
        progressPercent: Math.floor(globalRunningPct),
        statusMessage: 'AI 추천 16:9 썸네일 및 실시간 타임라인 준비 중...',
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
          });

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
    } catch (err: unknown) {
      if (liveFlushTimer !== null) {
        window.clearTimeout(liveFlushTimer);
        liveFlushTimer = null;
      }
      setProgress((prev) => ({
        ...prev,
        progressPercent: 0,
        statusMessage: '',
      }));
      if (signal.aborted) {
        console.info('Processing cancelled by user.');
        setCurrentStep(finalResult ? 'result' : 'upload');
      } else {
        const msg = err instanceof Error ? err.message : dict.logs.genericError;
        console.error('Processing error:', err);
        setErrorMessage(msg);
        setCurrentStep(finalResult ? 'result' : 'upload');
      }
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

    setIsReStitching(true);
    setReStitchProgress({
      progressPercent: 0,
      statusMessage: interpolate(dict.logs.stitchingProgress, { count: updatedSegments.length }) || '영상 내보내기를 준비하고 있어요...',
    });
    setErrorMessage(null);

    try {
      const result = await stitchHighlightedSegments({
        videos: readyVideos,
        allSegments: updatedSegments,
        bgmPresetId,
        bgmVolume,
        customAudioFile,
        overlayOptions,
        resolution,
        onLog: (msg) => console.info(`[Export] ${msg}`),
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
    }
  };

  // 취소 핸들러
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setProgress((prev) => ({
      ...prev,
      progressPercent: 0,
      statusMessage: '',
      liveReasoning: '',
      liveContent: '',
    }));
    setCurrentStep(finalResult ? 'result' : 'upload');
  };

  // 새로 만들기 리셋
  const handleReset = () => {
    handleStartNewProject();
  };

  return (
    <div className="toss-app-root">
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
                alert(dict.common.reportCopied || '진단 리포트가 클립보드에 복사되었습니다.');
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
        currentProjectId={currentProjectId}
        saveStatus={saveStatus}
        projectSummaries={projectSummaries}
        isLoadingProjects={isLoadingProjects}
        onOpenProject={handleOpenProject}
        onDuplicateProject={handleDuplicateProject}
        onDeleteProject={handleDeleteProject}
        onStartNewProject={handleStartNewProject}
        initialOverlayOptions={currentOverlayOptions}
        initialBgmPresetId={currentBgmPresetId}
        initialBgmVolume={currentBgmVolume}
        initialCustomAudioFile={currentCustomAudio}
        onOverlayOptionsChange={handleOverlayOptionsChange}
        onBgmChange={(bgmId: string, vol: number) => {
          setCurrentBgmPresetId(bgmId);
          setCurrentBgmVolume(vol);
        }}
        onCustomAudioChange={setCurrentCustomAudio}
        onRelinkVideo={handleRelinkSingleVideo}
        onRelinkBatch={handleRelinkBatch}
      />
    </div>
  );
}

export default App;
