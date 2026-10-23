import React from "react";
import Link from "next/link";
import { ArrowLeft, FileText, AlertCircle } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service · Reportist Research",
  description:
    "Terms of Service for Reportist Research platform. Review investment research disclaimers and Pro membership terms.",
  alternates: {
    canonical: "/en/terms",
    languages: {
      ko: "/terms",
      en: "/en/terms",
      "x-default": "/terms",
    },
  },
};

export default function EnglishTermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans pb-24">
      {/* Top minimal header */}
      <div className="bg-white border-b border-[#e2e8f0] sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/en"
            className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-[#64748b] hover:text-[#0f172a] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>REPORTIST RESEARCH HOME</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/en/privacy"
              className="text-xs font-mono px-2.5 py-1 rounded-md text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition-colors"
            >
              Privacy Policy ➔
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-10 sm:pt-14">
        {/* Header section */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-[#cbd5e1] text-[#64748b] text-[11px] font-mono mb-3">
            <FileText className="w-3.5 h-3.5 text-[#0f172a]" />
            <span>TERMS OF SERVICE · LEGAL NOTICE</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0f172a] tracking-tight">
            Terms of Service
          </h1>
          <p className="mt-2 text-[#64748b] text-xs sm:text-sm font-mono leading-relaxed">
            These terms govern the rights, obligations, and conditions for utilizing Reportist investment research, AI valuation models, and paid memberships.
          </p>
          <div className="mt-4 flex items-center gap-3 text-[11px] font-mono text-[#94a3b8] border-b border-[#e2e8f0] pb-4">
            <span>Effective Date: October 14, 2026</span>
            <span>·</span>
            <span>Last Updated: October 14, 2026</span>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 sm:p-8 shadow-xs space-y-8 text-sm leading-relaxed text-[#334155]">
          {/* Investment Disclaimer */}
          <section className="bg-amber-50/60 border border-amber-200/80 rounded-lg p-4">
            <h2 className="text-sm font-bold text-amber-900 flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              Investment Disclaimer & Notice (Important)
            </h2>
            <p className="text-xs text-amber-800/90 leading-relaxed">
              All valuation reports, 13-guru AI screening metrics, and intrinsic fair value bands provided by this Service are <strong>informational reference research materials</strong> derived from audited public financial disclosures and quantitative investment philosophy models. Nothing herein constitutes financial advice, solicitation, or a recommendation to buy or sell any security. All final investment decisions, outcomes, and liabilities remain solely with the user.
            </p>
          </section>

          {/* 1. Purpose */}
          <section>
            <h2 className="text-base sm:text-lg font-bold text-[#0f172a] flex items-center gap-2 mb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">01</span>
              Purpose
            </h2>
            <p>
              The purpose of these Terms of Service is to define the rights, responsibilities, and operational conditions between Reportist (hereinafter &quot;the Service&quot;) and members regarding the use of AI equity valuation and in-depth research platforms.
            </p>
          </section>

          {/* 2. Account & Usage */}
          <section>
            <h2 className="text-base sm:text-lg font-bold text-[#0f172a] flex items-center gap-2 mb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">02</span>
              Account and Service Usage
            </h2>
            <ul className="list-disc list-inside pl-1 text-[#64748b] space-y-1.5 text-xs">
              <li>Users may sign up and authenticate securely using Google Social Login (OAuth).</li>
              <li>Members must not transfer or lease their account credentials to third parties and bear responsibility for maintaining account security.</li>
              <li>All intellectual property rights pertaining to data, analytical models, and reports generated by the Service belong to Reportist. Unauthorized web scraping or commercial redistribution is strictly prohibited.</li>
            </ul>
          </section>

          {/* 3. Pro Membership & Billing */}
          <section>
            <h2 className="text-base sm:text-lg font-bold text-[#0f172a] flex items-center gap-2 mb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">03</span>
              Paid Membership (Pro Tier) & Billing Policies
            </h2>
            <ul className="list-disc list-inside pl-1 text-[#64748b] space-y-1.5 text-xs">
              <li><strong>Subscription Billing:</strong> Pro Tier memberships operate on a recurring billing cycle (monthly or annual). Charges are automatically processed at the beginning of each cycle using the registered payment method.</li>
              <li><strong>Cancellation:</strong> Members may cancel recurring billing anytime in Account Settings. Cancellations submitted within 7 days of initial billing qualify for a prorated partial refund (deducting at least 1 day of usage), terminating Pro access immediately. Cancellations after 7 days will prevent future renewals, retaining active Pro benefits until the end of the current paid billing period.</li>
              <li><strong>Refund Policy:</strong> If requested within 7 days, the remaining amount is refunded prorated per day utilized. After 7 days, no refunds are issued, but service continues until expiration.</li>
            </ul>
          </section>

          {/* 4. Support Contact */}
          <section className="border-t border-[#e2e8f0] pt-6">
            <h2 className="text-base sm:text-lg font-bold text-[#0f172a] flex items-center gap-2 mb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">04</span>
              Customer Support & Inquiries
            </h2>
            <div className="p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg text-xs space-y-1 font-mono">
              <div className="text-[#0f172a] font-bold">Reportist Research Customer Support</div>
              <div className="text-[#64748b]">Email: <a href="mailto:younginpiniti@gmail.com" className="text-blue-600 underline">younginpiniti@gmail.com</a></div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
