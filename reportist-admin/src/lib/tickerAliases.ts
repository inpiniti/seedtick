/**
 * 주요 미국 주식 티커별 한국어 통칭 및 별칭(Aliases) 사전
 *
 * 목적:
 * 1. SEO 최적화: 사용자가 "구글 주식", "리포티스트 구글", "페이스북 주식" 등으로 검색했을 때
 *    정식 법인명(알파벳 A, 메타 플랫폼스)과 매칭되어 검색엔진에 노출되도록 함.
 * 2. 내부 검색 지원: 카탈로그나 검색창에서 '구글' 입력 시 'GOOGL'이 바로 검색되도록 지원.
 */

export interface TickerAliasDef {
  /** 대표 대중 통칭 (예: "구글") */
  primaryAlias: string;
  /** 정식 영문 기업명 (예: "Alphabet Inc.") */
  englishName?: string;
  /** 검색 및 SEO에 활용할 추가 별칭들 (예: ["구글", "구글 A", "Google", "Alphabet"]) */
  aliases: string[];
}

export const TICKER_ALIAS_MAP: Record<string, TickerAliasDef> = {
  GOOGL: {
    primaryAlias: "구글",
    englishName: "Alphabet Inc. (Google)",
    aliases: ["구글", "구글 A", "Google", "Alphabet", "알파벳"],
  },
  GOOG: {
    primaryAlias: "구글",
    englishName: "Alphabet Inc. (Google)",
    aliases: ["구글", "구글 C", "Google", "Alphabet", "알파벳"],
  },
  META: {
    primaryAlias: "페이스북",
    englishName: "Meta Platforms, Inc.",
    aliases: ["페이스북", "메타", "인스타그램", "Facebook", "Instagram"],
  },
  AAPL: {
    primaryAlias: "애플",
    englishName: "Apple Inc.",
    aliases: ["애플", "Apple", "아이폰", "iPhone"],
  },
  TSLA: {
    primaryAlias: "테슬라",
    englishName: "Tesla, Inc.",
    aliases: ["테슬라", "Tesla", "일론 머스크"],
  },
  MSFT: {
    primaryAlias: "마이크로소프트",
    englishName: "Microsoft Corporation",
    aliases: ["마이크로소프트", "마소", "MS", "Microsoft", "윈도우"],
  },
  NVDA: {
    primaryAlias: "엔비디아",
    englishName: "NVIDIA Corporation",
    aliases: ["엔비디아", "Nvidia", "젠슨 황", "지포스"],
  },
  AMZN: {
    primaryAlias: "아마존",
    englishName: "Amazon.com, Inc.",
    aliases: ["아마존", "Amazon", "AWS", "아마존닷컴"],
  },
  NFLX: {
    primaryAlias: "넷플릭스",
    aliases: ["넷플릭스", "Netflix"],
  },
  PLTR: {
    primaryAlias: "팔란티어",
    aliases: ["팔란티어", "Palantir"],
  },
  AMD: {
    primaryAlias: "AMD",
    aliases: ["AMD", "에이엠디", "라데온"],
  },
  INTC: {
    primaryAlias: "인텔",
    aliases: ["인텔", "Intel"],
  },
  QCOM: {
    primaryAlias: "퀄컴",
    aliases: ["퀄컴", "Qualcomm", "스냅드래곤"],
  },
  AVGO: {
    primaryAlias: "브로드컴",
    aliases: ["브로드컴", "Broadcom"],
  },
  TSM: {
    primaryAlias: "TSMC",
    aliases: ["TSMC", "대만반도체", "티에스엠시"],
  },
  BABA: {
    primaryAlias: "알리바바",
    aliases: ["알리바바", "Alibaba", "마윈"],
  },
  PDD: {
    primaryAlias: "핀둬둬",
    aliases: ["핀둬둬", "테무", "Temu", "PDD Holdings"],
  },
  "BRK.A": {
    primaryAlias: "버크셔 해서웨이",
    aliases: ["버크셔", "버크셔해서웨이", "워런 버핏", "Berkshire"],
  },
  "BRK.B": {
    primaryAlias: "버크셔 해서웨이",
    aliases: ["버크셔", "버크셔해서웨이", "워런 버핏", "Berkshire"],
  },
  "BRK-A": {
    primaryAlias: "버크셔 해서웨이",
    aliases: ["버크셔", "버크셔해서웨이", "워런 버핏", "Berkshire"],
  },
  "BRK-B": {
    primaryAlias: "버크셔 해서웨이",
    aliases: ["버크셔", "버크셔해서웨이", "워런 버핏", "Berkshire"],
  },
  COIN: {
    primaryAlias: "코인베이스",
    aliases: ["코인베이스", "Coinbase", "비트코인"],
  },
  DIS: {
    primaryAlias: "디즈니",
    aliases: ["디즈니", "월트디즈니", "Disney"],
  },
  NKE: {
    primaryAlias: "나이키",
    aliases: ["나이키", "Nike"],
  },
  SBUX: {
    primaryAlias: "스타벅스",
    aliases: ["스타벅스", "스벅", "Starbucks"],
  },
  COST: {
    primaryAlias: "코스트코",
    aliases: ["코스트코", "Costco"],
  },
  ARM: {
    primaryAlias: "ARM",
    aliases: ["ARM", "암", "암 홀딩스"],
  },
  SMCI: {
    primaryAlias: "슈퍼마이크로컴퓨터",
    aliases: ["슈퍼마이크로", "슈마컴", "Supermicro"],
  },
  ASML: {
    primaryAlias: "ASML",
    aliases: ["ASML", "아스밀", "노광장비"],
  },
  LLY: {
    primaryAlias: "일라이 릴리",
    aliases: ["일라이릴리", "Eli Lilly", "마운자로", "비만치료제"],
  },
  NVO: {
    primaryAlias: "노보 노디스크",
    aliases: ["노보노디스크", "Novo Nordisk", "위고비"],
  },
  UBER: {
    primaryAlias: "우버",
    aliases: ["우버", "Uber"],
  },
  ABNB: {
    primaryAlias: "에어비앤비",
    aliases: ["에어비앤비", "Airbnb"],
  },
  CRM: {
    primaryAlias: "세일즈포스",
    aliases: ["세일즈포스", "Salesforce"],
  },
  ORCL: {
    primaryAlias: "오라클",
    aliases: ["오라클", "Oracle"],
  },
  PYPL: {
    primaryAlias: "페이팔",
    aliases: ["페이팔", "Paypal"],
  },
  SNOW: {
    primaryAlias: "스노우플레이크",
    aliases: ["스노우플레이크", "Snowflake"],
  },
  PANW: {
    primaryAlias: "팔로알토 네트웍스",
    aliases: ["팔로알토", "Palo Alto"],
  },
  CRWD: {
    primaryAlias: "크라우드스트라이크",
    aliases: ["크라우드스트라이크", "CrowdStrike"],
  },
  RDDT: {
    primaryAlias: "레딧",
    aliases: ["레딧", "Reddit"],
  },
  SOFI: {
    primaryAlias: "소파이",
    aliases: ["소파이", "Sofi"],
  },
  IONQ: {
    primaryAlias: "아이온큐",
    aliases: ["아이온큐", "IonQ", "양자컴퓨터"],
  },
};

