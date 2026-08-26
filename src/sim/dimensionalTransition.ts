/**
 * How far through the passage into a dimensional layer the world currently is.
 *
 * Held here rather than in the store because it changes every frame, and a
 * per-frame value in zustand would re-render the whole tree sixty times a
 * second. The store owns the *intent* — which month has been entered — and this
 * owns the continuous value that intent eases toward. One component advances
 * it; the camera, the shells, the core and the post chain all read it.
 *
 * Two numbers come out of it, and they are deliberately different shapes:
 *
 *   depth   0 outside, 1 fully inside. Monotonic. Anything that should simply
 *           be true of the inside state reads this.
 *   surge   0 at both ends, 1 at the halfway point. This is the passage itself
 *           — the moment of being neither out nor in — and it is what the
 *           distortion rides. A monotonic value would leave the world
 *           permanently distorted once it arrived.
 */

interface TransitionState {
  depth: number;
  target: number;
}

const state: TransitionState = { depth: 0, target: 0 };

/** Seconds the passage takes. Long: this is the slowest move in the piece. */
const DURATION = 2.4;

/**
 * Advances the transition. Called once per frame by a single owner.
 *
 * Eased exponentially rather than driven on a linear timer, so an interruption
 * — the viewer leaving before the arrival has finished — reverses from wherever
 * it had got to instead of snapping to an endpoint.
 */
export function advanceTransition(delta: number, immediate: boolean): void {
  if (immediate) {
    state.depth = state.target;
    return;
  }
  // Clamped so a backgrounded tab does not deliver one enormous step and snap
  // the passage shut on return. The cost is that on a renderer running at a
  // frame or two per second the passage stretches out in wall-clock time —
  // visible when driving the app under software rendering, and not a thing that
  // happens on a GPU, where this settles in the couple of seconds it is tuned
  // for.
  const step = Math.min(delta, 0.1);
  state.depth += (state.target - state.depth) * (1 - Math.exp(-step / (DURATION / 3)));
  // Snap the last sliver so the world reaches a genuinely settled state rather
  // than approaching one asymptotically forever.
  if (Math.abs(state.target - state.depth) < 0.0015) state.depth = state.target;
}

export function setTransitionTarget(target: number): void {
  state.target = target;
}

/** 0 outside the layer, 1 within it. */
export function transitionDepth(): number {
  return state.depth;
}

/** 0 at rest at either end, 1 at the midpoint of the passage. */
export function transitionSurge(): number {
  const depth = state.depth;
  return 4 * depth * (1 - depth);
}

/** True while the world is neither out nor in. */
export function inPassage(): boolean {
  return state.depth > 0.001 && state.depth < 0.999;
}
