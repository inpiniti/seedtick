/**
 * 종목 상세 페이지 서버 데이터 헬퍼.
 * - /stocks/[ticker] 와 /stocks/[ticker]/[date] 두 라우트가 공유한다.
 * - 공개(비로그인) 기준으로만 마스킹하며, 서버 API와 동일한 free 폴백 규칙을 따른다.
 */

import { getServerSupabaseClient } from "@/lib/subscription/supabaseServer";
import { isReportRestricted } from "@/lib/subscription/subscriptionPolicy";
import { getServerFreeDate, getPublicReportForDate, getTickerReportDates } from "@/lib/server/publicCatalog";
import {
  getCompanyDisplayNameWithAlias,
  getSeoKeywordsForTicker,
  getEnglishCompanyName,
  getEnglishSeoKeywordsForTicker,
} from "@/lib/tickerAliases";
import type { GuruReportRow } from "@/types/api";

export interface StockPageData {
  ticker: string;
  /** 현재 언어 설정 ('ko' | 'en') */
  lang: "ko" | "en";
  /** 마스킹된 공개 리포트 (없으면 null) */
  report: GuruReportRow | null;
  /** free 기준 허용 기본 일자 (DB에 30일 이전 행이 없을 때의 폴백) */
  allowedFreeDate: string | undefined;
  /** 요청한 일자가 비로그인에게 공개 열람 가능한지 */
  isPublicDate: boolean;
  /** 화면/SEO용 표시명 (한국어: 예 "알파벳 A (구글)", 영어: 예 "Alphabet Inc. (Google)") */
  displayName: string;
  /** 영문 종목명 */
  englishName: string;
  /** SEO 키워드 */
  seoKeywords: string[];
  /** canonical 경로 */
  canonicalPath: string;
  /** 발행일 (YYYY-MM-DD) */
  publishedDate: string;
  /** 현재가 */
  currentPrice: number | null;
  /** 한글 종목명 (ticker_logos 기준) */
  koreanName: string;
  /** 해당 티커의 발행 일자 목록 (최신순) — "분석 이력" 링크용 */
  availableDates: string[];
  /** 존재하지 않는 티커인지 (404 처리용) */
  isUnknownTicker: boolean;
}

/**
 * 종목 상세 페이지를 위한 공개 데이터를 조회한다.
 * @param ticker 티커
 * @param date  특정 분석일자 (없으면 최신 리포트)
 * @param lang  언어 ('ko' | 'en')
 */
export async function getStockPageData(
  ticker: string,
  date?: string,
  lang: "ko" | "en" = "ko"
): Promise<StockPageData> {
  const normTicker = (ticker || "").trim().toUpperCase();
  const isValidPattern = /^[A-Z0-9.]{1,10}$/.test(normTicker);
  if (!isValidPattern) {
    return {
      ticker: normTicker,
      lang,
      report: null,
      allowedFreeDate: undefined,
      isPublicDate: false,
      displayName: normTicker,
      englishName: normTicker,
      seoKeywords: [],
      canonicalPath: lang === "en" ? `/en/stocks/${encodeURIComponent(normTicker)}` : `/stocks/${encodeURIComponent(normTicker)}`,
      publishedDate: "",
      currentPrice: null,
      koreanName: normTicker,
      availableDates: [],
      isUnknownTicker: true,
    };
  }

  const allowedFreeDate = await getServerFreeDate();

  const report = normTicker
    ? await getPublicReportForDate(normTicker, date, allowedFreeDate)
    : null;

  const availableDates = normTicker ? await getTickerReportDates(normTicker) : [];

  const resolvedDate = report?.d || date || "";
  const isPublicDate = resolvedDate
    ? !isReportRestricted(resolvedDate, "free", new Date(), allowedFreeDate, false)
    : false;

  const korean = await resolveKoreanName(normTicker, report?.company_name || "");
  const koreanName = korean.name;
  const english = await resolveEnglishName(
    normTicker,
    report?.company_name_en || ""
  );
  const englishName = english.name;

  // 리포트가 없고 로고 테이블에도 없으면 존재하지 않는 티커다 (soft 404 방지)
  const isUnknownTicker = !report && !korean.exists && !english.exists;

  const isEn = lang === "en";
  const displayName = isEn
    ? englishName || normTicker
    : getCompanyDisplayNameWithAlias(
        report?.company_name || koreanName || normTicker,
        normTicker
      );

  const seoKeywords = isEn
    ? getEnglishSeoKeywordsForTicker(normTicker, englishName)
    : getSeoKeywordsForTicker(
        normTicker,
        report?.company_name || koreanName || normTicker
      );

  const basePath = isEn ? `/en/stocks/${normTicker}` : `/stocks/${normTicker}`;

  return {
    ticker: normTicker,
    lang,
    report,
    allowedFreeDate,
    isPublicDate,
    displayName,
    englishName: englishName || normTicker,
    seoKeywords,
    canonicalPath: basePath,
    publishedDate: resolvedDate,
    currentPrice:
      typeof report?.current_price === "number" ? report.current_price : null,
    koreanName: koreanName || normTicker,
    availableDates,
    isUnknownTicker,
  };
}

/**
 * 종목 한글명 조회 (비민감 공개 데이터만 사용).
 */
async function resolveKoreanName(
  ticker: string,
  reportCompanyName: string
): Promise<{ name: string; exists: boolean }> {
  if (reportCompanyName) return { name: reportCompanyName, exists: true };
  if (!ticker) return { name: ticker, exists: false };
  const supabase = getServerSupabaseClient();
  if (!supabase) return { name: ticker, exists: false };
  try {
    const { data } = await supabase
      .from("ticker_logos")
      .select("korean_name")
      .eq("ticker", ticker)
      .maybeSingle();
    const ko = ((data as { korean_name?: string } | null)?.korean_name || "").trim();
    return { name: ko || ticker, exists: Boolean(data) };
  } catch {
    return { name: ticker, exists: false };
  }
}

/**
 * 종목 영문명 조회 (비민감 공개 데이터 및 사전 매핑 사용).
 */
async function resolveEnglishName(
  ticker: string,
  reportCompanyNameEn: string
): Promise<{ name: string; exists: boolean }> {
  if (reportCompanyNameEn) return { name: reportCompanyNameEn, exists: true };
  if (!ticker) return { name: ticker, exists: false };

  // 1. tickerAliases 사전 확인
  const presetEnglish = getEnglishCompanyName(ticker, "");
  if (presetEnglish && presetEnglish !== ticker) {
    return { name: presetEnglish, exists: true };
  }

  // 2. ticker_logos 테이블의 english_name 확인
  const supabase = getServerSupabaseClient();
  if (!supabase) return { name: presetEnglish || ticker, exists: false };
  try {
    const { data } = await supabase
      .from("ticker_logos")
      .select("english_name")
      .eq("ticker", ticker)
      .maybeSingle();
    const en = ((data as { english_name?: string } | null)?.english_name || "").trim();
    return { name: en || presetEnglish || ticker, exists: Boolean(data) };
  } catch {
    return { name: presetEnglish || ticker, exists: false };
  }
}
