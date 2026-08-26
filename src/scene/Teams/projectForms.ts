import * as THREE from 'three';

/**
 * The five projects, each drawn as a constellation.
 *
 * Points joined by lines, resolving into a figure you can actually read: a
 * rover on its wheels, a film drum beside its chip, a site under a crane. This
 * is the constellation idea taken literally — the eye is very good at finding a
 * known shape in scattered points, and far worse at reading meaning off an
 * abstract solid. A form the viewer has to be told about is decoration; one
 * they recognise is information.
 *
 * Every figure is built from what the project actually does, and each carries
 * its own colour. That is a deliberate reversal of the rule the session
 * artifacts follow, where colour would have been a legend to memorise: there
 * are five projects, not fifteen, they sit far apart in their own regions of
 * the layer, and each is already a distinct drawing — so colour here separates
 * five things the viewer can hold in their head at once rather than encoding a
 * key they would have to learn.
 */

export type MotionKind = 'ping' | 'orbit' | 'echo' | 'survey' | 'morph';

export interface ProjectForm {
  /** Bright points, one per vertex of the figure. */
  points: THREE.BufferGeometry;
  /** The lines between them. */
  lines: THREE.BufferGeometry;
  /** Geometry for the parts that move independently. */
  mover: THREE.BufferGeometry;
  movers: number;
  kind: MotionKind;
  colour: string;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * Collects a figure as vertices and the segments between them.
 *
 * Every segment carries how far from the core it starts, so the figure can draw
 * itself outward from the centre instead of appearing whole — which is what
 * makes the project read as something the team built rather than something that
 * was always there.
 */
function figure() {
  const nodes: THREE.Vector3[] = [];
  const edges: [THREE.Vector3, THREE.Vector3][] = [];

  const api = {
    /** A vertex the eye should see as a point of the constellation. */
    node(...points: THREE.Vector3[]) {
      nodes.push(...points);
      return api;
    },
    /** An open path through the given points, marking each as a node. */
    path(points: THREE.Vector3[], mark = true) {
      if (mark) nodes.push(...points);
      for (let i = 0; i < points.length - 1; i++) edges.push([points[i], points[i + 1]]);
      return api;
    },
    /** A closed loop. */
    loop(points: THREE.Vector3[], mark = true) {
      api.path(points, mark);
      if (points.length > 1) edges.push([points[points.length - 1], points[0]]);
      return api;
    },
    /** A single segment, marking neither end. */
    link(a: THREE.Vector3, b: THREE.Vector3) {
      edges.push([a, b]);
      return api;
    },
    build(colour: string, mover: THREE.BufferGeometry, movers: number, kind: MotionKind): ProjectForm {
      const furthest = Math.max(
        0.001,
        ...edges.flat().map((p) => p.length()),
        ...nodes.map((p) => p.length()),
      );

      const pointPositions = new Float32Array(nodes.length * 3);
      const pointOrder = new Float32Array(nodes.length);
      nodes.forEach((p, i) => {
        pointPositions.set([p.x, p.y, p.z], i * 3);
        pointOrder[i] = p.length() / furthest;
      });

      const linePositions = new Float32Array(edges.length * 2 * 3);
      const lineOrder = new Float32Array(edges.length * 2);
      edges.forEach(([a, b], i) => {
        linePositions.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
        // Both ends share the near end's distance, so a segment appears as one
        // stroke rather than growing out of itself.
        const order = Math.min(a.length(), b.length()) / furthest;
        lineOrder[i * 2] = order;
        lineOrder[i * 2 + 1] = order;
      });

      const points = new THREE.BufferGeometry();
      points.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3));
      points.setAttribute('aOrder', new THREE.BufferAttribute(pointOrder, 1));
      points.computeBoundingSphere();

      const lines = new THREE.BufferGeometry();
      lines.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
      lines.setAttribute('aOrder', new THREE.BufferAttribute(lineOrder, 1));
      lines.computeBoundingSphere();

      return { points, lines, mover, movers, kind, colour };
    },
  };
  return api;
}

/** A regular ring of points on a plane, for wheels, reels and ripples. */
function ring(
  centre: THREE.Vector3,
  radius: number,
  count: number,
  plane: 'xy' | 'xz' | 'yz',
): THREE.Vector3[] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    const u = Math.cos(a) * radius;
    const v = Math.sin(a) * radius;
    if (plane === 'xy') return V(centre.x + u, centre.y + v, centre.z);
    if (plane === 'xz') return V(centre.x + u, centre.y, centre.z + v);
    return V(centre.x, centre.y + u, centre.z + v);
  });
}

