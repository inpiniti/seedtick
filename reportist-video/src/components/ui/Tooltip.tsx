// Tooltip.tsx - 앱 공통 툴팁 프리미티브
// 네이티브 title 속성 대신 Animate UI(Base UI) 툴팁을 사용한다.
// 스프링 애니메이션·딜레이 그룹핑은 루트의 Tooltip.Provider가 담당한다.
import React from 'react';
import { Tooltip as AnimateTooltip } from '@animate-ui/react/primitives/base-ui/tooltip';
import './tooltip.css';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  /** 툴팁 본문. 빈 값이면 툴팁을 붙이지 않고 children만 렌더한다. */
  content: React.ReactNode;
  /** 툴팁을 붙일 단일 요소. ref를 전달할 수 있는 DOM/컴포넌트여야 한다. */
  children: React.ReactElement;
  side?: TooltipSide;
  sideOffset?: number;
  /** 마우스 진입 후 열리기까지의 딜레이(ms). Provider 기본값은 350ms. */
  delay?: number;
  closeDelay?: number;
  disabled?: boolean;
  className?: string;
}

export function Tooltip({
  content,
  children,
  side = 'top',
  sideOffset = 6,
  delay,
  closeDelay,
  disabled = false,
  className,
}: TooltipProps) {
  const isEmpty =
    content === undefined ||
    content === null ||
    content === false ||
    (typeof content === 'string' && content.trim() === '');

  if (disabled || isEmpty) return <>{children}</>;

  return (
    <AnimateTooltip.Root>
      <AnimateTooltip.Trigger render={children} delay={delay} closeDelay={closeDelay} />
      <AnimateTooltip.Portal>
        <AnimateTooltip.Positioner
          side={side}
          sideOffset={sideOffset}
          collisionPadding={8}
          className="ui-tooltip-positioner"
        >
          <AnimateTooltip.Popup className={['ui-tooltip-popup', className].filter(Boolean).join(' ')}>
            <span className="ui-tooltip-popup__content">{content}</span>
            <AnimateTooltip.Arrow className="ui-tooltip-arrow" />
          </AnimateTooltip.Popup>
        </AnimateTooltip.Positioner>
      </AnimateTooltip.Portal>
    </AnimateTooltip.Root>
  );
}
