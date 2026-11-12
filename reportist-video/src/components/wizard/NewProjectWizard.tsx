// src/components/wizard/NewProjectWizard.tsx
// 새 프로젝트 시작 시 진행되는 3단계 온보딩 위저드 (스텝퍼)
// Step 1: 영상 업로드 & 개별 위치명 확인 및 수정 + 지도 보기
// Step 2: 스타일 & 연출 설정 (BGM 음원, 오프닝 인트로 영상/타이틀, 엔딩 아웃트로 영상/문구)
// Step 3: AI 하이라이트 분석 및 생성 -> 완료 시 스튜디오로 자동 전환

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Upload,
  Check,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Music,
  Play,
  Pause,
  Film,
  MapPin,
  Trash2,
  Clock,
  Volume2,
  VolumeX,
  Type,
  Flag,
  X,
  FileVideo,
  Plus,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import type { VideoItem, VideoOverlayOptions, ProcessingProgress } from '../../types/video.ts';
import type { FreeModelMeta, ReasoningEffortOption } from '../../types/gateway.ts';
import { AUDIO_LIBRARY, loadLibraryAudioFile, type AudioLibraryTrack } from '../../data/audioLibrary.ts';
import { useModalScrollLock } from '../../hooks/useModalScrollLock.ts';
import { useI18n } from '../../i18n/index.tsx';
import { ShinyText } from '../common/ShinyText.tsx';
import { SpecularButton } from '../common/SpecularButton.tsx';
import { BorderBeam } from '../common/BorderBeam.tsx';
import { QueueStatusCard, getQueueCopy } from '../queue/QueueStatusCard.tsx';
import {
  getStoredShowIntro,
  setStoredShowIntro,
  getStoredShowOutro,
  setStoredShowOutro,
  getStoredIntroTemplate,
  getStoredIntroDuration,
  getStoredOutroTemplate,
  getStoredOutroDuration,
  getStoredOutroText,
} from '../../services/introOutroStorage.ts';
import './NewProjectWizard.css';

interface NewProjectWizardProps {
  isOpen: boolean;
  onClose: () => void;
  videos: VideoItem[];
  onFilesSelected: (files: File[]) => void;
  onRemoveVideo: (id: string) => void;
  onUpdateVideoLocation: (id: string, locationName: string) => void;
  // BGM & 스타일
  selectedLibraryTrackId: string | null;
  bgmVolume: number;
  onBgmChange: (bgmId: string, volume: number, libraryTrackId?: string | null) => void;
  customAudioFile: File | null;
  onCustomAudioChange: (file: File | null) => void;
  overlayOptions: VideoOverlayOptions | null;
  onOverlayOptionsChange: (opts: VideoOverlayOptions) => void;
  // AI 모델
  selectedModel: string;
  selectedEffort: ReasoningEffortOption;
  models: FreeModelMeta[];
  isLoadingModels: boolean;
  onSelectModel: (modelId: string) => void;
  onSelectEffort: (effort: ReasoningEffortOption) => void;
  // AI 생성 시작 및 진행률
  onStartAiAnalysis: (
    overlayOpts?: VideoOverlayOptions,
    customAudio?: File | null,
    bgmPresetId?: string,
    bgmVol?: number
  ) => Promise<void>;
  isProcessing: boolean;
  progress: ProcessingProgress;
  onCancelProcessing: () => void;
}

