import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { ORBS } from '../../config/orbs';
import { DIMENSION, SHELLS } from '../../config/dimensions';
import { orbKey } from './orbKey';
import { traineeById } from '../../data/world';
import { useWorldStore } from '../../store/useWorldStore';

/**
 * The name of whatever is currently being attended to — a person or a project.
 *
 * Deliberately not a tooltip and not a card: a single tracked-out line with no
 * container, anchored in world space so it travels with its subject. Selection
 * here means moving deeper into the same world, and a panel opening over the
 * top would be the clearest possible signal that you had left it.
 *
 * A selection outranks a hover, so passing the pointer across the field does
 * not steal the label away from whatever is currently held.
 *
 * The name and nothing else. A chosen person used to carry a second line naming
 * their project and the size of their team, which put two facts in a place that
 * is meant to identify one thing — and the formation and its roster are already
 * drawn in the month where they matter.
 */
export function TraineeLabel() {
  const groupRef = useRef<THREE.Group>(null);

  const hoveredTraineeId = useWorldStore((state) => state.hoveredTraineeId);
  const focusedTraineeId = useWorldStore((state) => state.focusedTraineeId);
  const hoveredTeamId = useWorldStore((state) => state.hoveredTeamId);
  const focusedTeamId = useWorldStore((state) => state.focusedTeamId);

  const teamId = focusedTeamId ?? hoveredTeamId;
  const traineeId = focusedTraineeId ?? hoveredTraineeId;

  // Projects name themselves, beside their own artifact. This used to do it too,
  // which put two labels for one thing in the same patch of screen.
  const subject =
    teamId || !traineeId
      ? null
      : {
          kind: 'trainee' as const,
          id: traineeId,
          selected: focusedTraineeId !== null,
        };

  const text = subject ? traineeById.get(subject.id)?.name : undefined;

  const offset = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const group = groupRef.current;
    if (!group || !subject) return;

    const store = useWorldStore.getState();
    // Everything is keyed by layer as well as by identity, because the same
    // person stands in more than one month and only the one being occupied is
    // the subject.
    if (store.enteredMonth === null) return;
    const position = store.traineePositions?.get(
      orbKey(store.enteredMonth, subject.id),
    );
    if (!position) return;

    // Sit clear of the subject's own glow so the type never overlaps it.
    //
    // Everything in a layer is scaled to that layer, the people included, so
    // the lift has to be too. Held at Month 1's size it is a clearance in the
    // first month and a position inside the vessel by the third, where the
    // orbs are four times the radius.
    const scale =
      SHELLS[DIMENSION.SHELL_OF_MONTH[store.enteredMonth]].half /
      SHELLS[DIMENSION.SHELL_OF_MONTH[0]].half;
    const radius = (ORBS.BASE_RADIUS + ORBS.RADIUS_VARIANCE) * scale;

    offset.copy(position);
    offset.y +=
      radius * (subject.selected ? ORBS.LABEL_LIFT_FOCUSED : ORBS.LABEL_LIFT);
    group.position.copy(offset);
  });

  if (!subject || !text) return null;

  return (
    <group ref={groupRef}>
      <Html center transform={false} zIndexRange={[10, 0]} pointerEvents="none">
        <p
          className="trainee-label"
          data-selected={subject.selected}
          data-kind="trainee"
        >
          {text}
        </p>
      </Html>
    </group>
  );
}
