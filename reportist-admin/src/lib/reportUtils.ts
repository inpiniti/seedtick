import type { GuruReportRow } from "@/types/api";

/**
 * 분석 일자 목록(내림차순 정렬)에서 선택된 일자의 직전 분석 일자를 반환합니다.
 * 달력상의 단순 D-1일이 아닌, 실제 리포트가 존재하는 직전 영업일/분석일을 정확히 찾습니다.
 *
 * @param selectedDate 선택된 분석 일자 (예: "2026-10-21")
 * @param availableDates 분석 일자 배열 (최신순 내림차순, 예: ["2026-10-21", "2026-10-20", ...])
 * @returns 직전 분석 일자 (없거나 ALL이면 undefined)
 */
export function getPreviousAvailableDate(
  selectedDate?: string,
  availableDates: string[] = []
): string | undefined {
  if (!selectedDate || selectedDate === "ALL" || !Array.isArray(availableDates) || availableDates.length <= 1) {
    return undefined;
  }

  const currentIndex = availableDates.indexOf(selectedDate);
  if (currentIndex === -1) {
    return undefined;
  }

  const nextIndex = currentIndex + 1;
  if (nextIndex < availableDates.length) {
    return availableDates[nextIndex];
  }

  return undefined;
}

/**
 * 여러 날짜가 섞인 리포트 목록에서 동일 종목코드(ticker)가 존재할 경우,
 * 가장 최신 날짜(d 내림차순)의 리포트 1건만 남기고 중복을 제거합니다.
 *
 * - ticker는 대소문자 구분 없이 식별합니다.
 * - 이미 더 최신 날짜의 동일 종목이 등록된 경우 이전 날짜의 종목은 제외됩니다.
 *
 * @param reports 원본 리포트 배열
 * @returns 중복 종목이 최신 일자 우선으로 정제된 리포트 배열
 */
export function deduplicateReportsByLatestDate(
  reports: GuruReportRow[] = []
): GuruReportRow[] {
  if (!Array.isArray(reports) || reports.length <= 1) {
    return reports || [];
  }

  // 1. 날짜 내림차순(최신순)으로 1차 정렬된 복사본 준비 (동일 일자 내에서는 기존 순서 유지)
  const sorted = [...reports].sort((a, b) => {
    const dateComp = (b.d || "").localeCompare(a.d || "");
    if (dateComp !== 0) return dateComp;
    return 0;
  });

  // 2. 최신 일자부터 순회하면서 첫 출현 ticker만 보존
  const seenTickers = new Set<string>();
  const deduped: GuruReportRow[] = [];

  for (const report of sorted) {
    if (!report || !report.ticker) continue;
    const tickerKey = report.ticker.trim().toUpperCase();
    if (!seenTickers.has(tickerKey)) {
      seenTickers.add(tickerKey);
      deduped.push(report);
    }
  }

  return deduped;
}
