import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { projectOf } from '../data/projects';
import { BONDS } from '../config/dimensions';
import { useWorldStore } from '../store/useWorldStore';

/**
 * What a project is, said in as few words as the thing allows.
 *
 * Two lines of type with no container, anchored in world space to the artifact
 * itself. The artifact stays the interface; this only names it and says what it
 * does, because a form can carry a great deal of meaning and still cannot tell
 * you it monitors construction sites.
 *
 * An opened project outranks a hovered one, so sweeping the pointer across the
 * month does not steal the label away from whatever is being read.
 */
export function ProjectLabel() {
  const groupRef = useRef<THREE.Group>(null);

  const hoveredTeamId = useWorldStore((state) => state.hoveredTeamId);
  const focusedTeamId = useWorldStore((state) => state.focusedTeamId);
  const enteredMonth = useWorldStore((state) => state.enteredMonth);

  const teamId = focusedTeamId ?? hoveredTeamId;
  const opened = focusedTeamId !== null;
  const project = useMemo(() => (teamId ? projectOf(teamId) : undefined), [teamId]);

  const offset = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const group = groupRef.current;
    if (!group || !teamId) return;
    const centre = useWorldStore.getState().teamCentres?.get(teamId);
    if (!centre) return;
    // Sit clear of the artifact so the type never overlaps its structure.
    offset.copy(centre);
    offset.y += 0.66;
    group.position.copy(offset);
  });

  if (!project || enteredMonth !== BONDS.MONTH) return null;

  return (
    <group ref={groupRef}>
      <Html center transform={false} zIndexRange={[11, 0]} pointerEvents="none">
        {/*
          The name and nothing more. What the project is and how to read its
          figure are said at the side, where the text is still and does not sit
          on top of the thing it is describing.
        */}
        <div className="project-label" data-opened={opened}>
          <p className="project-label__name">{project.name}</p>
        </div>
      </Html>
    </group>
  );
}
