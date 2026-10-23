import React from "react";
import Link from "next/link";
import { ArrowLeft, FileText, AlertCircle } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "서비스 이용약관 · Reportist Research",
  description: "Reportist 서비스의 이용약관입니다. 투자 정보 열람 및 멤버십 이용 조건을 확인하세요.",
  alternates: {
    canonical: "/terms",
    languages: {
      ko: "/terms",
      en: "/en/terms",
      "x-default": "/terms",
    },
  },
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans pb-24">
      {/* 상단 미니멀 네비게이션 헤더 */}
      <div className="bg-white border-b border-[#e2e8f0] sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-[#64748b] hover:text-[#0f172a] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>REPORTIST RESEARCH 홈으로</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/privacy"
              className="text-xs font-mono px-2.5 py-1 rounded-md text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition-colors"
            >
              개인정보처리방침 ➔
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-10 sm:pt-14">
        {/* 헤더 섹션 */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-[#cbd5e1] text-[#64748b] text-[11px] font-mono mb-3">
            <FileText className="w-3.5 h-3.5 text-[#0f172a]" />
            <span>TERMS OF SERVICE · LEGAL NOTICE</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0f172a] tracking-tight">
            서비스 이용약관
          </h1>
          <p className="mt-2 text-[#64748b] text-xs sm:text-sm font-mono leading-relaxed">
            시드틱(Reportist)의 투자 리서치, AI 가치평가 및 유료 멤버십 서비스 이용과 관련된 권리와 의무를 규정합니다.
          </p>
          <div className="mt-4 flex items-center gap-3 text-[11px] font-mono text-[#94a3b8] border-b border-[#e2e8f0] pb-4">
            <span>시행일자: 2026년 10월 14일</span>
            <span>·</span>
            <span>최종 변경일자: 2026년 10월 14일</span>
          </div>
        </div>

        {/* 본문 카드 */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 sm:p-8 shadow-xs space-y-8 text-sm leading-relaxed text-[#334155]">
          {/* 투자 유의사항 및 면책조항 (금융 리서치 필수 문구) */}
          <section className="bg-amber-50/60 border border-amber-200/80 rounded-lg p-4">
            <h2 className="text-sm font-bold text-amber-900 flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              투자 판단 및 면책 고지 (중요)
            </h2>
            <p className="text-xs text-amber-800/90 leading-relaxed">
              본 서비스에서 제공하는 모든 밸류에이션 리포트, 13인 거장 AI 스크리닝 지표, 적정주가 밴드는 객관적인 공시 재무제표와 투자 철학 모델에 기반한 <strong>참고용 리서치 분석 자료</strong>입니다. 이는 금융투자상품의 매매를 권유하거나 특정 종목의 수익을 보장하는 것이 아니며, 모든 최종 투자 판단과 손익의 책임은 투자자 본인에게 귀속됩니다.
            </p>
          </section>

          {/* 1. 목적 */}
          <section>
            <h2 className="text-base sm:text-lg font-bold text-[#0f172a] flex items-center gap-2 mb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">01</span>
              목적
            </h2>
            <p>
              본 약관은 시드틱(이하 &quot;서비스&quot;)이 제공하는 국내 및 미국 주식 AI 가치평가 및 심층 리서치 플랫폼 서비스의 이용과 관련하여, 서비스와 회원 간의 권리, 의무 및 책임사항, 기타 필요한 제반 사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          {/* 2. 회원의 권리와 서비스 이용 */}
          <section>
            <h2 className="text-base sm:text-lg font-bold text-[#0f172a] flex items-center gap-2 mb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">02</span>
              계정 및 서비스 이용
            </h2>
            <ul className="list-disc list-inside pl-1 text-[#64748b] space-y-1.5 text-xs">
              <li>회원은 Google 계정 인증(OAuth)을 통해 간편하게 가입하고 로그인할 수 있습니다.</li>
              <li>회원은 자신의 계정 접근 권한을 제3자에게 양도하거나 대여할 수 없으며, 계정 보안에 대한 관리 책임을 집니다.</li>
              <li>서비스에서 제공하는 분석 데이터와 리포트의 지식재산권은 시드틱에 있으며, 무단 스크래핑 또는 상업적 재배포는 엄격히 금지됩니다.</li>
            </ul>
          </section>

          {/* 3. 유료 멤버십 및 결제/환불 정책 */}
          <section>
            <h2 className="text-base sm:text-lg font-bold text-[#0f172a] flex items-center gap-2 mb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">03</span>
              유료 멤버십 (Pro Tier) 및 결제 정책
            </h2>
            <ul className="list-disc list-inside pl-1 text-[#64748b] space-y-1.5 text-xs">
              <li><strong>구독 결제:</strong> Pro 멤버십은 월간 또는 연간 단위의 정기결제(구독) 방식으로 제공되며, 등록된 결제 수단으로 결제 주기에 맞춰 자동 갱신 청구됩니다.</li>
              <li><strong>구독 해지:</strong> 회원은 언제든지 서비스 내 설정에서 자동 결제를 해지할 수 있습니다. 결제 후 7일 이내 해지 시 사용일수(최소 1일분) 제외 부분환불 후 Pro 이용이 즉시 종료되며, 7일 이후 해지 시 환불 없이 다음 회차 자동결제만 중단되고 이미 결제된 이용 기간 종료일까지 Pro 혜택이 유지됩니다.</li>
              <li><strong>환불 규정:</strong> 결제 후 7일 이내 해지 시 사용한 일수에 해당하는 이용료를 공제한 잔여 금액이 일할 계산되어 부분환불됩니다. 결제 후 7일이 경과한 이후에는 환불 없이 정기구독(자동갱신)만 취소되며, 만료일까지 서비스를 정상 이용하실 수 있습니다.</li>
            </ul>
          </section>

          {/* 4. 문의처 */}
          <section className="border-t border-[#e2e8f0] pt-6">
            <h2 className="text-base sm:text-lg font-bold text-[#0f172a] flex items-center gap-2 mb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">04</span>
              고객지원 및 문의처
            </h2>
            <div className="p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg text-xs space-y-1 font-mono">
              <div className="text-[#0f172a] font-bold">Reportist Research 고객지원</div>
              <div className="text-[#64748b]">이메일 문의: <a href="mailto:younginpiniti@gmail.com" className="text-blue-600 underline">younginpiniti@gmail.com</a></div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
