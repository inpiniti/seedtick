// components/queue/QueueStatusCard.tsx
// 자체 인메모리 큐(reportist-analyzer) 대기 순번을 보여주는 공용 카드

import React from 'react';
import { Clock, Users } from 'lucide-react';

export interface QueueCopy {
  badge: string;
  waitingTitle: string;
  cancel: string;
  ahead: (position: number) => string;
  eta: (seconds: number) => string;
  hint: string;
}

const QUEUE_COPY: Record<string, QueueCopy> = {
  ko: {
    badge: '대기 중',
    waitingTitle: '잠시만 기다려 주세요',
    cancel: '대기 취소하기',
    ahead: (position) => `내 앞 대기자 ${position}명`,
    eta: (seconds) => `예상 대기 약 ${seconds}초`,
    hint: '순서가 되면 자동으로 분석이 시작됩니다. 창을 닫지 않아도 안전하게 기다릴 수 있어요.',
  },
  ja: {
    badge: '待機中',
    waitingTitle: '少々お待ちください',
    cancel: '待機をキャンセル',
    ahead: (position) => `前に ${position}人 待機中`,
    eta: (seconds) => `予想待ち時間 約${seconds}秒`,
    hint: '順番になると自動で分析が始まります。このままお待ちください。',
  },
  zh: {
    badge: '排队中',
    waitingTitle: '请稍等片刻',
    cancel: '取消等待',
    ahead: (position) => `前面还有 ${position}人`,
    eta: (seconds) => `预计等待约 ${seconds}秒`,
    hint: '轮到您时会自动开始分析，请保持页面打开。',
  },
  en: {
    badge: 'In queue',
    waitingTitle: 'Please wait a moment',
    cancel: 'Cancel waiting',
    ahead: (position) => `${position} people ahead of you`,
    eta: (seconds) => `About ${seconds}s left`,
    hint: 'Analysis starts automatically when it is your turn. You can safely leave this window open.',
  },
};

export function getQueueCopy(locale: string): QueueCopy {
  return QUEUE_COPY[locale] || QUEUE_COPY.en;
}

interface QueueStatusCardProps {
  locale: string;
  position?: number;
  estimatedWaitSec?: number;
}

export function QueueStatusCard({
  locale,
  position = 0,
  estimatedWaitSec = 0,
}: QueueStatusCardProps) {
  const copy = getQueueCopy(locale);
  const safePosition = Math.max(0, position);
  const safeEta = Math.max(0, Math.round(estimatedWaitSec));

  return (
    <div className="w-full rounded-2xl border border-blue-100 bg-blue-50/80 px-4 py-3 text-left">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wide text-blue-700">
          {copy.badge}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600">
          <Clock size={12} />
          {copy.eta(safeEta)}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Users size={16} className="text-blue-500" />
        <span className="text-sm font-bold text-slate-800">{copy.ahead(safePosition)}</span>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-500">{copy.hint}</p>
    </div>
  );
}