/* ------------------------------------------------------------------ *
 * 1. AR Car Rover — a vehicle on wheels, sensing ahead
 * ------------------------------------------------------------------ */

function rover(): ProjectForm {
  const f = figure();

  // Chassis: a flat box you read as a body with a front and a back.
  const top = [V(-0.5, 0.14, -0.3), V(0.5, 0.14, -0.3), V(0.5, 0.14, 0.3), V(-0.5, 0.14, 0.3)];
  const bottom = top.map((p) => V(p.x, -0.06, p.z));
  f.loop(top).loop(bottom);
  top.forEach((p, i) => f.link(p, bottom[i]));

  // Four wheels, and the axles reaching them. Hexagons read as wheels at this
  // scale where a smooth circle just reads as a blob.
  ([[-0.34, -0.32], [0.34, -0.32], [-0.34, 0.32], [0.34, 0.32]] as const).forEach(
    ([x, z]) => {
      const hub = V(x, -0.24, z);
      f.loop(ring(hub, 0.17, 6, 'xy'), false).node(hub);
      f.link(V(x, -0.06, z), hub);
    },
  );

  // Mast and sensor head: the thing that looks where it is going.
  const mastFoot = V(0.1, 0.14, 0);
  const mastTop = V(0.1, 0.6, 0);
  f.path([mastFoot, mastTop]);
  f.loop(ring(mastTop, 0.1, 4, 'xz'), false);

  // The sensor itself, at the front, where the pings leave from.
  f.node(V(0.56, 0.06, 0));
  f.link(V(0.5, 0.06, 0), V(0.56, 0.06, 0));

  return f.build(
    '#5ec8f5',
    // Wavefronts leaving the sensor.
    new THREE.TorusGeometry(0.2, 0.008, 4, 14, Math.PI * 0.7),
    3,
    'ping',
  );
}

/* ------------------------------------------------------------------ *
 * 2. AI Companion & Movie Studio — a film drum beside its intelligence
 * ------------------------------------------------------------------ */

function companion(): ProjectForm {
  const f = figure();

  // The reel: two rings joined into a drum, with spokes across the near face.
  const front = ring(V(0, 0.16, 0.2), 0.44, 12, 'xy');
  const back = ring(V(0, 0.16, -0.2), 0.44, 12, 'xy');
  f.loop(front).loop(back, false);
  front.forEach((p, i) => {
    if (i % 2 === 0) f.link(p, back[i]);
  });
  const hub = V(0, 0.16, 0.2);
  f.node(hub);
  front.forEach((p, i) => {
    if (i % 3 === 0) f.link(hub, p);
  });

  // The chip below it: a square with pins, which is what says "intelligence"
  // rather than "projector".
  const chip = [V(-0.26, -0.5, 0), V(0.26, -0.5, 0), V(0.26, -0.24, 0), V(-0.26, -0.24, 0)];
  f.loop(chip);
  ([-0.16, 0, 0.16] as const).forEach((x) => {
    f.link(V(x, -0.5, 0), V(x, -0.62, 0));
    f.node(V(x, -0.62, 0));
    f.link(V(x, -0.24, 0), V(x, -0.12, 0));
    f.node(V(x, -0.12, 0));
  });

  return f.build(
    '#b98cff',
    // The exchange circling the intelligence.
    new THREE.OctahedronGeometry(0.05, 0),
    5,
    'orbit',
  );
}

/* ------------------------------------------------------------------ *
 * 3. VividEcho — a memory, and the rings of place around it
 * ------------------------------------------------------------------ */

function echo(): ProjectForm {
  const f = figure();

  // Rings stacked in depth, widest at the bottom: a thing remembered, and the
  // rooms it keeps returning through.
  ([
    { y: -0.34, r: 0.58 },
    { y: -0.06, r: 0.44 },
    { y: 0.2, r: 0.28 },
  ] as const).forEach((level, i) => {
    const points = ring(V(0, level.y, 0), level.r, 12, 'xz');
    f.loop(points, i === 0);
    // A few uprights tying each ring to the one above, so the stack reads as
    // one structure rather than three separate hoops.
    points.forEach((p, j) => {
      if (j % 4 === 0) f.link(p, V(p.x * 0.72, level.y + 0.26, p.z * 0.72));
    });
  });

  // The axis the memory sits on.
  f.path([V(0, -0.5, 0), V(0, 0.52, 0)]);

  return f.build(
    '#7cf2a4',
    // Shells leaving and fading: the echo itself.
    new THREE.TorusGeometry(0.36, 0.007, 4, 20),
    3,
    'echo',
  );
}

