import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { orbKey } from '../Trainees/orbKey';
import { challengesOf, CHALLENGE_RECORDS } from '../../data/challenges';
import { GROWTH_PER_CHALLENGE, baselineGrowth } from '../../data/growth';
import { PALETTE } from '../../config/palette';
import { MEDALLION, RENDER_ORDER } from '../../config/dimensions';
import { useWorldStore } from '../../store/useWorldStore';

/**
 * The line from each person into the core, and the energy running down it.
 *
 * Sixteen lines, one per person, each ending on the outermost shell rather than
 * at the centre — what a person hands over arrives at the surface of the
 * structure and is taken in from there. The lines are thin and stay thin: they
 * are the connective tissue of the composition and the moment they compete with
 * the people or the core, the picture stops being about either.
 *
 * The energy travelling them is what makes the order legible. A pulse leaves
 * its person, crosses to gold, and its colour changes as it passes each shell —
 * violet while it belongs to the person, then bronze, then silver, then gold —
 * so a single moving light states the whole sequence without a label. Several
 * are in flight at once on each line, staggered, so the flow reads as
 * continuous rather than as sixteen separate deliveries.
 *
 * How fast and how brightly a line runs is that person's own growth. Somebody
 * who has gained little has a line that is nearly dark, which is the honest
 * reading and the reason this is not merely decoration between the two things
 * it connects.
 */
