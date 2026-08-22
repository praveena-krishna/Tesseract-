/**
 * Constants for the collaboration layer: the links between people and the
 * project structures those links build.
 */

export const TEAMS = {
  /** Radius of a fully formed project core. */
  CORE_RADIUS: 0.26,
  /**
   * How far a connection bows outward from the world's centre.
   *
   * A straight line between two orbs reads as a diagram edge. Arcing it turns
   * the same information into a relationship occupying real space.
   */
  CURVE_BOW: 0.55,
} as const;
