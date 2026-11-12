// src/components/studio/ChapterBridgePreviewModal.tsx
// 챕터 브릿지 날짜(1~5번) x 장소(1~5번) 실시간 조합 미리보기 모달 (토스 스타일 라이트 테마)

import React, { useEffect, useRef, useState } from 'react';
import { X, Play, Pause, RotateCcw, Sparkles, Clock, Navigation, Check } from 'lucide-react';
import {
  CHAPTER_BRIDGE_DURATION,
  createHyperframesBridgeController,
  type ChapterBridgeTransitionInfo,
} from '../../services/hyperframesBridgeRenderer.ts';
import type { BridgeDateTemplateId, BridgeLocationTemplateId } from '../../types/video.ts';

interface ChapterBridgePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDateTemplate?: BridgeDateTemplateId;
  initialLocationTemplate?: BridgeLocationTemplateId;
  onApply?: (dateTemplate: BridgeDateTemplateId, locationTemplate: BridgeLocationTemplateId) => void;
}

export const DATE_TEMPLATE_OPTIONS: Array<{
  id: BridgeDateTemplateId;
  num: number;
  name: string;
  desc: string;
}> = [
  { id: 'flip-clock', num: 1, name: '플립 시계 (기본)', desc: '착착 넘어가는 아날로그 탁상 시계' },
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
  { id: 'winding-route', num: 1, name: '로드트립 S경로 (기본)', desc: '지도 위 구불구불한 점선과 주행 차량' },
  { id: 'globe-spin', num: 2, name: '3D 글로브 아크', desc: '회전하는 지구본과 포물선 비행 궤적' },
  { id: 'boarding-pass', num: 3, name: '보딩패스 티켓', desc: '항공권 바코드와 도착 고무 스탬프' },
  { id: 'minimal-editorial', num: 4, name: '미니멀 에디토리얼', desc: '우아한 라인과 다음 여행지 안내' },
  { id: 'gps-cyber', num: 5, name: 'GPS 내비게이션 HUD', desc: '첨단 차량 내비와 3D 도로 경로선' },
];

export const ChapterBridgePreviewModal: React.FC<ChapterBridgePreviewModalProps> = ({
  isOpen,
  onClose,
  initialDateTemplate = 'flip-clock',
  initialLocationTemplate = 'winding-route',
  onApply,
}) => {
  const [dateTemplate, setDateTemplate] = useState<BridgeDateTemplateId>(initialDateTemplate);
  const [locationTemplate, setLocationTemplate] = useState<BridgeLocationTemplateId>(initialLocationTemplate);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(performance.now());
  const pausedTimeRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(true);

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
    }
  }, [isOpen, initialDateTemplate, initialLocationTemplate]);

  // 애니메이션 캔버스 렌더 루프
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
      fromLocation: '서울 (김포공항)',
      toLocation: '도쿄 (하네다)',
      sceneTitle: '도쿄 여행 출발',
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
  }, [isOpen, dateTemplate, locationTemplate]);

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
  };

  return (
    <div
      className="model-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      {/* 모달 카드 (토스 스타일 라이트 테마: 화이트 배경, 깔끔한 섀도우) */}
      <div
        className="model-modal-card"
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '90vh',
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#0f172a',
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid #f1f5f9',
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#fef3c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#d97706',
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                챕터 브릿지 모션 템플릿 & 실시간 미리보기
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                날짜 스타일과 장소 스타일을 원하는 조합으로 믹스앤매치할 수 있습니다.
              </p>
            </div>
          </div>
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
          >
            <X size={18} />
          </button>
        </div>

        {/* 바디 (캔버스 + 컨트롤 바 + 템플릿 선택 그리드) */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            backgroundColor: '#f8fafc',
          }}
        >
          {/* 캔버스 비디오 프리뷰 (화면 비율 16:9, 다크 스크린) */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              borderRadius: '16px',
              overflow: 'hidden',
              backgroundColor: '#07090e',
              border: '1px solid #0f172a',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.15)',
              aspectRatio: '16 / 9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <canvas
              ref={canvasRef}
              width={960}
              height={540}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
            {/* 좌상단 템플릿 배지 */}
            <div
              style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                display: 'flex',
                gap: '8px',
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid rgba(245, 208, 125, 0.5)',
                  color: '#f5d07d',
                  backdropFilter: 'blur(4px)',
                }}
              >
                날짜: {DATE_TEMPLATE_OPTIONS.find((o) => o.id === dateTemplate)?.name}
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid rgba(56, 189, 248, 0.5)',
                  color: '#38bdf8',
                  backdropFilter: 'blur(4px)',
                }}
              >
                장소: {LOCATION_TEMPLATE_OPTIONS.find((o) => o.id === locationTemplate)?.name}
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
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
            }}
          >
            <button
              type="button"
              onClick={togglePlay}
              style={{
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '7px 14px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              {isPlaying ? '일시정지' : '재생'}
            </button>
            <button
              type="button"
              onClick={handleRestart}
              style={{
                background: '#f1f5f9',
                color: '#334155',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '7px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              title="처음부터 다시 보기"
            >
              <RotateCcw size={14} />
            </button>
            <input
              type="range"
              min={0}
              max={CHAPTER_BRIDGE_DURATION}
              step={0.03}
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: '#0f172a', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '12.5px', fontFamily: 'monospace', color: '#64748b', minWidth: '70px', textAlign: 'right' }}>
              {currentTime.toFixed(2)}s / {CHAPTER_BRIDGE_DURATION.toFixed(1)}s
            </span>
          </div>

          {/* 템플릿 선택 그리드 (토스 스타일 화이트 카드) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* [날짜 템플릿 5종] */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: '16px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', fontWeight: 700, fontSize: '14px' }}>
                <Clock size={16} />
                <span>날짜(시간) 변경 스타일 (1~5번)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {DATE_TEMPLATE_OPTIONS.map((opt) => {
                  const selected = dateTemplate === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={(e) => handleSelectDate(e, opt.id)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: selected ? '2px solid #f59e0b' : '1px solid #f1f5f9',
                        backgroundColor: selected ? '#fef3c7' : '#ffffff',
                        color: '#0f172a',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: selected ? '#b45309' : '#1e293b' }}>
                          {opt.num}번. {opt.name}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>{opt.desc}</div>
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

            {/* [장소 템플릿 5종] */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: '16px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0369a1', fontWeight: 700, fontSize: '14px' }}>
                <Navigation size={16} />
                <span>장소(위치) 이동 스타일 (1~5번)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {LOCATION_TEMPLATE_OPTIONS.map((opt) => {
                  const selected = locationTemplate === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={(e) => handleSelectLocation(e, opt.id)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: selected ? '2px solid #0284c7' : '1px solid #f1f5f9',
                        backgroundColor: selected ? '#e0f2fe' : '#ffffff',
                        color: '#0f172a',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: selected ? '#0369a1' : '#1e293b' }}>
                          {opt.num}번. {opt.name}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>{opt.desc}</div>
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
          </div>
        </div>

        {/* 풋터 */}
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
            }}
          >
            닫기
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
            }}
          >
            이 조합으로 기본값 적용
          </button>
        </div>
      </div>
    </div>
  );
};
