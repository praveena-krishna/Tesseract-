import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { SHARD_FRAG, SHARD_VERT } from '../../shaders/shard.glsl';
import { buildShard } from './shardGeometry';
import { orbKey } from './orbKey';
import {
  CHALLENGE_RECORDS,
  SEVERITY_SCALE,
  TYPE_COLOUR,
  TYPE_CUT,
} from '../../data/challenges';
import type { ChallengeRecord } from '../../data/challenges';
import { PALETTE } from '../../config/palette';
import { CHALLENGES, DIMENSION, RENDER_ORDER, SHELLS } from '../../config/dimensions';
import { ORBS } from '../../config/orbs';
import { useWorldStore } from '../../store/useWorldStore';

/** The axis the hull is drawn out along, and so the axis a fragment enters on. */
const LONG_AXIS = new THREE.Vector3(1, 0, 0);

/**
 * How a fragment lies once it has struck.
 *
 * Its long axis is laid along the line it came in on, so the piece points back
 * the way it arrived and reads as driven in rather than as debris that happened
 * to settle there. A roll about that line and a few degrees of deflection stop
 * the set of them looking like spokes on a wheel — nothing that hits glass ends
 * up perfectly square to it.
 */
function entryAttitude(direction: THREE.Vector3, index: number): THREE.Quaternion {
  const along = new THREE.Quaternion().setFromUnitVectors(LONG_AXIS, direction);
  const roll = new THREE.Quaternion().setFromAxisAngle(direction, index * 1.7);
  const deflect = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      Math.sin(index * 2.1) * 0.34,
      Math.cos(index * 1.3) * 0.34,
      0,
    ),
  );
  return along.multiply(roll).multiply(deflect);
}

/** One difficulty, and the piece of glass it left inside its person. */
interface Shard extends ChallengeRecord {
  /** The orb it is caught in. Every fragment belongs to one person, only. */
  orb: string;
  /** Fixed direction from that orb's centre, so it never wanders. */
  direction: THREE.Vector3;
  /** How far along that line it rests, as a fraction of the orb's radius. */
  depth: number;
  /** Its own fixed attitude, so no two lie the same way. */
  tilt: THREE.Quaternion;
  scale: number;
}

/**
 * What each person found hard, as broken glass caught inside them.
 *
 * The metaphor is meant to be legible without a word of explanation: the person
 * is the crystal, a difficulty is a fragment of glass stuck in it, and the more
 * of them there are and the larger they run, the harder the months were. So
 * **size is severity** and **count is load**, and nothing else is allowed to
 * touch either.
 *
 * Everything about how these are drawn serves "inside", not "beside". Each
 * fragment is placed on a line out from its own orb's centre at a depth under
 * one radius, so it is enclosed by the vessel rather than ringed around it, and
 * the depths differ per kind so some sit buried while others break the surface.
 * They are laid down before the vessels are, so the violet glass composites over
 * them and they are genuinely seen *through* the person. They do not spin,
 * because something embedded does not turn independently of what it is embedded
 * in. And they are never picked: the person is what the viewer reaches for.
 *
 * The tint is taken out of the light rather than added to it, which is the
 * whole difference between coloured glass and a coloured lamp.
 */
