import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ScrollFade } from '@animate-ui/react/primitives/effects/scroll-fade';
import { Film, ImagePlus, Repeat2, RotateCcw, Type } from 'lucide-react';
import {
  INTRO_DURATIONS,
  INTRO_TEMPLATE_OPTIONS,
  OUTRO_DURATIONS,
  OUTRO_TEMPLATE_OPTIONS,
  getLocalizedOutroText,
  getLocalizedTemplateMeta,
} from '../studio/introOutroOptions.ts';
import type {
  IntroTemplateId,
  OutroTemplateId,
  VideoOrientation,
  VideoOverlayOptions,
} from '../../types/video.ts';
import type { PreviewRequest } from './types.ts';
import { setStoredShowCredit } from '../../services/introOutroStorage.ts';
import { useI18n } from '../../i18n/index.tsx';
import { scrollFadePanelProps } from '../common/scrollFade.ts';
import { Tooltip } from '../ui/Tooltip.tsx';

// components/studio-v2/IntroOutroInspectorPanel.tsx
// 인트로/아웃트로 ON·OFF, 템플릿, 문구, 길이, 직접 업로드 설정.
// 템플릿을 누르면 중앙 미리보기가 해당 구간으로 이동해 0%→100% 재생된다.

type SectionKind = 'intro' | 'outro';

interface TemplateThumbProps {
  kind: SectionKind;
  templateId: string;
  progress: number;
  orientation: VideoOrientation;
  outroText: string;
}

