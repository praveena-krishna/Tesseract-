import { MONTH_LABELS, MONTH_TITLES } from '../data/world';
import type { MonthIndex } from '../data/world';
import { useWorldStore } from '../store/useWorldStore';

const MONTHS: MonthIndex[] = [0, 1, 2];

/**
 * Which months are reachable.
 *
 * All three: the third holds what people found hard, so there is now something
 * inside it to travel to.
 */
const REACHABLE = 3;

/**
 * The three months, as a way in and as a place-marker.
 *
 * Not a set of tabs: three marks on a hairline, because the months are three
 * layers of one structure rather than three screens to switch between. Choosing
 * one does not load anything — the camera travels into that layer of the same
 * tesseract, and the other two stay exactly where they are.
 *
 * It exists because the boxes are nested and identical in language, so nothing
 * about looking at them says which is the first month and which is the second.
 * Pointing at a mark lights the box it names, which is the whole of the
 * connection between the two: the strip is a label for something already in the
 * world, not a separate way of driving it.
 */
export function TimeControl() {
  const enteredMonth = useWorldStore((state) => state.enteredMonth);
  const hoveredMonth = useWorldStore((state) => state.hoveredMonth);
  const enterMonth = useWorldStore((state) => state.enterMonth);
  const hoverMonth = useWorldStore((state) => state.hoverMonth);
  const phase = useWorldStore((state) => state.phase);

  return (
    <nav
      className="time-control"
      data-visible={phase === 'ready'}
      aria-label="Dimensional layers"
    >
      {MONTHS.map((index) => {
        const unreached = index >= REACHABLE;
        const active = index === enteredMonth;
        return (
          <button
            key={index}
            type="button"
            className="time-control__mark"
            data-active={active}
            data-hovered={index === hoveredMonth}
            data-unavailable={unreached}
            aria-pressed={active}
            disabled={unreached}
            onClick={() => enterMonth(active ? null : index)}
            // Pointing at a mark lights the box it names, so the two never read
            // as separate controls that happen to agree.
            onPointerEnter={() => !unreached && hoverMonth(index)}
            onPointerLeave={() => hoverMonth(null)}
            onFocus={() => !unreached && hoverMonth(index)}
            onBlur={() => hoverMonth(null)}
            title={
              unreached
                ? `${MONTH_TITLES[index]} — not built yet`
                : active
                  ? `Leave ${MONTH_TITLES[index]}`
                  : `Enter ${MONTH_TITLES[index]}`
            }
          >
            <span className="time-control__label">{MONTH_LABELS[index]}</span>
            <span className="time-control__title">{MONTH_TITLES[index]}</span>
          </button>
        );
      })}
    </nav>
  );
}
