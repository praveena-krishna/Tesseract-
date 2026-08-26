import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * A distinct form for every session in the training.
 *
 * Each is built from what the topic actually is, not from a shape picked to
 * look different. A database is rings of stored records; a repository's history
 * diverges and rejoins; a shield is overlapping plates. Someone who knows the
 * subject should recognise the object before reading its name, and someone who
 * does not should still see that these are different kinds of thing rather than
 * different colours of the same thing.
 *
 * Colour is deliberately not part of the vocabulary — every form shares one
 * material. Fifteen hues would be a legend to memorise; fifteen forms are
 * simply recognised, and stay recognisable in silhouette and at a glance.
 *
 * All of them fit inside a unit sphere so the scene can scale them uniformly,
 * and each merges to a single geometry so a session costs one draw call however
 * many people liked it.
 */

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // Flattened to non-indexed first. Three's primitives disagree about this —
  // the polyhedra come out non-indexed while the lathed and extruded ones are
  // indexed — and merging the two silently returns null, which shows up only as
  // a missing object.
  const stripped = parts.map((part) => {
    const clone = part.index ? part.toNonIndexed() : part.clone();
    part.dispose();
    clone.deleteAttribute('uv');
    return clone;
  });
  const merged = BufferGeometryUtils.mergeGeometries(stripped, false);
  stripped.forEach((part) => part.dispose());
  if (!merged) throw new Error('Failed to merge session geometry');
  merged.computeBoundingSphere();
  return merged;
}

function at(
  geometry: THREE.BufferGeometry,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
): THREE.BufferGeometry {
  geometry.applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      new THREE.Vector3(...scale),
    ),
  );
  return geometry;
}

/** A thin bar between two points. */
function bar(
  from: THREE.Vector3,
  to: THREE.Vector3,
  thickness: number,
): THREE.BufferGeometry {
  const length = from.distanceTo(to);
  const geometry = new THREE.CylinderGeometry(thickness, thickness, length, 5, 1);
  geometry.applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3().subVectors(to, from).normalize(),
      ),
      new THREE.Vector3(1, 1, 1),
    ),
  );
  return geometry;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/* ------------------------------------------------------------------ *
 * The forms
 * ------------------------------------------------------------------ */

/** AI Topics — nodes that keep re-linking as they settle. */
function lattice(): THREE.BufferGeometry {
  const points = [
    V(0, 0.74, 0), V(0.68, 0.2, 0.3), V(-0.32, 0.28, 0.7),
    V(-0.64, 0.14, -0.44), V(0.3, -0.36, -0.68), V(-0.26, -0.64, 0.36),
    V(0.52, -0.52, 0.26), V(0, -0.08, 0),
  ];
  const parts = points.map((p) => at(new THREE.OctahedronGeometry(0.15, 0), p.toArray()));
  // Not every pair — a fully connected set is a ball of struts. These are the
  // links a settling network keeps.
  ([[7,0],[7,1],[7,2],[7,3],[7,4],[7,5],[7,6],[0,1],[1,6],[2,5],[3,4]] as const)
    .forEach(([a, b]) => parts.push(bar(points[a], points[b], 0.03)));
  return merge(parts);
}

/** Databricks — the medallion layers: raw, refined, served. */
function strata(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  [
    { y: -0.48, r: 0.9, h: 0.14 },
    { y: -0.02, r: 0.66, h: 0.16 },
    { y: 0.44, r: 0.42, h: 0.18 },
  ].forEach((level, i) => {
    // Each layer turned against the one below, so the stack reads as successive
    // refinements rather than as one extruded prism.
    parts.push(at(new THREE.CylinderGeometry(level.r, level.r, level.h, 6, 1),
      [0, level.y, 0], [0, (i * Math.PI) / 9, 0]));
  });
  parts.push(bar(V(0, -0.62, 0), V(0, 0.62, 0), 0.036));
  return merge(parts);
}

/** Database — concentric rings of stored rows, indexed inward to the key. */
function rings(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  [0.86, 0.6, 0.35].forEach((r, i) => {
    parts.push(at(new THREE.TorusGeometry(r, 0.048 + i * 0.012, 6, 26),
      [0, i * 0.12 - 0.12, 0], [Math.PI / 2, 0, 0]));
  });
  parts.push(at(new THREE.SphereGeometry(0.16, 12, 8), [0, 0.12, 0]));
  return merge(parts);
}