export function DataFlows({
  positions,
}: {
  positions: Map<string, THREE.Vector3>;
}) {
  const reducedMotion = useWorldStore((state) => state.reducedMotion);
  const lineRef = useRef<THREE.LineSegments>(null);
  const pulseRef = useRef<THREE.Points>(null);

  const people = useMemo(
    () => [...new Set(CHALLENGE_RECORDS.map((record) => record.personId))],
    [],
  );

  const pulseCount = people.length * MEDALLION.PULSES;

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(people.length * 2 * 3), 3),
    );
    g.setAttribute(
      'color',
      new THREE.BufferAttribute(new Float32Array(people.length * 2 * 3), 3),
    );
    return g;
  }, [people.length]);

  const pulseGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(pulseCount * 3), 3),
    );
    g.setAttribute(
      'color',
      new THREE.BufferAttribute(new Float32Array(pulseCount * 3), 3),
    );
    return g;
  }, [pulseCount]);

  const lineMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );

  const pulseMaterial = useMemo(
    () =>
      new THREE.PointsMaterial({
        vertexColors: true,
        size: 0.13,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      pulseGeometry.dispose();
      lineMaterial.dispose();
      pulseMaterial.dispose();
    },
    [geometry, pulseGeometry, lineMaterial, pulseMaterial],
  );

  const tints = useMemo(
    () => ({
      person: new THREE.Color(PALETTE.ORB_GLOW ?? '#8f7fd8'),
      bronze: new THREE.Color(PALETTE.MEDALLION_BRONZE),
      silver: new THREE.Color(PALETTE.MEDALLION_SILVER),
      gold: new THREE.Color(PALETTE.MEDALLION_GOLD),
    }),
    [],
  );

  const scratch = useMemo(
    () => ({ from: new THREE.Vector3(), to: new THREE.Vector3(), at: new THREE.Vector3(), tint: new THREE.Color() }),
    [],
  );

  const level = useMemo(() => new Float32Array(people.length), [people.length]);

  /**
   * The colour a pulse carries at a given point along its journey.
   *
   * `t` is 0 at the person and 1 at the core's centre. The thresholds are the
   * shell radii expressed as a fraction of the whole journey, so the colour
   * genuinely changes as the pulse crosses each surface rather than at three
   * arbitrary points along the line.
   */
  const tintAt = (t: number, span: number, out: THREE.Color) => {
    const remaining = (1 - t) * span;
    if (remaining > MEDALLION.GOLD) out.copy(tints.person);
    else if (remaining > MEDALLION.SILVER) out.copy(tints.gold);
    else if (remaining > MEDALLION.BRONZE) out.copy(tints.silver);
    else out.copy(tints.bronze);
    return out;
  };

  useFrame(({ clock }, delta) => {
    const lines = lineRef.current;
    const pulses = pulseRef.current;
    if (!lines || !pulses) return;

    const time = reducedMotion ? 2 : clock.elapsedTime;
    const step = Math.min(delta, 0.1);
    const store = useWorldStore.getState();
    const live =
      store.enteredMonth === MEDALLION.MONTH && store.lens === 'challenges';
    const ease = reducedMotion ? 1 : 1 - Math.exp(-step / MEDALLION.EASE);

    const linePos = geometry.getAttribute('position') as THREE.BufferAttribute;
    const lineCol = geometry.getAttribute('color') as THREE.BufferAttribute;
    const pulsePos = pulseGeometry.getAttribute('position') as THREE.BufferAttribute;
    const pulseCol = pulseGeometry.getAttribute('color') as THREE.BufferAttribute;

    let brightest = 0;

    for (let i = 0; i < people.length; i++) {
      const personId = people[i];
      const centre = live ? positions.get(orbKey(MEDALLION.MONTH, personId)) : undefined;

      const done = challengesOf(personId).filter(
        (record) => store.challengeStatus[record.id] === 'overcome',
      ).length;
      const gained = centre
        ? Math.min(1, baselineGrowth(personId) + done * GROWTH_PER_CHALLENGE)
        : 0;
      level[i] += (gained - level[i]) * ease;
      brightest = Math.max(brightest, level[i]);

      if (!centre) {
        linePos.setXYZ(i * 2, 0, 0, 0);
        linePos.setXYZ(i * 2 + 1, 0, 0, 0);
        for (let p = 0; p < MEDALLION.PULSES; p++) {
          pulsePos.setXYZ(i * MEDALLION.PULSES + p, 0, 0, 0);
        }
        continue;
      }

      // From the person's surface to the outermost shell, not to the centre:
      // what they hand over arrives at the structure and is taken in there.
      scratch.from.copy(centre);
      const span = scratch.from.length();
      scratch.to.copy(centre).multiplyScalar(MEDALLION.GOLD / Math.max(span, 1e-4));

      linePos.setXYZ(i * 2, scratch.from.x, scratch.from.y, scratch.from.z);
      linePos.setXYZ(i * 2 + 1, scratch.to.x, scratch.to.y, scratch.to.z);
      // The line itself is faint and takes the person's colour at their end and
      // gold at the core's, so even at rest the direction of travel is clear.
      const dim = 0.25 + level[i] * 0.75;
      lineCol.setXYZ(i * 2, tints.person.r * dim, tints.person.g * dim, tints.person.b * dim);
      lineCol.setXYZ(i * 2 + 1, tints.gold.r * dim, tints.gold.g * dim, tints.gold.b * dim);

      for (let p = 0; p < MEDALLION.PULSES; p++) {
        const index = i * MEDALLION.PULSES + p;
        // Staggered along the line, and offset per person so the sixteen do not
        // pulse in unison — nothing in this world synchronises.
        const phase = (time / MEDALLION.FLOW + p / MEDALLION.PULSES + i * 0.137) % 1;
        scratch.at.copy(scratch.from).lerp(scratch.to, phase);
        pulsePos.setXYZ(index, scratch.at.x, scratch.at.y, scratch.at.z);

        tintAt(phase, span, scratch.tint);
        const bright = level[i] * (0.35 + 0.65 * Math.sin(phase * Math.PI));
        pulseCol.setXYZ(
          index,
          scratch.tint.r * bright,
          scratch.tint.g * bright,
          scratch.tint.b * bright,
        );
      }
    }

    linePos.needsUpdate = true;
    lineCol.needsUpdate = true;
    pulsePos.needsUpdate = true;
    pulseCol.needsUpdate = true;
    geometry.computeBoundingSphere();
    pulseGeometry.computeBoundingSphere();

    const presence = live ? 1 : 0;
    lineMaterial.opacity += (presence * 0.5 - lineMaterial.opacity) * ease;
    pulseMaterial.opacity += (presence - pulseMaterial.opacity) * ease;
    lines.visible = lineMaterial.opacity > 0.01;
    pulses.visible = pulseMaterial.opacity > 0.01 && brightest > 0.01;
  });

  return (
    <group renderOrder={RENDER_ORDER.CONNECTIONS}>
      <lineSegments
        ref={lineRef}
        geometry={geometry}
        material={lineMaterial}
        frustumCulled={false}
        raycast={() => null}
      />
      <points
        ref={pulseRef}
        geometry={pulseGeometry}
        material={pulseMaterial}
        frustumCulled={false}
        raycast={() => null}
      />
    </group>
  );
}
