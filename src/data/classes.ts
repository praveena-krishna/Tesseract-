import raw from './odyssey.json';

/**
 * Which classes each person named.
 *
 * This is now read straight off the cohort sheet rather than inferred. The
 * sheet ("Trainees data.csv") has one row per trainee with a "Classes" column
 * listing the classes they named, and that list is carried into
 * `people[].skillIds` in `src/data/odyssey.json`, which is what this file
 * reads. There is no scoring, no weighting and no penalty any more: an earlier
 * version of this file blended three survey questions to guess at a preference
 * because nobody had been asked the question directly. They had been — on this
 * sheet — so the guess is gone.
 *
 * What the sheet does not say is how strongly. A person who named eleven
 * classes named all eleven equally as far as the record goes, so nothing here
 * ranks them by enthusiasm and nothing draws one larger than another for having
 * been liked more. The only ordering imposed is which of them are shown when
 * there are more than fit, and that is a display decision, described below.
 */

/**
 * How many classes a person's orb shows at once.
 *
 * Not a data limit — a legibility one. Three people named all sixteen classes,
 * and sixteen objects around one vessel is the undifferentiated cluster this
 * whole treatment exists to avoid. The rest are still counted and reported, so
 * the interface says it is showing five of sixteen rather than implying five is
 * all there were.
 */
export const SHOWN_PER_PERSON = 5;

interface RawPerson {
  id: string;
  skillIds: string[];
}

const people = raw.people as unknown as RawPerson[];

/**
 * How many people named each class.
 *
 * Used to decide which of a person's classes are shown when they named more
 * than fit. A class nearly everyone named says little about any individual; one
 * only four people named says a great deal — so the shown five are the most
 * distinctive of what that person named, and the orbs differ from each other
 * instead of all carrying the same handful of near-universal classes.
 */
const namedBy = new Map<string, number>();
for (const person of people) {
  for (const classId of person.skillIds) {
    namedBy.set(classId, (namedBy.get(classId) ?? 0) + 1);
  }
}

export interface LikedSession {
  /** Class id, matching `skills[]` in the source. */
  classId: string;
  /**
   * Always 1.
   *
   * Kept because the objects are drawn against it, and set flat because the
   * sheet records which classes a person named and not how strongly. Anything
   * else here would be a preference nobody expressed.
   */
  strength: number;
  /**
   * The most distinctive class this person named — the rarest across the
   * cohort. Drawn largest and closest in, so a vessel leads with what sets that
   * person apart rather than with whatever happens to sort first.
   */
  primary: boolean;
}

export interface LearningProfile {
  personId: string;
  /** Most distinctive first, capped at `SHOWN_PER_PERSON`. */
  sessions: LikedSession[];
  /** How many classes this person named in total, before the cap. */
  likedCount: number;
  /** Every class they named, uncapped — what the ranking is counted from. */
  liked: string[];
}

function deriveFor(person: RawPerson): LearningProfile {
  const ranked = [...person.skillIds].sort(
    (a, b) => (namedBy.get(a) ?? 0) - (namedBy.get(b) ?? 0) || a.localeCompare(b),
  );

  return {
    personId: person.id,
    sessions: ranked.slice(0, SHOWN_PER_PERSON).map((classId, i) => ({
      classId,
      strength: 1,
      primary: i === 0,
    })),
    likedCount: ranked.length,
    liked: ranked,
  };
}

export const learningByPerson = new Map<string, LearningProfile>(
  people.map((person) => [person.id, deriveFor(person)]),
);

/** How many of the sixteen named this class. Counted from what they said, not from what is drawn. */
export function namedByCount(classId: string): number {
  return namedBy.get(classId) ?? 0;
}

/** Every class at least one person named, so the ranking has a roster to walk. */
export const CLASSES_IN_USE: string[] = [...namedBy.keys()].sort();

/** Every class that at least one person's orb draws, so the scene builds only what it needs. */
export const SESSIONS_IN_USE: string[] = [
  ...new Set(
    [...learningByPerson.values()].flatMap((profile) =>
      profile.sessions.map((session) => session.classId),
    ),
  ),
].sort();
