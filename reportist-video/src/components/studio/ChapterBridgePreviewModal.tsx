// src/components/studio/ChapterBridgePreviewModal.tsx
// 챕터 브릿지 날짜(1~5번) x 장소(1~5번) 실시간 조합 미리보기 모달

import React, { useEffect, useRef, useState } from 'react';
import { X, Play, Pause, RotateCcw, Sparkles, Clock, Navigation } from 'lucide-react';
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

  useEffect(() => {
    setDateTemplate(initialDateTemplate);
    setLocationTemplate(initialLocationTemplate);
    setCurrentTime(0);
    setIsPlaying(true);
    startTimeRef.current = performance.now();
  }, [initialDateTemplate, initialLocationTemplate, isOpen]);

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

    let localIsPlaying = isPlaying;

    const renderLoop = (now: number) => {
      let t = 0;
      if (localIsPlaying) {
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
  }, [isOpen, dateTemplate, locationTemplate, isPlaying]);

  if (!isOpen) return null;

  const togglePlay = () => {
    if (isPlaying) {
      pausedTimeRef.current = currentTime;
      setIsPlaying(false);
    } else {
      startTimeRef.current = performance.now() - pausedTimeRef.current * 1000;
      setIsPlaying(true);
    }
  };

  const handleRestart = () => {
    startTimeRef.current = performance.now();
    pausedTimeRef.current = 0;
    setCurrentTime(0);
    setIsPlaying(true);
  };

  const handleSeek = (time: number) => {
    pausedTimeRef.current = time;
    setCurrentTime(time);
    setIsPlaying(false);
  };

  const handleSave = () => {
    if (onApply) {
      onApply(dateTemplate, locationTemplate);
    }
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(3, 7, 18, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '880px',
          maxHeight: '92vh',
          backgroundColor: '#0f172a',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#f8fafc',
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #f5d07d, #eab308)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0f172a',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#ffffff' }}>
                챕터 브릿지 모션 템플릿 & 실시간 미리보기
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>
                날짜 스타일과 장소 스타일을 원하는 조합으로 믹스앤매치할 수 있습니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 바디 (캔버스 + 컨트롤러 + 선택 탭) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 캔버스 프리뷰 뷰어 */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              borderRadius: '14px',
              overflow: 'hidden',
              backgroundColor: '#07090e',
              border: '1px solid rgba(245, 208, 125, 0.25)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
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
            {/* 좌상단 템플릿 정보 배지 */}
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
              backgroundColor: 'rgba(30, 41, 59, 0.6)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            <button
              onClick={togglePlay}
              style={{
                background: '#f5d07d',
                color: '#0f172a',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 12px',
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
              onClick={handleRestart}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#e2e8f0',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 10px',
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
              style={{ flex: 1, accentColor: '#f5d07d', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#94a3b8', minWidth: '70px', textAlign: 'right' }}>
              {currentTime.toFixed(2)}s / {CHAPTER_BRIDGE_DURATION.toFixed(1)}s
            </span>
          </div>

          {/* 템플릿 선택 그리드 2열 (좌: 날짜 5종, 우: 장소 5종) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* [날짜 템플릿 5종] */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f5d07d', fontWeight: 700, fontSize: '14px' }}>
                <Clock size={16} />
                <span>날짜(시간) 변경 스타일 (1~5번)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {DATE_TEMPLATE_OPTIONS.map((opt) => {
                  const selected = dateTemplate === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setDateTemplate(opt.id)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: selected ? '2px solid #f5d07d' : '1px solid rgba(255, 255, 255, 0.08)',
                        backgroundColor: selected ? 'rgba(245, 208, 125, 0.12)' : 'rgba(30, 41, 59, 0.5)',
                        color: selected ? '#ffffff' : '#94a3b8',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: selected ? '#f5d07d' : '#f1f5f9' }}>
                          {opt.num}번. {opt.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{opt.desc}</div>
                      </div>
                      {selected && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#0f172a',
                            backgroundColor: '#f5d07d',
                            padding: '2px 8px',
                            borderRadius: '12px',
                          }}
                        >
                          선택됨
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* [장소 템플릿 5종] */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontWeight: 700, fontSize: '14px' }}>
                <Navigation size={16} />
                <span>장소(위치) 이동 스타일 (1~5번)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {LOCATION_TEMPLATE_OPTIONS.map((opt) => {
                  const selected = locationTemplate === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setLocationTemplate(opt.id)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: selected ? '2px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                        backgroundColor: selected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(30, 41, 59, 0.5)',
                        color: selected ? '#ffffff' : '#94a3b8',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: selected ? '#38bdf8' : '#f1f5f9' }}>
                          {opt.num}번. {opt.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{opt.desc}</div>
                      </div>
                      {selected && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#0f172a',
                            backgroundColor: '#38bdf8',
                            padding: '2px 8px',
                            borderRadius: '12px',
                          }}
                        >
                          선택됨
                        </span>
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
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: '#e2e8f0',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            닫기
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '9px 22px',
              borderRadius: '8px',
              backgroundColor: '#f5d07d',
              border: 'none',
              color: '#0f172a',
              fontWeight: 800,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(245, 208, 125, 0.3)',
            }}
          >
            이 조합으로 기본값 적용
          </button>
        </div>
      </div>
    </div>
  );
};
