/** 스테이지에 등장할 수 있는 동물 종류. */
export const ANIMAL_SPECIES = [
  'penguin',
  'cat',
  'dog',
  'rabbit',
  'bear',
  'fox',
  'panda',
  'koala',
  'squirrel',
  'raccoon',
  'polar-bear',
  'owl',
  'deer',
  'elephant',
  'hedgehog',
  'frog',
] as const;

export type AnimalSpecies = (typeof ANIMAL_SPECIES)[number];

export const ANIMAL_LABELS: Record<AnimalSpecies, string> = {
  penguin: '펭귄',
  cat: '고양이',
  dog: '강아지',
  rabbit: '토끼',
  bear: '곰',
  fox: '여우',
  panda: '판다',
  koala: '코알라',
  squirrel: '다람쥐',
  raccoon: '너구리',
  'polar-bear': '북극곰',
  owl: '올빼미',
  deer: '사슴',
  elephant: '코끼리',
  hedgehog: '고슴도치',
  frog: '개구리',
};

/** 동물별 MBTI 성향 — 게이트웨이 /v1/trends 배정표와 1:1 대응. */
export const ANIMAL_MBTI: Record<AnimalSpecies, string> = {
  penguin: 'ENFJ',
  cat: 'INTP',
  dog: 'ENFP',
  rabbit: 'ESFP',
  bear: 'ISFJ',
  fox: 'ENTP',
  panda: 'INFP',
  koala: 'ISTP',
  squirrel: 'ESTJ',
  raccoon: 'ESTP',
  'polar-bear': 'INFJ',
  owl: 'INTJ',
  deer: 'ISFP',
  elephant: 'ESFJ',
  hedgehog: 'ISTJ',
  frog: 'ESTP',
};

export interface AnimalPersonaInfo {
  mbti: string;
  keyword: string;
  style: string;
}

export const ANIMAL_PERSONAS: Record<AnimalSpecies, AnimalPersonaInfo> = {
  penguin: {
    mbti: ANIMAL_MBTI.penguin,
    keyword: '다정한 진행러',
    style: '화제를 따뜻하게 꺼내고 친구들 의견을 챙김',
  },
  cat: {
    mbti: ANIMAL_MBTI.cat,
    keyword: '시크한 분석가',
    style: '쿨하게 원리나 팩트를 툭 던지는 호기심파',
  },
  dog: {
    mbti: ANIMAL_MBTI.dog,
    keyword: '해피 리액션러',
    style: '뭐든 신나서 같이 해보자고 반기는 열정파',
  },
  rabbit: {
    mbti: ANIMAL_MBTI.rabbit,
    keyword: '트렌드 인싸',
    style: '요즘 유행에 제일 민감하고 통통 튀는 현장파',
  },
  bear: {
    mbti: ANIMAL_MBTI.bear,
    keyword: '포근한 수호자',
    style: '먹을 것·안정감·현실적인 편안함을 중시',
  },
  fox: {
    mbti: ANIMAL_MBTI.fox,
    keyword: '재치 반박러',
    style: '익살스러운 반문과 색다른 관점으로 티키타카 유도',
  },
  panda: {
    mbti: ANIMAL_MBTI.panda,
    keyword: '느긋한 몽상가',
    style: '누워서 감성적이고 평화로운 상상을 덧붙임',
  },
  koala: {
    mbti: ANIMAL_MBTI.koala,
    keyword: '마이웨이 효율러',
    style: '에너지 절약주의, 짧고 담백한 현실 한마디',
  },
  squirrel: {
    mbti: ANIMAL_MBTI.squirrel,
    keyword: '꼼꼼한 계획러',
    style: '가성비·실용성·준비물부터 따지는 실행파',
  },
  raccoon: {
    mbti: ANIMAL_MBTI.raccoon,
    keyword: '호기심 해결사',
    style: '고민보다 일단 직접 해봐야 직성이 풀리는 행동파',
  },
  'polar-bear': {
    mbti: ANIMAL_MBTI['polar-bear'],
    keyword: '차분한 통찰가',
    style: '설원의 큰형님처럼 깊고 다정한 통찰 한마디',
  },
  owl: {
    mbti: ANIMAL_MBTI.owl,
    keyword: '밤의 전략가',
    style: '유행 이면의 흐름과 결론을 차분히 정리',
  },
  deer: {
    mbti: ANIMAL_MBTI.deer,
    keyword: '조용한 관찰가',
    style: '가볍게 두리번거리며 분위기를 살짝 건드림',
  },
  elephant: {
    mbti: ANIMAL_MBTI.elephant,
    keyword: '든든한 기억력',
    style: '예전 이야기를 꺼내며 다정하게 정리해줌',
  },
  hedgehog: {
    mbti: ANIMAL_MBTI.hedgehog,
    keyword: '조심스러운 원칙가',
    style: '한 가지씩 따져보고 조용히 의견을 냄',
  },
  frog: {
    mbti: ANIMAL_MBTI.frog,
    keyword: '통통 튀는 분위기메이커',
    style: '뜬금없이 튀는 농담으로 대화를 살림',
  },
};

