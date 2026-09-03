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
/** How far a person has got with one of their difficulties. */
export type ChallengeStatus = 'not-started' | 'in-progress' | 'overcome';

export type Lens =
  | 'people'
  | 'teams'
  | 'projects'
  | 'classes'
  | 'challenges'
  | 'databricks';

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
   * Where each difficulty has got to.
   *
   * Three states rather than a flag, because "not started" and "in progress"
   * are different things to be looking at and the difference is most of what a
   * viewer wants from this month. Keyed by record id rather than by person: one
   * person can carry several, and having worked through the week they were
   * stretched thin says nothing about the machine that failed.
   *
   * Anything absent from the map has not been started.
   */
  challengeStatus: Record<string, ChallengeStatus>;

  /**
   * The person the search last reached for, and the moment it did.
   *
   * Separate from the selection because it says something the selection cannot:
   * that this person was arrived at rather than clicked on. Somebody reached
   * for by name has not been seen yet — the viewer does not know which of
   * sixteen vessels the camera is travelling toward — so the arrival has to
   * announce itself, and then stop. The stamp is what lets it stop: the pulse
   * is read off elapsed time in the render loop rather than being wound down
   * by a timer that would have to be cancelled every time the choice changed.
   */
  foundTraineeId: string | null;
  foundStamp: number;

  /**
   * Somebody chosen from outside a layer, held until they exist to be chosen.
   *
   * The people belong to the inside of a month, and passing into one is a
   * journey rather than a switch. Focusing on arrival at the far end of it
   * would send the camera to a vessel that has not resolved yet, which reads as
   * the search having failed to find them. `TraineeField` takes this up at the
   * one moment that cannot be predicted from here: when the person is on screen.
   */
  pendingFindId: string | null;

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

  /** Moves one difficulty on: not started, then in progress, then overcome. */
  advanceChallenge: (challengeId: string) => void;

  hoverSession: (key: string | null) => void;
  /** Opens a session to reveal its name, or closes the current one with null. */
  openSession: (key: string | null) => void;

  setLens: (lens: Lens) => void;

  hoverMonth: (month: MonthIndex | null) => void;
  /** Passes into a dimensional layer, or back out when given null. */
  enterMonth: (month: MonthIndex | null) => void;

  /**
   * Whether the keys are showing the whole cohort ranked rather than answering
   * whoever is being pointed at.
   *
   * Off by default and deliberately. The standing question in this world is
   * about a person — what they liked, what they ran into — and a ranked table
   * of all sixteen answers a different question entirely. It is here for the
   * moment somebody asks the comparative one out loud: which class did most
   * people like, what did most people struggle with.
   */
  ranked: boolean;
  /**
   * Set rather than toggled, because the control is two named options rather
   * than one switch. A viewer who clicks the reading they are already in should
   * stay where they are, not be thrown into the other one.
   */
  setRanked: (ranked: boolean) => void;

  hoverTrainee: (id: string | null) => void;
  focusTrainee: (id: string | null) => void;
  /**
   * Reaches for one person by name, from wherever the viewer currently is.
   *
   * Distinct from `focusTrainee` in the two things a name-based search has to
   * do that a click never does: it may have to enter a layer first, because the
   * person named is not on screen to be clicked, and it marks the arrival so
   * the world can show which vessel was found.
   */
  findTrainee: (id: string) => void;
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

  ranked: false,

  hoveredTraineeId: null,
  focusedTraineeId: null,
  hoveredTeamId: null,
  focusedTeamId: null,
  challengeStatus: {},
  hoveredSession: null,
  openedSession: null,
  hoveredMonth: null,
  foundTraineeId: null,
  foundStamp: 0,
  pendingFindId: null,
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

  advanceChallenge: (challengeId) =>
    set((state) => {
      const now = state.challengeStatus[challengeId] ?? 'not-started';
      const next: ChallengeStatus =
        now === 'not-started'
          ? 'in-progress'
          : now === 'in-progress'
            ? 'overcome'
            : 'not-started';
      return { challengeStatus: { ...state.challengeStatus, [challengeId]: next } };
    }),

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
        // A search still travelling toward its layer is abandoned if the viewer
        // leaves before it lands; taking it up afterwards would drag them back
        // into a month they had just stepped out of.
        pendingFindId: month === null ? null : state.pendingFindId,
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

  setRanked: (ranked) => set((state) => (state.ranked === ranked ? state : { ranked })),

  focusTrainee: (id) =>
    set((state) => {
      if (state.focusedTraineeId === id) return state;
      return {
        focusedTraineeId: id,
        // Choosing by hand is not being found by name, and must not inherit the
        // arrival that belonged to a search.
        foundTraineeId: null,
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

  findTrainee: (id) =>
    set((state) => {
      // Nobody is standing anywhere until a layer has been entered, so reaching
      // for a person from outside passes into the first month — where the
      // sixteen are individuals, which is the subject a search by name asks
      // about — and leaves the choice waiting to be taken up on arrival.
      if (state.enteredMonth === null) {
        return { enteredMonth: 0, hoveredMonth: null, pendingFindId: id, hasInteracted: true };
      }

      return {
        pendingFindId: null,
        foundTraineeId: id,
        foundStamp: performance.now(),
        focusedTraineeId: id,
        // Same reasoning as choosing by hand: a person and their project are
        // different subjects, and one releases the other.
        focusedTeamId: null,
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
      foundTraineeId: null,
      pendingFindId: null,
      whatIf: DEFAULT_WHAT_IF,
      interaction: 'IDLE',
    }),
}));

if (import.meta.env.DEV) {
  /**
   * The store itself, so a headless run can choose somebody without having to
   * hit a moving orb with the mouse.
   *
   * Picking is the thing least suited to being driven from a script here: the
   * vessels drift, the camera drifts with them, and a click aimed at where one
   * was a second ago silently lands on nothing — which reads in a test result
   * as the feature being broken rather than the aim being off.
   */
  (window as unknown as Record<string, unknown>).__world = useWorldStore;
}
