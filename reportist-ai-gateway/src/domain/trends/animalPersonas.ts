// animalPersonas.ts - /v1/trends 대본 생성에 쓰이는 12종 동물의 MBTI 페르소나
// reportist-video의 penguin-stage/species.ts와 동일한 배정표를 사용한다.

export const ANIMAL_PERSONAS = [
  {
    species: 'penguin',
    label: '펭귄',
    mbti: 'ENFJ',
    keyword: '다정한 진행러',
    style: '화제를 따뜻하게 꺼내고 친구들 의견을 챙김',
  },
  {
    species: 'cat',
    label: '고양이',
    mbti: 'INTP',
    keyword: '시크한 분석가',
    style: '쿨하게 원리나 팩트를 툭 던지는 호기심파',
  },
  {
    species: 'dog',
    label: '강아지',
    mbti: 'ENFP',
    keyword: '해피 리액션러',
    style: '뭐든 신나서 같이 해보자고 반기는 열정파',
  },
  {
    species: 'rabbit',
    label: '토끼',
    mbti: 'ESFP',
    keyword: '트렌드 인싸',
    style: '요즘 유행에 제일 민감하고 통통 튀는 현장파',
  },
  {
    species: 'bear',
    label: '곰',
    mbti: 'ISFJ',
    keyword: '포근한 수호자',
    style: '먹을 것·안정감·현실적인 편안함을 중시',
  },
  {
    species: 'fox',
    label: '여우',
    mbti: 'ENTP',
    keyword: '재치 반박러',
    style: '익살스러운 반문과 색다른 관점으로 티키타카 유도',
  },
  {
    species: 'panda',
    label: '판다',
    mbti: 'INFP',
    keyword: '느긋한 몽상가',
    style: '누워서 감성적이고 평화로운 상상을 덧붙임',
  },
  {
    species: 'koala',
    label: '코알라',
    mbti: 'ISTP',
    keyword: '마이웨이 효율러',
    style: '에너지 절약주의, 짧고 담백한 현실 한마디',
  },
  {
    species: 'squirrel',
    label: '다람쥐',
    mbti: 'ESTJ',
    keyword: '꼼꼼한 계획러',
    style: '가성비·실용성·준비물부터 따지는 실행파',
  },
  {
    species: 'raccoon',
    label: '너구리',
    mbti: 'ESTP',
    keyword: '호기심 해결사',
    style: '고민보다 일단 직접 해봐야 직성이 풀리는 행동파',
  },
  {
    species: 'polar-bear',
    label: '북극곰',
    mbti: 'INFJ',
    keyword: '차분한 통찰가',
    style: '설원의 큰형님처럼 깊고 다정한 통찰 한마디',
  },
  {
    species: 'owl',
    label: '올빼미',
    mbti: 'INTJ',
    keyword: '밤의 전략가',
    style: '유행 이면의 흐름과 결론을 차분히 정리',
  },
] as const;

export type TrendAnimalSpecies = (typeof ANIMAL_PERSONAS)[number]['species'];

export const TREND_ANIMAL_SPECIES: TrendAnimalSpecies[] = ANIMAL_PERSONAS.map(
  (persona) => persona.species
);

export const TREND_MBTI = Object.fromEntries(
  ANIMAL_PERSONAS.map((persona) => [persona.species, persona.mbti])
) as Record<TrendAnimalSpecies, string>;

export function isTrendAnimalSpecies(value: unknown): value is TrendAnimalSpecies {
  return typeof value === 'string' && TREND_ANIMAL_SPECIES.includes(value as TrendAnimalSpecies);
}

export interface TrendLine {
  speaker: TrendAnimalSpecies;
  mbti: string;
  text: string;
}

export interface TrendTopicBase {
  keyword: string;
  topic: string;
  context: string;
  lines?: TrendLine[];
}

export interface TrendTopicItem extends TrendTopicBase {
  lines: TrendLine[];
}

