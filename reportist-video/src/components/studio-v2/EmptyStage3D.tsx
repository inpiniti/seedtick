// src/components/studio-v2/EmptyStage3D.tsx
// 빈 스테이지에 보여주는 흑백 3D 다이오라마.
// 얼음판 위의 이글루·빙산과 물결치는 바다, 10마리 펭귄이 걷고 수영한다.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const PENGUIN_COUNT = 10;
const TAU = Math.PI * 2;
const ICE_RADIUS = 4.2;
const ICE_SURFACE = 0.2;
const BLACK = 0x111111;
const WHITE = 0xffffff;

interface Penguin {
  root: THREE.Group;
  rig: THREE.Group;
  leftFoot: THREE.Mesh;
  rightFoot: THREE.Mesh;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  angle: number;
  radius: number;
  target: number;
  speed: number;
  phase: number;
  dwell: number;
}

const createPenguin = (
  bodyGeo: THREE.SphereGeometry,
  bellyGeo: THREE.SphereGeometry,
  headGeo: THREE.SphereGeometry,
  beakGeo: THREE.ConeGeometry,
  wingGeo: THREE.SphereGeometry,
  footGeo: THREE.SphereGeometry,
  eyeGeo: THREE.SphereGeometry,
  black: THREE.Material,
  white: THREE.Material,
  gray: THREE.Material
): Penguin => {
  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);

  const body = new THREE.Mesh(bodyGeo, black);
  body.scale.set(1, 1.35, 0.95);
  body.castShadow = true;
  rig.add(body);

  const belly = new THREE.Mesh(bellyGeo, white);
  belly.position.set(0, -0.02, 0.15);
  belly.scale.set(0.82, 1.12, 0.68);
  rig.add(belly);

  const head = new THREE.Mesh(headGeo, black);
  head.position.set(0, 0.46, 0.03);
  head.castShadow = true;
  rig.add(head);

  const beak = new THREE.Mesh(beakGeo, gray);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.44, 0.19);
  rig.add(beak);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, white);
    eye.position.set(side * 0.075, 0.51, 0.16);
    rig.add(eye);
  }

  const leftWing = new THREE.Mesh(wingGeo, black);
  leftWing.position.set(-0.27, 0.05, 0);
  leftWing.rotation.z = -0.28;
  rig.add(leftWing);
  const rightWing = new THREE.Mesh(wingGeo, black);
  rightWing.position.set(0.27, 0.05, 0);
  rightWing.rotation.z = 0.28;
  rig.add(rightWing);

  const leftFoot = new THREE.Mesh(footGeo, gray);
  leftFoot.position.set(-0.12, -0.38, 0.1);
  rig.add(leftFoot);
  const rightFoot = new THREE.Mesh(footGeo, gray);
  rightFoot.position.set(0.12, -0.38, 0.1);
  rig.add(rightFoot);

  const radius = 0.3 + Math.random() * 7;
  return {
    root,
    rig,
    leftFoot,
    rightFoot,
    leftWing,
    rightWing,
    angle: Math.random() * TAU,
    radius,
    target: 0.5 + Math.random() * 6.8,
    speed: (0.12 + Math.random() * 0.15) * (Math.random() < 0.5 ? -1 : 1),
    phase: Math.random() * TAU,
    dwell: 1.5 + Math.random() * 4,
  };
};

const createIgloo = (
  white: THREE.Material,
  lineMaterial: THREE.LineBasicMaterial
): THREE.Group => {
  const group = new THREE.Group();
  const radius = 1.15;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 20, 10, 0, TAU, 0, Math.PI / 2),
    white
  );
  dome.castShadow = true;
  group.add(dome);

  for (const lat of [0.32, 0.63, 0.94, 1.25]) {
    const ringRadius = radius * Math.sin(lat);
    const y = radius * Math.cos(lat);
    const points = Array.from({ length: 33 }, (_, i) => {
      const a = (i / 32) * TAU;
      return new THREE.Vector3(Math.cos(a) * ringRadius, y, Math.sin(a) * ringRadius);
    });
    group.add(
      new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), lineMaterial)
    );
  }

  const doorShape = new THREE.Shape();
  doorShape.moveTo(-0.32, 0);
  doorShape.lineTo(-0.32, 0.34);
  doorShape.absarc(0, 0.34, 0.32, Math.PI, 0, true);
  doorShape.lineTo(0.32, 0);
  doorShape.closePath();
  const door = new THREE.Mesh(
    new THREE.ShapeGeometry(doorShape),
    new THREE.MeshBasicMaterial({ color: BLACK, side: THREE.DoubleSide })
  );
  door.position.set(0, 0.01, radius * 0.96);
  group.add(door);

  return group;
};

