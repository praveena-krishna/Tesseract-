import {
  MAX_CHALLENGES,
  MAX_SKILLS,
  MONTH_LABELS,
  challengeById,
  skillById,
  teamById,
  traineeById,
} from '../data/world';
import { resolveTrainee } from '../sim/whatIf';
import { useWorldStore } from '../store/useWorldStore';

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
  const focusedTeamId = useWorldStore((state) => state.focusedTeamId);
  const month = useWorldStore((state) => state.month);
  const whatIf = useWorldStore((state) => state.whatIf);

  if (focusedTeamId) return <TeamReadout teamId={focusedTeamId} />;
  if (focusedTraineeId) {
    return (
      <TraineeReadout traineeId={focusedTraineeId} month={month} whatIf={whatIf} />
    );
  }
  return null;
}

function TraineeReadout({
  traineeId,
  month,
  whatIf,
}: {
  traineeId: string;
  month: ReturnType<typeof useWorldStore.getState>['month'];
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

function TeamReadout({ teamId }: { teamId: string }) {
  const month = useWorldStore((state) => state.month);
  const whatIf = useWorldStore((state) => state.whatIf);
  const team = teamById.get(teamId);
  if (!team) return null;

  const members = team.memberIds
    .map((id) => traineeById.get(id))
    .filter((model): model is NonNullable<typeof model> => model != null);

  // Skills the team collectively holds this month, and what they struggled
  // with — the project described by the people in it rather than by a blurb.
  const skills = new Set<string>();
  const challenges = new Set<string>();
  for (const model of members) {
    if (model.id === whatIf.removedTraineeId) continue;
    const state = resolveTrainee(model, month, whatIf, MAX_SKILLS, MAX_CHALLENGES);
    state.skillIds.forEach((id) => skills.add(id));
    state.challengeIds.forEach((id) => challenges.add(id));
  }

  const present = members.filter((model) => model.id !== whatIf.removedTraineeId);

  return (
    <aside className="readout" aria-live="polite">
      <p className="readout__eyebrow">Project · {MONTH_LABELS[month]}</p>
      <h2 className="readout__title">{team.name}</h2>

      <Row
        label={`Members · ${present.length}`}
        value={present.map((model) => model.name).join(', ')}
        note={
          present.length < members.length
            ? `${members.length - present.length} absent under the current conditions`
            : undefined
        }
      />

      <Row
        label={`Skills in play · ${skills.size}`}
        value={
          [...skills]
            .map((id) => skillById.get(id)?.name ?? id)
            .slice(0, NAME_LIMIT)
            .join(', ') || 'None yet'
        }
        note={skills.size > NAME_LIMIT ? `and ${skills.size - NAME_LIMIT} more` : undefined}
      />

      <Row
        label={`Challenges · ${challenges.size}`}
        value={
          [...challenges]
            .map((id) => challengeById.get(id)?.name ?? id)
            .slice(0, NAME_LIMIT)
            .join(', ') || 'None recorded'
        }
      />

      <Row
        label="Formation"
        value={`${Math.round(team.maturityByMonth[Math.min(month, whatIf.months - 1)] * 100)}% built`}
        note="from how often the logs record work on it"
      />
    </aside>
  );
}

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
