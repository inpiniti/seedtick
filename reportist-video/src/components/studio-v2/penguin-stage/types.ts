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
  /** 배회 중에는 보행 속도를 낮춘다. */
  isWandering: boolean;
}

/** 테마 토큰 + 아기 펭귄 포인트 컬러. RGB 삼원조는 rgba() 합성에 재사용한다. */
export interface Palette {
  snowBg: string;
  bodyWhite: string;
  inkPrimary: string;
  inkTrack: string;
  snowFlake: string;
  /** 부드러운 차콜 외투. */
  coatFill: string;
  /** 순백색 둥근 배·얼굴 마스크. */
  bellyFill: string;
  /** 연회색 가슴 (배와 투톤을 만든다). */
  chestFill: string;
  /** 노란 부리·물갈퀴 발 (원포인트 컬러). */
  accentFill: string;
  /** 부리 아래쪽 음영. */
  accentShade: string;
  /** 볼터치. */
  blushFill: string;
  /** 콩알 눈. */
  eyeFill: string;
  /** 외곽선 — 순수 검정보다 부드러운 차콜. */
  outlineFill: string;
  contactShadow: string;
  inkRgb: string;
}
