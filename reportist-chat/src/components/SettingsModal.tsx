// components/SettingsModal.tsx - 게이트웨이 설정 모달

import React, { useState } from 'react';
import { Activity, Key, Link2, RotateCcw, Save, X } from 'lucide-react';
import type { GatewayConfig } from '../types/chat.ts';
import { DEFAULT_CONFIG, checkGatewayHealth } from '../services/api.ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: GatewayConfig;
  onSaveConfig: (config: GatewayConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [baseUrl, setBaseUrl] = useState(config.baseUrl);
  const [secret, setSecret] = useState(config.gatewaySecret);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'fail' | null>(null);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const ok = await checkGatewayHealth({ baseUrl, gatewaySecret: secret });
    setTesting(false);
    setTestResult(ok ? 'success' : 'fail');
  };

  const handleSave = () => {
    onSaveConfig({ baseUrl, gatewaySecret: secret });
    onClose();
  };

  const handleReset = () => {
    setBaseUrl(DEFAULT_CONFIG.baseUrl);
    setSecret(DEFAULT_CONFIG.gatewaySecret);
    setTestResult(null);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card settings-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <h2 className="modal-title">게이트웨이 설정</h2>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="settings-body">
          <div className="setting-item">
            <label className="setting-label">
              <Link2 size={16} />
              <span>AI Gateway URL</span>
            </label>
            <input
              type="text"
              className="setting-input"
              placeholder="예: https://seedtick-ai-gateway.vercel.app"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            <p className="setting-hint">
              기본 배포 게이트웨이(https://seedtick-ai-gateway.vercel.app) 또는 로컬 게이트웨이 주소예요.
            </p>
          </div>

          <div className="setting-item">
            <label className="setting-label">
              <Key size={16} />
              <span>Gateway Secret (Bearer 토큰)</span>
            </label>
            <input
              type="password"
              className="setting-input"
              placeholder="게이트웨이 시크릿 키 입력"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
            <p className="setting-hint">
              reportist-ai-gateway의 .env.local에 설정된 GATEWAY_SECRET 값이에요.
            </p>
          </div>

          {/* 연결 테스트 */}
          <div className="connection-test-row">
            <button
              type="button"
              className="secondary-btn"
              onClick={handleTestConnection}
              disabled={testing}
            >
              <Activity size={15} />
              <span>{testing ? '연결 확인 중...' : '게이트웨이 연결 테스트'}</span>
            </button>

            {testResult === 'success' && (
              <span className="test-badge success">연결이 원활해요!</span>
            )}
            {testResult === 'fail' && (
              <span className="test-badge fail">게이트웨이에 응답이 없어요</span>
            )}
          </div>
        </div>

        <div className="modal-footer space-between">
          <button type="button" className="ghost-btn" onClick={handleReset}>
            <RotateCcw size={14} />
            <span>기본값으로 복원</span>
          </button>

          <div className="footer-actions">
            <button type="button" className="ghost-btn" onClick={onClose}>
              닫기
            </button>
            <button type="button" className="primary-btn" onClick={handleSave}>
              <Save size={16} />
              <span>저장하기</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
