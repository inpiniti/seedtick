// src/components/studio/IntroOutroPreviewModal.tsx
// HyperFrames 기반 인트로 & 아웃트로 모션 템플릿 실시간 미리보기 및 커스텀 설정 모달
// 대화면 2열 분할(좌측 대형 프리뷰 + 우측 템플릿 패널) 및 전체화면 시네마 모드 + 다국어(i18n) 지원

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Clock,
  Check,
  Maximize2,
  Minimize2,
  Clapperboard,
  Film,
  Type,
  HelpCircle,
} from 'lucide-react';
import {
  DEFAULT_INTRO_DURATION,
  DEFAULT_OUTRO_DURATION,
  renderHyperframesIntroFrame,
  renderHyperframesOutroFrame,
} from '../../services/hyperframesIntroOutroRenderer.ts';
import type {
  IntroTemplateId,
  OutroTemplateId,
  VideoOverlayOptions,
} from '../../types/video.ts';
import { useI18n } from '../../i18n/index.tsx';
import { notify } from '../../services/toastService.ts';
import { setStoredIntroOutroDefaults } from '../../services/introOutroStorage.ts';

export interface IntroOutroPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'intro' | 'outro';
  initialIntroTemplate?: IntroTemplateId;
  initialIntroDuration?: number;
  initialOutroTemplate?: OutroTemplateId;
  initialOutroDuration?: number;
  initialOutroText?: string;
  mockTitle?: string;
  mockDate?: string;
  mockLocation?: string;
  onApply?: (settings: {
    introTemplate: IntroTemplateId;
    introDurationSec: number;
    outroTemplate: OutroTemplateId;
    outroDurationSec: number;
    outroText?: string;
  }) => void;
}

export const INTRO_TEMPLATE_OPTIONS: Array<{
  id: IntroTemplateId;
  name: string;
  badge: string;
  desc: string;
}> = [
  {
    id: 'kinetic-slide',
    name: '키네틱 슬라이드',
    badge: '추천',
    desc: '볼드 타이포 & 탄성 오버슈트 바운스',
  },
  {
    id: 'split-flap',
    name: '레트로 플립보드',
    badge: '아날로그',
    desc: '전광판 3D 분할 회전 타일 모션',
  },
  {
    id: 'cinematic-letterbox',
    name: '시네마틱 줌',
    badge: '영화관',
    desc: '2.39:1 레터박스 & 아나모픽 렌즈 플레어',
  },
  {
    id: 'film-countdown',
    name: '카운트다운 3-2-1',
    badge: '빈티지',
    desc: '빈티지 필름 링 & 십자선 모션',
  },
];

export const OUTRO_TEMPLATE_OPTIONS: Array<{
  id: OutroTemplateId;
  name: string;
  badge: string;
  desc: string;
}> = [
  {
    id: 'modern-endcard',
    name: '유튜브 엔드카드',
    badge: '추천',
    desc: '16:9 추천 영상 슬롯 & 채널 펄스 링',
  },
  {
    id: 'minimal-fade',
    name: '미니멀 페이드',
    badge: '감성',
    desc: '딥 다크 비네트 & 우아한 타이포 암전',
  },
  {
    id: 'curtain-split',
    name: '루버 블라인드',
    badge: '시그니처',
    desc: '5단 사선 루버 셔터 클로징 크레딧',
  },
];

export const INTRO_DURATIONS = [1.5, 2.0, 2.5, 3.0];
export const OUTRO_DURATIONS = [1.8, 2.2, 2.8];

