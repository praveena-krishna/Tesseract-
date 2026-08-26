import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Shell } from './Shell';
import { Connections } from './Connections';
import { CoreVolume } from './CoreVolume';
import { MonthPortal } from './MonthPortal';
import { DimensionalTransition } from './DimensionalTransition';
import { SHELLS } from '../../config/dimensions';
import { TIMINGS } from '../../config/timings';
import { useWorldStore } from '../../store/useWorldStore';

/**
 * The world itself: three nested shells, the dimensional links between their
 * corresponding vertices, and the luminous core they enclose.
 *
 * The shells are also the three months, and time runs outward: the innermost
 * box is Month 1, the middle is Month 2, the outer is Month 3. The training
 * starts small and contained and expands, so the structure expands with it.
 *
 * Months 1 and 2 are reachable; Month 3 is not wired yet. Month 1 is the
 * smallest and faintest of the three from outside — which is what the nest was
 * built to do, each shell receding behind the last — so the moment a layer is
 * entered the hierarchy inverts: the one being occupied lights up and the
 * others pull back, and the box holding the people becomes the brightest thing
 * in the frame instead of the dimmest.
 *
 * The inner shells counter-rotate at rates just above the threshold of
 * perception. This is the single cheapest thing in the scene and one of the
 * most important — a perfectly static nest of cubes reads as a diagram, while
 * a slow differential rotation reads as a mechanism under its own power.
 */
export function Tesseract() {
  const shellRefs = useRef<(THREE.Group | null)[]>([]);
  const reducedMotion = useWorldStore((state) => state.reducedMotion);

  useFrame((_, delta) => {
    if (reducedMotion) return;

    // Clamp delta so a backgrounded tab does not snap the shells forward on
    // return, which would break the illusion of continuous motion.
    const step = Math.min(delta, 0.1);

    shellRefs.current.forEach((group, i) => {
      const rate = TIMINGS.SHELL_ROTATION[i] ?? 0;
      if (!group || rate === 0) return;
      group.rotation.y += rate * step;
      // A slight tilt component keeps the rotation from reading as a turntable.
      group.rotation.x += rate * step * 0.35;
    });
  });

  return (
    <group>
      {SHELLS.map((spec, i) => (
        <group
          key={spec.half}
          ref={(node) => {
            shellRefs.current[i] = node;
          }}
        >
          <Shell spec={spec} index={i} />
        </group>
      ))}

      <Connections />
      <CoreVolume />

      <MonthPortal month={0} />
      <MonthPortal month={1} />
      <DimensionalTransition />
    </group>
  );
}
