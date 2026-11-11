// services/toastService.ts - Ding 기반 다이나믹 스프링 물리 토스트 서비스

import { toast, type ToastOptions, type ToastPatch, type ToastAction } from '@yusufceng1z/ding';

// 사운드 및 로케일 라벨 초기 구성
try {
  toast.configure({
    sound: true,
    volume: 0.6,
    labels: {
      region: '알림',
      dismiss: '알림 닫기',
    },
  });
} catch (e) {
  console.warn('Toast configure failed:', e);
}

export const notify = {
  success: (title: string, opts?: ToastOptions) => toast.success(title, opts),
  error: (title: string, opts?: ToastOptions) => toast.error(title, opts),
  warning: (title: string, opts?: ToastOptions) => toast.warning(title, opts),
  info: (title: string, opts?: ToastOptions) => toast.info(title, opts),
  loading: (title: string, opts?: ToastOptions) => toast.loading(title, opts),
  promise: toast.promise,
  dismiss: toast.dismiss,
  update: toast.update,

  /**
   * 실행 취소(Undo) 등 인터랙티브 액션이 포함된 알림 편의 함수
   */
  action: (
    title: string,
    actionLabel: string,
    onAction: () => void | ToastPatch,
    opts?: Omit<ToastOptions, 'action'>
  ) => {
    return toast.success(title, {
      ...opts,
      duration: opts?.duration ?? 5000,
      action: {
        label: actionLabel,
        onClick: onAction,
      },
    });
  },
};

export { toast };
export type { ToastOptions, ToastPatch, ToastAction };
