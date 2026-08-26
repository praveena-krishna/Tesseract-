import * as THREE from 'three';

/**
 * What each team built, drawn as a structure their own members hold up.
 *
 * Every one of these is anchored at the real positions of that team's people:
 * the outermost vertices are the member orbs themselves, and every edge runs
 * inward from there to the core. So the structure is not an object that happens
 * to be floating among the team — it is visibly the thing those particular
 * people are making, and it cannot exist without them standing where they
 * stand.
 *
 * Each is built from what the project actually is rather than from a shape
 * chosen to look technical. A scanner that sweeps ahead of itself, an aperture
 * closing on what it is looking at, rings of places returning to one memory, a
 * structure and its exact twin, a shell that will not hold a form. None of them
 * is an icon of the product; each is the idea behind it, in structure.
 */

export interface ProjectStructure {
  /** Bright vertices — the joints of the structure. */
  points: THREE.BufferGeometry;
  /** The members between them. */
  lines: THREE.BufferGeometry;
  /** How far out the whole thing reaches, in member-standoff units. */
  reach: number;
  colour: string;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * Collects a structure as vertices and the members between them.
 *
 * Every edge records how far from the core it begins, so the structure can
 * assemble from the outside in — from the people toward the thing they are
 * making — instead of appearing whole.
 */
function frame() {
  const nodes: THREE.Vector3[] = [];
  const edges: [THREE.Vector3, THREE.Vector3][] = [];

  const api = {
    node(...points: THREE.Vector3[]) {
      nodes.push(...points);
      return api;
    },
    path(points: THREE.Vector3[], mark = true) {
      if (mark) nodes.push(...points);
      for (let i = 0; i < points.length - 1; i++) edges.push([points[i], points[i + 1]]);
      return api;
    },
    loop(points: THREE.Vector3[], mark = true) {
      api.path(points, mark);
      if (points.length > 1) edges.push([points[points.length - 1], points[0]]);
      return api;
    },
    link(a: THREE.Vector3, b: THREE.Vector3) {
      edges.push([a, b]);
      return api;
    },
    build(colour: string): ProjectStructure {
      const reach = Math.max(
        0.001,
        ...edges.flat().map((p) => p.length()),
        ...nodes.map((p) => p.length()),
      );

      const pointPositions = new Float32Array(nodes.length * 3);
      const pointOrder = new Float32Array(nodes.length);
      nodes.forEach((p, i) => {
        pointPositions.set([p.x, p.y, p.z], i * 3);
        // Assembly runs inward: the far end, where the people are, resolves
        // first, and the core is the last thing to exist.
        pointOrder[i] = 1 - p.length() / reach;
      });

      const linePositions = new Float32Array(edges.length * 2 * 3);
      const lineOrder = new Float32Array(edges.length * 2);
      edges.forEach(([a, b], i) => {
        linePositions.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
        const order = 1 - Math.max(a.length(), b.length()) / reach;
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

      return { points, lines, reach, colour };
    },
  };
  return api;
}

/**
 * Where this team's people stand, in the structure's own frame.
 *
 * Mirrors how the simulation seats members around their core, so a structure
 * anchored on these points meets the actual orbs rather than nearly meeting
 * them — which would read as a near miss and undo the whole claim.
 */
export function memberAnchors(count: number): THREE.Vector3[] {
  const offset = count === 4 ? Math.PI / 4 : Math.PI / 2;
  return Array.from({ length: count }, (_, i) => {
    const angle = offset + (i / count) * Math.PI * 2;
    return V(Math.cos(angle), Math.sin(angle), (i % 2 === 0 ? 1 : -1) * 0.18);
  });
}

/** A ring of points about the core, on a plane tilted off the vertical. */
function ring(radius: number, count: number, tilt = 0, spin = 0): THREE.Vector3[] {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, spin, 0));
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return V(Math.cos(a) * radius, Math.sin(a) * radius, 0).applyQuaternion(q);
  });
}

/** An open arc about the core, facing a heading. */
function sweep(radius: number, half: number, heading: number, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const a = heading - half + ((half * 2) * i) / (count - 1);
    return V(Math.cos(a) * radius, Math.sin(a) * radius, 0);
  });
}

/**
 * A run of points along a line, so a long member reads as a row of stars
 * rather than as a drawn stroke.
 */
