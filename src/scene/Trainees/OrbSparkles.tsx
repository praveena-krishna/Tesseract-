import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { SPARKLE_FRAG, SPARKLE_VERT } from '../../shaders/sparkle.glsl';
import { orbKey } from './orbKey';
import { trainees } from '../../data/world';
import { PALETTE } from '../../config/palette';
import {
  CHALLENGES,
  DIMENSION,
  GROWTH,
  MEDALLION,
  RENDER_ORDER,
  SHELLS,
} from '../../config/dimensions';
import { ORBS } from '../../config/orbs';
import { useWorldStore } from '../../store/useWorldStore';

/**
 * Light caught around a person who has come away with something.
 *
 * A glow says a vessel is bright; sparkles say it is *alive*. The difference
 * matters here because what the light stands for is knowledge gained, and
 * knowledge is not a level — it is a thing a person keeps catching. So these
 * turn slowly around whoever earned them, each on its own rate and its own
 * phase, and each is mostly dark with brief catches rather than a steady point.
 *
 * How many a person has and how brightly they catch is what that person has
 * gained, so somebody who came away with little has a few faint motes and
 * somebody who came away with a great deal is surrounded. Nobody has none:
 * every one of the sixteen finished the training.
 *
 * One draw call for all of them. The positions are solved on the CPU because
 * they follow live orb centres that only this side knows, but everything about
 * how a sparkle *looks* is per-point in the shader.
 */