/* ------------------------------------------------------------------ *
 * 4. AeroTwin — a site rising, under something surveying it
 * ------------------------------------------------------------------ */

function aerotwin(): ProjectForm {
  const f = figure();

  // A structure going up in stages, narrowing as it rises.
  const levels = [
    { y: -0.46, half: 0.44 },
    { y: -0.14, half: 0.34 },
    { y: 0.18, half: 0.22 },
    { y: 0.44, half: 0.12 },
  ];
  const rings = levels.map((level) => [
    V(-level.half, level.y, -level.half),
    V(level.half, level.y, -level.half),
    V(level.half, level.y, level.half),
    V(-level.half, level.y, level.half),
  ]);
  rings.forEach((corners, i) => f.loop(corners, i === 0 || i === rings.length - 1));
  for (let i = 0; i < rings.length - 1; i++) {
    rings[i].forEach((p, c) => f.link(p, rings[i + 1][c]));
  }

  // The crane: a mast beside the structure, a jib over it, and the hook.
  const craneFoot = V(0.66, -0.46, 0.2);
  const craneTop = V(0.66, 0.66, 0.2);
  f.path([craneFoot, craneTop]);
  const jibEnd = V(-0.1, 0.66, 0.2);
  f.path([craneTop, jibEnd]);
  f.link(jibEnd, V(-0.1, 0.34, 0.2));
  f.node(V(-0.1, 0.34, 0.2));
  // The counter-jib, without which it reads as a flagpole.
  f.path([craneTop, V(0.92, 0.54, 0.2)]);

  return f.build(
    '#ffc25c',
    // The drone, circling what it is watching.
    new THREE.TorusGeometry(0.05, 0.008, 4, 8),
    4,
    'survey',
  );
}

/* ------------------------------------------------------------------ *
 * 5. VibeSync — a field that keeps reshaping itself
 * ------------------------------------------------------------------ */

function vibesync(): ProjectForm {
  const f = figure();

  // Layers of wave, each at its own phase, so the figure never settles into a
  // pattern the eye can call finished.
  const steps = 13;
  ([
    { y: 0.28, amp: 0.16, phase: 0 },
    { y: 0.02, amp: 0.22, phase: 1.1 },
    { y: -0.24, amp: 0.14, phase: 2.3 },
  ] as const).forEach((layer, i) => {
    const points = Array.from({ length: steps }, (_, s) => {
      const t = s / (steps - 1);
      return V(
        t * 1.2 - 0.6,
        layer.y + Math.sin(t * Math.PI * 2.2 + layer.phase) * layer.amp,
        Math.cos(t * Math.PI * 1.4 + layer.phase) * 0.18,
      );
    });
    f.path(points, false);
    // Only the crests are marked, so the constellation has points to read
    // rather than a dotted line.
    if (i !== 1) f.node(points[3], points[9]);
    else f.node(points[0], points[6], points[steps - 1]);
  });

  // The reading underneath: an equaliser, which is what mood looks like when a
  // machine has measured it.
  ([-0.4, -0.2, 0, 0.2, 0.4] as const).forEach((x, i) => {
    const h = [0.12, 0.26, 0.18, 0.32, 0.14][i];
    f.path([V(x, -0.52, 0), V(x, -0.52 + h, 0)]);
  });

  return f.build(
    '#4fe6d2',
    // Bands riding the wave, always reforming.
    new THREE.BoxGeometry(0.26, 0.014, 0.04),
    10,
    'morph',
  );
}

const BUILDERS: Record<string, () => ProjectForm> = {
  'ar-robot': rover,
  'ai-companion': companion,
  'vivid-echo': echo,
  'twinz-360': aerotwin,
  vibesync,
};

export function buildProjectForm(projectId: string): ProjectForm {
  const builder = BUILDERS[projectId];
  if (!builder) {
    throw new Error(
      `No figure defined for project "${projectId}". Every project needs one it ` +
        'can be recognised by; a shared shape is the failure this file prevents.',
    );
  }
  return builder();
}

/** Seconds each figure takes to draw itself, outward from its core. */
export const PROJECT_ASSEMBLY: Record<string, number> = {
  'ar-robot': 2.2,
  'ai-companion': 2.6,
  'vivid-echo': 3.2,
  'twinz-360': 3.0,
  vibesync: 2.0,
};
