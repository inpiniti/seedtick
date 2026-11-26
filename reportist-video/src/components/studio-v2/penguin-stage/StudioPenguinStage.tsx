import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  buildGrid,
  collectObstacles,
  findNearestWalkable,
  findPath,
  type NavGrid,
} from './navigationGrid.ts';
import {
  createPenguin,
  pruneFootprints,
  setDestination,
  stepPenguin,
} from './penguinPhysics.ts';
import {
  createParticles,
  renderScene,
  resolvePalette,
  stepParticles,
} from './penguinRenderer.ts';
import {
  ANIMAL_LABELS,
  ANIMAL_MBTI,
  ANIMAL_SPECIES,
  getSpeciesGait,
  type AnimalSpecies,
} from './species.ts';
import {
  getLocalScript,
  requestDiscussionScript,
  type DiscussionScript,
} from '../../../services/animalChatService.ts';
import type {
  Footprint,
  Palette,
  Ping,
  SnowParticle,
  StageAgent,
  Vec2,
} from './types.ts';

/** 버튼·프리뷰·타임라인 위 클릭은 기존 UI 동작을 절대 방해하지 않는다. */
export const INTERACTIVE_OR_BLOCKED_SELECTOR = [
  'button',
  'a',
  'input',
  'textarea',
  'select',
  'video',
  'iframe',
  '[role="button"]',
  '[contenteditable="true"]',
  '.sv2-preview-frame',
  '.sv2-preview-empty-card',
  '.sv2-preview-empty-tilt',
  '.sv2-shared-frame',
  '.sv2-transport',
  '.sv2-preview-toggles',
  '.sv2-display-bar',
  '.sv2-status-pill',
].join(', ');

export interface StudioPenguinStageHandle {
  /** .sv2-center 로컬 좌표로 선택된 개체를 보낸다. */
  moveTo(x: number, y: number): void;
}

interface StudioPenguinStageProps {
  isExporting: boolean;
  isVideoPlaying: boolean;
  species: AnimalSpecies;
  onSelectSpecies?: (species: AnimalSpecies) => void;
}

interface LoopControl {
  schedule(): void;
  stop(): void;
}

const TAU = Math.PI * 2;
const SPAWN_RING_RADIUS = 0.34;
const MIN_SEPARATION = 26;
const NPC_SPEED_SCALE = 0.72;
const MAX_FOOTPRINTS_PER_AGENT = 18;
const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const StudioPenguinStage = forwardRef<
  StudioPenguinStageHandle,
  StudioPenguinStageProps
