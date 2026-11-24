// src/services/studioTour.ts - 스튜디오 안내(driver.js) 공통 인프라
// ① 투어/가이드 인스턴스 생성, ② 본 가이드 이력(localStorage), ③ 모바일 안전 스크롤을 한 곳에서 관리한다.
// ProStudioView에는 "어떤 단계에 어떤 문구를 띄울지"만 남기고 공통 동작은 이 모듈에 둔다.
import {
  driver,
  type Alignment,
  type AllowedButtons,
  type DestroyReason,
  type Driver,
  type DriverHook,
  type DriveStep,
  type Side,
} from 'driver.js';

const SEEN_GUIDES_KEY = 'penguincut_seen_guides_v1';
/** 온보딩을 시작했지만 아직 끝내지 않았을 때 남기는 플래그. 새로고침 후 투어를 다시 띄우는 데 쓴다. */
const ONBOARDING_ACTIVE_KEY = 'penguincut_onboarding_active_v1';
/** 마지막으로 보고 있던 단계. X로 닫았다가 다시 열 때 그 지점부터 이어간다. */
const ONBOARDING_STEP_KEY = 'penguincut_onboarding_step_v1';

/** 한 번만 보여줄 가이드 식별자. 새 가이드를 추가하면 이 유니온에 먼저 등록한다. */
export type StudioGuideId =
  | 'onboarding'
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

/** 온보딩 진행 중 여부 (완료/건너뛰기 전까지 true) */
export function isStudioOnboardingActive(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(ONBOARDING_ACTIVE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** 온보딩 시작 시 진행 플래그를 남긴다. */
export function setStudioOnboardingActive(active: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (active) window.localStorage.setItem(ONBOARDING_ACTIVE_KEY, 'true');
    else window.localStorage.removeItem(ONBOARDING_ACTIVE_KEY);
  } catch {
    // storage가 막혀도 투어 자체는 동작해야 한다.
  }
}

/** 마지막 온보딩 단계(0부터 시작). 저장값이 없으면 0. */
export function getStudioOnboardingStep(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_STEP_KEY);
    const value = raw === null ? 0 : Number(raw);
    return Number.isInteger(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

/** 온보딩 단계를 기록한다. */
export function setStudioOnboardingStep(step: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ONBOARDING_STEP_KEY, String(step));
  } catch {
    // no-op
  }
}

export function clearStudioOnboardingStep(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ONBOARDING_STEP_KEY);
  } catch {
    // no-op
  }
}

/** 설정의 "가이드 다시 보기"에서 모든 이력을 지운다. */
export function resetStudioGuides(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SEEN_GUIDES_KEY);
    window.localStorage.removeItem(ONBOARDING_ACTIVE_KEY);
    window.localStorage.removeItem(ONBOARDING_STEP_KEY);
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

export interface StudioDriverOptions {
  steps: DriveStep[];
  isMobile: boolean;
  labels: StudioTourLabels;
  showButtons?: AllowedButtons[];
  showProgress?: boolean;
  /** 비동기로 나타나는 요소(분석 완료 컷 등)를 기다릴 시간(ms). Infinity도 허용된다. */
  waitForElement?: number;
  /** true면 오버레이가 클릭을 막지 않는다. 사용자가 직접 조작하며 진행하는 투어에서 쓴다. */
  allowPageInteraction?: boolean;
  /** 이어보기용 시작 단계 인덱스. */
  startStep?: number;
  overlayOpacity?: number;
  onDestroyed?: (reason?: DestroyReason) => void;
  onHighlighted?: DriverHook;
}

/** 드라이버 공통 설정을 한 곳에서 적용한다. 온보딩처럼 고급 훅이 필요한 투어도 이 함수를 쓴다. */
export function createStudioDriver({
  steps,
  isMobile,
  labels,
  showButtons = ['next', 'previous', 'close'],
  showProgress = steps.length > 1,
  waitForElement = 0,
  allowPageInteraction = false,
  startStep = 0,
  overlayOpacity = 0.45,
  onDestroyed,
  onHighlighted,
}: StudioDriverOptions): Driver {
  const driverObj = driver({
    steps,
    animate: true,
    duration: 240,
    overlayColor: '#0f172a',
    overlayOpacity,
    stagePadding: 6,
    stageRadius: 10,
    allowClose: true,
    overlayClickBehavior: 'close',
    allowKeyboardControl: true,
    skipMissingElement: true,
    waitForElement,
    allowPageInteraction,
    scrollIntoView: isMobile ? false : { block: 'center', inline: 'nearest' },
    popoverClass: 'penguincut-driver-popover',
    showButtons,
    showProgress,
    progressText: '{{current}} / {{total}}',
    closeBtnLabel: labels.close,
    nextBtnText: labels.next,
    prevBtnText: labels.prev,
    doneBtnText: labels.done,
    onDestroyed: (_element, _step, opts) => onDestroyed?.(opts.reason),
    onHighlighted,
  });

  driverObj.drive(startStep);
  return driverObj;
}

/** 스튜디오 톤(ProStudioView.css의 .penguincut-driver-popover)으로 투어를 시작한다. */
export type StudioTourOptions = Omit<StudioDriverOptions, 'steps'> & {
  steps: StudioTourStep[];
};

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

  return createStudioDriver({
    steps: driveSteps,
    isMobile,
    labels,
    showButtons,
    showProgress,
    onDestroyed: onDestroyed ? () => onDestroyed() : undefined,
  });
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
