import raw from './odyssey.json';

/**
 * Which sessions each person liked, and how strongly.
 *
 * Nobody was asked "which class did you enjoy most" in those words, so this is
 * derived — and the derivation is written out here in full, with its confidence
 * carried alongside the answer, because a preference read off a clear response
 * and one squeezed out of somebody who ticked every box must not look the same
 * in the world.
 *
 * Three questions carry signal, and they are not equally strong:
 *
 *   usefulTopics     the feedback survey asked which topics were *most useful*.
 *                    The closest thing in the dataset to an endorsement.
 *   enjoyedActivity  the journey survey asked what they *enjoyed*, which is
 *                    literally the question — but the options are activity
 *                    types, and only two of the six name a session.
 *   interestTopics   the journey survey asked what they were *interested in*.
 *                    Weakest: interest is not the same as having liked it.
 *
 * And one counts against: topics a person named as their toughest. Struggling
 * with something is not the same as disliking it, so this is a penalty rather
 * than an exclusion, and a topic endorsed twice still survives being named hard.
 */

const WEIGHT_USEFUL = 2;
const WEIGHT_ENJOYED = 1.5;
const WEIGHT_INTEREST = 1;
const WEIGHT_TOUGH = -1.5;

/**
 * How many sessions a person's orb shows at once.
 *
 * Not a data limit — a legibility one. Three people ticked all sixteen topics,
 * and sixteen artifacts around one orb is the undifferentiated cluster this
 * whole treatment exists to avoid. The rest are still counted and reported, so
 * the interface can say it is showing five of eleven rather than implying five
 * is all there were.
 */
export const SHOWN_PER_PERSON = 5;

/**
 * Below this separation between best and second, the person's answers did not
 * single anything out and calling one of them "most liked" would be inventing
 * a preference out of a tie.
 */
const CLARITY_THRESHOLD = 0.15;

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()/]/g, ' ')
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * The two enjoyed-activity options that name an actual session.
 *
 * The other four — "Coding/Programming", "Presentations", "Assignments", "Fun
 * Activity" — describe how time was spent rather than which class it was spent
 * in, and mapping them onto a topic would be putting words in people's mouths.
 */
const ACTIVITY_AS_SESSION: Record<string, string> = {
  'Data Visualization': 'data-visualization',
  'Group Project Activities': 'group-project',
};

interface RawSurveys {
  id: string;
  journeySurvey: {
    interestTopics?: string[] | null;
    toughestTopics?: string[] | null;
    enjoyedActivity?: string[] | null;
  } | null;
  feedbackSurvey: { usefulTopics?: string[] | null } | null;
}

const people = raw.people as unknown as RawSurveys[];

/**
 * How many people endorsed each session at all.
 *
 * Used only to break ties, by distinctiveness. A session nearly everyone named
 * says little about any individual; one only two people named says a great
 * deal. Without it, ties resolve alphabetically and half the cohort ends up
 * holding "AI Topics" as their identity because it happens to sort first.
 */
const endorsedBy = new Map<string, number>();
for (const person of people) {
  const named = new Set([
    ...(person.journeySurvey?.interestTopics ?? []),
    ...(person.feedbackSurvey?.usefulTopics ?? []),
  ]);
  for (const topic of named) {
    const id = slug(topic);
    endorsedBy.set(id, (endorsedBy.get(id) ?? 0) + 1);
  }
}

/** How confidently the favourite was identified. */
export type Affinity =
  /** One session clearly stood out in what this person said. */
  | 'named'
  /** They endorsed many about equally; this is the most distinctive of them. */
  | 'broad'
  /** Nothing in either survey to go on. */
  | 'unrecorded';

export interface LikedSession {
  /** Skill id, matching `skills[]` in the source. */
  classId: string;
  /** 0–1 relative to this person's strongest, so orbs are comparable within. */
  strength: number;
  /** True for the single most-liked session. */
  primary: boolean;
}

export interface LearningProfile {
  personId: string;
  /** Ranked, strongest first, capped at `SHOWN_PER_PERSON`. */
  sessions: LikedSession[];
  /** How many sessions this person liked in total, before the cap. */
  likedCount: number;
  affinity: Affinity;
  /** 0–1 separation between the favourite and the runner-up. */
  clarity: number;
}

function deriveFor(person: RawSurveys): LearningProfile {
  const scores = new Map<string, number>();
  const add = (id: string, weight: number) =>
    scores.set(id, (scores.get(id) ?? 0) + weight);

  const useful = person.feedbackSurvey?.usefulTopics ?? [];
  const interest = person.journeySurvey?.interestTopics ?? [];
  const enjoyed = person.journeySurvey?.enjoyedActivity ?? [];

  useful.forEach((topic) => add(slug(topic), WEIGHT_USEFUL));
  interest.forEach((topic) => add(slug(topic), WEIGHT_INTEREST));
  enjoyed.forEach((activity) => {
    const id = ACTIVITY_AS_SESSION[activity];
    if (id) add(id, WEIGHT_ENJOYED);
  });
  (person.journeySurvey?.toughestTopics ?? []).forEach((topic) =>
    add(slug(topic), WEIGHT_TOUGH),
  );

  const ranked = [...scores.entries()]
    .filter(([, score]) => score > 0)
    .sort(
      (a, b) =>
        b[1] - a[1] ||
        (endorsedBy.get(a[0]) ?? 0) - (endorsedBy.get(b[0]) ?? 0) ||
        a[0].localeCompare(b[0]),
    );

  if (ranked.length === 0) {
    return {
      personId: person.id,
      sessions: [],
      likedCount: 0,
      affinity: 'unrecorded',
      clarity: 0,
    };
  }

  const top = ranked[0][1];
  const clarity = ranked.length === 1 ? 1 : (top - ranked[1][1]) / top;
  const named =
    clarity >= CLARITY_THRESHOLD &&
    useful.some((topic) => slug(topic) === ranked[0][0]);

  return {
    personId: person.id,
    sessions: ranked.slice(0, SHOWN_PER_PERSON).map(([classId, score], i) => ({
      classId,
      // Relative to this person's own strongest, not to the cohort: the
      // question each orb answers is "what did *they* respond to", and
      // normalising across people would rank the sixteen against each other on
      // a scale nobody agreed to.
      strength: score / top,
      primary: i === 0,
    })),
    likedCount: ranked.length,
    affinity: named ? 'named' : 'broad',
    clarity,
  };
}

export const learningByPerson = new Map<string, LearningProfile>(
  people.map((person) => [person.id, deriveFor(person)]),
);

/** Every session that at least one person liked, so the scene builds only what it needs. */
export const SESSIONS_IN_USE: string[] = [
  ...new Set(
    [...learningByPerson.values()].flatMap((profile) =>
      profile.sessions.map((session) => session.classId),
    ),
  ),
].sort();
