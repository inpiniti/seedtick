// main.tsx - 엔트리포인트 (I18nProvider 적용)

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.tsx';
import { I18nProvider } from './i18n/index.tsx';
import { preloadInitialLocale } from './i18n/dictionaries.ts';
import { getRuntimeLocale } from './i18n/localeState.ts';
import './index.css';

async function bootstrap() {
  // en/ko 외 로케일은 첫 렌더 전에 사전 청크를 미리 받아 언어 깜빡임을 방지한다.
  await preloadInitialLocale(getRuntimeLocale());

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <I18nProvider>
        <App />
      </I18nProvider>
    </React.StrictMode>
  );
}

void bootstrap();
