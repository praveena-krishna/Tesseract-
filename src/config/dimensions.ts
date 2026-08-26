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
  GONE: 0.3,
  /** Distance beyond which it is fully solid. */
  SOLID: 1.1,
} as const;

/**
 * The dimensional layers.
 *
 * The three nested shells are the three months, and time runs *outward*: the
 * innermost box is Month 1, the middle is Month 2, the outer is Month 3. The
 * training starts small and contained and expands, so the structure grows with
 * it — which also means the box the viewer enters first is the one they have to
 * travel deepest to reach.
 *
 * Only Month 1 is wired so far. Reaching the outer two is a different problem
 * and deliberately not solved here.
 */
export const DIMENSION = {
  /**
   * Shell index for each month, innermost first.
   *
   * `SHELLS` is ordered largest to smallest, so this is its reverse: Month 1
   * is shell 2 (half 1.25), Month 2 is shell 1, Month 3 is shell 0.
   */
  SHELL_OF_MONTH: [2, 1, 0] as readonly number[],

  /**
   * Where the camera settles once it is inside a layer.
   *
   * Far enough back that the Month 1 box is visible *as a box* with the sixteen
   * people inside it. This is the whole point of the layer and it is in tension
   * with putting the lens literally within the chamber: the box is two and a
   * half units across, so from inside it overflows the frame entirely and stops
   * reading as a container at all — you see people and some passing beams, and
   * nothing tells you they are held by anything.
   *
   * From here the Month 1 box frames the population, the Month 2 box frames
   * that, and the nesting says what the layer means. The viewer is well within
   * the tesseract and can push further in whenever they want.
   */
  /**
   * Expressed as a multiple of the layer's own half size rather than as a fixed
   * distance, because the layers are nested and differ in scale. Month 2's box
   * is twice Month 1's, so a distance that frames one crowds the other. One
   * factor keeps every month framed identically, which is also what makes the
   * two comparable: the same person occupies the same fraction of the frame
   * whichever month you are standing in.
   */
  INSIDE_RADIUS_FACTOR: 3.52,
  /**
   * Near clamp while inside, also relative to the layer, so the viewer can push
   * right into any chamber without the clamp meaning something different in
   * each.
   */
  INSIDE_MIN_DISTANCE_FACTOR: 0.96,

  /**
   * How far the bearing swings during the passage.
   *
   * Without it the move is a zoom, and a zoom is the one thing this transition
   * must not read as. Swinging the approach turns it into travel through a
   * space that keeps revealing itself.
   */
  ENTER_AZIMUTH_SHIFT_DEG: 18,
  ENTER_POLAR_SHIFT_DEG: -4,

  /**
   * The bearing a layer settles on when its contents are laid out on a plane.
   *
   * Month 2 arranges its five teams across a flat composition, and a
   * composition only reads from the side it was composed for — arrive on the
   * bearing you happened to be orbiting from and two of the zones sit behind
   * two others. Very slightly off square, so the world still has depth and the
   * viewer can see they are free to turn it.
   */
  PLANAR_AZIMUTH_DEG: 8,
  PLANAR_POLAR_DEG: 84,
  /** Smoothing for the passage. The slowest deliberate move in the piece. */
  ENTER_SMOOTH_TIME: 1.5,
  EXIT_SMOOTH_TIME: 1.0,

  /**
   * How the layer answers the pointer, above its resting values.
   *
   * Held down deliberately. The joints are the only geometry in the scene meant
   * to cross the bloom threshold, so a generous hover pushes them straight to
   * flat white and the layer stops reading as metal being lit and starts
   * reading as a control being highlighted.
   */
  HOVER_FRESNEL: 0.24,
  HOVER_NODE_EMISSIVE: 0.26,
  /** Seconds for the layer to reach a new hover state. */
  HOVER_EASE: 0.3,

  /**
   * How the layer the viewer is inside asserts itself, and how far the other
   * two recede.
   *
   * Needed because the shells were built as a nest, with each one thinner and
   * dimmer than the last so the eye reads depth. That works from outside and
   * fails the moment a month means something: Month 1 is the innermost shell,
   * so it is also the faintest, and the box actually holding the people ends up
   * the least visible thing in the shot while Month 2 frames it and looks like
   * the container. Lighting the entered layer up and pulling the others back
   * restores the hierarchy without touching the geometry.
   */
  ENTERED_FRESNEL: 0.3,
  ENTERED_NODE_EMISSIVE: 0.34,
  /** What the layers you are not in fall to. Never zero — they still exist. */
  DORMANT: 0.45,

  /**
   * What a layer *inside* the one being occupied shrinks to.
   *
   * The boxes are concentric, so a smaller layer sits in the middle of the one
   * you have entered — physically in the way of its people. Month 2's teams
   * settle at a radius that falls right on Month 1's boundary, which made the
   * formation look like it was happening inside Month 1 rather than in Month 2.
   *
   * Dimming alone did not solve it: a dim box in the middle of the space is
   * still a box in the middle of the space. The inner layer withdraws to a
   * remnant at the centre instead — small enough to leave the room clear,
   * present enough to say that month is still there, behind.
   *
   * Only inward. Layers larger than the one you are in are the structure you
   * are standing inside, and shrinking those would collapse them onto you.
   */
  RECEDED_SCALE: 0.18,

  /** Peak distortion at the midpoint of the passage. */
  SURGE_ABERRATION: 0.0022,
  SURGE_BLOOM: 0.5,
  SURGE_VIGNETTE: 0.22,
} as const;