function span(a: THREE.Vector3, b: THREE.Vector3, steps: number): THREE.Vector3[] {
  return Array.from({ length: steps }, (_, i) =>
    a.clone().lerp(b, i / (steps - 1)),
  );
}

/** A flat grid standing up to face the viewer, as a backdrop of stars. */
function grid(halfX: number, halfY: number, cols: number, rows: number, z: number) {
  const columns: THREE.Vector3[][] = [];
  for (let c = 0; c < cols; c++) {
    const x = -halfX + (2 * halfX * c) / (cols - 1);
    columns.push(
      Array.from({ length: rows }, (_, r) =>
        V(x, -halfY + (2 * halfY * r) / (rows - 1), z),
      ),
    );
  }
  return columns;
}

/**
 * A wheel drawn face-on: rim, hub, and the spokes between them.
 *
 * Face-on and not edge-on, because the layer is looked into almost level and a
 * wheel lying in the horizontal plane is a horizontal bar.
 */
function wheel(f: ReturnType<typeof frame>, centre: THREE.Vector3, radius: number) {
  const rim = ring(radius, 12).map((p) => V(p.x + centre.x, p.y + centre.y, centre.z));
  const hub = ring(radius * 0.34, 6).map((p) => V(p.x + centre.x, p.y + centre.y, centre.z));
  f.loop(rim, false).loop(hub, false).node(centre);
  rim.forEach((p, i) => {
    if (i % 3 === 0) f.link(p, hub[(i / 3) % hub.length]);
  });
}

/* ------------------------------------------------------------------ *
 * 1. AR Car Rover — ultrasonic sensing rover
 * ------------------------------------------------------------------ */

function scanner(anchors: THREE.Vector3[]): ProjectStructure {
  const f = frame();

  // Drawn as an elevation, the way the reference draws it. Depth is what was
  // destroying this figure: four wheels set fore and aft collapse into two
  // smudges when the layer is looked into almost level, and a rover with two
  // smudges under it is not a rover.
  const body = [
    V(-0.66, 0.02, 0),
    V(-0.52, 0.26, 0),
    V(0.44, 0.26, 0),
    V(0.66, 0.06, 0),
    V(0.6, -0.1, 0),
    V(-0.62, -0.1, 0),
  ];
  f.loop(body);
  // A deck line across the body, so it reads as a vehicle with a top rather
  // than as a closed outline.
  f.path([V(-0.52, 0.12, 0), V(0.5, 0.12, 0)], false);

  // Four wheels in a row, each a real wheel: rim, hub, spokes. Four across
  // reads as a rover; two reads as a cart.
  ([-0.46, -0.16, 0.16, 0.46] as const).forEach((x) => {
    wheel(f, V(x, -0.34, 0), 0.17);
    f.path([V(x, -0.1, 0), V(x, -0.34, 0)], false);
  });
  f.path([V(-0.72, -0.52, 0), V(0.72, -0.52, 0)], false);

  // The mast, and the head that does the looking.
  f.path(span(V(-0.28, 0.26, 0), V(-0.28, 0.74, 0), 3));
  f.loop(ring(0.12, 6).map((p) => V(p.x - 0.28, p.y + 0.8, p.z)), false);
  f.path([V(-0.28, 0.74, 0), V(-0.16, 0.86, 0)], false);

  // The sensor at the front, and the three wavefronts leaving it.
  f.node(V(0.66, 0.06, 0));
  ([0.86, 1.02, 1.18] as const).forEach((r, i) => {
    f.path(sweep(r, 0.36 + i * 0.04, 0.06, 9), false);
  });

  anchors.forEach((a) => {
    f.node(a);
    f.path(span(a, V(0, 0, 0), 3), false);
  });

  return f.build('#5ec8f5');
}

/* ------------------------------------------------------------------ *
 * 2. AI Companion & Movie Studio — an AI core inside a cinematic universe
 * ------------------------------------------------------------------ */

