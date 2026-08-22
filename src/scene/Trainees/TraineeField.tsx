import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { HALO_FRAG, HALO_VERT, ORB_FRAG, ORB_VERT } from '../../shaders/orb.glsl';
import { computeOrbPositions } from './orbLayout';
import { TraineeLabel } from './TraineeLabel';
import { SkillField } from './SkillField';
import { useSelectionKeys } from '../../interaction/useSelectionKeys';
import {
  MAX_CHALLENGES,
  MAX_SKILLS,
  teamOfTrainee,
  trainees,
} from '../../data/world';
import { collaborationStrength, resolveTrainee } from '../../sim/whatIf';
import type { GravityBody } from '../../sim/gravity';
import { initialiseTeamCentres, stepGravity } from '../../sim/gravity';
import { PALETTE } from '../../config/palette';
import { ORBS } from '../../config/orbs';
import { RENDER_ORDER } from '../../config/dimensions';
import { useWorldStore } from '../../store/useWorldStore';

/** Stable per-person seed, derived from the identifier rather than the index. */
function seedFor(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

/** Flags an instanced attribute for upload, tolerating one not yet attached. */
function markUpdated(mesh: THREE.InstancedMesh, name: string): void {
  const attribute = mesh.geometry.getAttribute(name);
  if (attribute) attribute.needsUpdate = true;
}

/**
 * The sixteen people.
 *
 * Each orb is one instance of a single icosphere whose position is solved by
 * the gravity simulation, not animated. What it looks like at any moment is
 * read from the world model: how much the person had learned by the current
 * month, what they were struggling with, how strongly they were bound to their
 * team, and whether the counterfactual conditions include them at all.
 *
 * Variation between people is deliberately narrow — a shared palette, a shared
 * form, differences of complexity, tempo and scale — so the field reads as one
 * population of peers rather than sixteen unrelated objects.
 */
export function TraineeField() {
  const orbRef = useRef<THREE.InstancedMesh>(null);
  const haloRef = useRef<THREE.InstancedMesh>(null);
  const orbMaterialRef = useRef<THREE.ShaderMaterial>(null);

  const reducedMotion = useWorldStore((state) => state.reducedMotion);
  const setTraineePositions = useWorldStore((state) => state.setTraineePositions);
  const hoverTrainee = useWorldStore((state) => state.hoverTrainee);
  const focusTrainee = useWorldStore((state) => state.focusTrainee);

  const count = trainees.length;

  /** Resting layout: where each person sits when working alone. */
  const homes = useMemo(() => {
    const layout = computeOrbPositions(count);
    return new Map(trainees.map((trainee, i) => [trainee.id, layout[i]]));
  }, [count]);

  const bodies = useMemo<GravityBody[]>(() => {
    initialiseTeamCentres(homes);
    return trainees.map((trainee) => {
      const home = homes.get(trainee.id) ?? new THREE.Vector3();
      return {
        id: trainee.id,
        home,
        position: home.clone(),
        velocity: new THREE.Vector3(),
        teamId: teamOfTrainee.get(trainee.id)?.id ?? null,
        present: true,
        bonding: 0,
        turbulence: 0,
      };
    });
  }, [homes]);

  const seeds = useMemo(() => trainees.map((t) => seedFor(t.id)), []);

  const orbGeometry = useMemo(
    () => new THREE.IcosahedronGeometry(1, ORBS.DETAIL),
    [],
  );
  const haloGeometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  const orbUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uGlass: { value: new THREE.Color(PALETTE.ORB_GLASS) },
      uGlow: { value: new THREE.Color(PALETTE.ORB_GLOW) },
      uRim: { value: new THREE.Color(PALETTE.ORB_RIM) },
      uDispersion: { value: new THREE.Color(PALETTE.ORB_DISPERSION) },
      uSpecular: { value: new THREE.Color(PALETTE.ORB_SPECULAR) },
      // Matches the scene's key light, so glints sit where the lighting rig
      // says they should rather than floating independently of the world.
      uLightDir: { value: new THREE.Vector3(6, 8, 4).normalize() },
      uIor: { value: 1.45 },
      uOpacity: { value: 1 },
    }),
    [],
  );

  const haloUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(PALETTE.ORB_HALO) },
      uOpacity: { value: ORBS.HALO_OPACITY },
    }),
    [],
  );

  /**
   * Per-instance state, rewritten every frame.
   *
   * Instances are re-sorted by depth for correct blending, so an orb's
   * attributes have to travel with it into whichever slot it lands in —
   * otherwise sorting would silently swap the people around.
   */
  const buffers = useMemo(
    () => ({
      seeds: new Float32Array(count),
      complexity: new Float32Array(count),
      tempos: new Float32Array(count),
      emphasis: new Float32Array(count),
      turbulence: new Float32Array(count),
      presence: new Float32Array(count).fill(1),
      order: trainees.map((_, i) => i),
      distances: new Float32Array(count),
      /** Eased per-person values, indexed by trainee rather than by slot. */
      emphasisLevel: new Float32Array(count).fill(ORBS.EMPHASIS_NEUTRAL),
      complexityLevel: new Float32Array(count),
      turbulenceLevel: new Float32Array(count),
      presenceLevel: new Float32Array(count).fill(1),
      radiusLevel: new Float32Array(count).fill(ORBS.BASE_RADIUS),
    }),
    [count],
  );

  /**
   * Live orb positions, published for the camera, labels, connections and
   * project formations to read. The same map is mutated in place every frame
   * rather than replaced, so nothing re-renders.
   */
  const positions = useMemo(
    () => new Map(trainees.map((t) => [t.id, new THREE.Vector3()])),
    [],
  );

  useEffect(() => {
    setTraineePositions(positions);
    return () => setTraineePositions(null);
  }, [positions, setTraineePositions]);

  useEffect(() => {
    const attach = (mesh: THREE.InstancedMesh | null, full: boolean) => {
      if (!mesh) return;
      const set = (name: string, array: Float32Array) =>
        mesh.geometry.setAttribute(
          name,
          new THREE.InstancedBufferAttribute(array, 1),
        );

      set('aComplexity', buffers.complexity);
      set('aEmphasis', buffers.emphasis);
      set('aPresence', buffers.presence);
      if (full) {
        set('aSeed', buffers.seeds);
        set('aTempo', buffers.tempos);
        set('aTurbulence', buffers.turbulence);
      }
    };

    attach(orbRef.current, true);
    attach(haloRef.current, false);
  }, [buffers]);

  useEffect(
    () => () => {
      orbGeometry.dispose();
      haloGeometry.dispose();
    },
    [orbGeometry, haloGeometry],
  );

  const matrix = useMemo(() => new THREE.Matrix4(), []);

  useFrame(({ clock, camera }, delta) => {
    const orbs = orbRef.current;
    const halos = haloRef.current;
    if (!orbs || !halos) return;

    const time = clock.elapsedTime;
    const step = Math.min(delta, 0.1);

    // Read state directly rather than subscribing: this runs every frame and
    // must never cause the component to re-render.
    const { hoveredTraineeId, focusedTraineeId, focusedTeamId, month, whatIf } =
      useWorldStore.getState();
    const hasSelection = focusedTraineeId !== null || focusedTeamId !== null;
    const collaboration = collaborationStrength(month, whatIf);

    // Ease toward whatever the current month and conditions call for. Nothing
    // is applied as a step: the world has to be seen changing, because the
    // transformation across the three months is the story.
    const ease = reducedMotion ? 1 : 1 - Math.exp(-step / ORBS.EMPHASIS_EASE);
    const slowEase = reducedMotion ? 1 : 1 - Math.exp(-step / 0.85);

    for (let i = 0; i < count; i++) {
      const trainee = trainees[i];
      const state = resolveTrainee(trainee, month, whatIf, MAX_SKILLS, MAX_CHALLENGES);
      const body = bodies[i];

      body.present = state.present;
      body.bonding = state.bonding;
      body.turbulence = state.present ? state.turbulence : 0;

      const attended =
        trainee.id === focusedTraineeId ||
        trainee.id === hoveredTraineeId ||
        (focusedTeamId !== null && teamOfTrainee.get(trainee.id)?.id === focusedTeamId);

      const emphasisTarget = attended
        ? ORBS.EMPHASIS_ATTENDED
        : hasSelection
          ? ORBS.EMPHASIS_RECEDED
          : ORBS.EMPHASIS_NEUTRAL;

      buffers.emphasisLevel[i] += (emphasisTarget - buffers.emphasisLevel[i]) * ease;
      buffers.complexityLevel[i] +=
        (state.complexity - buffers.complexityLevel[i]) * slowEase;
      buffers.turbulenceLevel[i] +=
        (state.turbulence - buffers.turbulenceLevel[i]) * slowEase;
      buffers.presenceLevel[i] +=
        ((state.present ? 1 : 0) - buffers.presenceLevel[i]) * slowEase;

      // Confidence sets the vessel's size. Where a person never reported it,
      // the orb rests at the baseline rather than being given a made-up value.
      const deviation =
        state.confidence == null ? 0 : (state.confidence - 3) / 2;
      const radiusTarget = ORBS.BASE_RADIUS + deviation * ORBS.RADIUS_VARIANCE;
      buffers.radiusLevel[i] += (radiusTarget - buffers.radiusLevel[i]) * slowEase;
    }

    if (!reducedMotion) stepGravity(bodies, step, collaboration, time);

    for (let i = 0; i < count; i++) {
      positions.get(trainees[i].id)?.copy(bodies[i].position);
      buffers.distances[i] = bodies[i].position.distanceToSquared(camera.position);
    }

    // Back to front: the glass uses normal blending and writes no depth, so
    // without an explicit order a far orb can paint straight over a near one.
    buffers.order.sort((a, b) => buffers.distances[b] - buffers.distances[a]);

    if (orbMaterialRef.current) {
      orbMaterialRef.current.uniforms.uTime.value = reducedMotion ? 4 : time;
    }

    for (let slot = 0; slot < count; slot++) {
      const index = buffers.order[slot];
      const body = bodies[index];

      const breath = reducedMotion
        ? 1
        : 1 + Math.sin(time * buffers.tempos[index] + seeds[index] * 6.283) * ORBS.BREATH;

      // An attended orb swells slightly: enough to confirm the pointer found
      // it, far short of lurching toward the viewer.
      const emphasis = buffers.emphasisLevel[index];
      const swell =
        1 +
        ORBS.ATTENDED_SWELL *
          Math.max(
            0,
            (emphasis - ORBS.EMPHASIS_NEUTRAL) /
              (ORBS.EMPHASIS_ATTENDED - ORBS.EMPHASIS_NEUTRAL),
          );
      const radius = buffers.radiusLevel[index] * breath * swell;

      matrix.makeScale(radius, radius, radius);
      matrix.setPosition(body.position);
      orbs.setMatrixAt(slot, matrix);

      const haloSize = radius * ORBS.HALO_SCALE;
      matrix.makeScale(haloSize, haloSize, haloSize);
      matrix.setPosition(body.position);
      halos.setMatrixAt(slot, matrix);

      // State follows the person into their slot.
      buffers.seeds[slot] = seeds[index];
      buffers.complexity[slot] = buffers.complexityLevel[index];
      buffers.tempos[slot] = buffers.tempos[index];
      buffers.emphasis[slot] = emphasis;
      buffers.turbulence[slot] = buffers.turbulenceLevel[index];
      buffers.presence[slot] = buffers.presenceLevel[index];
    }

    orbs.instanceMatrix.needsUpdate = true;
    halos.instanceMatrix.needsUpdate = true;

    // The render loop starts before the effect that attaches these, so the
    // first frames legitimately find them absent.
    for (const name of ['aComplexity', 'aEmphasis', 'aPresence']) {
      markUpdated(orbs, name);
      markUpdated(halos, name);
    }
    markUpdated(orbs, 'aSeed');
    markUpdated(orbs, 'aTempo');
    markUpdated(orbs, 'aTurbulence');
  });

  // Tempo is fixed per person; seeded once rather than recomputed each frame.
  useEffect(() => {
    for (let i = 0; i < count; i++) {
      buffers.tempos[i] =
        ((Math.PI * 2) / ORBS.BREATH_PERIOD) *
        (1 + (seeds[i] - 0.5) * ORBS.BREATH_SPREAD);
    }
  }, [buffers, seeds, count]);

  /**
   * Resolves a picked instance back to the person it represents.
   *
   * Instances are re-sorted by depth every frame, so `instanceId` identifies a
   * slot, not a trainee. Reading through the current order is what keeps the
   * pointer honest — without it, the reported identity would change as the
   * camera moved.
   */
  const traineeAt = useCallback(
    (instanceId: number | undefined): string | null => {
      if (instanceId === undefined) return null;
      const index = buffers.order[instanceId];
      if (index === undefined) return null;
      // A person removed by a counterfactual is a trace, not a target.
      if (buffers.presenceLevel[index] < 0.5) return null;
      return trainees[index].id;
    },
    [buffers],
  );

  const onPointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      event.stopPropagation();
      hoverTrainee(traineeAt(event.instanceId));
    },
    [hoverTrainee, traineeAt],
  );

  const onPointerOut = useCallback(() => hoverTrainee(null), [hoverTrainee]);

  const onClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      const id = traineeAt(event.instanceId);
      if (!id) return;
      // Clicking the selected orb again releases it, so the same gesture that
      // enters a person also leaves them.
      const current = useWorldStore.getState().focusedTraineeId;
      focusTrainee(current === id ? null : id);
    },
    [focusTrainee, traineeAt],
  );

  const orderedIds = useMemo(() => trainees.map((t) => t.id), []);
  useSelectionKeys(orderedIds);

  return (
    <group>
      <instancedMesh
        ref={haloRef}
        args={[haloGeometry, undefined, count]}
        renderOrder={RENDER_ORDER.ORB_HALOS}
        frustumCulled={false}
      >
        <shaderMaterial
          vertexShader={HALO_VERT}
          fragmentShader={HALO_FRAG}
          uniforms={haloUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>

      <SkillField positions={positions} />

      <instancedMesh
        ref={orbRef}
        args={[orbGeometry, undefined, count]}
        renderOrder={RENDER_ORDER.ORBS}
        frustumCulled={false}
        onPointerMove={onPointerMove}
        onPointerOut={onPointerOut}
        onClick={onClick}
      >
        {/*
          Normal blending, not additive. Additive can only ever brighten what is
          behind it, so an additive material cannot be dark-tinted glass — it
          would glow instead of absorbing, and the indigo body would never read.
        */}
        <shaderMaterial
          ref={orbMaterialRef}
          vertexShader={ORB_VERT}
          fragmentShader={ORB_FRAG}
          uniforms={orbUniforms}
          transparent
          depthWrite={false}
          blending={THREE.NormalBlending}
          toneMapped={false}
        />
      </instancedMesh>

      <TraineeLabel />
    </group>
  );
}
