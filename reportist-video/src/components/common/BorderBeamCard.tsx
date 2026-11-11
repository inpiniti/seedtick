// src/components/common/BorderBeamCard.tsx
// Cult UI inspired Border Beam Card container
// 오직 카드 보더 선을 따라 순백색(White) 빔이 회전합니다.

import React from 'react';
import { BorderBeam } from './BorderBeam.tsx';
import './AiVisualEffects.css';

export interface BorderBeamCardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  beamColorFrom?: string;
  beamColorTo?: string;
  beamDuration?: number;
  beamBorderWidth?: number;
  showBeam?: boolean;
  reverse?: boolean;
  className?: string;
}

export const BorderBeamCard: React.FC<BorderBeamCardProps> = ({
  children,
  beamColorFrom = '#ffffff',
  beamColorTo = 'rgba(255, 255, 255, 0.2)',
  beamDuration = 6,
  beamBorderWidth = 1.5,
  showBeam = true,
  reverse = false,
  className = '',
  ...restProps
}) => {
  return (
    <div
      className={`border-beam-card-container ${className}`}
      {...restProps}
    >
      {showBeam && (
        <BorderBeam
          colorFrom={beamColorFrom}
          colorTo={beamColorTo}
          duration={beamDuration}
          borderWidth={beamBorderWidth}
          reverse={reverse}
        />
      )}
      {children}
    </div>
  );
};

export default BorderBeamCard;
