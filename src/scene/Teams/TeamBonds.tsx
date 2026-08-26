import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { orbKey } from '../Trainees/orbKey';
import { teams } from '../../data/world';
import { PALETTE } from '../../config/palette';
import { BONDS, RENDER_ORDER } from '../../config/dimensions';
import { useWorldStore } from '../../store/useWorldStore';

/** Points along each bond. More is smoother and costs nothing here. */
const CURVE_STEPS = 12;

interface Spoke {
  teamIndex: number;
  teamId: string;
  memberId: string;
  /** Which member of its team this is; used to vary the arc. */
  ordinal: number;
}

export function TeamBonds() {
  const linesRef = useRef<THREE.LineSegments>(null);
  const reducedMotion = useWorldStore((state) => state.reducedMotion);

  /**
   * One spoke per person: from the project their team built, out to them.
   *
   * Hub and spoke rather than every pair joined to every other. A mesh between
   * members states that four people know each other, which nobody doubted; a
   * spoke states that this person is one of the people this thing came from,
   * which is the relationship actually worth drawing. It also means sixteen
   * lines instead of eighteen and no line that could ever cross a team boundary
   * — a spoke has a team at both ends by construction.
   */
  const spokes = useMemo<Spoke[]>(() => {
    const result: Spoke[] = [];
    teams.forEach((team, teamIndex) => {
      team.memberIds.forEach((memberId, ordinal) => {
        result.push({ teamIndex, teamId: team.id, memberId, ordinal });
      });
    });
    return result;
  }, []);

  const geometry = useMemo(() => {
    const vertices = spokes.length * CURVE_STEPS * 2;
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(vertices * 3), 3),
    );
    buffer.setAttribute(
      'color',
      new THREE.BufferAttribute(new Float32Array(vertices * 3), 3),
    );
    return buffer;
  }, [spokes.length]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  /** Eased strength per spoke, so one never snaps into existence. */
  const levels = useMemo(() => new Float32Array(spokes.length), [spokes.length]);
  /** Live centroid of each team, so a bond knows which way is outward. */
  const centroids = useMemo(
    () => teams.map(() => new THREE.Vector3()),
    [],
  );

  const scratch = useMemo(
    () => ({
      start: new THREE.Vector3(),
      end: new THREE.Vector3(),
      control: new THREE.Vector3(),
      outward: new THREE.Vector3(),
      current: new THREE.Vector3(),
      previous: new THREE.Vector3(),
      base: new THREE.Color(PALETTE.CONNECTION_ACTIVE),
      colour: new THREE.Color(),
    }),
    [],
  );

  useFrame((_, delta) => {
    const lines = linesRef.current;
    if (!lines) return;

    const step = Math.min(delta, 0.1);
    const ease = reducedMotion ? 1 : 1 - Math.exp(-step / BONDS.EASE);

    const store = useWorldStore.getState();
    const positions = store.traineePositions;
    const month = store.enteredMonth;
    // Brightest when the world is about who gathered with whom, present but
    // quieter otherwise — they are always a true statement about the field, so
    // they are never switched off outright.
    const emphasis =
      store.lens === 'teams' ? 1 : store.lens === 'projects' ? 0.45 : 0.7;
    // Bonds belong to the month whose story is collaboration. Elsewhere there
    // is nothing for them to be a consequence of.
    // Spokes belong to the lenses that are about the work. Under people the
    // sixteen are individuals and nothing joins them; under challenges the
    // spokes stay, because the fragments come off the very people they name.
    const live =
      month === BONDS.MONTH &&
      (store.lens === 'teams' || store.lens === 'projects');

    const positionAttr = lines.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colorAttr = lines.geometry.getAttribute('color') as THREE.BufferAttribute;

    if (live && positions) {
      teams.forEach((team, i) => {
        const centroid = centroids[i];
        centroid.set(0, 0, 0);
        let counted = 0;
        for (const memberId of team.memberIds) {
          const position = positions.get(orbKey(month, memberId));
          if (!position) continue;
          centroid.add(position);
          counted += 1;
        }
        if (counted > 0) centroid.divideScalar(counted);
      });
    }

    let vertex = 0;
    for (let i = 0; i < spokes.length; i++) {
      const spoke = spokes[i];
      const centre = centroids[spoke.teamIndex];
      const member =
        live && positions ? positions.get(orbKey(month, spoke.memberId)) : undefined;

      // Strength is proximity and nothing else. A person the simulation has not
      // yet brought to their team has no line to the thing that team built.
      let target = 0;
      if (member && live) {
        target = 1 - THREE.MathUtils.smoothstep(
          member.distanceTo(centre),
          BONDS.NEAR,
          BONDS.FAR,
        );
      }
      levels[i] += (target - levels[i]) * ease;

      const strength = levels[i];
      if (!member || strength <= 0.004) {
        for (let s = 0; s < CURVE_STEPS * 2; s++) {
          positionAttr.setXYZ(vertex, 0, 0, 0);
          colorAttr.setXYZ(vertex, 0, 0, 0);
          vertex += 1;
        }
        continue;
      }

      scratch.start.copy(centre);
      scratch.end.copy(member);

      // Bowed, and each member's spoke bows a different way, so a team reads as
      // a three-dimensional thing rather than a flat asterisk. Straight lines
      // from a hub are the network diagram this is trying not to be.
      scratch.control.addVectors(scratch.start, scratch.end).multiplyScalar(0.5);
      scratch.outward
        .set(
          Math.sin(spoke.ordinal * 2.4 + spoke.teamIndex),
          Math.cos(spoke.ordinal * 1.7 + spoke.teamIndex * 2),
          Math.sin(spoke.ordinal * 3.1 + spoke.teamIndex * 0.7),
        )
        .normalize();
      scratch.control.addScaledVector(scratch.outward, BONDS.BOW);

      scratch.previous.copy(scratch.start);
      for (let s = 1; s <= CURVE_STEPS; s++) {
        const t = s / CURVE_STEPS;
        const inv = 1 - t;

        scratch.current
          .copy(scratch.start)
          .multiplyScalar(inv * inv)
          .addScaledVector(scratch.control, 2 * inv * t)
          .addScaledVector(scratch.end, t * t);

        // Brightest close to the project and fading toward the person, so the
        // line reads as coming *from* what they built rather than as a tether
        // holding them in place.
        const along = Math.sin(t * Math.PI) * (1 - t * 0.55);
        scratch.colour
          .copy(scratch.base)
          .multiplyScalar(strength * BONDS.BRIGHTNESS * emphasis * along);

        positionAttr.setXYZ(
          vertex,
          scratch.previous.x,
          scratch.previous.y,
          scratch.previous.z,
        );
        colorAttr.setXYZ(vertex, scratch.colour.r, scratch.colour.g, scratch.colour.b);
        vertex += 1;

        positionAttr.setXYZ(
          vertex,
          scratch.current.x,
          scratch.current.y,
          scratch.current.z,
        );
        colorAttr.setXYZ(vertex, scratch.colour.r, scratch.colour.g, scratch.colour.b);
        vertex += 1;

        scratch.previous.copy(scratch.current);
      }
    }

    positionAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;

    if (import.meta.env.DEV) {
      // The bonds' own strengths, so a check can measure them directly.
      // Counting coloured pixels cannot: the vessels and their halos occupy the
      // same corner of the spectrum and swamp the lines entirely.
      let total = 0;
      let strongest = 0;
      for (let i = 0; i < levels.length; i++) {
        total += levels[i];
        strongest = Math.max(strongest, levels[i]);
      }
      (window as unknown as Record<string, unknown>).__bonds = {
        mean: +(total / Math.max(1, levels.length)).toFixed(3),
        strongest: +strongest.toFixed(3),
        resolved: levels.filter((v) => v > 0.5).length,
        of: levels.length,
      };
    }
  });

  return (
    <lineSegments
      ref={linesRef}
      geometry={geometry}
      renderOrder={RENDER_ORDER.CONNECTIONS}
      frustumCulled={false}
    >
      <lineBasicMaterial
        vertexColors
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </lineSegments>
  );
}
