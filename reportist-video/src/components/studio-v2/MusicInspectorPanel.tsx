import { useEffect, useRef, useState } from 'react';
import { Check, ListMusic, Loader2, Pause, Play, Upload, VolumeX } from 'lucide-react';
import { AUDIO_LIBRARY, type AudioLibraryTrack } from '../../data/audioLibrary.ts';
import { useI18n } from '../../i18n/index.tsx';
import { Tooltip } from '../ui/Tooltip.tsx';

// components/studio-v2/MusicInspectorPanel.tsx
// 하단 타임라인의 음악 트랙을 누르면 열리는 오른쪽 인스펙터 패널.
// 기존 오디오 보관함 모달의 기능(보관함 음원 미리 듣기·선택·적용, 배경음 없음,
// 내 음악 파일 직접 첨부, 볼륨·영상 길이 맞춤·삭제)을 사이드바 안에 그대로 담는다.

export interface MusicInspectorProps {
  bgmPresetId: string;
  bgmVolume: number;
  libraryTrackId: string | null;
  customAudioName: string | null;
  bgmFitToVideo: boolean;
  onApplyTrack: (track: AudioLibraryTrack | null) => Promise<void>;
  onVolumeChange: (volume: number) => void;
  onFitChange: (fit: boolean) => void;
  onPickFile: (file: File) => void;
  onRemove: () => void;
}

// 모달을 닫았다 다시 열어도 같은 음원을 재프로브하지 않도록 길이를 모듈 수준에서 캐시한다.
const trackDurationCache: Record<string, number> = {};

