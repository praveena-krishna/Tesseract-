import { useEffect } from 'react';
import { useWorldStore } from '../store/useWorldStore';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Mirrors the viewer's motion preference into the world store.
 *
 * Reduced motion damps movement — pulses hold near their midpoint, drift slows,
 * the idle camera orbit stops — but never removes meaning. Every relationship
 * the visualisation encodes stays legible when motion is off.
 */
export function useReducedMotion(): void {
  const setReducedMotion = useWorldStore((state) => state.setReducedMotion);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const media = window.matchMedia(QUERY);
    setReducedMotion(media.matches);

    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [setReducedMotion]);
}

/** Scales an animation rate by the viewer's motion preference. */
export function motionScale(reducedMotion: boolean, factor: number): number {
  return reducedMotion ? factor : 1;
}
