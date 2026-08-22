/**
 * Spatial constants for the Tesseract structure, the environment and the camera.
 *
 * The nested-shell ratios are deliberate: an inner cube at exactly half the
 * outer half-size is the canonical perspective projection of a 4D hypercube
 * into 3D, which is what makes the structure read as dimensional rather than
 * as decorative boxes-inside-boxes.
 */

export interface ShellSpec {
  /** Half the edge length of the cube. */
  readonly half: number;
  /** Square cross-section of each of the twelve structural struts. */
  readonly strut: number;
  /** Cross-section of the eight corner nodes; always larger than the struts. */
  readonly node: number;
  /** Multiplier applied to emissive response, letting deeper shells recede. */
  readonly intensity: number;
}

/**
 * Outer, inner and ghost shells, ordered from largest to smallest.
 *
 * Strut cross-sections are deliberately generous. A member thin enough to read
 * as a line has no visible chamfer, and without a chamfer there is no travelling
 * specular highlight — which is the entire difference between machined structure
 * and a wireframe diagram.
 */
export const SHELLS: readonly ShellSpec[] = [
  { half: 5.0, strut: 0.3, node: 0.42, intensity: 1.0 },
  { half: 2.5, strut: 0.185, node: 0.27, intensity: 0.72 },
  { half: 1.25, strut: 0.1, node: 0.155, intensity: 0.35 },
] as const;

/** Bevel radius as a fraction of the strut cross-section. */
export const BEVEL_RATIO = 0.3;
export const BEVEL_SEGMENTS = 2;

/**
 * How a shell dissolves as the camera closes on it.
 *
 * The camera has to be able to move inside the structure to observe a person,
 * and a metal beam passing within a few centimetres of the lens fills the frame
 * and buries whatever it was sent to look at. Rather than keeping the camera
 * out, the members withdraw as it arrives: solid at arm's length, gone by the
 * time the camera would have passed through them.
 *
 * Measured from the nearest member of that shell, so the near side clears while
 * the far side of the same shell — which is what makes being *inside* the
 * tesseract legible — stays fully present.
 */
export const SHELL_FADE = {
  /** Distance at which a member has completely dissolved. */
  GONE: 0.9,
  /** Distance beyond which it is fully solid. */
  SOLID: 3.2,
} as const;

export const CONNECTIONS = {
  /** Line width in pixels for outer→inner dimensional links. */
  WIDTH_PRIMARY: 1,
  WIDTH_SECONDARY: 1,
  // Faint enough to be discovered rather than announced: the links should read
  // as an implication of the structure, not as drawn diagram edges.
  OPACITY_PRIMARY: 0.13,
  OPACITY_SECONDARY: 0.06,
  /** Points travelling the connection lines as an idle "signal". */
  SIGNAL_COUNT: 8,
  SIGNAL_SIZE: 0.09,
} as const;

export const CORE = {
  /** Camera-facing haze layers, largest last so they parallax against each other. */
  LAYERS: [
    { scale: 4.0, opacity: 0.15 },
    { scale: 7.0, opacity: 0.085 },
    { scale: 11.0, opacity: 0.05 },
  ],
} as const;

export const PARTICLES = {
  COUNT_LOW: 350,
  COUNT: 700,
  COUNT_HIGH: 1400,
  /**
   * Spherical shell the field occupies. The inner radius sits beyond the
   * camera's own orbit so particles never pass between the viewer and the
   * structure, where perspective would inflate them into foreground bokeh.
   */
  RADIUS_INNER: 30,
  RADIUS_OUTER: 62,
  /** Base point size before perspective attenuation. */
  SIZE: 1.1,
  /** Ceiling on rendered point size, in pixels; keeps particles as motes. */
  SIZE_MAX_PX: 2.6,
  // Cyan-white sits far brighter than the steel these once were, so the
  // opacities come down to compensate — the motes should register as
  // atmosphere at the edge of vision, never as a snowfall.
  OPACITY_MIN: 0.04,
  OPACITY_MAX: 0.13,
  /** Amplitude of the GPU-side drift, in world units. */
  DRIFT: 0.3,
} as const;

