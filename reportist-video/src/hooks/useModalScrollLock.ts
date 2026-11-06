// src/hooks/useModalScrollLock.ts
import { useEffect, type RefObject } from 'react';

let lockCount = 0;
let savedScrollY = 0;
let savedStyles: {
  bodyPosition: string;
  bodyTop: string;
  bodyLeft: string;
  bodyRight: string;
  bodyWidth: string;
  bodyOverflow: string;
  bodyTouchAction: string;
  htmlOverflow: string;
} | null = null;

export interface UseModalScrollLockOptions {
  /**
   * Ref to the modal overlay/backdrop element.
   * When provided, a non-passive touchmove listener blocks background drag
   * when touches begin or move on non-scrollable parts of the modal.
   */
  overlayRef?: RefObject<HTMLElement | null>;
  /**
   * Selector for scrollable containers inside the modal.
   * Default covers common modal body selectors in reportist-video.
   */
  scrollableSelector?: string;
}

const DEFAULT_SCROLLABLE_SELECTOR =
  '.toss-video-modal-body, .model-modal-list, .settings-modal-body, .audio-library-body, .subtitle-modal-list, [data-modal-scrollable="true"]';

/**
 * Robust scroll & gesture lock for modals.
 * Completely isolates the background page while a modal/popup is open:
 * 1. Locks documentElement & body using position:fixed (required for iOS Safari).
 * 2. Blocks touchmove events on non-scrollable modal areas (backdrop, header, summary, footer).
 * 3. Preserves and restores exact pixel scroll position when all modals are closed.
 */
export function useModalScrollLock(
  isOpen: boolean,
  options?: UseModalScrollLockOptions
) {
  const overlayRef = options?.overlayRef;
  const scrollableSelector =
    options?.scrollableSelector || DEFAULT_SCROLLABLE_SELECTOR;

  useEffect(() => {
    if (!isOpen) return;

    // 1. Lock document and body
    if (lockCount === 0) {
      savedScrollY =
        window.scrollY ||
        window.pageYOffset ||
        document.documentElement.scrollTop ||
        0;

      savedStyles = {
        bodyPosition: document.body.style.position,
        bodyTop: document.body.style.top,
        bodyLeft: document.body.style.left,
        bodyRight: document.body.style.right,
        bodyWidth: document.body.style.width,
        bodyOverflow: document.body.style.overflow,
        bodyTouchAction: document.body.style.touchAction,
        htmlOverflow: document.documentElement.style.overflow,
      };

      document.documentElement.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${savedScrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    }
    lockCount++;

    // 2. Prevent touchmove on backdrop and non-scrollable parts of modal
    const overlay = overlayRef?.current;
    let handleTouchMove: ((e: TouchEvent) => void) | null = null;
    let handleWheel: ((e: WheelEvent) => void) | null = null;

    if (overlay) {
      handleTouchMove = (e: TouchEvent) => {
        const target = e.target as HTMLElement | null;
        const scrollable = target?.closest(scrollableSelector);
        if (!scrollable) {
          // Touch is on overlay backdrop, header, footer, or non-scrollable element
          if (e.cancelable) {
            e.preventDefault();
          }
        }
      };

      handleWheel = (e: WheelEvent) => {
        const target = e.target as HTMLElement | null;
        const scrollable = target?.closest(scrollableSelector);
        if (!scrollable) {
          if (e.cancelable) {
            e.preventDefault();
          }
        }
      };

      overlay.addEventListener('touchmove', handleTouchMove, { passive: false });
      overlay.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (overlay) {
        if (handleTouchMove) {
          overlay.removeEventListener('touchmove', handleTouchMove);
        }
        if (handleWheel) {
          overlay.removeEventListener('wheel', handleWheel);
        }
      }

      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0 && savedStyles) {
        document.documentElement.style.overflow = savedStyles.htmlOverflow;
        document.body.style.position = savedStyles.bodyPosition;
        document.body.style.top = savedStyles.bodyTop;
        document.body.style.left = savedStyles.bodyLeft;
        document.body.style.right = savedStyles.bodyRight;
        document.body.style.width = savedStyles.bodyWidth;
        document.body.style.overflow = savedStyles.bodyOverflow;
        document.body.style.touchAction = savedStyles.bodyTouchAction;
        window.scrollTo(0, savedScrollY);
        savedStyles = null;
      }
    };
  }, [isOpen, overlayRef, scrollableSelector]);
}
