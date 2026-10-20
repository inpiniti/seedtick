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
} from "@/lib/tickerAliases";
import type { GuruReportRow } from "@/types/api";

export interface StockPageData {
  ticker: string;
  /** 마스킹된 공개 리포트 (없으면 null) */
  report: GuruReportRow | null;
  /** free 기준 허용 기본 일자 (DB에 30일 이전 행이 없을 때의 폴백) */
  allowedFreeDate: string | undefined;
  /** 요청한 일자가 비로그인에게 공개 열람 가능한지 */
  isPublicDate: boolean;
  /** 화면/SEO용 표시명 (예: "알파벳 A (구글)") */
  displayName: string;
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
 */
export async function getStockPageData(
  ticker: string,
  date?: string
): Promise<StockPageData> {
  const normTicker = (ticker || "").trim().toUpperCase();
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
  // 리포트가 없고 로고 테이블에도 없으면 존재하지 않는 티커다 (soft 404 방지)
  const isUnknownTicker = !report && !korean.exists;
  const displayName = getCompanyDisplayNameWithAlias(
    report?.company_name || koreanName || normTicker,
    normTicker
  );
  const seoKeywords = getSeoKeywordsForTicker(
    normTicker,
    report?.company_name || koreanName || normTicker
  );

  return {
    ticker: normTicker,
    report,
    allowedFreeDate,
    isPublicDate,
    displayName,
    seoKeywords,
    canonicalPath: `/stocks/${normTicker}`,
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
 * 1순위 guru_reports.company_name(예: 핀둬둬(ADR)), 2순위 ticker_logos.korean_name.
 * verdict·적정가 등 민감 컬럼은 절대 조회하지 않음.
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