export function OrbSparkles({
  positions,
}: {
  positions: Map<string, THREE.Vector3>;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const reducedMotion = useWorldStore((state) => state.reducedMotion);

  const per = GROWTH.SPARKLES_PER_PERSON;
  const count = trainees.length * per;

  const layout = useMemo(() => {
    const dirs: THREE.Vector3[] = [];
    const axes: THREE.Vector3[] = [];
    const radii: number[] = [];
    const spark = new Float32Array(count * 4);

    for (let p = 0; p < trainees.length; p++) {
      for (let i = 0; i < per; i++) {
        const n = p * per + i;
        // Spread over the sphere by the golden angle so a person is ringed in
        // every direction rather than banded round their equator.
        const golden = Math.PI * (3 - Math.sqrt(5));
        const y = 1 - (2 * (i + 0.5)) / per;
        const band = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = golden * i + p * 1.7;
        dirs.push(
          new THREE.Vector3(Math.cos(theta) * band, y, Math.sin(theta) * band).normalize(),
        );
        axes.push(
          new THREE.Vector3(
            Math.sin(n * 1.3),
            Math.cos(n * 0.7),
            Math.sin(n * 2.1),
          ).normalize(),
        );
        radii.push(GROWTH.SPARKLE_NEAR + ((n * 37) % 13) / 13 * (GROWTH.SPARKLE_FAR - GROWTH.SPARKLE_NEAR));

        spark[n * 4] = 1.1 + ((n * 17) % 23) / 23 * 2.2;
        spark[n * 4 + 1] = ((n * 0.6180339887) % 1);
        spark[n * 4 + 2] = 0;
        spark[n * 4 + 3] = 0;
      }
    }
    return { dirs, axes, radii, spark };
  }, [count, per]);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(count * 3), 3),
    );
    g.setAttribute('aSpark', new THREE.BufferAttribute(layout.spark, 4));
    return g;
  }, [count, layout]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SPARKLE_VERT,
        fragmentShader: SPARKLE_FRAG,
        uniforms: {
          uTime: { value: 0 },
          uTwinkling: { value: 0 },
          uSteady: { value: GROWTH.SPARKLE_STEADY },
          uSize: { value: GROWTH.SPARKLE_SIZE },
          uColor: { value: new THREE.Color(PALETTE.KNOWLEDGE) },
          uCore: { value: new THREE.Color('#ffffff') },
          uOpacity: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const orbRadius = useMemo(() => {
    const baseHalf = SHELLS[DIMENSION.SHELL_OF_MONTH[0]].half;
    const half = SHELLS[DIMENSION.SHELL_OF_MONTH[CHALLENGES.MONTH]].half;
    return ORBS.BASE_RADIUS * (half / baseHalf);
  }, []);

  const scratch = useMemo(
    () => ({ spin: new THREE.Quaternion(), at: new THREE.Vector3() }),
    [],
  );
  const lit = useMemo(() => new Float32Array(trainees.length), []);

  useFrame((_, delta) => {
    const points = pointsRef.current;
    if (!points) return;

    // Held, not running.
    //
    // These motes exist under one lens only — the one about knowledge — and
    // that is the lens where a person's brightness has to read as a fixed
    // quantity. Orbiting motes are motion sitting directly on the vessel they
    // decorate, which is exactly where stillness was asked for. A constant
    // leaves them scattered where their own seeds put them, so the field keeps
    // its spread and loses its movement.
    const time = 3;
    const step = Math.min(delta, 0.1);
    const store = useWorldStore.getState();
    // The sparkles belong to the lens about knowledge, not the one about
    // difficulty. Under challenges the subject is what somebody ran into and
    // the glass in their vessel is what says it — a shower of gold around them
    // reads as celebration standing on top of the very thing it is obscuring.
    const live =
      store.enteredMonth === CHALLENGES.MONTH && store.lens === 'databricks';
    const ease = reducedMotion ? 1 : 1 - Math.exp(-step / GROWTH.EASE);

    const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
    const spark = geometry.getAttribute('aSpark') as THREE.BufferAttribute;

    let brightest = 0;

    for (let p = 0; p < trainees.length; p++) {
      const personId = trainees[p].id;
      const centre = live
        ? positions.get(orbKey(CHALLENGES.MONTH, personId))
        : undefined;

      // The same for everybody: the motes say a person is lit, not how much.
      const gained = centre ? MEDALLION.EQUAL_GLOW : 0;
      lit[p] += (gained - lit[p]) * ease;
      brightest = Math.max(brightest, lit[p]);

      for (let i = 0; i < per; i++) {
        const n = p * per + i;
        if (!centre || lit[p] < 0.01) {
          pos.setXYZ(n, 0, 0, 0);
          spark.setW(n, 0);
          spark.setZ(n, 0);
          continue;
        }

        // Turning slowly about its own axis, so the field around a person is
        // never still and never marching in step.
        scratch.spin.setFromAxisAngle(
          layout.axes[n],
          reducedMotion ? 0 : time * GROWTH.SPARKLE_DRIFT * (1 + (n % 5) * 0.18),
        );
        scratch.at.copy(layout.dirs[n]).applyQuaternion(scratch.spin);
        scratch.at.multiplyScalar(orbRadius * layout.radii[n]).add(centre);
        pos.setXYZ(n, scratch.at.x, scratch.at.y, scratch.at.z);

        // How lit this person is. A sparkle further out needs more to catch,
        // so the ring tightens on somebody who gained less.
        const reach = 1 - (layout.radii[n] - GROWTH.SPARKLE_NEAR) /
          Math.max(0.001, GROWTH.SPARKLE_FAR - GROWTH.SPARKLE_NEAR);
        spark.setZ(n, Math.max(0, lit[p] * (0.35 + reach * 0.65)));
      }
    }

    pos.needsUpdate = true;
    spark.needsUpdate = true;
    geometry.computeBoundingSphere();

    material.uniforms.uTime.value = time;
    // The motes hold one brightness each rather than catching the light in
    // turn. Sharpened as the twinkle is, a field of them flickers, and this
    // lens is the one where a person's glow has to be read as a steady
    // quantity — light that comes and goes says the quantity is changing.
    material.uniforms.uTwinkling.value = 0;
    material.uniforms.uOpacity.value = GROWTH.SPARKLE_OPACITY;
    points.visible = brightest > 0.01;
  });

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={RENDER_ORDER.ORB_HALOS}
      raycast={() => null}
    />
  );
}
