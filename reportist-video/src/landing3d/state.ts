// Single source of truth for everything the master timeline animates.
// GSAP tweens these scalar fields; the renderer reads them every frame.

export interface CoreState {
  // Camera (spherical orbit around the film core)
  camAz: number;
  camEl: number;
  camDist: number;
  camLookX: number;
  camLookY: number;
  fov: number;

  // Orbital clip ring
  converge: number;
  ringSpin: number;
  ringOpacity: number;

  // Six film layers — explode distance (e*) and rotation (r*)
  e0: number;
  e1: number;
  e2: number;
  e3: number;
  e4: number;
  e5: number;
  r0: number;
  r1: number;
  r2: number;
  r3: number;
  r4: number;
  r5: number;

  coreScale: number;
  coreOpacity: number;

  // scanner travel + visibility
  scan: number;
  scanOpacity: number;

  // 16:9 / 9:16 dual frame
  split: number;
  splitRot: number;
  dualOpacity: number;
}

export function createState(): CoreState {
  return {
    camAz: -0.28,
    camEl: 0.06,
    camDist: 11.4,
    camLookX: 0,
    camLookY: 0,
    fov: 38,

    converge: 0,
    ringSpin: 0,
    ringOpacity: 1,

    e0: 0,
    e1: 0,
    e2: 0,
    e3: 0,
    e4: 0,
    e5: 0,
    r0: 0,
    r1: 0,
    r2: 0,
    r3: 0,
    r4: 0,
    r5: 0,

    coreScale: 0.62,
    coreOpacity: 0,

    scan: 0,
    scanOpacity: 0,

    split: 0,
    splitRot: 0,
    dualOpacity: 0,
  };
}
