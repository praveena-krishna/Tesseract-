/**
 * What each person came away knowing.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  PLACEHOLDER DATA — replace the `GROWTH_RECORDS` map below.
 *  Nothing outside this file knows any of these values. Swap the numbers for
 *  the real ones, keep the shape, and the world follows.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Growth is deliberately its own dataset rather than something derived from
 * the skills or confidence figures. Those describe what a person could do and
 * how they felt about it; this describes what the training left them with, and
 * conflating the three would make the glow a restatement of the orb's size and
 * interior rather than a reading of its own.
 */

/**
 * How much each person had gained by the end, 0 to 1.
 *
 * These differ on purpose and by a wide margin. Sixteen orbs at the same
 * brightness would say the training landed identically for everybody, which is
 * the one thing the data never says.
 */
export const GROWTH_RECORDS: Record<string, number> = {
  P01: 0.86,
  P02: 0.41,
  P03: 0.63,
  P04: 0.29,
  P05: 0.74,
  P06: 0.52,
  P07: 0.95,
  P08: 0.18,
  P09: 0.58,
  P10: 0.67,
  P11: 0.35,
  P12: 0.79,
  P13: 0.24,
  P14: 0.71,
  P15: 0.48,
  P16: 0.9,
};

/**
 * How much working through one difficulty adds on top.
 *
 * The point of the month is that overcoming something teaches you something, so
 * a person's glow has to answer to what the viewer has actually resolved rather
 * than sitting at a figure decided in advance. Small enough that the baseline
 * still dominates: the training is where most of it came from.
 */
export const GROWTH_PER_CHALLENGE = 0.14;

/** What this person had before the viewer resolved anything for them. */
export function baselineGrowth(personId: string): number {
  return GROWTH_RECORDS[personId] ?? 0;
}
