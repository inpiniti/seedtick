// components/SettingsModal.tsx - AI Gateway 설정 모달
import React, { useState } from 'react';
import { X, Check, Server, Key, RotateCcw } from 'lucide-react';
import {
  DEFAULT_GATEWAY_URL,
  DEFAULT_GATEWAY_SECRET,
  loadGatewayConfig,
  saveGatewayConfig,
  type GatewayConfig,
} from '../services/decisionsApi.ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState<GatewayConfig>(loadGatewayConfig());
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    saveGatewayConfig(config);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 600);
  };

  const handleReset = () => {
    const def = {
      baseUrl: DEFAULT_GATEWAY_URL,
      gatewaySecret: DEFAULT_GATEWAY_SECRET,
    };
    setConfig(def);
    saveGatewayConfig(def);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <Server size={18} className="text-blue-600" />
            <h3 className="modal-title">AI 게이트웨이 설정</h3>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-desc">
            Decisions API를 호출할 <code>reportist-ai-gateway</code> 엔드포인트를 설정합니다.
          </p>

          <div className="form-group">
            <label className="form-label">
              <Server size={14} /> Gateway Base URL
            </label>
            <input
              type="text"
              className="form-input"
              value={config.baseUrl}
              onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
              placeholder="https://seedtick-ai-gateway.vercel.app"
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <Key size={14} /> Gateway Secret Token
            </label>
            <input
              type="password"
              className="form-input"
              value={config.gatewaySecret}
              onChange={(e) => setConfig({ ...config, gatewaySecret: e.target.value })}
              placeholder="GATEWAY_SECRET 값"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="action-btn-sm" onClick={handleReset}>
            <RotateCcw size={14} />
            <span>기본값 복원</span>
          </button>

          <div className="flex gap-2">
            <button type="button" className="cancel-btn" onClick={onClose}>
              취소
            </button>
            <button type="button" className="save-btn" onClick={handleSave}>
              {isSaved ? <Check size={16} /> : null}
              <span>{isSaved ? '저장됨' : '저장하기'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
