import { useEffect } from 'react';
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

      const step =
        event.code === 'BracketRight' ? 1 : event.code === 'BracketLeft' ? -1 : 0;
      if (step === 0) return;

      useWorldStore.getState().stepFocus(step, orderedIds);
      event.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [orderedIds]);
}