/**
 * The bonds drawn between teammates as they gather.
 *
 * Left out of the collaboration layer on purpose at first — a line asserts a
 * relationship, while being pulled across a room demonstrates one, and the
 * demonstration is the better argument. They earn their place only because five
 * formations overlap in projection at any single viewing angle, and when they
 * do the eye cannot separate them by position alone.
 *
 * So the bond is a consequence, never a claim: its strength is read from how
 * close the simulation has actually brought two people, which means it can only
 * ever confirm what the movement already showed.
 */
export const BONDS = {
  /** The month whose story is collaboration. */
  MONTH: 1,
  /**
   * Distance at which a bond is fully resolved.
   *
   * Measured from a settled member out to their own project, which is a radius
   * where the earlier member-to-member version measured a diameter — so both
   * thresholds are roughly half what they were. Left at the old values the
   * spokes were already half-drawn while people were still crossing the layer,
   * which is precisely the claim they must not make.
   *
   * There is no risk of overstating anything: a spoke has a team at both ends
   * by construction, so the threshold decides how firmly a real relationship is
   * drawn, never whether a false one appears.
   */
  NEAR: 0.72,
  /** Distance beyond which a person has nothing joining them to anything. */
  FAR: 1.3,
  /** How far a spoke bows. Enough to have depth, not enough to draw attention. */
  BOW: 0.11,
  /**
   * Peak brightness along a spoke. Very quiet by design: these are the least
   * important thing on screen, present only to say which project a person
   * belongs to, and a bright line between two objects always reads as more
   * important than either of them.
   */
  BRIGHTNESS: 0.26,
  /** Seconds for a bond to resolve or let go. */
  EASE: 0.7,
} as const;

/**
 * The artifact each team built, standing at the centre of that team.
 *
 * Sized against the space a settled team leaves in its middle: large enough to
 * be read as an object with structure, small enough that the people who built
 * it still surround it rather than being pushed to the edge of their own
 * formation.
 */