export type AnimalArchetype =
  | 'avian'
  | 'feline'
  | 'canine'
  | 'bunny'
  | 'ursine'
  | 'vulpine'
  | 'koala'
  | 'rodent'
  | 'bandit'
  | 'owl'
  | 'cervid'
  | 'proboscidean'
  | 'spiny'
  | 'amphibian';

export type AnimalGait = 'waddle' | 'trot' | 'hop';

export interface SpeciesTheme {
  id: AnimalSpecies;
  archetype: AnimalArchetype;
  gait: AnimalGait;
  dark: boolean;
  coat: string;
  mask: string;
  belly: string;
  accent: string;
  innerEar: string;
  nose: string;
  paw: string;
  outline: string;
  outerRim: string;
  shadow: string;
  blush: string;
  hi: string;
}

export function getSpeciesGait(species: AnimalSpecies): AnimalGait {
  if (species === 'rabbit' || species === 'squirrel') return 'hop';
  if (species === 'cat' || species === 'dog' || species === 'fox' || species === 'raccoon') {
    return 'trot';
  }
  if (species === 'deer' || species === 'hedgehog') return 'trot';
  if (species === 'frog') return 'hop';
  return 'waddle';
}

export function getSpeciesTheme(id: AnimalSpecies, dark: boolean): SpeciesTheme {
  const outline = dark ? '#11161d' : '#181e27';
  const outerRim = dark ? 'rgba(242, 244, 246, 0.85)' : 'rgba(255, 255, 255, 0.85)';
  const shadow = dark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(15, 23, 42, 0.11)';
  const blush = 'rgba(244, 138, 158, 0.58)';
  const hi = dark ? 'rgba(255, 255, 255, 0.26)' : 'rgba(255, 255, 255, 0.55)';

  const map: Record<
    AnimalSpecies,
    Omit<SpeciesTheme, 'id' | 'dark' | 'outline' | 'outerRim' | 'shadow' | 'blush' | 'hi'>
  > = {
    penguin: {
      archetype: 'avian', gait: 'waddle',
      coat: dark ? '#384150' : '#3d4451',
      mask: dark ? '#d9dfe7' : '#e3e7ec',
      belly: '#ffffff', accent: '#f7c552', innerEar: '#f5b8c4',
      nose: '#f7c552', paw: '#f5be45',
    },
    cat: {
      archetype: 'feline', gait: 'trot',
      coat: dark ? '#4b5565' : '#525c6d',
      mask: '#eef1f6', belly: '#ffffff', accent: '#374151',
      innerEar: '#f4b6c2', nose: '#f29aa9', paw: '#ffffff',
    },
    dog: {
      archetype: 'canine', gait: 'trot',
      coat: dark ? '#c28b52' : '#cf975d',
      mask: '#fffaf2', belly: '#ffffff', accent: '#7c5028',
      innerEar: '#7c5028', nose: '#26201c', paw: '#ffffff',
    },
    rabbit: {
      archetype: 'bunny', gait: 'hop',
      coat: dark ? '#e8ecf2' : '#ffffff',
      mask: '#ffffff', belly: '#fff7f9', accent: '#f4b6c2',
      innerEar: '#f6b8c6', nose: '#f294a8', paw: '#ffffff',
    },
    bear: {
      archetype: 'ursine', gait: 'waddle',
      coat: dark ? '#7c5840' : '#8a6248',
      mask: '#f7e6d4', belly: '#f5e2ce', accent: '#5c3e2b',
      innerEar: '#d9b396', nose: '#2a1e17', paw: '#75513a',
    },
    fox: {
      archetype: 'vulpine', gait: 'trot',
      coat: dark ? '#cf6d3c' : '#de7845',
      mask: '#fffaf5', belly: '#ffffff', accent: '#332924',
      innerEar: '#3b302a', nose: '#231c18', paw: '#362c27',
    },
    panda: {
      archetype: 'ursine', gait: 'waddle',
      coat: dark ? '#ebeff5' : '#ffffff',
      mask: '#ffffff', belly: '#ffffff', accent: '#272e38',
      innerEar: '#272e38', nose: '#1e242d', paw: '#272e38',
    },
    koala: {
      archetype: 'koala', gait: 'waddle',
      coat: dark ? '#7d8999' : '#8a96a8',
      mask: '#eef2f7', belly: '#ffffff', accent: '#303742',
      innerEar: '#f5f2f8', nose: '#29303b', paw: '#788496',
    },
    squirrel: {
      archetype: 'rodent', gait: 'hop',
      coat: dark ? '#a66b43' : '#b5764c',
      mask: '#faefe4', belly: '#fffaf4', accent: '#7d4b2a',
      innerEar: '#e8bfa6', nose: '#2c1f18', paw: '#a16640',
    },
    raccoon: {
      archetype: 'bandit', gait: 'trot',
      coat: dark ? '#6e7785' : '#7b8494',
      mask: '#eff2f6', belly: '#e6ebf2', accent: '#2c333e',
      innerEar: '#d5dce6', nose: '#1f252e', paw: '#323946',
    },
    'polar-bear': {
      archetype: 'ursine', gait: 'waddle',
      coat: dark ? '#e5ebf2' : '#f7f9fc',
      mask: '#ffffff', belly: '#ffffff', accent: '#d95b5b',
      innerEar: '#dce4ee', nose: '#222831', paw: '#eef3f8',
    },
    owl: {
      archetype: 'owl', gait: 'waddle',
      coat: dark ? '#6d5c50' : '#7c695b',
      mask: '#f5ece2', belly: '#fbf6f0', accent: '#57473c',
      innerEar: '#57473c', nose: '#f2b84b', paw: '#e8ad43',
    },
    deer: {
      archetype: 'cervid', gait: 'trot',
      coat: dark ? '#9d6a48' : '#b87550',
      mask: dark ? '#d9c2a4' : '#f1d9b9',
      belly: dark ? '#d9c2a4' : '#f1d9b9',
      accent: '#80604c', innerEar: '#e6b894',
      nose: '#4a3326', paw: '#6f513e',
    },
    elephant: {
      archetype: 'proboscidean', gait: 'waddle',
      coat: dark ? '#6f8091' : '#8799aa',
      mask: dark ? '#aebcc8' : '#c2abb0',
      belly: dark ? '#c4d0d4' : '#d2dee1',
      accent: '#6f8091', innerEar: dark ? '#93a4b2' : '#aab9c4',
      nose: '#5c6b78', paw: '#7b8b99',
    },
    hedgehog: {
      archetype: 'spiny', gait: 'trot',
      coat: dark ? '#7a5f4b' : '#94765f',
      mask: dark ? '#cdb69e' : '#ebd7c0',
      belly: dark ? '#d8c4ae' : '#f5e9d9',
      accent: '#6e5847', innerEar: '#d8b99c',
      nose: '#2f241d', paw: '#6e5847',
    },
    frog: {
      archetype: 'amphibian', gait: 'hop',
      coat: dark ? '#6a8a6c' : '#7e9e80',
      mask: dark ? '#cbd3a5' : '#eae0b6',
      belly: dark ? '#cbd3a5' : '#eae0b6',
      accent: '#87a87e', innerEar: '#9dbf94',
      nose: '#4b614d', paw: '#87a87e',
    },
  };

  return { ...map[id], id, dark, outline, outerRim, shadow, blush, hi };
}

