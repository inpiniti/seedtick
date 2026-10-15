export interface ChecklistRule {
  title: string;
  desc: string;
}

export interface GuruPersona {
  slug: string;
  name: string;
  englishName: string;
  style: string;
  oneLiner: string;
  bookTitle: string;
  bookSummary: string;
  quote: string;
  valuationMethod: string;
  philosophy: string[];
  keyCriteria: string;
  checklistRules: ChecklistRule[];
  focusMetrics: string[];
}

export const GURU_PERSONAS: Record<string, GuruPersona> = {
  buffett: {
    slug: "buffett",
    name: "워런 버핏",
    englishName: "Warren Buffett",
    style: "경제적 해자 / 장기 복리 가치투자",
    oneLiner: "경제적 해자(Moat)와 탁월한 자본배치, 일관된 고ROE",
    bookTitle: "워런 버핏의 재무제표 활용법",
    bookSummary: "경쟁우위는 재무제표에 반드시 흔적을 남긴다. 매출총이익률 40% 이상, ROE 15% 이상, 낮은 장기부채를 10년 이상 유지하는 기업이 해자를 가진 기업이다.",
    quote: "탁월한 기업을 적당한 가격에 사는 것이 평범한 기업을 헐값에 사는 것보다 훨씬 낫다.",
    valuationMethod: "예측 가능한 소유주 이익(Owner Earnings)을 보수적 국채 금리로 할인. 영구 복리 자본배치 지속성 검증.",
    philosophy: [
      "이해할 수 없는 복잡한 비즈니스는 투자하지 않는다 (능력 범위 원칙)",
      "장기 경쟁우위(넓은 경제적 해자)를 가진 기업을 찾는다",
      "ROE가 15% 이상 꾸준히 유지되는지 10년 데이터를 검증한다",
      "훌륭한 기업을 적당한 가격에 사는 것이 적당한 기업을 싼값에 사는 것보다 낫다",
    ],
    keyCriteria: "해자 지속성, 10년 이상 일관된 ROE, 경영진의 자본배치 능력",
    checklistRules: [
      { title: "경제적 해자(Moat)", desc: "독점 브랜드, 높은 전환비용, 저비용 구조 중 1개 이상 보유 여부" },
      { title: "자본 효율성(ROE)", desc: "부채 레버리지 없이 ROE 15% 이상 지속 달성 여부" },
      { title: "수익성(Margin)", desc: "매출총이익률 40% 이상, 순이익률 20% 이상 유지 여부" },
      { title: "건전한 부채비율", desc: "장기 부채를 3~4년 순이익으로 전액 상환 가능한 수준 여부" },
    ],
    focusMetrics: ["ROE", "영업이익률", "FCF", "유보이익 수익률"],
  },
  graham: {
    slug: "graham",
    name: "벤저민 그레이엄",
    englishName: "Benjamin Graham",
    style: "계량 가치투자 / 절대 안전마진 (Net-Net)",
    oneLiner: "가치투자의 창시자, 순유동자산(NCAV), 안전마진 원조",
    bookTitle: "현명한 투자자",
    bookSummary: "투자는 철저한 분석으로 원금의 안전과 만족스러운 수익을 추구하는 행위다. 미스터 마켓의 감정에 휘둘리지 말고 오직 가격과 내재가치의 괴리(안전마진)만 보라.",
    quote: "투자의 성공은 얼마나 두터운 안전마진(Margin of Safety)을 확보했는가에 달려 있다.",
    valuationMethod: "순유동자산가치(NCAV) 대비 2/3 가격 매수, PER < 15, PBR < 1.5 (PER × PBR < 22.5) 엄격 제한.",
    philosophy: [
      "투자는 철저한 분석을 통해 원금의 안전과 적절한 수익을 보장하는 행위다",
      "청산가치(순유동자산)보다 싼 가격에 매수하여 안전마진을 확보한다",
      "미스터 마켓의 감정 기복을 이용하고 절대로 휘둘리지 않는다",
      "과도한 부채를 피하고 유동자산이 풍부한 기업을 선별한다",
    ],
    keyCriteria: "순유동자산가치(NCAV) 대비 주가, PER < 15, PBR < 1.5 (PER×PBR < 22.5)",
    checklistRules: [
      { title: "충분한 규모", desc: "해당 업종 내 최소 규모 이상의 중대형 우량 기업" },
      { title: "강력한 재무 상태", desc: "유동비율 200% 이상, 순유동자산이 장기부채를 초과" },
      { title: "실적 안정성", desc: "최근 10년 연속 흑자 및 배당 지급 지속성" },
      { title: "적정 밸류에이션", desc: "PER 15배 이하, PBR 1.5배 이하, PER × PBR ≤ 22.5" },
    ],
    focusMetrics: ["PER", "PBR", "유동비율", "NCAV"],
  },
  lynch: {
    slug: "lynch",
    name: "피터 린치",
    englishName: "Peter Lynch",
    style: "생활 속 발견 / PEG 성장 가치주 (GARP)",
    oneLiner: "6대 기업 유형 분류, PEG < 1.0, 실생활 일상 발굴",
    bookTitle: "이기는 투자",
    bookSummary: "전문가보다 소비자가 먼저 안다. 쇼핑몰과 마트에서 매력적인 제품을 발견하고, 숫자로 검증해 PEG 1.0 미만인 성장주를 매수하라.",
    quote: "당신이 소비하고 이해할 수 있는 비즈니스에 투자하라. 그림으로 설명할 수 없는 사업엔 손대지 마라.",
    valuationMethod: "PEG(PER ÷ 연간 EPS성장률) < 1.0. 6가지 기업 유형(고성장, 대형우량, 경기순환, 회생, 자산, 저성장)에 맞춘 밸류에이션.",
    philosophy: [
      "기업을 6가지 유형으로 먼저 분류하고 유형별 목표와 기대치를 다르게 설정한다",
      "성장률 대비 주가 매력도인 PEG가 1.0 미만인지 확인한다",
      "쇼핑몰과 일상에서 소비자들이 열광하는 브랜드를 주목한다",
      "사업 모델이 바보라도 운영할 수 있을 만큼 직관적이고 단순해야 한다",
    ],
    keyCriteria: "6대 기업 유형 적합성, PEG 비율, 부채비율, 재고 회전",
    checklistRules: [
      { title: "단순한 비즈니스", desc: "초등학생에게도 2분 안에 설명할 수 있는 단순 명쾌한 사업 모델" },
      { title: "PEG < 1.0", desc: "주가수익비율(PER)이 연평균 이익성장률(%)보다 현저히 낮음" },
      { title: "재고자산 건전성", desc: "재고자산 증가율이 매출액 증가율보다 낮게 유지" },
      { title: "기관 미보유 우대", desc: "월가 기관 투자자들의 관심이 아직 덜 미친 숨겨진 알짜 기업" },
    ],
    focusMetrics: ["PEG", "부채비율", "재고자산 회전율", "순현금"],
  },
  burry: {
    slug: "burry",
    name: "마이클 버리",
    englishName: "Michael Burry",
    style: "역발상 / 딥 밸류 / 부채 및 신용 위험 분석",
    oneLiner: "공시 원자료 직독, 딥 밸류, 잉여현금흐름(FCF), 패닉 반등",
    bookTitle: "빅쇼트",
    bookSummary: "모두가 믿는 환상에 의문을 품고 10-K 공시 원문과 재무 각주를 직접 파고든다. 시장이 패닉에 빠졌을 때 비대칭적 하방 방어력을 지닌 딥 밸류를 담는다.",
    quote: "컨센서스는 언제나 게으르다. 대차대조표의 각주와 계약서를 끝까지 파고드는 사람만이 거대한 비대칭 기회를 찾는다.",
    valuationMethod: "기업가치 대비 잉여현금흐름 수익률(FCF Yield) 극대화. 부채 만기 일정 스트레스 테스트를 거친 청산/생존 가치 평가.",
    philosophy: [
      "남의 리포트를 보지 않고 공시 계약 원문과 재무제표 원자료를 직접 읽는다",
      "현금 창출 능력 대비 극도로 저평가된 딥 밸류 종목을 발굴한다",
      "시장 컨센서스의 맹점과 과도한 비관을 파고드는 역발상",
      "부채 만기 도래와 신용 경색 위험을 철저히 스트레스 테스트한다",
    ],
    keyCriteria: "FCF Yield(잉여현금흐름 수익률), 숨겨진 자산 가치, 부채 만기 구조",
    checklistRules: [
      { title: "FCF Yield > 10%", desc: "시가총액 대비 잉여현금흐름 창출 비율이 10% 이상으로 압도적 저평가" },
      { title: "부채 만기 방어력", desc: "향후 2~3년간 도래하는 부채 만기 상환 능력을 현금흐름으로 방어 가능" },
      { title: "원자료 팩트체크", desc: "이익의 질(회계 트릭 배제)과 일회성 부실 요인의 정밀 분리" },
      { title: "비대칭 손익비", desc: "하방은 단단히 닫혀있고 정상화 시 2배 이상의 업사이드 보장" },
    ],
    focusMetrics: ["FCF Yield", "EV/FCF", "순부채", "Capex 비율"],
  },
  greenblatt: {
    slug: "greenblatt",
    name: "조엘 그린블라트",
    englishName: "Joel Greenblatt",
    style: "마법공식 / 고자본수익률(ROC) + 고이익수익률(EY)",
    oneLiner: "마법공식 — 높은 자본수익률(ROC) + 높은 이익수익률(EY)",
    bookTitle: "주식시장을 이기는 작은 책",
    bookSummary: "좋은 기업(높은 자본수익률 ROC)을 싼 가격(높은 이익수익률 EY)에 산다. 두 지표의 랭킹을 합산해 상위 20~30개에 분산 투자하는 객관적 시스템.",
    quote: "좋은 기업을 싼 가격에 사서 1년 이상 기다리는 것, 이것이 마법공식의 전부이자 시장을 이기는 단순한 비밀이다.",
    valuationMethod: "ROC = EBIT / (순운전자본 + 순유형자산), EY = EBIT / Enterprise Value. 합산 랭킹 상위 기업 선별.",
    philosophy: [
      "좋은 기업(높은 자본수익률 ROC)을 싼 가격(높은 이익수익률 EY)에 산다",
      "감정을 배제하고 객관적인 정량 지표 랭킹으로 종목을 스크리닝한다",
      "1년 이상 보유하며 20~30개 종목으로 분산하여 리스크를 상쇄한다",
      "자본 구조와 세율 차이를 왜곡하지 않는 EBIT와 EV를 핵심 척도로 사용한다",
    ],
    keyCriteria: "자본수익률 ROC (EBIT / 투하자본), 이익수익률 EY (EBIT / EV)",
    checklistRules: [
      { title: "높은 ROC", desc: "사업에 투입된 실질 자본 대비 영업이익(EBIT) 창출력 최상위" },
      { title: "높은 Earnings Yield", desc: "기업가치(EV) 대비 영업이익 수익률이 국채 금리를 대폭 상회" },
      { title: "비금융/비유틸리티", desc: "부채와 규제 왜곡이 큰 금융주와 유틸리티를 제외한 일반 제조/기술/소비재" },
      { title: "규율 있는 리밸런싱", desc: "감정을 섞지 않고 1년 단위로 기계적인 스크리닝 교체" },
    ],
    focusMetrics: ["ROC", "EY (EBIT/EV)", "영업이익", "투하자본"],
  },
  klarman: {
    slug: "klarman",
    name: "세스 클라먼",
    englishName: "Seth Klarman",
    style: "보수적 가치투자 / 절대 안전마진 / 현금 보유",
    oneLiner: "철저한 하방 안전마진, 가격 하락 위험 방어, 비인기 자산",
    bookTitle: "안전마진",
    bookSummary: "월스트리트는 단기 성과에 집착해 과열과 패닉을 반복한다. 절대 안전마진을 확보할 수 있는 확실한 기회가 올 때까지 기꺼이 현금을 쥐고 인내하라.",
    quote: "투자에서 가장 중요한 것은 돈을 잃지 않는 하방 안전마진이다. 기회가 없을 때는 현금을 들고 쉬는 것도 훌륭한 전략이다.",
    valuationMethod: "최악의 시나리오 스트레스 테스트를 거친 보수적 청산가치 평가. 가격 하락 위험이 극도로 제한된 지점까지 매수 대기.",
    philosophy: [
      "투자에서 가장 중요한 것은 돈을 잃지 않는 하방 안전마진이다",
      "시장 참여자들이 외면하거나 복잡해서 투매하는 곳에서 기회를 찾는다",
      "정확한 미래 예측은 불가능하므로 보수적인 청산가치를 기준으로 삼는다",
      "무리한 기회비용 압박에 쫓기지 않고 현금을 기꺼이 보유한다",
    ],
    keyCriteria: "하방 지지선, 보수적 순자산가치, 불확실성 대비 안전마진 폭",
    checklistRules: [
      { title: "하방 안전마진 두께", desc: "자산가치 또는 보수적 현금흐름 기준 30% 이상의 안전마진 확보" },
      { title: "복잡성 디스카운트 해소", desc: "복잡한 지배구조나 소송, 일시적 스캔들로 과도하게 버려진 자산" },
      { title: "자본 보존 최우선", desc: "원금 손실 가능성이 0에 수렴하는 구조적 안전장치 존재 여부" },
      { title: "인내와 현금 규율", desc: "마땅한 안전마진이 없으면 매수를 강제하지 않고 대기" },
    ],
    focusMetrics: ["PBR", "순유동자산", "현금성 자산 비중", "부채 부담"],
  },
  pabrai: {
    slug: "pabrai",
    name: "모니시 파브라이",
    englishName: "Mohnish Pabrai",
    style: "단도(Dhandho) 투자 / 저위험 고수익 비대칭 베팅",
    oneLiner: "단도(Dhandho) 투자 — 저위험 고수익 비대칭 베팅",
    bookTitle: "단도 투자",
    bookSummary: "파텔 모텔 일가처럼 적은 자본으로 위험을 극소화하고 업사이드를 극대화한다. 단순하고 변화가 적은 업종에서 침체기에 헐값으로 나온 독점 자산을 사 모아라.",
    quote: "앞면이 나오면 크게 벌고, 뒷면이 나와도 조금밖에 잃지 않는다. 비대칭적 위험보상 비율이 존재하는 소수의 기회에 담대하게 베팅하라.",
    valuationMethod: "3년 내 원금 회수 가능성 및 2~3배 업사이드 평가. 자본 지출이 적고 가격 결정력이 있는 단순한 사업 모델.",
    philosophy: [
      "앞면이 나오면 대박, 뒷면이 나와도 쪽박은 안 찬다(비대칭 위험보상)",
      "단순하고 이해하기 쉬우며 기술 변화 속도가 느린 비즈니스에 투자한다",
      "극심한 업황 침체기에 최후의 승자가 될 가장 원가 경쟁력이 높은 기업을 산다",
      "소수의 확실한 기회에 담대하게 집중 투자한다",
    ],
    keyCriteria: "손실 위험 극소화, 저평가 회복 시 2~3배 업사이드, 사업 단순성",
    checklistRules: [
      { title: "비대칭 손익 구조", desc: "손실 가능성은 10% 이하, 성공 시 2~3배의 수익이 열려있는 기회" },
      { title: "단순한 사업 모델", desc: "복잡한 미래 기술 예측이 필요 없는 검증된 비즈니스" },
      { title: "침체기 최강자", desc: "업황 불황기에 경쟁사들이 도산할 때 시장점유율을 흡수할 최저비용 사업자" },
      { title: "클론(복제) 투자", desc: "세계 최고의 가치투자 거장들이 이미 검증한 포트폴리오를 참조" },
    ],
    focusMetrics: ["EV/EBITDA", "PER", "부채 부담", "Capex 비율"],
  },
  damodaran: {
    slug: "damodaran",
    name: "아스워스 다모다란",
    englishName: "Aswath Damodaran",
    style: "뉴욕대 가치평가 거장 / DCF 내재가치 평가",
    oneLiner: "스토리와 숫자, 성장률·마진·재투자율 기반 내재가치 DCF",
    bookTitle: "주식 가치평가 완벽정리",
    bookSummary: "모든 평가는 스토리(Narrative)와 숫자(Numbers)의 다리다. 성장률, 수렴 마진, 재투자 효율, 자본비용(WACC)을 정교하게 모델링해 시장 가격과 비교하라.",
    quote: "밸류에이션은 스토리 없는 숫자의 나열도 아니며, 숫자 없는 환상도 아니다. 스토리가 현금흐름으로 연결될 때 진정한 내재가치가 탄생한다.",
    valuationMethod: "3단계 DCF(현금흐름할인법): 매출 성장률, 목표 영업이익률, 재투자율(Sales to Capital), WACC(자본비용) 기반 주당 공정가치 계산.",
    philosophy: [
      "기업의 미래 스토리와 정량적 재무 숫자가 일치해야 한다",
      "현재 가격에 내포된 기대치(Reverse DCF)를 분석하여 시장의 과열/저평가를 판별한다",
      "성장률, 목표 마진, 재투자 효율의 3대 축으로 가치를 측정한다",
      "자본비용(WACC)과 위험 프리미엄을 엄격히 산출해 현재가치로 할인한다",
    ],
    keyCriteria: "목표 마진 수렴 여부, 자본비용(WACC) 대비 ROIC, 내재가치 괴리율",
    checklistRules: [
      { title: "내재가치 괴리율", desc: "정밀 DCF 모델링 결과 산출된 주당 공정가치 대비 현주가 할인율" },
      { title: "스토리의 현실성", desc: "매출 성장률과 시장 점유율 가정이 업계 전체 규모(TAM)를 초과하지 않는지" },
      { title: "재투자 효율(Sales/Cap)", desc: "1달러의 자본을 재투자했을 때 창출되는 신규 매출의 크기" },
      { title: "자본비용(WACC) 통과", desc: "초과 수익률(ROIC - WACC)이 플러스로 유지되는 경제적 부가가치 창출력" },
    ],
    focusMetrics: ["내재가치", "ROIC", "재투자율", "WACC"],
  },
  fisher: {
    slug: "fisher",
    name: "필립 피셔",
    englishName: "Philip Fisher",
    style: "위대한 성장 기업 / 사실수집(Scuttlebutt) 기법",
    oneLiner: "구조적 질적 성장성, 사실수집(Scuttlebutt), R&D 효율",
    bookTitle: "위대한 기업에 투자하라",
    bookSummary: "15가지 포인트를 통해 시장을 초월할 질적 위대한 기업을 찾는다. 고객, 경쟁사, 퇴직자 인터뷰를 통한 사실수집과 탁월한 R&D 조직을 확인하라.",
    quote: "탁월한 기업을 제대로 매수했다면, 매도해야 할 시점은 거의 영원히 오지 않는다.",
    valuationMethod: "단기 PER보다 5년 후 시장 지배력과 R&D 결실에 집중. 15가지 정성적 사실수집(Scuttlebutt) 지표로 미래 이익 폭발력 검증.",
    philosophy: [
      "향후 수년간 시장 평균을 월등히 앞서는 구조적 성장 잠재력을 가진 기업을 찾는다",
      "경쟁사보다 탁월한 연구개발(R&D) 결실과 신제품 파이프라인을 확인한다",
      "고객, 경쟁사, 공급망 탐문을 통한 사실수집(Scuttlebutt)으로 경영진의 정직성을 검증한다",
      "진정으로 위대한 기업을 발굴했다면 주가가 단기 급등해도 쉽게 팔지 않는다",
    ],
    keyCriteria: "R&D 투자 효율, 영업이익률 개선 추세, 장기 구조적 매출 성장률",
    checklistRules: [
      { title: "장기 매출 성장성", desc: "수년간 시장 평균을 월등히 초과할 신제품/시장 개척 역량" },
      { title: "R&D 투자 효율", desc: "투입된 연구개발비 대비 상업적 성공으로 이어지는 신제품 비율" },
      { title: "영업이익률 방어력", desc: "원가 상승기에도 마진을 유지하거나 확대할 수 있는 원가 절감/가격 결정력" },
      { title: "경영진의 솔직함", desc: "실적이 부진할 때 변명하지 않고 주주에게 투명하게 소통하는 태도" },
    ],
    focusMetrics: ["매출 성장률", "R&D 비중", "영업이익률 추세", "매출총이익률"],
  },
  templeton: {
    slug: "templeton",
    name: "존 템플턴",
    englishName: "John Templeton",
    style: "글로벌 역발상 / 극단적 비관론 매수",
    oneLiner: "극단적 비관론(Maximum Pessimism) 시점의 역발상 매수",
    bookTitle: "주식 투자 원칙",
    bookSummary: "가장 비관적인 순간이 바로 최고의 매수 시점이다. 전 세계 시장을 스크리닝하여 공포와 투매로 헐값이 된 우량 자산을 5년 안목으로 담아라.",
    quote: "강세장은 비관 속에서 태어나, 회의 속에서 자라며, 낙관 속에서 성숙해, 행복감 속에서 죽어간다. 최고의 매수 타이밍은 극단적 비관의 순간이다.",
    valuationMethod: "역사적 최저점 PER/PBR 밴드, 5년 장기 실적 정상화 가치 산출. 글로벌 전 세계 시장 비교 저평가 국가/섹터 스크리닝.",
    philosophy: [
      "시장이 가장 비관적일 때가 최고의 매수 기회다 (Maximum Pessimism)",
      "전 세계 글로벌 시장을 대상으로 가장 헐값에 거래되는 종목을 찾는다",
      "대중과 반대로 행동할 수 있는 담대한 독립적 사고와 겸손함을 유지한다",
      "5년 이상의 장기 시계를 가지고 일시적 위기가 정상화될 때까지 기다린다",
    ],
    keyCriteria: "장기 역사적 저점 밸류에이션, 극단적 악재 선반영 여부",
    checklistRules: [
      { title: "극단적 비관론 반영", desc: "악재와 스캔들로 인해 대중이 완전히 투매하여 역사적 저점에 도달" },
      { title: "5년 후 실적 정상화", desc: "단기 위기가 지나간 후 5년 내 기업 펀더멘털이 원상 복구될 구조적 생존력" },
      { title: "글로벌 상대 비교", desc: "동일 업종 내 전 세계 경쟁사 대비 가장 저렴한 밸류에이션" },
      { title: "겸손한 분산 투자", desc: "예측 실패 가능성을 인정하고 다수의 글로벌 저평가 종목으로 분산" },
    ],
    focusMetrics: ["역사적 PER 밴드", "PBR 저점", "글로벌 동종업종 비교", "5년 정상화 EPS"],
  },
  kostolany: {
    slug: "kostolany",
    name: "앙드레 코스톨라니",
    englishName: "André Kostolany",
    style: "투자 심리학 / 코스톨라니 달걀 모형",
    oneLiner: "코스톨라니 달걀 모형, 금리와 유동성, 대중 심리 사이클",
    bookTitle: "돈, 뜨겁게 사랑하고 차갑게 다루어라",
    bookSummary: "주식 시장의 90%는 심리학이다. 코스톨라니 달걀 모형(금리와 유동성 순환)을 통해 소신파 투자자가 되어 부화뇌동파의 공포를 기회로 바꾸어라.",
    quote: "주가 = 돈(유동성) + 심리다. 우량주를 사고 수면제를 먹어라. 몇 년 뒤 깨어나면 부자가 되어 있을 것이다.",
    valuationMethod: "코스톨라니 달걀(금리 순환과 주식 3단계 사이클: 조정-동행-과열). 부화뇌동파가 투매하는 국면에서 소신파 매수 집행.",
    philosophy: [
      "주가 = 돈(유동성) + 심리",
      "달걀 모형에서 금리 정점과 과매도 침체기를 식별하여 선제 진입한다",
      "소신파 투자자가 되어 부화뇌동파 대중에게 주식을 넘겨받는다",
      "단기 시세판의 잔파도에 일희일비하지 않고 큰 사이클의 흐름을 탄다",
    ],
    keyCriteria: "금리/유동성 환경, 시장 심리 과열/공포 단계, 거래량 변화",
    checklistRules: [
      { title: "코스톨라니 달걀 위치", desc: "금리 인하 국면 및 거래량이 줄어들며 주가가 바닥을 다지는 조정 국면 식별" },
      { title: "소신파 vs 부화뇌동파", desc: "대중이 주식을 포기하고 소신파의 주머니로 주식이 이동하는 거래량 징후" },
      { title: "장기 비전과 인내", desc: "단기 소음과 뉴스에 휘둘리지 않고 수년간 보유할 수 있는 우량 비즈니스" },
      { title: "유동성 환경", desc: "중앙은행의 통화 정책과 거시 유동성이 주식 시장으로 유입될 가능성" },
    ],
    focusMetrics: ["금리 추이", "VIX", "거래량 추세", "주가 모멘텀"],
  },
  schwager: {
    slug: "schwager",
    name: "잭 슈웨거",
    englishName: "Jack Schwager",
    style: "시장 마법사 / 트레이딩 심리 & 리스크 관리",
    oneLiner: "손익비(Risk/Reward), 리스크 관리, 최적 진입 타이밍",
    bookTitle: "마켓 위저드",
    bookSummary: "월가 최고 트레이더들의 공통점은 정확한 예측이 아닌 철저한 리스크 관리다. 손익비 3:1 이상의 구간에서만 진입하고 칼같이 손절하라.",
    quote: "위대한 트레이더들의 공통점은 예측 능력이 아니라 완벽한 리스크 관리와 손실 제한 규율이다.",
    valuationMethod: "손익비(Risk/Reward) 3:1 이상 보장 구간 판별. 변동성 수축(%B) 및 중요 지지선 이탈 시 기계적 손절매(Stop-loss) 원칙.",
    philosophy: [
      "가치뿐 아니라 손익비가 유리한 진입 타이밍과 손절 기준을 세운다",
      "손실은 작게 자르고 이익은 길게 가져가는 포지션 사이징을 지킨다",
      "볼린저 밴드와 변동성 수축 후 확장을 관찰하여 효율적인 타이밍을 포착한다",
      "자신만의 명확한 원칙을 세우고 심리적 흔들림 없이 기계적으로 실행한다",
    ],
    keyCriteria: "손익비 3:1 이상, 지지선 근접성, 변동성 지표(%B)",
    checklistRules: [
      { title: "비대칭 손익비 (≥ 3:1)", desc: "손절 폭 대비 목표 수익 폭이 최소 3배 이상 확보되는 자리" },
      { title: "주요 지지선 근접성", desc: "강력한 기술적/기본적 지지선 바로 위에서 진입하여 리스크 최소화" },
      { title: "변동성 수축(%B)", desc: "볼린저 밴드 중심선 부근에서 에너지가 응축된 후 상방 확장 국면" },
      { title: "포지션 사이징 규율", desc: "단일 종목 손실이 전체 포트폴리오의 1~2%를 넘지 않도록 비중 조절" },
    ],
    focusMetrics: ["%B", "손익비", "52주 변동폭", "변동성"],
  },
  nyresident: {
    slug: "nyresident",
    name: "뉴욕주민",
    englishName: "NY Resident",
    style: "실전 월스트리트 가치평가 / 기업공시 & 헤지펀드 실무",
    oneLiner: "월가 헤지펀드 실전 재무 분석, 컨센서스 팩트체크",
    bookTitle: "미국 주식 투자지도",
    bookSummary: "미국 주식 투자의 진실은 SEC 공시(10-K, 10-Q)에 있다. 헤지펀드 시각에서 밸류체인 독점력과 컨센서스 괴리를 파악하고 밸류 트랩을 피하라.",
    quote: "뉴스 헤드라인에 속지 말고 SEC 공시 원문(10-K, 10-Q)의 각주와 현금흐름표를 봐라. 시장의 기만은 언제나 숫자 속에서 드러난다.",
    valuationMethod: "EBITDA 마진과 잉여현금흐름 전환율, SBC(주식기준보상) 희석을 반영한 진정한 주당 가치 산출. 월가 가이던스 대비 컨센서스 괴리 추적.",
    philosophy: [
      "섹터 밸류체인과 GICS 분류를 먼저 이해하고 종목의 위치를 본다",
      "가이던스 대비 컨센서스 괴리와 어닝 서프라이즈 모멘텀을 추적한다",
      "실제 현금흐름표와 이익의 질(Quality of Earnings)을 팩트체크한다",
      "주식기준보상(SBC)으로 인한 주주가치 희석과 실질 자사주 매입 소각 효과를 검증한다",
    ],
    keyCriteria: "어닝 퀄리티, 가이던스 신뢰성, 밸류체인 독점력",
    checklistRules: [
      { title: "SEC 공시 팩트체크", desc: "10-K 주석 및 특수관계자 거래, 잠재적 소송/부외 부채 전수 확인" },
      { title: "실질 주주환원율", desc: "SBC 희석분을 차감한 순(Net) 자사주 매입 소각 및 배당 수익률" },
      { title: "어닝 퀄리티(CFO/NI)", desc: "영업활동현금흐름이 당기순이익을 100% 이상 뒷받침하는지 여부" },
      { title: "밸류체인 독점력", desc: "전방 고객사와 후방 공급사에 대한 강력한 협상력과 가격 전가력" },
    ],
    focusMetrics: ["영업현금흐름 비율", "매출 총이익률", "어닝 서프라이즈", "SBC 희석률"],
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
