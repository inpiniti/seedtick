import { Music2, Plus, Trash2 } from 'lucide-react';
import { AUDIO_LIBRARY } from '../../data/audioLibrary.ts';
import { useI18n } from '../../i18n/index.tsx';
import type { TimelineLayout } from './timelineModel.ts';

// components/studio-v2/TimelineMusicTrack.tsx — 단일 BGM 트랙 (1곡 고정).

interface TimelineMusicTrackProps {
  bgmPresetId: string;
  bgmVolume: number;
  /** 오디오 보관함에서 적용한 음원 id (타임라인 라벨에 이름을 표시). */
  libraryTrackId: string | null;
  customAudioName: string | null;
  /** 음악 칩·교체 버튼 — 오른쪽 인스펙터를 연다. */
  onOpenMusic: () => void;
  onVolumeChange: (volume: number) => void;
  onRemove: () => void;
  /** 음악 바를 영상 트랙과 같은 시간축 폭으로 맞추기 위한 레이아웃. */
  layout?: TimelineLayout;
  /** 영상 길이에 맞춰 음악 속도를 조절하는 옵션. */
  bgmFitToVideo?: boolean;
  onFitChange?: (fit: boolean) => void;
}

export const TimelineMusicTrack = ({
  bgmPresetId,
  bgmVolume,
  libraryTrackId,
  customAudioName,
  onOpenMusic,
  onVolumeChange,
  onRemove,
  layout,
  bgmFitToVideo = false,
  onFitChange,
}: TimelineMusicTrackProps) => {
  const { ui, t } = useI18n();
  const libraryName = libraryTrackId
    ? AUDIO_LIBRARY.find((track) => track.id === libraryTrackId)?.name || null
    : null;
  const name = customAudioName || libraryName || (bgmPresetId !== 'none' ? bgmPresetId : null);
  const hasMusic = Boolean(name);
  const filledWidth = hasMusic && layout ? layout.totalWidth : undefined;

  return (
    <div className="sv2-track-row">
      <div className="sv2-track-label">
        <Music2 size={13} /> {ui('음악')}
      </div>
      <div className="sv2-track-lane" style={filledWidth ? { width: filledWidth, paddingRight: 0 } : undefined}>
        <div className="sv2-music-chip" data-filled={hasMusic} style={filledWidth ? { width: filledWidth } : undefined}>
          <button
            type="button"
            className="sv2-btn sv2-btn-sm sv2-btn-ghost"
            onClick={onOpenMusic}
            title={ui('음악 고르기')}
          >
            {hasMusic ? <Music2 size={14} /> : <Plus size={14} />}
          </button>
          <span style={{ minWidth: 120, fontWeight: 700 }}>
            {name || ui('음악 1곡 추가')}
          </span>
          {hasMusic && (
            <>
              <input
                className="sv2-music-vol"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={bgmVolume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                title={ui('볼륨')}
              />
              <span style={{ fontSize: 11, color: 'var(--sv2-text-3)', minWidth: 32 }}>
                {Math.round(bgmVolume * 100)}%
              </span>
              <button
                type="button"
                className="sv2-mini-btn sv2-mini-btn-fit"
                data-on={bgmFitToVideo}
                aria-pressed={bgmFitToVideo}
                onClick={() => onFitChange?.(!bgmFitToVideo)}
                title={t('bgm.fitToVideoDesc')}
              >
                {t('bgm.fitToVideo')}
              </button>
              <button type="button" className="sv2-mini-btn" onClick={onOpenMusic} title={ui('교체')}>
                {ui('교체')}
              </button>
              <button type="button" className="sv2-mini-btn" data-danger="true" onClick={onRemove} title={ui('삭제')}>
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
