// components/common/AppErrorBoundary.tsx - 청크/렌더 오류가 앱 전체를 흰 화면으로 만들지 않게 막는다.
// 배포 직후 이전 청크를 캐시한 탭에서 React.lazy 모달을 열면 동적 import가 404로 실패하고,
// ErrorBoundary가 없으면 React가 루트를 언마운트해 아무것도 보이지 않는다.
import React from 'react';
import { PenguinLogo } from './PenguinLogo.tsx';
import { getRuntimeLocale } from '../../i18n/localeState.ts';
import type { Locale } from '../../i18n/types.ts';

interface ErrorCopy {
  title: string;
  description: string;
  action: string;
  hint: string;
}

const ERROR_COPY: Record<Locale, ErrorCopy> = {
  en: {
    title: 'Something went wrong',
    description:
      'We could not load this screen. A new version may have replaced the files this tab was using.',
    action: 'Reload',
    hint: 'If the problem continues, refresh the browser completely.',
  },
  ko: {
    title: '화면을 불러오지 못했어요',
    description: '새 버전이 배포되면서 이 탭이 사용하던 파일이 바뀌었을 수 있어요.',
    action: '새로고침',
    hint: '문제가 계속되면 브라우저를 완전히 새로고침해 주세요.',
  },
  ja: {
    title: '画面を読み込めませんでした',
    description:
      '新しいバージョンの配信により、このタブで使用していたファイルが変わった可能性があります。',
    action: '再読み込み',
    hint: '問題が続く場合は、ブラウザを完全に再読み込みしてください。',
  },
  zh: {
    title: '无法加载此页面',
    description: '新版本发布后，此标签页使用的文件可能已被替换。',
    action: '重新加载',
    hint: '如果问题仍然存在，请彻底刷新浏览器。',
  },
  es: {
    title: 'No se pudo cargar esta pantalla',
    description:
      'Es posible que una nueva versión haya reemplazado los archivos que usaba esta pestaña.',
    action: 'Recargar',
    hint: 'Si el problema continúa, actualiza el navegador por completo.',
  },
  fr: {
    title: 'Impossible de charger cet écran',
    description:
      'Une nouvelle version a peut-être remplacé les fichiers utilisés par cet onglet.',
    action: 'Recharger',
    hint: 'Si le problème persiste, actualise complètement le navigateur.',
  },
  de: {
    title: 'Dieser Bildschirm konnte nicht geladen werden',
    description:
      'Eine neue Version hat möglicherweise die Dateien dieses Tabs ersetzt.',
    action: 'Neu laden',
    hint: 'Wenn das Problem weiterhin besteht, lade den Browser vollständig neu.',
  },
};

function AppCrashFallback({ onReload }: { onReload: () => void }) {
  const copy = ERROR_COPY[getRuntimeLocale()] ?? ERROR_COPY.en;

  return (
    <div
      role="alert"
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background: '#f8f9fa',
        color: '#0f172a',
        fontFamily:
          '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '32px 24px',
          border: '1px solid #e2e8f0',
          borderRadius: '20px',
          background: '#ffffff',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
        }}
      >
        <PenguinLogo size={48} color="#0f172a" />
        <h1
          style={{
            margin: '18px 0 8px',
            fontSize: '20px',
            lineHeight: 1.35,
            fontWeight: 800,
            letterSpacing: '-0.03em',
          }}
        >
          {copy.title}
        </h1>
        <p
          style={{
            margin: '0 0 22px',
            color: '#64748b',
            fontSize: '14px',
            lineHeight: 1.6,
            wordBreak: 'keep-all',
          }}
        >
          {copy.description}
        </p>
        <button
          type="button"
          onClick={onReload}
          style={{
            width: '100%',
            height: '48px',
            border: 'none',
            borderRadius: '12px',
            background: '#0f172a',
            color: '#ffffff',
            fontSize: '15px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {copy.action}
        </button>
        <p
          style={{
            margin: '14px 0 0',
            color: '#94a3b8',
            fontSize: '12px',
            lineHeight: 1.5,
            wordBreak: 'keep-all',
          }}
        >
          {copy.hint}
        </p>
      </div>
    </div>
  );
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<
  React.PropsWithChildren,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('[AppErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return <AppCrashFallback onReload={this.handleReload} />;
    }
    return this.props.children;
  }
}