/** A sampled curve, shared by the two data-visualization forms. */
function wavePoints(count: number, amplitude: number): THREE.Vector3[] {
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    return V(t * 1.7 - 0.85, Math.sin(t * Math.PI * 2.1) * amplitude,
      Math.cos(t * Math.PI * 1.4) * 0.16);
  });
}

/** Data Visualization — a quantity given a shape the eye can follow. */
function waveform(): THREE.BufferGeometry {
  const points = wavePoints(24, 0.48);
  const parts: THREE.BufferGeometry[] = [
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 40, 0.058, 5, false),
  ];
  // Read points, where a reader's eye stops.
  [3, 8, 14, 20].forEach((i) =>
    parts.push(at(new THREE.SphereGeometry(0.095, 10, 7), points[i].toArray())));
  return merge(parts);
}

/** Data Visualization Project — the same reading, built into something. */
function scaffold(): THREE.BufferGeometry {
  const points = wavePoints(14, 0.36);
  const parts: THREE.BufferGeometry[] = [
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 26, 0.046, 5, false),
    bar(V(-0.9, -0.64, 0), V(0.9, -0.64, 0), 0.052),
  ];
  // Every reading carries its own load down to the base. That is the difference
  // between the plot and the project: the project has to stand up.
  points.forEach((p, i) => {
    if (i % 2 === 0) parts.push(bar(p, V(p.x, -0.64, p.z * 0.5), 0.027));
  });
  return merge(parts);
}

/** Web/Mobile Application — interface surfaces layered in depth. */
function panes(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  [
    { z: -0.36, w: 1.12, h: 0.8, x: -0.16, y: -0.1 },
    { z: 0.0, w: 0.94, h: 0.66, x: 0.0, y: 0.02 },
    { z: 0.36, w: 0.72, h: 0.5, x: 0.14, y: 0.14 },
  ].forEach((s) =>
    parts.push(at(new THREE.BoxGeometry(s.w, s.h, 0.05), [s.x, s.y, s.z], [0, 0.16, 0])));
  return merge(parts);
}

/** UI/UX — the layout skeleton beneath a screen, all on one plane. */
function layout(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // Deliberately unequal blocks: an even grid is graph paper, and what a layout
  // actually is is a considered division of one surface into unequal weights.
  ([
    { x: -0.34, y: 0.5, w: 1.24, h: 0.24 },
    { x: -0.56, y: 0.02, w: 0.8, h: 0.62 },
    { x: 0.42, y: 0.16, w: 0.52, h: 0.3 },
    { x: 0.42, y: -0.26, w: 0.52, h: 0.42 },
    { x: -0.34, y: -0.56, w: 1.24, h: 0.2 },
  ] as const).forEach((b) =>
    parts.push(at(new THREE.BoxGeometry(b.w, b.h, 0.06), [b.x, b.y, 0])));
  return merge(parts);
}

/** Backend — requests travelling branching paths to whatever answers them. */
function conduit(): THREE.BufferGeometry {
  const junction = V(0, 0.14, 0);
  const parts: THREE.BufferGeometry[] = [bar(V(0, -0.84, 0), junction, 0.078)];
  [V(0.68, 0.74, 0.14), V(-0.6, 0.68, -0.3), V(0.06, 0.8, -0.64)].forEach((end) => {
    parts.push(bar(junction, end, 0.052));
    parts.push(at(new THREE.SphereGeometry(0.115, 10, 7), end.toArray()));
  });
  parts.push(at(new THREE.SphereGeometry(0.125, 12, 8), junction.toArray()));
  return merge(parts);
}

/** Linux — the system seen from the terminal: a stack of running blocks. */
function column(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // Left-aligned, the way a terminal is. The ragged right edge is the entire
  // visual signature of a column of output.
  [0.88, 0.54, 0.74, 0.4, 0.64].forEach((w, i) =>
    parts.push(at(new THREE.BoxGeometry(w, 0.16, 0.34), [w / 2 - 0.5, i * 0.27 - 0.54, 0])));
  return merge(parts);
}

