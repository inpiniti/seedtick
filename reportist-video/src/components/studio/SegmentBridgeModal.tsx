// src/components/studio/SegmentBridgeModal.tsx
// 영상 편집 중 특정 클립 직전의 브릿지 효과를 개별 변경/건너뛰기 할 수 있는 모달 (토스 라이트 테마 + 다국어 지원)

import React, { useState, useMemo } from 'react';
import { X, Sparkles, Eye, Check } from 'lucide-react';
import type { BridgeDateTemplateId, BridgeLocationTemplateId, HighlightSegment } from '../../types/video.ts';
import {
  DATE_TEMPLATE_OPTIONS,
  LOCATION_TEMPLATE_OPTIONS,
  ChapterBridgePreviewModal,
} from './ChapterBridgePreviewModal.tsx';
import { useI18n } from '../../i18n/index.tsx';

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
  const { dict, interpolate } = useI18n();
  const sDict = dict.segmentBridgeModal;
  const cDict = dict.chapterBridgeModal;

  const [skipBridge, setSkipBridge] = useState<boolean>(segment.skipChapterBridge ?? false);
  const [dateTemplate, setDateTemplate] = useState<BridgeDateTemplateId | undefined>(
    segment.bridgeDateTemplateOverride
  );
  const [locationTemplate, setLocationTemplate] = useState<BridgeLocationTemplateId | undefined>(
    segment.bridgeLocationTemplateOverride
  );
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

  // 번역된 템플릿 옵션
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

  const defaultDateName = dateOptions.find((o) => o.id === defaultDateTemplate)?.name || '';
  const defaultLocationName = locationOptions.find((o) => o.id === defaultLocationTemplate)?.name || '';

  if (!isOpen) return null;

  const handleApply = (e: React.MouseEvent) => {
    e.stopPropagation();
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
        className="model-modal-backdrop"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <div
          className="model-modal-card"
          style={{
            width: '100%',
            maxWidth: '520px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
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
              padding: '18px 22px',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#fef3c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#d97706',
                }}
              >
                <Sparkles size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                {interpolate(sDict?.title || '클립 #{num} 챕터 브릿지 개별 설정', {
                  num: segmentIndex + 1,
                })}
              </h3>
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
                padding: '6px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label={sDict?.cancel || '닫기'}
            >
              <X size={18} />
            </button>
          </div>

          {/* 본문 */}
          <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* 세그먼트 메타 프리뷰 */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                fontSize: '13px',
                color: '#64748b',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div>
                <strong style={{ color: '#0f172a' }}>{sDict?.sectionDate || '구간 날짜:'}</strong>{' '}
                {segment.subtitleDate || (sDict?.sameOrUnspecified || '(이전 클립과 동일/미지정)')}
              </div>
              <div>
                <strong style={{ color: '#0f172a' }}>{sDict?.sectionLocation || '구간 장소:'}</strong>{' '}
                {segment.locationName || (sDict?.sameOrUnspecified || '(이전 클립과 동일/미지정)')}
              </div>
            </div>

            {/* 브릿지 건너뛰기 토글 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderRadius: '12px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
              }}
            >
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
                  {sDict?.skipToggleTitle || '이 구간 챕터 브릿지 건너뛰기'}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  {sDict?.skipToggleDesc ||
                    '날짜나 장소가 바뀌어도 전환 효과 없이 바로 다음 클립으로 넘어갑니다.'}
                </div>
              </div>
              <input
                type="checkbox"
                checked={skipBridge}
                onChange={(e) => setSkipBridge(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#0f172a', cursor: 'pointer' }}
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
                      color: '#b45309',
                      marginBottom: '6px',
                    }}
                  >
                    {sDict?.dateSelectLabel || '날짜 스타일'}
                  </label>
                  <select
                    value={dateTemplate || ''}
                    onChange={(e) =>
                      setDateTemplate((e.target.value as BridgeDateTemplateId) || undefined)
                    }
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      fontSize: '13.5px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">
                      {interpolate(sDict?.projectDefault || '프로젝트 기본값: {name}', {
                        name: defaultDateName,
                      })}
                    </option>
                    {dateOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name} - {opt.desc}
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
                      color: '#334155',
                      marginBottom: '6px',
                    }}
                  >
                    {sDict?.locationSelectLabel || '장소 스타일'}
                  </label>
                  <select
                    value={locationTemplate || ''}
                    onChange={(e) =>
                      setLocationTemplate((e.target.value as BridgeLocationTemplateId) || undefined)
                    }
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      fontSize: '13.5px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">
                      {interpolate(sDict?.projectDefault || '프로젝트 기본값: {name}', {
                        name: defaultLocationName,
                      })}
                    </option>
                    {locationOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name} - {opt.desc}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 미리보기 버튼 */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPreviewOpen(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '10px',
                    borderRadius: '10px',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    color: '#0f172a',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Eye size={15} />
                  {sDict?.previewMotionBtn || '이 조합 모션 실시간 미리보기'}
                </button>
              </>
            )}
          </div>

          {/* 풋터 */}
          <div
            style={{
              padding: '16px 22px',
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
                padding: '9px 18px',
                borderRadius: '10px',
                backgroundColor: '#f1f5f9',
                border: 'none',
                color: '#475569',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {sDict?.cancel || '취소'}
            </button>
            <button
              type="button"
              onClick={handleApply}
              style={{
                padding: '9px 20px',
                borderRadius: '10px',
                backgroundColor: '#0f172a',
                border: 'none',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(15, 23, 42, 0.2)',
              }}
            >
              <Check size={15} />
              {sDict?.apply || '적용하기'}
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
        onApply={(dt, lt) => {
          setDateTemplate(dt);
          setLocationTemplate(lt);
        }}
      />
    </>
  );
};
