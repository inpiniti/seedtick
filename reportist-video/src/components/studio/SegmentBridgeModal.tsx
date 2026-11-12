// src/components/studio/SegmentBridgeModal.tsx
// 영상 편집 중 특정 클립 직전의 브릿지 효과를 개별 변경/건너뛰기 할 수 있는 모달

import React, { useState } from 'react';
import { X, Sparkles, Eye, Check } from 'lucide-react';
import type { BridgeDateTemplateId, BridgeLocationTemplateId, HighlightSegment } from '../../types/video.ts';
import {
  DATE_TEMPLATE_OPTIONS,
  LOCATION_TEMPLATE_OPTIONS,
  ChapterBridgePreviewModal,
} from './ChapterBridgePreviewModal.tsx';

interface SegmentBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  segment: HighlightSegment;
  segmentIndex: number;
  defaultDateTemplate?: BridgeDateTemplateId;
  defaultLocationTemplate?: BridgeLocationTemplateId;
  onSave: (updatedSegment: HighlightSegment) => void;
}

export const SegmentBridgeModal: React.FC<SegmentBridgeModalProps> = ({
  isOpen,
  onClose,
  segment,
  segmentIndex,
  defaultDateTemplate = 'flip-clock',
  defaultLocationTemplate = 'winding-route',
  onSave,
}) => {
  const [skipBridge, setSkipBridge] = useState<boolean>(segment.skipChapterBridge ?? false);
  const [dateTemplate, setDateTemplate] = useState<BridgeDateTemplateId | undefined>(
    segment.bridgeDateTemplateOverride
  );
  const [locationTemplate, setLocationTemplate] = useState<BridgeLocationTemplateId | undefined>(
    segment.bridgeLocationTemplateOverride
  );
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleApply = () => {
    onSave({
      ...segment,
      skipChapterBridge: skipBridge,
      bridgeDateTemplateOverride: dateTemplate,
      bridgeLocationTemplateOverride: locationTemplate,
    });
    onClose();
  };

  const effectiveDate = dateTemplate || defaultDateTemplate;
  const effectiveLocation = locationTemplate || defaultLocationTemplate;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          backgroundColor: 'rgba(3, 7, 18, 0.8)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '560px',
            backgroundColor: '#0f172a',
            borderRadius: '18px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
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
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(245, 208, 125, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f5d07d',
                }}
              >
                <Sparkles size={16} />
              </div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>
                클립 #{segmentIndex + 1} 챕터 브릿지 개별 설정
              </h3>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* 본문 */}
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* 세그먼트 메타 프리뷰 */}
            <div
              style={{
                backgroundColor: 'rgba(30, 41, 59, 0.5)',
                padding: '12px 14px',
                borderRadius: '10px',
                fontSize: '12px',
                color: '#94a3b8',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div>
                <strong style={{ color: '#f1f5f9' }}>날짜:</strong>{' '}
                {segment.subtitleDate || '(이전 클립과 동일/미지정)'}
              </div>
              <div>
                <strong style={{ color: '#f1f5f9' }}>장소:</strong>{' '}
                {segment.locationName || '(이전 클립과 동일/미지정)'}
              </div>
            </div>

            {/* 브릿지 건너뛰기 토글 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                  이 구간 챕터 브릿지 건너뛰기
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  날짜나 장소가 바뀌어도 전환 효과 없이 바로 다음 클립으로 넘어갑니다.
                </div>
              </div>
              <input
                type="checkbox"
                checked={skipBridge}
                onChange={(e) => setSkipBridge(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#f5d07d', cursor: 'pointer' }}
              />
            </div>

            {!skipBridge && (
              <>
                {/* 날짜 스타일 개별 선택 */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#f5d07d',
                      marginBottom: '6px',
                    }}
                  >
                    날짜(시간) 변경 스타일
                  </label>
                  <select
                    value={dateTemplate || ''}
                    onChange={(e) =>
                      setDateTemplate((e.target.value as BridgeDateTemplateId) || undefined)
                    }
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#ffffff',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">
                      [프로젝트 기본값] ({DATE_TEMPLATE_OPTIONS.find((o) => o.id === defaultDateTemplate)?.name})
                    </option>
                    {DATE_TEMPLATE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.num}번. {opt.name} - {opt.desc}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 장소 스타일 개별 선택 */}
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#38bdf8',
                      marginBottom: '6px',
                    }}
                  >
                    장소(위치) 이동 스타일
                  </label>
                  <select
                    value={locationTemplate || ''}
                    onChange={(e) =>
                      setLocationTemplate((e.target.value as BridgeLocationTemplateId) || undefined)
                    }
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      backgroundColor: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#ffffff',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">
                      [프로젝트 기본값] ({LOCATION_TEMPLATE_OPTIONS.find((o) => o.id === defaultLocationTemplate)?.name})
                    </option>
                    {LOCATION_TEMPLATE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.num}번. {opt.name} - {opt.desc}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 미리보기 버튼 */}
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '9px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    color: '#38bdf8',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Eye size={14} />이 조합 모션 실시간 미리보기
                </button>
              </>
            )}
          </div>

          {/* 풋터 */}
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#94a3b8',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              취소
            </button>
            <button
              onClick={handleApply}
              style={{
                padding: '8px 20px',
                borderRadius: '6px',
                backgroundColor: '#f5d07d',
                border: 'none',
                color: '#0f172a',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Check size={14} />
              적용하기
            </button>
          </div>
        </div>
      </div>

      {/* 미리보기 서브모달 */}
      <ChapterBridgePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        initialDateTemplate={effectiveDate}
        initialLocationTemplate={effectiveLocation}
        onApply={(d, l) => {
          setDateTemplate(d);
          setLocationTemplate(l);
        }}
      />
    </>
  );
};
