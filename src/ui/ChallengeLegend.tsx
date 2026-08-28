import { useMemo } from 'react';
import {
  CHALLENGE_LABELS,
  CHALLENGE_RECORDS,
  SEVERITY_LABELS,
  SEVERITY_SCALE,
  TYPE_COLOUR,
  challengesOf,
} from '../data/challenges';
import type { ChallengeType, Severity } from '../data/challenges';
import { traineeById } from '../data/world';
import type { ChallengeStatus } from '../store/useWorldStore';
import { challengeIcon } from './challengeIcons';
import { CHALLENGES } from '../config/dimensions';
import { useWorldStore } from '../store/useWorldStore';

/** A row of the key: a kind, and in the ranked view how many met it. */
interface KindEntry {
  type: ChallengeType;
  name: string;
  count?: number;
}

/** Read in the order the fragments are sized, mildest first. */
const SEVERITIES: Severity[] = ['low', 'medium', 'high'];

/**
 * The key to the fragments.
 *
 * Two readings are carried at once and neither is guessable, so both are named.
 * **Colour is the kind of difficulty** — eight of them, more than anybody holds
 * in their head — and **size is how big the problem was**, which is a
 * comparison the eye can only make against something. A viewer looking at one
 * person's orb has no way to know whether the sliver in it is a large problem
 * or a small one without seeing the range it sits in.
 *
 * The size key is drawn at the real ratios rather than three arbitrary
 * swatches, so the step from a mild difficulty to a severe one is the step the
 * world actually draws.
 *
 * Only the kinds present in the data are listed. A key naming a kind nobody met
 * would send the viewer hunting for something that is not there.
 */
