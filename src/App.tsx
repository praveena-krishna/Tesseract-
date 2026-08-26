import { lazy, Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { TesseractScene } from './scene/TesseractScene';
import { LoadingVeil } from './ui/LoadingVeil';
import { WorldUI } from './ui/WorldUI';
import { Readout } from './ui/Readout';
import { TimeControl } from './ui/TimeControl';
import { LensControl } from './ui/LensControl';
import { WebGLFallback } from './ui/WebGLFallback';
import { useReducedMotion } from './interaction/useReducedMotion';
import { useHoverCursor } from './interaction/useHoverCursor';
import { useWorldStore } from './store/useWorldStore';
import { CAMERA } from './config/dimensions';
import { PALETTE } from './config/palette';

/**
 * Probes for a WebGL2 context once, on a throwaway canvas.
 *
 * Some environments throw rather than returning null when 3D is blocked, so the
 * probe is wrapped; a thrown error is treated the same as an unavailable
 * context. `?nogl` forces the fallback path for testing it.
 */
function detectWebGL2(): boolean {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).has('nogl')) return false;
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

/** Split out of the main bundle so the instrumentation never ships to viewers. */
const DebugStats = lazy(() =>
  import('./ui/DebugStats').then((module) => ({ default: module.DebugStats })),
);

function hasFlag(flag: string): boolean {
  return (
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has(flag)
  );
}

export default function App() {
  const hasWebGL = useMemo(() => detectWebGL2(), []);
  const debug = useMemo(() => hasFlag('debug'), []);
  useReducedMotion();
  useHoverCursor();

  if (!hasWebGL) return <WebGLFallback />;

  return (
    <>
      <Canvas
        dpr={[1, 2]}
        camera={{
          fov: CAMERA.FOV,
          near: CAMERA.NEAR,
          far: CAMERA.FAR,
          position: [12, 8, 12],
        }}
        gl={{
          // Post-processing resolves aliasing through the composer's own
          // multisampling, so the default context sampler would be paid twice.
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        scene={{ background: new THREE.Color(PALETTE.BG) }}
        // Clicking the void releases the current person. The empty space around
        // the structure is part of the world, so dismissing by clicking away
        // keeps the whole interaction inside it.
        onPointerMissed={() => {
          const store = useWorldStore.getState();
          store.focusTrainee(null);
          store.focusTeam(null);
        }}
      >
        <Suspense fallback={null}>
          {debug && <DebugStats />}
          <TesseractScene />
        </Suspense>
      </Canvas>

      <WorldUI />
      <Readout />
      <TimeControl />
      <LensControl />
      {/*
        The counterfactual panel is still not mounted. It alters skills, teams
        and training length, none of which are on screen in this phase, and a
        control that visibly does nothing is worse than one that is absent. It
        is intact and waiting for the phase that needs it.
      */}
      <LoadingVeil />
    </>
  );
}
