// src/hooks/useModalFocusTrap.ts
import { useEffect, type RefObject } from 'react';

export interface UseModalFocusTrapOptions {
  /** Ref of the dialog element that should receive and keep focus while open. */
  dialogRef: RefObject<HTMLElement | null>;
  /**
   * Root element whose children (except the dialog) become inert while open.
   * Prevents both pointer and keyboard access to the background UI.
   */
  inertRootRef?: RefObject<HTMLElement | null>;
  /** Restore focus to the element focused before opening. Default: true. */
  restoreFocus?: boolean;
}

/**
 * Focus isolation for non-interactive modal/progress dialogs.
 *
 * 1. Moves focus into the dialog so focus rings never remain on background
 *    controls (e.g. the timeline or the top bar during video export).
 * 2. Keeps Tab inside the dialog's focusable controls (e.g. the cancel button).
 * 3. Marks background siblings inert so they cannot be clicked or focused.
 * 4. Restores the previous focus on close when that element is still connected.
 */
export function useModalFocusTrap(
  isOpen: boolean,
  {
    dialogRef,
    inertRootRef,
    restoreFocus = true,
  }: UseModalFocusTrapOptions
) {
  useEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    // 1. Make every sibling of the dialog inert (top bar, timeline, side docks…).
    const inertRoot = inertRootRef?.current;
    const inertTargets: Array<{ el: HTMLElement; wasInert: boolean }> = [];
    if (inertRoot) {
      for (const child of Array.from(inertRoot.children)) {
        if (!(child instanceof HTMLElement) || child === dialog) continue;
        inertTargets.push({ el: child, wasInert: child.inert });
        child.inert = true;
      }
    }

    // 2. Take focus so background controls lose their focus rings.
    dialog.focus({ preventScroll: true });

    // 3. dialog 안의 컨트롤(취소 버튼 등) 사이에서만 Tab 순환을 허용한다.
    const getFocusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusables = getFocusable();
      if (focusables.length === 0) {
        event.preventDefault();
        dialog.focus({ preventScroll: true });
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      for (const { el, wasInert } of inertTargets) {
        el.inert = wasInert;
      }
      if (restoreFocus && previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [isOpen, dialogRef, inertRootRef, restoreFocus]);
}
