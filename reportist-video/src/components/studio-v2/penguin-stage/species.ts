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

export type EarStyle = 'none' | 'pointed' | 'round' | 'long' | 'floppy' | 'tuft';
export type FaceStyle = 'heart' | 'round' | 'bandit' | 'patch';
export type TailStyle = 'none' | 'bushy' | 'ringed';

/** 펭귄과 동일한 그림체를 유지하면서 종별 실루엣만 바꾸는 설정. */
export interface AnimalProfile {
  width: number;
  top: number;
  ear: EarStyle;
  earInner: boolean;
  tail: TailStyle;
  face: FaceStyle;
  muzzle: boolean;
  nose: 'beak' | 'dot';
  eyeScale: number;
  foot: 'webbed' | 'paw';
  coatLight: string;
  coatDark: string;
  maskLight: string;
  maskDark: string;
  bellyLight: string;
  bellyDark: string;
}

export const ANIMAL_PROFILES: Record<AnimalSpecies, AnimalProfile> = {
  penguin: {
    width: 1, top: -35, ear: 'none', earInner: false, tail: 'none', face: 'heart',
    muzzle: false, nose: 'beak', eyeScale: 1, foot: 'webbed',
    coatLight: '#3d4451', coatDark: '#384150',
    maskLight: '#e3e7ec', maskDark: '#d9dfe7',
    bellyLight: '#ffffff', bellyDark: '#f8fafc',
  },
  cat: {
    width: 0.92, top: -33, ear: 'pointed', earInner: true, tail: 'none', face: 'heart',
    muzzle: true, nose: 'dot', eyeScale: 1.05, foot: 'paw',
    coatLight: '#454d5b', coatDark: '#3f4856',
    maskLight: '#e6eaf0', maskDark: '#d9dfe7',
    bellyLight: '#fbfcfd', bellyDark: '#f2f5f8',
  },
  dog: {
    width: 1, top: -33, ear: 'floppy', earInner: false, tail: 'none', face: 'round',
    muzzle: true, nose: 'dot', eyeScale: 1, foot: 'paw',
    coatLight: '#554e49', coatDark: '#4a443f',
    maskLight: '#ebe7e2', maskDark: '#d8d4d0',
    bellyLight: '#fbfaf8', bellyDark: '#f2f0ed',
  },
  rabbit: {
    width: 0.88, top: -33, ear: 'long', earInner: true, tail: 'none', face: 'round',
    muzzle: true, nose: 'dot', eyeScale: 1.05, foot: 'paw',
    coatLight: '#9aa4b2', coatDark: '#7d8795',
    maskLight: '#f3f5f8', maskDark: '#e2e8ef',
    bellyLight: '#ffffff', bellyDark: '#f5f7fa',
  },
  bear: {
    width: 1.14, top: -33, ear: 'round', earInner: false, tail: 'none', face: 'round',
    muzzle: true, nose: 'dot', eyeScale: 0.95, foot: 'paw',
    coatLight: '#4a4f5a', coatDark: '#444a55',
    maskLight: '#e4e8ee', maskDark: '#d7dde5',
    bellyLight: '#fafbfc', bellyDark: '#f1f4f7',
  },
  fox: {
    width: 0.96, top: -34, ear: 'pointed', earInner: true, tail: 'bushy', face: 'heart',
    muzzle: true, nose: 'dot', eyeScale: 1, foot: 'paw',
    coatLight: '#5a5149', coatDark: '#4e463f',
    maskLight: '#f0efed', maskDark: '#e2e0dc',
    bellyLight: '#ffffff', bellyDark: '#f5f4f2',
  },
  panda: {
    width: 1.06, top: -34, ear: 'round', earInner: false, tail: 'none', face: 'patch',
    muzzle: true, nose: 'dot', eyeScale: 0.95, foot: 'paw',
    coatLight: '#eef1f5', coatDark: '#dfe4ea',
    maskLight: '#ffffff', maskDark: '#f7f9fb',
    bellyLight: '#ffffff', bellyDark: '#f7f9fb',
  },
  koala: {
    width: 1.02, top: -33, ear: 'round', earInner: true, tail: 'none', face: 'round',
    muzzle: false, nose: 'dot', eyeScale: 0.95, foot: 'paw',
    coatLight: '#606a78', coatDark: '#555e6b',
    maskLight: '#e8ecf1', maskDark: '#d8dfe7',
    bellyLight: '#fafbfc', bellyDark: '#f1f4f7',
  },
  squirrel: {
    width: 0.86, top: -32, ear: 'pointed', earInner: true, tail: 'bushy', face: 'heart',
    muzzle: true, nose: 'dot', eyeScale: 1.1, foot: 'paw',
    coatLight: '#6b6258', coatDark: '#5e564d',
    maskLight: '#efebe5', maskDark: '#ddd8d1',
    bellyLight: '#fbfaf7', bellyDark: '#f1efeb',
  },
  raccoon: {
    width: 0.94, top: -33, ear: 'round', earInner: false, tail: 'ringed', face: 'bandit',
    muzzle: true, nose: 'dot', eyeScale: 1, foot: 'paw',
    coatLight: '#646d7a', coatDark: '#59626e',
    maskLight: '#eceff3', maskDark: '#dce2e9',
    bellyLight: '#fafbfc', bellyDark: '#f1f4f7',
  },
  'polar-bear': {
    width: 1.16, top: -34, ear: 'round', earInner: false, tail: 'none', face: 'round',
    muzzle: true, nose: 'dot', eyeScale: 0.95, foot: 'paw',
    coatLight: '#e8edf2', coatDark: '#cfd8e2',
    maskLight: '#ffffff', maskDark: '#f4f7fa',
    bellyLight: '#ffffff', bellyDark: '#f7f9fb',
  },
  owl: {
    width: 1, top: -33, ear: 'tuft', earInner: false, tail: 'none', face: 'round',
    muzzle: false, nose: 'beak', eyeScale: 1.35, foot: 'paw',
    coatLight: '#4d5665', coatDark: '#454e5c',
    maskLight: '#e6eaf0', maskDark: '#d8dfe7',
    bellyLight: '#fafbfc', bellyDark: '#f1f4f7',
  },
};

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