const STORAGE_KEY = 'penguincut_stage_animal';

export function getStoredAnimal(): AnimalSpecies {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return ANIMAL_SPECIES.find((s) => s === raw) ?? 'penguin';
  } catch {
    return 'penguin';
  }
}

export function setStoredAnimal(species: AnimalSpecies): void {
  try {
    localStorage.setItem(STORAGE_KEY, species);
  } catch {
    // 저장 실패는 동물 표시에 영향을 주지 않는다.
  }
}

const clamp255 = (v: number): number => Math.max(0, Math.min(250, Math.round(v)));

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 채도를 제거하되 명도 서열을 보존한다. 외곽선·눈·코는 변환하지 않는다. */
function toMonochrome(hex: string, dark: boolean): string {
  const [r, g, b] = hexToRgb(hex);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const v = dark ? clamp255(34 + luminance * 0.82) : clamp255(26 + luminance * 0.9);
  const cool = dark ? 4 : 2;
  return `rgb(${v}, ${clamp255(v + cool)}, ${clamp255(v + cool * 2)})`;
}

/** NPC용 모노크롬 테마. 선택 개체는 기존 getSpeciesTheme 컬러를 그대로 쓴다. */
export function getAgentTheme(id: AnimalSpecies, dark: boolean, colored: boolean): SpeciesTheme {
  const base = getSpeciesTheme(id, dark);
  if (colored) return base;
  return {
    ...base,
    coat: toMonochrome(base.coat, dark),
    mask: toMonochrome(base.mask, dark),
    belly: toMonochrome(base.belly, dark),
    accent: toMonochrome(base.accent, dark),
    innerEar: toMonochrome(base.innerEar, dark),
    paw: toMonochrome(base.paw, dark),
    nose: toMonochrome(base.nose, dark),
  };
}