export const PROJECTS_CONFIG = {
  /**
   * World size of a fully drawn figure.
   *
   * Sized from the room actually available rather than from how much of the
   * figure one would like to see. The members ring their project at a fixed
   * standoff, and the nearest orb *surface* is nearer still — at any larger
   * scale the drawing runs into the glass and the two read as one tangled
   * object, which loses both. The people are the subject; this sits behind and
   * between them.
   */
  SCALE: 0.18,
  /** The solid core the figure radiates from. Second only to the people. */
  CORE_RADIUS: 0.16,
  /** Point size before distance attenuation, in pixel-units. */
  POINT_SIZE: 12,
  /** Resting emissive, and what attention adds. */
  EMISSIVE: 0.85,
  HOVER_EMISSIVE: 0.7,
  /** How much the whole artifact swells when attended to. Felt, not seen. */
  HOVER_SWELL: 0.14,
  /**
   * How much it swells again when the world is about projects.
   *
   * Even at its most prominent the figure has to stay inside the ring of
   * people, so this is the whole budget between "background structure" and
   * "still not touching anybody".
   */
  LENS_SWELL: 0.16,
  /** Radians per second the frame turns, so it is never quite static. */
  DRIFT: 0.12,
} as const;

/**
 * Glass fragments arriving at the people they happened to.
 *
 * The distances are expressed against a vessel's own radius, so a fragment
 * stops the same distance clear of the glass whichever layer it is in.
 */
/**
 * Crystal fragments leaving the people and striking the work.
 *
 * Distances are expressed against the project ball's own radius, so a fragment
 * lodges the same depth into its surface however large the ball is drawn.
 */
/**
 * The third month: a difficulty around each person, and what came of it.
 */
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
   *
   * Raised for the learning objects, which live inside the vessel and are a
   * quarter of its radius. Framed against the orb with comfortable air around
   * it, they came out a few dozen pixels across — far too small to tell one
   * form from another, which is the whole point of giving them forms. At this
   * fill the chosen person's orb dominates the frame and its interior is
   * legible, which is exactly what selecting somebody is for.
   */
  FOCUS_FILL: 0.55,

  /**
   * Closest approach while a person is selected.
   *
   * The global near clamp keeps the camera outside the whole structure, but
   * observing one orb means coming inside it, so focusing relaxes the clamp to
   * this and the overview restores it. Still far enough out that the near plane
   * never cuts into the glass.
   *
   * Scaled to the people, who are now a seventh of their old size because they
   * live inside the innermost box rather than in the open volume of the
   * tesseract. Left at the old value a focused person would sit ten times their
   * own diameter away and read as a speck.
   */
  FOCUS_MIN_DISTANCE: 0.5,

  /**
   * How far a focused shot must stay from the world's centre.
   *
   * The camera is free to travel inside the tesseract: structural members
   * dissolve as it approaches them, so a beam in the way is no longer a reason
   * to hold the shot outside. This only keeps the lens clear of the very centre.
   *
   * Well inside the Month 1 box now, because that box is where the people are:
   * the old value would have shoved every focused shot outside the chamber the
   * subject is standing in.
   */
  FOCUS_MIN_ORIGIN_DISTANCE: 0.85,

  /**
   * Clearance the camera keeps from any orb it is not looking at.
   *
   * Scaled to the people. At the old value — set when a vessel was three times
   * the size and neighbours sat three times further apart — this nudge
   * overwhelmed the framing entirely: every focused shot was shoved back to
   * whatever distance cleared the neighbours, and the subject's interior ended
   * up too small to read. It has to stay below the separation between two
   * people or it can never be satisfied.
   */
  FOCUS_ORB_CLEARANCE: 0.3 as number,
} as const;

/** Explicit draw order for the transparent, additively blended layers. */
export const RENDER_ORDER = {
  ATMOSPHERE: -1,
  FRAMES: 0,
  CONNECTIONS: 1,
  /** Halos are additive and must be laid down before the glass composites over them. */
  ORB_HALOS: 2,
  PROJECTS: 3,
  /**
   * The session forms orbit outside the vessels but must not be painted over by
   * them, so they are laid down first and the glass composites on top.
   */
  SESSIONS: 4,
  ORBS: 5,
  CORE: 6,
  PARTICLES: 7,
} as const;