export function ChallengeLegend() {
  const lens = useWorldStore((state) => state.lens);
  const enteredMonth = useWorldStore((state) => state.enteredMonth);
  const focusedTraineeId = useWorldStore((state) => state.focusedTraineeId);
  const hoveredTraineeId = useWorldStore((state) => state.hoveredTraineeId);
  const ranked = useWorldStore((state) => state.ranked);
  const toggleRanked = useWorldStore((state) => state.toggleRanked);

  /**
   * Whose difficulties the key is answering, if anybody's.
   *
   * A chosen person outranks a hovered one, so sweeping the pointer across the
   * month cannot take the key away from whoever is being read.
   */
  // The ranked view is about all sixteen at once, so it deliberately ignores
  // whoever is being pointed at — narrowing it to one person would answer the
  // opposite of the question it is there to answer.
  const subject = ranked ? null : focusedTraineeId ?? hoveredTraineeId;

  /**
   * How many people ran into each kind of difficulty, most common first.
   *
   * Counted in people rather than in incidents, so one person who logged three
   * technical errors does not read as three people struggling with tooling —
   * and so the figure is comparable with the class ranking, which counts the
   * same way.
   */
  const ranking = useMemo(() => {
    const tally = new Map<ChallengeType, Set<string>>();
    for (const record of CHALLENGE_RECORDS) {
      const people = tally.get(record.type) ?? new Set<string>();
      people.add(record.personId);
      tally.set(record.type, people);
    }
    return [...tally]
      .map(([type, people]) => ({
        type,
        count: people.size,
        name: CHALLENGE_LABELS[type],
      }))
      // Ties broken by name, so the order is stable rather than incidental.
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, []);

  const kinds = useMemo(() => {
    const present = new Set<ChallengeType>();
    // Pointing at somebody narrows the key to what *they* ran into. Eight
    // entries with six greyed out still makes the reader find the two that are
    // not; showing only theirs answers the question outright, and the whole set
    // is one pointer movement away.
    for (const record of CHALLENGE_RECORDS) {
      if (!subject || record.personId === subject) present.add(record.type);
    }
    return [...present]
      .map((type) => ({ type, name: CHALLENGE_LABELS[type] }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [subject]);

  if (lens !== 'challenges' || enteredMonth !== CHALLENGES.MONTH) return null;

  return (
    <aside className="legend" aria-label="Challenges">
      <div className="legend__head">
        <p className="legend__title">
          {ranked
            ? 'Most common'
            : subject
              ? `${traineeById.get(subject)?.name ?? 'They'} · difficulties`
              : 'Kind of difficulty'}
        </p>
        <button
          type="button"
          className="legend__toggle"
          aria-pressed={ranked}
          onClick={toggleRanked}
          title="Rank every kind of difficulty by how many people met it"
        >
          Overall
        </button>
      </div>

      {ranked && <p className="legend__note">how many of the 16 met it</p>}
      <ul className="legend__list">
        {((ranked ? ranking : kinds) as KindEntry[]).map((entry) => (
          <li
            key={entry.type}
            className="legend__item"
          >
            <img
              className="legend__form"
              src={challengeIcon(entry.type)}
              alt=""
              aria-hidden="true"
              draggable={false}
            />
            <span className="legend__name">{entry.name}</span>
            {entry.count !== undefined && (
              <span className="legend__count">{entry.count}</span>
            )}
          </li>
        ))}
      </ul>

      <p className="legend__title legend__title--second">How big the problem was</p>
      <ul className="legend__list legend__list--sizes">
        {SEVERITIES.map((severity) => (
          <li key={severity} className="legend__item">
            {/*
              Drawn at the ratio the world draws it at, so the step between a
              mild difficulty and a severe one is the real one rather than three
              swatches chosen to look tidy.
            */}
            <span className="legend__size" aria-hidden="true">
              <span
                className="legend__size-mark"
                style={{
                  width: `${SEVERITY_SCALE[severity] * 0.62}rem`,
                  height: `${SEVERITY_SCALE[severity] * 0.62}rem`,
                }}
              />
            </span>
            <span className="legend__name">{SEVERITY_LABELS[severity]}</span>
          </li>
        ))}
      </ul>

      {!ranked && focusedTraineeId && (
        <TheirDifficulties traineeId={focusedTraineeId} />
      )}
    </aside>
  );
}

/** How far a difficulty has got, said in the words the brief asked for. */
const STATUS_LABELS: Record<ChallengeStatus, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  overcome: 'Overcome',
};

/**
 * One person's own difficulties, and the gesture that resolves them.
 *
 * The key above says what the colours and sizes mean; this says which ones this
 * person actually met, and it is the only place the world can be told that one
 * of them has been worked through — the fragments themselves are deliberately
 * not click targets, since the orb they are embedded in is what a click is for.
 *
 * Shown only for somebody who has been chosen, never merely pointed at. On
 * hover it would appear and vanish as the pointer crossed the month, and a
 * control that moves out from under the cursor cannot be used.
 */
function TheirDifficulties({ traineeId }: { traineeId: string }) {
  const status = useWorldStore((state) => state.challengeStatus);
  const advanceChallenge = useWorldStore((state) => state.advanceChallenge);

  const records = useMemo(() => challengesOf(traineeId), [traineeId]);
  if (records.length === 0) return null;

  const done = records.filter((r) => status[r.id] === 'overcome').length;

  return (
    <>
      <p className="legend__title legend__title--second">
        {`Overcome · ${done} of ${records.length}`}
      </p>
      <ul className="challenge-list">
        {records.map((record) => {
          const state = status[record.id] ?? 'not-started';
          return (
            <li key={record.id}>
              <button
                type="button"
                className="challenge-list__item"
                data-status={state}
                onClick={() => advanceChallenge(record.id)}
                title="Move this on: not started, in progress, overcome"
              >
                <span className="challenge-list__title">{record.title}</span>
                <span
                  className="challenge-list__kind"
                  // The same tint the glass is cut in, so the key and the world
                  // are one thing to read rather than two to reconcile.
                  style={{ color: TYPE_COLOUR[record.type] }}
                >
                  <span
                    className="challenge-list__swatch"
                    style={{ background: TYPE_COLOUR[record.type] }}
                    aria-hidden="true"
                  />
                  {CHALLENGE_LABELS[record.type]}
                </span>
                <span className="challenge-list__meta">
                  {`${SEVERITY_LABELS[record.severity]} · ${STATUS_LABELS[state]}`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
