import { useRef } from 'react';
import { Music2, Plus, Trash2 } from 'lucide-react';
import type { TimelineLayout } from './timelineModel.ts';

// components/studio-v2/TimelineMusicTrack.tsx — 단일 BGM 트랙 (1곡 고정).

interface TimelineMusicTrackProps {
  bgmPresetId: string;
  bgmVolume: number;
  customAudioName: string | null;
  onVolumeChange: (volume: number) => void;
  onRemove: () => void;
  onPickFile: (file: File) => void;
  /** 음악 바를 영상 트랙과 같은 시간축 폭으로 맞추기 위한 레이아웃. */
  layout?: TimelineLayout;
}

export const TimelineMusicTrack = ({
  bgmPresetId,
  bgmVolume,
  customAudioName,
  onVolumeChange,
  onRemove,
  onPickFile,
  layout,
}: TimelineMusicTrackProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const name = customAudioName || (bgmPresetId !== 'none' ? bgmPresetId : null);
  const hasMusic = Boolean(name);
  const filledWidth = hasMusic && layout ? layout.totalWidth : undefined;

  return (
    <div className="sv2-track-row">
      <div className="sv2-track-label">
        <Music2 size={13} /> 음악
      </div>
      <div className="sv2-track-lane" style={filledWidth ? { width: filledWidth, paddingRight: 0 } : undefined}>
        <div className="sv2-music-chip" data-filled={hasMusic} style={filledWidth ? { width: filledWidth } : undefined}>
          <button
            type="button"
            className="sv2-btn sv2-btn-sm sv2-btn-ghost"
            onClick={() => fileInputRef.current?.click()}
            title="음악 고르기"
          >
            {hasMusic ? <Music2 size={14} /> : <Plus size={14} />}
          </button>
          <span style={{ minWidth: 120, fontWeight: 700 }}>
            {name || '음악 1곡 추가 (드롭 또는 선택)'}
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
                title="볼륨"
              />
              <span style={{ fontSize: 11, color: 'var(--sv2-text-3)', minWidth: 32 }}>
                {Math.round(bgmVolume * 100)}%
              </span>
              <button type="button" className="sv2-mini-btn" onClick={() => fileInputRef.current?.click()} title="교체">
                교체
              </button>
              <button type="button" className="sv2-mini-btn" data-danger="true" onClick={onRemove} title="삭제">
                <Trash2 size={13} />
              </button>
            </>
          )}
          <label className="sv2-btn sv2-btn-sm" style={{ cursor: 'pointer' }}>
            파일
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onPickFile(file);
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
};
