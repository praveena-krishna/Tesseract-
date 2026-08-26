import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { HALO_FRAG, HALO_VERT, ORB_FRAG, ORB_VERT } from '../../shaders/orb.glsl';
import { computeOrbPositions } from './orbLayout';
import { orbKey } from './orbKey';
import { TraineeLabel } from './TraineeLabel';
import { LearningField } from './LearningField';
import { SessionLabel } from './SessionLabel';
import { useSelectionKeys } from '../../interaction/useSelectionKeys';
import {
  MAX_CHALLENGES,
  MAX_SKILLS,
  teamOfTrainee,
  trainees,
} from '../../data/world';
import { resolveTrainee } from '../../sim/whatIf';
import { transitionDepth } from '../../sim/dimensionalTransition';
import type { GravityBody } from '../../sim/gravity';
import { buildTeamFormations, stepGravity } from '../../sim/gravity';
import { PALETTE } from '../../config/palette';
import { ORBS } from '../../config/orbs';
import { DIMENSION, RENDER_ORDER, SHELLS } from '../../config/dimensions';
import { useWorldStore } from '../../store/useWorldStore';

/**
 * Which layers hold people. Month 3 is not wired yet.
 */
const LIVE_MONTHS = [0, 1] as const;

/**
 * How hard each month's teams pull.
 *
 * Month 1 is zero, and that is the whole of its story: sixteen individuals,
 * nothing drawing them together, each resting where the layout put them. Month
 * 2 turns it on, and the movement that follows is the only thing saying who
 * belongs with whom — no lines are drawn, because a line asserts a relationship
 * while being pulled across a room demonstrates one.
 */
const COLLABORATION_BY_MONTH = [0, 1] as const;

/**
 * Seconds the sixteen stand apart, untouched, after the camera has landed.
 *
 * A deliberate pause with nothing happening in it. Ramping the pull from the
 * moment of arrival meant the people were already drifting together by the time
 * the viewer could focus on them, so the starting state — sixteen separate
 * individuals — was never actually seen, and the transformation had no
 * "before". The hold is what gives it one.
 */
const GRAVITY_HOLD = 2.5;

/**
 * Seconds the pull then takes to come up.
 *
 * Slow on purpose: the whole claim of this month is that people were drawn
 * together, and a snap would show the result without the drawing.
 */
const GRAVITY_RAMP = 4;

/**
 * Radius the team centres sit at, as a fraction of the layer's half size.
 *
 * Pushed outward so the five formations settle well clear of one another. At a
 * tighter radius the teams gather correctly and still read as one central mass,
 * because the gaps between them are smaller than the teams themselves — the
 * structure is there in the numbers and invisible on screen.
 */
/**
 * The half-size the team zones were laid out against.
 *
 * They are authored as real positions inside a box this size, so a layer of any
 * other size scales them rather than re-deriving them — which keeps the
 * arrangement identical between months instead of drifting with the geometry.
 */
const TEAM_ZONE_REFERENCE_HALF = 2.5;

/**
 * How far from its project a member settles, as a fraction of the layer's half
 * size. Wide enough to leave the figure in clear space, tight enough that the
 * five teams still keep real distance between them.
 */
const TEAM_STANDOFF_FRACTION = 0.168;

/**
 * How much wider than the shared layout each month starts.
 *
 * Month 1 is the layout as approved and must not move. Month 2 pushes further
 * out into its box before gravity takes hold: the transformation is the whole
 * point of that month, and it reads in proportion to how far the people
 * actually travel. Bounded by the box — the outermost person plus their own
 * radius has to stay inside it.
 */
const START_SPREAD_BY_MONTH = [1, 1.08] as const;

/**
 * The arrival of the sixteen, after the passage has landed.
 *
 * They do not appear all at once. A population that pops into being reads as a
 * layer being switched on; one that resolves across a beat reads as the
 * dimension having been there all along and the eye only now being able to
 * make it out.
 */
const REVEAL_DURATION = 1.5;
/** Fraction of the reveal spent staggering between first person and last. */
const REVEAL_STAGGER = 0.55;
/**
 * How far through the passage the people begin to resolve.
 *
 * Late, on purpose: they belong to the inside, and starting them while the
 * camera is still crossing would give away that there is an inside before the
 * viewer has arrived in it.
 */