export function ChallengeShards({
  positions,
}: {
  positions: Map<string, THREE.Vector3>;
}) {
  const reducedMotion = useWorldStore((state) => state.reducedMotion);
  const groupRef = useRef<THREE.Group>(null);

  const shards = useMemo<Shard[]>(() => {
    const seen = new Map<string, number>();
    return CHALLENGE_RECORDS.map((record, index) => {
      const ordinal = seen.get(record.personId) ?? 0;
      seen.set(record.personId, ordinal + 1);

      // Spread through the volume by the golden angle, so a person carrying
      // three has them at three unrelated angles rather than in a row.
      const golden = Math.PI * (3 - Math.sqrt(5));
      const y = 1 - (2 * (ordinal + 0.5)) / 4;
      const band = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * ordinal + index * 1.13;

      const cut = TYPE_CUT[record.type];
      // Where along that line the fragment's centre rests. Near one radius is
      // straddling the shell — half of it driven in, half still standing out —
      // which is what having struck the crystal looks like. Varied per record
      // so some are buried to the hilt and others have barely gone in.
      const depth = cut.depth + (((index * 37) % 11) / 11 - 0.5) * 0.18;

      return {
        ...record,
        orb: orbKey(CHALLENGES.MONTH, record.personId),
        direction: new THREE.Vector3(
          Math.cos(theta) * band,
          y,
          Math.sin(theta) * band,
        ).normalize(),
        depth,
        tilt: entryAttitude(
          new THREE.Vector3(
            Math.cos(theta) * band,
            y,
            Math.sin(theta) * band,
          ).normalize(),
          index,
        ),
        scale: SEVERITY_SCALE[record.severity],
      };
    });
  }, []);

  /** One material, cloned per fragment so each carries its own tint and state. */
  const base = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SHARD_VERT,
        fragmentShader: SHARD_FRAG,
        uniforms: {
          uTime: { value: 0 },
          uLightDir: { value: new THREE.Vector3(6, 8, 4).normalize() },
          uAmbient: { value: new THREE.Color(PALETTE.ORB_RIM ?? '#dbe4ee') },
          uTint: { value: new THREE.Color('#ffffff') },
          uCharge: { value: 1 },
          uAttention: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );

  const pieces = useMemo(
    () =>
      shards.map((shard, index) => {
        const geometry = buildShard(index + 1, TYPE_CUT[shard.type].points);
        const material = base.clone();
        material.uniforms.uTint.value = new THREE.Color(TYPE_COLOUR[shard.type]);
        return { shard, geometry, material };
      }),
    [shards, base],
  );

  useEffect(
    () => () => {
      base.dispose();
      pieces.forEach(({ geometry, material }) => {
        geometry.dispose();
        material.dispose();
      });
    },
    [base, pieces],
  );

  /**
   * The radius of an orb in the layer these belong to.
   *
   * Not the base radius. Every layer scales its people by how big its box is,
   * and the third month is the outermost — four times the first. Sizing the
   * glass off the unscaled radius put every fragment at an eighth of its
   * intended size, huddled at the dead centre of an orb four times wider than
   * the cluster, which is to say invisible.
   */
  const orbRadius = useMemo(() => {
    const baseHalf = SHELLS[DIMENSION.SHELL_OF_MONTH[0]].half;
    const half = SHELLS[DIMENSION.SHELL_OF_MONTH[CHALLENGES.MONTH]].half;
    return ORBS.BASE_RADIUS * (half / baseHalf);
  }, []);

  const charge = useMemo(() => new Float32Array(pieces.length).fill(1), [pieces.length]);
  const attention = useMemo(() => new Float32Array(pieces.length), [pieces.length]);
  const scratch = useMemo(() => ({ screen: new THREE.Vector3() }), []);

  useFrame(({ clock, camera, size: canvas }, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const time = reducedMotion ? 3 : clock.elapsedTime;
    const step = Math.min(delta, 0.1);
    const store = useWorldStore.getState();
    const live =
      store.enteredMonth === CHALLENGES.MONTH && store.lens === 'challenges';
    const ease = reducedMotion ? 1 : 1 - Math.exp(-step / CHALLENGES.RESOLVE_EASE);

    group.visible = live;

    for (let i = 0; i < pieces.length; i++) {
      const { shard, material } = pieces[i];
      const child = group.children[i] as THREE.Mesh | undefined;
      if (!child) continue;

      const centre = live ? positions.get(shard.orb) : undefined;
      // A fragment stays until it is worked through. In progress it is still
      // in there; only being overcome takes it out.
      const overcome = store.challengeStatus[shard.id] === 'overcome';

      const chargeTo = centre && !overcome ? 1 : 0;
      charge[i] += (chargeTo - charge[i]) * ease;
      const attendedTo = centre && store.focusedTraineeId === shard.personId ? 1 : 0;
      attention[i] += (attendedTo - attention[i]) * ease;

      material.uniforms.uTime.value = time;
      material.uniforms.uCharge.value = charge[i];
      material.uniforms.uAttention.value = attention[i];

      if (!centre || charge[i] < 0.02) {
        child.visible = false;
        continue;
      }
      child.visible = true;

      const radius = orbRadius;
      child.position
        .copy(centre)
        .addScaledVector(shard.direction, radius * shard.depth);
      child.quaternion.copy(shard.tilt);
      const size = radius * CHALLENGES.LENGTH * shard.scale;
      child.scale.setScalar(size);

      if (import.meta.env.DEV) {
        const probe = ((window as unknown as Record<string, unknown>).__challenges ??=
          {}) as Record<string, unknown>;
        scratch.screen.copy(child.position).project(camera);
        probe[shard.id] = {
          person: shard.personId,
          type: shard.type,
          severity: shard.severity,
          tint: TYPE_COLOUR[shard.type],
          size: +size.toFixed(4),
          // Under one radius is buried in the vessel; over one has broken out.
          depth: +shard.depth.toFixed(2),
          reach: +(shard.depth + CHALLENGES.LENGTH * shard.scale * 1.35).toFixed(2),
          charge: +charge[i].toFixed(2),
          x: Math.round(((scratch.screen.x + 1) / 2) * canvas.width),
          y: Math.round(((1 - scratch.screen.y) / 2) * canvas.height),
        };
      }
    }
  });

  return (
    <group ref={groupRef} renderOrder={RENDER_ORDER.CHALLENGES}>
      {pieces.map(({ shard, geometry, material }) => (
        <mesh
          key={shard.id}
          geometry={geometry}
          material={material}
          frustumCulled={false}
          // Never a target of its own: the person is what is clicked, and the
          // glass is what is seen inside them.
          raycast={() => null}
        />
      ))}
    </group>
  );
}
