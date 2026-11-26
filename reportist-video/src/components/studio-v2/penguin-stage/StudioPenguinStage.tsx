import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
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
  requestAnimalLine,
  requestDiscussionBriefing,
  requestDiscussionTopic,
  type DiscussionBriefing,
  type DiscussionEntry,
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

interface DiscussionState {
  topic: string;
  context?: string;
  briefing: DiscussionBriefing | null;
  memberIds: number[];
  turns: number;
  history: DiscussionEntry[];
  repeatCount: number;
  ended: boolean;
}

/** effect 재실행·리마운트에서도 진행 중인 토론이 사라지지 않도록 모듈에 보관한다. */
let activeDiscussion: DiscussionState | null = null;

/** 기술적 안전 상한. 이 값에 도달해도 주제를 바꾸지 않고 요약 후 멈춘다. */
const DISCUSSION_TURN_CAP = 24;
const REPEAT_LIMIT = 2;

function normalizeLine(text: string): string {
  return text.replace(/\s+/g, '').slice(0, 12);
}

function lastSpeakerIdOf(members: StageAgent[], entry: DiscussionEntry | undefined): number | null {
  if (!entry) return null;
  return members.find((member) => member.species === entry.speaker)?.id ?? null;
}

/** 앞선 발언에서 이름이 언급되면 그 동물이, 아니면 최근 덜 말한 동물이 이어받는다. */
function chooseNextSpeaker(
  members: StageAgent[],
  history: DiscussionEntry[],
  lastSpeakerId: number | null
): StageAgent {
  const last = history[history.length - 1];
  if (last) {
    const mentioned = members.find(
      (member) =>
        last.text.includes(ANIMAL_LABELS[member.species]) && member.id !== lastSpeakerId
    );
    if (mentioned) return mentioned;
  }
  const candidates = members.filter((member) => member.id !== lastSpeakerId);
  const pool = candidates.length > 0 ? candidates : members;
  const countFor = (member: StageAgent): number =>
    history.filter((entry) => entry.speaker === member.species).length;
  const min = Math.min(...pool.map(countFor));
  const least = pool.filter((member) => countFor(member) === min);
  return least[Math.floor(Math.random() * least.length)] ?? pool[0] ?? members[0]!;
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
  const [transcript, setTranscript] = useState<DiscussionEntry[]>([]);
  const [briefing, setBriefing] = useState<DiscussionBriefing | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const advanceRef = useRef<() => void>(() => undefined);

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

    // 스테이지 셸은 pointer-events: none 이므로 실제 클릭을 받는 부모에서 위임한다.
    const clickSurface = host.parentElement ?? host;
    const findHitAgent = (x: number, y: number): StageAgent | null => {
      let best: StageAgent | null = null;
      let bestScore = Infinity;
      for (const agent of agentsRef.current) {
        // 몸통은 접지점 위 -35~0px에 그려진다. 전체 실루엣을 타원으로 감싸 클릭을 받는다.
        const dx = (x - agent.physics.x) / 15;
        const dy = (y - (agent.physics.y - 17)) / 24;
        const score = dx * dx + dy * dy;
        if (score < 1 && score < bestScore) {
          bestScore = score;
          best = agent;
        }
      }
      return best;
    };

    const onClick = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(INTERACTIVE_OR_BLOCKED_SELECTOR)) return;
      const rect = host.getBoundingClientRect();
      const best = findHitAgent(event.clientX - rect.left, event.clientY - rect.top);
      if (best) onSelectSpeciesRef.current?.(best.species);
    };

    const onPointerMove = (event: PointerEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(INTERACTIVE_OR_BLOCKED_SELECTOR)) {
        clickSurface.style.cursor = '';
        return;
      }
      const rect = host.getBoundingClientRect();
      const hit = findHitAgent(event.clientX - rect.left, event.clientY - rect.top);
      clickSurface.style.cursor = hit ? 'pointer' : '';
    };

    clickSurface.addEventListener('click', onClick);
    clickSurface.addEventListener('pointermove', onPointerMove);

    const BUBBLE_DURATION_MS = 5600;
    const TURN_GAP_MS = 500;

    let nextTurnAt = 0;
    let pendingSpeech: { agentId: number; text: string; mbti: string } | null = null;

    const finishDiscussion = (reason: string): void => {
      const current = activeDiscussion;
      if (!current || current.ended) return;
      current.ended = true;
      const last = current.history[current.history.length - 1];
      const summary = last
        ? `${reason}. ${ANIMAL_LABELS[last.speaker]} 말처럼 ${last.text}`.slice(0, 130)
        : `${reason}. 잠시 쉬어가자.`;
      pendingSpeech = { agentId: current.memberIds[0] ?? 0, text: summary, mbti: '정리' };
    };

    /** 새 주제는 사용자가 직접 요청할 때만 시작한다. 자동으로 바뀌지 않는다. */
    const advanceTopic = (): void => {
      chatAbortRef.current?.abort();
      chatAbortRef.current = null;
      chatInFlightRef.current = false;
      pendingSpeech = null;
      activeDiscussion = null;
      setTranscript([]);
      setBriefing(null);
      nextTurnAt = 0;
    };
    advanceRef.current = advanceTopic;

    const startConversationTurn = (now: number): void => {
      const agents = agentsRef.current;
      if (
        agents.length < 2 ||
        chatInFlightRef.current ||
        pendingSpeech ||
        now < nextTurnAt ||
        activeDiscussion?.ended
      ) {
        return;
      }

      void (async () => {
        chatInFlightRef.current = true;
        const controller = new AbortController();
        chatAbortRef.current = controller;
        try {
          if (!activeDiscussion) {
            const members = [...agents];
            for (let i = members.length - 1; i > 0; i -= 1) {
              const j = Math.floor(Math.random() * (i + 1));
              [members[i], members[j]] = [members[j], members[i]];
            }
            const topicInfo = await requestDiscussionTopic(controller.signal);
            if (controller.signal.aborted) return;
            const prepared = await requestDiscussionBriefing(
              topicInfo.topic,
              topicInfo.context,
              controller.signal
            );
            if (controller.signal.aborted) return;
            activeDiscussion = {
              topic: topicInfo.topic,
              context: topicInfo.context,
              briefing: prepared,
              memberIds: members.map((member) => member.id),
              turns: 0,
              history: [],
              repeatCount: 0,
              ended: false,
            };
            setBriefing(prepared);
            setTranscript([]);
          }

          const current = activeDiscussion;
          if (!current || current.ended) return;
          if (current.turns >= DISCUSSION_TURN_CAP) {
            finishDiscussion('충분히 이야기했어');
            return;
          }

          const members = current.memberIds
            .map((id) => agents.find((agent) => agent.id === id))
            .filter((agent): agent is (typeof agents)[number] => Boolean(agent));
          if (members.length < 2) {
            activeDiscussion = null;
            return;
          }

          const lastEntry = current.history[current.history.length - 1];
          const lastSpeakerId = lastSpeakerIdOf(members, lastEntry);
          const speaker = chooseNextSpeaker(members, current.history, lastSpeakerId);
          const listener = members[(members.indexOf(speaker) + 1) % members.length] ?? speaker;

          const speech = await requestAnimalLine({
            speaker: speaker.species,
            listener: listener.species,
            previousText: lastEntry?.text,
            previousSpeaker: lastEntry?.speaker,
            topic: current.topic,
            topicContext: current.context,
            briefing: current.briefing ?? undefined,
            turnIndex: current.turns,
            history: current.history,
            signal: controller.signal,
          });
          if (controller.signal.aborted || exportingRef.current) return;

          pendingSpeech = {
            agentId: speaker.id,
            text: speech.text,
            mbti: ANIMAL_MBTI[speaker.species],
          };
          current.turns += 1;
          current.history.push({ speaker: speaker.species, text: speech.text });
          if (current.history.length > 8) current.history.shift();
          setTranscript([...current.history]);

          const recent = current.history.slice(-3).map((entry) => normalizeLine(entry.text));
          if (current.turns >= 4 && new Set(recent).size <= 1) {
            current.repeatCount += 1;
            if (current.repeatCount >= REPEAT_LIMIT) finishDiscussion('같은 이야기가 반복돼');
          } else {
            current.repeatCount = 0;
          }
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
      clickSurface.removeEventListener('click', onClick);
      clickSurface.removeEventListener('pointermove', onPointerMove);
      clickSurface.style.cursor = '';
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

  return (
    <div className="sv2-stage-shell">
      <canvas ref={canvasRef} className="sv2-penguin-stage" aria-hidden="true" />
      <div className="sv2-discussion-controls">
        <button
          type="button"
          className="sv2-discussion-button"
          onClick={() => advanceRef.current()}
        >
          다른 주제로
        </button>
        <button
          type="button"
          className="sv2-discussion-button"
          onClick={() => setShowTranscript((value) => !value)}
        >
          {showTranscript ? '기록 닫기' : '대화 기록'}
        </button>
      </div>
      {showTranscript && (
        <div className="sv2-transcript" role="log" aria-live="polite">
          {briefing && (
            <div className="sv2-transcript-briefing">
              <strong>조사 자료</strong>
              <p>{briefing.background}</p>
              {briefing.facts.map((fact, index) => (
                <p key={`${fact.source}-${index}`}>
                  · {fact.claim} <span>({fact.source})</span>
                </p>
              ))}
              {briefing.limitation && <p className="sv2-transcript-note">{briefing.limitation}</p>}
            </div>
          )}
          {transcript.length === 0 ? (
            <p className="sv2-transcript-empty">동물들이 이야기를 시작하고 있어요.</p>
          ) : (
            transcript.map((entry, index) => (
              <p key={`${index}-${entry.speaker}`}>
                <strong>{ANIMAL_LABELS[entry.speaker]}</strong> {entry.text}
              </p>
            ))
          )}
        </div>
      )}
    </div>
  );
});
