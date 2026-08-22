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
   * Knowledge held inside a vessel. A restrained cyan-white, distinct from the
   * violet energy around it so the structures read as discrete things the
   * person has acquired rather than as part of the glass itself.
   */
  SKILL_NODE: '#bfeaf2',

  /** A live collaboration between two people. */
  CONNECTION_ACTIVE: '#8ea8e8',
  /** The project structure that collaboration builds. */
  PROJECT_CORE: '#3b3570',
  PROJECT_EMISSIVE: '#9d86e8',

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
