// src/hooks/useOnboardingTour.ts
// 스튜디오 V2 첫 실행 온보딩.
// "다음" 버튼 없이 사용자가 실제로 수행한 작업(클릭·수정)을 감지해 단계를 자동으로 넘긴다.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DriveStep, Driver } from 'driver.js';
import { useI18n } from '../i18n/index.tsx';
import {
  clearStudioOnboardingStep,
  createStudioDriver,
  setStudioOnboardingStep,
} from '../services/studioTour.ts';

const WAIT_FOR_UI_MS = 30 * 1000;

/** 단계 인덱스. CenterStudioView가 사용자 액션 발생 시 현재 단계를 확인하는 데 쓴다. */
export const ONBOARDING_STEP = {
  sample: 0,
  analyze: 1,
  analyzing: 2,
  selectCut: 3,
  caption: 4,
  intro: 5,
  introTemplates: 6,
  export: 7,
  resolution: 8,
  download: 9,
} as const;

export function useOnboardingTour() {
  const { ui } = useI18n();
  const driverRef = useRef<Driver | null>(null);
  const onCompleteRef = useRef<(() => void) | null>(null);
  const onInterruptedRef = useRef<(() => void) | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const stop = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
    setActiveIndex(null);
  }, []);

  useEffect(
    () => () => {
      onCompleteRef.current = null;
      onInterruptedRef.current = null;
      stop();
    },
    [stop]
  );

  /** 앱에서 실제 작업이 끝났을 때 호출한다. 현재 단계일 때만 다음으로 넘어간다. */
  const advance = useCallback(
    (expectedStep: number) => {
      if (activeIndex !== expectedStep) return;
      driverRef.current?.moveNext();
    },
    [activeIndex]
  );

  /** 앱 상태가 바뀌어 현재 단계가 무효가 되었을 때 강제로 이동한다. */
  const moveTo = useCallback((index: number) => {
    driverRef.current?.moveTo(index);
  }, []);

  const start = useCallback(
    (onComplete?: () => void, onInterrupted?: () => void, startStep = 0) => {
      stop();
      onCompleteRef.current = onComplete ?? null;
      onInterruptedRef.current = onInterrupted ?? null;

      const steps: DriveStep[] = [
        {
          element: '[data-tour="onboarding-sample"]',
          popover: {
            title: ui('① 샘플 영상을 넣어요'),
            description: ui('파일이 없어도 괜찮아요. 이 버튼을 누르면 샘플 영상 6개가 준비돼요.'),
            side: 'right',
          },
          advanceOn: 'click',
          waitForElement: WAIT_FOR_UI_MS,
        },
        {
          element: '[data-tour="onboarding-analyze"][data-tour-ready="true"]',
          popover: {
            title: ui('② AI로 장면을 골라요'),
            description: ui('영상이 준비되면 이 버튼을 눌러 주세요. AI가 가장 재밌는 순간을 찾아요.'),
            side: 'right',
          },
          advanceOn: 'click',
          waitForElement: WAIT_FOR_UI_MS,
        },
        {
          element: '[data-tour="onboarding-status"]',
          popover: {
            title: ui('영상 분석 중이에요'),
            description: ui('AI가 장면을 고르고 있어요. 끝나면 컷을 눌러 편집하는 단계로 이어갈게요.'),
            side: 'bottom',
          },
          waitForElement: WAIT_FOR_UI_MS,
          // 상태 배지가 사라지는 즉시 전환해야 하므로 제거 대기 시간은 0으로 둔다.
          waitForRemovedElement: 0,
          // 분석이 끝나면 진행 상태 배지가 사라진다. 그 순간 컷 선택 단계로 자동 전환한다.
          onElementMissing: (_element, _step, opts) => {
            opts.driver.moveNext();
            return false;
          },
        },
        {
          element: '[data-tour="onboarding-cuts-ready"] [data-cut-slot-id]',
          popover: {
            title: ui('③ 컷을 눌러 편집해요'),
            description: ui('AI가 고른 장면이 타임라인에 채워졌어요. 컷을 누르면 미리보기가 그 장면으로 이동해요.'),
            side: 'top',
          },
          advanceOn: 'click',
          waitForElement: WAIT_FOR_UI_MS,
        },
        {
          element: '[data-tour="onboarding-caption-hit"]',
          popover: {
            title: ui('④ 자막을 고쳐요'),
            description: ui('미리보기의 자막을 눌러 문구를 바꿔보세요. 수정하면 다음으로 이어져요.'),
            side: 'right',
          },
          waitForElement: WAIT_FOR_UI_MS,
        },
        {
          element: '[data-tour="onboarding-intro"]',
          popover: {
            title: ui('⑤ 인트로를 열어보세요'),
            description: ui('타임라인의 인트로를 누르면 오른쪽에 설정이 열려요.'),
            side: 'top',
          },
          advanceOn: 'click',
          waitForElement: WAIT_FOR_UI_MS,
        },
        {
          element: '[data-tour="onboarding-intro-template"]',
          popover: {
            title: ui('템플릿을 눌러보세요'),
            description: ui('템플릿을 하나씩 눌러 미리보기 해보세요. 모두 보면 다음으로 이어져요.'),
            side: 'left',
          },
          waitForElement: WAIT_FOR_UI_MS,
        },
        {
          element: '[data-tour="onboarding-export"][data-tour-ready="true"]',
          popover: {
            title: ui('⑥ MP4로 내보내요'),
            description: ui('다듬은 영상을 파일로 저장해요. 이 버튼을 누르면 설정 창이 열려요.'),
            side: 'bottom',
          },
          advanceOn: 'click',
          waitForElement: WAIT_FOR_UI_MS,
        },
        {
          element: '[data-tour="onboarding-resolution"]',
          popover: {
            title: ui('화질을 골라요'),
            description: ui('원하는 해상도를 먼저 눌러 선택해 보세요.'),
            side: 'left',
          },
          waitForElement: WAIT_FOR_UI_MS,
        },
        {
          element: '[data-tour="onboarding-download"]',
          popover: {
            title: ui('⑦ 다운로드하면 끝이에요'),
            description: ui('다운로드를 누르면 영상이 저장되고 가이드가 끝나요.'),
            side: 'top',
          },
          advanceOn: 'click',
          waitForElement: WAIT_FOR_UI_MS,
        },
      ];

      const driver = createStudioDriver({
        steps,
        isMobile: false,
        labels: {
          close: ui('가이드 건너뛰기'),
          next: ui('다음'),
          prev: ui('이전'),
          done: ui('확인'),
        },
        // "다음" 버튼은 제거한다. 실제 작업을 하는 동안 안내가 사라지지 않게 한다.
        showButtons: ['close'],
        showProgress: true,
        allowPageInteraction: true,
        startStep,
        overlayOpacity: 0.32,
        onHighlighted: (_element, _step, opts) => {
          const index = opts.index ?? 0;
          setActiveIndex(index);
          // X로 닫더라도 마지막 단계를 기억해 두었다가 이어보기에 사용한다.
          setStudioOnboardingStep(index);
        },
        onDestroyed: (reason) => {
          if (driverRef.current === driver) driverRef.current = null;
          setActiveIndex(null);
          if (reason === 'done') {
            clearStudioOnboardingStep();
            onCompleteRef.current?.();
          } else {
            onInterruptedRef.current?.();
          }
        },
      });
      driverRef.current = driver;
    },
    [stop, ui]
  );

  return { start, stop, advance, moveTo, activeIndex };
}
