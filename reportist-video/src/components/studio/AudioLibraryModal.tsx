// components/studio/AudioLibraryModal.tsx - 내장 배경음악을 미리 듣고 선택하는 오디오 보관함 팝업

import React, { useEffect, useRef, useState } from 'react';
import { Check, Headphones, ListMusic, Loader2, Pause, Play, VolumeX, X } from 'lucide-react';
import { AUDIO_LIBRARY, type AudioLibraryTrack } from '../../data/audioLibrary.ts';
import { useI18n } from '../../i18n/index.tsx';

interface AudioLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTrackId: string | null;
  hasAppliedAudio: boolean;
  onApply: (track: AudioLibraryTrack | null) => Promise<void>;
}

export const AudioLibraryModal: React.FC<AudioLibraryModalProps> = ({
  isOpen,
  onClose,
  selectedTrackId,
  hasAppliedAudio,
  onApply,
}) => {
  const { dict } = useI18n();
  const [draftTrackId, setDraftTrackId] = useState<string | null>('none');
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [trackDurations, setTrackDurations] = useState<Record<string, number>>({});
  const audioRef = useRef<HTMLAudioElement>(null);

  const formatDurationLabel = (sec?: number) => {
    if (!sec || !Number.isFinite(sec) || sec <= 0) return null;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // 보관함 음원 길이 메타데이터 로드
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const probes: HTMLAudioElement[] = [];

    AUDIO_LIBRARY.forEach((track) => {
      if (trackDurations[track.id]) return;
      const a = new Audio();
      a.preload = 'metadata';
      a.onloadedmetadata = () => {
        if (!cancelled && Number.isFinite(a.duration) && a.duration > 0) {
          setTrackDurations((prev) => ({ ...prev, [track.id]: a.duration }));
        }
      };
      a.src = track.src;
      probes.push(a);
    });

    return () => {
      cancelled = true;
      probes.forEach((a) => {
        a.src = '';
      });
    };
  }, [isOpen, trackDurations]);

  // 팝업이 열릴 때 현재 적용된 음원 상태로 선택값 초기화
  useEffect(() => {
    if (!isOpen) {
      setPreviewTrackId(null);
      return;
    }
    setDraftTrackId(selectedTrackId ?? (hasAppliedAudio ? null : 'none'));
    setPreviewTrackId(null);
    setApplyError(null);
    setIsApplying(false);
  }, [isOpen, selectedTrackId, hasAppliedAudio]);

  // ESC로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 미리 듣기 재생/정지
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isOpen) return;

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
    if (playPromise) {
      playPromise.catch(() => setPreviewTrackId(null));
    }
  }, [previewTrackId, isOpen]);

  if (!isOpen) return null;

  const previewTrack = AUDIO_LIBRARY.find((track) => track.id === previewTrackId) || null;

  const togglePreview = (track: AudioLibraryTrack) => {
    setPreviewTrackId((prev) => (prev === track.id ? null : track.id));
  };

  const handleApply = async () => {
    if (draftTrackId === null) return;
    const nextTrack =
      draftTrackId === 'none'
        ? null
        : AUDIO_LIBRARY.find((track) => track.id === draftTrackId) || null;

    setIsApplying(true);
    setApplyError(null);
    try {
      await onApply(nextTrack);
      setPreviewTrackId(null);
      onClose();
    } catch {
      setApplyError(dict.audioLibrary.error);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="model-modal-backdrop" onClick={onClose}>
      <div
        className="model-modal-card audio-library-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audio-library-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="model-modal-header">
          <div className="model-modal-title-row">
            <div className="model-modal-icon-badge">
              <ListMusic size={21} color="#3182f6" />
            </div>
            <div>
              <h2 className="model-modal-title" id="audio-library-title">
                {dict.audioLibrary.title}
              </h2>
              <p className="model-modal-subtitle">{dict.audioLibrary.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            className="model-modal-close-btn"
            onClick={onClose}
            aria-label={dict.common.close}
          >
            <X size={20} />
          </button>
        </div>

        <div className="audio-library-body">
          <button
            type="button"
            className={`audio-library-item audio-library-none ${
              draftTrackId === 'none' ? 'selected' : ''
            }`}
            onClick={() => setDraftTrackId('none')}
          >
            <span className="audio-library-play muted">
              <VolumeX size={16} />
            </span>
            <span className="audio-library-item-text">
              <span className="audio-library-item-title">{dict.audioLibrary.none}</span>
              <span className="audio-library-item-meta">{dict.audioLibrary.noneDesc}</span>
            </span>
            <span
              className={`audio-library-check ${draftTrackId === 'none' ? 'selected' : ''}`}
            >
              {draftTrackId === 'none' && <Check size={14} />}
            </span>
          </button>

          {AUDIO_LIBRARY.map((track) => {
            const isSelected = draftTrackId === track.id;
            const isPreviewing = previewTrackId === track.id;
            return (
              <div
                key={track.id}
                className={`audio-library-item ${isSelected ? 'selected' : ''}`}
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
                <button
                  type="button"
                  className={`audio-library-play ${isPreviewing ? 'playing' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    togglePreview(track);
                  }}
                  title={isPreviewing ? dict.audioLibrary.stopPreview : dict.audioLibrary.preview}
                  aria-label={
                    isPreviewing ? dict.audioLibrary.stopPreview : dict.audioLibrary.preview
                  }
                >
                  {isPreviewing ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
                </button>

                <span className="audio-library-item-text">
                  <span className="audio-library-item-title-row">
                    <span className="audio-library-item-title">{track.name}</span>
                    {isSelected && (
                      <span className="audio-library-badge">{dict.audioLibrary.selected}</span>
                    )}
                  </span>
                  <span className="audio-library-item-meta">
                    MP3{formatDurationLabel(trackDurations[track.id]) ? ` · ${formatDurationLabel(trackDurations[track.id])}` : ''} · Reportist
                  </span>
                </span>

                {isPreviewing && (
                  <span className="audio-library-equalizer" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                )}

                <span className={`audio-library-check ${isSelected ? 'selected' : ''}`}>
                  {isSelected && <Check size={14} />}
                </span>
              </div>
            );
          })}
        </div>

        {applyError && <p className="audio-library-error">{applyError}</p>}

        <div className="model-modal-footer">
          <div className="model-modal-footer-tip">
            <Headphones size={14} color="#3182f6" />
            <span>{dict.audioLibrary.footerTip}</span>
          </div>
          <button
            type="button"
            className="model-modal-confirm-btn audio-library-apply-btn"
            onClick={handleApply}
            disabled={isApplying || draftTrackId === null}
          >
            {isApplying ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>{dict.audioLibrary.loading}</span>
              </>
            ) : (
              <span>{dict.audioLibrary.apply}</span>
            )}
          </button>
        </div>

        <audio
          key={previewTrackId ?? 'none'}
          ref={audioRef}
          src={previewTrack?.src}
          onEnded={() => setPreviewTrackId(null)}
          preload="none"
        />
      </div>
    </div>
  );
};
