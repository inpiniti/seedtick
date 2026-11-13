// src/components/studio/introOutroOptions.ts
// 인트로/아웃트로 템플릿·길이 상수 (모달 지연 로딩과 무관하게 먼저 필요한 메타데이터)
import type { IntroTemplateId, OutroTemplateId } from '../../types/video.ts';

export const INTRO_TEMPLATE_OPTIONS: Array<{
  id: IntroTemplateId;
  name: string;
  badge: string;
  desc: string;
}> = [
  {
    id: 'kinetic-slide',
    name: '키네틱 슬라이드',
    badge: '추천',
    desc: '볼드 타이포 & 탄성 오버슈트 바운스',
  },
  {
    id: 'split-flap',
    name: '레트로 플립보드',
    badge: '아날로그',
    desc: '전광판 3D 분할 회전 타일 모션',
  },
  {
    id: 'cinematic-letterbox',
    name: '시네마틱 줌',
    badge: '영화관',
    desc: '2.39:1 레터박스 & 아나모픽 렌즈 플레어',
  },
  {
    id: 'film-countdown',
    name: '카운트다운 3-2-1',
    badge: '빈티지',
    desc: '빈티지 필름 링 & 십자선 모션',
  },
];

export const OUTRO_TEMPLATE_OPTIONS: Array<{
  id: OutroTemplateId;
  name: string;
  badge: string;
  desc: string;
}> = [
  {
    id: 'modern-endcard',
    name: '유튜브 엔드카드',
    badge: '추천',
    desc: '16:9 추천 영상 슬롯 & 채널 펄스 링',
  },
  {
    id: 'minimal-fade',
    name: '미니멀 페이드',
    badge: '감성',
    desc: '딥 다크 비네트 & 우아한 타이포 암전',
  },
  {
    id: 'curtain-split',
    name: '루버 블라인드',
    badge: '시그니처',
    desc: '5단 사선 루버 셔터 클로징 크레딧',
  },
];

export const INTRO_DURATIONS = [1.5, 2.0, 2.5, 3.0];
export const OUTRO_DURATIONS = [1.8, 2.2, 2.8];
