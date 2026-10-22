import { Suspense } from "react";
import { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";

export const metadata: Metadata = {
  title: "Real-time Stock Screener · Reportist",
  description:
    "Real-time equity screener filtering US and global stocks that pass the quantitative criteria of 13 legendary value investors like Warren Buffett and Peter Lynch.",
  alternates: {
    canonical: "/en/screener",
    languages: {
      ko: "/screener",
      en: "/en/screener",
      "x-default": "/screener",
    },
  },
  openGraph: {
    title: "Real-time Stock Screener · Reportist",
    description:
      "Discovery candidate stocks and Superinvestor portfolio holdings filtered by 13 guru criteria.",
    locale: "en_US",
  },
};

interface ScreenerPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function EnglishScreenerPage({ searchParams }: ScreenerPageProps) {
  const params = await searchParams;
  const isRoma = params?.tab === "roma";

  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <DashboardView initialSection={isRoma ? "sec-roma" : "sec-screener"} lang="en" />
    </Suspense>
  );
}
