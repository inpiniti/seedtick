// src/services/studioTour.ts - 스튜디오 안내(driver.js) 공통 인프라
// ① 투어/가이드 인스턴스 생성, ② 본 가이드 이력(localStorage), ③ 모바일 안전 스크롤을 한 곳에서 관리한다.
// ProStudioView에는 "어떤 단계에 어떤 문구를 띄울지"만 남기고 공통 동작은 이 모듈에 둔다.
import {
  driver,
  type Alignment,
  type AllowedButtons,
  type Driver,
  type DriveStep,
  type Side,
} from 'driver.js';

const SEEN_GUIDES_KEY = 'penguincut_seen_guides_v1';

/** 한 번만 보여줄 가이드 식별자. 새 가이드를 추가하면 이 유니온에 먼저 등록한다. */
export type StudioGuideId =
  | 'quickStart'
  | 'step:cut'
  | 'step:caption'
  | 'step:bridge'
  | 'step:fullPreview';

type SeenGuideMap = Record<string, number>;

function readSeenGuides(): SeenGuideMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SEEN_GUIDES_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as SeenGuideMap;
  } catch {
    return {};
  }
}

function writeSeenGuides(map: SeenGuideMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SEEN_GUIDES_KEY, JSON.stringify(map));
  } catch {
    // storage가 막힌 환경(시크릿 모드 등)에서도 가이드 자체는 동작해야 한다.
  }
}

/** 이미 본(또는 건너뛴) 가이드인지 여부 */
export function hasSeenStudioGuide(id: StudioGuideId): boolean {
  return Boolean(readSeenGuides()[id]);
}

/** 가이드를 본 것으로 기록한다. 완료/닫기/스킵 모두 여기로 모인다. */
export function markStudioGuideSeen(id: StudioGuideId): void {
  const map = readSeenGuides();
  map[id] = Date.now();
  writeSeenGuides(map);
}

/** 설정의 "가이드 다시 보기"에서 모든 이력을 지운다. */
export function resetStudioGuides(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SEEN_GUIDES_KEY);
  } catch {
    // no-op
  }
}

export interface StudioTourStep {
  /** data-tour 셀렉터(권장) 또는 일반 CSS 셀렉터 */
  element: string;
  title: string;
  description: string;
  side?: Side;
  align?: Alignment;
}

export interface StudioTourLabels {
  close: string;
  next?: string;
  prev?: string;
  done?: string;
}

export interface StudioTourOptions {
  steps: StudioTourStep[];
  isMobile: boolean;
  labels: StudioTourLabels;
  showButtons?: AllowedButtons[];
  showProgress?: boolean;
  onDestroyed?: () => void;
}

/** 스튜디오 톤(ProStudioView.css의 .penguincut-driver-popover)으로 투어를 시작한다. */
export function startStudioTour({
  steps,
  isMobile,
  labels,
  showButtons = ['next', 'previous', 'close'],
  showProgress = steps.length > 1,
  onDestroyed,
}: StudioTourOptions): Driver {
  const driveSteps: DriveStep[] = steps.map((step) => ({
    element: step.element,
    popover: {
      title: step.title,
      description: step.description,
      side: step.side ?? 'bottom',
      align: step.align ?? 'center',
    },
  }));

  const driverObj = driver({
    steps: driveSteps,
    animate: true,
    duration: 240,
    overlayColor: '#0f172a',
    overlayOpacity: 0.45,
    stagePadding: 6,
    stageRadius: 10,
    allowClose: true,
    overlayClickBehavior: 'close',
    allowKeyboardControl: true,
    skipMissingElement: true,
    scrollIntoView: isMobile ? false : { block: 'center', inline: 'nearest' },
    popoverClass: 'penguincut-driver-popover',
    showButtons,
    showProgress,
    progressText: '{{current}} / {{total}}',
    closeBtnLabel: labels.close,
    nextBtnText: labels.next,
    prevBtnText: labels.prev,
    doneBtnText: labels.done,
    onDestroyed,
  });

  driverObj.drive();
  return driverObj;
}

/** 단일 요소 스포트라이트(차단 안내·씬 가이드)용 축약 API */
export function highlightStudioElement(
  options: Omit<StudioTourOptions, 'steps' | 'showProgress'> & StudioTourStep
): Driver {
  const { element, title, description, side, align, ...rest } = options;
  return startStudioTour({
    ...rest,
    steps: [{ element, title, description, side, align }],
    showProgress: false,
  });
}

/**
 * 모바일에서 상단 sticky 플레이어와 하단 고정 CTA 사이의 "안전 영역"으로 타깃을 스크롤한다.
 * 데스크톱에서는 driver.js의 scrollIntoView에 맡긴다.
 */
export function scrollTargetIntoSafeViewport(
  target: HTMLElement,
  options: {
    isMobile: boolean;
    topInset?: number;
    bottomInset?: number;
    playerSelector?: string;
  }
): void {
  if (!options.isMobile) return;
  const rect = target.getBoundingClientRect();
  const playerCard = document.querySelector(options.playerSelector ?? '.toss-player-card');
  const safeTop = playerCard
    ? playerCard.getBoundingClientRect().bottom + 12
    : (options.topInset ?? 120);
  const safeBottom = window.innerHeight - (options.bottomInset ?? 84);
  if (rect.top < safeTop || rect.bottom > safeBottom) {
    window.scrollBy({ top: rect.top - safeTop - 16, behavior: 'instant' });
  }
}
