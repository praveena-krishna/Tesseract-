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

const state = { t: 0, turns: 1, turning: false, held: false, heldAngle: 0 };

/**
 * Starts a turn of the given number of revolutions.
 *
 * The count is how many month boundaries the move crosses, so the length of
 * the turn is what tells the viewer how far they went. It is floored at one:
 * a move of no distance still has to turn, or entering reads as a cut.
 *
 * Ignored while one is already running, so a burst of month changes cannot
 * stack revolutions on top of each other. The count of a live turn is left
 * alone for the same reason — the angle is the count multiplied by the eased
 * clock, so raising it partway would jump the figure rather than extend it.
 */
export function startHyperTurn(turns = 1): void {
  if (state.turning) return;
  state.t = 0;
  state.turns = Math.max(HYPER_TURN.MIN_TURNS, Math.round(turns));
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

  // Divided by the count so the rate is the same whatever the distance: the
  // duration is per revolution, not per move.
  state.t += delta / (HYPER_TURN.DURATION * state.turns);
  if (state.t >= 1) {
    state.t = 0;
    state.turning = false;
  }
}

/**
 * The current angle of the turn, in radians. Zero when at rest.
 *
 * Runs past a full revolution on a multi-month move. Everything downstream is
 * a sine or a cosine of it, so the excess costs nothing and needs no wrapping.
 */
export function hyperAngle(): number {
  if (state.held) return state.heldAngle;
  return state.turning ? TWO_PI * state.turns * ease(state.t) : 0;
}

/**
 * Whether the camera may begin its passage inward.
 *
 * Answered here rather than at the call site because it is a question about
 * the last revolution and not about the move: a two-revolution journey read as
 * a fraction of the whole would release the viewer midway through the second
 * inversion. Compared in eased revolutions rather than raw clock so that a
 * single-revolution move releases at exactly the point it always has.
 */
export function hyperReleased(): boolean {
  if (!state.turning) return true;
  const turned = state.turns * ease(state.t);
  return turned > state.turns - 1 + ease(HYPER_TURN.RELEASE);
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
