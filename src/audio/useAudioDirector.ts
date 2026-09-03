import { useEffect } from 'react';
import { AUDIO, type BedId } from '../config/audio';
import { HYPER_TURN } from '../config/dimensions';
import { CHALLENGE_RECORDS, challengeById, challengesOf } from '../data/challenges';
import { lensApplies } from '../ui/LensControl';
import { useWorldStore, type ChallengeStatus } from '../store/useWorldStore';
import { audioEngine } from './audioEngine';

/**
 * The one place that decides what the world should sound like.
 *
 * Nothing else in the tree calls the transport. Rather than hanging an audio
 * call off every handler — which is how a soundtrack ends up restarting three
 * times on one click, and how a new interaction ends up silently having no
 * sound at all — this subscribes to the store once and reads the whole state
 * after every change. The score is a function of where the viewer is, so it is
 * written as one.
 *
 * That has a consequence worth stating: **existing handlers were not touched.**
 * `enterMonth`, `focusTrainee`, `setLens` and `advanceChallenge` do exactly what
 * they did before. They are observed, not wrapped.
 *
 * Two kinds of thing come out of it. `sceneFor` answers "where are we", and its
 * answer becomes the bed — asked for on every change, and free when it has not
 * moved. The transitions below answer "what just happened", and a few of them
 * raise a moment over that bed.
 */

/* ------------------------------------------------------------------ *
 * Where are we
 * ------------------------------------------------------------------ */

type World = ReturnType<typeof useWorldStore.getState>;

/** Whether every difficulty in the cohort has been worked through. */
function journeyComplete(status: Record<string, ChallengeStatus>): boolean {
  return CHALLENGE_RECORDS.every((record) => status[record.id] === 'overcome');
}

/** Whether this person still carries something rated high impact. */
function carryingSevere(
  personId: string,
  status: Record<string, ChallengeStatus>,
): boolean {
  return challengesOf(personId).some(
    (record) => record.severity === 'high' && status[record.id] !== 'overcome',
  );
}

/**
 * The bed for a state of the world, most specific reading first.
 *
 * The order is the argument. What is being *read* outranks which month it is
 * being read in, because that is how the world itself behaves — the lens is
 * what the viewer chose to be looking at, and the month is only where it is
 * true. A lens is consulted only where it applies, using the same table the
 * control itself is built from, so the score can never end up playing the teams
 * theme in a month that has no teams.
 */
function sceneFor(state: World): BedId | null {
  // Silence under the veil. The world has not arrived, so there is nowhere to be.
  if (state.phase !== 'ready') return null;

  const complete = journeyComplete(state.challengeStatus);

  if (state.enteredMonth === null) {
    if (!state.hasInteracted) return 'OPENING';
    return complete ? 'OVERVIEW_AFTER' : 'OVERVIEW';
  }

  if (complete) return 'JOURNEY_COMPLETE';

  const held = state.focusedTraineeId;
  const lens = state.lens;
  const applies = lensApplies(lens, state.enteredMonth);

  if (applies) {
    if (lens === 'classes') return held ? 'PERSON_LEARNING' : 'LEARNING';
    if (lens === 'teams') return 'TEAMS';
    if (lens === 'projects') return 'PROJECTS';
    if (lens === 'databricks') return 'KNOWLEDGE';
    if (lens === 'challenges') {
      if (!held) return 'CHALLENGES';
      return carryingSevere(held, state.challengeStatus)
        ? 'SEVERE'
        : 'PERSON_CHALLENGES';
    }
  }

  // The people lens, or a lens that has nothing to say here. Somebody chosen is
  // a place of its own; otherwise it is simply the month.
  if (held) return 'PERSON';
  return state.enteredMonth === 0 ? 'MONTH_1' : state.enteredMonth === 1 ? 'MONTH_2' : 'MONTH_3';
}

/* ------------------------------------------------------------------ *
 * What just happened
 * ------------------------------------------------------------------ */

/**
 * How long the passage between two months lasts before the camera is released.
 *
 * The same arithmetic the turn itself uses, so the new month's theme comes up
 * exactly as the viewer starts descending into it rather than after they have
 * landed. One revolution per month boundary crossed, and the outside counts as
 * the outermost month's depth.
 */
function passageSeconds(from: number | null, to: number): number {
  const origin = from ?? HYPER_TURN.OUTSIDE_MONTH;
  const turns = Math.max(HYPER_TURN.MIN_TURNS, Math.abs(to - origin));
  return (turns - 1 + HYPER_TURN.RELEASE) * HYPER_TURN.DURATION;
}

type ChallengeCue = 'CHALLENGE_ENGAGED' | 'CHALLENGE_RESOLVED' | 'CHALLENGE_UNDONE' | 'GROWTH';

