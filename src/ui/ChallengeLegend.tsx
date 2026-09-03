import { useMemo } from 'react';
import {
  CHALLENGE_LABELS,
  CHALLENGE_RANKING,
  CHALLENGE_RECORDS,
  MEMBERS_OF,
  SEVERITY_LABELS,
  SEVERITY_SCALE,
  challengesOf,
} from '../data/challenges';
import type { ChallengeType, Severity } from '../data/challenges';
import { traineeById } from '../data/world';
import type { ChallengeStatus } from '../store/useWorldStore';
import { challengeIcon } from './challengeIcons';
import { LegendModes } from './LegendModes';
import { CHALLENGES } from '../config/dimensions';
import { useWorldStore } from '../store/useWorldStore';

/**
 * A row of the key.
 *
 * One row shape serves every state, which is the point. Before this the panel
 * carried a colour key at the top and a second list of the same difficulties at
 * the bottom in a different shape, and once similar difficulties were gathered
 * into kinds the two said the same thing twice down the whole length of the
 * panel. Now there is one list, and choosing somebody changes what each row
 * says and makes it clickable rather than adding another list beneath it.
 *
 * Every row carries a second line, because a colour and a phrase like "a
 * subject was hard" mean nothing until the viewer is told which of the answers
 * people actually gave are gathered under it.
 */
interface KeyRow {
  key: string;
  type: ChallengeType;
  name: string;
  /** What falls under this kind — the line that makes the row legible. */
  under?: string;
  /** How many of the sixteen met it. The ranked view only. */
  count?: number;
  /** How big it was for this person. Shown only when the key is about one. */
  severity?: Severity;
  /** How far they have got with it, and the id to advance when it is clicked. */
  status?: ChallengeStatus;
  recordId?: string;
}

/**
 * The named answers under a kind, as one line.
 *
 * Three of them and then a count. Eleven subjects listed in full would push the
 * key past the height of the window and turn a legend into a paragraph, and the
 * three commonest are enough to say what sort of thing this row means.
 */
