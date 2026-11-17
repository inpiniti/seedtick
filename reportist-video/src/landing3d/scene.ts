// Renderer, camera, lights, and resize handling for the full-screen stage.

import * as THREE from "three";

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  resize: () => void;
  render: () => void;
  dispose: () => void;
}

function dprCap(width: number): number {
  return Math.min(window.devicePixelRatio || 1, width <= 840 ? 1.5 : 2);
}

export function createStage(host: HTMLElement): Stage | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: (window.devicePixelRatio || 1) <= 1.5,
      alpha: true,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }

  const width = host.clientWidth || window.innerWidth;
  const height = host.clientHeight || window.innerHeight;
  renderer.setPixelRatio(dprCap(width));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.setClearColor(0x05080f, 0);
  renderer.domElement.className = "universe-canvas";
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05080f, 0.048);

  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 120);
  camera.position.set(0, 0, 11.4);

  // Three-point studio lighting: soft ambient, warm key, cool rim, warm fill.
  scene.add(new THREE.AmbientLight(0x5b6b8c, 0.95));

  const key = new THREE.DirectionalLight(0xffd9a8, 2.4);
  key.position.set(5, 7, 6);
  scene.add(key);

  const rim = new THREE.PointLight(0x5b9dff, 48, 34);
  rim.position.set(-6, 2, -4);
  scene.add(rim);

  const warm = new THREE.PointLight(0xff9a3c, 32, 26);
  warm.position.set(5, -3, 4);
  scene.add(warm);

  const resize = () => {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(dprCap(w));
    renderer.setSize(w, h, false);
  };
  window.addEventListener("resize", resize, { passive: true });

  return {
    renderer,
    scene,
    camera,
    resize,
    render: () => renderer.render(scene, camera),
    dispose: () => {
      window.removeEventListener("resize", resize);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
