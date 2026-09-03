import { useWorldStore } from '../store/useWorldStore';

/**
 * The second way out, in the head of an open key.
 *
 * The button that opens a key sits at the foot of the screen — see
 * `LegendKeyControl` — and pressing it again closes it. This is kept alongside
 * because a key can run the full height of the window, and reaching the bottom
 * of the screen to close something you are reading at the top of it is a
 * journey. Either closes it; neither is the only way.
 */
export function LegendCloseButton() {
  const setLegendOpen = useWorldStore((state) => state.setLegendOpen);

  return (
    <button
      type="button"
      className="legend-tab__close"
      onClick={() => setLegendOpen(false)}
      title="Hide this key"
    >
      Hide
    </button>
  );
}
