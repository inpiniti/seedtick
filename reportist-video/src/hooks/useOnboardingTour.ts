// src/hooks/useOnboardingTour.ts
// 스튜디오 V2 첫 실행 온보딩. driver.js의 waitForElement를 이용해
// "샘플 로드 → AI 분석 → 컷 확인 → 자막 수정 → 내보내기 → 다운로드" 순서를
// 실제 앱 상태에 맞춰 단계별로 안내한다.
import { useCallback, useEffect, useRef } from 'react';
import type { DriveStep, Driver } from 'driver.js';
import { useI18n } from '../i18n/index.tsx';
import { createStudioDriver } from '../services/studioTour.ts';

/** 분석처럼 비동기로 나타나는 화면은 넉넉하게 기다리고, 닫기 버튼으로 언제든 빠져나갈 수 있다. */
const WAIT_FOR_ANALYSIS_MS = 5 * 60 * 1000;
const WAIT_FOR_UI_MS = 30 * 1000;

export function useOnboardingTour() {
  const { ui } = useI18n();
  const driverRef = useRef<Driver | null>(null);
  const onCompleteRef = useRef<(() => void) | null>(null);
  const onInterruptedRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      // 언마운트 중 destroy가 콜백을 호출해도 setState를 하지 않도록 먼저 비운다.
      onCompleteRef.current = null;
      onInterruptedRef.current = null;
      stop();
    },
    [stop]
  );

  const start = useCallback(
    (onComplete?: () => void, onInterrupted?: () => void) => {
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
          element: '[data-tour="onboarding-cuts-ready"] [data-cut-slot-id]',
          popover: {
            title: ui('③ 컷이 채워졌어요'),
            description: ui('분석이 끝나면 이렇게 타임라인에 컷이 나와요. 컷을 눌러 자막을 고쳐볼게요.'),
            side: 'top',
          },
          advanceOn: 'click',
          waitForElement: WAIT_FOR_ANALYSIS_MS,
        },
        {
          element: '[data-tour="onboarding-caption"]',
          popover: {
            title: ui('④ 자막을 고쳐요'),
            description: ui('미리보기의 자막을 누르면 바로 수정할 수 있어요. 문구를 바꿔보세요.'),
            side: 'right',
          },
          waitForElement: WAIT_FOR_UI_MS,
        },
        {
          element: '[data-tour="onboarding-intro"]',
          popover: {
            title: ui('⑤ 인트로와 음악도 넣어요'),
            description: ui('타임라인에서 인트로·아웃트로와 음악을 골라 분위기를 바꿀 수 있어요.'),
            side: 'top',
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
          element: '[data-tour="onboarding-download"]',
          popover: {
            title: ui('⑦ 다운로드하면 끝이에요'),
            description: ui('해상도를 고르고 다운로드를 누르면 완성된 영상이 저장돼요.'),
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
        showProgress: true,
        overlayOpacity: 0.4,
        onDestroyed: (reason) => {
          if (driverRef.current === driver) driverRef.current = null;
          if (reason === 'done') onCompleteRef.current?.();
          else onInterruptedRef.current?.();
        },
      });
      driverRef.current = driver;
    },
    [stop, ui]
  );

  return { start, stop };
}
