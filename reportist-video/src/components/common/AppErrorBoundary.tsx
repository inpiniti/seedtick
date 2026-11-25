// components/common/AppErrorBoundary.tsx - 청크/렌더 오류가 앱 전체를 흰 화면으로 만들지 않게 막는다.
// 배포 직후 이전 청크를 캐시한 탭에서 React.lazy 모달을 열면 동적 import가 404로 실패하고,
// ErrorBoundary가 없으면 React가 루트를 언마운트해 아무것도 보이지 않는다.
import React from 'react';
import { PenguinLogo } from './PenguinLogo.tsx';
import { getRuntimeLocale } from '../../i18n/localeState.ts';
import type { Locale } from '../../i18n/types.ts';
import {
  isChunkLoadError,
  recoverFromChunkLoadError,
} from '../../services/chunkLoadRecovery.ts';

interface ErrorCopy {
  title: string;
  description: string;
  action: string;
  hint: string;
  recovering: string;
}

const ERROR_COPY: Record<Locale, ErrorCopy> = {
  en: {
    title: 'Something went wrong',
    description:
      'We could not load this screen. A new version may have replaced the files this tab was using.',
    action: 'Reload',
    hint: 'If the problem continues, refresh the browser completely.',
    recovering: 'Loading the latest version…',
  },
  ko: {
    title: '화면을 불러오지 못했어요',
    description: '새 버전이 배포되면서 이 탭이 사용하던 파일이 바뀌었을 수 있어요.',
    action: '새로고침',
    hint: '문제가 계속되면 브라우저를 완전히 새로고침해 주세요.',
    recovering: '최신 버전을 불러오는 중이에요…',
  },
  ja: {
    title: '画面を読み込めませんでした',
    description:
      '新しいバージョンの配信により、このタブで使用していたファイルが変わった可能性があります。',
    action: '再読み込み',
    hint: '問題が続く場合は、ブラウザを完全に再読み込みしてください。',
    recovering: '最新バージョンを読み込み中です…',
  },
  zh: {
    title: '无法加载此页面',
    description: '新版本发布后，此标签页使用的文件可能已被替换。',
    action: '重新加载',
    hint: '如果问题仍然存在，请彻底刷新浏览器。',
    recovering: '正在加载最新版本…',
  },
  es: {
    title: 'No se pudo cargar esta pantalla',
    description:
      'Es posible que una nueva versión haya reemplazado los archivos que usaba esta pestaña.',
    action: 'Recargar',
    hint: 'Si el problema continúa, actualiza el navegador por completo.',
    recovering: 'Cargando la versión más reciente…',
  },
  fr: {
    title: 'Impossible de charger cet écran',
    description:
      'Une nouvelle version a peut-être remplacé les fichiers utilisés par cet onglet.',
    action: 'Recharger',
    hint: 'Si le problème persiste, actualise complètement le navigateur.',
    recovering: 'Chargement de la dernière version…',
  },
  de: {
    title: 'Dieser Bildschirm konnte nicht geladen werden',
    description:
      'Eine neue Version hat möglicherweise die Dateien dieses Tabs ersetzt.',
    action: 'Neu laden',
    hint: 'Wenn das Problem weiterhin besteht, lade den Browser vollständig neu.',
    recovering: 'Neueste Version wird geladen…',
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

// 만료된 청크 때문에 자동 새로고침을 예약한 동안 보여주는 안내 화면.
function AppRecoveryFallback() {
  const copy = ERROR_COPY[getRuntimeLocale()] ?? ERROR_COPY.en;

  return (
    <div
      role="status"
      aria-live="polite"
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
      <div style={{ display: 'grid', justifyItems: 'center', gap: '18px' }}>
        <PenguinLogo size={48} color="#0f172a" />
        <p style={{ margin: 0, color: '#64748b', fontSize: '15px' }}>{copy.recovering}</p>
      </div>
    </div>
  );
}

interface AppErrorBoundaryState {
  hasError: boolean;
  recovering: boolean;
}

export class AppErrorBoundary extends React.Component<
  React.PropsWithChildren,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false, recovering: false };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    // 지연 청크 404는 새 배포를 받으면 해결되므로 크래시 화면 대신 복구 안내를 보여준다.
    if (isChunkLoadError(error)) {
      return { hasError: false, recovering: true };
    }
    return { hasError: true, recovering: false };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    if (recoverFromChunkLoadError(error)) {
      // 새로고침이 예약됐으면 콘솔 에러도 남기지 않는다.
      return;
    }
    if (isChunkLoadError(error)) {
      // 이미 복구 기회를 썼다면 수동 새로고침이 가능한 크래시 화면으로 전환한다.
      this.setState({ hasError: true, recovering: false });
      return;
    }
    console.error('[AppErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return <AppCrashFallback onReload={this.handleReload} />;
    }
    if (this.state.recovering) {
      return <AppRecoveryFallback />;
    }
    return this.props.children;
  }
}
