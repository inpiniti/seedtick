// components/TelemetryPanel.tsx - AI 의사결정 실시간 텔레메트리 & 멀티 게이지 대시보드

import React from 'react';
import { Activity, Zap, CheckCircle2, ArrowUpCircle, Radio, Gauge, ShieldAlert } from 'lucide-react';
import type { DecisionLogEntry, BrainGaugesState } from '../types/game.ts';

interface TelemetryPanelProps {
  logs: DecisionLogEntry[];
  latestStatus?: {
    state: 'idle' | 'thinking' | 'action_ready' | 'jumped';
    confidence: number;
    choice: 'JUMP' | 'RUN';
    latencyMs: number;
  };
  gauges?: BrainGaugesState;
  isAiActive: boolean;
  modelName: string;
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({
  logs,
  latestStatus,
  gauges,
  isAiActive,
  modelName,
}) => {
  const totalDecisions = logs.length;
  const jumpDecisions = logs.filter((l) => l.choice === 'JUMP').length;
  const avgLatency =
    totalDecisions > 0
      ? Math.round(logs.reduce((sum, l) => sum + l.latencyMs, 0) / totalDecisions)
      : 0;

  const currentGauges: BrainGaugesState = gauges || {
    collisionThreat: 18,
    jumpTrajectory: 24,
    obstacleClearance: 85,
    actionProbability: { JUMP: 15, RUN: 85 },
    threatLevelText: 'NOMINAL',
    currentDistance: 0,
  };

  const threatColor =
    currentGauges.collisionThreat > 75
      ? '#ef4444' // red
      : currentGauges.collisionThreat > 45
      ? '#f59e0b' // amber
      : '#3b82f6'; // blue

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

      {/* 2. 상단 핵심 KPI 그리드 */}
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

      {/* 3. 실시간 AI 추론 게이지 매트릭스 (첨부 대시보드 레퍼런스 스타일) */}
      <div className="neural-gauges-section">
        <div className="neural-gauges-header">
          <div className="flex items-center gap-1.5">
            <Gauge size={13} className="text-blue-600" />
            <span className="font-mono text-[11px] font-bold text-slate-700 tracking-wider">
              REAL-TIME NEURAL GAUGES
            </span>
          </div>
          <span className={`threat-badge ${currentGauges.threatLevelText.toLowerCase()}`}>
            {currentGauges.threatLevelText}
          </span>
        </div>

        <div className="neural-gauges-list">
          {/* 게이지 1: COLLISION THREAT */}
          <div className="gauge-item">
            <div className="gauge-row-top">
              <span className="gauge-meta-label">COLLISION THREAT</span>
              <span className="gauge-meta-desc">
                {currentGauges.currentDistance > 0
                  ? `dist ${currentGauges.currentDistance}px`
                  : 'path clear'}
              </span>
              <span className="gauge-meta-pct font-mono font-bold" style={{ color: threatColor }}>
                {currentGauges.collisionThreat}%
              </span>
            </div>
            <div className="gauge-track">
              <div
                className="gauge-fill-animated"
                style={{
                  width: `${currentGauges.collisionThreat}%`,
                  backgroundColor: threatColor,
                }}
              />
            </div>
          </div>

          {/* 게이지 2: JUMP TRAJECTORY */}
          <div className="gauge-item">
            <div className="gauge-row-top">
              <span className="gauge-meta-label">JUMP TRAJECTORY</span>
              <span className="gauge-meta-desc">liftoff precision</span>
              <span className="gauge-meta-pct font-mono font-bold text-indigo-600">
                {currentGauges.jumpTrajectory}%
              </span>
            </div>
            <div className="gauge-track">
              <div
                className="gauge-fill-striped"
                style={{
                  width: `${currentGauges.jumpTrajectory}%`,
                  background: 'linear-gradient(90deg, #6366f1, #ec4899)',
                }}
              />
            </div>
          </div>

          {/* 게이지 3: OBSTACLE CLEARANCE */}
          <div className="gauge-item">
            <div className="gauge-row-top">
              <span className="gauge-meta-label">OBSTACLE CLEARANCE</span>
              <span className="gauge-meta-desc">margin of error</span>
              <span className="gauge-meta-pct font-mono font-bold text-emerald-600">
                {currentGauges.obstacleClearance}%
              </span>
            </div>
            <div className="gauge-track">
              <div
                className="gauge-fill-animated"
                style={{
                  width: `${currentGauges.obstacleClearance}%`,
                  backgroundColor: '#10b981',
                }}
              />
            </div>
          </div>

          {/* 게이지 4: ACTION PROBABILITY (JUMP vs RUN) */}
          <div className="gauge-item">
            <div className="gauge-row-top">
              <span className="gauge-meta-label">ACTION PROBABILITY</span>
              <span className="gauge-meta-desc">
                {currentGauges.actionProbability.JUMP > currentGauges.actionProbability.RUN
                  ? 'JUMP Favored'
                  : 'RUN Favored'}
              </span>
              <span className="gauge-meta-pct font-mono font-bold text-slate-800">
                J {currentGauges.actionProbability.JUMP}% / R {currentGauges.actionProbability.RUN}%
              </span>
            </div>
            <div className="dual-prob-track">
              <div
                className="dual-fill-jump"
                style={{ width: `${currentGauges.actionProbability.JUMP}%` }}
              />
              <div
                className="dual-fill-run"
                style={{ width: `${currentGauges.actionProbability.RUN}%` }}
              />
            </div>
          </div>
        </div>
      </div>

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
