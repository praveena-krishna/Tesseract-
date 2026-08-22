import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { cubeVertices } from './frameGeometry';
import { PALETTE } from '../../config/palette';
import { CONNECTIONS, RENDER_ORDER, SHELL_FADE, SHELLS } from '../../config/dimensions';
import { TIMINGS } from '../../config/timings';
import { useWorldStore } from '../../store/useWorldStore';

interface LinkPair {
  outer: THREE.Vector3;
  inner: THREE.Vector3;
}

/** Corresponding vertices of two nested cubes, paired by index. */
function pairVertices(outerHalf: number, innerHalf: number): LinkPair[] {
  const outer = cubeVertices(outerHalf);
  const inner = cubeVertices(innerHalf);
  return outer.map((vertex, i) => ({ outer: vertex, inner: inner[i] }));
}

/** How far the faded end of a link is dimmed relative to its bright end. */
const FADE_FLOOR = 0.12;

/**
 * The dimensional links between corresponding vertices of the nested shells.
 *
 * This is the actual four-dimensional metaphor: in a hypercube projection the
 * inner cube is not sitting inside the outer one, it is displaced along an axis
 * we cannot see, and these edges are that displacement made visible. Each fades
 * from the inner shell outward, so the eye reads a direction — inward, toward
 * the core — rather than a symmetrical cage.
 *
 * All sixteen links are one LineSegments object. Fat lines would cost a draw
 * call each and buy nothing here, since every link is a single pixel wide;
 * per-vertex colour carries both the gradient and the per-tier intensity, which
 * is why one material can serve links of two different strengths.
 */
export function Connections() {
  const reducedMotion = useWorldStore((state) => state.reducedMotion);
  const signalRef = useRef<THREE.Points>(null);
  const linkRef = useRef<THREE.LineSegments>(null);

  const primary = useMemo(() => pairVertices(SHELLS[0].half, SHELLS[1].half), []);
  const secondary = useMemo(() => pairVertices(SHELLS[1].half, SHELLS[2].half), []);

  const linkGeometry = useMemo(() => {
    const tiers = [
      { pairs: primary, strength: CONNECTIONS.OPACITY_PRIMARY },
      { pairs: secondary, strength: CONNECTIONS.OPACITY_SECONDARY },
    ];

    const segments = tiers.reduce((total, tier) => total + tier.pairs.length, 0);
    const positions = new Float32Array(segments * 2 * 3);
    const colors = new Float32Array(segments * 2 * 3);
    const base = new THREE.Color(PALETTE.CONNECTION);

    let cursor = 0;
    for (const { pairs, strength } of tiers) {
      const bright = base.clone().multiplyScalar(strength);
      const faded = base.clone().multiplyScalar(strength * FADE_FLOOR);

      for (const pair of pairs) {
        positions.set([pair.outer.x, pair.outer.y, pair.outer.z], cursor * 3);
        colors.set([faded.r, faded.g, faded.b], cursor * 3);
        cursor += 1;

        positions.set([pair.inner.x, pair.inner.y, pair.inner.z], cursor * 3);
        colors.set([bright.r, bright.g, bright.b], cursor * 3);
        cursor += 1;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geometry;
  }, [primary, secondary]);

  /**
   * The authored gradient, kept untouched.
   *
   * The proximity fade multiplies the colour buffer every frame, so it has to
   * scale a pristine copy — scaling the live buffer would compound frame on
   * frame and the links would fade to nothing and never come back.
   */
  const baseColors = useMemo(() => {
    const source = linkGeometry.getAttribute('color') as THREE.BufferAttribute;
    return Array.from({ length: source.count }, (_, i) =>
      new THREE.Color(source.getX(i), source.getY(i), source.getZ(i)),
    );
  }, [linkGeometry]);

  const vertexPoint = useMemo(() => new THREE.Vector3(), []);

  const signalGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(CONNECTIONS.SIGNAL_COUNT * 3), 3),
    );
    return geometry;
  }, []);

  useEffect(
    () => () => {
      linkGeometry.dispose();
      signalGeometry.dispose();
    },
    [linkGeometry, signalGeometry],
  );

  useFrame(({ clock, camera }) => {
    // The dimensional links dissolve on approach like the members do. A link
    // passing through the lens would otherwise be a bright wire across the
    // whole frame at exactly the moment the camera is trying to look past it.
    const linkGeo = linkRef.current?.geometry;
    const linkColors = linkGeo?.getAttribute('color') as THREE.BufferAttribute | undefined;
    const linkPositions = linkGeo?.getAttribute('position') as
      | THREE.BufferAttribute
      | undefined;

    if (linkColors && linkPositions) {
      for (let i = 0; i < linkColors.count; i++) {
        const presence = THREE.MathUtils.smoothstep(
          vertexPoint.fromBufferAttribute(linkPositions, i).distanceTo(camera.position),
          SHELL_FADE.GONE,
          SHELL_FADE.SOLID,
        );
        const base = baseColors[i];
        linkColors.setXYZ(i, base.r * presence, base.g * presence, base.b * presence);
      }
      linkColors.needsUpdate = true;
    }

    const points = signalRef.current;
    if (!points) return;

    const positions = points.geometry.getAttribute('position') as THREE.BufferAttribute;
    const time = reducedMotion ? 0 : clock.elapsedTime;

    for (let i = 0; i < CONNECTIONS.SIGNAL_COUNT; i++) {
      const pair = primary[i];
      // Stagger each signal across the loop so they never travel as one wave.
      const offset = i / CONNECTIONS.SIGNAL_COUNT;
      const t = (((time / TIMINGS.SIGNAL_PERIOD + offset) % 1) + 1) % 1;
      const eased = t * t * (3 - 2 * t);

      positions.setXYZ(
        i,
        THREE.MathUtils.lerp(pair.outer.x, pair.inner.x, eased),
        THREE.MathUtils.lerp(pair.outer.y, pair.inner.y, eased),
        THREE.MathUtils.lerp(pair.outer.z, pair.inner.z, eased),
      );
    }

    positions.needsUpdate = true;
  });

  return (
    <group renderOrder={RENDER_ORDER.CONNECTIONS}>
      <lineSegments ref={linkRef} geometry={linkGeometry} frustumCulled={false}>
        <lineBasicMaterial
          vertexColors
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </lineSegments>

      <points ref={signalRef} geometry={signalGeometry} frustumCulled={false}>
        <pointsMaterial
          size={CONNECTIONS.SIGNAL_SIZE}
          color={PALETTE.NODE}
          transparent
          opacity={0.85}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
