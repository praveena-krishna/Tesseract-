import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import { GLOW_FRAG, GLOW_VERT } from '../../shaders/glow.glsl';
import { PALETTE } from '../../config/palette';
import { CORE, RENDER_ORDER } from '../../config/dimensions';
import { useWorldStore } from '../../store/useWorldStore';

/**
 * The luminous volume suspended at the centre of the structure.
 *
 * Three camera-facing layers at different scales stand in for a volumetric
 * integral: because they are separate objects at the same origin, orbiting the
 * structure produces genuine parallax between them and the core reads as having
 * depth rather than being a flat sprite. Additive blending with depth writes
 * disabled keeps them order-independent.
 */
export function CoreVolume() {
  const groupRef = useRef<THREE.Group>(null);
  const reducedMotion = useWorldStore((state) => state.reducedMotion);

  const materials = useMemo(
    () =>
      CORE.LAYERS.map(
        (layer) =>
          new THREE.ShaderMaterial({
            vertexShader: GLOW_VERT,
            fragmentShader: GLOW_FRAG,
            uniforms: {
              uColor: { value: new THREE.Color(PALETTE.CORE_HAZE) },
              uOpacity: { value: layer.opacity },
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
      ),
    [],
  );

  useFrame(({ clock, camera }) => {
    // Fade out as the camera closes on the centre.
    //
    // These layers are several units across and additively blended, so a camera
    // that comes near the origin ends up inside them and the whole frame washes
    // to white. The core is atmosphere for the structure seen from outside; up
    // close there is nothing it can usefully contribute, so it withdraws.
    // The largest layer is eleven units across, so it subtends more than the
    // whole frame from anywhere inside the structure. It has to be fully gone
    // by the time the camera comes in to observe a person, not merely dimmed —
    // at half strength it still washes out everything behind it.
    const proximity = camera.position.length();
    const visibility = THREE.MathUtils.smoothstep(proximity, 10, 20);

    CORE.LAYERS.forEach((layer, i) => {
      materials[i].uniforms.uOpacity.value = layer.opacity * visibility;
    });

    if (reducedMotion || !groupRef.current) return;
    // A slow, shallow swell — the core is the calmest element in the scene and
    // should never draw attention away from the structure around it.
    const breath = Math.sin(clock.elapsedTime * 0.18) * 0.04 + 1;
    groupRef.current.scale.setScalar(breath);
  });

  return (
    <group ref={groupRef} renderOrder={RENDER_ORDER.CORE}>
      {CORE.LAYERS.map((layer, i) => (
        <Billboard key={layer.scale}>
          <mesh material={materials[i]} scale={layer.scale}>
            <planeGeometry args={[1, 1]} />
          </mesh>
        </Billboard>
      ))}
    </group>
  );
}