export const IntroOutroPreviewModal: React.FC<IntroOutroPreviewModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'intro',
  initialIntroTemplate = 'kinetic-slide',
  initialIntroDuration = DEFAULT_INTRO_DURATION,
  initialOutroTemplate = 'modern-endcard',
  initialOutroDuration = DEFAULT_OUTRO_DURATION,
  initialOutroText = '시청해 주셔서 감사합니다',
  mockTitle,
  mockDate,
  mockLocation,
  onApply,
}) => {
  const { dict } = useI18n();
  const ioDict = dict.introOutroModal;
  const secUnit = ioDict?.secUnit || '초';

  const introOptions = useMemo(() => {
    return INTRO_TEMPLATE_OPTIONS.map((opt) => {
      const trans = ioDict?.templates?.intro?.[opt.id];
      return {
        id: opt.id,
        name: trans?.name || opt.name,
        badge: trans?.badge || opt.badge,
        desc: trans?.desc || opt.desc,
      };
    });
  }, [ioDict]);

  const outroOptions = useMemo(() => {
    return OUTRO_TEMPLATE_OPTIONS.map((opt) => {
      const trans = ioDict?.templates?.outro?.[opt.id];
      return {
        id: opt.id,
        name: trans?.name || opt.name,
        badge: trans?.badge || opt.badge,
        desc: trans?.desc || opt.desc,
      };
    });
  }, [ioDict]);

  const [activeTab, setActiveTab] = useState<'intro' | 'outro'>(initialTab);
  const [introTemplate, setIntroTemplate] = useState<IntroTemplateId>(initialIntroTemplate);
  const [introDuration, setIntroDuration] = useState<number>(initialIntroDuration);
  const [outroTemplate, setOutroTemplate] = useState<OutroTemplateId>(initialOutroTemplate);
  const [outroDuration, setOutroDuration] = useState<number>(initialOutroDuration);
  const [outroText, setOutroText] = useState<string>(initialOutroText);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(performance.now());
  const pausedTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(true);

  // 모달 오픈 시 초기값 동기화
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setIntroTemplate(initialIntroTemplate);
      setIntroDuration(initialIntroDuration);
      setOutroTemplate(initialOutroTemplate);
      setOutroDuration(initialOutroDuration);
      setOutroText(initialOutroText);
      setCurrentTime(0);
      setIsPlaying(true);
      isPlayingRef.current = true;
      startTimeRef.current = performance.now();
      pausedTimeRef.current = 0;
      setIsFullscreen(false);
    }
  }, [
    isOpen,
    initialTab,
    initialIntroTemplate,
    initialIntroDuration,
    initialOutroTemplate,
    initialOutroDuration,
    initialOutroText,
  ]);

  // 키보드 ESC 단축키
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullscreen, onClose]);

  // 탭 또는 재생 시간 변경 시 타임라인 리셋
  const currentDuration = activeTab === 'intro' ? introDuration : outroDuration;

  useEffect(() => {
    startTimeRef.current = performance.now();
    pausedTimeRef.current = 0;
    setCurrentTime(0);
  }, [activeTab, introTemplate, outroTemplate, currentDuration]);

  // 애니메이션 캔버스 렌더 루프 (1280x720 고화질)
  useEffect(() => {
    if (!isOpen) {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const overlayOpts: VideoOverlayOptions = {
      showTitle: true,
      showChannel: true,
      showSubtitle: true,
      showDate: true,
      showIntro: true,
      showOutro: true,
      titleText: mockTitle || ioDict?.mockTitle || '도쿄 여름 여행 브이로그',
      subtitleDateText: mockDate || '2024.08.15',
      subtitleLocationText: mockLocation || '도쿄 시부야 & 신주쿠',
      introTemplate,
      introDurationSec: introDuration,
      outroTemplate,
      outroDurationSec: outroDuration,
      outroText: outroText || ioDict?.mockOutroText || '시청해 주셔서 감사합니다',
      channelText: '@seedtick.travel',
    };

    const renderLoop = (now: number) => {
      let t = 0;
      if (isPlayingRef.current) {
        const elapsed = (now - startTimeRef.current) / 1000;
        t = elapsed % currentDuration;
        setCurrentTime(t);
      } else {
        t = pausedTimeRef.current;
      }

      const progress = Math.max(0, Math.min(1, currentDuration > 0 ? t / currentDuration : 0));

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (activeTab === 'intro') {
        renderHyperframesIntroFrame(ctx, progress, overlayOpts, canvas.width, canvas.height);
      } else {
        renderHyperframesOutroFrame(ctx, progress, overlayOpts, canvas.width, canvas.height);
      }

      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [
    isOpen,
    activeTab,
    introTemplate,
    introDuration,
    outroTemplate,
    outroDuration,
    outroText,
    currentDuration,
    mockTitle,
    mockDate,
    mockLocation,
    ioDict,
  ]);

  if (!isOpen) return null;

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      pausedTimeRef.current = currentTime;
      isPlayingRef.current = false;
      setIsPlaying(false);
    } else {
      startTimeRef.current = performance.now() - pausedTimeRef.current * 1000;
      isPlayingRef.current = true;
      setIsPlaying(true);
    }
  };

  const handleRestart = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTimeRef.current = performance.now();
    pausedTimeRef.current = 0;
    setCurrentTime(0);
    isPlayingRef.current = true;
    setIsPlaying(true);
  };

  const handleSeek = (time: number) => {
    pausedTimeRef.current = time;
    setCurrentTime(time);
    isPlayingRef.current = false;
    setIsPlaying(false);
  };

  const handleApply = (e: React.MouseEvent) => {
    e.stopPropagation();
    const settings = {
      introTemplate,
      introDurationSec: introDuration,
      outroTemplate,
      outroDurationSec: outroDuration,
      outroText,
    };
    setStoredIntroOutroDefaults(settings);
    if (onApply) {
      onApply(settings);
    }
    onClose();
    const introOptName =
      ioDict?.templates?.intro?.[introTemplate]?.name ||
      INTRO_TEMPLATE_OPTIONS.find((i) => i.id === introTemplate)?.name ||
      introTemplate;
    const outroOptName =
      ioDict?.templates?.outro?.[outroTemplate]?.name ||
      OUTRO_TEMPLATE_OPTIONS.find((o) => o.id === outroTemplate)?.name ||
      outroTemplate;
    notify.success(ioDict?.applyDefault || '인트로/아웃트로 모션 적용 완료', {
      description: `${introOptName} (${introDuration.toFixed(1)}${secUnit}) · ${outroOptName} (${outroDuration.toFixed(1)}${secUnit})`,
    });
  };

  return (
    <div
      className="model-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isFullscreen ? '0px' : '16px',
        transition: 'all 0.2s ease',
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <style>{`
        .intro-outro-modal-container {
          position: relative;
          width: 100%;
          max-width: ${isFullscreen ? '100vw' : '1100px'};
          height: ${isFullscreen ? '100vh' : '90vh'};
          max-height: ${isFullscreen ? '100vh' : '780px'};
          background-color: #ffffff;
          border-radius: ${isFullscreen ? '0px' : '20px'};
          box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.25);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: all 0.25s ease;
        }
        .io-body-layout {
          display: flex;
          flex-direction: row;
          gap: 20px;
          flex: 1;
          min-height: 0;
          overflow: hidden;
          padding: 20px 24px;
          background-color: #f8fafc;
        }
        .io-stage-col {
          flex: 1.35;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .io-panel-col {
          flex: 1;
          min-width: 320px;
          max-width: 440px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          overflow-y: auto;
          padding-right: 4px;
        }
        @media (max-width: 860px) {
          .intro-outro-modal-container {
            height: 94vh;
            max-height: 94vh;
          }
          .io-body-layout {
            flex-direction: column;
            overflow-y: auto;
            padding: 14px;
            gap: 14px;
          }
          .io-panel-col {
            max-width: 100%;
            min-width: 0;
            overflow-y: visible;
          }
        }
      `}</style>

      <div
        className="intro-outro-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={19} />
            </div>
            <div>
              <h3
                style={{
                  fontSize: '16.5px',
                  fontWeight: 800,
                  color: '#0f172a',
                  margin: 0,
                  letterSpacing: '-0.3px',
                }}
              >
                {ioDict?.title || 'HyperFrames 인트로 & 아웃트로 실시간 미리보기'}
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                {ioDict?.subtitle || '원하는 템플릿을 선택하고 캔버스 모션을 실시간으로 확인해보세요.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title={isFullscreen ? '창 모드로 축소' : '대화면 전체화면'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#f1f5f9',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* 바디 레이아웃 (2열 분할) */}
        <div className="io-body-layout">
          {/* 좌측: 실시간 16:9 대형 캔버스 스테이지 */}
          <div className="io-stage-col">
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '16 / 9',
                backgroundColor: '#0a0f1d',
                borderRadius: '14px',
                overflow: 'hidden',
                boxShadow: '0 12px 24px -6px rgba(0, 0, 0, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <canvas
                ref={canvasRef}
                width={1280}
                height={720}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />

              {/* 캔버스 우상단 실시간 모드 배지 */}
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  padding: '4px 9px',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(15, 23, 42, 0.7)',
                  backdropFilter: 'blur(4px)',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: isPlaying ? '#10b981' : '#f59e0b',
                  }}
                />
                {activeTab === 'intro' ? 'INTRO' : 'OUTRO'} • {currentDuration.toFixed(1)}s
              </div>
            </div>

            {/* 플레이어 컨트롤 바 */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                padding: '10px 14px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <button
                type="button"
                onClick={togglePlay}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: isPlaying ? '#0f172a' : '#2563eb',
                  border: 'none',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                }}
              >
                {isPlaying ? <Pause size={15} /> : <Play size={15} style={{ marginLeft: '2px' }} />}
              </button>

              <button
                type="button"
                onClick={handleRestart}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#f1f5f9',
                  border: 'none',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                title="처음부터 다시 보기"
              >
                <RotateCcw size={14} />
              </button>

              {/* 진행률 탐색 바 */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="range"
                  min={0}
                  max={currentDuration}
                  step={0.033}
                  value={currentTime}
                  onChange={(e) => handleSeek(parseFloat(e.target.value))}
                  style={{
                    flex: 1,
                    accentColor: '#2563eb',
                    cursor: 'pointer',
                  }}
                />
              </div>

              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#334155',
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: '78px',
                  textAlign: 'right',
                }}
              >
                {currentTime.toFixed(1)}s / {currentDuration.toFixed(1)}s
              </div>
            </div>

            {/* 안내 팁 배너 */}
            <div
              style={{
                backgroundColor: '#eff6ff',
                borderRadius: '10px',
                padding: '9px 12px',
                border: '1px solid #dbeafe',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '11.5px',
                color: '#1e40af',
              }}
            >
              <HelpCircle size={14} className="shrink-0" />
              <span>
                {ioDict?.tipDescription ||
                  '💡 템플릿 카드를 클릭하면 왼쪽 대화면에서 GSAP 결정론적 캔버스 모션이 즉시 실시간 렌더링됩니다.'}
              </span>
            </div>
          </div>

          {/* 우측: 탭 & 템플릿 선택 패널 */}
          <div className="io-panel-col">
            {/* 탭 버튼 */}
            <div
              style={{
                display: 'flex',
                backgroundColor: '#e2e8f0',
                padding: '3px',
                borderRadius: '10px',
                gap: '3px',
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab('intro')}
                style={{
                  flex: 1,
                  padding: '7px 0',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: activeTab === 'intro' ? '#ffffff' : 'transparent',
                  color: activeTab === 'intro' ? '#0f172a' : '#64748b',
                  fontSize: '12.5px',
                  fontWeight: activeTab === 'intro' ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: activeTab === 'intro' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Clapperboard size={14} className={activeTab === 'intro' ? 'text-blue-600' : ''} />
                <span>{ioDict?.tabIntro || '🎬 시작 인트로 (4종)'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('outro')}
                style={{
                  flex: 1,
                  padding: '7px 0',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: activeTab === 'outro' ? '#ffffff' : 'transparent',
                  color: activeTab === 'outro' ? '#0f172a' : '#64748b',
                  fontSize: '12.5px',
                  fontWeight: activeTab === 'outro' ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: activeTab === 'outro' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <Film size={14} className={activeTab === 'outro' ? 'text-blue-600' : ''} />
                <span>{ioDict?.tabOutro || '🏁 종료 아웃트로 (3종)'}</span>
              </button>
            </div>

            {/* 인트로 탭 내용 */}
            {activeTab === 'intro' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                    {ioDict?.templateSelectLabel || '인트로 모션 템플릿'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {introOptions.map((tpl) => {
                    const isSelected = introTemplate === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setIntroTemplate(tpl.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          padding: '11px 13px',
                          borderRadius: '12px',
                          border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                          backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                          position: 'relative',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: '2px',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: 700,
                                color: isSelected ? '#1d4ed8' : '#0f172a',
                              }}
                            >
                              {tpl.name}
                            </span>
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '5px',
                                backgroundColor: isSelected ? '#2563eb' : '#f1f5f9',
                                color: isSelected ? '#ffffff' : '#64748b',
                              }}
                            >
                              {tpl.badge}
                            </span>
                          </div>
                          <p
                            style={{
                              fontSize: '11.5px',
                              color: '#64748b',
                              margin: 0,
                              lineHeight: 1.35,
                            }}
                          >
                            {tpl.desc}
                          </p>
                        </div>
                        {isSelected && (
                          <div
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              backgroundColor: '#2563eb',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              marginTop: '2px',
                            }}
                          >
                            <Check size={11} strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* 인트로 재생 시간 선택기 */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    marginTop: '4px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#334155',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <Clock size={13} className="text-slate-400" />
                      <span>{ioDict?.durationLabel || '재생 시간'}</span>
                    </span>
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#2563eb' }}>
                      {introDuration.toFixed(1)}{secUnit}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                    {INTRO_DURATIONS.map((sec) => {
                      const isCurrent = introDuration === sec;
                      return (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setIntroDuration(sec)}
                          style={{
                            padding: '7px 0',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: isCurrent ? '#0f172a' : '#f1f5f9',
                            color: isCurrent ? '#ffffff' : '#475569',
                            fontSize: '12px',
                            fontWeight: isCurrent ? 700 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {sec.toFixed(1)}{secUnit}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 아웃트로 탭 내용 */}
            {activeTab === 'outro' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'between' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                    {ioDict?.templateSelectLabel || '아웃트로 모션 템플릿'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {outroOptions.map((tpl) => {
                    const isSelected = outroTemplate === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setOutroTemplate(tpl.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '10px',
                          padding: '11px 13px',
                          borderRadius: '12px',
                          border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                          backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease',
                          position: 'relative',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginBottom: '2px',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '13px',
                                fontWeight: 700,
                                color: isSelected ? '#1d4ed8' : '#0f172a',
                              }}
                            >
                              {tpl.name}
                            </span>
                            <span
                              style={{
                                fontSize: '10.5px',
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: '5px',
                                backgroundColor: isSelected ? '#2563eb' : '#f1f5f9',
                                color: isSelected ? '#ffffff' : '#64748b',
                              }}
                            >
                              {tpl.badge}
                            </span>
                          </div>
                          <p
                            style={{
                              fontSize: '11.5px',
                              color: '#64748b',
                              margin: 0,
                              lineHeight: 1.35,
                            }}
                          >
                            {tpl.desc}
                          </p>
                        </div>
                        {isSelected && (
                          <div
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              backgroundColor: '#2563eb',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              marginTop: '2px',
                            }}
                          >
                            <Check size={11} strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* 아웃트로 재생 시간 선택기 */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    marginTop: '4px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: '#334155',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <Clock size={13} className="text-slate-400" />
                      <span>{ioDict?.durationLabel || '재생 시간'}</span>
                    </span>
                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#2563eb' }}>
                      {outroDuration.toFixed(1)}{secUnit}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {OUTRO_DURATIONS.map((sec) => {
                      const isCurrent = outroDuration === sec;
                      return (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setOutroDuration(sec)}
                          style={{
                            padding: '7px 0',
                            borderRadius: '8px',
                            border: 'none',
                            backgroundColor: isCurrent ? '#0f172a' : '#f1f5f9',
                            color: isCurrent ? '#ffffff' : '#475569',
                            fontSize: '12px',
                            fontWeight: isCurrent ? 700 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {sec.toFixed(1)}{secUnit}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 아웃트로 감사 문구 커스텀 인풋 */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    padding: '12px',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#334155',
                      marginBottom: '6px',
                    }}
                  >
                    <Type size={13} className="text-slate-400" />
                    <span>{ioDict?.outroTextLabel || '클로징 문구'}</span>
                  </label>
                  <input
                    type="text"
                    value={outroText}
                    onChange={(e) => setOutroText(e.target.value)}
                    placeholder={ioDict?.outroTextPlaceholder || '시청해 주셔서 감사합니다'}
                    maxLength={40}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12.5px',
                      boxSizing: 'border-box',
                      color: '#0f172a',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 푸터 (액션 버튼) */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #f1f5f9',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '8px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {ioDict?.cancel || '취소'}
          </button>
          <button
            type="button"
            onClick={handleApply}
            style={{
              padding: '9px 20px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
            }}
          >
            <Check size={14} strokeWidth={2.5} />
            <span>{ioDict?.applyDefault || '이 설정으로 기본값 적용'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntroOutroPreviewModal;