function aperture(anchors: THREE.Vector3[]): ProjectStructure {
  const f = frame();

  // The reel, face-on: rim, inner rim, and the round windows a film reel has.
  // The windows are the detail that makes it a reel and not a wheel.
  f.loop(ring(0.62, 20), false);
  f.loop(ring(0.52, 20), false);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const c = V(Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0);
    f.loop(ring(0.13, 8).map((p) => V(p.x + c.x, p.y + c.y, 0)), false);
    f.node(c);
  }
  f.loop(ring(0.16, 8), false);

  // The chip it thinks with, below the reel, with its legs out both sides.
  const chip = [V(-0.3, -1.0, 0), V(0.3, -1.0, 0), V(0.3, -0.72, 0), V(-0.3, -0.72, 0)];
  f.loop(chip);
  f.loop([V(-0.17, -0.9, 0), V(0.17, -0.9, 0), V(0.17, -0.82, 0), V(-0.17, -0.82, 0)], false);
  ([-0.2, -0.07, 0.07, 0.2] as const).forEach((x) => {
    f.path([V(x, -1.0, 0), V(x, -1.12, 0)], false);
    f.path([V(x, -0.72, 0), V(x, -0.62, 0)], false);
  });
  ([-0.94, -0.86, -0.78] as const).forEach((y) => {
    f.path([V(-0.3, y, 0), V(-0.42, y, 0)], false);
    f.path([V(0.3, y, 0), V(0.42, y, 0)], false);
  });
  f.path([V(0, -0.72, 0), V(0, -0.62, 0)], false);

  // Two frames either side: the studio the intelligence works in.
  ([-1, 1] as const).forEach((side) => {
    const cx = side * 1.02;
    f.loop([V(cx - 0.2, -0.16, 0), V(cx + 0.2, -0.16, 0), V(cx + 0.2, 0.16, 0), V(cx - 0.2, 0.16, 0)]);
    f.loop([V(cx - 0.07, -0.08, 0), V(cx + 0.09, 0, 0), V(cx - 0.07, 0.08, 0)], false);
    ([-0.16, 0.16] as const).forEach((y) => {
      ([-0.13, 0, 0.13] as const).forEach((x) => f.path([V(cx + x, y, 0), V(cx + x, y + (y < 0 ? -0.05 : 0.05), 0)], false));
    });
  });

  anchors.forEach((a) => {
    f.node(a);
    f.path(span(a, V(0, 0, 0), 3), false);
  });

  return f.build('#b98cff');
}

/* ------------------------------------------------------------------ *
 * 3. VividEcho — spatial memory, and the echo of the places it was left in
 * ------------------------------------------------------------------ */

function places(anchors: THREE.Vector3[]): ProjectStructure {
  const f = frame();

  // The lattice of space it maps, standing up behind the memory.
  const columns = grid(0.86, 0.62, 7, 5, -0.2);
  columns.forEach((col, c) => {
    f.path(col, c === 0 || c === 6);
    if (c > 0) columns[c - 1].forEach((p, r) => f.link(p, col[r]));
  });

  // The echo: rings widening below, each one further out and flatter.
  ([0.3, 0.5, 0.72, 0.96] as const).forEach((r, i) => {
    f.loop(ring(r, 20).map((p) => V(p.x, p.y * 0.3 - 0.5 - i * 0.09, p.z * 0.5)), i === 0);
  });

  // The memory stacked above the place it belongs to: diamonds on a spine,
  // narrowing as they rise.
  f.path(span(V(0, 0.16, 0), V(0, 1.0, 0), 4), false);
  ([0.4, 0.62, 0.84] as const).forEach((y, i) => {
    const r = 0.22 - i * 0.05;
    f.loop([V(-r, y, 0), V(0, y + r * 0.5, 0), V(r, y, 0), V(0, y - r * 0.5, 0)], i === 0);
  });

  anchors.forEach((a) => {
    f.node(a);
    f.path(span(a, V(0, 0, 0), 3), false);
  });

  return f.build('#7cf2a4');
}

/* ------------------------------------------------------------------ *
 * 4. AeroTwin — a digital twin of a site, and the crane still building it
 * ------------------------------------------------------------------ */

