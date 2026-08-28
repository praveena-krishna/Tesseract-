import { MONTH_LABELS, MONTH_TITLES } from '../data/world';
import type { MonthIndex } from '../data/world';
import { projectOf } from '../data/projects';
import { useWorldStore } from '../store/useWorldStore';

/**
 * What the world knows about the current subject.
 *
 * Text is a last resort here, and it has been cut back to the two things a key
 * cannot carry: which layer this is, and what a team actually built. A person
 * is not described here at all. Everything they carry — the classes they liked,
 * the difficulties they met and how large each one was — is read off the keys
 * instead, where it sits beside the colours and forms the world is drawing it
 * in. A paragraph beside the world asks the viewer to hold a description in
 * their head and then go looking for it; a key lets them match what they are
 * looking at against it directly.
 *
 * A project is the exception, and deliberately: what a team built is a fact
 * about a thing, not a channel the figure encodes, so no key can carry it.
 */
export function Readout() {
  const focusedTeamId = useWorldStore((state) => state.focusedTeamId);
  const enteredMonth = useWorldStore((state) => state.enteredMonth);
  const hoveredMonth = useWorldStore((state) => state.hoveredMonth);

  // A chosen project is read here rather than above itself. Two lines floating
  // over the artifact crowd the very thing they describe and move with it as it
  // turns; the panel is still, and the artifact is left alone to be looked at.
  if (enteredMonth !== null && focusedTeamId) {
    return <ProjectReadout teamId={focusedTeamId} month={enteredMonth} />;
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

/**
 * What a team built, read at the side.
 *
 * Short on purpose: a name, what the thing does, and the one line that makes
 * its figure legible rather than decorative. Anything longer turns the month
 * into a document with a picture beside it.
 */
function ProjectReadout({
  teamId,
  month,
}: {
  teamId: string;
  month: MonthIndex;
}) {
  const project = projectOf(teamId);
  if (!project) return null;

  return (
    <aside className="readout" aria-live="polite">
      <p className="readout__eyebrow">{MONTH_LABELS[month]}</p>
      <h2 className="readout__title">{project.name}</h2>
      <Row label="What it is" value={project.description} />
      <Row label="What you are looking at" value={project.reading} />
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
