import { lensApplies } from './LensControl';
import { useWorldStore, type Lens } from '../store/useWorldStore';

/**
 * The one control that opens and closes whichever key belongs here.
 *
 * Mounted once rather than once per key, and that is the point of it. Each key
 * decides for itself whether it has anything to say in this month under this
 * lens, and if this were part of them the button would come and go with the
 * panel it opens — pressed once to open, then gone from under the pointer just
 * as you might press it again. It sits still instead, lights while its key is
 * open, and closes it when pressed a second time.
 *
 * It lives at the foot of the screen next to the sound control because these
 * are the two things that are about *reading* the world rather than moving
 * through it, so there is one place to look for either.
 */

/** Which lenses have a key worth opening, and what to call it. */
const KEYED: Partial<Record<Lens, string>> = {
  classes: 'Classes',
  challenges: 'Challenges',
  databricks: 'Databricks',
};

export function LegendKeyControl() {
  const lens = useWorldStore((state) => state.lens);
  const enteredMonth = useWorldStore((state) => state.enteredMonth);
  const legendOpen = useWorldStore((state) => state.legendOpen);
  const setLegendOpen = useWorldStore((state) => state.setLegendOpen);

  const label = KEYED[lens];
  // The same gate the keys themselves use, read from the same table the lens
  // row is built from — so the button cannot offer a key that would not appear.
  if (!label || !lensApplies(lens, enteredMonth)) return null;

  return (
    <div className="legend-tab">
      <button
        type="button"
        className="legend-tab__button"
        aria-pressed={legendOpen}
        onClick={() => setLegendOpen(!legendOpen)}
        title={
          legendOpen
            ? `Hide what the ${label.toLowerCase()} marks mean`
            : `Show what the ${label.toLowerCase()} marks mean`
        }
      >
        {label} key
      </button>
    </div>
  );
}
