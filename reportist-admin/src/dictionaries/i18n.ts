/**
 * Reportist UI 다국어(한국어 / English) 사전
 */

export type Locale = "ko" | "en";

export interface Dictionary {
  common: {
    serviceName: string;
    tagline: string;
    korean: string;
    english: string;
    login: string;
    logout: string;
    myAccount: string;
    searchPlaceholder: string;
    loading: string;
    noData: string;
    error: string;
  };
  nav: {
    home: string;
    screener: string;
    stocks: string;
    gurus: string;
    stats: string;
    pricing: string;
    feedback: string;
    pipeline: string;
  };
  stockDetail: {
    titleSuffix: string;
    tabs: {
      masterReport: string;
      guruVotes: string;
      chart: string;
      financials: string;
      checklist: string;
      history: string;
    };
    metrics: {
      fairValue: string;
      fairValueBand: string;
      currentPrice: string;
      upside: string;
      safetyEntry: string;
      targetSell: string;
      verdict: string;
      voteSummary: string;
      buy: string;
      hold: string;
      watch: string;
      sell: string;
      dispersion: string;
      confidence: string;
      publishedDate: string;
    };
    sections: {
      consensusTitle: string;
      conclusionTitle: string;
      hotTopicsTitle: string;
      bullPointsTitle: string;
      bearPointsTitle: string;
      keyDriversTitle: string;
      actionGuideTitle: string;
      rosterTitle: string;
    };
    verdictLabel: {
      매수: string;
      보유: string;
      관망: string;
      매도: string;
      미응답: string;
    };
  };
}

export const DICTIONARIES: Record<Locale, Dictionary> = {
  ko: {
    common: {
      serviceName: "리포티스트",
      tagline: "13인 투자 거장의 철학으로 분석한 국내 및 미국 주식 가치평가 리포트",
      korean: "한국어",
      english: "English",
      login: "로그인",
      logout: "로그아웃",
      myAccount: "내 계정",
      searchPlaceholder: "종목명, 티커(예: AAPL, 삼성전자) 검색...",
      loading: "데이터를 불러오는 중입니다...",
      noData: "데이터가 없습니다.",
      error: "오류가 발생했습니다.",
    },
    nav: {
      home: "홈",
      screener: "스크리너",
      stocks: "종목 리포트",
      gurus: "13인 거장",
      stats: "통계 및 밸류",
      pricing: "멤버십",
      feedback: "의견 제안",
      pipeline: "파이프라인",
    },
    stockDetail: {
      titleSuffix: "주가 전망 및 적정주가 분석 · 13인 거장 AI 리포트 | 리포티스트",
      tabs: {
        masterReport: "종합 리포트",
        guruVotes: "13인 거장 표결",
        chart: "차트 센터",
        financials: "재무 & 밸류에이션",
        checklist: "체크리스트",
        history: "분석 이력",
      },
      metrics: {
        fairValue: "적정 내재가치",
        fairValueBand: "적정가 밴드 (중앙 50%)",
        currentPrice: "현재 주가",
        upside: "상승 여력",
        safetyEntry: "안전마진 매수가",
        targetSell: "목표 매도가",
        verdict: "종합 판정",
        voteSummary: "거장 표결 현황",
        buy: "매수",
        hold: "보유",
        watch: "관망",
        sell: "매도",
        dispersion: "가격 의견 분산율",
        confidence: "평균 확신도",
        publishedDate: "분석 기준일",
      },
      sections: {
        consensusTitle: "13인 거장 가치평가 종합 합의",
        conclusionTitle: "종합 결론 및 투자 시사점",
        hotTopicsTitle: "핵심 분석 쟁점",
        bullPointsTitle: "상승 및 강세 근거 (Bull Case)",
        bearPointsTitle: "하방 리스크 및 약세 요인 (Bear Case)",
        keyDriversTitle: "핵심 기업가치 드라이버 (Catalysts)",
        actionGuideTitle: "투자 의사결정 실행 가이드",
        rosterTitle: "13인 투자 거장별 독립 투자의견",
      },
      verdictLabel: {
        매수: "매수 (BUY)",
        보유: "보유 (HOLD)",
        관망: "관망 (WATCH)",
        매도: "매도 (SELL)",
        미응답: "미응답",
      },
    },
  },
  en: {
    common: {
      serviceName: "Reportist",
      tagline: "Institutional-grade equity research driven by 13 legendary guru AI personas",
      korean: "한국어",
      english: "English",
      login: "Sign In",
      logout: "Sign Out",
      myAccount: "Account",
      searchPlaceholder: "Search ticker or company (e.g. AAPL, NVDA)...",
      loading: "Loading research data...",
      noData: "No data available.",
      error: "An error occurred.",
    },
    nav: {
      home: "Home",
      screener: "Screener",
      stocks: "Research Reports",
      gurus: "13 Gurus",
      stats: "Valuation Matrix",
      pricing: "Pricing",
      feedback: "Feedback",
      pipeline: "Pipeline",
    },
    stockDetail: {
      titleSuffix: "Stock Forecast & Fair Value Analysis · 13 Guru AI Research | Reportist",
      tabs: {
        masterReport: "Master Report",
        guruVotes: "13 Guru Votes",
        chart: "Chart Center",
        financials: "Financials & Valuation",
        checklist: "Checklists",
        history: "History",
      },
      metrics: {
        fairValue: "Fair Value Price",
        fairValueBand: "Fair Value Band (Q1–Q3)",
        currentPrice: "Current Price",
        upside: "Upside Potential",
        safetyEntry: "Margin of Safety Entry",
        targetSell: "Target Exit Price",
        verdict: "Consensus Verdict",
        voteSummary: "Guru Vote Summary",
        buy: "Buy",
        hold: "Hold",
        watch: "Watch",
        sell: "Sell",
        dispersion: "Valuation Dispersion",
        confidence: "Avg Confidence",
        publishedDate: "Report Date",
      },
      sections: {
        consensusTitle: "13-Guru Consensus & Valuation Summary",
        conclusionTitle: "Key Takeaways & Executive Summary",
        hotTopicsTitle: "Core Analytical Debates",
        bullPointsTitle: "Bullish Arguments (Upside Catalysts)",
        bearPointsTitle: "Bearish Risks & Downside Factors",
        keyDriversTitle: "Key Value Drivers & KPIs",
        actionGuideTitle: "Actionable Execution Guide",
        rosterTitle: "Independent Votes by 13 Investment Gurus",
      },
      verdictLabel: {
        매수: "BUY",
        보유: "HOLD",
        관망: "WATCH",
        매도: "SELL",
        미응답: "NO RESPONSE",
      },
    },
  },
};

export function getDictionary(locale: Locale = "ko"): Dictionary {
  return DICTIONARIES[locale] || DICTIONARIES.ko;
}