/**
 * The one status change worth a cue, which cue it is, and how far forward it
 * should sit.
 *
 * Only a genuine transition produces anything. Re-rendering, re-selecting the
 * same person or setting a status to what it already was returns null, so the
 * same eight bars cannot be machine-gunned by a viewer clicking about.
 *
 * The three states the world models are the three this reads:
 * `not-started → in-progress → overcome`, and `overcome → not-started` for the
 * undo. There is no fourth.
 */
function challengeMoment(
  before: Record<string, ChallengeStatus>,
  after: Record<string, ChallengeStatus>,
): { cue: ChallengeCue; duck: number } | null {
  for (const id of Object.keys(after)) {
    const was = before[id] ?? 'not-started';
    const now = after[id];
    if (was === now) continue;

    const record = challengeById(id);
    // How far the room pulls back is the one thing the difficulty's judged
    // impact changes. Nothing gets louder.
    const duck = AUDIO.SEVERITY_DUCK[record?.severity ?? 'medium'] ?? AUDIO.EVENT_DUCK;

    if (now === 'in-progress') return { cue: 'CHALLENGE_ENGAGED', duck };
    if (now === 'not-started') return { cue: 'CHALLENGE_UNDONE', duck };
    if (now === 'overcome') {
      // The last of somebody's difficulties is a different event from one of
      // them, and it is the one the growth glow is already drawing.
      const theirs = record ? challengesOf(record.personId) : [];
      const allDone =
        theirs.length > 0 && theirs.every((one) => after[one.id] === 'overcome');
      return { cue: allDone ? 'GROWTH' : 'CHALLENGE_RESOLVED', duck };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * The subscription
 * ------------------------------------------------------------------ */

export function useAudioDirector(): void {
  useEffect(() => {
    // The browser will not make a sound until the page has been touched. No
    // prompt and no "enable music" button: the viewer's first move on the world
    // is the permission, and until then the opening cue waits in the transport.
    //
    // The listeners stay attached rather than firing once. Unlocking is cheap
    // and idempotent after the first time, and leaving them armed is the
    // recovery path: a browser that suspends the context later — a backgrounded
    // tab, an output device changing — gets it resumed on the viewer's next
    // move instead of going quiet for the rest of the session.
    const unlock = () => audioEngine.unlock();
    for (const type of ['pointerdown', 'click', 'keydown', 'touchstart'] as const) {
      window.addEventListener(type, unlock, { passive: true });
    }

    const onVisibility = () => audioEngine.setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);

    let warmed: number | null = null;

    const react = (state: World, previous: World | null) => {
      // Moments are asked for before the bed, so the transport knows to hold
      // the new bed under the moment and hand it over when it finishes.
      if (previous) {
        if (state.enteredMonth !== previous.enteredMonth) {
          if (state.enteredMonth === null) {
            // Leaving. If there is nothing left unresolved, this is not a
            // withdrawal, it is the end of the thing.
            audioEngine.playMoment(
              journeyComplete(state.challengeStatus) ? 'EXIT' : 'DETACHING',
            );
          } else {
            audioEngine.playMoment(
              'DIMENSIONAL_TURN',
              passageSeconds(previous.enteredMonth, state.enteredMonth),
            );
          }
        }

        if (state.foundStamp !== previous.foundStamp && state.foundTraineeId) {
          audioEngine.playMoment('ARRIVAL');
        }

        if (state.challengeStatus !== previous.challengeStatus) {
          const moment = challengeMoment(previous.challengeStatus, state.challengeStatus);
          if (moment) audioEngine.playMoment(moment.cue, undefined, moment.duck);
        }
      }

      // Observing somebody pulls the room back rather than changing the piece.
      audioEngine.setDucked(state.focusedTraineeId !== null);

      audioEngine.setBed(sceneFor(state));

      // The month themes and the passage are fetched once the world has
      // settled, because entering a month is what everybody does first.
      if (state.phase === 'ready' && warmed === null) {
        audioEngine.preload(AUDIO.EAGER);
        warmed = window.setTimeout(
          () => audioEngine.preload(AUDIO.WARM),
          AUDIO.WARM_DELAY_MS,
        );
      }
    };

    react(useWorldStore.getState(), null);
    const unsubscribe = useWorldStore.subscribe(react);

    return () => {
      unsubscribe();
      if (warmed !== null) window.clearTimeout(warmed);
      document.removeEventListener('visibilitychange', onVisibility);
      for (const type of ['pointerdown', 'click', 'keydown', 'touchstart'] as const) {
        window.removeEventListener(type, unlock);
      }
      audioEngine.dispose();
    };
  }, []);
}
