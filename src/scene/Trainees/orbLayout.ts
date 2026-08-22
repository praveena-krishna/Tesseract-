import * as THREE from 'three';
import { SHELLS } from '../../config/dimensions';
import { ORBS } from '../../config/orbs';
import { cubeVertices } from '../Tesseract/frameGeometry';

/** The twelve edges of a cube as index pairs into `cubeVertices`. */
const EDGE_PAIRS: readonly [number, number][] = [
  [0, 1], [2, 3], [4, 5], [6, 7],
  [0, 2], [1, 3], [4, 6], [5, 7],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

interface Segment {
  start: THREE.Vector3;
  end: THREE.Vector3;
}

/** Every structural member of every shell, as line segments to keep clear of. */
function shellSegments(): Segment[] {
  const segments: Segment[] = [];
  for (const shell of SHELLS) {
    const vertices = cubeVertices(shell.half);
    for (const [a, b] of EDGE_PAIRS) {
      segments.push({ start: vertices[a], end: vertices[b] });
    }
  }
  return segments;
}

/** Shortest distance from a point to a finite line segment. */
function distanceToSegment(point: THREE.Vector3, segment: Segment): number {
  const line = new THREE.Vector3().subVectors(segment.end, segment.start);
  const lengthSq = line.lengthSq();
  if (lengthSq === 0) return point.distanceTo(segment.start);

  const t = THREE.MathUtils.clamp(
    new THREE.Vector3().subVectors(point, segment.start).dot(line) / lengthSq,
    0,
    1,
  );
  const closest = new THREE.Vector3().copy(segment.start).addScaledVector(line, t);
  return point.distanceTo(closest);
}

/**
 * Deterministic pseudo-random source, so the composition is identical on every
 * load. A layout that reshuffles between refreshes cannot be art-directed, and
 * an orb that moves house between sessions is not a stable identity.
 */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** Closest point on a finite segment to a given point. */
function closestPointOnSegment(
  point: THREE.Vector3,
  segment: Segment,
  target: THREE.Vector3,
): THREE.Vector3 {
  const line = new THREE.Vector3().subVectors(segment.end, segment.start);
  const lengthSq = line.lengthSq();
  if (lengthSq === 0) return target.copy(segment.start);

  const t = THREE.MathUtils.clamp(
    new THREE.Vector3().subVectors(point, segment.start).dot(line) / lengthSq,
    0,
    1,
  );
  return target.copy(segment.start).addScaledVector(line, t);
}

const RELAXATION_STEPS = 220;
const STEP_SIZE = 0.32;

/**
 * Places the trainee orbs inside the tesseract.
 *
 * The distribution starts from a jittered golden-angle spiral, which spreads
 * points over a sphere far more evenly than random sampling would, and is then
 * relaxed: on each pass every orb is pushed away from neighbours that have
 * crowded it and away from any structural member it has drifted too close to,
 * then pulled back into the radial band.
 *
 * Relaxation rather than rejection sampling because the feasible region here is
 * genuinely tight — three shells of struts to avoid inside a thin spherical
 * band — and a rejection sampler that runs out of attempts has to fall back on
 * its least-bad candidate, which is precisely how two orbs end up sitting on
 * top of each other. Relaxation instead improves every position simultaneously
 * and converges on an even spread.
 *
 * The whole process is deterministic, so an orb keeps its position across
 * reloads: a person's location is part of their identity in this world.
 */
export function computeOrbPositions(count: number): THREE.Vector3[] {
  const segments = shellSegments();
  const random = seeded(0x7e55e2);
  const golden = Math.PI * (3 - Math.sqrt(5));

  const midRadius = (ORBS.RADIUS_INNER + ORBS.RADIUS_OUTER) / 2;

  const points: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const jitterIndex = i + (random() - 0.5) * 0.7;
    const y = 1 - (2 * (jitterIndex + 0.5)) / count;
    const polarRadius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * jitterIndex + (random() - 0.5) * 0.45;

    const direction = new THREE.Vector3(
      Math.cos(theta) * polarRadius,
      y,
      Math.sin(theta) * polarRadius,
    ).normalize();

    const radius =
      ORBS.RADIUS_INNER + random() * (ORBS.RADIUS_OUTER - ORBS.RADIUS_INNER);
    points.push(direction.multiplyScalar(radius));
  }

  const push = new THREE.Vector3();
  const closest = new THREE.Vector3();
  const away = new THREE.Vector3();

  for (let step = 0; step < RELAXATION_STEPS; step++) {
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      push.set(0, 0, 0);

      // Separate from crowding neighbours, weighted by how deep the overlap is.
      for (let j = 0; j < points.length; j++) {
        if (i === j) continue;
        const other = points[j];
        const distance = point.distanceTo(other);
        if (distance >= ORBS.SEPARATION || distance === 0) continue;

        away.subVectors(point, other).divideScalar(distance);
        push.addScaledVector(away, (ORBS.SEPARATION - distance) / ORBS.SEPARATION);
      }

      // Move clear of any structural member that is too close.
      for (const segment of segments) {
        closestPointOnSegment(point, segment, closest);
        const distance = point.distanceTo(closest);
        if (distance >= ORBS.STRUT_CLEARANCE || distance === 0) continue;

        away.subVectors(point, closest).divideScalar(distance);
        push.addScaledVector(
          away,
          ((ORBS.STRUT_CLEARANCE - distance) / ORBS.STRUT_CLEARANCE) * 1.4,
        );
      }

      if (push.lengthSq() > 0) point.addScaledVector(push, STEP_SIZE);

      // Return to the band. Without this the repulsion would gradually inflate
      // the whole field outward until it left the structure entirely.
      const radius = point.length();
      if (radius === 0) {
        point.set(0, midRadius, 0);
      } else {
        const clamped = THREE.MathUtils.clamp(
          radius,
          ORBS.RADIUS_INNER,
          ORBS.RADIUS_OUTER,
        );
        point.multiplyScalar(clamped / radius);
      }
    }
  }

  return points;
}

/** Diagnostic: the tightest neighbour and strut clearances in a layout. */
export function layoutClearances(points: THREE.Vector3[]): {
  minSeparation: number;
  minStrutClearance: number;
} {
  const segments = shellSegments();
  let minSeparation = Infinity;
  let minStrutClearance = Infinity;

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      minSeparation = Math.min(minSeparation, points[i].distanceTo(points[j]));
    }
    for (const segment of segments) {
      minStrutClearance = Math.min(
        minStrutClearance,
        distanceToSegment(points[i], segment),
      );
    }
  }

  return { minSeparation, minStrutClearance };
}
