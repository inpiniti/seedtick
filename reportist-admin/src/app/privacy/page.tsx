import React from "react";
import Link from "next/link";
import { ArrowLeft, Shield, Lock, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침 · Reportist Research",
  description: "Reportist 서비스의 개인정보처리방침입니다. 구글 로그인 및 수집 정보 보호 정책을 확인하세요.",
};

export default function PrivacyPolicyPage() {
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
              href="/terms"
              className="text-xs font-mono px-2.5 py-1 rounded-md text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition-colors"
            >
              서비스 이용약관 ➔
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-10 sm:pt-14">
        {/* 헤더 섹션 */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-[#cbd5e1] text-[#64748b] text-[11px] font-mono mb-3">
            <Shield className="w-3.5 h-3.5 text-[#0f172a]" />
            <span>PRIVACY POLICY · LEGAL NOTICE</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0f172a] tracking-tight">
            개인정보처리방침
          </h1>
          <p className="mt-2 text-[#64748b] text-xs sm:text-sm font-mono leading-relaxed">
            시드틱(Reportist)은 이용자의 소중한 개인정보를 안전하게 보호하며, 관련 법령 및 구글 사용자 데이터 정책을 철저히 준수합니다.
          </p>
          <div className="mt-4 flex items-center gap-3 text-[11px] font-mono text-[#94a3b8] border-b border-[#e2e8f0] pb-4">
            <span>시행일자: 2026년 10월 14일</span>
            <span>·</span>
            <span>최종 변경일자: 2026년 10월 14일</span>
          </div>
        </div>

        {/* 본문 카드 */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 sm:p-8 shadow-xs space-y-8 text-sm leading-relaxed text-[#334155]">
          {/* 1. 총칙 */}
          <section>
            <h2 className="text-base sm:text-lg font-bold text-[#0f172a] flex items-center gap-2 mb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">01</span>
              총칙
            </h2>
            <p>
              시드틱(이하 &quot;서비스&quot;)은 정보통신망 이용촉진 및 정보보호 등에 관한 법률, 개인정보보호법 등 관련 법령상의 개인정보보호 규정을 준수합니다. 본 방침은 이용자가 제공하는 개인정보가 어떠한 용도와 방식으로 이용되고 있으며, 개인정보보호를 위해 어떠한 조치가 취해지고 있는지 알려드립니다.
            </p>
          </section>

          {/* 2. 수집하는 개인정보 항목 및 수집 방법 */}
          <section>
            <h2 className="text-base sm:text-lg font-bold text-[#0f172a] flex items-center gap-2 mb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">02</span>
              수집하는 개인정보 항목 및 수집 방법
            </h2>
            <div className="space-y-3">
              <p>서비스는 회원가입 및 원활한 서비스 제공을 위해 최소한의 개인정보만을 수집합니다.</p>
              <div className="bg-[#f8fafc] rounded-lg p-4 border border-[#e2e8f0] space-y-2 text-xs">
                <div className="font-semibold text-[#0f172a] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Google 소셜 로그인 (OAuth) 이용 시:
                </div>
                <ul className="list-disc list-inside pl-1 text-[#64748b] space-y-1">
                  <li><strong>필수 항목:</strong> Google 계정 이메일 주소, 이름(프로필명), 프로필 사진 URL, 고유 계정 식별자(ID)</li>
                  <li><strong>수집 목적:</strong> 회원 식별, 로그인 인증 상태 유지, 서비스 알림 및 계정 관리</li>
                </ul>
              </div>

              <div className="bg-[#f8fafc] rounded-lg p-4 border border-[#e2e8f0] space-y-2 text-xs">
                <div className="font-semibold text-[#0f172a] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  유료 구독(Pro 멤버십) 결제 시:
                </div>
                <ul className="list-disc list-inside pl-1 text-[#64748b] space-y-1">
                  <li><strong>수집 항목:</strong> 주문자명, 결제 승인 고유 식별자(빌링키 ID, 결제 ID), 결제 일시, 구독 내역</li>
                  <li><strong>안내:</strong> 카드번호, 유효기간, CVC 등 민감 금융 정보는 결제 대행사(포트원 및 금융 PG사)를 통해 직접 암호화 처리되며, 서비스 데이터베이스에는 절대 저장되지 않습니다.</li>
                </ul>
              </div>

              <div className="bg-[#f8fafc] rounded-lg p-4 border border-[#e2e8f0] space-y-2 text-xs">
                <div className="font-semibold text-[#0f172a] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  서비스 이용 과정에서 자동 수집되는 항목:
                </div>
                <p className="text-[#64748b]">접속 IP 주소, 브라우저 정보, 방문 일시, 서비스 이용 및 오류 로그</p>
              </div>
            </div>
          </section>

          {/* 3. Google API 및 사용자 데이터 보호 정책 준수 */}
          <section className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h2 className="text-sm font-bold text-[#0f172a] flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-blue-600" />
              Google 사용자 데이터 정책 및 제한적 사용 준수
            </h2>
            <p className="text-xs text-[#475569] leading-relaxed">
              시드틱이 Google API를 통해 획득한 정보의 사용 및 다른 앱으로의 이전은 <strong>Google API 서비스 사용자 데이터 정책(Google API Services User Data Policy)</strong> 및 제한적 사용 요건(Limited Use Requirements)을 엄격히 준수합니다. 당사는 사용자의 명시적인 동의 없이 Google 사용자 데이터를 제3자 광고에 활용하거나 타인에게 무단 판매하지 않습니다.
            </p>
          </section>

          {/* 4. 개인정보의 보유 및 파기 기간 */}
          <section>
            <h2 className="text-base sm:text-lg font-bold text-[#0f172a] flex items-center gap-2 mb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">03</span>
              개인정보의 보유 및 이용 기간
            </h2>
            <p>
              원칙적으로 개인정보의 수집 및 이용 목적이 달성되면 해당 정보를 지체 없이 파기합니다. 단, 관계 법령의 규정에 따라 보존할 의무가 있는 경우 아래의 법정 기간 동안 안전하게 보관합니다.
            </p>
            <ul className="list-disc list-inside pl-2 mt-2 space-y-1 text-xs text-[#64748b]">
              <li><strong>계약 또는 청약철회 등에 관한 기록:</strong> 5년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
              <li><strong>대금결제 및 재화 등의 공급에 관한 기록:</strong> 5년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
              <li><strong>소비자의 불만 또는 분쟁처리에 관한 기록:</strong> 3년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
              <li><strong>웹사이트 접속 로그 기록:</strong> 3개월 (통신비밀보호법)</li>
            </ul>
          </section>

          {/* 5. 개인정보의 처리 위탁 및 국외 이전 */}
          <section>
            <h2 className="text-base sm:text-lg font-bold text-[#0f172a] flex items-center gap-2 mb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">04</span>
              개인정보의 처리 위탁
            </h2>
            <p>서비스는 원활한 기능 수행과 안정적인 인프라를 위해 아래 전문 업체에 개인정보 처리를 위탁하고 있습니다.</p>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-xs text-left border-collapse border border-[#e2e8f0]">
                <thead>
                  <tr className="bg-[#f8fafc] text-[#0f172a] font-semibold border-b border-[#e2e8f0]">
                    <th className="p-2.5 border-r border-[#e2e8f0]">수탁업체</th>
                    <th className="p-2.5 border-r border-[#e2e8f0]">위탁 업무 내용</th>
                    <th className="p-2.5">보유 및 이용 기간</th>
                  </tr>
                </thead>
                <tbody className="text-[#64748b]">
                  <tr className="border-b border-[#e2e8f0]">
                    <td className="p-2.5 border-r border-[#e2e8f0] font-medium text-[#0f172a]">Supabase, Inc.</td>
                    <td className="p-2.5 border-r border-[#e2e8f0]">클라우드 데이터베이스 인프라 및 인증 시스템 운영</td>
                    <td className="p-2.5">회원 탈퇴 시 또는 계약 종료 시까지</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 border-r border-[#e2e8f0] font-medium text-[#0f172a]">포트원 주식회사 (PortOne)</td>
                    <td className="p-2.5 border-r border-[#e2e8f0]">전자결제 대행 및 정기결제 빌링 서비스</td>
                    <td className="p-2.5">관계 법령에 명시된 보존 기간까지</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 6. 이용자의 권리와 행사 방법 */}
          <section>
            <h2 className="text-base sm:text-lg font-bold text-[#0f172a] flex items-center gap-2 mb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">05</span>
              이용자의 권리와 행사 방법
            </h2>
            <p>
              이용자는 언제든지 자신의 개인정보에 대해 열람, 수정, 삭제, 처리정지 및 회원 탈퇴(구글 계정 연동 해제)를 요청할 수 있습니다. Google 계정 보안 페이지(https://myaccount.google.com/permissions)에서 직접 시드틱에 대한 액세스 권한을 철회할 수도 있습니다.
            </p>
          </section>

          {/* 7. 개인정보 보호책임자 및 고객지원 */}
          <section className="border-t border-[#e2e8f0] pt-6">
            <h2 className="text-base sm:text-lg font-bold text-[#0f172a] flex items-center gap-2 mb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">06</span>
              개인정보 보호책임자 및 문의처
            </h2>
            <p>
              서비스 이용 중 발생하는 모든 개인정보보호 관련 민원, 문의, 열람 청구는 아래의 보호책임자에게 문의해 주시면 신속하게 답변해 드리겠습니다.
            </p>
            <div className="mt-3 p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg text-xs space-y-1 font-mono">
              <div className="text-[#0f172a] font-bold">Reportist Research 개인정보 보호책임자</div>
              <div className="text-[#64748b]">이메일 문의: <a href="mailto:younginpiniti@gmail.com" className="text-blue-600 underline">younginpiniti@gmail.com</a></div>
              <div className="text-[#64748b]">서비스명: Reportist (시드틱)</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
