/**
 * 브라우저 URL 쿼리 파라미터 읽기 헬퍼.
 *
 * 왜 useSearchParams()를 쓰지 않는가:
 *  Next.js 공식 문서 — "If a route is prerendered, calling useSearchParams will
 *  cause the Client Component tree up to the closest Suspense boundary to be
 *  client-side rendered."
 *  즉 정적 프리렌더 라우트(/, /stocks, /gurus, /outcomes)에서 useSearchParams를
 *  쓰면 Suspense 경계가 통째로 CSR bail-out 되어 <body>에 텍스트가 하나도
 *  남지 않는다(검증: data-dgst="BAILOUT_TO_CLIENT_SIDE_RENDERING").
 *
 *  DashboardView가 searchParams를 쓰는 곳은 모두
 *   1) 마운트 시점 1회 계산 (useState 초기값) — 이때의 값은 window.location 과 동일
 *   2) 브라우저 이벤트 핸들러 — 항상 현재 URL 기준
 *  이므로 브라우저 URL을 직접 읽어도 기존 동작과 값이 같다.
 */

/** 현재 URL의 쿼리 파라미터 (서버 렌더 중에는 빈 값) */
export function getBrowserSearchParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

/** 현재 URL의 쿼리 파라미터 단일 값 (서버 렌더 중에는 null) */
export function getBrowserSearchParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}
