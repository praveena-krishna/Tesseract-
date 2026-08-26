import { useEffect } from 'react';
import { useWorldStore } from '../store/useWorldStore';

/**
 * Turns the cursor into a pointer while something enterable is under it.
 *
 * There are two such things and they sit at different depths: a dimensional
 * layer from outside, a person from within one. Neither announces itself in a
 * continuous field, and discovering by chance that the world responds is not
 * the same as being invited to try.
 */
export function useHoverCursor(): void {
  const hoveredTraineeId = useWorldStore((state) => state.hoveredTraineeId);
  const hoveredMonth = useWorldStore((state) => state.hoveredMonth);
  const hovering = hoveredTraineeId !== null || hoveredMonth !== null;

  useEffect(() => {
    if (!hovering) return;

    const previous = document.body.style.cursor;
    document.body.style.cursor = 'pointer';
    return () => {
      document.body.style.cursor = previous;
    };
  }, [hovering]);
}
