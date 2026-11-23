import { useRef } from 'react';
import { Film, ImagePlus, Type } from 'lucide-react';
import type {
  IntroTemplateId,
  OutroTemplateId,
  VideoOverlayOptions,
} from '../../types/video.ts';

// components/studio-v2/IntroOutroInspectorPanel.tsx
// 인트로/아웃트로 ON·OFF, 템플릿, 문구, 길이, 직접 업로드 설정.

const INTRO_TEMPLATES: Array<{ id: IntroTemplateId; label: string }> = [
  { id: 'kinetic-slide', label: '키네틱 슬라이드' },
  { id: 'split-flap', label: '스플릿 플랩' },
  { id: 'cinematic-letterbox', label: '시네마틱' },
  { id: 'film-countdown', label: '필름 카운트다운' },
];

const OUTRO_TEMPLATES: Array<{ id: OutroTemplateId; label: string }> = [
  { id: 'modern-endcard', label: '모던 엔드카드' },
  { id: 'minimal-fade', label: '미니멀 페이드' },
  { id: 'curtain-split', label: '커튼 스플릿' },
  { id: 'slide-panel', label: '슬라이드 패널' },
  { id: 'typewriter-credits', label: '타이프라이터' },
  { id: 'light-burst', label: '라이트 버스트' },
];

interface IntroOutroInspectorPanelProps {
  kind: 'intro' | 'outro';
  overlayOptions: VideoOverlayOptions;
  onChange: (patch: Partial<VideoOverlayOptions>) => void;
}

export const IntroOutroInspectorPanel = ({
  kind,
  overlayOptions,
  onChange,
}: IntroOutroInspectorPanelProps) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const isIntro = kind === 'intro';
  const enabled = isIntro ? overlayOptions.showIntro : overlayOptions.showOutro;
  const template = (isIntro ? overlayOptions.introTemplate : overlayOptions.outroTemplate) as
    | IntroTemplateId
    | OutroTemplateId;
  const duration = (isIntro ? overlayOptions.introDurationSec : overlayOptions.outroDurationSec) ?? 2;
  const templates = isIntro ? INTRO_TEMPLATES : OUTRO_TEMPLATES;
  const currentFile = isIntro ? overlayOptions.introVideoFile : overlayOptions.outroVideoFile;

  return (
    <div className="sv2-inspector-body">
      <div className="sv2-inspector-section">
        <div className="sv2-toggle-row">
          <span>{isIntro ? '인트로 사용' : '아웃트로 사용'}</span>
          <button
            type="button"
            className="sv2-switch"
            data-on={enabled}
            aria-label={isIntro ? '인트로 켜기' : '아웃트로 켜기'}
            onClick={() =>
              onChange(isIntro ? { showIntro: !enabled } : { showOutro: !enabled })
            }
          />
        </div>
      </div>

      <div className="sv2-inspector-section">
        <div className="sv2-field-label">
          <Film size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
          모션 템플릿
        </div>
        <div className="sv2-template-grid">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              className="sv2-template-btn"
              data-active={template === t.id}
              onClick={() =>
                onChange(
                  isIntro
                    ? { introTemplate: t.id as IntroTemplateId }
                    : { outroTemplate: t.id as OutroTemplateId }
                )
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="sv2-inspector-section">
        <div className="sv2-field-label">
          <Type size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
          {isIntro ? '인트로 문구' : '아웃트로 문구'}
        </div>
        {isIntro ? (
          <input
            className="sv2-input"
            value={overlayOptions.titleText || ''}
            placeholder="프로젝트 제목"
            onChange={(e) => onChange({ titleText: e.target.value, showTitle: Boolean(e.target.value) })}
          />
        ) : (
          <textarea
            className="sv2-input sv2-textarea"
            value={overlayOptions.outroText || ''}
            placeholder="마무리 문구"
            onChange={(e) => onChange({ outroText: e.target.value })}
          />
        )}
        <div className="sv2-field-label" style={{ marginTop: 4 }}>
          길이 (초)
        </div>
        <input
          type="number"
          className="sv2-input"
          min={0.5}
          max={8}
          step={0.1}
          value={duration}
          onChange={(e) =>
            onChange(
              isIntro
                ? { introDurationSec: Math.max(0.5, Number(e.target.value) || 0.5) }
                : { outroDurationSec: Math.max(0.5, Number(e.target.value) || 0.5) }
            )
          }
        />
      </div>

      <div className="sv2-inspector-section">
        <div className="sv2-field-label">
          <ImagePlus size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
          직접 만든 영상 사용 (선택)
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            onChange(isIntro ? { introVideoFile: file } : { outroVideoFile: file });
          }}
        />
        <button type="button" className="sv2-btn sv2-btn-sm" onClick={() => fileRef.current?.click()}>
          {currentFile ? currentFile.name : '영상 파일 선택'}
        </button>
        {currentFile && (
          <button
            type="button"
            className="sv2-btn sv2-btn-sm sv2-btn-ghost"
            onClick={() => onChange(isIntro ? { introVideoFile: null } : { outroVideoFile: null })}
          >
            선택 해제
          </button>
        )}
      </div>
    </div>
  );
};
