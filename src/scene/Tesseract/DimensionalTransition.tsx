import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  advanceTransition,
  setTransitionTarget,
} from '../../sim/dimensionalTransition';
import { advanceHyperTurn, hyperReleased, startHyperTurn } from '../../sim/hyperTurn';
import { HYPER_TURN } from '../../config/dimensions';
import { useWorldStore } from '../../store/useWorldStore';

/**
 * The single owner of the passage.
 *
 * Everything that reacts to entering a layer — the camera, the shells, the
 * core, the post chain, the people appearing — reads one continuous value, and
 * exactly one thing is allowed to advance it. Letting each reader ease its own
 * copy would be the reliable way to get a transition where the distortion
 * peaks, the camera arrives and the people appear at three different moments.
 *
 * Renders nothing.
 */
export function DimensionalTransition() {
  const enteredMonth = useWorldStore((state) => state.enteredMonth);
  const reducedMotion = useWorldStore((state) => state.reducedMotion);

  /**
   * Where the camera is being asked to go, held back until the turn has been
   * seen.
   *
   * The passage takes 2.4 seconds and a revolution seven, so firing both at
   * once put the viewer inside the box a third of the way through — looking at
   * struts from within, where the figure turning itself inside out is
   * invisible. The whole point of the turn is that it is watched from outside,
   * so the camera waits for most of the final revolution before it moves.
   */
  const pending = useRef<number | null>(null);

  /**
   * The layer the viewer was on last, so a change can be told apart from a
   * re-render. Undefined rather than null to begin with, so that the very first
   * run still settles the passage at its resting value.
   */
  const previous = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    const from = previous.current;
    if (from === enteredMonth) return;
    previous.current = enteredMonth;

    // Leaving is immediate. Nothing is being shown on the way out, and holding
    // the viewer in a box they have asked to leave reads as the control having
    // failed.
    if (enteredMonth === null) {
      pending.current = null;
      setTransitionTarget(0);
      return;
    }

    // Choosing a month turns the structure through four dimensions. Fired on
    // any change of layer, not only on entering from outside: moving between
    // two months is the same event as far as the figure is concerned, and it is
    // the move most worth showing, since it is the one where the viewer has to
    // understand that the two boxes are the same object at different depths.
    //
    // Once for each month boundary crossed. From outside the viewer counts as
    // standing at the outermost month, since nothing has had to turn to put
    // them there — so the first entry into the innermost box is two crossings
    // and turns twice, and this is the only place that knows both ends of the
    // move.
    const origin = from ?? HYPER_TURN.OUTSIDE_MONTH;
    startHyperTurn(Math.abs(enteredMonth - origin));

    // Coming from another month means the viewer is already inside, where the
    // turn cannot be seen at all. So they are withdrawn first and sent back in
    // afterwards: out, watch the figure invert, down into the new layer.
    if (from !== null && from !== undefined) setTransitionTarget(0);

    pending.current = 1;
  }, [enteredMonth]);

  useFrame((_, delta) => {
    advanceHyperTurn(delta, reducedMotion);

    // Released once the last revolution is most of the way through, so the end
    // of it carries the viewer inward rather than finishing after they arrive.
    if (pending.current !== null && (reducedMotion || hyperReleased())) {
      setTransitionTarget(pending.current);
      pending.current = null;
    }

    advanceTransition(delta, reducedMotion);
  });

  return null;
}