const WATER_VERTEX = `
  uniform float uTime;
  varying float vWave;
  void main() {
    vec3 p = position;
    float w = sin(p.x * 0.5 + uTime * 0.9) * 0.11
            + sin(p.y * 0.72 - uTime * 0.75) * 0.08
            + sin((p.x + p.y) * 0.32 + uTime * 0.55) * 0.06;
    p.z += w;
    vWave = w;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const WATER_FRAGMENT = `
  varying float vWave;
  void main() {
    float shade = 0.97 - vWave * 0.3;
    float contour = smoothstep(0.487, 0.5, abs(fract(vWave * 10.0 + 0.5) - 0.5));
    vec3 color = mix(vec3(shade), vec3(0.25), contour * 0.28);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export const EmptyStage3D = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(WHITE);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 8.5, 13.5);
    camera.lookAt(0, 0, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      return; // WebGL을 쓸 수 없으면 빈 화면으로 둔다.
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(WHITE, 2.2));
    const sun = new THREE.DirectionalLight(WHITE, 2.4);
    sun.position.set(5, 11, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -10;
    scene.add(sun);

    const white = new THREE.MeshStandardMaterial({ color: WHITE, roughness: 1 });
    const black = new THREE.MeshStandardMaterial({ color: BLACK, roughness: 0.85 });
    const gray = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 1 });
    const lineMaterial = new THREE.LineBasicMaterial({
      color: BLACK,
      transparent: true,
      opacity: 0.38,
    });

    // 물결치는 바다 — 정점 변위로 파도를 만들고 높이에 따라 얇은 등고선을 그린다.
    const waterUniforms = { uTime: { value: 0 } };
    const waterGeometry = new THREE.PlaneGeometry(44, 44, 110, 110);
    const waterMaterial = new THREE.ShaderMaterial({
      uniforms: waterUniforms,
      vertexShader: WATER_VERTEX,
      fragmentShader: WATER_FRAGMENT,
    });
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.06;
    scene.add(water);

    // 중앙 얼음판.
    const iceGeometry = new THREE.CylinderGeometry(ICE_RADIUS, ICE_RADIUS * 0.96, 0.4, 40);
    const ice = new THREE.Mesh(iceGeometry, white);
    ice.position.y = 0;
    ice.receiveShadow = true;
    scene.add(ice);
    const iceEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(iceGeometry),
      new THREE.LineBasicMaterial({ color: BLACK, transparent: true, opacity: 0.55 })
    );
    ice.add(iceEdge);

    const igloo = createIgloo(white, lineMaterial);
    igloo.position.set(-2.1, ICE_SURFACE, -1.3);
    igloo.scale.setScalar(0.9);
    scene.add(igloo);

    // 주변 빙산 — 흰 저폴리 면에 검은 외곽선을 얹는다.
    const bergGeometry = new THREE.IcosahedronGeometry(0.85, 0);
    const bergEdgeGeometry = new THREE.EdgesGeometry(bergGeometry);
    const bergEdgeMaterial = new THREE.LineBasicMaterial({ color: BLACK, transparent: true, opacity: 0.55 });
    const bergs: Array<[number, number, number]> = [
      [6.1, -2.8, 1.1],
      [-6.4, 1.8, 0.9],
      [4.6, 5.2, 0.75],
      [-4.9, -5.4, 1.25],
      [7.6, 3.4, 0.65],
    ];
    for (const [x, z, scale] of bergs) {
      const berg = new THREE.Group();
      const mesh = new THREE.Mesh(bergGeometry, white);
      mesh.scale.set(scale, scale * 1.4, scale * 0.85);
      mesh.rotation.y = Math.random() * TAU;
      mesh.castShadow = true;
      berg.add(mesh);
      const edge = new THREE.LineSegments(bergEdgeGeometry, bergEdgeMaterial);
      edge.scale.copy(mesh.scale);
      edge.rotation.copy(mesh.rotation);
      berg.add(edge);
      berg.position.set(x, 0.08, z);
      scene.add(berg);
    }

    const bodyGeo = new THREE.SphereGeometry(0.26, 12, 10);
    const bellyGeo = new THREE.SphereGeometry(0.22, 12, 10);
    const headGeo = new THREE.SphereGeometry(0.18, 12, 10);
    const beakGeo = new THREE.ConeGeometry(0.06, 0.16, 8);
    const wingGeo = new THREE.SphereGeometry(0.12, 8, 6);
    const footGeo = new THREE.SphereGeometry(0.1, 8, 6);
    const eyeGeo = new THREE.SphereGeometry(0.028, 6, 6);

    const penguins = Array.from({ length: PENGUIN_COUNT }, () => {
      const penguin = createPenguin(
        bodyGeo, bellyGeo, headGeo, beakGeo, wingGeo, footGeo, eyeGeo,
        black, white, gray
      );
      penguin.root.scale.setScalar(0.85 + Math.random() * 0.25);
      scene.add(penguin.root);
      return penguin;
    });

    const reducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let raf = 0;
    let running = false;
    let previous = 0;
    let elapsed = 0;

    const renderFrame = (time: number) => {
      waterUniforms.uTime.value = time;

      for (const p of penguins) {
        const onIceRatio = THREE.MathUtils.clamp(
          1 - (p.radius - ICE_RADIUS * 0.85) / (ICE_RADIUS * 0.35),
          0,
          1
        );
        const x = Math.cos(p.angle) * p.radius;
        const z = Math.sin(p.angle) * p.radius;
        const wave =
          Math.sin(x * 0.5 + time * 0.9) * 0.11 +
          Math.sin(z * 0.72 - time * 0.75) * 0.08;
        const surface = THREE.MathUtils.lerp(-0.1 + wave, ICE_SURFACE, onIceRatio);
        const stride = Math.sin(time * (onIceRatio > 0.5 ? 8 : 5) + p.phase);

        p.root.position.set(x, surface, z);
        p.root.rotation.y = Math.atan2(
          -Math.sin(p.angle) * Math.sign(p.speed),
          Math.cos(p.angle) * Math.sign(p.speed)
        );
        p.rig.position.y = 0.42 + Math.abs(stride) * 0.045 * onIceRatio;
        p.rig.rotation.z = THREE.MathUtils.lerp(0.22, stride * 0.04, onIceRatio);
        p.leftFoot.rotation.x = stride * 0.6;
        p.rightFoot.rotation.x = -stride * 0.6;
        p.leftWing.rotation.z = -0.28 - stride * 0.22;
        p.rightWing.rotation.z = 0.28 + stride * 0.22;
      }

      camera.position.x = Math.sin(time * 0.12) * 0.8;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };

    const tick = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, Math.max(0, (now - previous) / 1000));
      previous = now;
      elapsed += dt;
      for (const p of penguins) {
        p.angle += p.speed * dt;
        p.dwell -= dt;
        if (p.dwell <= 0) {
          p.target = Math.random() < 0.5
            ? 0.4 + Math.random() * 3.2
            : ICE_RADIUS * 1.15 + Math.random() * 3;
          p.dwell = 2.5 + Math.random() * 4;
        }
        p.radius += (p.target - p.radius) * Math.min(1, dt * 0.5);
      }
      renderFrame(elapsed);
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (reducedMotion || running) return;
      running = true;
      previous = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      renderer.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      if (reducedMotion || !running) renderFrame(elapsed);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (!document.hidden) start();

    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.geometry.dispose();
        }
      });
      [white, black, gray, lineMaterial, waterMaterial, bergEdgeMaterial].forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div className="sv2-empty-stage-3d" ref={containerRef} aria-hidden="true" />;
};
