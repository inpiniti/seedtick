// services/backgroundKeepAlive.ts - 백그라운드 전환 시 브라우저 동결(Freezing) 방지 및 화면 꺼짐 방지 서비스

/**
 * 모바일 및 데스크톱 브라우저에서 장시간 소요되는 AI 분석/인코딩 작업 시,
 * 1) 화면이 저절로 어두워지거나 잠금(Sleep) 화면으로 전환되어 프로세스가 멈추는 것을 방지 (Screen Wake Lock)
 * 2) 사용자가 크롬 다른 탭으로 이동하거나 모바일 다른 앱을 켤 때 백그라운드 프로세스가 동결(Freeze)되거나
 *    네트워크 소켓이 끊어지는 현상을 방지 (Silent Audio Keep-Alive + Web Worker Heartbeat)
 */

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
  addEventListener?: (type: string, listener: EventListener) => void;
}

class BackgroundExecutionGuardManager {
  private wakeLockSentinel: WakeLockSentinelLike | null = null;
  private audioCtx: AudioContext | null = null;
  private silentGainNode: GainNode | null = null;
  private silentOscillator: OscillatorNode | null = null;
  private worker: Worker | null = null;
  private isRunning = false;
  private tickListeners = new Set<() => void>();
  private visibilityHandler: (() => void) | null = null;

  /**
   * 백그라운드 보호 시작 (WakeLock + 무음 오디오 세션 + Worker 하트비트)
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // 1. Screen Wake Lock 획득 (화면 자동 꺼짐 방지)
    await this.acquireWakeLock();

    // 2. 가시성 변경(탭 복귀 등) 시 WakeLock 재획득 리스너 등록
    this.setupVisibilityListener();

    // 3. 무음 Web Audio 세션 시작 (백그라운드 탭/앱 전환 시 브라우저 프로세스 동결 방지)
    this.startSilentAudio();

    // 4. 인라인 Web Worker 하트비트 시작 (백그라운드에서도 타이머 스로틀링 없이 1초마다 틱 보장)
    this.startWorkerHeartbeat();
  }

  /**
   * 백그라운드 보호 종료 및 모든 리소스 정리
   */
  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    this.releaseWakeLock();
    this.removeVisibilityListener();
    this.stopSilentAudio();
    this.stopWorkerHeartbeat();
    this.tickListeners.clear();
  }

  /**
   * Worker 기반 1초 하트비트 리스너 등록
   * (메인 스레드가 백그라운드에 있더라도 주기적으로 실행됨)
   */
  public onTick(callback: () => void): () => void {
    this.tickListeners.add(callback);
    return () => {
      this.tickListeners.delete(callback);
    };
  }

  public get active(): boolean {
    return this.isRunning;
  }

  // --- 1. Screen Wake Lock API -----------------------------------------
  private async acquireWakeLock(): Promise<void> {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return;
    }
    try {
      const navAny = navigator as unknown as { wakeLock: { request: (type: string) => Promise<WakeLockSentinelLike> } };
      this.wakeLockSentinel = await navAny.wakeLock.request('screen');
      this.wakeLockSentinel.addEventListener?.('release', () => {
        this.wakeLockSentinel = null;
      });
    } catch (err) {
      // 배터리 절약 모드 등에서는 실패할 수 있으나 비치명적이므로 경고만 기록
      console.warn('[BackgroundGuard] Screen Wake Lock 획득 실패 (비치명적):', err);
    }
  }

  private releaseWakeLock(): void {
    if (this.wakeLockSentinel && !this.wakeLockSentinel.released) {
      try {
        void this.wakeLockSentinel.release();
      } catch {
        // ignore
      }
    }
    this.wakeLockSentinel = null;
  }

  private setupVisibilityListener(): void {
    if (typeof document === 'undefined') return;
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible' && this.isRunning) {
        if (!this.wakeLockSentinel || this.wakeLockSentinel.released) {
          void this.acquireWakeLock();
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          void this.audioCtx.resume().catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private removeVisibilityListener(): void {
    if (typeof document === 'undefined' || !this.visibilityHandler) return;
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.visibilityHandler = null;
  }

  // --- 2. Silent Audio Keep-Alive ---------------------------------------
  private startSilentAudio(): void {
    try {
      const AudioCtxCtor =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxCtor) return;

      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtxCtor();
      }

      if (this.audioCtx.state === 'suspended') {
        void this.audioCtx.resume().catch(() => {});
      }

      // 무음(0에 수렴하는 극저볼륨 0.00001) 오실레이터 생성
      // 완벽한 0은 브라우저에 따라 음소거로 판단해 최적화할 수 있으므로, 들리지 않는 5Hz 주파수와 0.00001 게인 사용
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(5, this.audioCtx.currentTime); // 인간의 가청 주파수(20Hz) 아래의 초저주파
      gain.gain.setValueAtTime(0.00001, this.audioCtx.currentTime); // 사실상 무음

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();

      this.silentOscillator = osc;
      this.silentGainNode = gain;
    } catch (err) {
      console.warn('[BackgroundGuard] Silent Audio 킵얼라이브 초기화 경고:', err);
    }
  }

  private stopSilentAudio(): void {
    try {
      if (this.silentOscillator) {
        this.silentOscillator.stop();
        this.silentOscillator.disconnect();
        this.silentOscillator = null;
      }
      if (this.silentGainNode) {
        this.silentGainNode.disconnect();
        this.silentGainNode = null;
      }
      if (this.audioCtx && this.audioCtx.state !== 'closed') {
        void this.audioCtx.close().catch(() => {});
        this.audioCtx = null;
      }
    } catch {
      // ignore
    }
  }

  // --- 3. Inline Web Worker Heartbeat -----------------------------------
  private startWorkerHeartbeat(): void {
    try {
      if (typeof Worker === 'undefined' || typeof Blob === 'undefined') return;

      // 브라우저 탭이 비활성화되어도 Worker 내부의 setInterval은 스로틀링되지 않음
      const workerCode = `
        let timer = null;
        self.onmessage = function(e) {
          if (e.data === 'start') {
            if (timer) clearInterval(timer);
            timer = setInterval(function() {
              self.postMessage('tick');
            }, 1000);
          } else if (e.data === 'stop') {
            if (timer) {
              clearInterval(timer);
              timer = null;
            }
          }
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);

      worker.onmessage = (e) => {
        if (e.data === 'tick' && this.isRunning) {
          for (const listener of this.tickListeners) {
            try {
              listener();
            } catch (err) {
              console.warn('[BackgroundGuard] Heartbeat listener error:', err);
            }
          }
        }
      };

      worker.postMessage('start');
      this.worker = worker;
      // 생성 후 URL 즉시 폐기
      URL.revokeObjectURL(workerUrl);
    } catch (err) {
      console.warn('[BackgroundGuard] Web Worker Heartbeat 생성 실패 (비치명적):', err);
    }
  }

  private stopWorkerHeartbeat(): void {
    if (this.worker) {
      try {
        this.worker.postMessage('stop');
        this.worker.terminate();
      } catch {
        // ignore
      }
      this.worker = null;
    }
  }
}

export const backgroundGuard = new BackgroundExecutionGuardManager();
