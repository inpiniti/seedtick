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
  reconcilePenguin,
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
  Rect,
  SnowParticle,
  StageAgent,
  Vec2,
} from './types.ts';
import { useI18n } from '../../../i18n/index.tsx';

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
  '.sv2-topbar',
  '.sv2-stage-meta',
  '.sv2-discussion-topic',
  '.sv2-discussion-controls',
  '.sv2-transcript',
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

/** 한 화면에 남길 최근 발언 수와 최근순 강조값. 오래된 말풍선일수록 연하게 그린다. */
const MAX_VISIBLE_BUBBLES = 5;
const BUBBLE_OPACITIES = [1, 0.82, 0.64, 0.46, 0.3];

function refreshBubbleOpacities(agents: StageAgent[]): void {
  const speaking = agents
    .flatMap((agent) => (agent.bubble ? [{ agent, bubble: agent.bubble }] : []))
    .sort((a, b) => b.bubble.bornAt - a.bubble.bornAt);
  speaking.forEach(({ agent, bubble }, index) => {
    if (index >= MAX_VISIBLE_BUBBLES) {
      agent.bubble = undefined;
      return;
    }
    agent.bubble = { ...bubble, opacity: BUBBLE_OPACITIES[index] ?? 0.3 };
  });
}

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
/** 초기 배치 타원이 스테이지에서 차지하는 가로·세로 범위와 세로 중심 위치. */
const SPAWN_SPAN_X = 0.86;
const SPAWN_SPAN_Y = 0.72;
const SPAWN_CENTER_Y = 0.54;
const MIN_SEPARATION = 26;
const MAX_SEPARATION = 70;
const NPC_SPEED_SCALE = 0.72;
const MAX_FOOTPRINTS_PER_AGENT = 18;
const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

