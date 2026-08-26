import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { challengesOf, CHALLENGE_RECORDS } from '../../data/challenges';
import { GROWTH_PER_CHALLENGE, baselineGrowth } from '../../data/growth';
import { PALETTE } from '../../config/palette';
import { CHALLENGES, GROWTH } from '../../config/dimensions';
import { useWorldStore } from '../../store/useWorldStore';

/**
 * The layer lit by what the sixteen together came away with.
 *
 * A single light at the centre of the month, and nothing else. Its strength is
 * the mean of what everybody has gained, so the box warms as the month goes
 * well and dims when it has not — the structure the training happened inside is
 * lit by the training.
 *
 * Deliberately far below the level at which anybody could point at it. The
 * frames should look a little warmer without it being possible to say which
 * orb is responsible, which is the difference between a collective effect and
 * sixteen individual ones happening at once. It is felt, not seen.
 */
export function CollectiveGlow() {
  const lightRef = useRef<THREE.PointLight>(null);
  const reducedMotion = useWorldStore((state) => state.reducedMotion);

  const people = useMemo(
    () => [...new Set(CHALLENGE_RECORDS.map((record) => record.personId))],
    [],
  );

  const level = useRef(0);
  const colour = useMemo(() => new THREE.Color(PALETTE.KNOWLEDGE), []);

  useFrame((_, delta) => {
    const light = lightRef.current;
    if (!light) return;

    const step = Math.min(delta, 0.1);
    const store = useWorldStore.getState();
    const live =
      store.enteredMonth === CHALLENGES.MONTH && store.lens === 'databricks';

    let total = 0;
    if (live) {
      for (const personId of people) {
        const done = challengesOf(personId).filter(
          (record) => store.challengeStatus[record.id] === 'overcome',
        ).length;
        total += Math.min(1, baselineGrowth(personId) + done * GROWTH_PER_CHALLENGE);
      }
      total /= Math.max(1, people.length);
    }

    // On the same slow clock the vessels use, so the room and the people it
    // holds brighten together rather than at two different rates.
    const ease = reducedMotion ? 1 : 1 - Math.exp(-step / GROWTH.EASE);
    level.current += (total - level.current) * ease;

    light.intensity = level.current * GROWTH.COLLECTIVE;
    light.visible = light.intensity > 0.001;
  });

  return (
    <pointLight
      ref={lightRef}
      color={colour}
      intensity={0}
      // Reaches the frames of the layer the people are standing in and stops
      // well short of the others, so this cannot brighten a month nobody is in.
      distance={14}
      decay={1.6}
      position={[0, 0, 0]}
    />
  );
}
