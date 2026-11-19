// main.tsx - 엔트리포인트 (I18nProvider 적용)

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.tsx';
import { AppErrorBoundary } from './components/common/AppErrorBoundary.tsx';
import { I18nProvider } from './i18n/index.tsx';
import { preloadInitialLocale } from './i18n/dictionaries.ts';
import { getRuntimeLocale } from './i18n/localeState.ts';
import { installChunkLoadRecovery, recoverFromChunkLoadError } from './services/chunkLoadRecovery.ts';
import './index.css';

// 배포로 청크 이름이 바뀐 뒤에도 열려 있는 탭이 흰 화면으로 남지 않도록
// 동적 import 실패를 전역에서 감지해 새 배포를 받아온다.
installChunkLoadRecovery();

async function bootstrap() {
  // en/ko 외 로케일은 첫 렌더 전에 사전 청크를 미리 받아 언어 깜빡임을 방지한다.
  try {
    await preloadInitialLocale(getRuntimeLocale());
  } catch (error) {
    // 사전 청크가 만료된 경우 복구 새로고침을 예약하고, 실패해도 영어 사전으로 앱은 띄운다.
    recoverFromChunkLoadError(error);
    console.warn('[bootstrap] Locale dictionary preload failed:', error);
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <I18nProvider>
          <App />
        </I18nProvider>
      </AppErrorBoundary>
    </React.StrictMode>
  );
}

void bootstrap();
