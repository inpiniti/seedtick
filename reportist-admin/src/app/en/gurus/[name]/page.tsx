import { Suspense } from "react";
import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { GURU_PERSONAS } from "@/lib/guruPersonas";

interface GuruDetailPageProps {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ from?: string }>;
}

export async function generateMetadata({ params }: GuruDetailPageProps): Promise<Metadata> {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  const persona = GURU_PERSONAS[decodedName];

  const guruTitle = persona ? persona.englishName || persona.name : decodedName;
  const title = `${guruTitle} Investment Philosophy & Valuation Guide | Reportist`;
  const description = persona
    ? `${persona.englishName}'s investment philosophy, avoid list, and core quantitative valuation factors.`
    : `${decodedName} investment philosophy analysis guide`;

  return {
    title,
    description,
    alternates: {
      canonical: `/en/gurus/${encodeURIComponent(decodedName)}`,
      languages: {
        ko: `/gurus/${encodeURIComponent(decodedName)}`,
        en: `/en/gurus/${encodeURIComponent(decodedName)}`,
        "x-default": `/gurus/${encodeURIComponent(decodedName)}`,
      },
    },
    openGraph: {
      title,
      description,
      type: "article",
      locale: "en_US",
    },
  };
}

export default async function EnglishGuruDetailPage({ params }: GuruDetailPageProps) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);

  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <DashboardView initialSection="sec-gurus" initialGuru={decodedName} lang="en" />
    </Suspense>
  );
}
