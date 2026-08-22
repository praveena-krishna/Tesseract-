import { useEffect, useState } from 'react';
import { TIMINGS } from '../config/timings';
import { useWorldStore } from '../store/useWorldStore';

/**
 * The opening.
 *
 * Nothing here is a progress indicator — the scene is entirely procedural and
 * has no assets to wait on. The veil exists to give the world a moment to
 * arrive rather than to appear fully formed on first paint, and it holds only
 * long enough to establish the title before dissolving.
 */
export function LoadingVeil() {
  const phase = useWorldStore((state) => state.phase);
  const reducedMotion = useWorldStore((state) => state.reducedMotion);
  const [mounted, setMounted] = useState(true);

  const fadeMs = reducedMotion
    ? TIMINGS.LOADING_FADE_REDUCED_MS
    : TIMINGS.LOADING_FADE_MS;

  useEffect(() => {
    if (phase !== 'ready') return;
    const timer = window.setTimeout(() => setMounted(false), fadeMs);
    return () => window.clearTimeout(timer);
  }, [phase, fadeMs]);

  if (!mounted) return null;

  return (
    <div
      className="veil"
      data-state={phase === 'ready' ? 'hiding' : 'showing'}
      style={{ ['--veil-fade' as string]: `${fadeMs}ms` }}
      aria-hidden={phase === 'ready'}
    >
      <p className="veil__title">THE TESSERACT</p>
      <p className="veil__status">INITIALIZING DIMENSION</p>
    </div>
  );
}
