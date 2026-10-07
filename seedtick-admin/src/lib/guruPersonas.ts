export interface GuruPersona {
  slug: string;
  name: string;
  englishName: string;
  oneLiner: string;
  philosophy: string[];
  keyCriteria: string;
  focusMetrics: string[];
}

export const GURU_PERSONAS: Record<string, GuruPersona> = {
  buffett: {
    slug: "buffett",
    name: "워런 버핏",
    englishName: "Warren Buffett",
    oneLiner: "경제적 해자(Moat)와 탁월한 자본배치, 일관된 고ROE",
    philosophy: [
      "이해할 수 없는 복잡한 비즈니스는 투자하지 않는다",
      "장기 경쟁우위(넓은 경제적 해자)를 가진 기업을 찾는다",
      "ROE가 15% 이상 꾸준히 유지되는지 검증한다",
      "훌륭한 기업을 적당한 가격에 사는 것이 적당한 기업을 싼값에 사는 것보다 낫다",
    ],
    keyCriteria: "해자 지속성, 10년 이상 일관된 ROE, 경영진의 자본배치 능력",
    focusMetrics: ["ROE", "영업이익률", "FCF", "유보이익 수익률"],
  },
  fisher: {
    slug: "fisher",
    name: "필립 피셔",
    englishName: "Philip Fisher",
    oneLiner: "구조적 질적 성장성, 사실수집(Scuttlebutt), R&D 효율",
    philosophy: [
      "향후 수년간 시장 평균을 월등히 앞서는 구조적 성장 잠재력",
      "경쟁사보다 탁월한 연구개발(R&D) 결실과 신제품 파이프라인",
      "고객, 경쟁사, 공급망 탐문을 통한 사실수집(Scuttlebutt)",
      "성장주를 발굴했다면 주가가 올라도 쉽게 팔지 않는다",
    ],
    keyCriteria: "R&D 투자 효율, 영업이익률 개선 추세, 장기 구조적 매출 성장률",
    focusMetrics: ["매출 성장률", "R&D 비중", "영업이익률 추세"],
  },
  lynch: {
    slug: "lynch",
    name: "피터 린치",
    englishName: "Peter Lynch",
    oneLiner: "6대 기업 유형 분류, PEG < 1.0, 실생활 일상 발굴",
    philosophy: [
      "기업을 6가지 유형(고성장/대형우량/경기순환/회복/자산/저성장)으로 먼저 분류한다",
      "성장률 대비 주가 매력도인 PEG가 1.0 미만인지 확인한다",
      "쇼핑몰과 일상에서 소비자들이 열광하는 브랜드를 주목한다",
      "사업 모델이 바보라도 운영할 수 있을 만큼 단순해야 한다",
    ],
    keyCriteria: "6대 기업 유형 적합성, PEG 비율, 부채비율, 재고 회전",
    focusMetrics: ["PEG", "부채비율", "재고자산 회전율", "순현금"],
  },
  klarman: {
    slug: "klarman",
    name: "세스 클라만",
    englishName: "Seth Klarman",
    oneLiner: "철저한 하방 안전마진, 가격 하락 위험 방어, 비인기 자산",
    philosophy: [
      "투자에서 가장 중요한 것은 돈을 잃지 않는 하방 안전마진이다",
      "시장 참여자들이 외면하거나 복잡해서 투매하는 곳에서 기회를 찾는다",
      "정확한 미래 예측은 불가능하므로 보수적인 청산가치를 기준으로 삼는다",
    ],
    keyCriteria: "하방 지지선, 보수적 순자산가치, 불확실성 대비 안전마진 폭",
    focusMetrics: ["PBR", "순유동자산", "현금성 자산 비중"],
  },
  pabrai: {
    slug: "pabrai",
    name: "모니시 파브라이",
    englishName: "Mohnish Pabrai",
    oneLiner: "단도(Dhandho) 투자 — 저위험 고수익 비대칭 베팅",
    philosophy: [
      "앞면이 나오면 대박, 뒷면이 나와도 쪽박은 안 찬다(비대칭 위험보상)",
      "단순하고 이해하기 쉬우며 변화 속도가 느린 비즈니스에 투자한다",
      "소수의 확실한 기회에 집중 베팅한다",
    ],
    keyCriteria: "손실 위험 극소화, 저평가 회복 시 2~3배 업사이드, 사업 단순성",
    focusMetrics: ["EV/EBITDA", "PER", "부채 부담"],
  },
  templeton: {
    slug: "templeton",
    name: "존 템플턴",
    englishName: "John Templeton",
    oneLiner: "극단적 비관론(Maximum Pessimism) 시점의 역발상 매수",
    philosophy: [
      "시장이 가장 비관적일 때가 최고의 매수 기회다",
      "전 세계 글로벌 시장을 대상으로 가장 헐값에 거래되는 종목을 찾는다",
      "대중과 반대로 행동할 수 있는 담대한 독립적 사고",
    ],
    keyCriteria: "장기 역사적 저점 밸류에이션, 극단적 악재 선반영 여부",
    focusMetrics: ["역사적 PER 밴드", "PBR 저점", "글로벌 동종업종 비교"],
  },
  burry: {
    slug: "burry",
    name: "마이클 버리",
    englishName: "Michael Burry",
    oneLiner: "공시 원자료 직독, 딥 밸류, 잉여현금흐름(FCF), 패닉 반등",
    philosophy: [
      "남의 리포트를 보지 않고 공시 계약 원문과 재무제표 원자료를 직접 읽는다",
      "현금 창출 능력 대비 극도로 저평가된 딥 밸류 종목을 발굴한다",
      "시장 컨센서스의 맹점을 파고드는 역발상",
    ],
    keyCriteria: "FCF Yield(잉여현금흐름 수익률), 숨겨진 자산 가치, 부채 만기 구조",
    focusMetrics: ["FCF Yield", "EV/FCF", "순부채"],
  },
  kostolany: {
    slug: "kostolany",
    name: "앙드레 코스톨라니",
    englishName: "André Kostolany",
    oneLiner: "코스톨라니 달걀 모형, 금리와 유동성, 대중 심리 사이클",
    philosophy: [
      "주가 = 돈(유동성) + 심리",
      "달걀 모형에서 금리 정점과 과매도 침체기를 식별하여 선제 진입한다",
      "소신파 투자자가 되어 부화뇌동파 대중에게 주식을 넘겨받는다",
    ],
    keyCriteria: "금리/유동성 환경, 시장 심리 과열/공포 단계, 거래량 변화",
    focusMetrics: ["금리 추이", "VIX", "거래량 추세", "주가 모멘텀"],
  },
  nyresident: {
    slug: "nyresident",
    name: "뉴욕주민",
    englishName: "NY Resident",
    oneLiner: "월가 헤지펀드 실전 재무 분석, 컨센서스 팩트체크",
    philosophy: [
      "섹터 밸류체인과 GICS 분류를 먼저 이해하고 종목을 본다",
      "가이던스 대비 컨센서스 괴리와 어닝 서프라이즈 모멘텀을 추적한다",
      "실제 현금흐름표와 이익의 질(Quality of Earnings)을 팩트체크한다",
    ],
    keyCriteria: "어닝 퀄리티, 가이던스 신뢰성, 밸류체인 독점력",
    focusMetrics: ["영업현금흐름 비율", "매출 총이익률", "어닝 서프라이즈"],
  },
  damodaran: {
    slug: "damodaran",
    name: "아스워스 다모다란",
    englishName: "Aswath Damodaran",
    oneLiner: "스토리와 숫자, 성장률·마진·재투자율 기반 내재가치 DCF",
    philosophy: [
      "기업의 미래 스토리와 정량적 재무 숫자가 일치해야 한다",
      "현재 가격에 내포된 기대치(Reverse DCF)를 분석하여 고평가를 판별한다",
      "성장률, 목표 마진, 재투자 효율의 3대 축으로 가치를 측정한다",
    ],
    keyCriteria: "목표 마진 수렴 여부, 자본비용(WACC) 대비 ROIC, 내재가치 괴리율",
    focusMetrics: ["내재가치", "ROIC", "재투자율", "WACC"],
  },
  greenblatt: {
    slug: "greenblatt",
    name: "조엘 그린블라트",
    englishName: "Joel Greenblatt",
    oneLiner: "마법공식 — 높은 자본수익률(ROC) + 높은 이익수익률(EY)",
    philosophy: [
      "좋은 기업(높은 자본수익률 ROC)을 싼 가격(높은 이익수익률 EY)에 산다",
      "감정을 배제하고 객관적인 정량 지표 랭킹으로 종목을 스크리닝한다",
      "1년 이상 보유하며 20~30개 종목으로 분산한다",
    ],
    keyCriteria: "자본수익률 ROC (EBIT / 투하자본), 이익수익률 EY (EBIT / EV)",
    focusMetrics: ["ROC", "EY (EBIT/EV)", "영업이익"],
  },
  graham: {
    slug: "graham",
    name: "벤저민 그레이엄",
    englishName: "Benjamin Graham",
    oneLiner: "가치투자의 창시자, 순유동자산(NCAV), 안전마진 원조",
    philosophy: [
      "투자는 철저한 분석을 통해 원금의 안전과 적절한 수익을 보장하는 행위다",
      "청산가치(순유동자산)보다 싼 가격에 매수하여 안전마진을 확보한다",
      "미스터 마켓의 감정 기복을 이용하고 휘둘리지 않는다",
    ],
    keyCriteria: "순유동자산가치(NCAV) 대비 주가, PER < 15, PBR < 1.5 (PER×PBR < 22.5)",
    focusMetrics: ["PER", "PBR", "유동비율", "부채비율"],
  },
  schwager: {
    slug: "schwager",
    name: "잭 슈웨거",
    englishName: "Jack Schwager",
    oneLiner: "손익비(Risk/Reward), 리스크 관리, 최적 진입 타이밍",
    philosophy: [
      "가치뿐 아니라 손익비가 유리한 진입 타이밍과 손절 기준을 세운다",
      "손실은 작게 자르고 이익은 길게 가져가는 포지션 사이징",
      "볼린저 밴드와 변동성 수축 후 확장을 관찰한다",
    ],
    keyCriteria: "손익비 3:1 이상, 지지선 근접성, 변동성 지표(%B)",
    focusMetrics: ["%B", "손익비", "52주 변동폭"],
  },
};

export function findGuruPersona(rawName: string): GuruPersona | null {
  const norm = rawName.replace(/[-\s]/g, "").toLowerCase();
  for (const [key, p] of Object.entries(GURU_PERSONAS)) {
    if (
      norm.includes(key) ||
      norm.includes(p.name.replace(/\s/g, "").toLowerCase()) ||
      norm.includes(p.englishName.replace(/\s/g, "").toLowerCase())
    ) {
      return p;
    }
  }
  return null;
}
