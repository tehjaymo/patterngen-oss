import type {
  TitleElement,
  PatternElement,
  SquareElement,
  LetterElement,
  DotElement,
  AnimationState,
} from '../types';
import { applyEasing, type EasingName } from './easing';

/**
 * Phase 1: Title reveal (0 to durationMs) — plays ONCE
 * Phase 2: Pattern/square reveal (1x durationMs)
 * Phase 3: Hold patterns, dots pulsate (3x durationMs)
 * Phases 2+3 loop: cycle = 4 * durationMs
 */
export function evaluate(
  elapsedMs: number,
  durationMs: number,
  titles: TitleElement[],
  patterns: PatternElement[],
  squares: SquareElement[],
  letters: LetterElement[],
  dots: DotElement[],
  easing: EasingName,
  stagger: number = 2,
): AnimationState {
  const titleClips = new Map<string, { x: number; y: number; w: number; h: number }>();
  const titleProgress = new Map<string, number>();
  const patternProgress = new Map<string, number>();
  const squareClips = new Map<string, { x: number; y: number; w: number; h: number }>();
  const squareProgress = new Map<string, number>();
  const letterProgress = new Map<string, number>();
  const dotProgress = new Map<string, number>();
  const dotOpacities = new Map<string, number>();

  const dur = Math.max(1, durationMs);

  const titleT = Math.min(1, Math.max(0, elapsedMs / dur));
  const titleEased = applyEasing(titleT, easing);

  for (const title of titles) {
    titleProgress.set(title.id, titleEased);
    if (title.w >= title.h) {
      const halfReveal = (title.w / 2) * titleEased;
      const cx = title.x + title.w / 2;
      titleClips.set(title.id, { x: cx - halfReveal, y: title.y, w: halfReveal * 2, h: title.h });
    } else {
      const halfReveal = (title.h / 2) * titleEased;
      const cy = title.y + title.h / 2;
      titleClips.set(title.id, { x: title.x, y: cy - halfReveal, w: title.w, h: halfReveal * 2 });
    }
  }

  const cycleLen = 4 * dur;
  const afterTitle = elapsedMs - dur;

  if (afterTitle < 0) {
    for (const pat of patterns) patternProgress.set(pat.id, 0);
    for (const sq of squares) {
      squareClips.set(sq.id, { x: sq.x, y: sq.y, w: 0, h: 0 });
      squareProgress.set(sq.id, 0);
    }
    for (const letter of letters) letterProgress.set(letter.id, 0);
    for (const dot of dots) {
      dotProgress.set(dot.id, 0);
      dotOpacities.set(dot.id, 0);
    }
  } else {
    const cycleMs = afterTitle % cycleLen;
    const revealEnd = dur;

    const staggerWindow = Math.max(0, Math.min(0.85, (stagger / 5) * 0.8));
    for (const pat of patterns) {
      const staggeredStart = pat.animDelay * staggerWindow * dur;
      const elemDur = dur * (1 - staggerWindow);
      const localMs = cycleMs - staggeredStart;
      const p = Math.max(0, Math.min(1, localMs / elemDur));
      patternProgress.set(pat.id, applyEasing(p, easing));
    }

    for (const sq of squares) {
      const staggeredStart = sq.animDelay * staggerWindow * dur;
      const elemDur = dur * (1 - staggerWindow);
      const localMs = cycleMs - staggeredStart;
      const p = applyEasing(Math.max(0, Math.min(1, localMs / elemDur)), easing);
      squareProgress.set(sq.id, p);
      const s = sq.size;
      switch (sq.clipSide) {
        case 'left':
          squareClips.set(sq.id, { x: sq.x, y: sq.y, w: s * p, h: s }); break;
        case 'right':
          squareClips.set(sq.id, { x: sq.x + s * (1 - p), y: sq.y, w: s * p, h: s }); break;
        case 'top':
          squareClips.set(sq.id, { x: sq.x, y: sq.y, w: s, h: s * p }); break;
        case 'bottom':
          squareClips.set(sq.id, { x: sq.x, y: sq.y + s * (1 - p), w: s, h: s * p }); break;
      }
    }

    for (const letter of letters) {
      const staggeredStart = letter.animDelay * staggerWindow * dur;
      const elemDur = dur * (1 - staggerWindow);
      const localMs = cycleMs - staggeredStart;
      const p = Math.max(0, Math.min(1, localMs / elemDur));
      letterProgress.set(letter.id, applyEasing(p, easing));
    }

    const inHold = cycleMs >= revealEnd;
    for (const dot of dots) {
      if (!inHold) {
        dotProgress.set(dot.id, 0);
        dotOpacities.set(dot.id, 0);
      } else {
        const holdMs = cycleMs - revealEnd;
        const staggeredStart = dot.animDelay * staggerWindow * dur;
        const elemDur = dur * (1 - staggerWindow);
        const localMs = holdMs - staggeredStart;
        const p = Math.max(0, Math.min(1, localMs / elemDur));
        dotProgress.set(dot.id, applyEasing(p, easing));
        dotOpacities.set(dot.id, evaluateDotPulse(dot, holdMs));
      }
    }
  }

  return { t: elapsedMs / dur, titleClips, titleProgress, patternProgress, squareClips, squareProgress, letterProgress, dotProgress, dotOpacities };
}

const DOT_LOOP_MS = 4000;

/**
 * Standalone dot pulsation for a given loop time.
 * Smooth sine-wave pulsation with initial fade-in envelope.
 */
export function evaluateDotPulse(dot: DotElement, loopMs: number): number {
  const t = loopMs / 1000;
  const fadeIn = Math.min(1, loopMs / 800);
  const wave = 0.5 + 0.5 * Math.sin(2 * Math.PI * dot.blinkSpeed * t + dot.blinkPhase * 2 * Math.PI);
  const pulse = 0.15 + 0.85 * wave;
  return pulse * fadeIn;
}

/**
 * Evaluate only dots for export as a standalone 4-second loop.
 */
export function evaluateDotsLoop(
  loopMs: number,
  dots: DotElement[],
): Map<string, number> {
  const opacities = new Map<string, number>();
  const t = loopMs % DOT_LOOP_MS;
  for (const dot of dots) {
    opacities.set(dot.id, evaluateDotPulse(dot, t));
  }
  return opacities;
}

export { DOT_LOOP_MS };
