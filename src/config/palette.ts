/**
 * The complete colour vocabulary of the Tesseract.
 *
 * Every value is a cool, desaturated steel derived from the same near-black
 * base. Keeping the palette in one place is what structurally prevents the
 * scene from drifting toward neon: there is simply no saturated hue to reach
 * for. Nothing outside this file may introduce a colour literal.
 */

export const PALETTE = {
  /** Deep space background. Fog uses the same value so depth reads as distance, not haze. */
  BG: '#05060a',
  FOG: '#05060a',

  /**
   * Structural frame members.
   *
   * This is a metal reflectance value, not a surface colour: for a metallic
   * material the base colour *is* the specular tint, so a near-black value
   * would make the struts a black mirror with nothing to reflect, leaving only
   * their rim visible — which reads as a glowing wire rather than a machined
   * member. A cool steel keeps the frames dark against the void while still
   * letting the lighting rig model their bevels.
   */
  FRAME_BASE: '#5f6a77',
  FRAME_EMISSIVE: '#8fa8c8',
  /** Fresnel rim that breathes along the bevelled edges. */
  FRESNEL_RIM: '#dbe4ee',

  /** Corner nodes: the only geometry intended to cross the bloom threshold. */
  NODE: '#c7d6e8',

  /** Dimensional connections between corresponding vertices of nested shells. */
  CONNECTION: '#9db4d0',

  /**
   * The trainee orbs: cinematic indigo-violet glass.
   *
   * The orbs are the one place the palette leaves the steel family. They are
   * translucent vessels, so these values are read as absorption and emission
   * rather than as surface paint — the glass tint darkens what lies behind it
   * while the inner glow lights it from within.
   *
   * Saturation is held well back on purpose. Against a near-black ground the
   * orbs read as luminous through contrast, not through intensity, and pushing
   * the violet any further turns cinematic glass into neon.
   */
  /** Absorption tint of the glass body. Deep, desaturated indigo. */
  ORB_GLASS: '#1e1a3e',
  /** The electric-violet energy suspended inside the vessel. */
  ORB_GLOW: '#7d6ac9',
  /** Fresnel edge where the shell catches light. */
  ORB_RIM: '#b9a4f0',
  /** Cool highlight the interior shifts toward when seen straight on. */
  ORB_DISPERSION: '#8fd6e8',
  /** Specular glint — near-white, as a real dielectric reflects. */
  ORB_SPECULAR: '#f2eeff',
  /** Atmospheric field around each orb. */
  ORB_HALO: '#6a52b0',

  /**
   * The sessions a person liked, orbiting their vessel.
   *
   * One colour for all fifteen forms, on purpose. They differ by shape,
   * structure and behaviour, never by hue: giving each session its own colour
   * would turn the sixteen people into a legend to be memorised, while a form
   * is simply recognised. A restrained cyan-white sets them apart from the
   * violet the people themselves are made of, so a session reads as something a
   * person carries rather than as part of them.
   */
  SESSION_FORM: '#bfeaf2',
  SESSION_EMISSIVE: '#7fd2e6',

  /** A live collaboration between two people. */
  CONNECTION_ACTIVE: '#8ea8e8',
  /** The project structure that collaboration builds. */
  PROJECT_CORE: '#3b3570',
  PROJECT_EMISSIVE: '#9d86e8',

  /**
   * A fracture in a vessel, where the surveys record difficulty. Colder and
   * darker than the glass around it, because a crack both blocks light and
   * scatters what gets past it.
   */
  /**
   * A difficulty, as unstable energy beside the person carrying it.
   *
   * Dark at its heart and agitated at its edge. A wholly dark thing on a dark
   * ground is an invisible thing, so what makes it read is the churn: crimson
   * and violet filaments that will not settle, against a body that swallows
   * light.
   */
  UNSTABLE_CORE: '#140718',
  UNSTABLE_EDGE: '#ff4f7d',
  UNSTABLE_ARC: '#a566ff',
  /**
   * What is left once a difficulty has been worked through.
   *
   * Warm and steady where the trouble was cold and restless: the person did not
   * merely lose a problem, they came away with something.
   */
  /**
   * The three layers of the knowledge core.
   *
   * Warm through cool to warm again, so the middle layer separates from the two
   * either side of it by temperature as well as by radius — three concentric
   * shells that all read warm would be one blur at any distance.
   */
  MEDALLION_BRONZE: '#e08a3c',
  MEDALLION_SILVER: '#b8cee8',
  MEDALLION_GOLD: '#f5b942',
  KNOWLEDGE: '#ffe3a6',
  ORB_FRACTURE: '#0b1424',

  /**
   * A glass fragment: a piece of difficulty on its way to somebody.
   *
   * The same cold near-white a real chip of glass would be, not a warning
   * colour. Nothing here is trying to alarm — these are things people found
   * hard, and colouring them like a fault light would editorialise.
   */

  /** Soft volumetric core suspended at the centre of the structure. */
  CORE_HAZE: '#6c86a6',

  /**
   * Environmental particulate drifting outside the structure. Cyan-white, kept
   * restrained: the motes are there to give the void a sense of volume, and the
   * moment they become bright enough to notice individually they read as dust
   * on the lens rather than as atmosphere.
   */
  PARTICLE: '#c2e8f0',

  /** Interface typography. */
  UI_TEXT: '#e6ebf2',
  UI_DIM: '#5a6472',

  /** Lighting rig. */
  LIGHT_KEY: '#e8eef6',
  LIGHT_RIM: '#7f95b0',
  LIGHT_AMBIENT: '#1a2028',
  LIGHTFORMER_TOP: '#dfe8f2',
  LIGHTFORMER_SIDE: '#b8c8dc',
  LIGHTFORMER_FILL: '#3a4552',
} as const;

export type PaletteKey = keyof typeof PALETTE;
