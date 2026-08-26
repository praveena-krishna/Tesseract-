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

/**
 * Which layer of meaning the world is currently showing.
 *
 * Not five views of five datasets — one world, foregrounding one thing at a
 * time. Everything stays on screen in every lens; what changes is what is
 * legible. That is the difference between navigating a visualization and
 * switching between dashboards.
 */
export type Lens = 'people' | 'teams' | 'projects' | 'classes' | 'challenges';

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

  /**
   * Which dimensional layer the pointer is over, if any.
   *
   * Separate from the trainee hover because they are different subjects at
   * different depths: from outside, the layer is what can be reached, and once
   * inside it the people are.
   */
  hoveredMonth: MonthIndex | null;

  /** Which layer of meaning is foregrounded. */
  lens: Lens;

  /**
   * The learning object under the pointer, and the one that has been opened,
   * each keyed `personId:classId`.
   *
   * Kept separate from the trainee hover because they are different subjects at
   * different depths: the orb is a person, an object orbiting it is one session
   * that person liked, and pointing at the session must not stop the person
   * being identified.
   */
  hoveredSession: string | null;
  openedSession: string | null;

  /**
   * Which layer the viewer has passed into, or null while they are outside
   * looking at the whole structure.
   *
   * This is the one piece of state that changes what the experience is about.
   * Nothing is unmounted when it changes — the tesseract does not go anywhere,
   * and the people who appear inside it were always going to be there. Only
   * Month 1 is wired to it so far.
   */
  enteredMonth: MonthIndex | null;

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

  hoverSession: (key: string | null) => void;
  /** Opens a session to reveal its name, or closes the current one with null. */
  openSession: (key: string | null) => void;

  setLens: (lens: Lens) => void;

  hoverMonth: (month: MonthIndex | null) => void;
  /** Passes into a dimensional layer, or back out when given null. */
  enterMonth: (month: MonthIndex | null) => void;

  hoverTrainee: (id: string | null) => void;
  focusTrainee: (id: string | null) => void;
  hoverTeam: (id: string | null) => void;
  focusTeam: (id: string | null) => void;
  /** Steps the selection through the field; used by keyboard navigation. */
  stepFocus: (delta: number, ids: string[]) => void;

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
  hoveredSession: null,
  openedSession: null,
  hoveredMonth: null,
  // The world opens on the people. Everything else in it is something that
  // happened to them, so they are what the first look should be about.
  lens: 'people',
  // The world opens outside, on the whole structure. Which layer to enter is
  // the viewer's first decision, not the opening's.
  enteredMonth: null,
  // The world opens on the first month, so the viewer sees the training begin
  // and can watch it develop rather than arriving at its conclusion.
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

  hoverSession: (key) =>
    set((state) => (state.hoveredSession === key ? state : { hoveredSession: key })),

  openSession: (key) =>
    set((state) => (state.openedSession === key ? state : { openedSession: key })),

  setLens: (lens) =>
    set((state) => {
      if (state.lens === lens) return state;
      // Changing what the world is about releases whatever was being examined
      // under the previous lens, so nothing is left described by a layer that
      // is no longer foregrounded.
      return {
        lens,
        focusedTeamId: lens === 'projects' ? state.focusedTeamId : null,
        focusedTraineeId:
          lens === 'people' || lens === 'classes' || lens === 'challenges'
            ? state.focusedTraineeId
            : null,
        openedSession: lens === 'classes' ? state.openedSession : null,
        hasInteracted: true,
      };
    }),

  hoverMonth: (month) =>
    set((state) => (state.hoveredMonth === month ? state : { hoveredMonth: month })),

  enterMonth: (month) =>
    set((state) => {
      if (state.enteredMonth === month) return state;
      return {
        enteredMonth: month,
        // Leaving takes any selection with it: the interface must not be left
        // describing a person the viewer can no longer see.
        focusedTraineeId: month === null ? null : state.focusedTraineeId,
        focusedTeamId: month === null ? null : state.focusedTeamId,
        hoveredMonth: null,
        hasInteracted: true,
      };
    }),

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
        // A session belongs to whoever was selected when it was opened; moving
        // to somebody else must not leave their neighbour's label standing.
        openedSession: null,
        hoveredSession: null,
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

  setWhatIf: (patch) =>
    set((state) => ({ whatIf: { ...state.whatIf, ...patch }, hasInteracted: true })),

  resetWhatIf: () => set({ whatIf: DEFAULT_WHAT_IF }),

  clearAll: () =>
    set({
      focusedTraineeId: null,
      focusedTeamId: null,
      hoveredTraineeId: null,
      hoveredTeamId: null,
      hoveredMonth: null,
      enteredMonth: null,
      hoveredSession: null,
      openedSession: null,
      whatIf: DEFAULT_WHAT_IF,
      interaction: 'IDLE',
    }),
}));
