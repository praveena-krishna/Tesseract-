import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { EDGES, buildUnitNode, buildUnitStrut } from './frameGeometry';
import { hyperCorners } from './hyperRotation';
import { hyperAngle } from '../../sim/hyperTurn';
import { applyFrameMaterial } from '../../shaders/frameFresnel';
import type { PatchedMaterial } from '../../shaders/frameFresnel';
import { PALETTE } from '../../config/palette';
import { DIMENSION, RENDER_ORDER, SHELLS } from '../../config/dimensions';
import type { ShellSpec } from '../../config/dimensions';
import { transitionSurge } from '../../sim/dimensionalTransition';
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
 * The shells are also the three months, so a shell can be the thing the pointer
 * is reaching for. When it is, it does not light up the way a control would —
 * it draws more energy through its members and its joints come up, which is the
 * response of a physical thing being approached rather than a surface being
 * hovered. During the passage every shell surges briefly, so the structure
 * reacts to being travelled through instead of standing by while the camera
 * moves.
 *
 * The shell breathes on its own period. Nothing here touches React state — the
 * pulse drives a shader uniform and an emissive scalar directly, which keeps
 * the render loop free of reconciliation.
 */
export function Shell({ spec, index }: ShellProps) {
  const strutMaterialRef = useRef<PatchedMaterial | null>(null);
  const reducedMotion = useWorldStore((state) => state.reducedMotion);

  /** Which month this shell stands for, if any is wired to it yet. */
  const month = DIMENSION.SHELL_OF_MONTH.indexOf(index);

  /**
   * Eased 0–1 states, so the shell never switches between them.
   *
   * `attention` is the pointer reaching for it from outside; `occupied` is the
   * viewer being inside it; `dormant` is a different layer being the subject;
   * `withdrawn` is this layer sitting *inside* the one being occupied, and so
   * standing in the way of it.
   */
  const attention = useRef(0);
  const occupied = useRef(0);
  const dormant = useRef(0);
  const withdrawn = useRef(0);
  const groupRef = useRef<THREE.Group>(null);

  // One member and one joint, placed at draw time rather than baked in. The
  // corners move whenever the structure is turning through the fourth
  // dimension, so their positions cannot live in the vertices.
  const strutGeometry = useMemo(() => buildUnitStrut(spec.strut), [spec.strut]);
  const nodeGeometry = useMemo(() => buildUnitNode(spec.node), [spec.node]);

  const strutsRef = useRef<THREE.InstancedMesh>(null);
  const nodesRef = useRef<THREE.InstancedMesh>(null);

  /** Live corners, and the scratch a frame's worth of placement needs. */
  const frame = useMemo(
    () => ({
      corners: [] as THREE.Vector3[],
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      scale: new THREE.Vector3(),
      axis: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      lastAngle: Number.NaN,
    }),
    [],
  );

  /** Resting rim strength. Hover and the passage add to it at runtime. */
  const baseFresnel = 0.14 * spec.intensity;

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
    // The hover and passage responses ride the same uniform on top of this.
    return applyFrameMaterial(material, baseFresnel);
  }, [baseFresnel]);

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

  useFrame(({ clock }, delta) => {
    const period = TIMINGS.PULSE_PERIODS[index] ?? TIMINGS.PULSE_PERIODS[0];
    const phase = TIMINGS.PULSE_PHASES[index] ?? 0;

    // Reduced motion holds the shell at the midpoint of its breath rather than
    // freezing it dark, so the structure keeps its intended luminance.
    const wave = reducedMotion
      ? 0.5
      : Math.sin((clock.elapsedTime / period) * Math.PI * 2 + phase) * 0.5 + 0.5;

    const { hoveredMonth, enteredMonth } = useWorldStore.getState();
    // A shell is only reaching for the pointer while the viewer is outside it.
    // Once they are within, the pointer is choosing between the people in
    // there, and the boundary lighting up underneath them would be answering a
    // question nobody asked.
    const reaching = enteredMonth === null && month >= 0 && hoveredMonth === month;
    const inside = month >= 0 && enteredMonth === month;
    const elsewhere = enteredMonth !== null && enteredMonth !== month;
    // Smaller than the layer being occupied, and therefore inside it.
    const inTheWay =
      enteredMonth !== null &&
      spec.half < SHELLS[DIMENSION.SHELL_OF_MONTH[enteredMonth]].half - 1e-6;

    const step = Math.min(delta, 0.1);
    const ease = reducedMotion ? 1 : 1 - Math.exp(-step / DIMENSION.HOVER_EASE);
    attention.current += ((reaching ? 1 : 0) - attention.current) * ease;
    occupied.current += ((inside ? 1 : 0) - occupied.current) * ease;
    dormant.current += ((elsewhere ? 1 : 0) - dormant.current) * ease;
    withdrawn.current += ((inTheWay ? 1 : 0) - withdrawn.current) * ease;

    if (groupRef.current) {
      groupRef.current.scale.setScalar(
        1 - withdrawn.current * (1 - DIMENSION.RECEDED_SCALE),
      );
    }

    // Never to nothing: the other two months did not stop having happened, and
    // they are what tells the viewer where in the structure they are standing.
    const presence = 1 - dormant.current * (1 - DIMENSION.DORMANT);

    // The whole structure charges as it is passed through, not just the layer
    // being entered — the tesseract is one object and this is happening to it.
    const surge = transitionSurge();

    const fresnel =
      TIMINGS.FRESNEL_MIN + (TIMINGS.FRESNEL_MAX - TIMINGS.FRESNEL_MIN) * wave;
    const uniforms = strutMaterialRef.current?.userData.fresnel;
    if (uniforms) {
      uniforms.uPulse.value = fresnel;
      uniforms.uFresnelIntensity.value =
        (baseFresnel +
          attention.current * DIMENSION.HOVER_FRESNEL +
          occupied.current * DIMENSION.ENTERED_FRESNEL +
          surge * DIMENSION.HOVER_FRESNEL * 0.7) *
        presence;
    }

    // Place the members from the current corners. Skipped entirely while the
    // angle has not moved, which is every frame outside a month change — the
    // structure is static at rest and should cost nothing to leave that way.
    const angle = hyperAngle();
    const struts = strutsRef.current;
    const nodes = nodesRef.current;
    if (struts && nodes && angle !== frame.lastAngle) {
      frame.lastAngle = angle;
      hyperCorners(spec.half, index, angle, frame.corners);

      for (let i = 0; i < EDGES.length; i++) {
        const [a, b] = EDGES[i];
        const start = frame.corners[a];
        const end = frame.corners[b];

        frame.position.addVectors(start, end).multiplyScalar(0.5);
        frame.axis.subVectors(end, start);
        const span = frame.axis.length();
        frame.axis.divideScalar(Math.max(span, 1e-6));
        frame.quaternion.setFromUnitVectors(frame.up, frame.axis);
        // Inset by the joint size so members meet the corner blocks cleanly
        // instead of running through them, exactly as the baked version did.
        frame.scale.set(1, Math.max(0.001, span - spec.node), 1);

        frame.matrix.compose(frame.position, frame.quaternion, frame.scale);
        struts.setMatrixAt(i, frame.matrix);
      }
      struts.instanceMatrix.needsUpdate = true;

      for (let i = 0; i < frame.corners.length; i++) {
        frame.matrix.identity().setPosition(frame.corners[i]);
        nodes.setMatrixAt(i, frame.matrix);
      }
      nodes.instanceMatrix.needsUpdate = true;

      struts.computeBoundingSphere();
      nodes.computeBoundingSphere();
    }

    nodeMaterial.emissiveIntensity =
      ((TIMINGS.NODE_EMISSIVE_MIN +
        (TIMINGS.NODE_EMISSIVE_MAX - TIMINGS.NODE_EMISSIVE_MIN) * wave) *
        spec.intensity +
        attention.current * DIMENSION.HOVER_NODE_EMISSIVE +
        occupied.current * DIMENSION.ENTERED_NODE_EMISSIVE +
        surge * DIMENSION.HOVER_NODE_EMISSIVE * 0.8) *
      presence;
  });

  return (
    <group ref={groupRef} renderOrder={RENDER_ORDER.FRAMES}>
      <instancedMesh
        ref={strutsRef}
        args={[strutGeometry, strutMaterial, EDGES.length]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={nodesRef}
        args={[nodeGeometry, nodeMaterial, 8]}
        frustumCulled={false}
      />
    </group>
  );
}
