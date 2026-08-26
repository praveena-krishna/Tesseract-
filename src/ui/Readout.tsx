import { useMemo } from 'react';
import {
  CHALLENGE_LABELS,
  SEVERITY_LABELS,
  TYPE_COLOUR,
  challengesOf,
} from '../data/challenges';
import {
  MAX_CHALLENGES,
  teamById,
  MAX_SKILLS,
  MONTH_LABELS,
  MONTH_TITLES,
  challengeById,
  skillById,
  traineeById,
} from '../data/world';
import type { MonthIndex } from '../data/world';
import { resolveTrainee } from '../sim/whatIf';
import { useWorldStore } from '../store/useWorldStore';
import type { ChallengeStatus } from '../store/useWorldStore';

/** Skills and challenges worth naming before the list becomes a wall. */
const NAME_LIMIT = 6;

/**
 * What the world knows about the current subject.
 *
 * Text is a last resort here — the orb already shows how much someone has
 * learned and how hard it has been, and this only names the things that light
 * cannot: which topics, which difficulties, which project. It stays a column of
 * plain lines rather than a panel of fields, and it appears only once something
 * has been chosen.
 *
 * Where a value is derived rather than recorded, it says so. The middle month's
 * confidence is interpolated between the two figures people actually gave, and
 * presenting that as though it were measured would be a small lie told in a
 * place the viewer has no way to check.
 */
export function Readout() {
  const focusedTraineeId = useWorldStore((state) => state.focusedTraineeId);
  const hoveredTraineeId = useWorldStore((state) => state.hoveredTraineeId);
  const lens = useWorldStore((state) => state.lens);
  const focusedTeamId = useWorldStore((state) => state.focusedTeamId);
  const enteredMonth = useWorldStore((state) => state.enteredMonth);
  const hoveredMonth = useWorldStore((state) => state.hoveredMonth);
  const whatIf = useWorldStore((state) => state.whatIf);

  // A chosen project says what it is beside the artifact itself, in two lines
  // anchored in the world. Opening a panel here as well would put a second,
  // louder answer on screen and make the artifact decoration next to it.
  if (enteredMonth !== null && focusedTeamId) return null;
  // Under the lens that is about difficulty, passing the pointer over somebody
  // is enough to read them. A chosen person still outranks a hovered one, so
  // sweeping across the month cannot steal the panel away from whoever is
  // being examined.
  const subject =
    focusedTraineeId ?? (lens === 'challenges' ? hoveredTraineeId : null);
  if (enteredMonth !== null && subject) {
    return (
      <TraineeReadout
        traineeId={subject}
        month={enteredMonth}
        whatIf={whatIf}
      />
    );
  }

  // Nothing chosen: name the layer under the pointer, or the one being stood
  // in. Without this the boxes are unlabelled and there is no way to tell which
  // of the three is which month short of entering one and reading the camera.
  const month = enteredMonth ?? hoveredMonth;
  if (month === null) return null;
  return <MonthReadout month={month} inside={enteredMonth !== null} />;
}

/**
 * Which layer this is.
 *
 * One line, shown while a box is pointed at from outside or while the viewer is
 * standing in one. The boxes are nested and identical in language, so nothing
 * about looking at them says which is the first month and which is the second —
 * and the whole temporal structure is unreadable until something does.
 */
function MonthReadout({ month, inside }: { month: MonthIndex; inside: boolean }) {
  const position = ['innermost', 'middle', 'outer'][month];
  return (
    <aside className="readout" aria-live="polite">
      <p className="readout__eyebrow">
        {inside ? 'Inside' : 'Dimensional layer'} · {MONTH_LABELS[month]}
      </p>
      <h2 className="readout__title">{MONTH_TITLES[month]}</h2>
      <div className="readout__row">
        <p className="readout__label">Which box</p>
        <p className="readout__value">The {position} one</p>
        {!inside && (
          <p className="readout__note">
            click it, or press {month + 1}, to go inside
          </p>
        )}
      </div>
    </aside>
  );
}

function TraineeReadout({
  traineeId,
  month,
  whatIf,
}: {
  traineeId: string;
  month: MonthIndex;
  whatIf: ReturnType<typeof useWorldStore.getState>['whatIf'];
}) {
  const model = traineeById.get(traineeId);
  if (!model) return null;

  const state = resolveTrainee(model, month, whatIf, MAX_SKILLS, MAX_CHALLENGES);
  const team = model.projectId ? teamById.get(model.projectId) : undefined;
  const removed = model.id === whatIf.removedTraineeId;

  const skillNames = state.skillIds
    .map((id) => skillById.get(id)?.name ?? id)
    .slice(0, NAME_LIMIT);
  const challengeNames = state.challengeIds
    .map((id) => challengeById.get(id)?.name ?? id)
    .slice(0, NAME_LIMIT);

  return (
    <aside className="readout" aria-live="polite">
      <p className="readout__eyebrow">{MONTH_LABELS[month]}</p>
      <h2 className="readout__title">{model.name}</h2>

      {removed && (
        <p className="readout__flag">Not present under the current conditions</p>
      )}

      <Row label="Project" value={team?.name ?? 'Not recorded'} />

      <Row
        label="Confidence"
        value={
          state.confidence == null
            ? 'Never reported'
            : `${state.confidence.toFixed(1)} of 5`
        }
        note={
          state.confidence == null
            ? undefined
            : month === 1
              ? 'interpolated between start and end'
              : month === 0
                ? 'as reported at the start'
                : 'as reported at the end'
        }
      />

      <Row
        label={`Skills · ${state.skillIds.length}`}
        value={skillNames.join(', ') || 'None recorded yet'}
        note={
          state.skillIds.length > NAME_LIMIT
            ? `and ${state.skillIds.length - NAME_LIMIT} more`
            : undefined
        }
      />

      <ChallengeRows traineeId={traineeId} />

      <Row
        label={`Challenges · ${state.challengeIds.length}`}
        value={challengeNames.join(', ') || 'None recorded'}
        note={
          state.challengeIds.length > NAME_LIMIT
            ? `and ${state.challengeIds.length - NAME_LIMIT} more`
            : undefined
        }
      />
    </aside>
  );
}

/**
 * What this person found hard, and the one gesture that resolves it.
 *
 * Only under the lens that is about difficulty: everywhere else this would be
 * a column of trouble attached to somebody being read for another reason
 * entirely. Each line is the difficulty itself, and choosing it is what marks
 * it worked through — the knot beside their orb goes out, their vessel comes
 * up brighter, and what they took from it is what the line then says.
 */
function ChallengeRows({ traineeId }: { traineeId: string }) {
  const lens = useWorldStore((state) => state.lens);
  const status = useWorldStore((state) => state.challengeStatus);
  const advanceChallenge = useWorldStore((state) => state.advanceChallenge);

  const records = useMemo(() => challengesOf(traineeId), [traineeId]);
  if (lens !== 'challenges' || records.length === 0) return null;

  const done = records.filter((r) => status[r.id] === 'overcome').length;

  return (
    <div className="readout__row">
      <p className="readout__label">
        {`Challenges · ${done} of ${records.length} overcome`}
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
                  // The same tint the glass is cut in, so the panel and the
                  // world are one key rather than two to reconcile.
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
    </div>
  );
}

/** How far a difficulty has got, said in the words the brief asked for. */
const STATUS_LABELS: Record<ChallengeStatus, string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  overcome: 'Overcome',
};

function Row({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="readout__row">
      <p className="readout__label">{label}</p>
      <p className="readout__value">{value}</p>
      {note && <p className="readout__note">{note}</p>}
    </div>
  );
}
