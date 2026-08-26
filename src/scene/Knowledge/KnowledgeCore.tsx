import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { CORE_FRAG, CORE_VERT } from '../../shaders/knowledgeCore.glsl';
import { PALETTE } from '../../config/palette';
import { MEDALLION, RENDER_ORDER } from '../../config/dimensions';
import { challengesOf, CHALLENGE_RECORDS } from '../../data/challenges';
import { GROWTH_PER_CHALLENGE, baselineGrowth } from '../../data/growth';
import { useWorldStore } from '../../store/useWorldStore';

/** The three layers, innermost first — the order data moves through them. */
const LAYERS = [
  {
    id: 'bronze',
    radius: MEDALLION.BRONZE,
    colour: PALETTE.MEDALLION_BRONZE,
    label: 'Bronze',
    meridians: 14,
    parallels: 8,
    bearing: Math.PI * 0.72,
  },
  {
    id: 'silver',
    radius: MEDALLION.SILVER,
    colour: PALETTE.MEDALLION_SILVER,
    label: 'Silver',
    meridians: 20,
    parallels: 11,
    bearing: Math.PI * 0.5,
  },
  {
    id: 'gold',
    radius: MEDALLION.GOLD,
    colour: PALETTE.MEDALLION_GOLD,
    label: 'Gold',
    meridians: 26,
    parallels: 14,
    bearing: Math.PI * 0.28,
  },
] as const;

/**
 * The knowledge core: raw learning worked through into mastery.
 *
 * Three concentric shells standing at the centre of the third month, with the
 * sixteen people around them. The order is the argument — nothing reaches the
 * outermost layer without having crossed the two inside it — so they are nested
 * rather than placed side by side, and each is a lattice with real gaps so the
 * two behind it can be seen through it. Three filled spheres would be one ball.
 *
 * Deliberately not a wormhole, a portal or a vortex. Each of those has an axis
 * and a direction of travel; this has neither. There is no opening in any
 * shell, nothing rotates about a privileged axis, and the energy passing
 * through travels outward through the latitudes rather than around them. What
 * it is meant to read as is a physical object with layers, seen from outside.
 *
 * How brightly it runs is what the sixteen have actually gained, so the core is
 * not decoration standing in the middle of the month — it is the same reading
 * the orbs are giving, gathered into one place.
 */
export function KnowledgeCore() {
  const groupRef = useRef<THREE.Group>(null);
  const reducedMotion = useWorldStore((state) => state.reducedMotion);

  const people = useMemo(
    () => [...new Set(CHALLENGE_RECORDS.map((record) => record.personId))],
    [],
  );

  const geometries = useMemo(
    () => LAYERS.map((layer) => new THREE.SphereGeometry(layer.radius, 64, 48)),
    [],
  );

  const materials = useMemo(
    () =>
      LAYERS.map(
        (layer) =>
          new THREE.ShaderMaterial({
            vertexShader: CORE_VERT,
            fragmentShader: CORE_FRAG,
            uniforms: {
              uTime: { value: 0 },
              uTint: { value: new THREE.Color(layer.colour) },
              uPresence: { value: 0 },
              uFlow: { value: 0 },
              uMeridians: { value: layer.meridians },
              uParallels: { value: layer.parallels },
            },
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
          }),
      ),
    [],
  );

  useEffect(
    () => () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
    [geometries, materials],
  );

  const state = useRef({ presence: 0, flow: 0 });

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    if (!group) return;

    const time = reducedMotion ? 4 : clock.elapsedTime;
    const step = Math.min(delta, 0.1);
    const store = useWorldStore.getState();
    const live =
      store.enteredMonth === MEDALLION.MONTH && store.lens === 'challenges';

    const ease = reducedMotion ? 1 : 1 - Math.exp(-step / MEDALLION.EASE);
    state.current.presence += ((live ? 1 : 0) - state.current.presence) * ease;

    // What is running through the structure is what the sixteen have gained.
    let gained = 0;
    if (live) {
      for (const personId of people) {
        const done = challengesOf(personId).filter(
          (record) => store.challengeStatus[record.id] === 'overcome',
        ).length;
        gained += Math.min(1, baselineGrowth(personId) + done * GROWTH_PER_CHALLENGE);
      }
      gained /= Math.max(1, people.length);
    }
    state.current.flow += (gained - state.current.flow) * ease;

    group.visible = state.current.presence > 0.01;
    if (!group.visible) return;

    // Slowly, and about a tilted axis so no single one is privileged. A
    // structure spinning about its vertical would start to read as a vortex.
    if (!reducedMotion) {
      group.rotation.y = time * MEDALLION.DRIFT;
      group.rotation.x = Math.sin(time * MEDALLION.DRIFT * 0.6) * 0.12;
    }

    for (let i = 0; i < materials.length; i++) {
      const material = materials[i];
      material.uniforms.uTime.value = time;
      material.uniforms.uPresence.value = state.current.presence;
      // The outer layers only run as brightly as what has reached them, so a
      // month that has not gone well shows a lit bronze and a faint gold.
      const reach = [1, 0.75, 0.55][i];
      material.uniforms.uFlow.value = state.current.flow * reach;
    }
  });

  return (
    <group ref={groupRef} renderOrder={RENDER_ORDER.PROJECTS}>
      {LAYERS.map((layer, i) => (
        <mesh
          key={layer.id}
          geometry={geometries[i]}
          material={materials[i]}
          frustumCulled={false}
          raycast={() => null}
        />
      ))}

      {/*
        Fanned rather than stacked. All three anchored on one axis projected to
        within a few pixels of each other at this camera distance and read as a
        single smear; setting each on its own bearing round its own shell keeps
        them apart on screen at any framing, and keeps each one next to the
        surface it names.
      */}
      {LAYERS.map((layer) => (
        <group
          key={`${layer.id}-label`}
          position={[
            Math.cos(layer.bearing) * layer.radius,
            Math.sin(layer.bearing) * layer.radius,
            0,
          ]}
        >
          <Html center transform={false} zIndexRange={[9, 0]} pointerEvents="none">
            {/*
              The name and nothing else. A line of description under each shell
              ran into its neighbour at this distance, and the three metals are
              already the whole of what the layers are called.
            */}
            <div className="medallion-label" data-layer={layer.id}>
              <p className="medallion-label__name">{layer.label}</p>
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}
