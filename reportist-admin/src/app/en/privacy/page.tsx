import React from "react";
import Link from "next/link";
import { ArrowLeft, Shield, Lock, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy · Reportist Research",
  description:
    "Privacy Policy for Reportist Research platform. Learn about our Google OAuth user data protection and strict compliance policies.",
  alternates: {
    canonical: "/en/privacy",
    languages: {
      ko: "/privacy",
      en: "/en/privacy",
      "x-default": "/privacy",
    },
  },
};

export default function EnglishPrivacyPolicyPage() {
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
              href="/en/terms"
              className="text-xs font-mono px-2.5 py-1 rounded-md text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] transition-colors"
            >
              Terms of Service ➔
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-10 sm:pt-14">
        {/* Header section */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-[#cbd5e1] text-[#64748b] text-[11px] font-mono mb-3">
            <Shield className="w-3.5 h-3.5 text-[#0f172a]" />
            <span>PRIVACY POLICY · LEGAL NOTICE</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0f172a] tracking-tight">
            Privacy Policy
          </h1>
          <p className="mt-2 text-[#64748b] text-xs sm:text-sm font-mono leading-relaxed">
            Reportist safely protects users&apos; personal information and strictly complies with all applicable privacy laws and the Google API Services User Data Policy.
          </p>
          <div className="mt-4 flex items-center gap-3 text-[11px] font-mono text-[#94a3b8] border-b border-[#e2e8f0] pb-4">
            <span>Effective Date: October 14, 2026</span>
            <span>·</span>
            <span>Last Updated: October 14, 2026</span>
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 sm:p-8 shadow-xs space-y-8 text-sm leading-relaxed text-[#334155]">
          {/* 1. General Principles */}
          <section>
            <h2 className="text-base sm:text-lg font-bold text-[#0f172a] flex items-center gap-2 mb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">01</span>
              General Principles
            </h2>
            <p>
              Reportist (hereinafter &quot;the Service&quot;) values your privacy and complies with all relevant privacy and data protection regulations. This Privacy Policy informs you about how the personal data provided by users is collected, used, processed, and safeguarded.
            </p>
          </section>

          {/* 2. Collected Items & Methods */}
          <section>
            <h2 className="text-base sm:text-lg font-bold text-[#0f172a] flex items-center gap-2 mb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">02</span>
              Information Collected and Collection Methods
            </h2>
            <div className="space-y-3">
              <p>The Service collects only the minimum personal information necessary to provide account services and research features.</p>
              <div className="bg-[#f8fafc] rounded-lg p-4 border border-[#e2e8f0] space-y-2 text-xs">
                <div className="font-semibold text-[#0f172a] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  When using Google Social Login (OAuth):
                </div>
                <ul className="list-disc list-inside pl-1 text-[#64748b] space-y-1">
                  <li><strong>Required Items:</strong> Google account email address, name (profile display name), profile picture URL, unique user ID.</li>
                  <li><strong>Purpose:</strong> Member identification, maintaining authentication sessions, service alerts, and account management.</li>
                </ul>
              </div>

              <div className="bg-[#f8fafc] rounded-lg p-4 border border-[#e2e8f0] space-y-2 text-xs">
                <div className="font-semibold text-[#0f172a] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  When subscribing to Paid Membership (Pro Tier):
                </div>
                <ul className="list-disc list-inside pl-1 text-[#64748b] space-y-1">
                  <li><strong>Items Collected:</strong> Customer name, unique payment authorization token (billing key ID, transaction ID), timestamp, subscription history.</li>
                  <li><strong>Notice:</strong> Sensitive financial data (e.g., credit card numbers, expiry dates, CVC) is encrypted and processed directly by licensed payment gateway providers (PortOne and partner financial PGs) and is never stored on our database.</li>
                </ul>
              </div>

              <div className="bg-[#f8fafc] rounded-lg p-4 border border-[#e2e8f0] space-y-2 text-xs">
                <div className="font-semibold text-[#0f172a] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Automatically collected during service usage:
                </div>
                <p className="text-[#64748b]">IP address, browser specification, access timestamps, feature usage, and error diagnostics.</p>
              </div>
            </div>
          </section>

          {/* 3. Google API User Data Policy */}
          <section className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h2 className="text-sm font-bold text-[#0f172a] flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-blue-600" />
              Compliance with Google API Services User Data Policy
            </h2>
            <p className="text-xs text-[#475569] leading-relaxed">
              Reportist&apos;s use and transfer to any other app of information received from Google APIs will adhere to the <strong>Google API Services User Data Policy</strong>, including the Limited Use requirements. We do not use Google user data for third-party advertisements or sell user data to any external parties without explicit consent.
            </p>
          </section>

          {/* 4. Retention & Deletion */}
          <section>
            <h2 className="text-base sm:text-lg font-bold text-[#0f172a] flex items-center gap-2 mb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">03</span>
              Retention and Deletion of Personal Data
            </h2>
            <p>
              In principle, user personal data is promptly deleted when the purpose of collection and use is fulfilled. However, records required to be retained under applicable statutory laws are safely preserved for the prescribed period.
            </p>
            <ul className="list-disc list-inside pl-2 mt-2 space-y-1 text-xs text-[#64748b]">
              <li><strong>Records on contracts or subscription cancellations:</strong> 5 years</li>
              <li><strong>Records on payment settlement and financial supply:</strong> 5 years</li>
              <li><strong>Records on customer inquiries and dispute resolution:</strong> 3 years</li>
              <li><strong>Website access log history:</strong> 3 months</li>
            </ul>
          </section>

          {/* 5. Data Entrustment */}
          <section>
            <h2 className="text-base sm:text-lg font-bold text-[#0f172a] flex items-center gap-2 mb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">04</span>
              Third-Party Data Processing Entrustment
            </h2>
            <p>To ensure secure infrastructure and continuous service availability, data processing is entrusted to the specialized service providers below:</p>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-xs text-left border-collapse border border-[#e2e8f0]">
                <thead>
                  <tr className="bg-[#f8fafc] text-[#0f172a] font-semibold border-b border-[#e2e8f0]">
                    <th className="p-2.5 border-r border-[#e2e8f0]">Entity</th>
                    <th className="p-2.5 border-r border-[#e2e8f0]">Scope of Work</th>
                    <th className="p-2.5">Retention Period</th>
                  </tr>
                </thead>
                <tbody className="text-[#64748b]">
                  <tr className="border-b border-[#e2e8f0]">
                    <td className="p-2.5 border-r border-[#e2e8f0] font-medium text-[#0f172a]">Supabase, Inc.</td>
                    <td className="p-2.5 border-r border-[#e2e8f0]">Cloud database infrastructure & authentication services</td>
                    <td className="p-2.5">Until account deletion or contract termination</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 border-r border-[#e2e8f0] font-medium text-[#0f172a]">PortOne Co., Ltd.</td>
                    <td className="p-2.5 border-r border-[#e2e8f0]">Electronic payment gateway & recurring subscription billing</td>
                    <td className="p-2.5">Until statutory retention period expires</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 6. User Rights */}
          <section>
            <h2 className="text-base sm:text-lg font-bold text-[#0f172a] flex items-center gap-2 mb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">05</span>
              User Rights and How to Exercise Them
            </h2>
            <p>
              Users may inspect, correct, delete, or suspend the processing of their personal data at any time, or request account withdrawal. You may also directly revoke Reportist&apos;s access permissions at Google Account Security (https://myaccount.google.com/permissions).
            </p>
          </section>

          {/* 7. Privacy Officer */}
          <section className="border-t border-[#e2e8f0] pt-6">
            <h2 className="text-base sm:text-lg font-bold text-[#0f172a] flex items-center gap-2 mb-3">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#f1f5f9] text-[#64748b]">06</span>
              Privacy Officer and Support Contact
            </h2>
            <p>
              For any questions, requests, or grievances regarding personal data protection, please contact our Data Protection Officer below:
            </p>
            <div className="mt-3 p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg text-xs space-y-1 font-mono">
              <div className="text-[#0f172a] font-bold">Reportist Research Privacy Officer</div>
              <div className="text-[#64748b]">Email: <a href="mailto:younginpiniti@gmail.com" className="text-blue-600 underline">younginpiniti@gmail.com</a></div>
              <div className="text-[#64748b]">Service Name: Reportist</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
