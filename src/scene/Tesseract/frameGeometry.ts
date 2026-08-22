import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BEVEL_RATIO, BEVEL_SEGMENTS } from '../../config/dimensions';

/** The eight corners of a cube of the given half-size, in a stable order. */
export function cubeVertices(half: number): THREE.Vector3[] {
  const vertices: THREE.Vector3[] = [];
  for (let i = 0; i < 8; i++) {
    vertices.push(
      new THREE.Vector3(
        i & 1 ? half : -half,
        i & 2 ? half : -half,
        i & 4 ? half : -half,
      ),
    );
  }
  return vertices;
}

/** The twelve edges of a cube as index pairs into `cubeVertices`. */
export const EDGES: readonly [number, number][] = [
  [0, 1], [2, 3], [4, 5], [6, 7], // along x
  [0, 2], [1, 3], [4, 6], [5, 7], // along y
  [0, 4], [1, 5], [2, 6], [3, 7], // along z
];

const segmentStart = new THREE.Vector3();
const segmentLine = new THREE.Vector3();
const toPoint = new THREE.Vector3();

/**
 * Shortest distance from a point to the structural members of one shell.
 *
 * Used to fade a shell out as the camera closes on it. Measuring against the
 * members themselves rather than against the shell's radius matters, because a
 * cube's distance from its own centre varies by a factor of √3 between the face
 * centres and the corners — a single radius would fade the frame far too early
 * in some directions and far too late in others.
 */
export function distanceToShell(point: THREE.Vector3, half: number): number {
  const vertices = cubeVertices(half);
  let nearest = Infinity;

  for (const [a, b] of EDGES) {
    segmentStart.copy(vertices[a]);
    segmentLine.subVectors(vertices[b], vertices[a]);

    const lengthSq = segmentLine.lengthSq();
    const t =
      lengthSq === 0
        ? 0
        : THREE.MathUtils.clamp(
            toPoint.subVectors(point, segmentStart).dot(segmentLine) / lengthSq,
            0,
            1,
          );

    toPoint.copy(segmentStart).addScaledVector(segmentLine, t);
    nearest = Math.min(nearest, point.distanceTo(toPoint));
  }

  return nearest;
}

/**
 * Builds the twelve structural members of one cube shell as a single geometry.
 *
 * Each strut is a bevelled box rather than a line. That choice is the whole
 * difference between a wireframe and a structure: a bevel has a chamfer for
 * specular highlights to travel along, which is what makes the frame read as
 * machined metal under a moving camera.
 *
 * Struts are inset by the node size so they meet the corner blocks cleanly
 * instead of interpenetrating them.
 */
export function buildStrutGeometry(
  half: number,
  strut: number,
  node: number,
): THREE.BufferGeometry {
  const radius = strut * BEVEL_RATIO;
  const span = half * 2 - node;
  const parts: THREE.BufferGeometry[] = [];

  for (const [a, b] of EDGES) {
    const vertices = cubeVertices(half);
    const start = vertices[a];
    const end = vertices[b];

    const geometry = new RoundedBoxGeometry(strut, span, strut, BEVEL_SEGMENTS, radius);

    // RoundedBoxGeometry is built along Y; rotate it onto the edge's axis.
    const direction = new THREE.Vector3().subVectors(end, start).normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction,
    );
    const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

    const matrix = new THREE.Matrix4().compose(
      midpoint,
      quaternion,
      new THREE.Vector3(1, 1, 1),
    );
    geometry.applyMatrix4(matrix);
    parts.push(geometry);
  }

  const merged = BufferGeometryUtils.mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());

  if (!merged) throw new Error('Failed to merge strut geometry');
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Builds the eight corner blocks of one shell as a single geometry.
 *
 * These are slightly oversized relative to the struts so the joints read as
 * deliberate hardware, and they are the only geometry in the scene intended to
 * carry enough emissive energy to cross the bloom threshold.
 */
export function buildNodeGeometry(half: number, node: number): THREE.BufferGeometry {
  const radius = node * BEVEL_RATIO;
  const parts: THREE.BufferGeometry[] = [];

  for (const vertex of cubeVertices(half)) {
    const geometry = new RoundedBoxGeometry(node, node, node, BEVEL_SEGMENTS, radius);
    geometry.translate(vertex.x, vertex.y, vertex.z);
    parts.push(geometry);
  }

  const merged = BufferGeometryUtils.mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());

  if (!merged) throw new Error('Failed to merge node geometry');
  merged.computeBoundingSphere();
  return merged;
}
