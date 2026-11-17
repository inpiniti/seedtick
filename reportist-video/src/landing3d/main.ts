// Public API consumed by the static landing pages (window.Landing3D).
// The engine owns no scroll listeners — landing.js feeds it a normalized
// progress value each animation frame so Lenis stays the single authority.

import { createStage, type Stage } from "./scene";
import { buildCore, type Core } from "./cutCore";
import { createState, type CoreState } from "./state";
import { buildTimeline, type MasterTimeline } from "./timeline";

let stage: Stage | null = null;
let core: Core | null = null;
let state: CoreState = createState();
let timeline: MasterTimeline | null = null;
let ready = false;

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") || canvas.getContext("webgl"))
    );
  } catch {
    return false;
  }
}

export function mount(options: {
  host: HTMLElement;
  imageBase?: string;
}): boolean {
  if (ready) return true;
  if (!options.host || !supportsWebGL()) return false;

  const created = createStage(options.host);
  if (!created) return false;
  stage = created;
  core = buildCore(created.scene, options.imageBase || "/media/reel");
  state = createState();
  timeline = buildTimeline(state);
  ready = true;
  return true;
}

export function update(progress: number, velocity = 0): void {
  if (!ready || !stage || !core || !timeline) return;

  const p = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  timeline.progress(p);

  const time = performance.now() / 1000;
  const camera = stage.camera;
  const mobile = window.innerWidth <= 840;

  const az = state.camAz;
  const el = state.camEl;
  const dist = state.camDist;
  camera.position.set(
    Math.sin(az) * Math.cos(el) * dist,
    Math.sin(el) * dist,
    Math.cos(az) * Math.cos(el) * dist
  );
  // On desktop the core sits left of center so copy can breathe on the right.
  // On mobile it floats high, leaving the lower half for text.
  camera.lookAt(
    mobile ? 0 : 0.42 + state.camLookX,
    mobile ? -0.62 + state.camLookY : state.camLookY,
    0
  );
  if (Math.abs(camera.fov - state.fov) > 0.01) {
    camera.fov = state.fov;
    camera.updateProjectionMatrix();
  }

  core.update(state, time, velocity);
  stage.render();
}

export function resize(): void {
  stage?.resize();
}

export function destroy(): void {
  core?.dispose();
  stage?.dispose();
  core = null;
  stage = null;
  timeline = null;
  ready = false;
}

export function isReady(): boolean {
  return ready;
}
