import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ATMOSPHERE_FRAG, ATMOSPHERE_VERT } from '../../shaders/atmosphere.glsl';
import { PALETTE } from '../../config/palette';
import { ATMOSPHERE, RENDER_ORDER } from '../../config/dimensions';
import { useWorldStore } from '../../store/useWorldStore';

/**
 * The graded void the structure sits inside.
 *
 * Rendered as a back-side sphere rather than a scene background so it can carry
 * a gradient and a dither. Flat black would read as an absence of a background;
 * a few percent of graded lift reads as space that continues past the frame.
 */
export function Atmosphere() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const reducedMotion = useWorldStore((state) => state.reducedMotion);

  const uniforms = useMemo(
    () => ({
      uBase: { value: new THREE.Color(PALETTE.BG) },
      // The faintest indigo lift, so the void belongs to the same world as the
      // glass suspended in it. Kept to a few percent — the environment must
      // stay near-black and let the orbs be the only real source of colour.
      uLift: { value: new THREE.Color(PALETTE.ORB_GLASS).multiplyScalar(0.16) },
      uTime: { value: 0 },
    }),
    [],
  );

  useFrame(({ clock }) => {
    if (reducedMotion || !materialRef.current) return;
    materialRef.current.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <mesh renderOrder={RENDER_ORDER.ATMOSPHERE} frustumCulled={false}>
      <sphereGeometry args={[ATMOSPHERE.RADIUS, 32, 24]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={ATMOSPHERE_VERT}
        fragmentShader={ATMOSPHERE_FRAG}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
        toneMapped={false}
      />
    </mesh>
  );
}
