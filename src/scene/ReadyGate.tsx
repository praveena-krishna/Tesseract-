import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { TIMINGS } from '../config/timings';
import { useWorldStore } from '../store/useWorldStore';

/** Frames that must have been drawn before the world counts as present. */
const WARMUP_FRAMES = 3;
/** Upper bound on the veil, regardless of how slowly the world is rendering. */
const HARD_CEILING_MS = 5000;
/** How often the gate re-checks its conditions. */
const POLL_MS = 120;

/**
 * Lifts the loading veil once the world is genuinely on screen.
 *
 * Readiness is a conjunction of two signals: enough real frames have been drawn
 * that shaders are compiled and the structure is actually visible, and enough
 * wall-clock time has passed for the title to register. The ceiling matters —
 * on a machine that renders slowly, or with software rasterisation, a purely
 * frame-counted gate would leave the viewer staring at the veil forever. The
 * world appearing late is a far better failure than it never appearing.
 */
export function ReadyGate() {
  const setPhase = useWorldStore((state) => state.setPhase);
  const framesRef = useRef(0);

  useFrame(() => {
    framesRef.current += 1;
  });

  useEffect(() => {
    const start = performance.now();

    const interval = window.setInterval(() => {
      const elapsed = performance.now() - start;
      const settled = framesRef.current >= WARMUP_FRAMES && elapsed >= TIMINGS.LOADING_MIN_MS;

      if (settled || elapsed >= HARD_CEILING_MS) {
        window.clearInterval(interval);
        setPhase('ready');
      }
    }, POLL_MS);

    return () => window.clearInterval(interval);
  }, [setPhase]);

  return null;
}
