// components/TelemetryPanel.tsx - AI 의사결정 실시간 텔레메트리 뷰어

import React from 'react';
import { Activity, Zap, CheckCircle2, ArrowUpCircle, Gauge, Radio } from 'lucide-react';
import type { DecisionLogEntry } from '../types/game.ts';

interface TelemetryPanelProps {
  logs: DecisionLogEntry[];
  latestStatus?: {
    state: 'idle' | 'thinking' | 'action_ready' | 'jumped';
    confidence: number;
    choice: 'JUMP' | 'RUN';
    latencyMs: number;
  };
  isAiActive: boolean;
  modelName: string;
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({
  logs,
  latestStatus,
  isAiActive,
  modelName,
}) => {
  const totalDecisions = logs.length;
  const jumpDecisions = logs.filter((l) => l.choice === 'JUMP').length;
  const avgLatency =
    totalDecisions > 0
      ? Math.round(logs.reduce((sum, l) => sum + l.latencyMs, 0) / totalDecisions)
      : 0;

  const latestLog = logs[0];

  return (
    <aside className="telemetry-panel">
      {/* 1. 패널 헤더 */}
      <div className="telemetry-header">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-blue-500 animate-pulse" />
          <h3 className="telemetry-title">DECISION BRAIN TELEMETRY</h3>
        </div>
        <div className="telemetry-status-tag">
          <span
            className={`w-2 h-2 rounded-full ${
              isAiActive ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'
            }`}
          />
          <span className="text-[11px] font-mono text-slate-500">
            {isAiActive ? 'ONLINE' : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* 2. 모델 정보 & 지표 카드 */}
      <div className="telemetry-kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">MODEL</span>
          <span className="kpi-val truncate" title={modelName}>
            {modelName.split(':')[0]}
          </span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">AVG PING</span>
          <span className="kpi-val text-blue-600 font-mono">
            {avgLatency > 0 ? `${avgLatency}ms` : '0ms'}
          </span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">DECISIONS</span>
          <span className="kpi-val font-mono">{totalDecisions}회</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">JUMPS</span>
          <span className="kpi-val text-emerald-600 font-mono">{jumpDecisions}회</span>
        </div>
      </div>

      {/* 3. 최근 의사결정 확률 게이지 바 */}
      {latestLog && (
        <div className="decision-gauge-box">
          <div className="gauge-header">
            <span className="gauge-label">LATEST PROBABILITY</span>
            <span className="gauge-choice font-bold">
              {latestLog.choice === 'JUMP' ? (
                <span className="text-emerald-600 flex items-center gap-1">
                  <ArrowUpCircle size={14} /> JUMP ({latestLog.confidence}%)
                </span>
              ) : (
                <span className="text-slate-600 flex items-center gap-1">
                  <CheckCircle2 size={14} /> RUN ({latestLog.confidence}%)
                </span>
              )}
            </span>
          </div>

          {/* 양방향 확률 바 */}
          <div className="prob-bar-track">
            <div
              className="prob-bar-fill-jump"
              style={{ width: `${Math.round(latestLog.probabilities.JUMP * 100)}%` }}
              title={`JUMP: ${(latestLog.probabilities.JUMP * 100).toFixed(0)}%`}
            />
            <div
              className="prob-bar-fill-run"
              style={{ width: `${Math.round(latestLog.probabilities.RUN * 100)}%` }}
              title={`RUN: ${(latestLog.probabilities.RUN * 100).toFixed(0)}%`}
            />
          </div>
          <div className="prob-bar-labels">
            <span className="text-[10px] font-mono text-emerald-600">
              JUMP {(latestLog.probabilities.JUMP * 100).toFixed(0)}%
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              RUN {(latestLog.probabilities.RUN * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      {/* 4. 실시간 결정 스트림 로그 */}
      <div className="telemetry-stream-section">
        <div className="stream-header">
          <Radio size={13} className="text-slate-500" />
          <span>실시간 결정 스트림 (최근 15건)</span>
        </div>

        <div className="stream-list">
          {logs.length === 0 ? (
            <div className="stream-empty">
              <span>장애물이 접근하면 Mercury Decide 모델의 실시간 의사결정 스트림이 여기에 기록됩니다.</span>
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="stream-item">
                <div className="stream-item-left">
                  <span
                    className={`choice-badge ${
                      log.choice === 'JUMP' ? 'jump' : 'run'
                    }`}
                  >
                    {log.choice}
                  </span>
                  <div className="stream-meta">
                    <span className="stream-obs">
                      {log.obstacleType} @ {log.distance}px
                    </span>
                    <span className="stream-speed font-mono">
                      spd {log.speed}
                    </span>
                  </div>
                </div>

                <div className="stream-item-right">
                  <span className="stream-conf font-mono">
                    {log.confidence}%
                  </span>
                  <span className="stream-ping font-mono text-[10px] text-slate-400">
                    {log.latencyMs}ms
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
};
