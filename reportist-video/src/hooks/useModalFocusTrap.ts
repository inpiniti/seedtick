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
 * 2. Keeps Tab inside the dialog — progress dialogs have no focusable controls.
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

    // 3. Progress dialogs contain no controls — hold focus on the dialog itself.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      event.preventDefault();
      dialog.focus({ preventScroll: true });
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
