// src/components/studio/ChapterBridgePreviewModal.tsx
// 챕터 브릿지 날짜(1~5번) x 장소(1~5번) 실시간 조합 미리보기 모달
// 대화면 2열 분할(좌측 대형 프리뷰 + 우측 템플릿 패널) 및 전체화면 시네마 모드 + 다국어(i18n) 지원

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Clock,
  Navigation,
  Check,
  Maximize2,
  Minimize2,
  HelpCircle,
} from 'lucide-react';
import {
  CHAPTER_BRIDGE_DURATION,
  createHyperframesBridgeController,
  type ChapterBridgeTransitionInfo,
} from '../../services/hyperframesBridgeRenderer.ts';
import type { BridgeDateTemplateId, BridgeLocationTemplateId } from '../../types/video.ts';
import { useI18n } from '../../i18n/index.tsx';
import { notify } from '../../services/toastService.ts';

interface ChapterBridgePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDateTemplate?: BridgeDateTemplateId;
  initialLocationTemplate?: BridgeLocationTemplateId;
  onApply?: (dateTemplate: BridgeDateTemplateId, locationTemplate: BridgeLocationTemplateId) => void;
}

// 하위 호환 및 기본 참조용
export const DATE_TEMPLATE_OPTIONS: Array<{
  id: BridgeDateTemplateId;
  num: number;
  name: string;
  desc: string;
}> = [
  { id: 'flip-clock', num: 1, name: '플립 시계', desc: '착착 넘어가는 아날로그 탁상 시계' },
  { id: 'watch-spin', num: 2, name: '럭셔리 워치', desc: '고속 회전하는 클래식 시계 바늘' },
  { id: 'calendar-page', num: 3, name: '일력 달력', desc: '바람에 펄럭이며 넘어가는 일력 종이' },
  { id: 'minimal-editorial', num: 4, name: '미니멀 매거진', desc: '모던 잡지 스타일의 감성 타이포' },
  { id: 'neon-digital', num: 5, name: '네온 디지털 HUD', desc: '사이버펑크 글리치 디지털 카운터' },
];

export const LOCATION_TEMPLATE_OPTIONS: Array<{
  id: BridgeLocationTemplateId;
  num: number;
  name: string;
  desc: string;
}> = [
  { id: 'winding-route', num: 1, name: '로드트립 S경로', desc: '지도 위 구불구불한 점선과 주행 차량' },
  { id: 'globe-spin', num: 2, name: '3D 글로브 아크', desc: '회전하는 지구본과 포물선 비행 궤적' },
  { id: 'boarding-pass', num: 3, name: '보딩패스 티켓', desc: '항공권 바코드와 도착 고무 스탬프' },
  { id: 'minimal-editorial', num: 4, name: '미니멀 에디토리얼', desc: '우아한 라인과 다음 여행지 안내' },
  { id: 'gps-cyber', num: 5, name: 'GPS 내비게이션 HUD', desc: '첨단 차량 내비와 3D 도로 경로선' },
];

type ActiveTab = 'date' | 'location';

