// "The Temporal Cut Core" — the single hero object of the scroll universe.
// 60 orbital clip blocks + a six-layer extruded film core + a dual-format
// mechanical frame. Everything is real 3D geometry and is animated purely
// from the scrubbed timeline state plus a little time-based idle motion.

import * as THREE from "three";
import type { CoreState } from "./state";

export interface Core {
  update: (state: CoreState, time: number, velocity: number) => void;
  dispose: () => void;
}

const WAVE_BARS = [
  26, 44, 62, 38, 55, 74, 48, 30, 58, 82, 96, 64, 36, 52, 70, 42, 28, 60,
  88, 100, 72, 40, 24, 46, 66, 92, 54, 34, 50, 78, 44, 22,
];

export function buildCore(scene: THREE.Scene, imageBase: string): Core {
  const group = new THREE.Group();
  scene.add(group);

  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // Materials whose opacity follows the core fade (coreOpacity).
  const fadeMats: Array<[THREE.Material & { opacity: number }, number]> = [];
  const fade = <T extends THREE.Material & { opacity: number }>(
    mat: T,
    base: number
  ): T => {
    mat.transparent = true;
    fadeMats.push([mat, base]);
    return track(mat);
  };

  const metal = fade(
    new THREE.MeshStandardMaterial({
      color: 0x9aa6b8,
      metalness: 0.9,
      roughness: 0.28,
    }),
    1
  );
  const darkMetal = fade(
    new THREE.MeshStandardMaterial({
      color: 0x273044,
      metalness: 0.75,
      roughness: 0.42,
    }),
    1
  );
  const glass = fade(
    new THREE.MeshPhysicalMaterial({
      color: 0x162034,
      metalness: 0.15,
      roughness: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      side: THREE.DoubleSide,
    }),
    0.92
  );
  const amber = fade(new THREE.MeshBasicMaterial({ color: 0xffb44d }), 1);
  const blue = fade(new THREE.MeshBasicMaterial({ color: 0x67d2ff }), 1);
  const softAmber = fade(
    new THREE.MeshBasicMaterial({
      color: 0xffcf8a,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
    0.55
  );

  const texture = new THREE.TextureLoader().load(`${imageBase}/reel-06.webp`);
  texture.colorSpace = THREE.SRGBColorSpace;
  disposables.push(texture);
  const texture2 = new THREE.TextureLoader().load(`${imageBase}/reel-03.webp`);
  texture2.colorSpace = THREE.SRGBColorSpace;
  disposables.push(texture2);

  /** A rectangular metal picture frame built from four thin beams. */
  const makeFrame = (
    w: number,
    h: number,
    t: number,
    mat: THREE.Material
  ): THREE.Group => {
    const frame = new THREE.Group();
    const beam = (bw: number, bh: number, x: number, y: number) => {
      const mesh = new THREE.Mesh(track(new THREE.BoxGeometry(bw, bh, t)), mat);
      mesh.position.set(x, y, 0);
      frame.add(mesh);
    };
    beam(w, t, 0, h / 2);
    beam(w, t, 0, -h / 2);
    beam(t, h, -w / 2, 0);
    beam(t, h, w / 2, 0);
    return frame;
  };

  // ── 1. Orbital clip ring (60 instanced clip blocks) ────────────────────────
  const RING_N = 60;
  const CLIMAX = new Set([6, 16, 26, 36, 46, 56]);
  const clipMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.55,
      roughness: 0.38,
      transparent: true,
    })
  );
  const ring = new THREE.InstancedMesh(
    track(new THREE.BoxGeometry(0.13, 0.3, 0.055)),
    clipMat,
    RING_N
  );
  ring.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const ringPivot = new THREE.Group();
  ringPivot.rotation.set(-0.16, 0.25, 0);
  ringPivot.add(ring);
  group.add(ringPivot);

  const ringBase: THREE.Vector3[] = [];
  const ringScatter: THREE.Vector3[] = [];
  const ringCenter: THREE.Vector3[] = [];
  for (let i = 0; i < RING_N; i += 1) {
    const a = (i / RING_N) * Math.PI * 2;
    ringBase.push(
      new THREE.Vector3(
        Math.cos(a) * 2.65,
        Math.sin(a) * 2.65 * 0.66,
        -0.55 + Math.sin(a * 3) * 0.22
      )
    );
    const sa = a * 1.7;
    ringScatter.push(
      new THREE.Vector3(
        Math.cos(sa) * (4.1 + (i % 5) * 0.18),
        Math.sin(sa) * 3.05,
        -1.6 + (i % 7) * 0.42
      )
    );
    if (CLIMAX.has(i)) {
      const k = [...CLIMAX].indexOf(i);
      ringCenter.push(
        new THREE.Vector3(-0.95 + k * 0.38, 0.06 + Math.sin(k) * 0.05, 0.62)
      );
    } else {
      ringCenter.push(new THREE.Vector3());
    }
  }
  const ringDummy = new THREE.Object3D();
  const ringColor = new THREE.Color();

  // ── 2. Six-layer extruded film core ────────────────────────────────────────
  const layerGroup = new THREE.Group();
  group.add(layerGroup);

  const OFFSETS = [
    new THREE.Vector3(-0.95, 0.55, 1.05),
    new THREE.Vector3(1.0, 0.5, 0.55),
    new THREE.Vector3(-1.05, -0.3, 0.35),
    new THREE.Vector3(1.05, -0.28, -0.15),
    new THREE.Vector3(-0.6, -0.72, -0.6),
    new THREE.Vector3(0.65, -0.78, -0.9),
  ];
  const layers: THREE.Group[] = [];
  for (let i = 0; i < 6; i += 1) {
    const pivot = new THREE.Group();
    pivot.position.z = (i - 2.5) * 0.13;
    const body = new THREE.Mesh(
      track(new THREE.BoxGeometry(3.0, 1.68, 0.035)),
      glass
    );
    pivot.add(body);
    const rim = makeFrame(3.02, 1.7, 0.02, i % 2 ? metal : darkMetal);
    rim.position.z = 0.012;
    pivot.add(rim);
    layerGroup.add(pivot);
    layers.push(pivot);
  }

  // L1 — Source core: the original clip embedded in a glass slab.
  const photo = new THREE.Mesh(
    track(new THREE.PlaneGeometry(2.92, 1.6)),
    fade(new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }), 1)
  );
  photo.position.z = 0.027;
  layers[0].add(photo);
  const lockChip = new THREE.Mesh(track(new THREE.BoxGeometry(0.44, 0.14, 0.03)), amber);
  lockChip.position.set(-1.0, 0.62, 0.045);
  layers[0].add(lockChip);

  // L2 — AI climax ribbon: an emissive spline with glowing peak nodes.
  const curvePoints = [
    new THREE.Vector3(-1.35, -0.1, 0.03),
    new THREE.Vector3(-0.85, 0.42, 0.05),
    new THREE.Vector3(-0.35, -0.05, 0.04),
    new THREE.Vector3(0.2, 0.55, 0.06),
    new THREE.Vector3(0.75, 0.0, 0.04),
    new THREE.Vector3(1.35, 0.3, 0.03),
  ];
  const curve = new THREE.CatmullRomCurve3(curvePoints);
  const tube = new THREE.Mesh(
    track(new THREE.TubeGeometry(curve, 80, 0.02, 8, false)),
    amber
  );
  layers[1].add(tube);
  for (const point of [curvePoints[1], curvePoints[3], curvePoints[5]]) {
    const node = new THREE.Mesh(track(new THREE.SphereGeometry(0.055, 12, 12)), amber);
    node.position.copy(point).setZ(0.07);
    layers[1].add(node);
  }

  // L3 — Chapter bridges: three slates linked by a guide rail.
  for (let k = 0; k < 3; k += 1) {
    const x = -0.85 + k * 0.85;
    const slate = new THREE.Mesh(track(new THREE.BoxGeometry(0.5, 0.16, 0.025)), darkMetal);
    slate.position.set(x, 0, 0.03);
    layers[2].add(slate);
    const edge = new THREE.Mesh(track(new THREE.BoxGeometry(0.5, 0.02, 0.02)), blue);
    edge.position.set(x, 0.09, 0.05);
    layers[2].add(edge);
    if (k < 2) {
      const link = new THREE.Mesh(track(new THREE.BoxGeometry(0.3, 0.012, 0.012)), metal);
      link.position.set(x + 0.4, 0, 0.03);
      layers[2].add(link);
    }
  }

  // L4 — Kinetic waveform: 32 instanced pillars driven by scroll velocity.
  const WAVE_N = 32;
  const waveMat = fade(
    new THREE.MeshStandardMaterial({
      color: 0xffb44d,
      emissive: 0xff8a1f,
      emissiveIntensity: 0.85,
      metalness: 0.3,
      roughness: 0.35,
    }),
    1
  );
  const wave = new THREE.InstancedMesh(
    track(new THREE.BoxGeometry(0.045, 1, 0.045)),
    waveMat,
    WAVE_N
  );
  wave.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  layers[3].add(wave);
  const waveDummy = new THREE.Object3D();

  // L5 — Subtitle bars with a sweeping highlight.
  const capWidths = [1.5, 1.05, 0.8];
  for (let k = 0; k < 3; k += 1) {
    const bar = new THREE.Mesh(
      track(new THREE.BoxGeometry(capWidths[k], 0.11, 0.02)),
      k === 1 ? amber : darkMetal
    );
    bar.position.set(-1.45 + capWidths[k] / 2, 0.32 - k * 0.24, 0.03);
    layers[4].add(bar);
  }
  const capSweep = new THREE.Mesh(track(new THREE.PlaneGeometry(0.5, 0.14)), softAmber);
  capSweep.position.set(0, 0.08, 0.06);
  layers[4].add(capSweep);

  // L6 — Broadcast frame: four metal corner brackets + HUD lines.
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const bx = sx * 1.36;
      const by = sy * 0.74;
      const horizontal = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.34, 0.03, 0.025)),
        metal
      );
      horizontal.position.set(bx - sx * 0.17, by, 0.03);
      layers[5].add(horizontal);
      const vertical = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.03, 0.24, 0.025)),
        metal
      );
      vertical.position.set(bx, by - sy * 0.12, 0.03);
      layers[5].add(vertical);
    }
  }
  const hudLong = new THREE.Mesh(track(new THREE.BoxGeometry(1.1, 0.014, 0.012)), blue);
  hudLong.position.set(-0.7, 0.5, 0.03);
  layers[5].add(hudLong);
  const hudShort = new THREE.Mesh(track(new THREE.BoxGeometry(0.6, 0.014, 0.012)), metal);
  hudShort.position.set(-0.95, 0.4, 0.03);
  layers[5].add(hudShort);

  // ── 3. Scanner plane (sweeps through the reassembling block) ──────────────
  const scanMat = new THREE.MeshBasicMaterial({
    color: 0x8fe4ff,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  scanMat.transparent = true;
  const scanPlane = new THREE.Mesh(track(new THREE.PlaneGeometry(3.5, 1.9)), track(scanMat));
  scanPlane.position.z = 0.36;
  group.add(scanPlane);
  const scanLineMat = new THREE.MeshBasicMaterial({
    color: 0xd6f6ff,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  scanLineMat.transparent = true;
  const scanLine = new THREE.Mesh(
    track(new THREE.PlaneGeometry(3.5, 0.035)),
    track(scanLineMat)
  );
  scanLine.position.z = 0.37;
  group.add(scanLine);

  // ── 4. Dual-format mechanical frame (16:9 + 9:16) ────────────────────────
  const slabMetal = new THREE.MeshStandardMaterial({
    color: 0x9aa6b8,
    metalness: 0.9,
    roughness: 0.28,
    transparent: true,
    opacity: 0,
  });
  track(slabMetal);
  const makeSlab = (w: number, h: number, tex: THREE.Texture) => {
    const slab = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x121a2b,
      metalness: 0.3,
      roughness: 0.3,
      transparent: true,
      opacity: 0,
    });
    track(bodyMat);
    const faceMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    track(faceMat);
    const body = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, 0.05)), bodyMat);
    const face = new THREE.Mesh(track(new THREE.PlaneGeometry(w - 0.06, h - 0.06)), faceMat);
    face.position.z = 0.031;
    const frame = makeFrame(w, h, 0.03, slabMetal);
    frame.position.z = 0.02;
    slab.add(body, face, frame);
    group.add(slab);
    return { slab, bodyMat, faceMat };
  };
  const wide = makeSlab(3.3, 1.86, texture);
  const tall = makeSlab(1.12, 2.0, texture2);

  // ── 5. Atmosphere: floor grid + drifting dust ───────────────────────────
  const grid = new THREE.GridHelper(26, 26, 0x2b3c5c, 0x162034);
  const gridMat = grid.material as THREE.LineBasicMaterial;
  gridMat.transparent = true;
  gridMat.opacity = 0.26;
  grid.position.y = -2.15;
  group.add(grid);
  track(grid.geometry);
  track(gridMat);

  const PARTICLES = 380;
  const positions = new Float32Array(PARTICLES * 3);
  for (let i = 0; i < PARTICLES; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 18;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 12 - 2;
  }
  const pointsGeo = track(new THREE.BufferGeometry());
  pointsGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const pointsMat = track(
    new THREE.PointsMaterial({
      color: 0x8aa6d8,
      size: 0.028,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  const points = new THREE.Points(pointsGeo, pointsMat);
  group.add(points);

  // ── Per-frame application ──────────────────────────────────────────────────
  const update = (s: CoreState, time: number, velocity: number) => {
    const E = [s.e0, s.e1, s.e2, s.e3, s.e4, s.e5];
    const R = [s.r0, s.r1, s.r2, s.r3, s.r4, s.r5];

    // Orbital ring
    const c = s.converge;
    for (let i = 0; i < RING_N; i += 1) {
      const isClimax = CLIMAX.has(i);
      const target = isClimax ? ringCenter[i] : ringScatter[i];
      ringDummy.position.copy(ringBase[i]).lerp(target, c);
      const spin = time * 0.6 + i * 0.4;
      ringDummy.rotation.set(
        Math.sin(spin) * 0.4,
        spin * 0.5,
        Math.cos(spin * 0.7) * 0.3
      );
      const scale = isClimax ? 1 + c * 0.55 : 1 - c * 0.35;
      ringDummy.scale.setScalar(scale);
      ringDummy.updateMatrix();
      ring.setMatrixAt(i, ringDummy.matrix);
      if (isClimax) {
        ringColor.setRGB(0.22 + c * 0.78, 0.18 + c * 0.52, 0.14 + c * 0.16);
      } else {
        ringColor.setRGB(0.16 - c * 0.1, 0.2 - c * 0.12, 0.28 - c * 0.16);
      }
      ring.setColorAt(i, ringColor);
    }
    ring.instanceMatrix.needsUpdate = true;
    if (ring.instanceColor) ring.instanceColor.needsUpdate = true;
    clipMat.opacity = s.ringOpacity;
    ringPivot.rotation.y = 0.25 + time * 0.12 + s.ringSpin;

    // Six layers: assembled by default, explode outward with tilt.
    for (let i = 0; i < 6; i += 1) {
      const e = E[i];
      const baseZ = (i - 2.5) * 0.13;
      const off = OFFSETS[i];
      layers[i].position.set(off.x * e, off.y * e, baseZ + off.z * e);
      layers[i].rotation.set(
        R[i] * 0.55 + Math.sin(time * 0.4 + i) * 0.012 * e,
        R[i] * 0.4,
        R[i]
      );
    }
    layerGroup.scale.setScalar(s.coreScale);
    for (const [mat, base] of fadeMats) mat.opacity = base * s.coreOpacity;

    // Waveform pillars react to scroll velocity and idle time.
    const boost = Math.min(Math.abs(velocity) * 0.02, 0.85);
    for (let i = 0; i < WAVE_N; i += 1) {
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin(time * 2.2 + i * 0.42));
      const h = 0.06 + (WAVE_BARS[i] / 100) * 0.85 * pulse * (1 + boost);
      waveDummy.position.set(
        -1.32 + i * (2.64 / (WAVE_N - 1)),
        -0.55 + h / 2,
        0.04
      );
      waveDummy.scale.set(1, h, 1);
      waveDummy.updateMatrix();
      wave.setMatrixAt(i, waveDummy.matrix);
    }
    wave.instanceMatrix.needsUpdate = true;

    // Caption highlight sweep.
    capSweep.position.x = -1.2 + (Math.sin(time * 0.9) * 0.5 + 0.5) * 2.4;

    // Scanner sweep.
    const scanY = -1.0 + s.scan * 2.0;
    scanPlane.position.y = scanY;
    scanLine.position.y = scanY;
    scanMat.opacity = s.scanOpacity * 0.16;
    scanLineMat.opacity = s.scanOpacity;

    // Dual-format slabs split apart and fade in.
    wide.slab.position.set(-s.split * 2.25, 0, 0.2 + s.split * 0.2);
    tall.slab.position.set(s.split * 0.25, 0, 0.2 + s.split * 0.2);
    wide.slab.rotation.y = -0.12 * s.splitRot;
    tall.slab.rotation.y = 0.12 * s.splitRot;
    wide.bodyMat.opacity = wide.faceMat.opacity = s.dualOpacity * 0.92;
    tall.bodyMat.opacity = tall.faceMat.opacity = s.dualOpacity * 0.92;
    slabMetal.opacity = s.dualOpacity;

    // Atmosphere
    points.rotation.y = time * 0.012;
    points.rotation.x = Math.sin(time * 0.05) * 0.05;
  };

  const dispose = () => {
    for (const item of disposables) item.dispose();
    scene.remove(group);
  };

  return { update, dispose };
}