/**
 * 티커의 대표 별칭을 반환 (없으면 null)
 */
export function getTickerPrimaryAlias(ticker: string): string | null {
  const normTicker = (ticker || "").trim().toUpperCase();
  const entry = TICKER_ALIAS_MAP[normTicker];
  return entry ? entry.primaryAlias : null;
}

/**
 * 티커의 모든 별칭 배열 반환
 */
export function getTickerAliases(ticker: string): string[] {
  const normTicker = (ticker || "").trim().toUpperCase();
  const entry = TICKER_ALIAS_MAP[normTicker];
  return entry ? entry.aliases : [];
}

/**
 * SEO 및 화면 표시용 회사명 결합
 * 예: companyName: "알파벳 A", ticker: "GOOGL" -> "알파벳 A (구글)"
 * 이미 companyName에 별칭이 포함되어 있다면 중복 방지.
 */
export function getCompanyDisplayNameWithAlias(
  companyName: string,
  ticker: string
): string {
  const normTicker = (ticker || "").trim().toUpperCase();
  const entry = TICKER_ALIAS_MAP[normTicker];
  if (!entry) return companyName || normTicker;

  const base = (companyName || normTicker).trim();
  const alias = entry.primaryAlias.trim();

  // 이미 base에 alias가 완전히 포함되어 있다면 그대로 반환 (예: "구글", "구글 A")
  if (base.toLowerCase().includes(alias.toLowerCase())) {
    return base;
  }

  return `${base} (${alias})`;
}

