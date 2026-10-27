// game/DinoEngine.ts - HTML5 Canvas 기반 크롬 공룡 게임 물리 및 렌더링 엔진

import { sounds } from './SoundEffects.ts';
import type { DinoPhysicsState, ObstacleState } from '../types/game.ts';

export interface GameEngineOptions {
  canvas: HTMLCanvasElement;
  isAiControlled?: boolean;
  onScore?: (score: number) => void;
  onGameOver?: (score: number) => void;
  onMilestone?: () => void;
  onObstacleApproaching?: (state: {
    obstacleId: number;
    dinoY: number;
    speed: number;
    distance: number;
    obstacleType: string;
    obstacleWidth: number;
    obstacleHeight: number;
    obstacleY: number;
  }) => void;
}

export class DinoEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animFrameId: number | null = null;
  private isAiControlled: boolean;

  // 게임 물리 파라미터
  private readonly GRAVITY = 0.62;
  private readonly JUMP_FORCE = -11.8;
  private readonly GROUND_Y = 220; // 지면 위치 (Canvas 기준)
  private readonly DINO_X = 50;

  // 상태
  private speed = 6.2;
  private score = 0;
  private distanceTraveled = 0;
  private isGameOver = false;
  private isPaused = false;
  private lastMilestoneScore = 0;

  // 공룡 상태
  private dinoY = 0; // 지면으로부터의 높이 (0 = 지면)
  private dinoVy = 0;
  private isJumping = false;
  private isDucking = false;
  private legFrame = 0;
  private legTimer = 0;

  // 장애물 및 배경
  private obstacles: ObstacleState[] = [];
  private nextObstacleId = 1;
  private minObstacleDist = 280;
  private horizonOffset = 0;
  private clouds: Array<{ x: number; y: number; speed: number }> = [];

  // 콜백
  private onScore?: (score: number) => void;
  private onGameOver?: (score: number) => void;
  private onMilestone?: () => void;
  private onObstacleApproaching?: GameEngineOptions['onObstacleApproaching'];

  constructor(options: GameEngineOptions) {
    this.canvas = options.canvas;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get Canvas 2D context');
    this.ctx = ctx;

    this.isAiControlled = options.isAiControlled || false;
    this.onScore = options.onScore;
    this.onGameOver = options.onGameOver;
    this.onMilestone = options.onMilestone;
    this.onObstacleApproaching = options.onObstacleApproaching;

    this.initClouds();
    this.setupCanvasDpi();
  }

  private setupCanvasDpi() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || 800;
    const h = rect.height || 260;

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.scale(dpr, dpr);
  }

  private initClouds() {
    this.clouds = [
      { x: 150, y: 40, speed: 0.5 },
      { x: 380, y: 70, speed: 0.7 },
      { x: 620, y: 30, speed: 0.6 },
    ];
  }

  start() {
    this.isGameOver = false;
    this.isPaused = false;
    this.loop();
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    if (this.isPaused && !this.isGameOver) {
      this.isPaused = false;
      this.loop();
    }
  }

  stop() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  restart() {
    this.stop();
    this.speed = 6.2;
    this.score = 0;
    this.distanceTraveled = 0;
    this.isGameOver = false;
    this.isPaused = false;
    this.lastMilestoneScore = 0;
    this.dinoY = 0;
    this.dinoVy = 0;
    this.isJumping = false;
    this.isDucking = false;
    this.obstacles = [];
    this.initClouds();
    this.start();
  }

  jump(): boolean {
    if (this.isGameOver) {
      this.restart();
      return true;
    }
    if (!this.isJumping && this.dinoY === 0) {
      this.dinoVy = this.JUMP_FORCE;
      this.isJumping = true;
      sounds.playJump();
      return true;
    }
    return false;
  }

  setDucking(ducking: boolean) {
    if (!this.isJumping) {
      this.isDucking = ducking;
    }
  }

  private loop = () => {
    if (this.isPaused || this.isGameOver) return;
    this.update();
    this.render();
    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private update() {
    // 1. 공룡 수직 물리 연산
    if (this.isJumping || this.dinoY > 0) {
      this.dinoY -= this.dinoVy;
      this.dinoVy += this.GRAVITY;

      if (this.dinoY <= 0) {
        this.dinoY = 0;
        this.dinoVy = 0;
        this.isJumping = false;
      }
    }

    // 발 달리기 애니메이션 타이머
    this.legTimer++;
    if (this.legTimer > 6) {
      this.legTimer = 0;
      this.legFrame = this.legFrame === 0 ? 1 : 0;
    }

    // 2. 게임 속도 및 점수 누적
    this.distanceTraveled += this.speed;
    const currentScore = Math.floor(this.distanceTraveled / 10);
    if (currentScore !== this.score) {
      this.score = currentScore;
      this.onScore?.(this.score);

      // 100점 단위 마일스톤 효과음
      if (this.score > 0 && this.score % 100 === 0 && this.score !== this.lastMilestoneScore) {
        this.lastMilestoneScore = this.score;
        sounds.playScoreMilestone();
        this.onMilestone?.();
      }
    }

    // 속도 점진 가속 (최대 13.0)
    if (this.speed < 13.0) {
      this.speed += 0.0007;
    }

    // 3. 배경 구름 이동
    for (const c of this.clouds) {
      c.x -= c.speed;
      if (c.x < -60) {
        c.x = 800 + Math.random() * 80;
        c.y = 25 + Math.random() * 60;
      }
    }

    // 지면 오프셋
    this.horizonOffset = (this.horizonOffset + this.speed) % 24;

    // 4. 장애물 생성 및 이동
    const lastObs = this.obstacles[this.obstacles.length - 1];
    const canSpawn = !lastObs || 800 - lastObs.x > this.minObstacleDist;

    if (canSpawn && Math.random() < 0.035) {
      this.spawnObstacle();
    }

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x -= this.speed;

      // 화면 밖으로 벗어난 장애물 제거
      if (obs.x + obs.width < -30) {
        this.obstacles.splice(i, 1);
      }
    }

    // 5. 다음 다가오는 장애물 감지 및 AI 텔레메트리 알림
    const nextObstacle = this.obstacles.find((o) => o.x + o.width > this.DINO_X);
    if (nextObstacle) {
      const dist = nextObstacle.x - (this.DINO_X + 44);
      if (dist > 0 && dist < 550) {
        this.onObstacleApproaching?.({
          obstacleId: nextObstacle.id,
          dinoY: this.dinoY,
          speed: this.speed,
          distance: dist,
          obstacleType: nextObstacle.type,
          obstacleWidth: nextObstacle.width,
          obstacleHeight: nextObstacle.height,
          obstacleY: nextObstacle.y,
        });
      }
    }

    // 6. 충돌 판정 (AABB 충돌 박스 검사)
    this.checkCollisions();
  }

  private spawnObstacle() {
    const types: ObstacleState['type'][] = [
      'cactus_small',
      'cactus_large',
      'cactus_multi',
    ];
    // 점수 300 이상이면 날아다니는 익룡 추가
    if (this.score > 300) {
      types.push('pterodactyl');
    }

    const type = types[Math.floor(Math.random() * types.length)];
    let width = 24;
    let height = 40;
    let y = this.GROUND_Y - height;

    if (type === 'cactus_small') {
      width = 20;
      height = 36;
      y = this.GROUND_Y - height;
    } else if (type === 'cactus_large') {
      width = 26;
      height = 48;
      y = this.GROUND_Y - height;
    } else if (type === 'cactus_multi') {
      width = 46;
      height = 38;
      y = this.GROUND_Y - height;
    } else if (type === 'pterodactyl') {
      width = 38;
      height = 26;
      // 저공비행 (점프 필요) 또는 중공비행 (숙이기 필요)
      const alt = Math.random() < 0.5 ? 45 : 85;
      y = this.GROUND_Y - alt;
    }

    this.obstacles.push({
      id: this.nextObstacleId++,
      type,
      x: 820,
      y,
      width,
      height,
      speed: this.speed,
    });

    // 다음 장애물 최소 간격 (속도에 비례해 자동 보정)
    this.minObstacleDist = 220 + Math.random() * 160 + this.speed * 8;
  }

  private checkCollisions() {
    const dinoWidth = this.isDucking ? 54 : 44;
    const dinoHeight = this.isDucking ? 28 : 46;
    const dinoTop = this.GROUND_Y - this.dinoY - dinoHeight;
    const dinoBottom = this.GROUND_Y - this.dinoY;
    const dinoLeft = this.DINO_X + 6; // 타이트한 히트박스 보정
    const dinoRight = this.DINO_X + dinoWidth - 6;

    for (const obs of this.obstacles) {
      const obsLeft = obs.x + 4;
      const obsRight = obs.x + obs.width - 4;
      const obsTop = obs.y + 4;
      const obsBottom = obs.y + obs.height;

      // 충돌 검사
      const isOverlap =
        dinoRight > obsLeft &&
        dinoLeft < obsRight &&
        dinoBottom > obsTop &&
        dinoTop < obsBottom;

      if (isOverlap) {
        this.isGameOver = true;
        sounds.playHit();
        this.stop();
        this.renderGameOver();
        this.onGameOver?.(this.score);
        break;
      }
    }
  }

  private render() {
    const w = 800;
    const h = 260;
    this.ctx.clearRect(0, 0, w, h);

    // 1. 하늘 & 구름
    this.ctx.fillStyle = '#94a3b8';
    for (const c of this.clouds) {
      this.drawCloud(c.x, c.y);
    }

    // 2. 지면 라인 및 돌멩이
    this.ctx.strokeStyle = '#64748b';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.GROUND_Y);
    this.ctx.lineTo(w, this.GROUND_Y);
    this.ctx.stroke();

    // 지면 질감 점들
    this.ctx.fillStyle = '#94a3b8';
    for (let x = -this.horizonOffset; x < w; x += 32) {
      this.ctx.fillRect(x + 8, this.GROUND_Y + 4, 3, 1.5);
      this.ctx.fillRect(x + 22, this.GROUND_Y + 7, 2, 1.5);
    }

    // 3. 장애물 렌더링
    for (const obs of this.obstacles) {
      this.drawObstacle(obs);
    }

    // 4. 공룡 렌더링
    this.drawDino();

    // 5. 점수 렌더링
    this.drawScore();
  }

  private drawDino() {
    const x = this.DINO_X;
    const y = this.GROUND_Y - this.dinoY - (this.isDucking ? 28 : 46);
    this.ctx.fillStyle = this.isAiControlled ? '#2563eb' : '#0f172a';

    if (this.isDucking) {
      // 숙인 공룡
      this.ctx.fillRect(x, y + 10, 48, 18); // 몸통
      this.ctx.fillRect(x + 36, y + 6, 18, 14); // 머리
      // 눈
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(x + 46, y + 8, 3, 3);
      this.ctx.fillStyle = this.isAiControlled ? '#2563eb' : '#0f172a';
      // 다리
      if (this.legFrame === 0) {
        this.ctx.fillRect(x + 10, y + 26, 4, 3);
        this.ctx.fillRect(x + 28, y + 26, 4, 1.5);
      } else {
        this.ctx.fillRect(x + 10, y + 26, 4, 1.5);
        this.ctx.fillRect(x + 28, y + 26, 4, 3);
      }
    } else {
      // 서 있는 공룡
      // 머리 & 주둥이
      this.ctx.fillRect(x + 24, y, 20, 16);
      this.ctx.fillRect(x + 32, y + 4, 12, 12);
      // 눈
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(x + 28, y + 3, 3, 3);
      this.ctx.fillStyle = this.isAiControlled ? '#2563eb' : '#0f172a';

      // 몸통 & 팔
      this.ctx.fillRect(x + 12, y + 14, 20, 22);
      this.ctx.fillRect(x + 32, y + 22, 6, 4); // 작은 앞발

      // 꼬리
      this.ctx.fillRect(x + 2, y + 16, 10, 12);
      this.ctx.fillRect(x, y + 14, 4, 8);

      // 다리 (점프 시 모으고, 달릴 때 교차)
      if (this.isJumping) {
        this.ctx.fillRect(x + 16, y + 36, 4, 8);
        this.ctx.fillRect(x + 24, y + 36, 4, 8);
      } else if (this.legFrame === 0) {
        this.ctx.fillRect(x + 14, y + 36, 4, 10);
        this.ctx.fillRect(x + 14, y + 44, 7, 2);
        this.ctx.fillRect(x + 26, y + 36, 4, 6);
      } else {
        this.ctx.fillRect(x + 14, y + 36, 4, 6);
        this.ctx.fillRect(x + 26, y + 36, 4, 10);
        this.ctx.fillRect(x + 26, y + 44, 7, 2);
      }
    }
  }

  private drawObstacle(obs: ObstacleState) {
    this.ctx.fillStyle = '#334155';

    if (obs.type === 'pterodactyl') {
      // 익룡 날갯짓
      this.ctx.fillRect(obs.x + 8, obs.y + 8, 22, 10); // 몸통
      this.ctx.fillRect(obs.x, obs.y + 6, 8, 6); // 부리
      if (this.legFrame === 0) {
        // 날개 위로
        this.ctx.fillRect(obs.x + 14, obs.y - 8, 6, 16);
      } else {
        // 날개 아래로
        this.ctx.fillRect(obs.x + 14, obs.y + 12, 6, 14);
      }
    } else {
      // 선인장 (줄기 및 양옆 가지)
      const cx = obs.x + obs.width / 2;
      this.ctx.fillRect(cx - 3, obs.y, 6, obs.height);
      // 왼쪽 가지
      this.ctx.fillRect(obs.x, obs.y + obs.height * 0.35, 6, 4);
      this.ctx.fillRect(obs.x, obs.y + obs.height * 0.2, 4, obs.height * 0.2);
      // 오른쪽 가지
      this.ctx.fillRect(obs.x + obs.width - 6, obs.y + obs.height * 0.45, 6, 4);
      this.ctx.fillRect(obs.x + obs.width - 4, obs.y + obs.height * 0.3, 4, obs.height * 0.2);
    }
  }

  private drawCloud(x: number, y: number) {
    this.ctx.fillStyle = '#cbd5e1';
    this.ctx.fillRect(x, y, 42, 10);
    this.ctx.fillRect(x + 8, y - 6, 24, 6);
    this.ctx.fillRect(x + 16, y - 10, 12, 4);
  }

  private drawScore() {
    this.ctx.font = '700 13px "JetBrains Mono", monospace';
    this.ctx.fillStyle = '#64748b';
    this.ctx.textAlign = 'right';
    const scoreStr = String(this.score).padStart(5, '0');
    this.ctx.fillText(`SCORE: ${scoreStr}`, 780, 28);
  }

  private renderGameOver() {
    const w = 800;
    const h = 260;
    this.ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    this.ctx.fillRect(0, 0, w, h);

    this.ctx.font = '700 18px "JetBrains Mono", monospace';
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('G A M E   O V E R', w / 2, h / 2 - 10);

    this.ctx.font = '12px "Pretendard", sans-serif';
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.fillText(
      this.isAiControlled
        ? 'AI가 장애물과 충돌했습니다. 재시작 버튼을 눌러주세요.'
        : '스페이스바 또는 화면을 클릭하여 다시 시작하세요.',
      w / 2,
      h / 2 + 18
    );
  }

  getPhysicsSnapshot(): DinoPhysicsState {
    return {
      x: this.DINO_X,
      y: this.dinoY,
      vy: this.dinoVy,
      width: this.isDucking ? 54 : 44,
      height: this.isDucking ? 28 : 46,
      isJumping: this.isJumping,
      isDucking: this.isDucking,
      isDead: this.isGameOver,
      score: this.score,
      speed: this.speed,
    };
  }

  getScore(): number {
    return this.score;
  }

  destroy() {
    this.stop();
  }
}