/** 템플릿 카드의 미니 썸네일. 대표 프레임을 한 번만 그려 모션을 누르기 전에도 구분할 수 있게 한다. */
const TemplateThumb = memo(
  ({ kind, templateId, progress, orientation, outroText }: TemplateThumbProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // 실제 표시 크기보다 큰 캔버스에 그려 썸네일도 선명하게 보이게 한다.
    const width = orientation === 'portrait' ? 144 : 320;
    const height = orientation === 'portrait' ? 256 : 180;

    useEffect(() => {
      let alive = true;
      // GSAP 렌더러는 지연 로드해 초기 번들에 포함하지 않는다.
      void import('../../services/hyperframesIntroOutroRenderer.ts')
        .then((m) => {
          const canvas = canvasRef.current;
          if (!alive || !canvas) return;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          const mockOptions: VideoOverlayOptions = {
            showTitle: true,
            titleText: 'PenguinCut',
            showChannel: true,
            channelText: '@penguincut',
            showSubtitle: true,
            showDate: true,
            showIntro: true,
            showOutro: true,
            introTemplate: kind === 'intro' ? (templateId as IntroTemplateId) : 'kinetic-slide',
            outroTemplate: kind === 'outro' ? (templateId as OutroTemplateId) : 'modern-endcard',
            introDurationSec: 2,
            outroDurationSec: 2.2,
            outroText,
          };
          if (kind === 'intro') {
            m.renderHyperframesIntroFrame(ctx, progress, mockOptions, canvas.width, canvas.height);
          } else {
            m.renderHyperframesOutroFrame(ctx, progress, mockOptions, canvas.width, canvas.height);
          }
        })
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, [kind, templateId, progress, orientation, outroText]);

    return (
      <canvas
        ref={canvasRef}
        className="sv2-template-thumb"
        width={width}
        height={height}
        data-orientation={orientation}
        aria-hidden="true"
      />
    );
  }
);
TemplateThumb.displayName = 'TemplateThumb';

interface IntroOutroInspectorPanelProps {
  kind: SectionKind;
  overlayOptions: VideoOverlayOptions;
  orientation: VideoOrientation;
  onChange: (patch: Partial<VideoOverlayOptions>) => void;
  onPreviewRequest: (request: PreviewRequest) => void;
}

export const IntroOutroInspectorPanel = ({
  kind,
  overlayOptions,
  orientation,
  onChange,
  onPreviewRequest,
}: IntroOutroInspectorPanelProps) => {
  const { dict, ui } = useI18n();
  const outroText = getLocalizedOutroText(dict);
  const fileRef = useRef<HTMLInputElement>(null);
  const [loop, setLoop] = useState(false);
  const loopRef = useRef(loop);
  loopRef.current = loop;
  const replayTimerRef = useRef<number | null>(null);

  const isIntro = kind === 'intro';
  const enabled = isIntro ? overlayOptions.showIntro : overlayOptions.showOutro;
  const template = (isIntro ? overlayOptions.introTemplate : overlayOptions.outroTemplate) as
    | IntroTemplateId
    | OutroTemplateId;
  const duration = (isIntro ? overlayOptions.introDurationSec : overlayOptions.outroDurationSec) ?? 2;
  const templates = isIntro ? INTRO_TEMPLATE_OPTIONS : OUTRO_TEMPLATE_OPTIONS;
  const durations = isIntro ? INTRO_DURATIONS : OUTRO_DURATIONS;
  const currentFile = isIntro ? overlayOptions.introVideoFile : overlayOptions.outroVideoFile;

  const cancelPendingReplay = useCallback(() => {
    if (replayTimerRef.current !== null) {
      window.clearTimeout(replayTimerRef.current);
      replayTimerRef.current = null;
    }
  }, []);

  useEffect(() => cancelPendingReplay, [cancelPendingReplay]);

  const requestReplay = useCallback(() => {
    cancelPendingReplay();
    onPreviewRequest({ kind, mode: 'replay', loop: loopRef.current });
  }, [cancelPendingReplay, kind, onPreviewRequest]);

  // 숫자 입력은 타이핑마다 재시작하지 않고 짧은 디바운스 후 템포를 한 번 확인한다.
  const requestReplaySoon = useCallback(() => {
    cancelPendingReplay();
    replayTimerRef.current = window.setTimeout(() => {
      replayTimerRef.current = null;
      onPreviewRequest({ kind, mode: 'replay', loop: loopRef.current });
    }, 280);
  }, [cancelPendingReplay, kind, onPreviewRequest]);

  const holdRepresentative = useCallback(() => {
    onPreviewRequest({ kind, mode: 'hold', progress: 0.8 });
  }, [kind, onPreviewRequest]);

  const toggleEnabled = useCallback(() => {
    const next = !enabled;
    onChange(isIntro ? { showIntro: next } : { showOutro: next });
    if (next) requestReplay();
    else cancelPendingReplay();
  }, [cancelPendingReplay, enabled, isIntro, onChange, requestReplay]);

  const selectTemplate = useCallback(
    (id: string) => {
      onChange({
        ...(isIntro
          ? { introTemplate: id as IntroTemplateId }
          : { outroTemplate: id as OutroTemplateId }),
        ...(enabled ? {} : isIntro ? { showIntro: true } : { showOutro: true }),
        // 템플릿을 고르면 모션으로 전환한다는 것을 UI에서도 명확히 한다.
        ...(isIntro ? { introVideoFile: null } : { outroVideoFile: null }),
      });
      requestReplay();
      // 온보딩이 템플릿 미리보기 완료 시점을 알 수 있게 알린다.
      if (isIntro) {
        window.dispatchEvent(new CustomEvent('sv2:intro-template-previewed', { detail: { id } }));
      }
    },
    [enabled, isIntro, onChange, requestReplay]
  );

  const chooseDuration = useCallback(
    (seconds: number) => {
      onChange(
        isIntro ? { introDurationSec: seconds } : { outroDurationSec: seconds }
      );
      requestReplay();
    },
    [isIntro, onChange, requestReplay]
  );

  return (
    <ScrollFade asChild {...scrollFadePanelProps}>
    <div className="sv2-inspector-body">
      <div className="sv2-inspector-section">
        <div className="sv2-toggle-row">
          <span>{isIntro ? ui('인트로 사용') : ui('아웃트로 사용')}</span>
          <button
            type="button"
            className="sv2-switch"
            data-on={enabled}
            aria-label={isIntro ? ui('인트로 켜기') : ui('아웃트로 켜기')}
            onClick={toggleEnabled}
          />
        </div>
      </div>

      {!isIntro && (
        <div className="sv2-inspector-section">
          <div className="sv2-toggle-row">
            <span>{ui('PenguinCut 크레딧 표시')}</span>
            <button
              type="button"
              className="sv2-switch"
              data-on={overlayOptions.showCredit !== false}
              aria-label={ui('PenguinCut 크레딧 표시')}
              onClick={() => {
                const next = overlayOptions.showCredit === false;
                onChange({ showCredit: next });
                setStoredShowCredit(next);
              }}
            />
          </div>
          <div className="sv2-field-hint">
            {ui('영상 끝에 제작 크레딧을 넣어요. 무료로 언제든 끌 수 있어요.')}
          </div>
        </div>
      )}

      <div className="sv2-inspector-section">
        <div className="sv2-template-head">
          <div className="sv2-field-label">
            <Film size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
            {ui('모션 템플릿')}
          </div>
          <div className="sv2-preview-actions">
            <Tooltip content={ui('처음부터 다시 재생')}>
              <button
                type="button"
                className="sv2-btn sv2-btn-sm"
                onClick={requestReplay}
              >
                <RotateCcw size={13} /> {ui('다시 재생')}
              </button>
            </Tooltip>
            <Tooltip content={ui('구간 반복 재생')}>
              <button
                type="button"
                className="sv2-btn sv2-btn-sm"
                data-on={loop}
                aria-pressed={loop}
                onClick={() => {
                  const next = !loop;
                  setLoop(next);
                  // 토글 즉시 현재 구간을 다시 재생해 반복 여부를 바로 확인할 수 있게 한다.
                  onPreviewRequest({ kind, mode: 'replay', loop: next });
                }}
              >
                <Repeat2 size={13} /> {ui('반복')}
              </button>
            </Tooltip>
          </div>
        </div>
        {currentFile && (
          <div className="sv2-video-applied">
            {ui('직접 올린 영상이 적용 중이에요 · 템플릿을 누르면 모션으로 전환돼요.')}
          </div>
        )}
        <div className="sv2-template-grid" data-orientation={orientation}>
          {templates.map((t) => {
            const meta = getLocalizedTemplateMeta(dict, kind, t.id);
            return (
              <Tooltip key={t.id} content={meta.desc}>
                <button
                  type="button"
                  className="sv2-template-card"
                  data-active={template === t.id}
                  data-orientation={orientation}
                  data-tour={isIntro ? 'onboarding-intro-template' : undefined}
                  data-template-id={t.id}
                  onClick={() => selectTemplate(t.id)}
                >
                  <TemplateThumb
                    kind={kind}
                    templateId={t.id}
                    progress={t.previewProgress}
                    orientation={orientation}
                    outroText={outroText}
                  />
                  <span className="sv2-template-card-body">
                    <span className="sv2-template-card-title">
                      <span className="sv2-template-name">{meta.name}</span>
                      <em className="sv2-template-badge">{meta.badge}</em>
                    </span>
                    <span className="sv2-template-card-desc">{meta.desc}</span>
                  </span>
                </button>
              </Tooltip>
            );
          })}
        </div>
      </div>

      <div className="sv2-inspector-section">
        <div className="sv2-field-label">
          <Type size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
          {isIntro ? ui('인트로 문구') : ui('아웃트로 문구')}
        </div>
        {isIntro ? (
          <input
            className="sv2-input"
            value={overlayOptions.titleText || ''}
            placeholder={ui('프로젝트 제목')}
            onChange={(e) => {
              onChange({
                titleText: e.target.value,
                showTitle: Boolean(e.target.value),
              });
              holdRepresentative();
            }}
          />
        ) : (
          <textarea
            className="sv2-input sv2-textarea"
            value={overlayOptions.outroText || ''}
            placeholder={outroText}
            onChange={(e) => {
              onChange({ outroText: e.target.value });
              holdRepresentative();
            }}
          />
        )}
        {!isIntro && (
          <div className="sv2-field-hint">
            {ui("비워두면 '{text}'가 표시돼요.", { text: outroText })}
          </div>
        )}
        <div className="sv2-field-label" style={{ marginTop: 4 }}>
          {ui('길이 (초)')}
        </div>
        <div className="sv2-duration-presets">
          {durations.map((seconds) => (
            <button
              key={seconds}
              type="button"
              className="sv2-duration-chip"
              data-active={Math.abs(duration - seconds) < 0.01}
              onClick={() => chooseDuration(seconds)}
            >
              {ui('{count}초', { count: seconds.toFixed(1) })}
            </button>
          ))}
        </div>
        <input
          type="number"
          className="sv2-input"
          min={0.5}
          max={8}
          step={0.1}
          value={duration}
          onChange={(e) => {
            const next = Math.max(0.5, Number(e.target.value) || 0.5);
            onChange(
              isIntro ? { introDurationSec: next } : { outroDurationSec: next }
            );
            requestReplaySoon();
          }}
        />
      </div>

      <div className="sv2-inspector-section">
        <div className="sv2-field-label">
          <ImagePlus size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
          {ui('직접 만든 영상 사용 (선택)')}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            onChange(isIntro ? { introVideoFile: file } : { outroVideoFile: file });
            if (file) requestReplay();
          }}
        />
        <button type="button" className="sv2-btn sv2-btn-sm" onClick={() => fileRef.current?.click()}>
          {currentFile ? currentFile.name : ui('영상 파일 선택')}
        </button>
        {currentFile && (
          <button
            type="button"
            className="sv2-btn sv2-btn-sm sv2-btn-ghost"
            onClick={() => {
              onChange(isIntro ? { introVideoFile: null } : { outroVideoFile: null });
              requestReplay();
            }}
          >
            {ui('선택 해제')}
          </button>
        )}
      </div>
    </div>
    </ScrollFade>
  );
};
