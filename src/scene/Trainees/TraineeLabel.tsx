import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { ORBS } from '../../config/orbs';
import { teamById, traineeById } from '../../data/world';
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
 */
export function TraineeLabel() {
  const groupRef = useRef<THREE.Group>(null);

  const hoveredTraineeId = useWorldStore((state) => state.hoveredTraineeId);
  const focusedTraineeId = useWorldStore((state) => state.focusedTraineeId);
  const hoveredTeamId = useWorldStore((state) => state.hoveredTeamId);
  const focusedTeamId = useWorldStore((state) => state.focusedTeamId);

  const teamId = focusedTeamId ?? hoveredTeamId;
  const traineeId = focusedTraineeId ?? hoveredTraineeId;

  // A project the pointer is on wins over a person it merely passed over,
  // because the cores sit among the orbs and would otherwise be hard to read.
  const subject = teamId
    ? { kind: 'team' as const, id: teamId, selected: focusedTeamId !== null }
    : traineeId
      ? { kind: 'trainee' as const, id: traineeId, selected: focusedTraineeId !== null }
      : null;

  const text =
    subject?.kind === 'team'
      ? teamById.get(subject.id)?.name
      : subject
        ? traineeById.get(subject.id)?.name
        : undefined;

  const offset = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const group = groupRef.current;
    if (!group || !subject) return;

    const store = useWorldStore.getState();
    const position =
      subject.kind === 'team'
        ? store.teamCentres?.get(subject.id)
        : store.traineePositions?.get(subject.id);
    if (!position) return;

    // Sit clear of the subject's own glow so the type never overlaps it.
    offset.copy(position);
    offset.y += subject.kind === 'team' ? 0.62 : (ORBS.BASE_RADIUS + ORBS.RADIUS_VARIANCE) * 2.1;
    group.position.copy(offset);
  });

  if (!subject || !text) return null;

  return (
    <group ref={groupRef}>
      <Html center transform={false} zIndexRange={[10, 0]} pointerEvents="none">
        <p
          className="trainee-label"
          data-selected={subject.selected}
          data-kind={subject.kind}
        >
          {text}
        </p>
      </Html>
    </group>
  );
}