export const ChapterBridgePreviewModal: React.FC<ChapterBridgePreviewModalProps> = ({
  isOpen,
  onClose,
  initialDateTemplate = 'flip-clock',
  initialLocationTemplate = 'winding-route',
  onApply,
}) => {
  const { dict, interpolate } = useI18n();
  const cDict = dict.chapterBridgeModal;

  const [dateTemplate, setDateTemplate] = useState<BridgeDateTemplateId>(initialDateTemplate);
  const [locationTemplate, setLocationTemplate] = useState<BridgeLocationTemplateId>(initialLocationTemplate);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<ActiveTab>('date');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(performance.now());
  const pausedTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(true);

  // 다국어 템플릿 옵션 목록 구성
  const dateOptions = useMemo(() => {
    return DATE_TEMPLATE_OPTIONS.map((opt) => {
      const trans = cDict?.templates?.date?.[opt.id];
      return {
        id: opt.id,
        num: opt.num,
        name: trans?.name || opt.name,
        desc: trans?.desc || opt.desc,
      };
    });
  }, [cDict]);

  const locationOptions = useMemo(() => {
    return LOCATION_TEMPLATE_OPTIONS.map((opt) => {
      const trans = cDict?.templates?.location?.[opt.id];
      return {
        id: opt.id,
        num: opt.num,
        name: trans?.name || opt.name,
        desc: trans?.desc || opt.desc,
      };
    });
  }, [cDict]);

  const selectedDateName = dateOptions.find((o) => o.id === dateTemplate)?.name || '';
  const selectedLocationName = locationOptions.find((o) => o.id === locationTemplate)?.name || '';

  // 모달 열릴 때마다 초기값 동기화
  useEffect(() => {
    if (isOpen) {
      setDateTemplate(initialDateTemplate);
      setLocationTemplate(initialLocationTemplate);
      setCurrentTime(0);
      setIsPlaying(true);
      isPlayingRef.current = true;
      startTimeRef.current = performance.now();
      pausedTimeRef.current = 0;
      setIsFullscreen(false);
    }
  }, [isOpen, initialDateTemplate, initialLocationTemplate]);

  // 키보드 ESC 단축키 지원
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

    const controller = createHyperframesBridgeController(CHAPTER_BRIDGE_DURATION);

    const mockInfo: ChapterBridgeTransitionInfo = {
      shouldBridge: true,
      fromDate: '2024.08.15',
      toDate: '2024.08.18',
      fromLocation: cDict?.mockData?.fromLocation || '서울 (김포공항)',
      toLocation: cDict?.mockData?.toLocation || '도쿄 (하네다)',
      sceneTitle: cDict?.mockData?.sceneTitle || '도쿄 여행 출발',
      chapterIndex: 2,
      totalChapters: 5,
      isDateChanged: true,
      isLocationChanged: true,
      isSourceChanged: false,
      travelVehicle: 'plane',
      dateTemplate,
      locationTemplate,
    };

    const renderLoop = (now: number) => {
      let t = 0;
      if (isPlayingRef.current) {
        const elapsed = (now - startTimeRef.current) / 1000;
        t = elapsed % CHAPTER_BRIDGE_DURATION;
        setCurrentTime(t);
      } else {
        t = pausedTimeRef.current;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      controller.seekAndRender(ctx, t, canvas.width, canvas.height, mockInfo);

      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      controller.dispose();
    };
  }, [isOpen, dateTemplate, locationTemplate, cDict]);

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

  const handleSelectDate = (e: React.MouseEvent, id: BridgeDateTemplateId) => {
    e.stopPropagation();
    e.preventDefault();
    setDateTemplate(id);
  };

  const handleSelectLocation = (e: React.MouseEvent, id: BridgeLocationTemplateId) => {
    e.stopPropagation();
    e.preventDefault();
    setLocationTemplate(id);
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onApply) {
      onApply(dateTemplate, locationTemplate);
    }
    onClose();
    const dateObj = dateOptions.find((d) => d.id === dateTemplate);
    const locObj = locationOptions.find((l) => l.id === locationTemplate);
    notify.success('챕터 브릿지 스타일 적용 완료', {
      description: `${dateObj?.name || dateTemplate} + ${locObj?.name || locationTemplate} 조합으로 설정했어요.`,
    });
  };

  return (
    <div
      className="model-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
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
      {/* 반응형 스타일 주입 */}
      <style>{`
        .bridge-preview-body {
          display: flex;
          flex-direction: row;
          gap: 20px;
          flex: 1;
          min-height: 0;
          overflow: hidden;
          padding: 20px 24px;
          background-color: #f8fafc;
        }
        .bridge-preview-stage {
          flex: 1.35;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .bridge-preview-panel {
          flex: 1;
          min-width: 320px;
          max-width: 440px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow-y: auto;
          padding-right: 4px;
        }
        @media (max-width: 900px) {
          .bridge-preview-body {
            flex-direction: column;
            overflow-y: auto;
          }
          .bridge-preview-panel {
            max-width: 100%;
            min-width: 100%;
            overflow-y: visible;
          }
        }
      `}</style>

      {/* 모달 카드 */}
      <div
        className="model-modal-card"
        style={{
          width: '100%',
          maxWidth: isFullscreen ? '100vw' : '1180px',
          height: isFullscreen ? '100vh' : '92vh',
          maxHeight: isFullscreen ? '100vh' : '880px',
          backgroundColor: '#ffffff',
          borderRadius: isFullscreen ? '0px' : '24px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.3)',
          border: isFullscreen ? 'none' : '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#0f172a',
          transition: 'all 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid #f1f5f9',
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                backgroundColor: '#fef3c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#d97706',
                boxShadow: '0 2px 6px rgba(217, 119, 6, 0.15)',
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
                {cDict?.title || '챕터 브릿지 모션 템플릿 & 실시간 미리보기'}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                {cDict?.subtitle || '날짜 스타일과 장소 스타일을 원하는 조합으로 믹스앤매치할 수 있습니다.'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              style={{
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                color: '#334155',
                cursor: 'pointer',
                padding: '8px 12px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12.5px',
                fontWeight: 600,
                transition: 'background-color 0.15s ease',
              }}
              title={isFullscreen ? (cDict?.exitFullscreen || '원래 크기로 복귀') : (cDict?.fullscreen || '전체화면 확대')}
            >
              {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              <span>{isFullscreen ? (cDict?.exitFullscreen || '축소') : (cDict?.fullscreen || '화면 확대')}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              style={{
                background: '#f1f5f9',
                border: 'none',
                color: '#475569',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.15s ease',
              }}
              aria-label={cDict?.close || '닫기'}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 모달 바디: 좌측(대형 프리뷰) + 우측(템플릿 선택 패널) */}
        <div className="bridge-preview-body">
          {/* [좌측 대형 프리뷰 스테이지] */}
          <div className="bridge-preview-stage">
            {/* 캔버스 뷰포트 (대형 16:9 뷰) */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                flex: isFullscreen ? 1 : undefined,
                minHeight: isFullscreen ? '0' : '360px',
                borderRadius: '18px',
                overflow: 'hidden',
                backgroundColor: '#07090e',
                border: '1px solid #0f172a',
                boxShadow: '0 12px 36px rgba(15, 23, 42, 0.25)',
                aspectRatio: isFullscreen ? undefined : '16 / 9',
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

              {/* 좌상단 실시간 선택 템플릿 배지 */}
              <div
                style={{
                  position: 'absolute',
                  top: '14px',
                  left: '14px',
                  display: 'flex',
                  gap: '8px',
                  pointerEvents: 'none',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '5px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(15, 23, 42, 0.88)',
                    border: '1px solid rgba(245, 158, 11, 0.6)',
                    color: '#fbbf24',
                    backdropFilter: 'blur(6px)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}
                >
                  {interpolate(cDict?.dateBadgePrefix || '날짜: {name}', { name: selectedDateName })}
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '5px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(15, 23, 42, 0.88)',
                    border: '1px solid rgba(56, 189, 248, 0.6)',
                    color: '#38bdf8',
                    backdropFilter: 'blur(6px)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}
                >
                  {interpolate(cDict?.locationBadgePrefix || '장소: {name}', { name: selectedLocationName })}
                </span>
              </div>
            </div>

            {/* 재생 컨트롤 바 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 16px',
                backgroundColor: '#ffffff',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              <button
                type="button"
                onClick={togglePlay}
                style={{
                  background: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  transition: 'opacity 0.15s ease',
                }}
              >
                {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                {isPlaying ? (cDict?.pause || '일시정지') : (cDict?.play || '재생')}
              </button>
              <button
                type="button"
                onClick={handleRestart}
                style={{
                  background: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'background-color 0.15s ease',
                }}
                title={cDict?.restart || '처음부터 다시 보기'}
              >
                <RotateCcw size={15} />
              </button>
              <input
                type="range"
                min={0}
                max={CHAPTER_BRIDGE_DURATION}
                step={0.03}
                value={currentTime}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: '#0f172a', cursor: 'pointer', height: '6px' }}
                aria-label="Timeline seek"
              />
              <span
                style={{
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  color: '#475569',
                  minWidth: '80px',
                  textAlign: 'right',
                  fontWeight: 600,
                }}
              >
                {currentTime.toFixed(2)}s / {CHAPTER_BRIDGE_DURATION.toFixed(1)}s
              </span>
            </div>

            {/* 하단 팁 / 상태 알림 카드 */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                padding: '12px 16px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '12.5px',
                color: '#475569',
              }}
            >
              <HelpCircle size={16} color="#0284c7" style={{ flexShrink: 0 }} />
              <span>
                {cDict?.tipDescription ||
                  '💡 템플릿 카드를 클릭하면 왼쪽 대형 화면에서 즉시 실시간 전환 모션이 시뮬레이션됩니다.'}
              </span>
            </div>
          </div>

          {/* [우측 템플릿 선택 패널] */}
          <div className="bridge-preview-panel">
            {/* 탭 헤더 (2개 탭: 날짜 스타일 / 장소 스타일) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px',
                backgroundColor: '#e2e8f0',
                borderRadius: '12px',
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab('date')}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '9px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'date' ? '#ffffff' : 'transparent',
                  color: activeTab === 'date' ? '#b45309' : '#64748b',
                  boxShadow: activeTab === 'date' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                }}
              >
                <Clock size={15} />
                <span>{cDict?.tabDate || '날짜 스타일'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('location')}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '9px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'location' ? '#ffffff' : 'transparent',
                  color: activeTab === 'location' ? '#0369a1' : '#64748b',
                  boxShadow: activeTab === 'location' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                }}
              >
                <Navigation size={15} />
                <span>{cDict?.tabLocation || '장소 스타일'}</span>
              </button>
            </div>

            {/* 날짜 템플릿 목록 */}
            {activeTab === 'date' && (
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  padding: '14px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#b45309',
                    fontWeight: 700,
                    fontSize: '13.5px',
                    paddingBottom: '4px',
                    borderBottom: '1px solid #f8fafc',
                  }}
                >
                  <Clock size={16} />
                  <span>{cDict?.dateSectionTitle || '날짜 스타일'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {dateOptions.map((opt) => {
                    const selected = dateTemplate === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={(e) => handleSelectDate(e, opt.id)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '10px',
                          border: selected ? '2px solid #f59e0b' : '1px solid #f1f5f9',
                          backgroundColor: selected ? '#fef3c7' : '#ffffff',
                          color: '#0f172a',
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '13.5px',
                              fontWeight: 700,
                              color: selected ? '#92400e' : '#1e293b',
                            }}
                          >
                            {opt.name}
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: '#64748b',
                              marginTop: '2px',
                              lineHeight: 1.35,
                            }}
                          >
                            {opt.desc}
                          </div>
                        </div>
                        {selected && (
                          <div
                            style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '50%',
                              backgroundColor: '#f59e0b',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ffffff',
                              flexShrink: 0,
                            }}
                          >
                            <Check size={14} strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 장소 템플릿 목록 */}
            {activeTab === 'location' && (
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  padding: '14px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#0369a1',
                    fontWeight: 700,
                    fontSize: '13.5px',
                    paddingBottom: '4px',
                    borderBottom: '1px solid #f8fafc',
                  }}
                >
                  <Navigation size={16} />
                  <span>{cDict?.locationSectionTitle || '장소 스타일'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {locationOptions.map((opt) => {
                    const selected = locationTemplate === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={(e) => handleSelectLocation(e, opt.id)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '10px',
                          border: selected ? '2px solid #0284c7' : '1px solid #f1f5f9',
                          backgroundColor: selected ? '#e0f2fe' : '#ffffff',
                          color: '#0f172a',
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '13.5px',
                              fontWeight: 700,
                              color: selected ? '#075985' : '#1e293b',
                            }}
                          >
                            {opt.name}
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: '#64748b',
                              marginTop: '2px',
                              lineHeight: 1.35,
                            }}
                          >
                            {opt.desc}
                          </div>
                        </div>
                        {selected && (
                          <div
                            style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '50%',
                              backgroundColor: '#0284c7',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ffffff',
                              flexShrink: 0,
                            }}
                          >
                            <Check size={14} strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 모달 푸터 */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            backgroundColor: '#ffffff',
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              backgroundColor: '#f1f5f9',
              border: 'none',
              color: '#475569',
              fontWeight: 600,
              fontSize: '13.5px',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            {cDict?.close || '닫기'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: '10px 22px',
              borderRadius: '10px',
              backgroundColor: '#0f172a',
              border: 'none',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '13.5px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)',
              transition: 'opacity 0.15s ease',
            }}
          >
            {cDict?.applyDefault || '이 조합으로 기본값 적용'}
          </button>
        </div>
      </div>
    </div>
  );
};
