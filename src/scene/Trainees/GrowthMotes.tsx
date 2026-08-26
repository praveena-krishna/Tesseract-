import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { orbKey } from './orbKey';
import { CHALLENGE_RECORDS } from '../../data/challenges';
import { PALETTE } from '../../config/palette';
import { CHALLENGES, DIMENSION, GROWTH, RENDER_ORDER, SHELLS } from '../../config/dimensions';
import { ORBS } from '../../config/orbs';
import { useWorldStore } from '../../store/useWorldStore';

/** One piece of learning on its way into the person who earned it. */
interface Mote {
  personId: string;
  orb: string;
  /** Where it forms, relative to its person, in orb radii. */
  from: THREE.Vector3;
  /** 0 out there, 1 absorbed. Only live while travelling. */
  travel: number;
  live: boolean;
}

/**
 * Learning arriving, one piece at a time.
 *
 * Working a difficulty through teaches somebody something, and this is that
 * something crossing the gap: a small light forms out beyond the person, moves
 * in, and is taken into their vessel. It appears only at the moment a
 * difficulty is resolved and it is gone once it lands — it is the event, not a
 * marker, so there is never a drift of loose particles around the month.
 *
 * It is deliberately one mote per resolution rather than a spray. What arrives
 * is a piece of knowledge, and a shower of sparks would say something was
 * broken open instead of something being understood.
 *
 * The brightening it causes is not done here. This only carries the light in;
 * the vessel's own growth term takes over as it lands, and that eases over a
 * couple of seconds so the gain reads as absorption rather than as a flash.
 */
export function GrowthMotes({
  positions,
}: {
  positions: Map<string, THREE.Vector3>;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const reducedMotion = useWorldStore((state) => state.reducedMotion);

  /** One slot per difficulty: at most one mote can be in flight for each. */
  const motes = useMemo<Mote[]>(
    () =>
      CHALLENGE_RECORDS.map((record, index) => {
        const golden = Math.PI * (3 - Math.sqrt(5));
        const y = 1 - (2 * (index + 0.5)) / CHALLENGE_RECORDS.length;
        const band = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = golden * index;
        return {
          personId: record.personId,
          orb: orbKey(CHALLENGES.MONTH, record.personId),
          from: new THREE.Vector3(
            Math.cos(theta) * band,
            y,
            Math.sin(theta) * band,
          )
            .normalize()
            .multiplyScalar(GROWTH.FROM),
          travel: 0,
          live: false,
        };
      }),
    [],
  );

  /** What each difficulty's status was last frame, so a change can be caught. */
  const seen = useRef<string[]>(CHALLENGE_RECORDS.map(() => 'not-started'));

  const orbRadius = useMemo(() => {
    const baseHalf = SHELLS[DIMENSION.SHELL_OF_MONTH[0]].half;
    const half = SHELLS[DIMENSION.SHELL_OF_MONTH[CHALLENGES.MONTH]].half;
    return ORBS.BASE_RADIUS * (half / baseHalf);
  }, []);

  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 2), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(PALETTE.KNOWLEDGE),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const scratch = useMemo(
    () => ({ matrix: new THREE.Matrix4(), position: new THREE.Vector3() }),
    [],
  );

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const step = Math.min(delta, 0.1);
    const store = useWorldStore.getState();
    const live =
      store.enteredMonth === CHALLENGES.MONTH && store.lens === 'challenges';

    let brightest = 0;

    for (let i = 0; i < motes.length; i++) {
      const mote = motes[i];
      const record = CHALLENGE_RECORDS[i];
      const status = store.challengeStatus[record.id] ?? 'not-started';

      // The moment of resolution, and only that moment. A mote is launched on
      // the transition rather than while the state holds, so nothing keeps
      // emitting once the learning has landed.
      if (status === 'overcome' && seen.current[i] !== 'overcome' && live) {
        mote.travel = 0;
        mote.live = true;
      }
      seen.current[i] = status;

      const centre = live ? positions.get(mote.orb) : undefined;
      if (!mote.live || !centre) {
        scratch.matrix.makeScale(0.0001, 0.0001, 0.0001);
        mesh.setMatrixAt(i, scratch.matrix);
        continue;
      }

      mote.travel += reducedMotion ? 1 : step / GROWTH.TRAVEL;
      if (mote.travel >= 1) {
        // Absorbed. The vessel's own growth carries it from here.
        mote.live = false;
        scratch.matrix.makeScale(0.0001, 0.0001, 0.0001);
        mesh.setMatrixAt(i, scratch.matrix);
        continue;
      }

      // Easing in at the far end and out as it enters, so it arrives rather
      // than stopping. Nothing about this should read as an impact.
      const t = mote.travel;
      const eased = t * t * (3 - 2 * t);
      scratch.position
        .copy(centre)
        .addScaledVector(mote.from, orbRadius * (1 - eased));

      // It shrinks as it is taken in, which is what absorption looks like: the
      // light does not wink out, it stops being separate from the person.
      const fade = 1 - Math.pow(Math.max(0, eased - 0.7) / 0.3, 2);
      const size = orbRadius * GROWTH.SIZE * Math.max(0, fade);
      brightest = Math.max(brightest, Math.max(0, fade));

      scratch.matrix.makeScale(
        Math.max(0.0001, size),
        Math.max(0.0001, size),
        Math.max(0.0001, size),
      );
      scratch.matrix.setPosition(scratch.position);
      mesh.setMatrixAt(i, scratch.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.visible = brightest > 0.01;
    material.opacity = Math.min(1, brightest);
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, motes.length]}
      frustumCulled={false}
      renderOrder={RENDER_ORDER.ORB_HALOS}
      raycast={() => null}
    />
  );
}
