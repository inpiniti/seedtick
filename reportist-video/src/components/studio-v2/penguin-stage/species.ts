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
  | 'owl';

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
