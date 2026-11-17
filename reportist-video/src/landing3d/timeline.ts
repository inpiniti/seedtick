// The single GSAP master timeline. It is paused and scrubbed by scroll
// progress rather than playing on its own — every transform is a pure
// function of progress, so scrubbing backwards is perfectly reversible.

import gsap from "gsap";
import type { CoreState } from "./state";

export type MasterTimeline = ReturnType<typeof buildTimeline>;

export function buildTimeline(state: CoreState) {
  const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.inOut" } });

  // ── Act 1 (0.00 → 0.25) · Capture ────────────────────────────────────────
  // The wide ring converges, six climax clips lock into the core, the
  // camera eases in from a long, slightly off-axis establishing shot.
  tl.to(
    state,
    {
      converge: 1,
      ringSpin: 1.15,
      camAz: 0.03,
      camEl: 0.13,
      camDist: 8.6,
      coreScale: 0.86,
      coreOpacity: 1,
      duration: 0.25,
      ease: "power1.inOut",
    },
    0
  );

  // ── Act 2 (0.25 → 0.55) · Explode ────────────────────────────────────────
  // Camera swings to a low isometric angle; the six 3D layers bloom apart
  // in Z and tilt, the ring recedes into the dark.
  tl.to(
    state,
    {
      camAz: -0.66,
      camEl: 0.36,
      camDist: 7.25,
      camLookX: 0.5,
      fov: 42,
      ringOpacity: 0.18,
      e0: 1,
      e1: 1,
      e2: 1,
      e3: 1,
      e4: 1,
      e5: 1,
      r0: 0.5,
      r1: -0.42,
      r2: 0.3,
      r3: -0.28,
      r4: 0.22,
      r5: -0.18,
      duration: 0.3,
      ease: "power2.inOut",
    },
    0.25
  );

  // ── Act 3 (0.55 → 0.80) · Reassemble ─────────────────────────────────────
  // The camera orbits almost a full turn while the layers slam home in
  // three waves; a light plane sweeps through the assembled block.
  tl.to(state, { e0: 0, e1: 0, r0: 0, r1: 0, duration: 0.1 }, 0.55);
  tl.to(state, { e2: 0, e3: 0, r2: 0, r3: 0, duration: 0.1 }, 0.62);
  tl.to(state, { e4: 0, e5: 0, r4: 0, r5: 0, duration: 0.1 }, 0.69);
  tl.to(
    state,
    {
      camAz: 0.78,
      camEl: 0.2,
      camDist: 7.9,
      camLookX: 0,
      fov: 39,
      scan: 1,
      ringOpacity: 0.46,
      duration: 0.25,
      ease: "power1.inOut",
    },
    0.55
  );
  tl.to(state, { scanOpacity: 0.9, duration: 0.06 }, 0.6);
  tl.to(state, { scanOpacity: 0, duration: 0.1 }, 0.74);

  // ── Act 4 (0.80 → 1.00) · Dual Morph ─────────────────────────────────────
  // The block turns to camera, dims, and two mechanical slabs — 16:9 and
  // 9:16 — split apart to hand the viewer off to the real theater player.
  tl.to(
    state,
    {
      camAz: 0,
      camEl: 0.04,
      camDist: 6.8,
      camLookX: 0,
      fov: 38,
      coreScale: 0.9,
      coreOpacity: 0.12,
      scanOpacity: 0,
      ringOpacity: 0,
      split: 1,
      splitRot: 1,
      dualOpacity: 1,
      duration: 0.2,
      ease: "power2.inOut",
    },
    0.8
  );

  tl.progress(0).pause();
  return tl;
}
