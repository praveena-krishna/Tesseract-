import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import {
  MAX_CHALLENGES,
  MAX_SKILLS,
  teams,
  traineeById,
} from '../../data/world';
import { collaborationStrength, effectiveMonth, resolveTrainee } from '../../sim/whatIf';
import { PALETTE } from '../../config/palette';
import { TEAMS } from '../../config/teams';
import { RENDER_ORDER } from '../../config/dimensions';
import { useWorldStore } from '../../store/useWorldStore';

/** Points along each connection curve. More is smoother and costs nothing here. */
const CURVE_STEPS = 14;

interface Pair {
  teamIndex: number;
  a: string;
  b: string;
}

/**
 * Collaboration made visible: the links between people and the structures those
 * links build.
 *
 * Connections are not drawn because two people share a project field — they are
 * drawn because the gravity simulation has actually pulled those two orbs
 * together, and their strength follows how tightly bound the pair is right now.
 * In the first month they are barely present; as the project work takes over
 * they thicken and the formation between the members condenses into a solid
 * core. Weaken collaboration in the counterfactual and the whole structure
 * comes apart again, because it was never anything but a consequence.
 *
 * Every curve in the world is one LineSegments and every project core is one
 * instanced mesh, so this entire layer costs two draw calls.
 */
export function TeamField() {
  const linesRef = useRef<THREE.LineSegments>(null);
  const coresRef = useRef<THREE.InstancedMesh>(null);
  const reducedMotion = useWorldStore((state) => state.reducedMotion);
  const hoverTeam = useWorldStore((state) => state.hoverTeam);
  const focusTeam = useWorldStore((state) => state.focusTeam);

  /** Every collaborating pair, flattened across all teams. */
  const pairs = useMemo<Pair[]>(() => {
    const result: Pair[] = [];
    teams.forEach((team, teamIndex) => {
      for (let i = 0; i < team.memberIds.length; i++) {
        for (let j = i + 1; j < team.memberIds.length; j++) {
          result.push({ teamIndex, a: team.memberIds[i], b: team.memberIds[j] });
        }
      }
    });
    return result;
  }, []);

  const segmentCount = pairs.length * CURVE_STEPS;

  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(segmentCount * 2 * 3), 3),
    );
    geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(new Float32Array(segmentCount * 2 * 3), 3),
    );
    return geometry;
  }, [segmentCount]);

  const coreGeometry = useMemo(
    () => new THREE.IcosahedronGeometry(TEAMS.CORE_RADIUS, 1),
    [],
  );

  useEffect(
    () => () => {
      lineGeometry.dispose();
      coreGeometry.dispose();
    },
    [lineGeometry, coreGeometry],
  );

  /** Eased per-team formation strength, so months blend rather than switch. */
  const levels = useMemo(() => new Float32Array(teams.length), []);
  /** Live centroid of each team, published for the camera and labels. */
  const centres = useMemo(
    () => new Map(teams.map((team) => [team.id, new THREE.Vector3()])),
    [],
  );
  const setTeamCentres = useWorldStore((state) => state.setTeamCentres);

  useEffect(() => {
    setTeamCentres(centres);
    return () => setTeamCentres(null);
  }, [centres, setTeamCentres]);

  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const start = useMemo(() => new THREE.Vector3(), []);
  const end = useMemo(() => new THREE.Vector3(), []);
  const control = useMemo(() => new THREE.Vector3(), []);
  const current = useMemo(() => new THREE.Vector3(), []);
  const previous = useMemo(() => new THREE.Vector3(), []);
  const baseColor = useMemo(() => new THREE.Color(PALETTE.CONNECTION_ACTIVE), []);
  const scratch = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }, delta) => {
    const lines = linesRef.current;
    const cores = coresRef.current;
    if (!lines || !cores) return;

    const time = clock.elapsedTime;
    const step = Math.min(delta, 0.1);
    const ease = reducedMotion ? 1 : 1 - Math.exp(-step / 0.85);

    const store = useWorldStore.getState();
    // Unmounted in this phase. When it returns it reads the layer the viewer is
    // standing in, which is the only month that has people to connect.
    const { enteredMonth, whatIf, focusedTeamId, hoveredTeamId, focusedTraineeId } =
      store;
    const month = enteredMonth ?? 0;
    const positions = store.traineePositions;
    const collaboration = collaborationStrength(month, whatIf);
    const capped = effectiveMonth(month, whatIf);

    const positionAttr = lines.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colorAttr = lines.geometry.getAttribute('color') as THREE.BufferAttribute;

    // Team centroids, and how present each team's structure is right now.
    teams.forEach((team, teamIndex) => {
      const centre = centres.get(team.id);
      if (!centre) return;

      let counted = 0;
      centre.set(0, 0, 0);
      for (const memberId of team.memberIds) {
        if (memberId === whatIf.removedTraineeId) continue;
        const position = positions?.get(memberId);
        if (!position) continue;
        centre.add(position);
        counted += 1;
      }
      if (counted > 0) centre.divideScalar(counted);

      // A team missing a member builds less. The formation is a consequence of
      // the people in it, so losing one visibly weakens what they made.
      const roster = team.memberIds.length;
      const remaining = team.memberIds.filter(
        (id) => id !== whatIf.removedTraineeId,
      ).length;
      const staffing = roster > 0 ? remaining / roster : 0;

      const target =
        team.maturityByMonth[capped] * collaboration * staffing * team.cohesion * 1.6;
      levels[teamIndex] += (Math.min(1, target) - levels[teamIndex]) * ease;
    });

    // Connections.
    let vertex = 0;
    for (const pair of pairs) {
      const team = teams[pair.teamIndex];
      const level = levels[pair.teamIndex];

      const from = positions?.get(pair.a);
      const to = positions?.get(pair.b);
      const dropped =
        pair.a === whatIf.removedTraineeId || pair.b === whatIf.removedTraineeId;

      const highlighted =
        team.id === focusedTeamId ||
        team.id === hoveredTeamId ||
        (focusedTraineeId !== null && team.memberIds.includes(focusedTraineeId));
      const dimmed =
        (focusedTeamId !== null || focusedTraineeId !== null) && !highlighted;

      // How strained this particular pair is: a link between two people under
      // pressure frays rather than sitting steady.
      const strain =
        (resolveTrainee(traineeById.get(pair.a)!, month, whatIf, MAX_SKILLS, MAX_CHALLENGES)
          .turbulence +
          resolveTrainee(traineeById.get(pair.b)!, month, whatIf, MAX_SKILLS, MAX_CHALLENGES)
            .turbulence) /
        2;

      let strength = dropped || !from || !to ? 0 : level;
      if (dimmed) strength *= 0.25;
      if (highlighted) strength *= 1.5;
      strength = Math.min(1, strength);

      if (!from || !to || strength <= 0.001) {
        // Collapse unused segments to a point rather than leaving stale
        // geometry from a previous frame lying across the scene.
        for (let s = 0; s < CURVE_STEPS; s++) {
          positionAttr.setXYZ(vertex, 0, 0, 0);
          colorAttr.setXYZ(vertex, 0, 0, 0);
          vertex += 1;
          positionAttr.setXYZ(vertex, 0, 0, 0);
          colorAttr.setXYZ(vertex, 0, 0, 0);
          vertex += 1;
        }
        continue;
      }

      start.copy(from);
      end.copy(to);

      // Bow the link outward from the world's centre. A straight line between
      // two points reads as a diagram edge; an arc reads as a relationship.
      control.addVectors(start, end).multiplyScalar(0.5);
      const bow = control.length();
      if (bow > 1e-4) control.multiplyScalar((bow + TEAMS.CURVE_BOW) / bow);

      previous.copy(start);
      for (let s = 1; s <= CURVE_STEPS; s++) {
        const t = s / CURVE_STEPS;
        const inv = 1 - t;

        // Quadratic Bézier through the bowed control point.
        current
          .copy(start)
          .multiplyScalar(inv * inv)
          .addScaledVector(control, 2 * inv * t)
          .addScaledVector(end, t * t);

        // Strain makes the curve waver along its length.
        if (strain > 0 && !reducedMotion) {
          const wobble = Math.sin(t * 9 + time * 4 + pair.teamIndex) * strain * 0.06;
          current.y += wobble;
        }

        // Brightest at the middle of the span, fading into both people, so the
        // link belongs to the space between them rather than terminating in a
        // hard stub at each orb.
        const along = Math.sin(t * Math.PI);
        scratch.copy(baseColor).multiplyScalar(strength * (0.25 + along * 0.75));

        positionAttr.setXYZ(vertex, previous.x, previous.y, previous.z);
        colorAttr.setXYZ(vertex, scratch.r, scratch.g, scratch.b);
        vertex += 1;

        positionAttr.setXYZ(vertex, current.x, current.y, current.z);
        colorAttr.setXYZ(vertex, scratch.r, scratch.g, scratch.b);
        vertex += 1;

        previous.copy(current);
      }
    }

    positionAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;

    // Project cores.
    teams.forEach((team, teamIndex) => {
      const centre = centres.get(team.id);
      const level = levels[teamIndex];
      if (!centre) return;

      const highlighted = team.id === focusedTeamId || team.id === hoveredTeamId;
      const dimmed =
        (focusedTeamId !== null || focusedTraineeId !== null) &&
        !highlighted &&
        !(focusedTraineeId !== null && team.memberIds.includes(focusedTraineeId));

      // The core only exists once the collaboration that builds it does.
      let scale = level * (highlighted ? 1.35 : dimmed ? 0.55 : 1);
      if (!reducedMotion) {
        scale *= 1 + Math.sin(time * 0.7 + teamIndex) * 0.05;
      }

      matrix.makeRotationY(reducedMotion ? 0 : time * 0.12 + teamIndex);
      matrix.scale(new THREE.Vector3(scale, scale, scale));
      matrix.setPosition(centre);
      cores.setMatrixAt(teamIndex, matrix);
    });

    cores.instanceMatrix.needsUpdate = true;
  });

  const teamAt = useCallback((instanceId: number | undefined): string | null => {
    if (instanceId === undefined) return null;
    return teams[instanceId]?.id ?? null;
  }, []);

  const onCorePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      hoverTeam(teamAt(event.instanceId));
    },
    [hoverTeam, teamAt],
  );

  const onCoreClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      const id = teamAt(event.instanceId);
      if (!id) return;
      const current = useWorldStore.getState().focusedTeamId;
      focusTeam(current === id ? null : id);
    },
    [focusTeam, teamAt],
  );

  return (
    <group>
      <lineSegments ref={linesRef} geometry={lineGeometry} frustumCulled={false}>
        <lineBasicMaterial
          vertexColors
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </lineSegments>

      <instancedMesh
        ref={coresRef}
        args={[coreGeometry, undefined, teams.length]}
        renderOrder={RENDER_ORDER.PROJECTS}
        frustumCulled={false}
        onPointerMove={onCorePointerMove}
        onPointerOut={() => hoverTeam(null)}
        onClick={onCoreClick}
      >
        <meshStandardMaterial
          color={PALETTE.PROJECT_CORE}
          emissive={PALETTE.PROJECT_EMISSIVE}
          emissiveIntensity={0.9}
          metalness={0.6}
          roughness={0.25}
          transparent
          opacity={0.92}
          depthWrite={false}
        />
      </instancedMesh>
    </group>
  );
}
