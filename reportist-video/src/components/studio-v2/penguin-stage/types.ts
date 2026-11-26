/** 스테이지 로컬 좌표 (ystandard: 아래쪽이 +y). */
export interface Vec2 {
  x: number;
  y: number;
}

/** 스테이지 로컬 좌표 기반 AABB. */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

import type { AnimalSpecies } from './species.ts';

/** 눈 위에 남는 발자국 스탬프. bornAt은 performance.now() 기준 ms. */
export interface Footprint {
  x: number;
  y: number;
  angle: number;
  sign: 1 | -1;
  bornAt: number;
}

/** 설원 위를 아주 느리게 흩날리는 초미세 눈송이. */
export interface SnowParticle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  phase: number;
  opacity: number;
}

/** 우클릭 목표 지점에 번지는 2.5D 파동. */
export interface Ping {
  x: number;
  y: number;
  bornAt: number;
}

/** 펭귄의 연속적인 물리·애니메이션 상태. */
export interface PenguinState {
  /** 접지점(양발 사이 바닥) 좌표. 몸통 중심이 아니다. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 진행 방향(rad, atan2(vy, vx)). */
  heading: number;
  /** 보행 위상(rad). sin의 영교차점이 착지 타이밍. */
  walkCycle: number;
  prevWalkSin: number;
  /** 정지(0) ↔ 보행(1) 블렌드. 기울기·롤·바운스 강도에 사용. */
  moveBlend: number;
  /** 남은 경유 웨이포인트. 첫 점이 현재 목표. */
  waypoints: Vec2[];
  /** 최종 목적지(작은 점으로 표시). */
  target: Vec2 | null;
  /** idle 시 두리번거리는 시선 오프셋(rad). */
  lookOffset: number;
  lookTarget: number;
  nextIdleAt: number;
  idleUntil: number;
  flapUntil: number;
  nextBlinkAt: number;
  blinkUntil: number;
  /** 착지 순간의 스쿼시&스트레치 임펄스(0~1, 감쇠). */
  squash: number;
  /** 마지막 이동 명령 이후 자동 배회를 시작할 시각(performance.now()). */
  nextWanderAt: number;
  /** 배회 목표에 도착하지 못했을 때 강제로 포기하는 시각. 0이면 감시 비활성. */
  wanderDeadlineAt: number;
  /** 마지막으로 확인한 웨이포인트 거리. 전진이 멈췄는지 판단하는 기준. */
  wanderLastDist: number;
  /** 배회 중에는 보행 속도를 낮춘다. */
  isWandering: boolean;
}

/** 개체 머리 위·아래에 뜨는 말풍선. */
export interface SpeechBubbleData {
  text: string;
  /** 상단 캡션. 예: "고양이 · INTP" */
  header?: string;
  imageUrl?: string;
  bornAt: number;
  durationMs: number;
  /** 여러 발언 동안 화면에 남는다. */
  persistent?: boolean;
  /** 최근 발언일수록 진하게(1), 오래된 발언일수록 연하게(0~1) 그린다. */
  opacity?: number;
}

/** 스테이지에 동시에 존재하는 개체 하나. */
export interface StageAgent {
  id: number;
  species: AnimalSpecies;
  physics: PenguinState;
  isWandering: boolean;
  nextWanderAt: number;
  wanderGoal: Vec2 | null;
  bubble?: SpeechBubbleData;
}

/** 설계 목업의 resolveCutePalette('pastel', dark)와 1:1 대응하는 팔레트. */
export interface Palette {
  snowBg: string;
  inkRgb: string;
  outline: string;
  outerRim: string;
  coat: string;
  coatHighlight: string;
  faceMask: string;
  belly: string;
  eye: string;
  beakFill: string;
  footFill: string;
  cheek: string;
  shadow: string;
}
