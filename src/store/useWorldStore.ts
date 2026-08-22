import { create } from 'zustand';
import type * as THREE from 'three';
import type CameraControlsImpl from 'camera-controls';
import type { MonthIndex } from '../data/world';
import type { WhatIf } from '../sim/whatIf';
import { DEFAULT_WHAT_IF } from '../sim/whatIf';

/**
 * Boot lifecycle of the world. The veil covers the canvas until 'ready'.
 */
export type WorldPhase = 'initializing' | 'ready';

/**
 * The single interaction state machine for the whole experience. Phase 1 only
 * exercises IDLE, but the later states are declared now so that selection,
 * team gravity and temporal exploration slot in without restructuring.
 */
export type InteractionState =
  | 'IDLE'
  | 'HOVERING_TRAINEE'
  | 'SELECTED_TRAINEE'
  | 'TEAM_FOCUS'
  | 'TEMPORAL_EXPLORATION'
  | 'RESETTING';

/** The three-month temporal buckets the training data resolves into. */
export type TimeBucket = 0 | 1 | 2;

interface WorldState {
  phase: WorldPhase;
  reducedMotion: boolean;
  interaction: InteractionState;

  hoveredTraineeId: string | null;
  focusedTraineeId: string | null;
  hoveredTeamId: string | null;
  focusedTeamId: string | null;

  /** Which of the three months the world is currently showing. */
  month: MonthIndex;
  /** Counterfactual conditions the world is being run under. */
  whatIf: WhatIf;

  /**
   * Live world positions of the orbs, keyed by trainee id.
   *
   * Held as a plain mutable map rather than as reactive state: the orbs drift
   * every frame, and routing that through the store would re-render the tree
   * sixty times a second. Whoever needs a current position reads it on demand.
   */
  traineePositions: Map<string, THREE.Vector3> | null;
  /** Live centroid of each team, published on the same terms. */
  teamCentres: Map<string, THREE.Vector3> | null;

  /**
   * The camera controls instance, held as a plain (non-reactive) reference so
   * that every future camera driver — fly-to-orb, reset, GSAP choreography —
   * goes through one seam instead of reaching for the camera directly.
   */
  controls: CameraControlsImpl | null;

  /** True once the viewer has dragged; used to retire the onboarding hint. */
  hasInteracted: boolean;

  setPhase: (phase: WorldPhase) => void;
  setReducedMotion: (reducedMotion: boolean) => void;
  setControls: (controls: CameraControlsImpl | null) => void;
  setTraineePositions: (positions: Map<string, THREE.Vector3> | null) => void;
  setTeamCentres: (centres: Map<string, THREE.Vector3> | null) => void;
  markInteracted: () => void;

  hoverTrainee: (id: string | null) => void;
  focusTrainee: (id: string | null) => void;
  hoverTeam: (id: string | null) => void;
  focusTeam: (id: string | null) => void;
  /** Steps the selection through the field; used by keyboard navigation. */
  stepFocus: (delta: number, ids: string[]) => void;

  setMonth: (month: MonthIndex) => void;
  setWhatIf: (patch: Partial<WhatIf>) => void;
  resetWhatIf: () => void;
  /** Clears every selection and counterfactual, returning the world to rest. */
  clearAll: () => void;
}

/** Keeps the coarse interaction state consistent with what is selected. */
function deriveInteraction(
  hoveredTraineeId: string | null,
  focusedTraineeId: string | null,
  focusedTeamId: string | null,
): InteractionState {
  if (focusedTeamId) return 'TEAM_FOCUS';
  if (focusedTraineeId) return 'SELECTED_TRAINEE';
  if (hoveredTraineeId) return 'HOVERING_TRAINEE';
  return 'IDLE';
}

export const useWorldStore = create<WorldState>((set) => ({
  phase: 'initializing',
  reducedMotion: false,
  interaction: 'IDLE',

  hoveredTraineeId: null,
  focusedTraineeId: null,
  hoveredTeamId: null,
  focusedTeamId: null,
  // The world opens on the first month, so the viewer sees the training begin
  // and can watch it develop rather than arriving at its conclusion.
  month: 0,
  whatIf: DEFAULT_WHAT_IF,

  controls: null,
  traineePositions: null,
  teamCentres: null,
  hasInteracted: false,

  setPhase: (phase) => set({ phase }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setControls: (controls) => set({ controls }),
  setTraineePositions: (traineePositions) => set({ traineePositions }),
  setTeamCentres: (teamCentres) => set({ teamCentres }),
  markInteracted: () =>
    set((state) => (state.hasInteracted ? state : { hasInteracted: true })),

  hoverTrainee: (id) =>
    set((state) => {
      if (state.hoveredTraineeId === id) return state;
      return {
        hoveredTraineeId: id,
        interaction: deriveInteraction(id, state.focusedTraineeId, state.focusedTeamId),
      };
    }),

  focusTrainee: (id) =>
    set((state) => {
      if (state.focusedTraineeId === id) return state;
      return {
        focusedTraineeId: id,
        // A person and their project are different subjects; choosing one
        // releases the other rather than stacking two focuses at once.
        focusedTeamId: null,
        interaction: deriveInteraction(state.hoveredTraineeId, id, null),
        hasInteracted: true,
      };
    }),

  hoverTeam: (id) =>
    set((state) => (state.hoveredTeamId === id ? state : { hoveredTeamId: id })),

  focusTeam: (id) =>
    set((state) => {
      if (state.focusedTeamId === id) return state;
      return {
        focusedTeamId: id,
        focusedTraineeId: null,
        interaction: deriveInteraction(state.hoveredTraineeId, null, id),
        hasInteracted: true,
      };
    }),

  stepFocus: (delta, ids) =>
    set((state) => {
      if (ids.length === 0) return state;

      const current = state.focusedTraineeId
        ? ids.indexOf(state.focusedTraineeId)
        : -1;
      // Starting from nothing, step forward into the first and backward into
      // the last, so both directions enter the field rather than dead-ending.
      const next =
        current === -1
          ? delta > 0
            ? 0
            : ids.length - 1
          : (current + delta + ids.length) % ids.length;

      const id = ids[next];
      return {
        focusedTraineeId: id,
        focusedTeamId: null,
        interaction: deriveInteraction(state.hoveredTraineeId, id, null),
        hasInteracted: true,
      };
    }),

  setMonth: (month) =>
    set((state) => (state.month === month ? state : { month, hasInteracted: true })),

  setWhatIf: (patch) =>
    set((state) => ({ whatIf: { ...state.whatIf, ...patch }, hasInteracted: true })),

  resetWhatIf: () => set({ whatIf: DEFAULT_WHAT_IF }),

  clearAll: () =>
    set({
      focusedTraineeId: null,
      focusedTeamId: null,
      hoveredTraineeId: null,
      hoveredTeamId: null,
      whatIf: DEFAULT_WHAT_IF,
      interaction: 'IDLE',
    }),
}));
