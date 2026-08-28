import { HYPER_TURN } from '../config/dimensions';

/**
 * How far through its four-dimensional turn the structure currently is.
 *
 * Held here rather than in the store for the same reason the passage is: it
 * changes every frame, and a per-frame value in zustand would re-render the
 * whole tree sixty times a second. The store owns the intent — which month has
 * been chosen — and this owns the continuous angle that intent sets going.
 */

const TWO_PI = Math.PI * 2;

/**
 * Eased so the turn begins and ends at a standstill.
 *
 * A constant rate of rotation was the thing that made this hard to follow: the
 * figure snapped into motion, sheared through its most confusing angles at the
 * same speed as everything else, and snapped to a stop. Easing both ends to a
 * standstill lets the structure gather itself before it moves and settle rather
 * than halt.
 *
 * The gentler of the two obvious curves. A sharper one holds still for the best
 * part of a second after the click, which reads as the control not having
 * worked, and buys that dead time by whipping through the middle — the exact
 * stretch that needs to be legible. This never exceeds half again the average
 * rate, so there is no point at which the figure appears to lurch.
 */
function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

const state = { t: 0, turning: false, held: false, heldAngle: 0 };

/**
 * Starts a turn. Ignored while one is already running, so a burst of month
 * changes cannot stack revolutions on top of each other.
 */
export function startHyperTurn(): void {
  if (state.turning) return;
  state.t = 0;
  state.turning = true;
}

export function advanceHyperTurn(delta: number, immediate: boolean): void {
  if (state.held) return;
  if (!state.turning) return;

  if (immediate) {
    // Reduced motion gets the destination and none of the journey.
    state.t = 0;
    state.turning = false;
    return;
  }

  state.t += delta / HYPER_TURN.DURATION;
  if (state.t >= 1) {
    state.t = 0;
    state.turning = false;
  }
}

/** How far through the turn, 0 to 1. One when at rest. */
export function hyperProgress(): number {
  return state.turning ? state.t : 1;
}

/** The current angle of the turn, in radians. Zero when at rest. */
export function hyperAngle(): number {
  if (state.held) return state.heldAngle;
  return state.turning ? TWO_PI * ease(state.t) : 0;
}

if (import.meta.env.DEV) {
  /**
   * Pins the turn at one angle so it can be photographed.
   *
   * Headless falls back to a software renderer at roughly a frame a second,
   * which cannot sample a seven-second animation by taking timed screenshots of
   * it. Holding the clock still turns a question about timing into a question
   * about geometry, which a still frame can actually answer. Pass null to let
   * go and return to rest.
   */
  (window as unknown as Record<string, unknown>).__holdHyperAngle = (
    angle: number | null,
  ) => {
    state.held = angle !== null;
    state.turning = angle !== null;
    state.heldAngle = angle ?? 0;
  };
}