const REVEAL_GATE = 0.55;

/** Stable per-person seed, derived from the identifier rather than the index. */
function seedFor(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

/** Flags an instanced attribute for upload, tolerating one not yet attached. */
function markUpdated(mesh: THREE.InstancedMesh, name: string): void {
  const attribute = mesh.geometry.getAttribute(name);
  if (attribute) attribute.needsUpdate = true;
}

/**
 * The sixteen people.
 *
 * Each orb is one instance of a single icosphere whose position is solved by
 * the gravity simulation, not animated. What it looks like at any moment is
 * read from the world model: how much the person had learned by the current
 * month, what they were struggling with, how strongly they were bound to their
 * team, and whether the counterfactual conditions include them at all.
 *
 * Variation between people is deliberately narrow — a shared palette, a shared
 * form, differences of complexity, tempo and scale — so the field reads as one
 * population of peers rather than sixteen unrelated objects.
 */
export function TraineeField() {
  const orbRef = useRef<THREE.InstancedMesh>(null);
  const haloRef = useRef<THREE.InstancedMesh>(null);
  const orbMaterialRef = useRef<THREE.ShaderMaterial>(null);

  const reducedMotion = useWorldStore((state) => state.reducedMotion);
  const setTraineePositions = useWorldStore((state) => state.setTraineePositions);
  const hoverTrainee = useWorldStore((state) => state.hoverTrainee);
  const focusTrainee = useWorldStore((state) => state.focusTrainee);

  const people = trainees.length;
  const count = people * LIVE_MONTHS.length;

  /**
   * One simulation per layer, over the same sixteen people in the same resting
   * places, scaled to that layer's box.
   *
   * The homes are shared deliberately. A person keeps their spot from one month
   * to the next, so anything that changes between the layers is the
   * relationship rather than the arrangement — which is exactly the claim Month
   * 2 makes.
   */
  const cells = useMemo(() => {
    const layout = computeOrbPositions(people);
    const baseHalf = SHELLS[DIMENSION.SHELL_OF_MONTH[0]].half;

    return LIVE_MONTHS.map((month) => {
      const half = SHELLS[DIMENSION.SHELL_OF_MONTH[month]].half;
      const scale = half / baseHalf;

      return {
        month,
        scale,
        radius: ORBS.BASE_RADIUS * scale,
        formations: buildTeamFormations(
          half / TEAM_ZONE_REFERENCE_HALF,
          half * TEAM_STANDOFF_FRACTION,
        ),
        bodies: trainees.map<GravityBody>((trainee, i) => {
          const home = layout[i]
            .clone()
            .multiplyScalar(scale * (START_SPREAD_BY_MONTH[month] ?? 1));
          return {
            id: trainee.id,
            home,
            position: home.clone(),
            velocity: new THREE.Vector3(),
            teamId: teamOfTrainee.get(trainee.id)?.id ?? null,
            present: true,
            bonding: 0,
            turbulence: 0,
          };
        }),
      };
    });
  }, [people]);

  const seeds = useMemo(() => trainees.map((t) => seedFor(t.id)), []);

  const orbGeometry = useMemo(
    () => new THREE.IcosahedronGeometry(1, ORBS.DETAIL),
    [],
  );
  const haloGeometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  const orbUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uGlass: { value: new THREE.Color(PALETTE.ORB_GLASS) },
      uGlow: { value: new THREE.Color(PALETTE.ORB_GLOW) },
      uRim: { value: new THREE.Color(PALETTE.ORB_RIM) },
      uDispersion: { value: new THREE.Color(PALETTE.ORB_DISPERSION) },
      uSpecular: { value: new THREE.Color(PALETTE.ORB_SPECULAR) },
      // Matches the scene's key light, so glints sit where the lighting rig
      // says they should rather than floating independently of the world.
      uLightDir: { value: new THREE.Vector3(6, 8, 4).normalize() },
      uIor: { value: 1.45 },
      uFracture: { value: new THREE.Color(PALETTE.ORB_FRACTURE) },
      uOpacity: { value: 1 },
    }),
    [],
  );

  const haloUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(PALETTE.ORB_HALO) },
      uOpacity: { value: ORBS.HALO_OPACITY },
    }),
    [],
  );

  /**
   * Per-instance state, rewritten every frame.
   *
   * Instances are re-sorted by depth for correct blending, so an orb's
   * attributes have to travel with it into whichever slot it lands in —
   * otherwise sorting would silently swap the people around.
   */
  const buffers = useMemo(
    () => ({
      complexity: new Float32Array(count),
      /** Eased per-person arrival, indexed by trainee. */
      revealLevel: new Float32Array(count),
      tempos: new Float32Array(count),
      emphasis: new Float32Array(count),
      presence: new Float32Array(count).fill(1),
      seeds: new Float32Array(count),
      cracksLevel: new Float32Array(count),
      turbulence: new Float32Array(count),
      cracks: new Float32Array(count),
      // One entry per orb across every layer, not per person. Sized from the
      // people alone this silently indexed off the end for half the field, and
      // an undefined slot resolves to no layer at all.
      order: Array.from({ length: count }, (_, i) => i),
      distances: new Float32Array(count),
      /** Eased per-person values, indexed by trainee rather than by slot. */
      emphasisLevel: new Float32Array(count).fill(ORBS.EMPHASIS_NEUTRAL),
      complexityLevel: new Float32Array(count),
      turbulenceLevel: new Float32Array(count),
      presenceLevel: new Float32Array(count).fill(1),
      radiusLevel: new Float32Array(count).fill(ORBS.BASE_RADIUS),
    }),
    [count],
  );

  /**
   * Live orb positions, published for the camera, labels, connections and
   * project formations to read. The same map is mutated in place every frame
   * rather than replaced, so nothing re-renders.
   */
  const positions = useMemo(
    () =>
      new Map(
        LIVE_MONTHS.flatMap((month) =>
          trainees.map(
            (trainee) => [orbKey(month, trainee.id), new THREE.Vector3()] as const,
          ),
        ),
      ),
    [],
  );

  useEffect(() => {
    setTraineePositions(positions);
    return () => setTraineePositions(null);
  }, [positions, setTraineePositions]);

  useEffect(() => {
    const attach = (mesh: THREE.InstancedMesh | null, full: boolean) => {
      if (!mesh) return;
      const set = (name: string, array: Float32Array) =>
        mesh.geometry.setAttribute(
          name,
          new THREE.InstancedBufferAttribute(array, 1),
        );

      set('aComplexity', buffers.complexity);
      set('aEmphasis', buffers.emphasis);
      set('aPresence', buffers.presence);
      if (full) {
        set('aCracks', buffers.cracks);
        set('aSeed', buffers.seeds);
        set('aTempo', buffers.tempos);
        set('aTurbulence', buffers.turbulence);
      }
    };

    attach(orbRef.current, true);
    attach(haloRef.current, false);
  }, [buffers]);

  useEffect(
    () => () => {
      orbGeometry.dispose();
      haloGeometry.dispose();
    },
    [orbGeometry, haloGeometry],
  );

  const matrix = useMemo(() => new THREE.Matrix4(), []);
  /** 0-1 progress of each layer's population arriving, indexed by month. */
  const revealClock = useRef(LIVE_MONTHS.map(() => 0));
  /** 0-1 how far each layer's team gravity has come up, indexed by month. */
  const gravityRamp = useRef(LIVE_MONTHS.map(() => 0));
  /** Seconds each layer has been stood in, before its gravity is released. */
  const gravityHold = useRef(LIVE_MONTHS.map(() => 0));

  useFrame(({ clock, camera }, delta) => {
    const orbs = orbRef.current;
    const halos = haloRef.current;
    if (!orbs || !halos) return;

    const time = clock.elapsedTime;
    const step = Math.min(delta, 0.1);

    // Read state directly rather than subscribing: this runs every frame and
    // must never cause the component to re-render.
    const {
      hoveredTraineeId,
      focusedTraineeId,
      focusedTeamId,
      enteredMonth,
      whatIf,
      lens,
    } = useWorldStore.getState();
    const hasSelection = focusedTraineeId !== null || focusedTeamId !== null;


    const ease = reducedMotion ? 1 : 1 - Math.exp(-step / ORBS.EMPHASIS_EASE);
    const slowEase = reducedMotion ? 1 : 1 - Math.exp(-step / 0.85);
    const settled = transitionDepth() > 0.92;

    for (const cell of cells) {
      const live = enteredMonth === cell.month;

      // The people belong to the inside of a layer. Outside — or in a layer
      // nobody has entered — they are not merely dimmed but absent, so that
      // entering is a genuine revelation rather than a brightening of something
      // already on screen, and so leaving one month for another does not leave
      // the first competing with the second.
      const gate = live && transitionDepth() > REVEAL_GATE ? 1 : -1;
      revealClock.current[cell.month] = THREE.MathUtils.clamp(
        revealClock.current[cell.month] + (gate * step) / REVEAL_DURATION,
        0,
        1,
      );
      const revealProgress = reducedMotion
        ? gate > 0
          ? 1
          : 0
        : revealClock.current[cell.month];

      // Team gravity comes up only after the camera has landed, and over
      // several seconds. The viewer has to see the sixteen scattered before
      // anything pulls them, or the formation is something that was already
      // true when they arrived rather than something they watched happen.
      // Nothing organises itself. Entering a month shows the sixteen people and
      // stops there; the teams form when the viewer asks to see teams, and the
      // projects appear when they ask to see projects. A world that runs its
      // whole story unprompted leaves the controls with nothing to control, and
      // the viewer watching rather than looking.
      const gravityWanted = lens === 'teams' || lens === 'projects';
      const collaborationTarget = gravityWanted
        ? (COLLABORATION_BY_MONTH[cell.month] ?? 0)
        : 0;

      // Nothing moves until the hold has elapsed, so the viewer sees sixteen
      // separate people before anything starts pulling them together.
      gravityHold.current[cell.month] = THREE.MathUtils.clamp(
        gravityHold.current[cell.month] + (live && settled ? step : -step * 3),
        0,
        GRAVITY_HOLD,
      );
      const released = gravityHold.current[cell.month] >= GRAVITY_HOLD;
      const rampTo = live && settled && released && gravityWanted ? 1 : 0;
      gravityRamp.current[cell.month] = reducedMotion
        ? rampTo
        : THREE.MathUtils.clamp(
            gravityRamp.current[cell.month] +
              ((rampTo ? 1 : -1) * step) / GRAVITY_RAMP,
            0,
            1,
          );
      const collaboration = collaborationTarget * gravityRamp.current[cell.month];

      for (let i = 0; i < people; i++) {
        const trainee = trainees[i];
        const index = cell.month * people + i;
        const state = resolveTrainee(
          trainee,
          cell.month,
          whatIf,
          MAX_SKILLS,
          MAX_CHALLENGES,
        );
        const body = cell.bodies[i];

        body.present = state.present;
        body.bonding = state.bonding;
        body.turbulence = state.present ? state.turbulence : 0;

        // Only the layer being occupied answers to attention. A person in a
        // month nobody has entered is context, not a subject.
        const attended =
          live &&
          (            trainee.id === focusedTraineeId ||
            trainee.id === hoveredTraineeId ||
            (focusedTeamId !== null &&
              teamOfTrainee.get(trainee.id)?.id === focusedTeamId));

        // Under the challenges lens the people who met difficulty are the
        // subject; everyone else is context. Nobody disappears — a person who
        // had a clear three months is a reading of its own.
        const emphasisTarget = attended
          ? ORBS.EMPHASIS_ATTENDED
          : hasSelection && live
            ? ORBS.EMPHASIS_RECEDED
            : ORBS.EMPHASIS_NEUTRAL;

        buffers.emphasisLevel[index] +=
          (emphasisTarget - buffers.emphasisLevel[index]) * ease;
        buffers.complexityLevel[index] +=
          (state.complexity - buffers.complexityLevel[index]) * slowEase;
        buffers.turbulenceLevel[index] +=
          (state.turbulence - buffers.turbulenceLevel[index]) * slowEase;
        buffers.presenceLevel[index] +=
          ((state.present ? 1 : 0) - buffers.presenceLevel[index]) * slowEase;

        // Each person has their own window inside the layer's reveal, so the
        // sixteen resolve in sequence rather than together.
        const start = (i / people) * REVEAL_STAGGER;
        const own = THREE.MathUtils.clamp(
          (revealProgress - start) / (1 - REVEAL_STAGGER),
          0,
          1,
        );
        buffers.revealLevel[index] = own * own * (3 - 2 * own);

        // Difficulty, drawn only while the world is about what people found
        // hard. How much of a vessel is crossed is that person's own recorded
        // challenge load in this month, so nobody is cracked for effect and an
        // untroubled person shows nothing at all.
        const cracksTarget =
          lens === 'challenges' && live
            ? Math.min(1, state.challengeIds.length / MAX_CHALLENGES)
            : 0;
        buffers.cracksLevel[index] +=
          (cracksTarget - buffers.cracksLevel[index]) * slowEase;

        // Confidence sets the vessel's size, scaled to the layer it stands in
        // so a person looks the same in every month — which is what lets the
        // change between them read as a change in the person rather than in the
        // scenery.
        const deviation = state.confidence == null ? 0 : (state.confidence - 3) / 2;
        const radiusTarget =
          (ORBS.BASE_RADIUS + deviation * ORBS.RADIUS_VARIANCE) * cell.scale;
        buffers.radiusLevel[index] +=
          (radiusTarget - buffers.radiusLevel[index]) * slowEase;
      }

      if (!reducedMotion) {
        stepGravity(cell.bodies, cell.formations, step, collaboration, cell.scale, time);
      }

      for (let i = 0; i < people; i++) {
        const index = cell.month * people + i;
        positions.get(orbKey(cell.month, trainees[i].id))?.copy(cell.bodies[i].position);
        buffers.distances[index] = cell.bodies[i].position.distanceToSquared(
          camera.position,
        );
      }
    }

    if (import.meta.env.DEV) {
      // Mean distance between teammates against mean distance between people on
      // different teams, per layer.
      //
      // This is the only honest way to check that team gravity did anything.
      // The claim Month 2 makes is that people who worked together end up
      // closer to each other than to everybody else, and that is a measurable
      // property of where the bodies actually are — not something a screenshot
      // or a frame count can confirm.
      const report: Record<
        string,
        { intra: number; inter: number; teamSpread: number; gap: number }
      > = {};
      for (const cell of cells) {
        let intra = 0;
        let intraCount = 0;
        let inter = 0;
        let interCount = 0;
        for (let a = 0; a < people; a++) {
          for (let b = a + 1; b < people; b++) {
            const distance = cell.bodies[a].position.distanceTo(cell.bodies[b].position);
            const together = cell.bodies[a].teamId === cell.bodies[b].teamId;
            if (together && cell.bodies[a].teamId !== null) {
              intra += distance;
              intraCount += 1;
            } else {
              inter += distance;
              interCount += 1;
            }
          }
        }
        // How big each team is against how far apart the teams are: the one
        // number that says whether five formations read as five formations.
        const centroids = new Map<string, { sum: THREE.Vector3; n: number }>();
        for (const body of cell.bodies) {
          if (!body.teamId) continue;
          const entry = centroids.get(body.teamId) ?? {
            sum: new THREE.Vector3(),
            n: 0,
          };
          entry.sum.add(body.position);
          entry.n += 1;
          centroids.set(body.teamId, entry);
        }
        const middles = [...centroids.values()].map((e) =>
          e.sum.clone().divideScalar(Math.max(1, e.n)),
        );
        let closest = Infinity;
        for (let a = 0; a < middles.length; a++)
          for (let b = a + 1; b < middles.length; b++)
            closest = Math.min(closest, middles[a].distanceTo(middles[b]));

        let widest = 0;
        for (const body of cell.bodies) {
          if (!body.teamId) continue;
          const entry = centroids.get(body.teamId);
          if (!entry) continue;
          const middle = entry.sum.clone().divideScalar(Math.max(1, entry.n));
          widest = Math.max(widest, body.position.distanceTo(middle));
        }

        report[`M0${cell.month + 1}`] = {
          // Normalised by the layer's scale so the two months are comparable.
          intra: +(intra / Math.max(1, intraCount) / cell.scale).toFixed(3),
          inter: +(inter / Math.max(1, interCount) / cell.scale).toFixed(3),
          teamSpread: +(widest / cell.scale).toFixed(3),
          gap: +((closest - 2 * widest) / cell.scale).toFixed(3),
        };
      }
      (window as unknown as Record<string, unknown>).__teams = report;
    }

    // Back to front: the glass uses normal blending and writes no depth, so
    // without an explicit order a far orb can paint straight over a near one.
    buffers.order.sort((a, b) => buffers.distances[b] - buffers.distances[a]);

    if (orbMaterialRef.current) {
      orbMaterialRef.current.uniforms.uTime.value = reducedMotion ? 4 : time;
    }

    for (let slot = 0; slot < count; slot++) {
      const index = buffers.order[slot];
      const person = index % people;
      const month = Math.floor(index / people);
      const body = cells[month].bodies[person];

      const breath = reducedMotion
        ? 1
        : 1 +
          Math.sin(time * buffers.tempos[index] + seeds[person] * 6.283) * ORBS.BREATH;

      // An attended orb swells slightly: enough to confirm the pointer found
      // it, far short of lurching toward the viewer.
      const emphasis = buffers.emphasisLevel[index];
      const swell =
        1 +
        ORBS.ATTENDED_SWELL *
          Math.max(
            0,
            (emphasis - ORBS.EMPHASIS_NEUTRAL) /
              (ORBS.EMPHASIS_ATTENDED - ORBS.EMPHASIS_NEUTRAL),
          );
      // Arriving by growing, not merely by fading: a vessel that swells into
      // existence has volume, one that only becomes opaque is a decal.
      const reveal = buffers.revealLevel[index];
      const radius =
        buffers.radiusLevel[index] * breath * swell * (0.45 + reveal * 0.55);

      matrix.makeScale(radius, radius, radius);
      matrix.setPosition(body.position);
      orbs.setMatrixAt(slot, matrix);

      const haloSize = radius * ORBS.HALO_SCALE;
      matrix.makeScale(haloSize, haloSize, haloSize);
      matrix.setPosition(body.position);
      halos.setMatrixAt(slot, matrix);

      // State follows the person into their slot.
      buffers.complexity[slot] = buffers.complexityLevel[index];
      buffers.emphasis[slot] = emphasis;
      buffers.presence[slot] = buffers.presenceLevel[index] * reveal;

      buffers.seeds[slot] = seeds[person];
      buffers.tempos[slot] = buffers.tempos[index];
      buffers.turbulence[slot] = buffers.turbulenceLevel[index];
      buffers.cracks[slot] = buffers.cracksLevel[index];
    }

    orbs.instanceMatrix.needsUpdate = true;
    halos.instanceMatrix.needsUpdate = true;

    // The orbs are solved by the simulation and move every frame, and
    // InstancedMesh caches its bounding sphere the first time one is asked for
    // and never refreshes it. The raycaster tests that sphere before any
    // instance, so a stale one silently stops picking working wherever the
    // field has drifted since. Sixteen instances is nothing to recompute.
    orbs.computeBoundingSphere();

    // The render loop starts before the effect that attaches these, so the
    // first frames legitimately find them absent.
    for (const name of ['aComplexity', 'aEmphasis', 'aPresence']) {
      markUpdated(orbs, name);
      markUpdated(halos, name);
    }
    markUpdated(orbs, 'aCracks');
    markUpdated(orbs, 'aSeed');
    markUpdated(orbs, 'aTempo');
    markUpdated(orbs, 'aTurbulence');
  });

  // Tempo is fixed per person; seeded once rather than recomputed each frame.
  // The same person breathes at the same rate in every layer, which is part of
  // what makes them recognisably the same person from one month to the next.
  useEffect(() => {
    for (const month of LIVE_MONTHS) {
      for (let i = 0; i < people; i++) {
        buffers.tempos[month * people + i] =
          ((Math.PI * 2) / ORBS.BREATH_PERIOD) *
          (1 + (seeds[i] - 0.5) * ORBS.BREATH_SPREAD);
      }
    }
  }, [buffers, seeds, people]);

  /**
   * Resolves a picked instance back to the person it represents.
   *
   * Instances are re-sorted by depth every frame, so `instanceId` identifies a
   * slot, not a trainee. Reading through the current order is what keeps the
   * pointer honest — without it, the reported identity would change as the
   * camera moved. Only the layer the viewer is inside answers: an orb standing
   * in another month is there for comparison, and clicking it would silently
   * move them through time.
   */
  const traineeAt = useCallback(
    (instanceId: number | undefined): string | null => {
      if (instanceId === undefined) return null;
      const index = buffers.order[instanceId];
      if (index === undefined) return null;

      const { enteredMonth } = useWorldStore.getState();
      if (enteredMonth === null) return null;
      if (Math.floor(index / people) !== enteredMonth) return null;

      // A person removed by a counterfactual is a trace, not a target, and one
      // who has not finished arriving is not there to be clicked yet.
      if (buffers.presenceLevel[index] < 0.5) return null;
      if (buffers.revealLevel[index] < 0.6) return null;
      return trainees[index % people].id;
    },
    [buffers, people],
  );

  /**
   * True when something deeper than a person lies under the pointer too.
   *
   * Two things sit behind or within the vessels and would otherwise be
   * unreachable, for opposite reasons. A person's sessions live *inside* their
   * glass, so the vessel's near surface is always the nearer intersection and
   * claims the event first. A team's project sits at the centre of its
   * formation, ringed by the very people who built it, so an orb on the near
   * side is always nearer than the artifact. Either way the vessel would
   * swallow every event aimed past it, and the thing behind would render and
   * never respond.
   *
   * So the vessel stands aside whenever one of them is in the ray. Attention is
   * still paid to the person — you are pointing at them either way — but the
   * deeper subject gets to claim the click.
   */
  const deeperSubjectUnderPointer = useCallback(
    (event: ThreeEvent<PointerEvent | MouseEvent>) =>
      event.intersections.some(
        (hit) =>
          hit.object.userData?.session === true ||
          hit.object.userData?.project === true,
      ),
    [],
  );

  const onPointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      hoverTrainee(traineeAt(event.instanceId));
      // Still identify the person — you are pointing at them either way — but
      // leave the event alive for whatever they are holding.
      if (!deeperSubjectUnderPointer(event)) event.stopPropagation();
    },
    [hoverTrainee, traineeAt, deeperSubjectUnderPointer],
  );

  const onPointerOut = useCallback(() => hoverTrainee(null), [hoverTrainee]);

  const onClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      // A click aimed at something inside the vessel belongs to that object.
      // Without this, opening a session would also toggle the person off and
      // throw the viewer out of the world they were examining.
      if (deeperSubjectUnderPointer(event)) return;

      const id = traineeAt(event.instanceId);
      if (!id) return;
      event.stopPropagation();
      // Clicking the selected orb again releases it, so the same gesture that
      // enters a person also leaves them.
      const current = useWorldStore.getState().focusedTraineeId;
      focusTrainee(current === id ? null : id);
    },
    [focusTrainee, traineeAt, deeperSubjectUnderPointer],
  );

  const orderedIds = useMemo(() => trainees.map((t) => t.id), []);
  useSelectionKeys(orderedIds);

  return (
    <group>
      <instancedMesh
        ref={haloRef}
        args={[haloGeometry, undefined, count]}
        renderOrder={RENDER_ORDER.ORB_HALOS}
        frustumCulled={false}
      >
        <shaderMaterial
          vertexShader={HALO_VERT}
          fragmentShader={HALO_FRAG}
          uniforms={haloUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>

      {/*
        The sessions each person liked, orbiting their vessel. Drawn before the
        glass so the forms composite under it rather than over it.
      */}
      <LearningField positions={positions} />

      <instancedMesh
        ref={orbRef}
        args={[orbGeometry, undefined, count]}
        renderOrder={RENDER_ORDER.ORBS}
        frustumCulled={false}
        onPointerMove={onPointerMove}
        onPointerOut={onPointerOut}
        onClick={onClick}
      >
        {/*
          Normal blending, not additive. Additive can only ever brighten what is
          behind it, so an additive material cannot be dark-tinted glass — it
          would glow instead of absorbing, and the indigo body would never read.
        */}
        <shaderMaterial
          ref={orbMaterialRef}
          vertexShader={ORB_VERT}
          fragmentShader={ORB_FRAG}
          uniforms={orbUniforms}
          transparent
          depthWrite={false}
          blending={THREE.NormalBlending}
          toneMapped={false}
        />
      </instancedMesh>

      <TraineeLabel />
      <SessionLabel />
    </group>
  );
}
