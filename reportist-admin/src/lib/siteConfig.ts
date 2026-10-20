/**
 * 사이트 canonical 기준 URL 단일 소스 (Single Source of Truth)
 *
 * 배포 호스트는 www.reportist.kr 이 canonical 호스트다.
 * apex(reportist.kr)는 Vercel Domains 설정에서 www 로 308 리다이렉트된다.
 * 따라서 metadataBase · canonical · og:url · JSON-LD · sitemap · robots 가
 * 서로 다른 호스트를 쓰면 "canonical 이 리다이렉트 URL 을 가리키는" 상태가 된다.
 * 아래 SITE_URL 만 사용하도록 한다.
 */

const RAW_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.reportist.kr";

function normalizeSiteUrl(raw: string): string {
  let url = (raw || "").trim().replace(/\/+$/, "");
  if (!url) return "https://www.reportist.kr";
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  url = url.replace(/^http:\/\//i, "https://");
  // apex 는 www 로 308 리다이렉트되므로 canonical 은 www 로 통일한다.
  if (/^https:\/\/reportist\.kr$/i.test(url)) url = "https://www.reportist.kr";
  return url;
}

/** canonical 기준 사이트 URL (트레일링 슬래시 없음) */
export const SITE_URL = normalizeSiteUrl(RAW_SITE_URL);

/** canonical 절대 URL 생성 헬퍼 */
export function absoluteUrl(path: string): string {
  if (!path) return SITE_URL;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
