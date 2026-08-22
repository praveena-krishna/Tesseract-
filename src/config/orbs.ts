/**
 * Constants for the sixteen trainee orbs.
 *
 * Orbs occupy the volume between the outer and inner shells — the gap the
 * tesseract's fourth-dimensional displacement opens up. Placing them there
 * rather than at the centre keeps the core clear and means every orb is read
 * against the structure rather than against empty space.
 */

export const ORBS = {
  /** Radial band the orbs are distributed through, measured from the origin. */
  RADIUS_INNER: 3.05,
  RADIUS_OUTER: 4.55,

  /**
   * Baseline orb radius before per-person variation.
   *
   * Sized so an orb is legible as a body with an interior rather than as a
   * point of light. Below roughly this scale the internal energy structure
   * collapses to a single bright pixel and every orb looks identical, which
   * defeats the whole idea of a contained living system.
   */
  BASE_RADIUS: 0.46,
  /**
   * How far radius may vary with recorded confidence. Kept deliberately narrow:
   * the orbs must read as one population of peers, so scale differentiates
   * without ranking them into large and small.
   */
  RADIUS_VARIANCE: 0.1,

  /** Clearance an orb must keep from any shell's structural members. */
  STRUT_CLEARANCE: 0.78,
  /** Minimum centre-to-centre distance between two orbs. */
  SEPARATION: 1.4,

  /** Halo billboard size as a multiple of the orb's own radius. */
  HALO_SCALE: 3.6,
  HALO_OPACITY: 0.34,

  /** Geometry detail. An icosphere at this subdivision is smooth at our scale. */
  DETAIL: 3,

  /** Amplitude of each orb's slow wander around its anchor point, in world units. */
  DRIFT: 0.075,
  /** Breathing scale range, as a fraction of the orb's radius. */
  BREATH: 0.045,
  /** Seconds per breath, before per-orb variation. */
  BREATH_PERIOD: 7.5,
  /** Multiplier range applied to the breath period per orb, giving each its own tempo. */
  BREATH_SPREAD: 0.45,

  /**
   * Emphasis levels. Neutral is the resting state of every orb; attended is a
   * hovered or selected one; receded is everything else once a person has been
   * chosen. Receded stays well clear of zero — the other fifteen people do not
   * stop existing because one has been selected.
   */
  EMPHASIS_NEUTRAL: 0.5,
  EMPHASIS_ATTENDED: 1.0,
  EMPHASIS_RECEDED: 0.22,
  /** Seconds for an orb to travel between emphasis levels. */
  EMPHASIS_EASE: 0.4,

  /** Scale added to an orb at full emphasis, as a fraction of its radius. */
  ATTENDED_SWELL: 0.16,

  /** Pointer radius multiplier for picking, so small orbs stay easy to hit. */
  PICK_PADDING: 1.25,

  /* ---- Gravity ---- */

  /** Restoring pull toward a person's own resting position. */
  HOME_PULL: 2.4,
  /** Attraction toward a team's centre of mass when collaborating. */
  TEAM_PULL: 5.5,
  /** Mutual repulsion, which keeps bound orbs from interpenetrating. */
  REPULSION: 14,
  /** Velocity retained per frame at 60fps. Heavy, so the field settles. */
  DAMPING: 0.86,
  /** Jitter amplitude from unresolved difficulty. */
  TURBULENCE: 1.6,

  /* ---- Skills held inside each orb ---- */

  /** Radius of the shell skill nodes occupy, as a fraction of the orb radius. */
  SKILL_ORBIT: 0.62,
  /** World size of a single skill node. */
  SKILL_SIZE: 0.028,
  /** Seconds a skill node takes to fade in as it is acquired. */
  SKILL_EMERGE: 0.9,
} as const;