/** Cybersecurity — defence that holds because it is layered. */
function shield(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  [{ r: 0.92, z: -0.2 }, { r: 0.63, z: 0.07 }, { r: 0.35, z: 0.3 }].forEach((p, i) =>
    parts.push(at(new THREE.CylinderGeometry(p.r, p.r, 0.055, 6, 1),
      [0, 0, p.z], [Math.PI / 2, 0, (i * Math.PI) / 6])));
  return merge(parts);
}

/** IoT — small independent devices, each announcing itself into the room. */
function emitters(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [new THREE.IcosahedronGeometry(0.21, 0)];
  [V(0.76, 0.36, 0.1), V(-0.5, 0.52, -0.44), V(-0.24, -0.64, 0.58), V(0.42, -0.56, -0.5)]
    .forEach((node) => {
      parts.push(bar(V(0, 0, 0), node, 0.024));
      parts.push(at(new THREE.IcosahedronGeometry(0.135, 0), node.toArray()));
      // The announcement: a ring leaving the device.
      parts.push(at(new THREE.TorusGeometry(0.25, 0.017, 4, 14), node.toArray(),
        [Math.PI / 2, Math.atan2(node.x, node.z), 0]));
    });
  return merge(parts);
}

/** Git — divergent lines that rejoin. */
function branch(): THREE.BufferGeometry {
  const spine = [V(0, -0.86, 0), V(0, -0.3, 0), V(0, 0.3, 0), V(0, 0.86, 0)];
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < spine.length - 1; i++) parts.push(bar(spine[i], spine[i + 1], 0.052));
  spine.forEach((p) => parts.push(at(new THREE.SphereGeometry(0.105, 10, 7), p.toArray())));
  // One line leaves at a commit and comes back at a later one. That merge is
  // what makes this a history rather than a tree.
  const away = V(0.64, 0, 0.16);
  parts.push(bar(spine[1], away, 0.038));
  parts.push(bar(away, spine[2], 0.038));
  parts.push(at(new THREE.SphereGeometry(0.095, 10, 7), away.toArray()));
  return merge(parts);
}

/** Group Project — a fabric no single person holds up. */
function mesh(): THREE.BufferGeometry {
  const count = 6;
  const points = Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return V(Math.cos(a) * 0.8, Math.sin(a * 2) * 0.26, Math.sin(a) * 0.8);
  });
  const parts = points.map((p) => at(new THREE.SphereGeometry(0.105, 10, 7), p.toArray()));
  for (let i = 0; i < count; i++) {
    parts.push(bar(points[i], points[(i + 1) % count], 0.028));
    parts.push(bar(points[i], points[(i + 2) % count], 0.021));
  }
  return merge(parts);
}

/** Devops — a closed circuit that never stops going round. */
function cycle(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    at(new THREE.TorusGeometry(0.78, 0.055, 6, 32), [0, 0, 0], [Math.PI / 2.6, 0, 0]),
  ];
  // Stages on the loop, unevenly spaced: a pipeline is not a clock face.
  [0, 1.3, 2.5, 3.6, 4.9].forEach((a) => {
    const p = V(Math.cos(a) * 0.78, 0, Math.sin(a) * 0.78)
      .applyAxisAngle(V(1, 0, 0), Math.PI / 2.6 - Math.PI / 2);
    parts.push(at(new THREE.BoxGeometry(0.19, 0.19, 0.19), p.toArray(), [0.3, a, 0]));
  });
  return merge(parts);
}

/** Testing — probes converging on the thing under examination. */
function assay(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [new THREE.BoxGeometry(0.42, 0.42, 0.42)];
  [V(0.9, 0, 0), V(-0.9, 0, 0), V(0, 0.9, 0), V(0, -0.9, 0), V(0, 0, 0.9), V(0, 0, -0.9)]
    .forEach((dir) => {
      parts.push(bar(dir.clone().multiplyScalar(0.36), dir, 0.03));
      parts.push(at(new THREE.ConeGeometry(0.075, 0.2, 6), dir.toArray(),
        [Math.PI - Math.acos(dir.y / 0.9), Math.atan2(dir.x, dir.z), 0]));
    });
  return merge(parts);
}