function twin(anchors: THREE.Vector3[]): ProjectStructure {
  const f = frame();

  // The site it stands on.
  const plan = grid(1.0, 0.24, 8, 3, 0);
  plan.forEach((col, c) => {
    const laid = col.map((p) => V(p.x, -0.78 + p.y * 0.5, p.y * 1.4));
    f.path(laid, c === 0 || c === 7);
    if (c > 0) plan[c - 1].map((p) => V(p.x, -0.78 + p.y * 0.5, p.y * 1.4))
      .forEach((p, r) => f.link(p, laid[r]));
  });

  // The building: floors narrowing as they rise, braced across each storey so
  // it reads as architecture rather than as a stack of boxes.
  const floors = [0.5, 0.42, 0.34, 0.26, 0.17];
  let previous: THREE.Vector3[] | null = null;
  floors.forEach((half, i) => {
    const y = -0.6 + i * 0.3;
    const plate = [V(-half, y, 0), V(half, y, 0)];
    f.path(plate, i === floors.length - 1);
    if (previous) {
      f.link(previous[0], plate[0]);
      f.link(previous[1], plate[1]);
      f.link(previous[0], plate[1]);
      f.link(previous[1], plate[0]);
    }
    previous = plate;
  });
  f.path([V(-0.17, 0.6, 0), V(0, 0.78, 0), V(0.17, 0.6, 0)], false);

  // The crane beside it: mast, jib out over the building, counter-jib, and the
  // hook line hanging where the work is.
  f.path(span(V(0.86, -0.7, 0), V(0.86, 0.92, 0), 5));
  f.path([V(0.34, 0.92, 0), V(1.06, 0.92, 0)], false);
  f.path([V(0.86, 1.06, 0), V(0.44, 0.92, 0)], false);
  f.path([V(0.86, 1.06, 0), V(1.02, 0.92, 0)], false);
  f.path([V(0.86, 0.92, 0), V(0.86, 1.06, 0)], false);
  f.path([V(0.5, 0.92, 0), V(0.5, 0.5, 0)], false);
  f.node(V(0.5, 0.5, 0));

  anchors.forEach((a) => {
    f.node(a);
    f.path(span(a, V(0, 0, 0), 3), false);
  });

  return f.build('#ffc25c');
}

/* ------------------------------------------------------------------ *
 * 5. VibeSync — adaptive flow, reshaping to the mood it reads
 * ------------------------------------------------------------------ */

function shell(anchors: THREE.Vector3[]): ProjectStructure {
  const f = frame();

  // The flow above: layers of wave, each at its own phase, so the surface never
  // settles into a pattern the eye can call finished.
  const steps = 17;
  ([
    { y: 0.86, amp: 0.13, phase: 0 },
    { y: 0.64, amp: 0.19, phase: 1.2 },
    { y: 0.44, amp: 0.15, phase: 2.4 },
  ] as const).forEach((layer, i) => {
    const wave = Array.from({ length: steps }, (_, k) => {
      const t = (k / (steps - 1)) * 2 - 1;
      return V(t * 1.04, layer.y + Math.sin(t * 4.2 + layer.phase) * layer.amp, 0);
    });
    f.path(wave, i === 1);
  });

  // The platform it reforms on.
  ([0.96, 0.7] as const).forEach((r, i) => {
    f.loop(ring(r, 22).map((p) => V(p.x, p.y * 0.2 - 0.4, p.z * 0.5)), i === 0);
  });

  // The reading underneath: an equaliser, which is what mood looks like once a
  // machine has measured it.
  const base = -0.72;
  ([-0.5, -0.34, -0.18, -0.02, 0.14, 0.3, 0.46] as const).forEach((x, i) => {
    const h = [0.1, 0.22, 0.14, 0.3, 0.18, 0.26, 0.12][i];
    f.path([V(x, base, 0), V(x, base + h, 0)]);
  });
  f.path([V(-0.58, base, 0), V(0.54, base, 0)], false);

  anchors.forEach((a) => {
    f.node(a);
    f.path(span(a, V(0, 0, 0), 3), false);
  });

  return f.build('#4fe6d2');
}

const BUILDERS: Record<string, (anchors: THREE.Vector3[]) => ProjectStructure> = {
  'ar-robot': scanner,
  'ai-companion': aperture,
  'vivid-echo': places,
  'twinz-360': twin,
  vibesync: shell,
};

export function buildProjectStructure(
  projectId: string,
  memberCount: number,
): ProjectStructure {
  const builder = BUILDERS[projectId];
  if (!builder) {
    throw new Error(
      `No structure defined for project "${projectId}". Every project needs one ` +
        'of its own; a shared structure is the failure this file prevents.',
    );
  }
  return builder(memberAnchors(memberCount));
}
