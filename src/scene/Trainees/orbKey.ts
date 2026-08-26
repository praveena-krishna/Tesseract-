/**
 * Composite identity for one person standing in one dimensional layer.
 *
 * The same sixteen people exist in more than one month at once, so every map
 * that holds a position, a centroid or a piece of per-orb state is keyed by
 * both. Keying by person alone silently collapses the layers onto each other,
 * which shows up as everybody's Month 2 self standing exactly where their
 * Month 1 self is.
 */
export function orbKey(month: number, traineeId: string): string {
  return `${month}:${traineeId}`;
}
