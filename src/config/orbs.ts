/**
 * Constants for the sixteen trainee orbs.
 *
 * The orbs live inside the Month 1 box — the innermost of the three nested
 * shells. That is what makes entering a month mean something: the people are
 * not scattered through the tesseract at large, they are contained by the layer
 * that stands for their month, and the box's far side wraps visibly behind
 * them.
 *
 * Everything here is therefore scaled to a chamber two and a half units across
 * rather than to the ten-unit outer hull.
 */

export const ORBS = {
  /**
   * Radial band the orbs rest in, measured from the centre of their layer.
   *
   * Pushed out to use very nearly all the room the box has. Sixteen bodies in a
   * thin central shell read as one clustered mass however far apart they
   * nominally are; the readable difference comes from giving each of them a
   * territory, and the only source of territory here is the box's volume.
   *
   * The outer edge plus an orb's radius has to stay inside the box in the worst
   * direction — straight at the middle of a face, where the cube is closest to
   * its own centre.
   */
  RADIUS_INNER: 0.46,
  RADIUS_OUTER: 1.02,

  /**
   * Baseline orb radius before per-person variation.
   *
   * Sized so an orb is legible as a body with an interior rather than as a
   * point of light. Below roughly this scale the internal energy structure
   * collapses to a single bright pixel and every orb looks identical, which
   * defeats the whole idea of a contained living system.
   */
  BASE_RADIUS: 0.115,
  /**
   * How far radius may vary with recorded confidence. Kept deliberately narrow:
   * the orbs must read as one population of peers, so scale differentiates
   * without ranking them into large and small.
   */
  RADIUS_VARIANCE: 0.026,

  /** Clearance an orb must keep from its layer's structural members. */
  STRUT_CLEARANCE: 0.22,

  /**
   * How far apart the resting layout places two people.
   *
   * This is the spacing that makes sixteen individuals read as sixteen
   * individuals, and it is deliberately not the same number as the repulsion
   * below. They were one value once, and that was a mistake with a visible
   * consequence: spreading people out at rest also pushed teammates apart in
   * the second month, so the gravity had nothing left to show. One sets where
   * people stand when nothing is pulling them; the other only stops bodies
   * passing through each other.
   */
  LAYOUT_SEPARATION: 0.52,

  /**
   * Distance at which two orbs start pushing each other away.
   *
   * Just over twice an orb's radius, so it prevents interpenetration and
   * nothing else. Any larger and a team cannot gather tightly enough to read as
   * a team.
   */
  SEPARATION: 0.28,

  /** Halo billboard size as a multiple of the orb's own radius. */
  HALO_SCALE: 3.6,
  HALO_OPACITY: 0.34,

  /** Geometry detail. An icosphere at this subdivision is smooth at our scale. */
  DETAIL: 3,

  /** Amplitude of each orb's slow wander around its anchor point, in world units. */
  DRIFT: 0.025,
  /**
   * Breathing scale range, as a fraction of the orb's radius.
   *
   * Trimmed a little along with the jitter. Sixteen vessels all swelling is a
   * lot of movement at once; the breath should be noticed rather than watched.
   */
  BREATH: 0.034,
  /** Seconds per breath, before per-orb variation. */
  BREATH_PERIOD: 7.5,
  /** Multiplier range applied to the breath period per orb, giving each its own tempo. */
  BREATH_SPREAD: 0.45,

  /**
   * Emphasis levels. Neutral is the resting state of every orb; attended is a
   * hovered or selected one; receded is everything else once a person has been
   * chosen.
   *
   * Receded sits low. The selected person has to be unmistakably the subject,
   * and at a gentler value fifteen neighbours at close range still crowd the
   * frame and the eye has no idea which vessel it is meant to be reading. It
   * stays clear of zero, though: the other fifteen do not stop existing because
   * one has been chosen, and they are what says this person is standing among
   * a cohort.
   */
  EMPHASIS_NEUTRAL: 0.5,
  EMPHASIS_ATTENDED: 1.0,
  EMPHASIS_RECEDED: 0.08,
  /** Seconds for an orb to travel between emphasis levels. */
  EMPHASIS_EASE: 0.4,

  /** Scale added to an orb at full emphasis, as a fraction of its radius. */
  ATTENDED_SWELL: 0.16,

  /*
   * Being found by name.
   *
   * Selecting somebody already lifts them clear of the field, but a person
   * reached for by name has not been seen yet — the viewer does not know which
   * of sixteen vessels the camera is travelling toward, so the arrival has to
   * announce itself rather than simply be true once it is over. The pulse
   * therefore overshoots the attended state and falls back into it, which is
   * the difference between watching somebody be picked out and finding them
   * already picked out.
   *
   * Temporary on purpose. A permanent beacon would make a searched person read
   * as a different kind of thing from one chosen by clicking, and they are not.
   */
  EMPHASIS_FOUND: 1.95,
  /** Extra radius at the peak of the pulse, on top of the attended swell. */
  FOUND_SWELL: 0.14,
  /** Seconds the pulse takes to fall back to an ordinary selection. */
  FOUND_DURATION: 2.6,

  /** Pointer radius multiplier for picking, so small orbs stay easy to hit. */
  PICK_PADDING: 1.25,

  /**
   * How far above a vessel its name floats, in radii of that vessel.
   *
   * Two values, because the camera is at two quite different distances. From a
   * layer's own framing the orbs are small and the name wants clear air above
   * them. Once the camera has come in to observe somebody, that same lift is
   * most of a screen height and carries the name off the top of the frame
   * entirely — so the observed distance gets its own, tighter one, which lands
   * just clear of the vessel's silhouette instead.
   */
  LABEL_LIFT: 2.1,
  LABEL_LIFT_FOCUSED: 1.25,

  /* ---- Gravity ---- */

  /** Restoring pull toward a person's own resting position. */
  HOME_PULL: 2.4,
  /**
   * Attraction toward where a person's team gathers.
   *
   * Strong relative to the restoring pull that holds someone where they stand
   * alone, and it has to be. At a gentler value the two forces balanced part of
   * the way in: every team settled short of its own place and drifted toward
   * the middle, so five formations that were correctly assigned five separate
   * regions ended up bunched near the centre with no room between them. What is
   * left of the home pull is what keeps the settling organic rather than
   * collapsing each team onto a point.
   */
  TEAM_PULL: 11,
  /** Mutual repulsion, which keeps bound orbs from interpenetrating. */
  REPULSION: 14,
  /** Velocity retained per frame at 60fps. Heavy, so the field settles. */
  DAMPING: 0.86,
  /**
   * Jitter amplitude from unresolved difficulty.
   *
   * Eased back from 1.6: at that level the field read as agitated rather than
   * as people under strain, and the motion competed with the light for
   * attention. Still well clear of zero — a person carrying unresolved
   * difficulty should not sit perfectly still.
   */
  TURBULENCE: 1.05,

  /* ---- The sessions a person liked, held inside their vessel ---- */

  /**
   * How deep inside the orb each tier sits, as a fraction of the orb's radius.
   *
   * Inside, not around. An object orbiting outside the glass reads as a
   * decoration attached to a sphere; the same object suspended within it reads
   * as something the person contains. The vessel was always meant to be a
   * container and this is what it contains.
   *
   * Two depths, and the near one is the favourite. Combined with the spiral
   * that spreads them over three dimensions, no two sessions sit at the same
   * distance from the lens, so orbiting the person parallaxes them against each
   * other and the interior reads as a volume rather than as a decal.
   */
  SESSION_DEPTH_PRIMARY: 0.4,
  SESSION_DEPTH_SECONDARY: 0.62,
  /** Object size, also as a fraction of the orb's radius. */
  SESSION_SIZE_PRIMARY: 0.25,
  SESSION_SIZE_SECONDARY: 0.145,

  /**
   * How far the arrangement opens out when the person is attended to.
   *
   * Small. The objects must stay inside the glass — pushing them past the
   * surface is the failure this replaced — so attention widens the interior
   * slightly rather than expelling anything from it.
   */
  SESSION_SPREAD_ON_ATTENTION: 1.12,

  /**
   * The clear volume at the orb's centre, as a fraction of its radius.
   *
   * The person's own core lives here and nothing is allowed to sit on top of
   * it. An interior packed to the middle stops reading as a person holding
   * their learning and starts reading as a bag of objects.
   */
  SESSION_CORE_CLEARANCE: 0.22,

  /** Revolutions per second of the interior around its person. Restrained. */
  SESSION_REVOLVE: 0.035,
  /** How far the revolution runs down while one object is examined. */
  SESSION_SETTLE: 0.88,
  /** Seconds for an object to arrive, withdraw, or change tier. */
  SESSION_EASE: 0.42,

  /**
   * How present the interior is with nobody attending to that person.
   *
   * Faint. From across the month the sixteen should read as vessels, not as
   * sixteen busy dioramas; the interior resolves into individual objects when
   * somebody goes to look at one person.
   */
  SESSION_IDLE_PRESENCE: 0.3,
  /** What an object falls to when a different one is being examined. */
  SESSION_RECEDED: 0.42,
} as const;
