/**
 * What each person rated the Databricks class, out of four.
 *
 * Real data, taken from the cohort sheet ("Trainees data.csv", column
 * "DATABRICKS_RATING"). All sixteen answered, so nothing here is inferred and
 * nothing is missing.
 *
 * The rating is drawn as the weight of the line joining that person to the
 * knowledge core — a four is a thick beam, a one is a hairline. Nothing else
 * carries it: every vessel in that month burns at the same brightness, so the
 * line is the only thing distinguishing them and there is no second channel to
 * disagree with it.
 *
 * Worth knowing before reading the month: the answers are clustered. Twelve of
 * the sixteen gave a three, two gave a four and two gave a two, so the field of
 * beams is deliberately close to uniform with four exceptions. That is what the
 * cohort said, and flattening or spreading it to make the picture livelier
 * would be inventing disagreement that was never there.
 */

/**
 * A rating as recorded, or null where nobody recorded one.
 *
 * Null is not one. Somebody nobody assessed and somebody assessed at the bottom
 * of the scale are different facts, and the world draws them differently: the
 * unrated have no line at all rather than the thinnest one. No one in this
 * cohort is unrated, but the case is kept because the next cohort may be.
 */
export type Rating = 1 | 2 | 3 | 4 | null;

/** The top of the scale, and so also the most strands a beam can carry. */
export const RATING_MAX = 4;

/**
 * Each person's rating, by id.
 *
 * Ids are the dataset's own (`src/data/odyssey.json`); the names are here only
 * so this table can be checked against the sheet by eye.
 */
export const RATINGS: Record<string, Rating> = {
  P01: 3, // Ajay Kumar
  P02: 4, // Anbarasan K
  P03: 3, // Deepa Saravanan
  P04: 3, // Elamaran A
  P05: 3, // Eraianbu A
  P06: 3, // Kavipriya R
  P07: 3, // Kavirajan N
  P08: 4, // Ragul D
  P09: 3, // SaiSathya Ramamoorthy
  P10: 2, // Sanjay Kumar J
  P11: 3, // Sivarakshan R
  P12: 3, // Subasri R
  P13: 2, // Syril A
  P14: 3, // Vignesh Siva
  P15: 3, // Yugendhran V Venkatajalapathy
  P16: 3, // Praveena
};

/* ------------------------------------------------------------------ *
 * The mapping
 * ------------------------------------------------------------------ */

/** The rating this person carries, or null. */
export function ratingOf(personId: string): Rating {
  return RATINGS[personId] ?? null;
}

/**
 * How many strands this person's beam is drawn with.
 *
 * The rating itself, which is the whole of the mapping — a three is three
 * strands, and can be counted as three without being held up against the key.
 * An unrated person gets none, and so has no line.
 */
export function strandsFor(rating: Rating): number {
  return rating === null ? 0 : rating;
}

/** How many strands this person's beam is drawn with, by id. */
export function strandsOf(personId: string): number {
  return strandsFor(ratingOf(personId));
}
