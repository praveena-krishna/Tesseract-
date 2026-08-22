import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { buildNodeGeometry, buildStrutGeometry } from './frameGeometry';
import { applyFrameMaterial } from '../../shaders/frameFresnel';
import type { PatchedMaterial } from '../../shaders/frameFresnel';
import { PALETTE } from '../../config/palette';
import { RENDER_ORDER } from '../../config/dimensions';
import type { ShellSpec } from '../../config/dimensions';
import { TIMINGS } from '../../config/timings';
import { useWorldStore } from '../../store/useWorldStore';

interface ShellProps {
  spec: ShellSpec;
  /** Index into the pulse period and phase tables. */
  index: number;
}

/**
 * One cube of the nested structure: twelve bevelled struts plus eight corner
 * nodes, each merged to a single draw call.
 *
 * The shell breathes on its own period. Nothing here touches React state — the
 * pulse drives a shader uniform and an emissive scalar directly, which keeps
 * the render loop free of reconciliation.
 */
export function Shell({ spec, index }: ShellProps) {
  const strutMaterialRef = useRef<PatchedMaterial | null>(null);
  const reducedMotion = useWorldStore((state) => state.reducedMotion);

  const strutGeometry = useMemo(
    () => buildStrutGeometry(spec.half, spec.strut, spec.node),
    [spec.half, spec.strut, spec.node],
  );
  const nodeGeometry = useMemo(
    () => buildNodeGeometry(spec.half, spec.node),
    [spec.half, spec.node],
  );

  const strutMaterial = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE.FRAME_BASE),
      metalness: 0.85,
      // Slightly rough: a mirror finish would reflect only the three
      // lightformers and read as black between them, while this spreads the
      // highlight into a band that travels the bevel as the camera moves.
      roughness: 0.34,
      envMapIntensity: 1.6,
      emissive: new THREE.Color(PALETTE.FRAME_EMISSIVE),
      emissiveIntensity: 0.03 * spec.intensity,
    });
    // A rim, not a fill. Once the metal itself is lit, the fresnel only has to
    // define the silhouette; any more and it flattens the material back out.
    return applyFrameMaterial(material, 0.14 * spec.intensity);
  }, [spec.intensity]);

  /**
   * The corner joints get the same dissolve as the struts they join.
   *
   * Without it they would be left hanging in the air as the members around them
   * cleared, which reads as a bug rather than as the structure making way.
   */
  const nodeMaterial = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE.FRAME_BASE),
      metalness: 0.75,
      roughness: 0.4,
      envMapIntensity: 1.3,
      emissive: new THREE.Color(PALETTE.NODE),
      emissiveIntensity: TIMINGS.NODE_EMISSIVE_MIN * spec.intensity,
    });
    return applyFrameMaterial(material, 0);
  }, [spec.intensity]);

  useEffect(() => {
    strutMaterialRef.current = strutMaterial;
    return () => {
      strutGeometry.dispose();
      nodeGeometry.dispose();
      strutMaterial.dispose();
      nodeMaterial.dispose();
    };
  }, [strutGeometry, nodeGeometry, strutMaterial, nodeMaterial]);

  useFrame(({ clock }) => {
    const period = TIMINGS.PULSE_PERIODS[index] ?? TIMINGS.PULSE_PERIODS[0];
    const phase = TIMINGS.PULSE_PHASES[index] ?? 0;

    // Reduced motion holds the shell at the midpoint of its breath rather than
    // freezing it dark, so the structure keeps its intended luminance.
    const wave = reducedMotion
      ? 0.5
      : Math.sin((clock.elapsedTime / period) * Math.PI * 2 + phase) * 0.5 + 0.5;

    const fresnel =
      TIMINGS.FRESNEL_MIN + (TIMINGS.FRESNEL_MAX - TIMINGS.FRESNEL_MIN) * wave;
    const uniforms = strutMaterialRef.current?.userData.fresnel;
    if (uniforms) uniforms.uPulse.value = fresnel;

    nodeMaterial.emissiveIntensity =
      (TIMINGS.NODE_EMISSIVE_MIN +
        (TIMINGS.NODE_EMISSIVE_MAX - TIMINGS.NODE_EMISSIVE_MIN) * wave) *
      spec.intensity;
  });

  return (
    <group renderOrder={RENDER_ORDER.FRAMES}>
      <mesh geometry={strutGeometry} material={strutMaterial} />
      <mesh geometry={nodeGeometry} material={nodeMaterial} />
    </group>
  );
}
