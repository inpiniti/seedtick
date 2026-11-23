import type {
  HighlightSegment,
  VideoItem,
  VideoOverlayOptions,
} from '../../types/video.ts';
import type { TimelineModel } from './timelineModel.ts';
import { TimelineVideoTrack } from './TimelineVideoTrack.tsx';
import { TimelineSubtitleTrack } from './TimelineSubtitleTrack.tsx';
import { TimelineMusicTrack } from './TimelineMusicTrack.tsx';

// components/studio-v2/TimelineDock.tsx — 하단 3트랙 타임라인 컨테이너.

interface TimelineDockProps {
  segments: HighlightSegment[];
  videos: VideoItem[];
  model: TimelineModel;
  overlayOptions: VideoOverlayOptions;
  selectedSegmentId: string | null;
  landingIds: Set<string>;
  bgmPresetId: string;
  bgmVolume: number;
  libraryTrackId: string | null;
  customAudioName: string | null;
  onSelect: (id: string) => void;
  onUpdateSegment: (id: string, patch: Partial<HighlightSegment>) => void;
  onDelete: (id: string) => void;
  onTrim: (segment: HighlightSegment) => void;
  onOpenLocation: (id: string) => void;
  onOpenIntro: () => void;
  onOpenOutro: () => void;
  onReorder: (from: number, to: number) => void;
  onOpenLibrary: () => void;
  onVolumeChange: (volume: number) => void;
  onRemoveMusic: () => void;
  onPickAudioFile: (file: File) => void;
}

export const TimelineDock = (props: TimelineDockProps) => {
  const hasSegments = props.segments.length > 0;

  return (
    <div className="sv2-timeline">
      <div className="sv2-timeline-head">
        <span className="sv2-timeline-label">타임라인</span>
        <span className="sv2-timeline-hint">
          컷을 끌어 순서를 바꾸고, 클릭해서 트림·회전·자막 수정 · 인트로/아웃트로 설정
        </span>
      </div>
      {hasSegments ? (
        <div className="sv2-tracks">
          <TimelineVideoTrack {...props} />
          <TimelineSubtitleTrack {...props} />
          <TimelineMusicTrack
            {...props}
            onRemove={props.onRemoveMusic}
            onPickFile={props.onPickAudioFile}
          />
        </div>
      ) : (
        <div className="sv2-tracks">
          <TimelineMusicTrack
            {...props}
            onRemove={props.onRemoveMusic}
            onPickFile={props.onPickAudioFile}
          />
          <div className="sv2-timeline-empty">
            AI 컷 분석이 끝나면 여기에 영상·자막 트랙이 채워집니다. 음악은 미리 1곡 넣어둘 수 있어요.
          </div>
        </div>
      )}
    </div>
  );
};