function summarise(names: string[]): string {
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} +${names.length - 3} more`;
}

/** Read in the order the fragments are sized, mildest first. */
const SEVERITIES: Severity[] = ['low', 'medium', 'high'];

/**
 * How far a difficulty has got.
 *
 * Nothing is said for one that has not been started, which is the state almost
 * every row is in almost all of the time. Printing "not started" against each
 * of them fills the panel with a word that carries no news; leaving it out
 * means the two rows that *have* moved are the only ones with anything beside
 * them, which is how a list should report a change.
 */
const STATUS_LABELS: Record<ChallengeStatus, string> = {
  'not-started': '',
  'in-progress': 'In progress',
  overcome: 'Overcome',
};

/**
 * The key to the fragments.
 *
 * Two readings are carried at once and neither is guessable, so both are named.
 * **Colour is the kind of difficulty** — seven of them — and **size is how big
 * the problem was**, which is a comparison the eye can only make against
 * something. A viewer looking at one person's orb has no way to know whether
 * the sliver in it is a large problem or a small one without seeing the range
 * it sits in.
 *
 * The size key is drawn at the real ratios rather than three arbitrary
 * swatches, so the step from a mild difficulty to a severe one is the step the
 * world actually draws. It is one line rather than three rows: it is a constant
 * that never changes with the pointer, and a constant should not take a third
 * of the panel or, as it did, end up with a scrollbar of its own.
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
  const challengeStatus = useWorldStore((state) => state.challengeStatus);
  const advanceChallenge = useWorldStore((state) => state.advanceChallenge);

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
   * Whether the rows can be worked through.
   *
   * Only for somebody who has been chosen, never merely pointed at. On hover a
   * control appears and vanishes as the pointer crosses the month, and a button
   * that moves out from under the cursor cannot be used.
   */
  const live = !ranked && subject !== null && subject === focusedTraineeId;

  const rows = useMemo<KeyRow[]>(() => {
    /**
     * Ranked: how many people met each kind, most common first.
     *
     * Counted in people rather than in answers, so somebody who named six
     * subjects counts once — the same way the class ranking counts, so the two
     * months answer in the same units.
     */
    if (ranked) {
      return CHALLENGE_RANKING.map((entry) => ({
        key: entry.type,
        type: entry.type,
        name: entry.name,
        // The commonest single answer inside the kind, so the ranking still
        // says that Devops was the one thing most of them named even though
        // Devops is no longer a row of its own.
        under: entry.leader
          ? `most often ${entry.leader.name} · ${entry.leader.count}`
          : undefined,
        count: entry.count,
      }));
    }

    // Pointing at somebody narrows the key to what *they* ran into, and the
    // second line becomes the answers they themselves gave rather than the
    // cohort's. Seven entries with five greyed out still makes the reader find
    // the two that are not; showing only theirs answers the question outright,
    // and the whole set is one pointer movement away.
    if (subject) {
      return challengesOf(subject)
        .map((record) => ({
          key: record.type,
          type: record.type,
          name: record.title,
          under: summarise(record.members),
          severity: record.severity,
          status: challengeStatus[record.id] ?? 'not-started',
          recordId: record.id,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    const present = new Set<ChallengeType>();
    for (const record of CHALLENGE_RECORDS) present.add(record.type);
    return [...present]
      .map((type) => ({
        key: type,
        type,
        name: CHALLENGE_LABELS[type],
        under: summarise(MEMBERS_OF[type].map((member) => member.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ranked, subject, challengeStatus]);

  /** How far the chosen person has got, for the line under the head. */
  const progress = useMemo(() => {
    if (!live || subject === null) return null;
    const theirs = challengesOf(subject);
    if (theirs.length === 0) return null;
    const done = theirs.filter(
      (record) => challengeStatus[record.id] === 'overcome',
    ).length;
    return `${done} of ${theirs.length} worked through · click one to move it on`;
  }, [live, subject, challengeStatus]);

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
      </div>

      <LegendModes
        personTitle="What the person you are pointing at ran into"
        cohortTitle="Rank every kind of difficulty by how many people met it"
      />

      {ranked && <p className="legend__note">how many of the 16 named it</p>}
      {progress && <p className="legend__note">{progress}</p>}

      <ul className="legend__list">
        {rows.map((entry) => (
          <li
            key={entry.key}
            className="legend__item"
            data-status={entry.status}
          >
            <Row
              entry={entry}
              onAdvance={
                live && entry.recordId
                  ? () => advanceChallenge(entry.recordId as string)
                  : null
              }
            />
          </li>
        ))}
      </ul>

      {/*
        One line, and drawn at the ratio the world draws it at, so the step
        between a mild difficulty and a severe one is the real one rather than
        three swatches chosen to look tidy.
      */}
      <div className="legend__sizes">
        <span className="legend__title legend__title--inline">Size</span>
        {SEVERITIES.map((severity) => (
          <span key={severity} className="legend__size-chip">
            <span className="legend__size" aria-hidden="true">
              <span
                className="legend__size-mark"
                style={{
                  width: `${SEVERITY_SCALE[severity] * 0.62}rem`,
                  height: `${SEVERITY_SCALE[severity] * 0.62}rem`,
                }}
              />
            </span>
            <span className="legend__size-name">{SEVERITY_LABELS[severity]}</span>
          </span>
        ))}
      </div>
      {/*
        Said out loud because it is the one figure in this month nobody in the
        cohort supplied. The sheet records what each person struggled with and
        never how badly, so the sizes are a judgement about what each kind of
        difficulty costs — and a viewer is entitled to know which of the two
        readings in front of them was reported and which was decided.
      */}
      <p className="legend__note legend__note--foot">
        our estimate — the sheet recorded what, not how badly
      </p>
    </aside>
  );
}

/**
 * The body of a row, as a button where it can be acted on and plain text where
 * it cannot.
 *
 * One markup shape either way, so the list does not shift by a pixel when a
 * person is chosen and the rows become live.
 */
function Row({
  entry,
  onAdvance,
}: {
  entry: KeyRow;
  onAdvance: (() => void) | null;
}) {
  const body = (
    <>
      <img
        className="legend__form"
        src={challengeIcon(entry.type)}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
      <span className="legend__text">
        <span className="legend__name">{entry.name}</span>
        {entry.under && <span className="legend__under">{entry.under}</span>}
      </span>
      {(entry.count !== undefined || entry.severity || entry.status) && (
        <span className="legend__meta">
          {entry.count !== undefined && (
            <span className="legend__count">{entry.count}</span>
          )}
          {entry.severity && (
            <span className="legend__severity">
              {SEVERITY_LABELS[entry.severity]}
            </span>
          )}
          {entry.status && STATUS_LABELS[entry.status] && (
            <span className="legend__status">{STATUS_LABELS[entry.status]}</span>
          )}
        </span>
      )}
    </>
  );

  if (!onAdvance) return <span className="legend__row">{body}</span>;

  return (
    <button
      type="button"
      className="legend__row legend__row--live"
      onClick={onAdvance}
      title="Move this on: not started, in progress, overcome"
    >
      {body}
    </button>
  );
}
