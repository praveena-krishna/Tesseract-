import { MONTH_LABELS, MONTH_TITLES } from '../data/world';
import type { MonthIndex } from '../data/world';
import { useWorldStore } from '../store/useWorldStore';

const MONTHS: MonthIndex[] = [0, 1, 2];

/**
 * Movement through the three months.
 *
 * Not a media player and not a set of tabs: three marks on a line, because the
 * months are positions in one continuous transformation rather than three
 * screens to switch between. Choosing one does not load anything — the same
 * world reorganises itself, and the control's only job is to say where in that
 * transformation you currently are.
 *
 * When the training is shortened by a counterfactual, the third mark is shown
 * as unreachable rather than removed, so the viewer can see what was lost.
 */
export function TimeControl() {
  const month = useWorldStore((state) => state.month);
  const setMonth = useWorldStore((state) => state.setMonth);
  const months = useWorldStore((state) => state.whatIf.months);
  const phase = useWorldStore((state) => state.phase);

  return (
    <div className="time-control" data-visible={phase === 'ready'}>
      {MONTHS.map((index) => {
        const unavailable = index >= months;
        return (
          <button
            key={index}
            type="button"
            className="time-control__mark"
            data-active={index === month}
            data-unavailable={unavailable}
            aria-current={index === month}
            disabled={unavailable}
            onClick={() => setMonth(index)}
            title={
              unavailable
                ? 'Not reached — training shortened to two months'
                : MONTH_TITLES[index]
            }
          >
            <span className="time-control__label">{MONTH_LABELS[index]}</span>
            <span className="time-control__title">{MONTH_TITLES[index]}</span>
          </button>
        );
      })}
    </div>
  );
}