/** 장애물 좌표가 실제로 바뀐 경우에만 경로를 다시 계산하기 위한 지문. */
const obstacleKey = (obstacles: ReturnType<typeof collectObstacles>): string =>
  obstacles
    .map((o) =>
      `${Math.round(o.left)}:${Math.round(o.top)}:${Math.round(o.right)}:${Math.round(o.bottom)}`
    )
    .join('|');

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
  const previewRectRef = useRef<Rect | null>(null);
  const paletteRef = useRef<Palette>(resolvePalette(false));
  const sizeRef = useRef({ width: 0, height: 0 });
  const initializedRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const loopControlRef = useRef<LoopControl | null>(null);
  const remeasureRef = useRef<() => void>(() => undefined);
  const chatInFlightRef = useRef(false);
  const chatAbortRef = useRef<AbortController | null>(null);
  const { ui } = useI18n();
  const [transcript, setTranscript] = useState<DiscussionEntry[]>([]);
  const [briefing, setBriefing] = useState<DiscussionBriefing | null>(null);
  // 모듈에 남아 있는 토론을 리마운트 뒤에도 그대로 표시한다.
  const [topic, setTopic] = useState(() => activeDiscussion?.topic ?? '');
  const [topicContext, setTopicContext] = useState(() => activeDiscussion?.context ?? '');
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
        // 도달할 수 없는 지점이면 경로를 세우지 않는다. (장애물에 부딪혀 제자리에서 떨리는 현상 방지)
        if (waypoints.length > 0) {
          setDestination(agent.physics, waypoints, goal, now);
          agent.isWandering = false;
          agent.wanderGoal = goal;
        }
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
    // 미리보기·상단바는 캔버스 부모의 형제/조상에 있으므로 앱 루트에서 장애물을 찾는다.
    const obstacleRoot = host.closest<HTMLElement>('.sv2-root') ?? host.parentElement ?? host;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    reducedMotionRef.current =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    let dark = document.documentElement.classList.contains('dark');
    paletteRef.current = resolvePalette(dark);
    let lastObstacleKey = '';

    /** 중앙 미리보기(빈 상태 카드 포함)의 캔버스 상대 좌표. 원형 얼음 웅덩이 위치. */
    const measurePreviewRect = (origin: DOMRect): Rect | null => {
      const node = obstacleRoot.querySelector<HTMLElement>(
        '.sv2-preview-frame, .sv2-preview-empty-card'
      );
      if (!node) return null;
      const r = node.getBoundingClientRect();
      if (r.width <= 4 || r.height <= 4) return null;
      return {
        left: r.left - origin.left,
        top: r.top - origin.top,
        right: r.right - origin.left,
        bottom: r.bottom - origin.top,
      };
    };

    const spawnAgents = (grid: NavGrid): void => {
      const now = performance.now();
      const centerX = grid.width / 2;
      // 상단바에 가려지지 않도록 타원의 중심을 살짝 아래로 둔다.
      const centerY = grid.height * SPAWN_CENTER_Y;
      const radiusX = (grid.width * SPAWN_SPAN_X) / 2;
      const radiusY = (grid.height * SPAWN_SPAN_Y) / 2;
      const agents: StageAgent[] = [];

      for (let i = 0; i < ANIMAL_SPECIES.length; i++) {
        // 완전한 원형 배열처럼 보이지 않도록 각도에 작은 흔들림을 준다.
        const angle = (i * TAU) / ANIMAL_SPECIES.length + (Math.random() - 0.5) * 0.12;
        let scale = 1;
        let point: Vec2 = { x: centerX, y: centerY };
        for (let attempt = 0; attempt < 6; attempt++) {
          const raw = {
            x: centerX + Math.cos(angle) * radiusX * scale,
            y: centerY + Math.sin(angle) * radiusY * scale,
          };
          point = findNearestWalkable(grid, raw);
          const overlaps = agents.some(
            (a) => Math.hypot(a.physics.x - point.x, a.physics.y - point.y) < MIN_SEPARATION
          );
          if (!overlaps) break;
          scale += 0.05;
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

    const reconcileAgents = (grid: NavGrid): void => {
      for (const agent of agentsRef.current) reconcilePenguin(agent.physics, grid);
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

      const obstacles = collectObstacles(obstacleRoot, rect);
      const grid = buildGrid(width, height, obstacles);
      lastObstacleKey = obstacleKey(obstacles);
      gridRef.current = grid;
      previewRectRef.current = measurePreviewRect(rect);

      if (!initializedRef.current) {
        spawnAgents(grid);
        initializedRef.current = true;
      } else {
        reconcileAgents(grid);
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

    /** 캔버스 크기는 그대로인데 미리보기·상단바가 바뀌는 경우를 반영한다. */
    const refreshObstacles = (): void => {
      const { width, height } = sizeRef.current;
      if (width < 1 || height < 1) return;
      const obstacles = collectObstacles(obstacleRoot, host.getBoundingClientRect());
      const key = obstacleKey(obstacles);
      // 말풍선·주제 등 레이아웃과 무관한 리렌더에 반응해 이동 중 경로를
      // 반복해서 되그리는 것을 막는다.
      if (key === lastObstacleKey) return;
      lastObstacleKey = key;
      const grid = buildGrid(width, height, obstacles);
      gridRef.current = grid;
      previewRectRef.current = measurePreviewRect(host.getBoundingClientRect());
      reconcileAgents(grid);
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

    /** 한 발언이 화면에 머무는 시간. 말풍선은 최근 5개까지 누적해서 유지된다. */
    const TURN_DISPLAY_MS = 5600;
    const TURN_GAP_MS = 500;

    let nextTurnAt = 0;
    let pendingSpeech: { agentId: number; text: string; mbti: string } | null = null;
    let advanceTimer: ReturnType<typeof setTimeout> | null = null;

    /** 요약을 보여준 뒤 새 주제로 넘어간다. 내보내기 중이면 끝날 때까지 미룬다. */
    const scheduleAdvance = (delayMs: number): void => {
      if (advanceTimer !== null) clearTimeout(advanceTimer);
      advanceTimer = window.setTimeout(() => {
        advanceTimer = null;
        if (exportingRef.current) {
          scheduleAdvance(1500);
          return;
        }
        advanceRef.current();
      }, delayMs);
    };

    const finishDiscussion = (reason: string): void => {
      const current = activeDiscussion;
      if (!current || current.ended) return;
      current.ended = true;
      const last = current.history[current.history.length - 1];
      const summary = last
        ? `${reason}. ${ANIMAL_LABELS[last.speaker]} 말처럼 ${last.text}`
        : `${reason}. 잠시 쉬어가자.`;
      pendingSpeech = { agentId: current.memberIds[0] ?? 0, text: summary, mbti: '정리' };
      // 요약 말풍선을 보여준 뒤 아직 토론하지 않은 주제로 자동 전환한다.
      scheduleAdvance(TURN_DISPLAY_MS + TURN_GAP_MS + 600);
    };

    /** 토론을 끝내고 주제를 비운다. 다음 턴에서 안 토론한 새 주제를 요청한다. */
    const advanceTopic = (): void => {
      if (advanceTimer !== null) {
        clearTimeout(advanceTimer);
        advanceTimer = null;
      }
      chatAbortRef.current?.abort();
      chatAbortRef.current = null;
      chatInFlightRef.current = false;
      pendingSpeech = null;
      activeDiscussion = null;
      for (const agent of agentsRef.current) agent.bubble = undefined;
      setTranscript([]);
      setBriefing(null);
      setTopic('');
      setTopicContext('');
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
            setTopic(topicInfo.topic);
            setTopicContext(topicInfo.context ?? '');
            setTranscript([]);
            setBriefing(null);
            const prepared = await requestDiscussionBriefing(
              topicInfo.topic,
              topicInfo.context,
              controller.signal,
              topicInfo.keyword
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
          let dx = st.x - other.physics.x;
          let dy = st.y - other.physics.y;
          let distance = Math.hypot(dx, dy);
          if (distance < MIN_SEPARATION) {
            // 정확히 포개지면 방향이 0이 되어 서로 밀어내지 못하고 굳는다.
            // 개체 id로 결정적인 방향을 정해 항상 풀릴 수 있게 한다.
            if (distance < 0.001) {
              const angle = ((agent.id - other.id + ANIMAL_SPECIES.length) % ANIMAL_SPECIES.length) *
                (TAU / ANIMAL_SPECIES.length);
              dx = Math.cos(angle);
              dy = Math.sin(angle);
              distance = 1;
            }
            const push = (1 - distance / MIN_SEPARATION) * 90;
            separation.x += (dx / distance) * push;
            separation.y += (dy / distance) * push;
          }
        }
        const separationMag = Math.hypot(separation.x, separation.y);
        if (separationMag > MAX_SEPARATION) {
          separation.x = (separation.x / separationMag) * MAX_SEPARATION;
          separation.y = (separation.y / separationMag) * MAX_SEPARATION;
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

      const speech = pendingSpeech;
      if (speech) {
        const target = agents.find((a) => a.id === speech.agentId);
        if (target) {
          target.bubble = {
            text: speech.text,
            header: `${ANIMAL_LABELS[target.species]} · ${speech.mbti}`,
            bornAt: now,
            durationMs: TURN_DISPLAY_MS,
            persistent: true,
          };
          // 최근 5개 발언을 함께 보여주고, 오래된 것일수록 연하게 만든다.
          refreshBubbleOpacities(agents);
          // 지금 말하는 개체를 선택 상태로 자동 전환한다.
          if (speciesRef.current !== target.species) {
            speciesRef.current = target.species;
            onSelectSpeciesRef.current?.(target.species);
          }
          nextTurnAt = now + TURN_DISPLAY_MS + TURN_GAP_MS;
        }
        pendingSpeech = null;
      }
      // 한 발언이 표시된 뒤 짧게 호흡을 두고 다음 대사를 띄운다.
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
        // 동물이 피한 장애물 영역은 말풍선도 피해야 미리보기에 가리지 않는다.
        obstacles: grid.obstacles,
        previewRect: previewRectRef.current,
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

    // 탭 복귀 직후 연속 요청으로 게이트웨이가 폭주하지 않도록 재개를 짧게 지연한다.
    let resumeTimer = 0;
    const onVisibilityChange = (): void => {
      if (resumeTimer !== 0) {
        clearTimeout(resumeTimer);
        resumeTimer = 0;
      }
      if (document.hidden) {
        stop();
      } else if (!exportingRef.current) {
        resumeTimer = window.setTimeout(() => {
          resumeTimer = 0;
          if (!document.hidden && !exportingRef.current) schedule();
        }, 600);
      }
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

    // 빈 미리보기 → 영상 프레임 전환, 가로/세로 전환 등은 host 크기가 그대로이므로
    // DOM 변경을 감지해 장애물 지도만 다시 계산한다.
    let refreshQueued = false;
    const layoutObserver = new MutationObserver((records) => {
      // 대화 기록의 매 턴 추가는 장애물과 무관하므로 무시한다.
      if (
        records.every((record) =>
          Boolean((record.target as HTMLElement | null)?.closest?.('.sv2-transcript'))
        )
      ) {
        return;
      }
      if (refreshQueued) return;
      refreshQueued = true;
      requestAnimationFrame(() => {
        refreshQueued = false;
        if (loopControlRef.current) refreshObstacles();
      });
    });
    layoutObserver.observe(obstacleRoot, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-orientation'],
    });
    document.addEventListener('visibilitychange', onVisibilityChange);

    remeasure();
    if (!document.hidden && !exportingRef.current) schedule();

    return () => {
      if (advanceTimer !== null) clearTimeout(advanceTimer);
      if (resumeTimer !== 0) clearTimeout(resumeTimer);
      stop();
      clickSurface.removeEventListener('click', onClick);
      clickSurface.removeEventListener('pointermove', onPointerMove);
      clickSurface.style.cursor = '';
      resizeObserver.disconnect();
      themeObserver.disconnect();
      layoutObserver.disconnect();
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
      {topic && (
        <div
          className="sv2-discussion-topic"
          role="status"
          title={`${topic}${topicContext ? `\n${topicContext}` : ''}`}
        >
          <p>{ui('주제: {topic}', { topic })}</p>
          {topicContext && (
            <p className="sv2-discussion-topic-context">
              {ui('배경: {context}', { context: topicContext })}
            </p>
          )}
        </div>
      )}
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
