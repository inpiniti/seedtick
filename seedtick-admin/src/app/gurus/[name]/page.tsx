import { Suspense } from "react";
import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { GURU_PERSONAS } from "@/lib/guruPersonas";

interface GuruDetailPageProps {
  params: Promise<{ name: string }>;
}

export async function generateMetadata({ params }: GuruDetailPageProps): Promise<Metadata> {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  const persona = GURU_PERSONAS[decodedName];

  const guruTitle = persona ? persona.name : decodedName;
  const title = `${guruTitle} 투자 철학과 핵심 평가 지표 | SeedTick`;
  const description = persona
    ? `${persona.name}의 투자 철학(${persona.philosophy.slice(0, 80)}...), 회피 대상 및 주요 분석 팩터`
    : `${decodedName}의 투자 철학 분석 가이드`;

  return {
    title,
    description,
    alternates: {
      canonical: `/gurus/${encodeURIComponent(decodedName)}`,
    },
    openGraph: {
      title,
      description,
      type: "article",
    },
  };
}

export default async function GuruDetailPage({ params }: GuruDetailPageProps) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);

  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <DashboardView initialSection="sec-gurus" initialGuru={decodedName} />
    </Suspense>
  );
}
