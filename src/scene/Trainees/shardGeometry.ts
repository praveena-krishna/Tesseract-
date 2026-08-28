import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';

/**
 * A fragment of broken glass.
 *
 * Built as the convex hull of a handful of scattered points rather than from a
 * formula, because anything with a formula behind it reads as a symbol. A
 * bipyramid is a diamond, a prism is a crystal, an extruded polygon is an icon —
 * all of them are shapes a viewer recognises as *made*, and none of them is what
 * happens when something breaks. A hull over jittered points has no axis of
 * symmetry to find, and that absence is what makes it read as broken.
 *
 * The points are squashed hard on one axis so the fragment comes out as a
 * sliver with real thickness rather than a pebble, and stretched on another so
 * it has a long dimension and a sharp end. Every fragment is seeded, so the
 * same difficulty is always the same piece of glass and never rearranges itself
 * between frames or between sessions.
 */
export function buildShard(seed: number, points = 9): THREE.BufferGeometry {
  // A small deterministic generator: the same seed must always cut the same
  // piece of glass.
  let state = seed * 9301 + 49297;
  const random = () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };

  const cloud: THREE.Vector3[] = [];
  for (let i = 0; i < points; i++) {
    // Squashed flat and drawn out lengthways: a shard is a sliver off a
    // surface, not a lump.
    // Drawn out further and squashed harder than before. A stubby fragment is
    // a pebble; a long thin one is a blade, and the difference is most of
    // whether these look like something you would not want in you.
    const x = (random() * 2 - 1) * 1.0;
    const y = (random() * 2 - 1) * 0.38;
    const z = (random() * 2 - 1) * 0.1;
    cloud.push(new THREE.Vector3(x, y, z));
  }

  // A couple of points pushed well out along the long axis, so the hull comes
  // to a genuine point at one end instead of rounding off into a lozenge.
  cloud.push(new THREE.Vector3(1.7 + random() * 0.5, (random() - 0.5) * 0.12, (random() - 0.5) * 0.05));
  cloud.push(new THREE.Vector3(-1.1 - random() * 0.3, (random() - 0.5) * 0.35, (random() - 0.5) * 0.1));

  const hull = new ConvexGeometry(cloud);

  // Barycentric coordinates per triangle, so the shader can find the edges of
  // each face and catch the light along them. Glass without visible edges is
  // just a tinted blob.
  const count = hull.getAttribute('position').count;
  const bary = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 3) {
    bary.set([1, 0, 0, 0, 1, 0, 0, 0, 1], i * 3);
  }
  hull.setAttribute('aBary', new THREE.BufferAttribute(bary, 3));
  hull.computeVertexNormals();
  hull.computeBoundingSphere();
  return hull;
}
