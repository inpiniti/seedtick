// src/components/studio/introOutroOptions.ts
// 인트로/아웃트로 템플릿·길이 상수 (모달 지연 로딩과 무관하게 먼저 필요한 메타데이터)
import type { Dictionary } from '../../i18n/types.ts';
import type { IntroTemplateId, OutroTemplateId } from '../../types/video.ts';

interface TemplateOptionBase {
  name: string;
  badge: string;
  desc: string;
  /** 썸네일·대표 프레임으로 보여줄 모션 진행률 (0~1). */
  previewProgress: number;
}

export const INTRO_TEMPLATE_OPTIONS: Array<TemplateOptionBase & { id: IntroTemplateId }> = [
  {
    id: 'kinetic-slide',
    name: '키네틱 슬라이드',
    badge: '추천',
    desc: '볼드 타이포 & 탄성 오버슈트 바운스',
    previewProgress: 0.55,
  },
  {
    id: 'split-flap',
    name: '레트로 플립보드',
    badge: '아날로그',
    desc: '전광판 3D 분할 회전 타일 모션',
    previewProgress: 0.5,
  },
  {
    id: 'cinematic-letterbox',
    name: '시네마틱 줌',
    badge: '영화관',
    desc: '2.39:1 레터박스 & 아나모픽 렌즈 플레어',
    previewProgress: 0.6,
  },
  {
    id: 'film-countdown',
    name: '카운트다운 3-2-1',
    badge: '빈티지',
    desc: '빈티지 필름 링 & 십자선 모션',
    previewProgress: 0.62,
  },
];

export const OUTRO_TEMPLATE_OPTIONS: Array<TemplateOptionBase & { id: OutroTemplateId }> = [
  {
    id: 'modern-endcard',
    name: '유튜브 엔드카드',
    badge: '추천',
    desc: '16:9 추천 영상 슬롯 & 채널 펄스 링',
    previewProgress: 0.75,
  },
  {
    id: 'minimal-fade',
    name: '미니멀 페이드',
    badge: '감성',
    desc: '부드러운 레디얼 글로우 & 타이포가 천천히 암전',
    previewProgress: 0.7,
  },
  {
    id: 'curtain-split',
    name: '루버 블라인드',
    badge: '시그니처',
    desc: '메탈 사선 셔터가 연달아 닫힌 뒤 크레딧 등장',
    previewProgress: 0.4,
  },
  {
    id: 'slide-panel',
    name: '슬라이드 패널',
    badge: '모던',
    desc: '좌우 패널이 슬라이드해 중앙에서 만남',
    previewProgress: 0.6,
  },
  {
    id: 'typewriter-credits',
    name: '타이프라이터 크레딧',
    badge: '레트로',
    desc: '모노스페이스 타이핑 & 깜빡이는 커서',
    previewProgress: 0.65,
  },
  {
    id: 'light-burst',
    name: '라이트 버스트',
    badge: '시네마',
    desc: '방사형 광선 & 환한 오프닝 플래시',
    previewProgress: 0.45,
  },
];

export const INTRO_DURATIONS = [1.5, 2.0, 2.5, 3.0];
export const OUTRO_DURATIONS = [1.8, 2.2, 2.8];

/** 렌더러가 문구가 비어 있을 때 사용하는 기본 아웃트로 문구. UI placeholder와 동일하게 유지한다. */
export const DEFAULT_OUTRO_TEXT = '시청해 주셔서 감사합니다';

/** 미리보기 배지·썸네일에서 쓰는 템플릿 표시 이름. */
export function getTemplateName(kind: 'intro' | 'outro', templateId?: string): string {
  const options = kind === 'intro' ? INTRO_TEMPLATE_OPTIONS : OUTRO_TEMPLATE_OPTIONS;
  return options.find((o) => o.id === templateId)?.name ?? (kind === 'intro' ? '키네틱 슬라이드' : '유튜브 엔드카드');
}

/**
 * 현재 언어 사전을 우선 사용하는 템플릿 메타데이터.
 * 7개 언어로 번역된 `dict.introOutroModal.templates`가 있으면 그 값을 쓰고,
 * 없으면(번역 누락/비-loaded 로케일) 상수에 들어 있는 한국어 원문으로 폴백한다.
 */
export function getLocalizedTemplateMeta(
  dict: Dictionary,
  kind: 'intro' | 'outro',
  templateId?: string
): { name: string; badge: string; desc: string } {
  const fallbackOptions = kind === 'intro' ? INTRO_TEMPLATE_OPTIONS : OUTRO_TEMPLATE_OPTIONS;
  const fallback =
    fallbackOptions.find((o) => o.id === templateId) ??
    fallbackOptions[0] ?? { name: '', badge: '', desc: '', previewProgress: 0 };
  const localized = (dict.introOutroModal?.templates?.[kind] as
    | Record<string, { name: string; badge: string; desc: string } | undefined>
    | undefined)?.[templateId ?? ''];
  return {
    name: localized?.name || fallback.name,
    badge: localized?.badge || fallback.badge,
    desc: localized?.desc || fallback.desc,
  };
}

/** 현재 언어의 기본 아웃트로 문구 (영어 기본: 'Thank you for watching'). */
export function getLocalizedOutroText(dict: Dictionary): string {
  return dict.introOutro?.outroDefaultText || DEFAULT_OUTRO_TEXT;
}
