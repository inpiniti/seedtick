// src/services/motionEasingPresets.ts
// script-to-motion 기법: cue 앵커 이징 — 인트로/아웃트로/챕터 브릿지가 공유하는 GSAP 이징 프리셋과 결정론적 타임라인 헬퍼
//
// 이 모듈은 값 자체를 바꾸지 않는다. 기존 렌더러가 쓰던 이징 문자열을 그대로 상수화했으므로
// 프리셋으로 치환해도 타임라인·그림 결과는 완전히 동일하다. 정확히 일치하지 않는 문자열은 치환하지 않는다.

import gsap from 'gsap';

// ============================================================================
// Easing Presets — 이름 → 기존 렌더러의 raw GSAP 이징 문자열 (값 변경 없음)
// ============================================================================

/**
 * SPRING_SOFT — 부드러운 스프링 오버슈트.
 * 사용처: kinetic-slide 인트로 메인 타이틀 등장
 * (hyperframesIntroOutroRenderer.ts:89).
 */
export const SPRING_SOFT = 'back.out(1.8)';

/**
 * IMPACT — 강한 감속 임팩트.
 * 사용처: 챕터 브릿지 메인 스테이지 등장 (hyperframesBridgeRenderer.ts:1234).
 */
export const IMPACT = 'power3.out';

/**
 * GLIDE — 앞뒤가 대칭인 부드러운 왕복 활주.
 * 사용처: curtain-split 아웃트로 루버 닫힘 (hyperframesIntroOutroRenderer.ts:325),
 * 챕터 브릿지 날짜 플립·장소 이동 (hyperframesBridgeRenderer.ts:1245, 1255).
 */
export const GLIDE = 'power2.inOut';

/**
 * SETTLE — 큰 오버슈트 후 자리잡는 마무리 이징.
 * 현재 두 렌더러에 정확히 일치하는 문자열이 없어 치환하지 않은 예약 프리셋.
 * (back.out(1.4)/(1.5)/(1.6)은 값이 달라 대체하지 않는다.)
 */
export const SETTLE = 'back.out(2.2)';

/**
 * FLIP — 플립/전환용 가장 강한 인아웃 이징.
 * 현재 두 렌더러에 정확히 일치하는 문자열이 없어 치환하지 않은 예약 프리셋.
 */
export const FLIP = 'power4.inOut';

/**
 * FADE — 가장 약한 페이드 아웃 이징.
 * 현재 두 렌더러에 정확히 일치하는 문자열이 없어 치환하지 않은 예약 프리셋.
 * (sine.out / power2.out 은 값이 달라 대체하지 않는다.)
 */
export const FADE = 'power1.out';

// ============================================================================
// Deterministic Cue Timeline
// ============================================================================

export interface CueTimeline {
  /** 기존 렌더러가 쓰는 gsap.timeline({ paused: true }) 인스턴스 그대로 노출. */
  readonly timeline: gsap.core.Timeline;
  /** seekProgress()가 0~1 진행률을 초 단위 위치로 환산할 때 쓰는 길이. */
  readonly durationSec: number;
  /** 진행률(0~1)을 결정적으로 탐색. 인트로/아웃트로의 seek(progress)과 동일. */
  seekProgress(p: number): void;
  /** 절대 초 단위 탐색. 브릿지의 seek(timeSec, false) 패턴과 동일. */
  seekSeconds(seconds: number, suppressEvents?: boolean): void;
  /** 이름 붙은 cue 앵커를 타임라인에 영향을 주지 않고 등록. */
  addCue(name: string, seconds: number): void;
  /** cue 앵커로 이동. 등록되지 않은 이름이면 false. */
  seekCue(name: string): boolean;
  /** GSAP 타임라인 정리. 기존 destroy()/dispose()의 tl.kill()과 동일. */
  destroy(): void;
}

/**
 * paused 타임라인과 결정론적 seek 인터페이스를 함께 만든다.
 *
 * 기존 렌더러의 `const tl = gsap.timeline({ paused: true })` + `tl.seek(...)` 패턴과
 * 호환되도록 `timeline`을 그대로 노출하며, `seekProgress()`는
 * `tl.seek(clampedProgress * durationSec)`과 완전히 같은 호출을 수행한다.
 * cue 앵커는 GSAP 타임라인이 아닌 별도 Map에 보관하므로 트윈/렌더 결과에 영향을 주지 않는다.
 */
export function createCueTimeline(durationSec = 1): CueTimeline {
  const timeline = gsap.timeline({ paused: true });
  const duration = Math.max(0, durationSec);
  const cues = new Map<string, number>();

  const seekSeconds = (seconds: number, suppressEvents?: boolean): void => {
    const clamped = Math.max(0, Math.min(duration, seconds));
    // 인자 유무까지 기존 호출과 맞춘다. suppressEvents 미지정 시 2번째 인자를 넘기지 않는다.
    if (suppressEvents === undefined) {
      timeline.seek(clamped);
    } else {
      timeline.seek(clamped, suppressEvents);
    }
  };

  return {
    timeline,
    durationSec: duration,
    seekProgress(p: number): void {
      // progress()가 아닌 seek(p * duration) 사용 — 기존 seek 로직과 동일한 결과 보장.
      const clamped = Math.max(0, Math.min(1, p));
      timeline.seek(clamped * duration);
    },
    seekSeconds,
    addCue(name: string, seconds: number): void {
      cues.set(name, Math.max(0, Math.min(duration, seconds)));
    },
    seekCue(name: string): boolean {
      const at = cues.get(name);
      if (at === undefined) return false;
      seekSeconds(at);
      return true;
    },
    destroy(): void {
      timeline.kill();
    },
  };
}