export const ATMOSPHERE = {
  /** Backdrop sphere radius; must sit beyond the particle field. */
  RADIUS: 140,
  /**
   * Exponential fog, tuned against the viewing distance rather than picked in
   * the abstract: enough that the far side of the structure recedes, far short
   * of the milkiness that would flatten the metal response.
   */
  FOG_DENSITY: 0.011,
} as const;

export const CAMERA = {
  /** Long-lens compression keeps the structure monumental rather than wide-angle toy-like. */
  FOV: 42,
  NEAR: 0.1,
  FAR: 200,
  /**
   * Opening framing, expressed spherically around the origin. The radius is set
   * so the outer shell's corner-to-corner diagonal sits inside the frame with
   * negative space around it — the structure should be observed, not crowded.
   */
  START_RADIUS: 26.5,
  START_POLAR_DEG: 68,
  START_AZIMUTH_DEG: -30,
  MIN_DISTANCE: 13,
  MAX_DISTANCE: 46,
  MIN_POLAR_DEG: 35,
  MAX_POLAR_DEG: 115,
  SMOOTH_TIME: 0.35,
  DRAGGING_SMOOTH_TIME: 0.12,
  DOLLY_SPEED: 0.4,
  ROTATE_SPEED: 0.5,
  /** Distance below which the solver stops chasing, so the camera settles dead still. */
  REST_THRESHOLD: 0.0015,

  /**
   * Where the opening move begins: further out, lower, and rotated away from
   * the resting framing, so the world is first seen whole and at a distance
   * before the camera settles into it.
   */
  // Must stay inside MAX_DISTANCE, or the clamp silently overrides it and the
  // opening begins somewhere other than where this says it does.
  ENTRY_RADIUS: 44,
  ENTRY_POLAR_DEG: 78,
  ENTRY_AZIMUTH_DEG: -52,

  /**
   * Smoothing times for scripted moves. camera-controls eases exponentially
   * toward its goal, so a larger value is a longer, heavier move — the opening
   * is the slowest thing the camera ever does, and returning to the overview
   * is quicker because the viewer has asked for it and is waiting.
   */
  ENTRY_SMOOTH_TIME: 1.45,
  RESET_SMOOTH_TIME: 0.75,
  FOCUS_SMOOTH_TIME: 0.85,

  /** Keyboard navigation rates, per second. */
  KEY_ROTATE_SPEED: 0.85,
  KEY_DOLLY_SPEED: 9,

  /**
   * Fraction of the frame a focused subject should occupy when the camera
   * frames it. Below 1 leaves air around the subject; at 1 it touches the
   * edges, which always reads as crowded.
   */
  FOCUS_FILL: 0.26,

  /**
   * Closest approach while a person is selected.
   *
   * The global near clamp keeps the camera outside the whole structure, but
   * observing one orb means coming inside it, so focusing relaxes the clamp to
   * this and the overview restores it. Still far enough out that the near plane
   * never cuts into the glass.
   */
  FOCUS_MIN_DISTANCE: 1.6,

  /**
   * How far a focused shot must stay from the world's centre.
   *
   * The camera is free to travel inside the tesseract: structural members
   * dissolve as it approaches them, so a beam in the way is no longer a reason
   * to hold the shot outside. This only keeps the lens clear of the very centre,
   * where the innermost shell and the volumetric core sit on top of each other.
   */
  FOCUS_MIN_ORIGIN_DISTANCE: 2.6,

  /** Clearance the camera keeps from any orb it is not looking at. */
  FOCUS_ORB_CLEARANCE: 1.1,
} as const;

/** Explicit draw order for the transparent, additively blended layers. */
export const RENDER_ORDER = {
  ATMOSPHERE: -1,
  FRAMES: 0,
  CONNECTIONS: 1,
  /** Halos are additive and must be laid down before the glass composites over them. */
  ORB_HALOS: 2,
  PROJECTS: 3,
  /** Skills sit inside the vessels, so they are drawn before the glass. */
  SKILLS: 4,
  ORBS: 5,
  CORE: 6,
  PARTICLES: 7,
} as const;
