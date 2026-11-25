import { CalendarDays, Captions, Eye, EyeOff, Type } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { VideoOverlayOptions } from '../../types/video.ts';
import { useI18n } from '../../i18n/index.tsx';
import { Tooltip } from '../ui/Tooltip.tsx';

// components/studio-v2/PreviewDisplayToggles.tsx
// 미리보기 아래에 붙는 표시 on/off 스위치.
// 설정 모달까지 들어가지 않고도 제목·날짜·자막을 바로 끄고 켤 수 있다.
// 스위치는 실제 내보내기 옵션(overlayOptions)을 직접 바꾸므로 미리보기와 결과물이 항상 같다.

type DisplayKey = 'showTitle' | 'showDate' | 'showSubtitle';

interface DisplayToggleItem {
  key: DisplayKey;
  label: string;
  Icon: LucideIcon;
  on: boolean;
}

interface PreviewDisplayTogglesProps {
  overlayOptions: VideoOverlayOptions;
  onUpdateOverlay: (patch: Partial<VideoOverlayOptions>) => void;
}

export const PreviewDisplayToggles = ({
  overlayOptions,
  onUpdateOverlay,
}: PreviewDisplayTogglesProps) => {
  const { ui } = useI18n();

  const items: DisplayToggleItem[] = [
    {
      key: 'showTitle',
      label: ui('제목'),
      Icon: Type,
      on: overlayOptions.showTitle !== false,
    },
    {
      key: 'showDate',
      label: ui('날짜'),
      Icon: CalendarDays,
      on: overlayOptions.showDate !== false,
    },
    {
      key: 'showSubtitle',
      label: ui('자막'),
      Icon: Captions,
      on: overlayOptions.showSubtitle !== false,
    },
  ];
  const allOn = items.every((item) => item.on);
  const masterLabel = allOn ? ui('모두 끄기') : ui('모두 켜기');

  return (
    <div className="sv2-display-bar" role="group" aria-label={ui('화면 표시 스위치')}>
      <span className="sv2-display-bar-label">{ui('표시')}</span>
      <div className="sv2-display-bar-chips">
        {items.map(({ key, label, Icon, on }) => {
          const action = on ? ui('끄기') : ui('켜기');
          const actionLabel = ui('{label} {action}', { label, action });
          return (
            <Tooltip key={key} content={actionLabel}>
              <button
                type="button"
                className="sv2-display-chip"
                data-on={on}
                aria-pressed={on}
                aria-label={actionLabel}
                onClick={() => onUpdateOverlay({ [key]: !on })}
              >
                <Icon size={13} strokeWidth={2} aria-hidden="true" />
                <span>{label}</span>
                <span className="sv2-display-chip-dot" aria-hidden="true" />
              </button>
            </Tooltip>
          );
        })}
      </div>
      <Tooltip content={masterLabel}>
        <button
          type="button"
          className="sv2-display-master"
          aria-label={masterLabel}
          onClick={() => {
            const next = !allOn;
            onUpdateOverlay({ showTitle: next, showDate: next, showSubtitle: next });
          }}
        >
          {allOn ? (
            <EyeOff size={13} strokeWidth={2} aria-hidden="true" />
          ) : (
            <Eye size={13} strokeWidth={2} aria-hidden="true" />
          )}
          <span>{masterLabel}</span>
        </button>
      </Tooltip>
    </div>
  );
};