/** LLM 응답에서 대사 한 줄을 정리한다. 코드블록·따옴표·과도한 길이를 잘라낸다. */
export function cleanTrendLine(raw: string): string {
  return raw
    .replace(/```/g, '')
    .replace(/^["'“”‘’`*#>~\s]+|["'“”‘’`*~\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

/** 각 동물의 말투를 살린 결정론적 대사 템플릿. {k}는 화제 핵심어로 치환한다. */
const LINE_TEMPLATES: Record<TrendAnimalSpecies, readonly string[]> = {
  penguin: ['다들 {k} 어때? 내가 먼저 꺼낼게!', '너희 생각이 제일 궁금해, {k}?'],
  cat: ['{k}? 음, 원리가 궁금하네.', '그 {k} 말인데, 근거가 뭐야?'],
  dog: ['{k} 완전 신나! 같이 하자!', '와 {k} 재밌겠다 나도 할래!'],
  rabbit: ['{k} 요즘 제일 핫하지!', '이번 {k}는 진짜 트렌드야~'],
  bear: ['{k} 듣자니 편하네~', '천천히 {k} 같이 즐기자.'],
  fox: ['{k}? 진짜? 나는 반대!', '그 {k}, 다른 얘기도 있지 않아?'],
  panda: ['{k}… 느긋하게 생각 중~', '음 {k} 좋다, 누워서 할래.'],
  koala: ['{k}? 나는 패스, 좀 귀찮아.', '그냥 {k} 넘기자, 에너지 아껴.'],
  squirrel: ['{k} 준비물부터 챙기자!', '{k} 가성비 따져보고 갈래.'],
  raccoon: ['{k} 일단 내가 해볼게!', '고민 말고 {k} 바로 해보자!'],
  'polar-bear': ['{k} 속에 뭐가 있을까?', '{k}, 오래 두고 생각해볼게.'],
  owl: ['{k} 결론은 이거야.', '{k} 흐름을 보면 다 보이네.'],
};

/** LLM 실패·오프라인에서도 항상 MBTI 티키타카가 재생되도록 하는 로컬 대본. */
export function buildDeterministicLines(topic: TrendTopicBase, seed: number): TrendLine[] {
  const keyword = (topic.keyword || topic.topic).slice(0, 8);
  const start = Math.abs(Math.floor(seed)) % ANIMAL_PERSONAS.length;
  const lines: TrendLine[] = [];
  for (let i = 0; i < 8; i++) {
    const persona = ANIMAL_PERSONAS[(start + i) % ANIMAL_PERSONAS.length];
    const templates = LINE_TEMPLATES[persona.species];
    const template = templates[(start + i) % templates.length] ?? templates[0];
    const text = cleanTrendLine(template.replace('{k}', keyword));
    lines.push({
      speaker: persona.species,
      mbti: persona.mbti,
      text: text || `${keyword} 어때?`,
    });
  }
  return lines;
}

/** LLM이 생성한 lines 배열을 검증·정규화한다. MBTI는 서버 배정표를 기준으로 덮어쓴다. */
export function parseTrendLines(raw: unknown, topic: TrendTopicBase, blocked: RegExp): TrendLine[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<TrendAnimalSpecies>();
  const lines: TrendLine[] = [];
  for (const entry of raw.slice(0, 12)) {
    if (!entry || typeof entry !== 'object') continue;
    const rec = entry as Record<string, unknown>;
    if (!isTrendAnimalSpecies(rec.speaker) || seen.has(rec.speaker)) continue;
    const text = cleanTrendLine(typeof rec.text === 'string' ? rec.text : '');
    if (text.length < 4 || blocked.test(`${topic.keyword} ${text}`)) continue;
    seen.add(rec.speaker);
    lines.push({ speaker: rec.speaker, mbti: TREND_MBTI[rec.speaker], text });
  }
  if (lines.length < 3 || blocked.test(`${topic.keyword} ${topic.topic} ${topic.context}`)) {
    return [];
  }
  return lines;
}

/** 주제에 대본을 붙여 최종 응답 스키마로 만든다. 부족한 대사는 결정론적으로 채운다. */
export function attachTrendLines(
  topics: TrendTopicBase[],
  seed: number = Date.now()
): TrendTopicItem[] {
  return topics.map((topic, idx) => ({
    keyword: topic.keyword,
    topic: topic.topic,
    context: topic.context,
    lines:
      topic.lines && topic.lines.length >= 3
        ? topic.lines.slice(0, 8)
        : buildDeterministicLines(topic, seed + idx * 7),
  }));
}
