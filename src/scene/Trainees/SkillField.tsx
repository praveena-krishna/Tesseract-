import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { MAX_CHALLENGES, MAX_SKILLS, teamOfTrainee, trainees } from '../../data/world';
import { resolveTrainee } from '../../sim/whatIf';
import { PALETTE } from '../../config/palette';
import { ORBS } from '../../config/orbs';
import { RENDER_ORDER } from '../../config/dimensions';
import { useWorldStore } from '../../store/useWorldStore';

const SKILL_VERT = /* glsl */ `
  attribute float aPresence;
  attribute float aEmphasis;
  varying float vPresence;
  varying float vEmphasis;

  void main() {
    vPresence = aPresence;
    vEmphasis = aEmphasis;
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const SKILL_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying float vPresence;
  varying float vEmphasis;

  void main() {
    if (vPresence < 0.01) discard;
    // Held well below full brightness. These are additive and have no falloff,
    // so at close range a cluster of them is a very intense source; driving
    // them harder pushes the bloom's coarsest mip and washes the whole frame.
    gl_FragColor = vec4(uColor * (0.28 + vEmphasis * 0.42), vPresence * 0.62);
  }
`;

interface SkillNode {
  traineeIndex: number;
  skillId: string;
  /** Fixed direction within the orb, so a skill keeps its place. */
  direction: THREE.Vector3;
  radius: number;
  spin: number;
  phase: number;
}

interface SkillFieldProps {
  positions: Map<string, THREE.Vector3>;
}

/**
 * Skills, as structures suspended inside the vessels that hold them.
 *
 * A person's knowledge is not written on their orb or listed beside it — it is
 * physically inside it, a constellation of small bright nodes orbiting within
 * the glass. The count is what that person had actually learned by the current
 * month, taken from the dates in the daily logs, so the interiors visibly fill
 * in as the training progresses.
 *
 * Every node across all sixteen people is one instanced draw call. Each keeps a
 * fixed direction within its orb, so a given skill occupies the same place in
 * the same person every time it appears rather than reshuffling on each frame.
 */
export function SkillField({ positions }: SkillFieldProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const reducedMotion = useWorldStore((state) => state.reducedMotion);

  const nodes = useMemo<SkillNode[]>(() => {
    const result: SkillNode[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));

    trainees.forEach((trainee, traineeIndex) => {
      const total = trainee.skillIds.length;
      trainee.skillIds.forEach((skillId, i) => {
        // A golden-angle spiral spreads the nodes evenly over the interior
        // shell however many there are, so a person with sixteen skills is
        // dense and evenly filled rather than clumped.
        const y = total === 1 ? 0 : 1 - (2 * (i + 0.5)) / total;
        const ring = Math.sqrt(Math.max(0, 1 - y * y));
        const theta = golden * i;

        result.push({
          traineeIndex,
          skillId,
          direction: new THREE.Vector3(
            Math.cos(theta) * ring,
            y,
            Math.sin(theta) * ring,
          ).normalize(),
          radius: 0.45 + ((i * 37) % 100) / 100 * 0.5,
          spin: 0.18 + ((i * 53) % 100) / 100 * 0.22,
          phase: ((i * 91) % 100) / 100 * Math.PI * 2,
        });
      });
    });

    return result;
  }, []);

  const geometry = useMemo(
    // One subdivision, not zero: a twenty-faced solid reads as a chipped rock
    // once the camera is inside a vessel, and these are meant to be smooth
    // points of knowledge. Eighty faces across a hundred-odd nodes is nothing.
    () => new THREE.IcosahedronGeometry(ORBS.SKILL_SIZE, 1),
    [],
  );

  const uniforms = useMemo(
    () => ({ uColor: { value: new THREE.Color(PALETTE.SKILL_NODE) } }),
    [],
  );

  const buffers = useMemo(
    () => ({
      presence: new Float32Array(nodes.length),
      emphasis: new Float32Array(nodes.length),
      /** Eased 0–1 arrival of each node as its skill is acquired. */
      level: new Float32Array(nodes.length),
    }),
    [nodes.length],
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.geometry.setAttribute(
      'aPresence',
      new THREE.InstancedBufferAttribute(buffers.presence, 1),
    );
    mesh.geometry.setAttribute(
      'aEmphasis',
      new THREE.InstancedBufferAttribute(buffers.emphasis, 1),
    );
  }, [buffers]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const offset = useMemo(() => new THREE.Vector3(), []);
  const axis = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);

  useFrame(({ clock }, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const time = clock.elapsedTime;
    const step = Math.min(delta, 0.1);
    const ease = reducedMotion ? 1 : 1 - Math.exp(-step / ORBS.SKILL_EMERGE);

    const { month, whatIf, focusedTraineeId, hoveredTraineeId, focusedTeamId } =
      useWorldStore.getState();

    // Resolve each person once per frame rather than once per node.
    const states = trainees.map((trainee) =>
      resolveTrainee(trainee, month, whatIf, MAX_SKILLS, MAX_CHALLENGES),
    );
    const active = states.map((state) => new Set(state.skillIds));
    const attended = trainees.map(
      (trainee) =>
        trainee.id === focusedTraineeId ||
        trainee.id === hoveredTraineeId ||
        (focusedTeamId !== null &&
          teamOfTrainee.get(trainee.id)?.id === focusedTeamId),
    );

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const state = states[node.traineeIndex];
      const trainee = trainees[node.traineeIndex];

      const held = state.present && active[node.traineeIndex].has(node.skillId);
      buffers.level[i] += ((held ? 1 : 0) - buffers.level[i]) * ease;
      buffers.presence[i] = buffers.level[i];
      buffers.emphasis[i] = attended[node.traineeIndex] ? 1 : 0.25;

      const centre = positions.get(trainee.id);
      if (!centre) continue;

      // Slow rotation about the orb's own axis, so the interior turns gently
      // rather than sitting rigid inside a moving vessel.
      const angle = reducedMotion ? node.phase : node.phase + time * node.spin;
      quaternion.setFromAxisAngle(axis, angle);
      offset.copy(node.direction).applyQuaternion(quaternion);

      // Difficulty pushes the structures around inside the vessel.
      const scatter = 1 + state.turbulence * 0.25 * Math.sin(time * 3 + node.phase);

      offset.multiplyScalar(
        ORBS.BASE_RADIUS * ORBS.SKILL_ORBIT * node.radius * scatter,
      );
      offset.add(centre);

      // Nodes shrink to nothing as they retract, so a skill that was never
      // taught under a counterfactual disappears rather than blinking out.
      const scale = Math.max(0.001, buffers.level[i]);
      matrix.makeScale(scale, scale, scale);
      matrix.setPosition(offset);
      mesh.setMatrixAt(i, matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    const presence = mesh.geometry.getAttribute('aPresence');
    const emphasis = mesh.geometry.getAttribute('aEmphasis');
    if (presence) presence.needsUpdate = true;
    if (emphasis) emphasis.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, nodes.length]}
      renderOrder={RENDER_ORDER.SKILLS}
      frustumCulled={false}
    >
      <shaderMaterial
        vertexShader={SKILL_VERT}
        fragmentShader={SKILL_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </instancedMesh>
  );
}
