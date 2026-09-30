// yahoo.ts - GET /v1/yahoo/quote-summary/:ticker
// Yahoo Finance QuoteSummary 프록시 (Vercel IP 경유하여 429 우회)

import { Elysia, t } from 'elysia';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

let cachedCookie = '';
let cachedCrumb = '';
let lastAuthTime = 0;
const AUTH_TTL_MS = 60 * 60 * 1000; // 1시간 캐시

async function getYahooAuth(forceRefresh = false): Promise<{ cookie: string; crumb: string }> {
  const now = Date.now();
  if (!forceRefresh && cachedCookie && cachedCrumb && now - lastAuthTime < AUTH_TTL_MS) {
    return { cookie: cachedCookie, crumb: cachedCrumb };
  }

  // 1. fc.yahoo.com에서 Set-Cookie 획득
  const res1 = await fetch('https://fc.yahoo.com', {
    headers: { 'User-Agent': UA },
  });
  const rawCookie = res1.headers.get('set-cookie') || '';
  const cookiePart = rawCookie.split(';')[0]?.trim();

  if (!cookiePart) {
    throw new Error(`Failed to obtain Yahoo cookie (HTTP ${res1.status})`);
  }

  // 2. getcrumb 호출
  const res2 = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
    headers: {
      'User-Agent': UA,
      Cookie: cookiePart,
    },
  });

  const crumb = (await res2.text()).trim();
  if (
    res2.status === 200 &&
    crumb &&
    !crumb.includes('{') &&
    !crumb.includes('<') &&
    !crumb.includes(' ') &&
    crumb.length <= 30
  ) {
    cachedCookie = cookiePart;
    cachedCrumb = crumb;
    lastAuthTime = now;
    return { cookie: cachedCookie, crumb: cachedCrumb };
  }

  throw new Error(`Failed to obtain Yahoo crumb (HTTP ${res2.status}): ${crumb}`);
}

async function fetchQuoteSummary(ticker: string): Promise<Record<string, unknown>> {
  const cleanTicker = ticker.toUpperCase().trim();
  const modules = [
    'summaryDetail',
    'defaultKeyStatistics',
    'financialData',
    'assetProfile',
    'recommendationTrend',
    'calendarEvents',
  ].join(',');

  // 최대 2회 시도 (1회 실패 시 auth 강제 갱신)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { cookie, crumb } = await getYahooAuth(attempt > 1);
      const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${cleanTicker}?modules=${modules}&crumb=${encodeURIComponent(crumb)}`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          Cookie: cookie,
        },
      });

      if (res.status === 200) {
        return (await res.json()) as Record<string, unknown>;
      }

      if (res.status === 401 || res.status === 403) {
        // Crumb 만료 -> 다음 루프에서 강제 재발급
        cachedCookie = '';
        cachedCrumb = '';
        continue;
      }

      throw new Error(`Yahoo QuoteSummary HTTP ${res.status}: ${await res.text()}`);
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }

  throw new Error(`Failed to fetch QuoteSummary for ${cleanTicker}`);
}

export const yahooRoute = new Elysia()
  .get(
    '/v1/yahoo/quote-summary/:ticker',
    async ({ params: { ticker }, set }) => {
      try {
        const data = await fetchQuoteSummary(ticker);
        return data;
      } catch (err: unknown) {
        set.status = 502;
        const message = err instanceof Error ? err.message : String(err);
        return {
          error: {
            code: 'YAHOO_FETCH_FAILED',
            message,
            ticker,
          },
        };
      }
    },
    {
      params: t.Object({
        ticker: t.String(),
      }),
    }
  );
