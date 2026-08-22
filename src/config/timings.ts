/**
 * Every temporal constant in the experience.
 *
 * The guiding rule is that nothing is synchronised. Pulse periods are mutually
 * prime-ish and phase-offset so the structure never falls into a metronome —
 * a synchronised scene reads as an animation loop, an unsynchronised one reads
 * as something alive.
 */

export const TIMINGS = {
  /** Breathing period, in seconds, for each shell from outer to ghost. */
  PULSE_PERIODS: [9, 7, 11],
  PULSE_PHASES: [0, 2.1, 4.7],
  /**
   * Emissive intensity range the corner nodes travel through. Held below the
   * point where they blow out to flat white — a node should read as a joint
   * lit from within, not as a bead stuck on the corner.
   */
  NODE_EMISSIVE_MIN: 0.3,
  NODE_EMISSIVE_MAX: 0.62,
  /** Fresnel rim contribution range, scaled by the same pulse. */
  FRESNEL_MIN: 0.7,
  FRESNEL_MAX: 1.0,

  /** Counter-rotation, radians per second, applied to inner and ghost shells. */
  SHELL_ROTATION: [0, 0.02, -0.016],

  /** Seconds for one signal point to traverse a connection line. */
  SIGNAL_PERIOD: 6,

  /** Whole-field rotation of the environmental particles, radians per second. */
  PARTICLE_ROTATION: 0.004,
  /** Time multiplier feeding the GPU drift. */
  PARTICLE_DRIFT_SPEED: 0.06,

  /** Idle camera behaviour. */
  IDLE_DELAY: 8,
  IDLE_ORBIT_SPEED: 0.015,

  /** Loading veil. */
  LOADING_MIN_MS: 1600,
  LOADING_FADE_MS: 900,
  LOADING_FADE_REDUCED_MS: 200,
  /** Interface fades in only once the world is present. */
  UI_FADE_MS: 600,

  /** Global damping applied to all motion when the viewer prefers reduced motion. */
  REDUCED_MOTION_FACTOR: 0.15,
} as const;
