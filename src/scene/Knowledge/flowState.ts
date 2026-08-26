/**
 * How much knowledge is currently arriving at each person.
 *
 * Written by the flows every frame and read by the vessels, which is a seam
 * rather than a shortcut: the orbs must brighten *because* energy is reaching
 * them, so the thing that knows where the pulses are has to be the thing that
 * decides how brightly each person is lit. Deriving the glow separately from
 * the same growth figure would look similar and mean something different — the
 * light would no longer be caused by what the viewer can see arriving.
 *
 * Held outside React because it is rewritten sixty times a second.
 */

const arriving = new Map<string, number>();

export function publishArrival(personId: string, amount: number): void {
  arriving.set(personId, amount);
}

/** How lit this person is by what is reaching them. Zero if nothing is. */
export function arrivalAt(personId: string): number {
  return arriving.get(personId) ?? 0;
}

export function clearArrivals(): void {
  arriving.clear();
}
