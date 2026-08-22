import { useEffect } from 'react';
import { useWorldStore } from '../store/useWorldStore';

/**
 * Turns the cursor into a pointer while an orb is under it.
 *
 * The orbs are the only interactive things in an otherwise continuous field, so
 * without this the world gives no indication that any of it can be clicked —
 * and discovering that by chance is not the same as being invited to.
 */
export function useHoverCursor(): void {
  const hoveredTraineeId = useWorldStore((state) => state.hoveredTraineeId);

  useEffect(() => {
    if (!hoveredTraineeId) return;

    const previous = document.body.style.cursor;
    document.body.style.cursor = 'pointer';
    return () => {
      document.body.style.cursor = previous;
    };
  }, [hoveredTraineeId]);
}
