import { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  advanceTransition,
  setTransitionTarget,
} from '../../sim/dimensionalTransition';
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

  useEffect(() => {
    setTransitionTarget(enteredMonth === null ? 0 : 1);
  }, [enteredMonth]);

  useFrame((_, delta) => advanceTransition(delta, reducedMotion));

  return null;
}
