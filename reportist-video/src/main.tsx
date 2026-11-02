// main.tsx - 엔트리포인트 (I18nProvider 적용)

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.tsx';
import { I18nProvider } from './i18n/index.tsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>
);