>(function StudioPenguinStage(
  { isExporting, isVideoPlaying, species, onSelectSpecies },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const agentsRef = useRef<StageAgent[]>([]);
  const gridRef = useRef<NavGrid | null>(null);
  const footprintsRef = useRef<Map<number, Footprint[]>>(new Map());
  const particlesRef = useRef<SnowParticle[]>([]);
  const pingRef = useRef<Ping | null>(null);
  const paletteRef = useRef<Palette>(resolvePalette(false));
  const sizeRef = useRef({ width: 0, height: 0 });
  const initializedRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const loopControlRef = useRef<LoopControl | null>(null);
  const remeasureRef = useRef<() => void>(() => undefined);
  const chatInFlightRef = useRef(false);
  const chatAbortRef = useRef<AbortController | null>(null);

  const exportingRef = useRef(isExporting);
  exportingRef.current = isExporting;
  const videoPlayingRef = useRef(isVideoPlaying);
  videoPlayingRef.current = isVideoPlaying;
  const speciesRef = useRef(species);
  speciesRef.current = species;
  const onSelectSpeciesRef = useRef(onSelectSpecies);
  onSelectSpeciesRef.current = onSelectSpecies;

  useImperativeHandle(
    ref,
    () => ({
      moveTo(x: number, y: number): void {
        remeasureRef.current();
        const grid = gridRef.current;
        if (!grid) return;
        const agent = agentsRef.current.find((a) => a.species === speciesRef.current);
        if (!agent) return;
        const now = performance.now();
        const start = { x: agent.physics.x, y: agent.physics.y };
        const goal = findNearestWalkable(grid, { x, y });
        const waypoints = findPath(grid, start, goal);
        setDestination(agent.physics, waypoints, goal, now);
        agent.isWandering = false;
        agent.wanderGoal = goal;
        pingRef.current = {
          x: clamp(x, 0, grid.width),
          y: clamp(y, 0, grid.height),
          bornAt: now,
        };
      },
    }),
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const host = canvas.parentElement;
    if (!host) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    reducedMotionRef.current =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    let dark = document.documentElement.classList.contains('dark');
    paletteRef.current = resolvePalette(dark);

    const spawnAgents = (grid: NavGrid): void => {
      const now = performance.now();
      const centerX = grid.width / 2;
      const centerY = grid.height / 2;
      const baseRadius = Math.min(grid.width, grid.height) * SPAWN_RING_RADIUS;
      const agents: StageAgent[] = [];

      for (let i = 0; i < ANIMAL_SPECIES.length; i++) {
        const angle = (i * TAU) / ANIMAL_SPECIES.length;
        let radius = baseRadius;
        let point: Vec2 = { x: centerX, y: centerY };
        for (let attempt = 0; attempt < 6; attempt++) {
          const raw = {
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius * 0.72,
          };
          point = findNearestWalkable(grid, raw);
          const overlaps = agents.some(
            (a) => Math.hypot(a.physics.x - point.x, a.physics.y - point.y) < MIN_SEPARATION
          );
          if (!overlaps) break;
          radius += 8;
        }
        const physics = createPenguin(point.x, point.y, now);
        physics.heading = Math.PI / 2;
        physics.nextWanderAt = now + 1800 + Math.random() * 3400;
        agents.push({
          id: i,
          species: ANIMAL_SPECIES[i],
          physics,
          isWandering: false,
          nextWanderAt: physics.nextWanderAt,
          wanderGoal: null,
        });
      }
      agentsRef.current = agents;
    };

    const remeasure = (): void => {
      const rect = host.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const width = rect.width;
      const height = rect.height;
      const previous = sizeRef.current;
      sizeRef.current = { width, height };

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const grid = buildGrid(width, height, collectObstacles(host, rect));
      gridRef.current = grid;

      if (!initializedRef.current) {
        spawnAgents(grid);
        initializedRef.current = true;
      } else {
        for (const agent of agentsRef.current) {
          const st = agent.physics;
          const walkable = findNearestWalkable(grid, { x: st.x, y: st.y });
          st.x = walkable.x;
          st.y = walkable.y;
          if (st.target) {
            const goal = findNearestWalkable(grid, st.target);
            st.waypoints = findPath(grid, { x: st.x, y: st.y }, goal);
            st.target = goal;
          }
        }
      }

      const existing = particlesRef.current;
      if (existing.length === 0) {
        particlesRef.current = createParticles(width, height);
      } else if (previous.width > 0 && previous.height > 0) {
        for (const p of existing) {
          p.x = (p.x / previous.width) * width;
          p.y = (p.y / previous.height) * height;
        }
      }
    };
    remeasureRef.current = remeasure;

    const onClick = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(INTERACTIVE_OR_BLOCKED_SELECTOR)) return;
      const rect = host.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      let best: StageAgent | null = null;
      let bestDistance = 16;
      for (const agent of agentsRef.current) {
        const distance = Math.hypot(agent.physics.x - x, agent.physics.y - y);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = agent;
        }
      }
      if (best) onSelectSpeciesRef.current?.(best.species);
    };
    host.addEventListener('click', onClick);

    const BUBBLE_DURATION_MS = 3600;
    const TURN_GAP_MS = 600;

    // 모든 대사는 /v1/trends 단일 응답에서 미리 받아 재생한다. 턴마다 LLM을 호출하지 않는다.
    let script: DiscussionScript = getLocalScript(performance.now());
    let nextScript: DiscussionScript | null = null;
    let scriptCursor = 0;
    let nextTurnAt = 0;
    let pendingSpeech: { agentId: number; text: string; mbti: string } | null = null;
    let scriptFetchAbort: AbortController | null = null;

    const prefetchScript = (): void => {
      scriptFetchAbort?.abort();
      const controller = new AbortController();
      scriptFetchAbort = controller;
      void requestDiscussionScript(controller.signal)
        .then((next) => {
          if (controller.signal.aborted || exportingRef.current) return;
          // 첫 한 마디 전이라면 바로 갈아끼우고, 이미 말이 시작됐으면 다음 순환에 쓴다.
          if (scriptCursor <= 1) {
            script = next;
            scriptCursor = 0;
          } else {
            nextScript = next;
          }
        })
        .catch(() => {
          // 실패해도 로컬 MBTI 대본이 계속 재생된다.
        });
    };
    prefetchScript();

    const startConversationTurn = (now: number): void => {
      const agents = agentsRef.current;
      if (
        agents.length < 2 ||
        chatInFlightRef.current ||
        pendingSpeech ||
        now < nextTurnAt
      ) {
        return;
      }

      void (async () => {
        chatInFlightRef.current = true;
        const controller = new AbortController();
        chatAbortRef.current = controller;
        try {
          if (scriptCursor >= script.lines.length) {
            script = nextScript ?? getLocalScript(now);
            nextScript = null;
            scriptCursor = 0;
            prefetchScript();
          }
          const line = script.lines[scriptCursor];
          if (!line) return;
          scriptCursor += 1;

          const speaker =
            agents.find((a) => a.species === line.speaker) ?? agents[scriptCursor % agents.length];
          if (!speaker) return;
          pendingSpeech = {
            agentId: speaker.id,
            text: line.text,
            mbti: line.mbti || ANIMAL_MBTI[speaker.species],
          };
        } catch {
          // 실패 시 다음 프레임에서 다시 시도한다.
        } finally {
          if (chatAbortRef.current === controller) chatAbortRef.current = null;
          chatInFlightRef.current = false;
        }
      })();
    };

    let raf = 0;
    let running = false;
    let last = 0;
    let accumulator = 0;

    const frame = (timestamp: number): void => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (exportingRef.current || document.hidden) {
        stop();
        return;
      }
      if (last === 0) last = timestamp;
      const rawDt = (timestamp - last) / 1000;
      last = timestamp;
      accumulator += Math.min(Math.max(rawDt, 0), 0.05);

      const grid = gridRef.current;
      if (!grid) return;
      const agents = agentsRef.current;
      const allIdle = agents.every(
        (a) => a.physics.waypoints.length === 0 && a.physics.target === null
      );
      const interval = videoPlayingRef.current && allIdle ? 1 / 24 : 0;
      if (interval > 0 && accumulator < interval) return;
      const dt = Math.min(accumulator, 0.05);
      accumulator = 0;

      const now = performance.now();
      const footprintsByAgent = footprintsRef.current;

      for (const agent of agents) {
        const st = agent.physics;
        const separation: Vec2 = { x: 0, y: 0 };
        for (const other of agents) {
          if (other === agent) continue;
          const dx = st.x - other.physics.x;
          const dy = st.y - other.physics.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 0 && distance < MIN_SEPARATION) {
            const push = (1 - distance / MIN_SEPARATION) * 90;
            separation.x += (dx / distance) * push;
            separation.y += (dy / distance) * push;
          }
        }

        const isSelected = agent.species === speciesRef.current;
        const fresh = stepPenguin(
          st,
          dt,
          now,
          grid,
          getSpeciesGait(agent.species),
          separation,
          isSelected ? 1 : NPC_SPEED_SCALE
        );
        if (fresh.length > 0) {
          for (const fp of fresh) fp.alphaScale = isSelected ? 1 : 0.5;
          const list = footprintsByAgent.get(agent.id) ?? [];
          list.push(...fresh);
          while (list.length > MAX_FOOTPRINTS_PER_AGENT) list.shift();
          pruneFootprints(list, now);
          footprintsByAgent.set(agent.id, list);
        } else {
          const list = footprintsByAgent.get(agent.id);
          if (list) pruneFootprints(list, now);
        }
      }

      if (pendingSpeech) {
        const hasActiveBubble = agents.some(
          (a) => a.bubble && now - a.bubble.bornAt < a.bubble.durationMs
        );
        if (!hasActiveBubble) {
          const target = agents.find((a) => a.id === pendingSpeech?.agentId);
          if (target) {
            target.bubble = {
              text: pendingSpeech.text,
              header: `${ANIMAL_LABELS[target.species]} · ${pendingSpeech.mbti}`,
              bornAt: now,
              durationMs: BUBBLE_DURATION_MS,
            };
            nextTurnAt = now + BUBBLE_DURATION_MS + TURN_GAP_MS;
          }
          pendingSpeech = null;
        }
      }
      // 말풍선이 사라진 뒤 짧게 호흡을 두고 다음 대사를 띄운다.
      if (!chatInFlightRef.current && !pendingSpeech && now >= nextTurnAt) {
        startConversationTurn(now);
      }

      stepParticles(particlesRef.current, dt, grid.width, grid.height, reducedMotionRef.current);
      if (pingRef.current && now - pingRef.current.bornAt > 450) pingRef.current = null;

      renderScene(ctx, {
        width: grid.width,
        height: grid.height,
        now,
        agents,
        footprints: Array.from(footprintsByAgent.values()).flat(),
        particles: particlesRef.current,
        ping: pingRef.current,
        palette: paletteRef.current,
        reducedMotion: reducedMotionRef.current,
        selectedSpecies: speciesRef.current,
      });
    };

    const schedule = (): void => {
      if (running) return;
      running = true;
      last = 0;
      accumulator = 0;
      raf = requestAnimationFrame(frame);
    };

    function stop(): void {
      running = false;
      if (raf !== 0) cancelAnimationFrame(raf);
      raf = 0;
      chatAbortRef.current?.abort();
      chatAbortRef.current = null;
      scriptFetchAbort?.abort();
      scriptFetchAbort = null;
      chatInFlightRef.current = false;
      pendingSpeech = null;
    }

    loopControlRef.current = { schedule, stop };

    const onVisibilityChange = (): void => {
      if (document.hidden) stop();
      else if (!exportingRef.current) schedule();
    };

    const resizeObserver = new ResizeObserver(() => remeasure());
    resizeObserver.observe(host);
    const themeObserver = new MutationObserver(() => {
      const next = document.documentElement.classList.contains('dark');
      if (next !== dark) {
        dark = next;
        paletteRef.current = resolvePalette(next);
      }
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    document.addEventListener('visibilitychange', onVisibilityChange);

    remeasure();
    if (!document.hidden && !exportingRef.current) schedule();

    return () => {
      stop();
      host.removeEventListener('click', onClick);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      loopControlRef.current = null;
      remeasureRef.current = () => undefined;
    };
  }, []);

  useEffect(() => {
    const control = loopControlRef.current;
    if (!control) return;
    if (isExporting) control.stop();
    else if (!document.hidden) control.schedule();
  }, [isExporting]);

  return <canvas ref={canvasRef} className="sv2-penguin-stage" aria-hidden="true" />;
});