const formatDurationLabel = (sec?: number) => {
  if (!sec || !Number.isFinite(sec) || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const MusicInspectorPanel = ({
  bgmPresetId,
  bgmVolume,
  libraryTrackId,
  customAudioName,
  bgmFitToVideo,
  onApplyTrack,
  onVolumeChange,
  onFitChange,
  onPickFile,
  onRemove,
}: MusicInspectorProps) => {
  const { t } = useI18n();
  const hasCustom = Boolean(customAudioName);
  const hasMusic = hasCustom || Boolean(libraryTrackId) || bgmPresetId !== 'none';
  const [draftTrackId, setDraftTrackId] = useState<string | null>(() =>
    libraryTrackId ?? (hasMusic ? null : 'none')
  );
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [trackDurations, setTrackDurations] = useState<Record<string, number>>(() => ({
    ...trackDurationCache,
  }));
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 현재 적용된 음원이 바뀌면(다른 패널에서 교체/삭제 등) 선택 상태를 따라간다.
  useEffect(() => {
    setDraftTrackId(libraryTrackId ?? (hasMusic ? null : 'none'));
  }, [libraryTrackId, hasMusic]);

  // 보관함 음원 길이 메타데이터 로드 (패널이 열릴 때 1회만 프로브)
  useEffect(() => {
    let cancelled = false;
    const probes: HTMLAudioElement[] = [];
    AUDIO_LIBRARY.forEach((track) => {
      if (trackDurations[track.id]) return;
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.onloadedmetadata = () => {
        if (!cancelled && Number.isFinite(audio.duration) && audio.duration > 0) {
          trackDurationCache[track.id] = audio.duration;
          setTrackDurations((prev) => ({ ...prev, [track.id]: audio.duration }));
        }
      };
      audio.src = track.src;
      probes.push(audio);
    });
    return () => {
      cancelled = true;
      probes.forEach((audio) => {
        audio.src = '';
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 미리 듣기 재생/정지. 패널이 닫히면(언마운트) 재생을 확실히 멈춘다.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!previewTrackId) {
      audio.pause();
      return;
    }
    try {
      audio.currentTime = 0;
    } catch {
      // 메타데이터 로드 전에는 시크를 건너뜀
    }
    const playPromise = audio.play();
    if (playPromise) playPromise.catch(() => setPreviewTrackId(null));
    return () => audio.pause();
  }, [previewTrackId]);

  const previewTrack = AUDIO_LIBRARY.find((track) => track.id === previewTrackId) || null;

  const togglePreview = (track: AudioLibraryTrack) => {
    setPreviewTrackId((prev) => (prev === track.id ? null : track.id));
  };

  const handleApply = async () => {
    if (!draftTrackId) return;
    const nextTrack =
      draftTrackId === 'none'
        ? null
        : AUDIO_LIBRARY.find((track) => track.id === draftTrackId) || null;
    setIsApplying(true);
    setApplyError(null);
    try {
      await onApplyTrack(nextTrack);
      setPreviewTrackId(null);
    } catch {
      setApplyError(t('audioLibrary.error'));
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="sv2-inspector-body">
      <div className="sv2-inspector-section">
        <div className="sv2-field-label">
          <ListMusic size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
          {t('audioLibrary.title')}
        </div>
        <div className="sv2-field-hint">{t('audioLibrary.subtitle')}</div>
      </div>

      <div className="sv2-inspector-section">
        <div className="sv2-field-label">{t('audioLibrary.fromLibrary')}</div>
        <div className="sv2-music-list">
          <button
            type="button"
            className="sv2-music-item sv2-music-item-none"
            data-active={draftTrackId === 'none'}
            onClick={() => setDraftTrackId('none')}
          >
            <span className="sv2-music-play muted">
              <VolumeX size={15} />
            </span>
            <span className="sv2-music-item-text">
              <span className="sv2-music-item-title">{t('audioLibrary.none')}</span>
              <span className="sv2-music-item-meta">{t('audioLibrary.noneDesc')}</span>
            </span>
            <span className={`sv2-music-check ${draftTrackId === 'none' ? 'selected' : ''}`}>
              {draftTrackId === 'none' && <Check size={13} />}
            </span>
          </button>

          {AUDIO_LIBRARY.map((track) => {
            const isSelected = draftTrackId === track.id;
            const isPreviewing = previewTrackId === track.id;
            const duration = formatDurationLabel(trackDurations[track.id]);
            return (
              <div
                key={track.id}
                className="sv2-music-item"
                data-active={isSelected}
                role="button"
                tabIndex={0}
                onClick={() => setDraftTrackId(track.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setDraftTrackId(track.id);
                  }
                }}
              >
                <Tooltip
                  content={isPreviewing ? t('audioLibrary.stopPreview') : t('audioLibrary.preview')}
                >
                  <button
                    type="button"
                    className={`sv2-music-play ${isPreviewing ? 'playing' : ''}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      togglePreview(track);
                    }}
                    aria-label={isPreviewing ? t('audioLibrary.stopPreview') : t('audioLibrary.preview')}
                  >
                    {isPreviewing ? <Pause size={14} /> : <Play size={14} className="sv2-music-play-icon" />}
                  </button>
                </Tooltip>
                <span className="sv2-music-item-text">
                  <span className="sv2-music-item-title-row">
                    <span className="sv2-music-item-title">{track.name}</span>
                    {libraryTrackId === track.id && (
                      <em className="sv2-music-badge">{t('audioLibrary.selected')}</em>
                    )}
                  </span>
                  <span className="sv2-music-item-meta">
                    MP3{duration ? ` · ${duration}` : ''} · Reportist
                  </span>
                </span>
                <span className={`sv2-music-check ${isSelected ? 'selected' : ''}`}>
                  {isSelected && <Check size={13} />}
                </span>
              </div>
            );
          })}
        </div>

        {applyError && <div className="sv2-music-error">{applyError}</div>}

        <button
          type="button"
          className="sv2-btn sv2-btn-primary sv2-music-apply"
          onClick={() => void handleApply()}
          disabled={isApplying || draftTrackId === null}
        >
          {isApplying ? (
            <>
              <Loader2 size={14} className="sv2-spin" />
              {t('audioLibrary.loading')}
            </>
          ) : (
            t('audioLibrary.apply')
          )}
        </button>
        <div className="sv2-field-hint">{t('audioLibrary.footerTip')}</div>
      </div>

      <div className="sv2-inspector-section">
        <div className="sv2-field-label">
          <Upload size={13} style={{ verticalAlign: -2, marginRight: 6 }} />
          {t('bgm.myAudioFile')}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          style={{ display: 'none' }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onPickFile(file);
            event.target.value = '';
          }}
        />
        <button type="button" className="sv2-btn sv2-btn-sm" onClick={() => fileInputRef.current?.click()}>
          {customAudioName || t('bgm.uploadButton')}
        </button>
        <div className="sv2-field-hint">{t('bgm.uploadHint')}</div>
      </div>

      <div className="sv2-inspector-section">
        <div className="sv2-toggle-row">
          <span>{t('bgm.volume')}</span>
          <span className="sv2-music-volume-value">{Math.round(bgmVolume * 100)}%</span>
        </div>
        <input
          className="sv2-music-vol"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={bgmVolume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          aria-label={t('bgm.volume')}
        />
        <div className="sv2-toggle-row">
          <span>{t('bgm.fitToVideo')}</span>
          <button
            type="button"
            className="sv2-switch"
            data-on={bgmFitToVideo}
            aria-pressed={bgmFitToVideo}
            aria-label={t('bgm.fitToVideo')}
            onClick={() => onFitChange(!bgmFitToVideo)}
          />
        </div>
        <div className="sv2-field-hint">{t('bgm.fitToVideoDesc')}</div>
        {hasMusic && (
          <button
            type="button"
            className="sv2-btn sv2-btn-sm sv2-btn-ghost sv2-music-remove"
            onClick={onRemove}
          >
            {t('bgm.deleteBgm')}
          </button>
        )}
      </div>

      <audio
        key={previewTrackId ?? 'none'}
        ref={audioRef}
        src={previewTrack?.src}
        onEnded={() => setPreviewTrackId(null)}
        preload="none"
      />
    </div>
  );
};