export const NewProjectWizard: React.FC<NewProjectWizardProps> = ({
  isOpen,
  onClose,
  videos,
  onFilesSelected,
  onRemoveVideo,
  onUpdateVideoLocation,
  selectedLibraryTrackId,
  bgmVolume,
  onBgmChange,
  customAudioFile,
  onCustomAudioChange,
  overlayOptions,
  onOverlayOptionsChange,
  selectedModel,
  selectedEffort,
  models,
  isLoadingModels,
  onSelectModel,
  onSelectEffort,
  onStartAiAnalysis,
  isProcessing,
  progress,
  onCancelProcessing,
}) => {
  const { dict, interpolate, locale } = useI18n();
  const w = dict.wizard;
  const queueCopy = getQueueCopy(locale);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // 음원 미리듣기용 오디오 객체
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // 로컬 스타일/오버레이 상태
  const [titleText, setTitleText] = useState(overlayOptions?.titleText || '');
  const [showIntro, setShowIntro] = useState(
    overlayOptions?.showIntro !== undefined ? overlayOptions.showIntro : getStoredShowIntro()
  );
  const [showOutro, setShowOutro] = useState(
    overlayOptions?.showOutro !== undefined ? overlayOptions.showOutro : getStoredShowOutro()
  );
  const [channelText, setChannelText] = useState(overlayOptions?.channelText || '');
  const [showChapterBridge, setShowChapterBridge] = useState(overlayOptions?.showChapterBridge ?? true);

  // 인트로 & 아웃트로 커스텀 비디오 파일
  const [introVideoFile, setIntroVideoFile] = useState<File | null>(
    overlayOptions?.introVideoFile || null
  );
  const [outroVideoFile, setOutroVideoFile] = useState<File | null>(
    overlayOptions?.outroVideoFile || null
  );
  const introVideoInputRef = useRef<HTMLInputElement>(null);
  const outroVideoInputRef = useRef<HTMLInputElement>(null);

  // 지도 위치 확인 모달 대상 비디오
  const [mapModalVideo, setMapModalVideo] = useState<VideoItem | null>(null);

  // 모달 스크롤 락
  useModalScrollLock(isOpen, {
    overlayRef,
    scrollableSelector: '.wizard-body, [data-modal-scrollable="true"]',
  });

  // 진행 중일 때는 3단계(AI 생성)로 고정
  useEffect(() => {
    if (isProcessing) {
      setCurrentStep(3);
    }
  }, [isProcessing]);

  // 브라우저 뒤로가기(popstate) 연동
  useEffect(() => {
    if (!isOpen) return;
    window.history.pushState({ wizard: true, step: currentStep }, '', window.location.hash);

    const handlePopState = () => {
      if (isProcessing) return;
      if (mapModalVideo) {
        setMapModalVideo(null);
        return;
      }
      if (currentStep > 1) {
        setCurrentStep((prev) => (prev > 1 ? (prev - 1 as 1 | 2 | 3) : 1));
      } else {
        onClose();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, currentStep, isProcessing, mapModalVideo, onClose]);

  // ESC 키 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mapModalVideo) {
          setMapModalVideo(null);
          return;
        }
        if (!isProcessing) {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, mapModalVideo, onClose]);

  // 오디오 미리듣기 정리
  useEffect(() => {
    return () => {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current = null;
      }
    };
  }, []);

  // 현재 AI 분석 중인 원본 영상 (썸네일 표시용)
  const currentProcessingVideo = videos[progress.currentVideoIndex] || videos[0];
  const currentVideoThumbnail = currentProcessingVideo?.thumbnailUrl;

  // 기존 스튜디오 분석 모달과 동일하게, 가장 최근 로그 1~2줄만 노출
  const latestAnalysisTask = useMemo(() => {
    const reasoningText = (progress.liveReasoning || '').trim();
    const contentText = (progress.liveContent || '').trim();
    const liveText = reasoningText || contentText;

    // 1. AI가 실시간으로 사고/응답을 스트리밍 중인 경우
    if (liveText) {
      const lines = liveText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const textPart = lines.slice(-2).join('\n');
      return {
        isStreaming: true,
        text: textPart
          ? textPart
          : reasoningText
          ? dict.processingModal.reasoningProcess
          : dict.processingModal.responseGeneration,
      };
    }

    // 2. 현재 처리 단계의 기본 상태 문구
    if (progress.statusMessage) {
      return {
        isStreaming: false,
        text: progress.statusMessage,
      };
    }

    // 3. 누적 로그 중 가장 마지막 1~2줄
    if (progress.reasoningLogs && progress.reasoningLogs.length > 0) {
      return {
        isStreaming: false,
        text: progress.reasoningLogs.slice(-2).join('\n'),
      };
    }

    // 4. 아직 분석 준비 중
    return {
      isStreaming: false,
      text: dict.processingModal.waitingModel,
    };
  }, [
    progress.liveReasoning,
    progress.liveContent,
    progress.statusMessage,
    progress.reasoningLogs,
    dict,
  ]);

  if (!isOpen) return null;

  // 총 시간 및 크기 계산
  const totalDuration = videos.reduce((acc, v) => acc + (v.duration || 0), 0);
  const totalSizeBytes = videos.reduce((acc, v) => acc + (v.sizeBytes || 0), 0);

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const mediaFiles = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith('video/') ||
        /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(file.name)
      );
      if (mediaFiles.length > 0) {
        onFilesSelected(mediaFiles);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  // 음원 미리듣기 토글
  const handleTogglePreviewAudio = (track: AudioLibraryTrack) => {
    if (previewTrackId === track.id) {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
      setPreviewTrackId(null);
      return;
    }

    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
    }
    const audio = new Audio(track.src);
    audio.volume = bgmVolume;
    audio.play().catch(() => {});
    audio.onended = () => setPreviewTrackId(null);
    audioPreviewRef.current = audio;
    setPreviewTrackId(track.id);
  };

  // 음원 선택
  const handleSelectBgmTrack = async (trackId: string | null) => {
    if (trackId === null) {
      onBgmChange('none', bgmVolume, null);
      onCustomAudioChange(null);
    } else {
      onBgmChange('preset', bgmVolume, trackId);
      const track = AUDIO_LIBRARY.find((t) => t.id === trackId);
      if (track) {
        try {
          const file = await loadLibraryAudioFile(track);
          onCustomAudioChange(file);
        } catch (e) {
          console.warn('Failed to load library audio:', e);
        }
      }
    }
  };

  // 오버레이 옵션 병합 반환
  const buildCurrentOverlayOptions = (): VideoOverlayOptions => {
    return {
      showTitle: Boolean(titleText.trim()) || (overlayOptions?.showTitle ?? true),
      titleText: titleText.trim(),
      showChannel: Boolean(channelText.trim()) || (overlayOptions?.showChannel ?? false),
      channelText: channelText.trim(),
      showSubtitle: overlayOptions?.showSubtitle ?? true,
      showDate: overlayOptions?.showDate ?? false,
      subtitleDateText: overlayOptions?.subtitleDateText || '',
      subtitleLocationText: overlayOptions?.subtitleLocationText || '',
      showIntro: showIntro || Boolean(introVideoFile),
      showOutro: showOutro || Boolean(outroVideoFile),
      introTemplate: overlayOptions?.introTemplate || getStoredIntroTemplate(),
      outroTemplate: overlayOptions?.outroTemplate || getStoredOutroTemplate(),
      introDurationSec: overlayOptions?.introDurationSec || getStoredIntroDuration(),
      outroDurationSec: overlayOptions?.outroDurationSec || getStoredOutroDuration(),
      outroText:
        overlayOptions?.outroText !== undefined
          ? overlayOptions.outroText
          : getStoredOutroText(),
      showChapterBridge,
      chapterBridgeDateTemplate: overlayOptions?.chapterBridgeDateTemplate || 'flip-clock',
      chapterBridgeLocationTemplate: overlayOptions?.chapterBridgeLocationTemplate || 'winding-route',
      bgmFitToVideo: overlayOptions?.bgmFitToVideo ?? true,
      introVideoFile: introVideoFile || null,
      outroVideoFile: outroVideoFile || null,
    };
  };

  // AI 분석 시작
  const handleStartAnalysis = async () => {
    if (videos.length === 0) return;
    const finalOpts = buildCurrentOverlayOptions();
    onOverlayOptionsChange(finalOpts);

    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      setPreviewTrackId(null);
    }

    let finalAudio = customAudioFile;
    if (selectedLibraryTrackId && !finalAudio) {
      const track = AUDIO_LIBRARY.find((t) => t.id === selectedLibraryTrackId);
      if (track) {
        try {
          finalAudio = await loadLibraryAudioFile(track);
          onCustomAudioChange(finalAudio);
        } catch (e) {
          console.warn('Failed to load library audio file:', e);
        }
      }
    }

    setCurrentStep(3);
    await onStartAiAnalysis(
      finalOpts,
      finalAudio,
      selectedLibraryTrackId ? 'preset' : finalAudio ? 'custom' : 'none',
      bgmVolume
    );
  };

  return (
    <div ref={overlayRef} className="wizard-modal-backdrop">
      <div className="wizard-modal-card">
        {/* 상단 헤더 & 스텝퍼 */}
        <div className="wizard-modal-header">
          <div className="wizard-header-top">
            <div className="wizard-brand">
              <span className="wizard-brand-badge">NEW</span>
              <h2 className="wizard-brand-title">{w?.modalTitle || '새 비디오 프로젝트 만들기'}</h2>
            </div>
            {!isProcessing && (
              <button
                type="button"
                className="wizard-close-btn"
                onClick={onClose}
                title={w?.closeBtn || '닫기 (목록으로)'}
              >
                <span className="wizard-close-text">{dict.common.close || '닫기'}</span>
                <X size={18} />
              </button>
            )}
          </div>

          {/* Stepper 인디케이터 */}
          <div className="wizard-stepper">
            {/* Step 1 */}
            <div
              className={`wizard-step-node ${currentStep === 1 ? 'active' : currentStep > 1 ? 'completed' : ''}`}
              onClick={() => !isProcessing && setCurrentStep(1)}
            >
              <div className="wizard-step-circle">
                {currentStep > 1 ? <Check size={14} strokeWidth={3} /> : '1'}
              </div>
              <div className="wizard-step-info">
                <span className="wizard-step-title">{w?.step1Title || '영상 업로드 & 위치'}</span>
                <span className="wizard-step-sub">
                  {videos.length > 0 ? interpolate(w?.step1Sub || '{count}개 선택됨', { count: videos.length }) : (w?.step1SubEmpty || '원본 영상 선택')}
                </span>
              </div>
            </div>

            <div className={`wizard-step-divider ${currentStep > 1 ? 'completed' : ''}`} />

            {/* Step 2 */}
            <div
              className={`wizard-step-node ${currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : ''}`}
              onClick={() => !isProcessing && videos.length > 0 && setCurrentStep(2)}
            >
              <div className="wizard-step-circle">
                {currentStep > 2 ? <Check size={14} strokeWidth={3} /> : '2'}
              </div>
              <div className="wizard-step-info">
                <span className="wizard-step-title">{w?.step2Title || '스타일 & 연출'}</span>
                <span className="wizard-step-sub">{w?.step2Sub || '음원 · 인트로 · 아웃트로'}</span>
              </div>
            </div>

            <div className={`wizard-step-divider ${currentStep > 2 ? 'completed' : ''}`} />

            {/* Step 3 */}
            <div className={`wizard-step-node ${currentStep === 3 ? 'active' : ''}`}>
              <div className="wizard-step-circle">
                <Sparkles size={14} />
              </div>
              <div className="wizard-step-info">
                <span className="wizard-step-title">{w?.step3Title || 'AI 하이라이트 생성'}</span>
                <span className="wizard-step-sub">
                  {isProcessing ? interpolate(w?.step3SubProcessing || '{pct}% 진행 중', { pct: progress.progressPercent }) : (w?.step3SubReady || '스튜디오 전환')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 바디 영역 */}
        <div className="wizard-body" data-modal-scrollable="true">
          {/* ==================== STEP 1: 영상 업로드 & 위치 ==================== */}
          {currentStep === 1 && (
            <div className="wizard-step-pane">
              <div className="wizard-pane-desc">
                <p className="wizard-pane-lead">
                  {w?.step1Lead || '하이라이트를 생성할 동영상들을 업로드해주세요.'}
                </p>
                <p className="wizard-pane-sub">
                  {w?.step1Desc || '여러 개의 영상을 한 번에 올릴 수 있으며, 촬영 장소명을 직접 수정하거나 지도로 확인할 수 있어요.'}
                </p>
              </div>

              {/* 드래그 앤 드롭 존 */}
              <div
                className={`wizard-dropzone ${isDragOver ? 'is-dragover' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="video/*,.mp4,.mov,.webm,.mkv,.avi,.m4v"
                  style={{ display: 'none' }}
                  onChange={handleFileInputChange}
                />
                <div className="wizard-dropzone-icon">
                  <Upload size={28} className="text-blue-500" />
                </div>
                <div className="wizard-dropzone-text">
                  <strong>{w?.dropzoneTitle || '동영상 파일을 끌어다 놓거나 클릭하여 선택하세요'}</strong>
                  <span>{w?.dropzoneSub || 'MP4, MOV, WebM, MKV 등 고화질 영상 지원 (브라우저 메모리 100% 비공개 처리)'}</span>
                </div>
              </div>

              {/* 업로드된 영상 목록 & 위치 수정 카드 */}
              {videos.length > 0 && (
                <div className="wizard-video-section">
                  <div className="wizard-video-summary-bar">
                    <div className="wizard-summary-stats">
                      <span className="wizard-summary-tag">
                        {interpolate(w?.summaryVideos || '총 {count}개 영상', { count: videos.length })}
                      </span>
                      <span className="wizard-summary-dot">•</span>
                      <span className="wizard-summary-tag">
                        <Clock size={12} className="inline mr-1" />
                        {interpolate(w?.summaryDuration || '총 {sec}초', { sec: totalDuration.toFixed(1) })}
                      </span>
                      <span className="wizard-summary-dot">•</span>
                      <span className="wizard-summary-tag">
                        {interpolate(w?.summarySize || '총 {mb} MB', { mb: (totalSizeBytes / (1024 * 1024)).toFixed(1) })}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="wizard-btn-add-more"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Plus size={13} />
                      <span>{w?.addMoreVideos || '영상 추가'}</span>
                    </button>
                  </div>

                  <div className="wizard-video-list">
                    {videos.map((vid, idx) => (
                      <div key={vid.id} className="wizard-video-card">
                        <div className="wizard-video-card-left">
                          <div className="wizard-video-thumb-wrap">
                            {vid.thumbnailUrl ? (
                              <img
                                src={vid.thumbnailUrl}
                                alt={vid.name}
                                className="wizard-video-thumb"
                              />
                            ) : (
                              <div className="wizard-video-thumb-fallback">
                                <FileVideo size={20} className="text-slate-400" />
                              </div>
                            )}
                            <span className="wizard-video-index-badge">#{idx + 1}</span>
                          </div>

                          <div className="wizard-video-details">
                            <span className="wizard-video-name" title={vid.name}>
                              {vid.name}
                            </span>
                            <div className="wizard-video-meta">
                              <span>{vid.duration > 0 ? `${vid.duration.toFixed(1)}${dict.common.timeSec}` : (w?.checkingDuration || '길이 확인 중')}</span>
                              <span className="wizard-video-meta-dot">•</span>
                              <span>
                                {vid.width > 0 ? `${vid.width}×${vid.height}` : (w?.checkingResolution || '해상도 확인 중')}
                              </span>
                              {vid.metadataDate && (
                                <>
                                  <span className="wizard-video-meta-dot">•</span>
                                  <span className="wizard-meta-date">
                                    <Calendar size={11} className="inline mr-0.5" />
                                    {vid.metadataDate}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* 위치명 수정 인풋 및 지도 보기 버튼 */}
                            <div className="wizard-location-input-row">
                              <MapPin size={13} className="wizard-location-pin" />
                              <input
                                type="text"
                                className="wizard-location-input"
                                placeholder={w?.editLocationPlaceholder || '촬영 위치 수정 (예: 해운대 해수욕장, 제주 성산일출봉)'}
                                value={vid.locationName || ''}
                                onChange={(e) => onUpdateVideoLocation(vid.id, e.target.value)}
                              />
                              <button
                                type="button"
                                className={`wizard-btn-map ${vid.latitude && vid.longitude ? 'has-gps' : ''}`}
                                onClick={() => setMapModalVideo(vid)}
                                title={w?.viewMapTitle || '지도에서 위치 확인하기'}
                              >
                                <ExternalLink size={12} />
                                <span>{vid.latitude && vid.longitude ? (w?.gpsMapBtn || 'GPS 지도') : (w?.viewMapBtn || '지도 보기')}</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="wizard-video-delete-btn"
                          onClick={() => onRemoveVideo(vid.id)}
                          title={w?.removeVideoTitle || '목록에서 삭제'}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== STEP 2: 스타일 & 연출 ==================== */}
          {currentStep === 2 && (
            <div className="wizard-step-pane">
              <div className="wizard-pane-desc">
                <p className="wizard-pane-lead">
                  {w?.step2Lead || '영상의 분위기에 어울리는 배경음악과 연출을 설정해보세요.'}
                </p>
                <p className="wizard-pane-sub">
                  {w?.step2Desc || '오프닝 인트로 영상이나 엔딩 아웃트로 영상을 직접 첨부하여 더욱 완성도 높은 영상을 만들 수 있어요.'}
                </p>
              </div>

              {/* 1. 배경음악(BGM) 설정 카드 */}
              <div className="wizard-config-card">
                <div className="wizard-config-card-header">
                  <div className="wizard-config-icon-badge bg-blue-50 text-blue-600">
                    <Music size={18} />
                  </div>
                  <div>
                    <h3 className="wizard-config-title">{w?.bgmSectionTitle || '배경음악 (BGM) 선택'}</h3>
                    <p className="wizard-config-subtitle">
                      {w?.bgmSectionSub || '분위기에 맞는 무료 라이선스 음악을 선택하거나 미리 들어보세요'}
                    </p>
                  </div>
                </div>

                <div className="wizard-bgm-grid">
                  {/* 음악 없음 */}
                  <div
                    className={`wizard-bgm-item ${
                      !selectedLibraryTrackId && !customAudioFile ? 'selected' : ''
                    }`}
                    onClick={() => handleSelectBgmTrack(null)}
                  >
                    <div className="wizard-bgm-item-left">
                      <VolumeX size={16} className="text-slate-400" />
                      <div>
                        <div className="wizard-bgm-name">{w?.noBgmTitle || '배경음악 없음'}</div>
                        <div className="wizard-bgm-desc">{w?.noBgmDesc || '영상 원본 소리만 재생'}</div>
                      </div>
                    </div>
                    {!selectedLibraryTrackId && !customAudioFile && (
                      <Check size={16} className="text-blue-500" strokeWidth={3} />
                    )}
                  </div>

                  {/* 내장 오디오 보관함 트랙 */}
                  {AUDIO_LIBRARY.map((track) => {
                    const isSelected = selectedLibraryTrackId === track.id;
                    const isPlaying = previewTrackId === track.id;
                    return (
                      <div
                        key={track.id}
                        className={`wizard-bgm-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleSelectBgmTrack(track.id)}
                      >
                        <div className="wizard-bgm-item-left">
                          <button
                            type="button"
                            className={`wizard-bgm-preview-btn ${isPlaying ? 'playing' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTogglePreviewAudio(track);
                            }}
                            title={isPlaying ? (w?.previewPause || '일시정지') : (w?.previewPlay || '미리듣기')}
                          >
                            {isPlaying ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
                          </button>
                          <div>
                            <div className="wizard-bgm-name">{track.name}</div>
                            <div className="wizard-bgm-desc">
                              {track.id === 'lively-day'
                                ? (w?.bgmLively || '밝고 활기찬 무드')
                                : track.id === 'dreaming'
                                ? (w?.bgmDreaming || '감성적이고 잔잔한 무드')
                                : (w?.bgmEnergetic || '경쾌한 어쿠스틱 무드')}
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <Check size={16} className="text-blue-500" strokeWidth={3} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* BGM 볼륨 슬라이더 */}
                {(selectedLibraryTrackId || customAudioFile) && (
                  <div className="wizard-volume-row">
                    <div className="wizard-volume-label">
                      <Volume2 size={15} className="text-slate-500" />
                      <span>{w?.bgmVolumeLabel || '배경음악 음량'}</span>
                      <strong>{Math.round(bgmVolume * 100)}%</strong>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={bgmVolume}
                      onChange={(e) =>
                        onBgmChange(
                          selectedLibraryTrackId ? 'preset' : 'custom',
                          parseFloat(e.target.value),
                          selectedLibraryTrackId
                        )
                      }
                      className="wizard-volume-slider"
                    />
                  </div>
                )}
              </div>

              {/* 2. 인트로 및 오프닝 타이틀 설정 */}
              <div className="wizard-config-card">
                <div className="wizard-config-card-header">
                  <div className="wizard-config-icon-badge bg-indigo-50 text-indigo-600">
                    <Type size={18} />
                  </div>
                  <div>
                    <h3 className="wizard-config-title">{w?.introSectionTitle || '오프닝 인트로 설정'}</h3>
                    <p className="wizard-config-subtitle">
                      {w?.introSectionSub || '영상의 첫 장면에 표시될 제목과 오프닝 영상/연출을 설정합니다'}
                    </p>
                  </div>
                </div>

                <div className="wizard-form-group">
                  <label className="wizard-form-label">
                    <span>{w?.videoMainTitle || '영상 메인 제목'}</span>
                    <span className="wizard-label-badge">{w?.aiAutoRecommend || '미입력 시 AI 자동 추천'}</span>
                  </label>
                  <input
                    type="text"
                    className="wizard-input-text"
                    placeholder={w?.titlePlaceholder || '예: 부산 2박 3일 여름 여행 하이라이트 (비워두면 AI 자동 생성)'}
                    value={titleText}
                    onChange={(e) => setTitleText(e.target.value)}
                  />
                </div>

                {/* 인트로 커스텀 영상 첨부 */}
                <div className="wizard-custom-clip-section">
                  <input
                    ref={introVideoInputRef}
                    type="file"
                    accept="video/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setIntroVideoFile(e.target.files[0]);
                        setShowIntro(true);
                        e.target.value = '';
                      }
                    }}
                  />
                  <div className="wizard-clip-header-row">
                    <label className="wizard-form-label mb-0">
                      <span>{w?.introClipLabel || '오프닝 인트로 영상 파일'}</span>
                      <span className="wizard-label-badge">{w?.optionalBadge || '선택 사항'}</span>
                    </label>
                  </div>

                  {introVideoFile ? (
                    <div className="wizard-clip-file-chip">
                      <Film size={14} className="text-blue-600 flex-shrink-0" />
                      <span className="wizard-clip-file-name" title={introVideoFile.name}>
                        {introVideoFile.name} ({(introVideoFile.size / (1024 * 1024)).toFixed(1)}MB)
                      </span>
                      <button
                        type="button"
                        className="wizard-clip-remove-btn"
                        onClick={() => setIntroVideoFile(null)}
                        title={w?.removeIntroClip || '인트로 영상 삭제'}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="wizard-btn-upload-clip"
                      onClick={() => introVideoInputRef.current?.click()}
                    >
                      <Plus size={14} />
                      <span>{w?.attachIntroClip || '인트로 영상 파일 첨부하기 (MP4, MOV 등)'}</span>
                    </button>
                  )}
                  <span className="wizard-clip-help-text">
                    {introVideoFile
                      ? (w?.introHelpAttached || '✓ 첨부된 인트로 영상이 본편 시작 전에 매끄럽게 연결되어 재생됩니다.')
                      : (w?.introHelpDefault || '별도의 인트로 영상이 있으면 첨부해보세요. 미첨부 시 타이틀 애니메이션이 적용됩니다.')}
                  </span>
                </div>

                <div className="wizard-toggle-grid">
                  <label className="wizard-toggle-item">
                    <input
                      type="checkbox"
                      checked={showIntro || Boolean(introVideoFile)}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setStoredShowIntro(val);
                        setShowIntro(val);
                      }}
                      className="wizard-checkbox"
                    />
                    <div>
                      <div className="wizard-toggle-title">{w?.toggleIntro || '오프닝 인트로 연출 적용'}</div>
                      <div className="wizard-toggle-desc">{w?.toggleIntroDesc || '영상 시작 시 감성적인 타이틀 애니메이션을 표시합니다'}</div>
                    </div>
                  </label>

                  <label className="wizard-toggle-item">
                    <input
                      type="checkbox"
                      checked={showChapterBridge}
                      onChange={(e) => setShowChapterBridge(e.target.checked)}
                      className="wizard-checkbox"
                    />
                    <div>
                      <div className="wizard-toggle-title">{w?.toggleChapterBridge || '구간 챕터 브릿지 자막'}</div>
                      <div className="wizard-toggle-desc">{w?.toggleChapterBridgeDesc || '새로운 영상 구간으로 넘어갈 때 장소/시간 자막을 띄웁니다'}</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* 3. 아웃트로(엔딩) 설정 */}
              <div className="wizard-config-card">
                <div className="wizard-config-card-header">
                  <div className="wizard-config-icon-badge bg-emerald-50 text-emerald-600">
                    <Flag size={18} />
                  </div>
                  <div>
                    <h3 className="wizard-config-title">{w?.outroSectionTitle || '엔딩 아웃트로 설정'}</h3>
                    <p className="wizard-config-subtitle">
                      {w?.outroSectionSub || '영상이 끝날 때 표시할 채널명이나 마무리 엔딩 영상을 추가해보세요'}
                    </p>
                  </div>
                </div>

                <label className="wizard-toggle-item mb-3">
                  <input
                    type="checkbox"
                    checked={showOutro || Boolean(outroVideoFile)}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setStoredShowOutro(val);
                      setShowOutro(val);
                    }}
                    className="wizard-checkbox"
                  />
                  <div>
                    <div className="wizard-toggle-title">{w?.toggleOutro || '엔딩 아웃트로 연출 적용'}</div>
                    <div className="wizard-toggle-desc">{w?.toggleOutroDesc || '영상 마지막에 부드러운 페이드아웃과 서명을 표시합니다'}</div>
                  </div>
                </label>

                {/* 아웃트로 커스텀 영상 첨부 */}
                <div className="wizard-custom-clip-section">
                  <input
                    ref={outroVideoInputRef}
                    type="file"
                    accept="video/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setOutroVideoFile(e.target.files[0]);
                        setShowOutro(true);
                        e.target.value = '';
                      }
                    }}
                  />
                  <div className="wizard-clip-header-row">
                    <label className="wizard-form-label mb-0">
                      <span>{w?.outroClipLabel || '엔딩 아웃트로 영상 파일'}</span>
                      <span className="wizard-label-badge">{w?.optionalBadge || '선택 사항'}</span>
                    </label>
                  </div>

                  {outroVideoFile ? (
                    <div className="wizard-clip-file-chip">
                      <Film size={14} className="text-emerald-600 flex-shrink-0" />
                      <span className="wizard-clip-file-name" title={outroVideoFile.name}>
                        {outroVideoFile.name} ({(outroVideoFile.size / (1024 * 1024)).toFixed(1)}MB)
                      </span>
                      <button
                        type="button"
                        className="wizard-clip-remove-btn"
                        onClick={() => setOutroVideoFile(null)}
                        title={w?.removeOutroClip || '아웃트로 영상 삭제'}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="wizard-btn-upload-clip"
                      onClick={() => outroVideoInputRef.current?.click()}
                    >
                      <Plus size={14} />
                      <span>{w?.attachOutroClip || '엔딩 아웃트로 영상 파일 첨부하기 (MP4, MOV 등)'}</span>
                    </button>
                  )}
                </div>

                {(showOutro || Boolean(outroVideoFile)) && (
                  <div className="wizard-form-group mt-2">
                    <label className="wizard-form-label">
                      <span>{w?.channelLabel || '채널명 / 엔딩 문구'}</span>
                    </label>
                    <input
                      type="text"
                      className="wizard-input-text"
                      placeholder={w?.channelPlaceholder || '예: Reportist Travel · 구독과 좋아요 부탁드려요!'}
                      value={channelText}
                      onChange={(e) => setChannelText(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== STEP 3: AI 하이라이트 생성 (진행 상황) ==================== */}
          {currentStep === 3 && (
            <div className="wizard-step-pane wizard-processing-pane">
              <div className="wizard-analysis-card">
                <BorderBeam duration={4.5} borderWidth={2} />

                {/* 현재 작업 중인 원본 영상 썸네일 */}
                <div className="wizard-analysis-thumb">
                  {currentVideoThumbnail ? (
                    <img
                      src={currentVideoThumbnail}
                      alt={currentProcessingVideo?.name || (w?.step3Title || 'AI 하이라이트 생성')}
                    />
                  ) : (
                    <div className="wizard-analysis-thumb-placeholder">
                      <Film size={30} />
                    </div>
                  )}
                  <span className="wizard-analysis-thumb-scan" aria-hidden="true" />
                  <span className="wizard-analysis-live-pill">
                    <span className="wizard-analysis-live-dot" />
                    LIVE
                  </span>
                </div>

                <h3 className="wizard-processing-title">
                  <ShinyText theme="light" speed={2.5} style={{ display: 'inline' }}>
                    {progress.isQueued
                      ? queueCopy.waitingTitle
                      : (w?.step3HeroTitle || 'AI가 영상의 극적인 순간을 분석하고 있어요')}
                  </ShinyText>
                </h3>
                <p className="wizard-processing-desc">
                  {progress.statusMessage || (w?.step3DefaultStatus || '영상의 주요 프레임을 분석하여 하이라이트를 탐색 중입니다...')}
                </p>

                {progress.isQueued && (
                  <div className="wizard-analysis-queue">
                    <QueueStatusCard
                      locale={locale}
                      position={progress.queuePosition}
                      estimatedWaitSec={progress.estimatedWaitSec}
                    />
                  </div>
                )}

                {/* 프로그레스 바 */}
                <div className="wizard-analysis-progress">
                  <div className="wizard-progress-header">
                    <span className="wizard-progress-stage">
                      {progress.currentPhase === 'extract'
                        ? (w?.stageExtract || '1단계: 영상 프레임 고속 추출')
                        : (w?.stageAnalyze || '2단계: 비전 AI 극적 장면 분석 & 컷팅')}
                    </span>
                    <span className="wizard-progress-pct">{progress.progressPercent}%</span>
                  </div>
                  <div className="wizard-progressbar-track">
                    <div
                      className="wizard-progressbar-fill"
                      style={{ width: `${Math.max(4, progress.progressPercent)}%` }}
                    />
                  </div>
                  <div className="wizard-analysis-meta">
                    <span className="wizard-analysis-meta-index">
                      #{Math.min(progress.currentVideoIndex + 1, Math.max(videos.length, 1))}
                    </span>
                    <span
                      className="wizard-analysis-meta-name"
                      title={currentProcessingVideo?.name || ''}
                    >
                      {currentProcessingVideo?.name || ''}
                    </span>
                    <span className="wizard-analysis-meta-count">
                      {Math.min(
                        progress.currentVideoIndex + 1,
                        Math.max(progress.totalVideos, videos.length)
                      )}
                      {' / '}
                      {Math.max(progress.totalVideos, videos.length)}
                    </span>
                  </div>
                </div>

                {/* 가장 최근 로그 1~2줄 (넘치면 말줄임표) */}
                <div className="wizard-analysis-log">
                  <span
                    className={`wizard-analysis-log-dot ${latestAnalysisTask.isStreaming ? 'is-live' : ''}`}
                    aria-hidden="true"
                  />
                  <p className="wizard-analysis-log-text">{latestAnalysisTask.text}</p>
                  {latestAnalysisTask.isStreaming && (
                    <span className="wizard-analysis-caret" aria-hidden="true" />
                  )}
                </div>

                <div className="wizard-analysis-guard">
                  <span aria-hidden="true">🛡️</span>
                  <p>
                    {dict.processingModal.backgroundGuardNotice ||
                      '다른 탭으로 이동하거나 앱을 전환하셔도 작업이 안전하게 이어져요.'}
                  </p>
                </div>
              </div>

              {/* 취소 버튼 */}
              <div className="wizard-processing-actions">
                <button
                  type="button"
                  className="wizard-btn-cancel"
                  onClick={onCancelProcessing}
                >
                  {progress.isQueued
                    ? queueCopy.cancel
                    : (w?.cancelAnalysis || '분석 중단하기')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 하단 푸터 액션 바 */}
        <div className="wizard-modal-footer">
          {currentStep === 1 && (
            <>
              <button
                type="button"
                className="wizard-btn-ghost"
                onClick={onClose}
              >
                {w?.cancelToList || '취소 (목록으로)'}
              </button>

              <button
                type="button"
                className="wizard-btn-primary"
                disabled={videos.length === 0}
                onClick={() => setCurrentStep(2)}
              >
                <span>{w?.nextStyle || '다음: 스타일 & 연출'}</span>
                <ArrowRight size={16} />
              </button>
            </>
          )}

          {currentStep === 2 && (
            <>
              <button
                type="button"
                className="wizard-btn-secondary"
                onClick={() => setCurrentStep(1)}
              >
                <ArrowLeft size={16} />
                <span>{w?.prevStep || '이전'}</span>
              </button>

              <div className="wizard-footer-right">
                <SpecularButton
                  type="button"
                  className="wizard-btn-primary"
                  onClick={handleStartAnalysis}
                  radius={12}
                  disabled={videos.length === 0}
                >
                  <Sparkles size={16} />
                  <ShinyText text={w?.startAiHighlight || 'AI 하이라이트 생성 시작'} />
                </SpecularButton>
              </div>
            </>
          )}

          {currentStep === 3 && (
            <div className="wizard-footer-processing-note">
              <span>{w?.footerAutoTransition || '💡 분석이 완료되면 스튜디오로 자동 전환되어 자막과 구간을 바로 편집할 수 있어요.'}</span>
            </div>
          )}
        </div>
      </div>

      {/* ==================== 촬영 위치 지도 확인 모달 ==================== */}
      {mapModalVideo && (
        <div className="wizard-map-backdrop" onClick={() => setMapModalVideo(null)}>
          <div
            className="wizard-map-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="wizard-map-modal-header">
              <div className="wizard-map-title-row">
                <div className="wizard-map-icon-badge">
                  <MapPin size={18} />
                </div>
                <div>
                  <h3 className="wizard-map-title">
                    {mapModalVideo.locationName || mapModalVideo.name}
                  </h3>
                  <p className="wizard-map-sub">
                    {mapModalVideo.latitude && mapModalVideo.longitude
                      ? `GPS: ${mapModalVideo.latitude.toFixed(5)}, ${mapModalVideo.longitude.toFixed(5)}`
                      : (w?.mapInfoTitle || '촬영 위치 정보')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="wizard-map-close-btn"
                onClick={() => setMapModalVideo(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="wizard-map-body">
              {mapModalVideo.latitude && mapModalVideo.longitude ? (
                <iframe
                  title={w?.mapIframeTitle || '촬영 위치 지도'}
                  className="wizard-map-iframe"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${mapModalVideo.longitude - 0.008}%2C${mapModalVideo.latitude - 0.008}%2C${mapModalVideo.longitude + 0.008}%2C${mapModalVideo.latitude + 0.008}&layer=mapnik&marker=${mapModalVideo.latitude}%2C${mapModalVideo.longitude}`}
                />
              ) : (
                <div className="wizard-map-nogps-box">
                  <MapPin size={32} className="text-slate-300 mb-2" />
                  <p className="wizard-map-nogps-title">
                    {mapModalVideo.locationName ? interpolate(w?.mapSearchQuery || '[{location}] 위치 검색', { location: mapModalVideo.locationName }) : (w?.mapNoGps || 'GPS 좌표가 없는 영상입니다')}
                  </p>
                  <p className="wizard-map-nogps-desc">
                    {w?.mapNoGpsDesc || '아래 네이버 지도 또는 구글 지도 링크를 눌러 장소를 검색하고 확인해보세요.'}
                  </p>
                </div>
              )}
            </div>

            <div className="wizard-map-footer">
              <div className="wizard-map-links">
                <a
                  href={
                    mapModalVideo.locationName
                      ? `https://map.naver.com/v5/search/${encodeURIComponent(mapModalVideo.locationName)}`
                      : mapModalVideo.latitude && mapModalVideo.longitude
                      ? `https://map.naver.com/v5/search/${mapModalVideo.latitude},${mapModalVideo.longitude}`
                      : `https://map.naver.com/v5/search/${encodeURIComponent(mapModalVideo.name)}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="wizard-btn-external-map"
                >
                  <ExternalLink size={12} />
                  <span>{w?.naverMap || '네이버 지도'}</span>
                </a>
                <a
                  href={
                    mapModalVideo.latitude && mapModalVideo.longitude
                      ? `https://www.google.com/maps/search/?api=1&query=${mapModalVideo.latitude},${mapModalVideo.longitude}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapModalVideo.locationName || mapModalVideo.name)}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="wizard-btn-external-map"
                >
                  <ExternalLink size={12} />
                  <span>{w?.googleMap || '구글 지도'}</span>
                </a>
              </div>
              <button
                type="button"
                className="wizard-btn-map-close"
                onClick={() => setMapModalVideo(null)}
              >
                {dict.common.close || '닫기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
