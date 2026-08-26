import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { sessionAnchor } from './LearningField';
import { SESSION_READING } from './sessionForms';
import { skillById, traineeById } from '../../data/world';
import { learningByPerson, SHOWN_PER_PERSON } from '../../data/classes';
import { useWorldStore } from '../../store/useWorldStore';

/**
 * The name of the session being pointed at or opened.
 *
 * Deliberately not a panel. One line of type with no container, anchored in
 * world space to the object itself so it travels with its subject as the ring
 * revolves — the object stays the interface and this only says what it is,
 * plus the one line that makes the form legible rather than decorative.
 *
 * An opened session outranks a hovered one, so sweeping the pointer across a
 * person's ring does not steal the label away from whatever is being read.
 */
export function SessionLabel() {
  const groupRef = useRef<THREE.Group>(null);

  const hoveredSession = useWorldStore((state) => state.hoveredSession);
  const openedSession = useWorldStore((state) => state.openedSession);
  const key = openedSession ?? hoveredSession;
  const opened = openedSession !== null;

  const subject = useMemo(() => {
    if (!key) return null;
    const [personId, classId] = key.split(':');
    const profile = learningByPerson.get(personId);
    const session = profile?.sessions.find((s) => s.classId === classId);
    if (!profile || !session) return null;

    return {
      name: skillById.get(classId)?.name ?? classId,
      person: traineeById.get(personId)?.name ?? personId,
      reading: SESSION_READING[classId] ?? '',
      primary: session.primary,
      // Said plainly wherever the count is capped, so five objects never imply
      // five was all there were.
      more:
        profile.likedCount > SHOWN_PER_PERSON
          ? `${SHOWN_PER_PERSON} of ${profile.likedCount} liked`
          : null,
    };
  }, [key]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    const anchor = sessionAnchor();
    if (anchor.live) group.position.copy(anchor.position);
  });

  if (!subject) return null;

  return (
    <group ref={groupRef}>
      <Html center transform={false} zIndexRange={[12, 0]} pointerEvents="none">
        <div className="session-label" data-opened={opened}>
          <p className="session-label__name">{subject.name}</p>
          {subject.primary && (
            <p className="session-label__rank">liked most by {subject.person}</p>
          )}
          {opened && subject.reading && (
            <p className="session-label__reading">{subject.reading}</p>
          )}
          {opened && subject.more && (
            <p className="session-label__note">{subject.more}</p>
          )}
        </div>
      </Html>
    </group>
  );
}
