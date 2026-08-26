import { useEffect } from 'react';
import type { MonthIndex } from '../data/world';
import { useWorldStore } from '../store/useWorldStore';

/**
 * Keyboard selection.
 *
 * Bracket keys step through the field rather than Tab, deliberately. Tab is how
 * a keyboard user escapes an embedded canvas, and binding it here would turn
 * the visualization into a keyboard trap — the selection would be reachable and
 * the rest of the page would not.
 *
 * Stepping selects directly rather than moving a separate cursor that then
 * needs confirming. With only sixteen people and the camera easing between
 * them, walking the field one key at a time reads as a tour of the group, which
 * is closer to what the world is for than a two-stage focus-then-commit.
 */
export function useSelectionKeys(orderedIds: string[]): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const store = useWorldStore.getState();

      // The layers are volumes in 3D with nothing for Tab to land on, so the
      // number keys are the only way in from the keyboard. Without one, a
      // keyboard user cannot reach a single person — and Month 1 is the
      // innermost, smallest box, so it is the hardest to hit with a pointer
      // too.
      const month = ['Digit1', 'Digit2', 'Digit3'].indexOf(event.code);
      if (month >= 0) {
        // Pressing the month you are already in leaves it, mirroring what
        // clicking its box does.
        store.enterMonth(
          store.enteredMonth === month ? null : (month as MonthIndex),
        );
        event.preventDefault();
        return;
      }

      const step =
        event.code === 'BracketRight' ? 1 : event.code === 'BracketLeft' ? -1 : 0;
      if (step === 0) return;

      // Stepping through people means nothing until there are people. From
      // outside, the key passes into Month 1 rather than doing nothing at all.
      if (store.enteredMonth === null) {
        store.enterMonth(0);
      } else {
        store.stepFocus(step, orderedIds);
      }
      event.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [orderedIds]);
}
