"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowLeft, Brain, ShieldAlert, Award } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { OnDemandModal } from "@/components/research/OnDemandModal";

interface UnanalyzedStockViewProps {
  ticker: string;
  displayName?: string;
}

export function UnanalyzedStockView({
  ticker,
  displayName,
}: UnanalyzedStockViewProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const cleanTicker = ticker.trim().toUpperCase();
  const title = displayName || cleanTicker;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-between">
      {/* ── 상단 내비게이션 바 ── */}
      <header className="h-14 border-b border-[#e2e8f0] bg-white px-4 sm:px-8 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#64748b] hover:text-[#0f172a] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>전체 카탈로그로 돌아가기</span>
        </Link>
        <div className="flex items-center gap-1.5 font-mono text-xs text-[#94a3b8]">
          <span>REPORTIST</span>
          <span>·</span>
          <span className="font-bold text-[#0f172a]">{cleanTicker}</span>
        </div>
      </header>

      {/* ── 메인 안내 및 분석 요청 카드 ── */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-12 sm:py-16 flex flex-col justify-center items-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#e8f3ff] text-[#3182f6] flex items-center justify-center mb-6 shadow-sm">
          <Brain className="w-8 h-8" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#f1f5f9] text-[#475569] mb-3">
          <ShieldAlert className="w-3.5 h-3.5 text-[#f59e0b]" />
          <span>정기 스크리닝 미포함 종목</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0f172a] tracking-tight mb-3">
          {title} ({cleanTicker})
        </h1>

        <p className="text-sm text-[#64748b] leading-relaxed max-w-lg mb-8">
          해당 종목은 13인의 전설적 거장 기준(고수익·저부채·안전마진)에 부합하지 않아 매일 발행되는 정기 분석 목록에 포함되지 않았습니다.
          <br className="hidden sm:inline" />
          지금 즉시 13인의 거장 AI에게 심층 가치평가 및 표결을 요청해보세요!
        </p>

        {/* ── 13인 거장 라운드테이블 혜택 요약 ── */}
        <div className="w-full bg-white border border-[#e2e8f0] rounded-2xl p-5 sm:p-6 mb-8 text-left shadow-xs space-y-3">
          <div className="text-xs font-semibold text-[#0f172a] flex items-center gap-2">
            <Award className="w-4 h-4 text-[#3182f6]" />
            <span>즉시 분석 요청 시 제공되는 리포트 산출물</span>
          </div>
          <ul className="text-xs text-[#475569] space-y-2 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-[#3182f6] font-bold">1.</span>
              <span><strong>공용 심층 데이터팩</strong>: 재무제표 3개년 요약, ROE, 부채비율, 밸류에이션</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#3182f6] font-bold">2.</span>
              <span><strong>가치 드라이버 & 촉매</strong>: AI가 실시간 발굴한 기업 고유 성장동력</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#3182f6] font-bold">3.</span>
              <span><strong>13인 거장 표결 & 적정가</strong>: 워런 버핏, 피터 린치 등 13인의 독립 채점</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#3182f6] font-bold">4.</span>
              <span><strong>마스터 종합 보고서</strong>: 거장 토론 합의를 거친 최종 투자의견 & 안전마진 밴드</span>
            </li>
          </ul>
        </div>

        {/* ── 요청 액션 버튼 ── */}
        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-3">
          <Button
            variant="primary"
            size="lg"
            onClick={() => setIsModalOpen(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 font-semibold shadow-md"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>13인 거장 AI 즉시 분석 요청 (약 1~2분 소요)</span>
          </Button>
          <Link href="/" className="w-full sm:w-auto">
            <Button variant="secondary" size="lg" className="w-full sm:w-auto">
              다른 종목 둘러보기
            </Button>
          </Link>
        </div>

        <p className="text-[11px] text-[#94a3b8] mt-4">
          ※ 분석을 시작하면 창을 닫아도 백그라운드에서 진행되며, 10분 뒤 재방문 시에도 확인 가능합니다.
        </p>
      </main>

      {/* ── 푸터 ── */}
      <footer className="py-4 text-center text-xs text-[#94a3b8] border-t border-[#e2e8f0] bg-white">
        © Reportist Research · 13 Gurus Investment Intelligence
      </footer>

      {/* ── 실시간 분석 진행 모달 ── */}
      <OnDemandModal
        isOpen={isModalOpen}
        ticker={cleanTicker}
        displayName={displayName}
        onClose={() => setIsModalOpen(false)}
        onCompleted={(t) => {
          // 분석 완료 시 새로 생성된 리포트 상세 페이지로 이동
          router.push(`/stocks/${encodeURIComponent(t)}`);
          router.refresh();
        }}
      />
    </div>
  );
}
