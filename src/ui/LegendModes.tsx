import { useWorldStore } from '../store/useWorldStore';

/**
 * The two readings a key can be given, offered as two named options.
 *
 * This was one button that swapped its own label — "Overall", and once pressed,
 * "One person". It read as half a switch, because the key's heading changed at
 * the same moment and sat right beside it: "Most liked" next to "One person"
 * looks exactly like a pair of tabs with the left one selected. Clicking the
 * heading did nothing, which left no visible way back at all.
 *
 * So both readings are buttons now and both are always on screen. The one you
 * are in is lit and underlined, the other is dim until the pointer finds it,
 * and neither is ever the only thing you can press. The heading above them goes
 * back to naming what the key is showing rather than doubling as a control.
 */
interface LegendModesProps {
  /** What reading the key by one person answers, for that option's tooltip. */
  personTitle: string;
  /** What reading it across all sixteen answers. */
  cohortTitle: string;
}

export function LegendModes({ personTitle, cohortTitle }: LegendModesProps) {
  const ranked = useWorldStore((state) => state.ranked);
  const setRanked = useWorldStore((state) => state.setRanked);

  return (
    <div className="legend__modes" role="group" aria-label="How to read this key">
      <button
        type="button"
        className="legend__mode"
        aria-pressed={!ranked}
        onClick={() => setRanked(false)}
        title={personTitle}
      >
        One person
      </button>
      <button
        type="button"
        className="legend__mode"
        aria-pressed={ranked}
        onClick={() => setRanked(true)}
        title={cohortTitle}
      >
        Overall
      </button>
    </div>
  );
}
