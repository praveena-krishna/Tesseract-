import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { PARTICLES_FRAG, PARTICLES_VERT } from '../../shaders/particles.glsl';
import { PALETTE } from '../../config/palette';
import { PARTICLES, RENDER_ORDER } from '../../config/dimensions';
import { TIMINGS } from '../../config/timings';
import { useWorldStore } from '../../store/useWorldStore';

/**
 * Deterministic pseudo-random source.
 *
 * Seeded rather than Math.random so the field is identical on every load —
 * a composition that shuffles between refreshes cannot be art-directed.
 */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * The environmental particulate suspended around the structure.
 *
 * Positions occupy a spherical shell that begins outside the outer frame, so
 * the particles establish the volume the tesseract hangs in without ever
 * cluttering its interior. Drift is computed entirely in the vertex shader,
 * making this one draw call with no per-frame CPU cost.
 */
export function Particles() {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const reducedMotion = useWorldStore((state) => state.reducedMotion);
  const dpr = useThree((state) => state.viewport.dpr);

  const geometry = useMemo(() => {
    const random = seeded(0x7e55e);
    const count = PARTICLES.COUNT;

    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const opacities = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Cube-root of a uniform variate gives uniform density through the shell
      // volume; sampling the radius linearly would crowd everything inward.
      const t = random();
      const radius =
        PARTICLES.RADIUS_INNER +
        (PARTICLES.RADIUS_OUTER - PARTICLES.RADIUS_INNER) * Math.cbrt(t);

      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      seeds[i * 3] = random();
      seeds[i * 3 + 1] = random();
      seeds[i * 3 + 2] = random();

      scales[i] = 0.4 + random() * 0.8;
      opacities[i] =
        PARTICLES.OPACITY_MIN +
        random() * (PARTICLES.OPACITY_MAX - PARTICLES.OPACITY_MIN);
    }

    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    buffer.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
    buffer.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    buffer.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));
    return buffer;
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: PARTICLES.SIZE },
      uDrift: { value: PARTICLES.DRIFT },
      uMaxSize: { value: PARTICLES.SIZE_MAX_PX },
      uPixelRatio: { value: 1 },
      uColor: { value: new THREE.Color(PALETTE.PARTICLE) },
    }),
    [],
  );

  useEffect(() => {
    uniforms.uPixelRatio.value = dpr;
  }, [dpr, uniforms]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }, delta) => {
    const material = materialRef.current;
    if (material) {
      const speed = reducedMotion ? TIMINGS.REDUCED_MOTION_FACTOR : 1;
      material.uniforms.uTime.value = clock.elapsedTime * speed;
    }
    if (pointsRef.current && !reducedMotion) {
      pointsRef.current.rotation.y +=
        TIMINGS.PARTICLE_ROTATION * Math.min(delta, 0.1);
    }
  });

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      renderOrder={RENDER_ORDER.PARTICLES}
      frustumCulled={false}
    >
      <shaderMaterial
        ref={materialRef}
        vertexShader={PARTICLES_VERT}
        fragmentShader={PARTICLES_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