/** Self Learning — a form that built itself outward from one point. */
function spiral(): THREE.BufferGeometry {
  const turns = 2.4;
  const steps = 34;
  const points = Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    const a = t * Math.PI * 2 * turns;
    const r = 0.09 + t * 0.82;
    return V(Math.cos(a) * r, t * 0.7 - 0.35, Math.sin(a) * r);
  });
  const parts: THREE.BufferGeometry[] = [
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 44, 0.042, 5, false),
    at(new THREE.SphereGeometry(0.11, 10, 7), points[0].toArray()),
  ];
  return merge(parts);
}

const BUILDERS: Record<string, () => THREE.BufferGeometry> = {
  'ai-topics': lattice,
  databricks: strata,
  database: rings,
  'data-visualization': waveform,
  'data-visualization-project': scaffold,
  'web-mobile-application': panes,
  'ui-ux': layout,
  'backend-nextjs': conduit,
  linux: column,
  cybersecurity: shield,
  iot: emitters,
  git: branch,
  'group-project': mesh,
  devops: cycle,
  testing: assay,
  'self-learning-by-trainee-members': spiral,
};

/**
 * What each form is, in one line.
 *
 * Shown when a session is opened, so the metaphor is stated rather than left to
 * be guessed at — a form nobody can decode is decoration.
 */
export const SESSION_READING: Record<string, string> = {
  'ai-topics': 'nodes that keep re-linking as they settle',
  databricks: 'raw, refined and served — the layers stacked',
  database: 'rings of stored rows, indexed inward to the key',
  'data-visualization': 'a quantity given a shape the eye can follow',
  'data-visualization-project': 'that reading built into something load-bearing',
  'web-mobile-application': 'interface surfaces layered in depth',
  'ui-ux': 'one surface divided into unequal weights',
  'backend-nextjs': 'requests branching to whatever answers them',
  linux: 'a column of running blocks, ragged down the right',
  cybersecurity: 'overlapping plates — defence that holds by layering',
  iot: 'small devices, each announcing itself into the room',
  git: 'lines that diverge and rejoin',
  'group-project': 'a fabric no single person holds up',
  devops: 'a closed circuit that never stops going round',
  testing: 'probes converging on the thing under examination',
  'self-learning-by-trainee-members': 'a form that built itself outward from one point',
};

/**
 * How each form moves.
 *
 * Behaviour is part of the identity, not garnish: the strata barely shift, the
 * emitters turn as they broadcast, the cycle runs. Axes and rates are mutually
 * unrelated so a field of them never falls into step.
 */
export const SESSION_MOTION: Record<string, { axis: [number, number, number]; rate: number }> = {
  'ai-topics': { axis: [0.3, 1, 0.2], rate: 0.42 },
  databricks: { axis: [0, 1, 0], rate: 0.15 },
  database: { axis: [0, 1, 0], rate: 0.55 },
  'data-visualization': { axis: [0.1, 0.2, 1], rate: 0.28 },
  'data-visualization-project': { axis: [0, 1, 0.1], rate: 0.13 },
  'web-mobile-application': { axis: [0, 1, 0], rate: 0.22 },
  'ui-ux': { axis: [0, 1, 0], rate: 0.18 },
  'backend-nextjs': { axis: [0, 1, 0], rate: 0.34 },
  linux: { axis: [0, 1, 0], rate: 0.19 },
  cybersecurity: { axis: [0, 0, 1], rate: 0.26 },
  iot: { axis: [0.4, 1, 0], rate: 0.48 },
  git: { axis: [0, 1, 0], rate: 0.24 },
  'group-project': { axis: [0.2, 1, 0.2], rate: 0.3 },
  devops: { axis: [0, 1, 0], rate: 0.62 },
  testing: { axis: [0.5, 1, 0], rate: 0.2 },
  'self-learning-by-trainee-members': { axis: [0, 1, 0], rate: 0.36 },
};

export function buildSessionGeometry(classId: string): THREE.BufferGeometry {
  const builder = BUILDERS[classId];
  if (!builder) {
    throw new Error(
      `No form defined for session "${classId}". Every session needs its own; ` +
        'falling back to a generic shape is the failure this file exists to prevent.',
    );
  }
  return builder();
}
