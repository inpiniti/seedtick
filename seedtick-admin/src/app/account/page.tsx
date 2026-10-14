"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Clock, CreditCard, Receipt } from "lucide-react";
import { useSubscription } from "@/lib/subscription/SubscriptionContext";
import { getRemainingDays, REFUND_WINDOW_DAYS } from "@/lib/subscription/subscriptionPolicy";
import { PRICING_PLANS } from "@/lib/subscription/types";

const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
    : "-";

const fmtWon = (n: number) => `${n.toLocaleString("ko-KR")}원`;

const STATUS_LABEL: Record<string, string> = {
  active: "이용 중",
  canceled: "해지 예약됨",
  expired: "만료됨",
  past_due: "결제 실패",
  paid: "결제 완료",
  refunded: "환불 완료",
  failed: "실패",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#f1f5f9] last:border-0">
      <span className="text-[#64748b]">{label}</span>
      <span className="text-[#0f172a] font-medium">{value}</span>
    </div>
  );
}

export default function AccountPage() {
  const {
    user,
    tier,
    isTrialActive,
    trialRemainingHours,
    subscription,
    payments,
    openAuthModal,
    openUpgradeModal,
    previewCancellation,
    cancelSubscription,
  } = useSubscription();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const isPro = tier === "pro";
  const isCanceled = subscription?.status === "canceled";
  const remainingDays = getRemainingDays(subscription?.currentPeriodEnd);
  const plan = subscription?.planType === "yearly" ? PRICING_PLANS.yearly : PRICING_PLANS.monthly;
  const lastCard = payments.find((p) => p.cardLast4)?.cardLast4;
  const decision = confirmOpen ? previewCancellation() : null;

  const handleCancel = async () => {
    setBusy(true);
    const res = await cancelSubscription();
    setBusy(false);
    setConfirmOpen(false);
    if (!res.success) {
      setToast(res.message || "해지하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } else if (res.decision?.mode === "refund") {
      setToast(`${fmtWon(res.decision.refundAmount)} 환불을 요청했어요. 카드사에 따라 3~7일 걸릴 수 있어요.`);
    } else {
      setToast(`자동결제를 해지했어요. ${fmtDate(subscription?.currentPeriodEnd)}까지는 PRO를 그대로 쓸 수 있어요.`);
    }
  };

  const tierLabel = isPro ? "PRO" : isTrialActive ? "1-DAY TRIAL" : "FREE";

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans pb-24">
      <div className="bg-white border-b border-[#e2e8f0]">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-[#64748b] hover:text-[#0f172a] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>SEEDTICK RESEARCH 홈으로</span>
          </Link>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#0f172a] text-white">
            {tierLabel}
          </span>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 pt-10 space-y-6 font-mono text-xs">
        <header>
          <p className="text-[10px] uppercase tracking-wider text-[#64748b] mb-1">MEMBER ACCOUNT</p>
          <h1 className="text-2xl font-bold tracking-tight font-sans">멤버십 관리</h1>
          {user && <p className="mt-1 text-[#64748b]">{user.email}</p>}
        </header>

        {!user ? (
          <section className="p-6 rounded-md bg-white border border-[#e2e8f0] text-center space-y-3">
            <p className="text-[#64748b]">로그인하면 멤버십 정보를 볼 수 있어요.</p>
            <button
              type="button"
              onClick={openAuthModal}
              className="px-4 py-2 rounded-md bg-[#0f172a] hover:bg-slate-800 text-white font-medium cursor-pointer"
            >
              로그인하기
            </button>
          </section>
        ) : isPro && subscription ? (
          <>
            {/* 현재 플랜 */}
            <section className="rounded-md bg-white border border-[#e2e8f0]">
              <div className="p-5 border-b border-[#e2e8f0] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="font-semibold text-sm">PRO · {plan.name}</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] ${
                    isCanceled
                      ? "border border-[#cbd5e1] text-[#64748b]"
                      : "bg-[#0f172a] text-white"
                  }`}
                >
                  {STATUS_LABEL[subscription.status]}
                </span>
              </div>

              <div className="p-5 grid grid-cols-2 gap-4 border-b border-[#e2e8f0]">
                <div>
                  <p className="text-[#64748b] flex items-center gap-1.5"><Clock className="w-3 h-3" />남은 기간</p>
                  <p className="text-2xl font-bold mt-1 font-sans">{remainingDays}일</p>
                </div>
                <div>
                  <p className="text-[#64748b]">{isCanceled ? "이용 종료일" : "다음 결제일"}</p>
                  <p className="text-2xl font-bold mt-1 font-sans">{fmtDate(subscription.currentPeriodEnd)}</p>
                </div>
              </div>

              <div className="px-5 py-2">
                <Row label="요금" value={`${fmtWon(plan.price)} ${plan.periodLabel}`} />
                <Row
                  label="결제 수단"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <CreditCard className="w-3 h-3" />
                      {isCanceled ? "등록 해제됨" : lastCard ? `카드 **** ${lastCard}` : "등록된 카드"}
                    </span>
                  }
                />
                <Row label="구독 시작일" value={fmtDate(subscription.currentPeriodStart)} />
              </div>
            </section>

            {/* 결제 내역 */}
            <section className="rounded-md bg-white border border-[#e2e8f0]">
              <div className="p-5 border-b border-[#e2e8f0] flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                <h2 className="font-semibold text-sm">결제 내역</h2>
              </div>
              <PaymentTable payments={payments} />
            </section>

            {/* 해지 */}
            {!isCanceled && (
              <section className="p-5 rounded-md bg-white border border-[#e2e8f0] flex items-center justify-between gap-4">
                <p className="text-[#64748b] leading-relaxed">
                  결제 후 {REFUND_WINDOW_DAYS}일 안에 해지하면 전액 환불돼요.
                  <br className="hidden sm:block" /> 그 이후엔 다음 결제만 멈추고, 남은 기간은 그대로 쓸 수 있어요.
                </p>
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  className="shrink-0 px-3 py-2 rounded-md border border-[#cbd5e1] text-[#64748b] hover:text-[#0f172a] hover:border-[#0f172a] transition-colors cursor-pointer"
                >
                  구독 해지
                </button>
              </section>
            )}
          </>
        ) : (
          /* 트라이얼 / FREE */
          <section className="rounded-md bg-white border border-[#e2e8f0] p-6 space-y-4">
            {isTrialActive ? (
              <div>
                <p className="text-[#64748b] flex items-center gap-1.5"><Clock className="w-3 h-3" />무료 체험 남은 시간</p>
                <p className="text-3xl font-bold mt-1 font-sans">{trialRemainingHours}시간</p>
                <p className="mt-2 text-[#64748b]">체험이 끝나도 계속 최신 리포트를 보려면 PRO를 시작해 주세요.</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold font-sans">FREE 이용 중</p>
                <p className="mt-1 text-[#64748b]">30일이 지난 리포트만 볼 수 있어요. PRO로 최신 리포트를 바로 받아보세요.</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => openUpgradeModal()}
              className="w-full py-2.5 rounded-md bg-[#0f172a] hover:bg-slate-800 text-white font-medium cursor-pointer"
            >
              PRO 시작하기 · 월 {fmtWon(PRICING_PLANS.monthly.price)}
            </button>
            {payments.length > 0 && (
              <div className="pt-2">
                <h2 className="font-semibold mb-2">지난 결제 내역</h2>
                <PaymentTable payments={payments} />
              </div>
            )}
          </section>
        )}
      </main>

      {/* 해지 확인 바텀시트/모달 */}
      {confirmOpen && decision && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => !busy && setConfirmOpen(false)}>
          <div
            className="w-full sm:max-w-sm bg-white rounded-t-xl sm:rounded-md p-5 font-mono text-xs space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold font-sans">정말 해지할까요?</h3>
            {decision.mode === "refund" ? (
              <p className="text-[#64748b] leading-relaxed">
                결제 후 {REFUND_WINDOW_DAYS}일이 지나지 않아 <strong className="text-[#0f172a]">{fmtWon(decision.refundAmount)} 전액 환불</strong>돼요.
                환불과 함께 PRO 이용이 바로 끝나요.
              </p>
            ) : (
              <p className="text-[#64748b] leading-relaxed">
                다음 결제가 멈추고, <strong className="text-[#0f172a]">{fmtDate(subscription?.currentPeriodEnd)}</strong>까지는 PRO를 그대로 쓸 수 있어요.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmOpen(false)}
                className="py-2.5 rounded-md bg-[#0f172a] text-white font-medium cursor-pointer disabled:opacity-50"
              >
                계속 이용하기
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleCancel}
                className="py-2.5 rounded-md border border-[#cbd5e1] text-[#64748b] cursor-pointer disabled:opacity-50"
              >
                {busy ? "처리 중..." : decision.mode === "refund" ? "환불하고 해지" : "해지하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          onClick={() => setToast(null)}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-md bg-[#0f172a] text-white text-xs font-mono shadow-lg max-w-[90vw] cursor-pointer"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function PaymentTable({ payments }: { payments: ReturnType<typeof useSubscription>["payments"] }) {
  if (payments.length === 0) {
    return <p className="p-5 text-[#94a3b8]">아직 결제 내역이 없어요.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="text-[10px] uppercase tracking-wider text-[#94a3b8]">
          <tr>
            <th className="px-5 py-2 font-medium">일자</th>
            <th className="px-5 py-2 font-medium">플랜</th>
            <th className="px-5 py-2 font-medium text-right">금액</th>
            <th className="px-5 py-2 font-medium">상태</th>
            <th className="px-5 py-2 font-medium">영수증</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id} className="border-t border-[#f1f5f9]">
              <td className="px-5 py-2.5">{fmtDate(p.paidAt)}</td>
              <td className="px-5 py-2.5">{p.planType === "yearly" ? "연간" : "월간"}</td>
              <td className={`px-5 py-2.5 text-right ${p.status === "refunded" ? "line-through text-[#94a3b8]" : ""}`}>
                {fmtWon(p.amount)}
              </td>
              <td className="px-5 py-2.5">
                <span className={p.status === "paid" ? "text-[#0f172a]" : "text-[#94a3b8]"}>
                  {STATUS_LABEL[p.status]}
                </span>
              </td>
              <td className="px-5 py-2.5">
                {p.receiptUrl ? (
                  <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    보기
                  </a>
                ) : (
                  <span className="text-[#cbd5e1]">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
