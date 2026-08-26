import type { Lens } from '../store/useWorldStore';
import { useWorldStore } from '../store/useWorldStore';
import { BONDS } from '../config/dimensions';

interface LensOption {
  id: Lens;
  label: string;
  /** What foregrounding this actually does, shown on hover. */
  title: string;
  /** Which layers it means anything in. */
  months: number[];
}

/**
 * The lenses, and where each of them applies.
 *
 * Contextual because the months are genuinely about different things: there are
 * no teams in the first month, because nothing was pulling anybody together
 * yet, and the sessions people liked belong to the month that is about them as
 * individuals. Offering a control that would do nothing is worse than not
 * offering it.
 */
const LENSES: LensOption[] = [
  { id: 'people', label: 'People', title: 'The sixteen, individually', months: [0, 1, 2] },
  { id: 'classes', label: 'Classes', title: 'What each person liked most', months: [0] },
  { id: 'teams', label: 'Teams', title: 'Who gathered with whom', months: [1] },
  { id: 'projects', label: 'Projects', title: 'What each team built', months: [1] },
  {
    id: 'challenges',
    label: 'Challenges',
    title: 'What people found hard',
    months: [2],
  },
];

/**
 * What the world is currently about.
 *
 * Not tabs and not a dashboard: a row of marks under the month strip, in the
 * same typographic language, because these are two halves of one idea — *when*
 * you are looking and *what* you are looking at. Choosing one loads nothing and
 * opens nothing; the same tesseract stays on screen and re-weights itself, so
 * the control is a way of reading the world rather than a way of leaving it.
 *
 * A lens that means nothing in the current month is shown dimmed rather than
 * removed, so the shape of what exists stays visible from anywhere.
 */
export function LensControl() {
  const lens = useWorldStore((state) => state.lens);
  const setLens = useWorldStore((state) => state.setLens);
  const enteredMonth = useWorldStore((state) => state.enteredMonth);
  const phase = useWorldStore((state) => state.phase);

  // Outside a layer there is nothing to foreground: the subject is the shape of
  // the training in time, which is what the month strip is for.
  const visible = phase === 'ready' && enteredMonth !== null;

  return (
    <nav className="lens-control" data-visible={visible} aria-label="What to show">
      {LENSES.map((option) => {
        const applies =
          enteredMonth !== null && option.months.includes(enteredMonth);
        const active = applies && option.id === lens;
        return (
          <button
            key={option.id}
            type="button"
            className="lens-control__mark"
            data-active={active}
            data-unavailable={!applies}
            aria-pressed={active}
            disabled={!applies}
            onClick={() => setLens(option.id)}
            title={
              applies
                ? option.title
                : `${option.title} — not in this month`
            }
          >
            {option.label}
          </button>
        );
      })}
    </nav>
  );
}

/** Months in which a lens has anything to show. Used by the scene, not the UI. */
export function lensApplies(lens: Lens, month: number | null): boolean {
  if (month === null) return false;
  const option = LENSES.find((l) => l.id === lens);
  return option ? option.months.includes(month) : false;
}

/** The layer whose story is collaboration, re-exported so callers agree. */
export const TEAM_MONTH = BONDS.MONTH;
