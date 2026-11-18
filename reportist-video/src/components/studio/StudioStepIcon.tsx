// StudioStepIcon.tsx - 스튜디오 단계별 아이콘 (데스크탑 스텝바 · 모바일 스텝 헤더/전체 단계 시트 공용)
// 한 곳에서 관리해 데스크탑과 모바일에 같은 아이콘이 표시되도록 한다.
import React from 'react';
import {
  ArrowRight,
  Check,
  Download,
  Film,
  Image as ImageIcon,
  MapPin,
  Music,
  Scissors,
  Sparkles,
  Subtitles,
  Type,
  Upload,
} from 'lucide-react';

interface StudioStepIconProps {
  stepId: string;
  size?: number;
}

export const StudioStepIcon: React.FC<StudioStepIconProps> = ({ stepId, size = 14 }) => {
  switch (stepId) {
    case 'intro':
      return <Type size={size} />;
    case 'introStyle':
      return <Film size={size} />;
    case 'upload':
      return <Upload size={size} />;
    case 'location':
      return <MapPin size={size} />;
    case 'ai':
      return <Sparkles size={size} />;
    case 'cut':
      return <Scissors size={size} />;
    case 'caption':
      return <Subtitles size={size} />;
    case 'bridge':
      return <ArrowRight size={size} />;
    case 'outro':
      return <Check size={size} />;
    case 'music':
      return <Music size={size} />;
    case 'thumbnail':
      return <ImageIcon size={size} />;
    default:
      // download
      return <Download size={size} />;
  }
};