/**
 * SEO 메타 키워드 생성
 */
export function getSeoKeywordsForTicker(
  ticker: string,
  companyName: string
): string[] {
  const normTicker = (ticker || "").trim().toUpperCase();
  const entry = TICKER_ALIAS_MAP[normTicker];
  const list = new Set<string>();

  list.add("리포티스트");
  list.add("Reportist");
  list.add(normTicker);
  list.add(`$${normTicker}`);

  if (companyName && companyName.trim()) {
    list.add(companyName.trim());
  }

  if (entry) {
    for (const a of entry.aliases) {
      list.add(a);
    }
  }

  list.add("주가 전망");
  list.add("주식 전망");
  list.add("목표주가");
  list.add("적정주가");
  list.add("적정주가 전망");
  list.add("국내 주식 리포트");
  list.add("미국 주식 리포트");
  list.add("주식 리포트");
  list.add("주식 보고서");
  list.add("내재가치");
  list.add("가치평가");
  list.add("워런 버핏");
  list.add("피터 린치");

  // 종목별 조합 롱테일 키워드 (예: "애플 주가 전망", "AAPL 목표주가")
  list.add(`${normTicker} 주가 전망`);
  list.add(`${normTicker} 목표주가`);
  if (companyName && companyName.trim()) {
    const cName = companyName.trim();
    list.add(`${cName} 주가 전망`);
    list.add(`${cName} 주식 전망`);
    list.add(`${cName} 목표주가`);
  }
  if (entry?.primaryAlias) {
    const alias = entry.primaryAlias.trim();
    list.add(`${alias} 주가 전망`);
    list.add(`${alias} 주식 전망`);
    list.add(`${alias} 목표주가`);
  }

  return Array.from(list);
}

/**
 * 검색 쿼리가 특정 티커의 별칭들과 일치하는지 여부
 */
export function matchesTickerAlias(
  query: string,
  ticker: string,
  companyName?: string | null
): boolean {
  if (!query || !query.trim()) return false;
  const q = query.trim().toLowerCase();

  const normTicker = (ticker || "").trim().toUpperCase();
  if (normTicker.toLowerCase().includes(q)) return true;

  if (companyName && companyName.toLowerCase().includes(q)) return true;

  const entry = TICKER_ALIAS_MAP[normTicker];
  if (!entry) return false;

  return entry.aliases.some((a) => a.toLowerCase().includes(q));
}

/**
 * 정식 영문 기업명 조회 (없으면 ticker 폴백)
 */
export function getEnglishCompanyName(
  ticker: string,
  fallbackName?: string | null
): string {
  const normTicker = (ticker || "").trim().toUpperCase();
  const entry = TICKER_ALIAS_MAP[normTicker];
  if (entry?.englishName) return entry.englishName;
  if (fallbackName && fallbackName.trim()) return fallbackName.trim();
  return normTicker;
}

/**
 * 영문 SEO 메타 키워드 생성 (Google Global Indexing용)
 */
export function getEnglishSeoKeywordsForTicker(
  ticker: string,
  companyNameEn?: string | null
): string[] {
  const normTicker = (ticker || "").trim().toUpperCase();
  const entry = TICKER_ALIAS_MAP[normTicker];
  const list = new Set<string>();

  list.add("Reportist");
  list.add(normTicker);
  list.add(`$${normTicker}`);

  const name = companyNameEn || entry?.englishName || normTicker;
  if (name) {
    list.add(name);
  }

  if (entry) {
    for (const a of entry.aliases) {
      if (/^[a-zA-Z0-9\s.,'-]+$/.test(a)) {
        list.add(a);
      }
    }
  }

  // 글로벌 SEO 핵심 키워드
  list.add("stock forecast");
  list.add("price target");
  list.add("fair value");
  list.add("intrinsic value");
  list.add("valuation analysis");
  list.add("stock report");
  list.add("Warren Buffett");
  list.add("Peter Lynch");
  list.add("13 Gurus AI");

  // 종목 결합 롱테일 키워드
  list.add(`${normTicker} stock forecast`);
  list.add(`${normTicker} price target`);
  list.add(`${normTicker} fair value`);
  list.add(`${normTicker} intrinsic value`);
  list.add(`${name} stock analysis`);
  list.add(`${name} fair value`);

  return Array.from(list);
}

