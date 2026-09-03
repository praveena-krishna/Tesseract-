import raw from './odyssey.json';

/**
 * What each person found hard, gathered into kinds.
 *
 * Real data. The cohort sheet ("Trainees data.csv") has one row per trainee
 * with a "CHALLENGES" column naming what they struggled with, the names
 * separated by a pipe; those lists are carried into `challenges[]` in
 * `src/data/odyssey.json` as one entry per named difficulty with the people it
 * affected, and this file reads them back out. All sixteen have answered — the
 * sheet's one empty cell has since been filled — so nobody is drawn empty for
 * want of a record.
 *
 * **Similar problems are drawn as one.** Twenty-six distinct difficulties were
 * named, and one person named thirteen of them — which arrived as thirteen
 * fragments in one vessel, most of them the same colour as each other because
 * six of the thirteen were "a subject was hard". A pile of near-identical
 * splinters cannot be read, so the twenty-six are gathered into seven kinds and
 * a person carries *one* fragment per kind, however many things they named
 * inside it. Nobody now carries more than six, and no two fragments in a vessel
 * are the same colour.
 *
 * Nothing is lost by the gathering. Each fragment keeps the exact things that
 * were named in `members`, and the list beside a chosen person spells them out —
 * so the vessel is legible from across the month and the detail is one click
 * away rather than crowded into the glass.
 *
 * Two judgements are made here rather than read. Which kind a difficulty
 * belongs to (`FAMILY_OF`), and how much it cost (`IMPACT_OF`) — the sheet
 * records what people struggled with and never how badly. The second is
 * labelled as a judgement wherever it is shown.
 */

/**
 * How big the problem was.
 *
 * This is the shard's size and nothing else. A person's worst difficulty should
 * be the largest thing hanging off them, and be seen to be, from across the
 * month and without reading a word.
 */
export type Severity = 'low' | 'medium' | 'high';

/**
 * The families of difficulty.
 *
 * Each carries its own colour, and here that is the point rather than a thing
 * to apologise for: a dozen fragments sitting together around one person need
 * to be told apart at a glance, and hue is the only channel that survives being
 * small, half-lit and seen edge-on. Size is already saying how bad it was, so it
 * is not available to say what it was.
 *
 * The split follows what the answers actually are. Half of them name a subject
 * that was taught — those are `topic`, whichever subject it was, because "a
 * class was hard" is one kind of problem however many classes it happened to.
 * The rest describe the training itself, and separate cleanly by what they cost
 * the person: their understanding, their working setup, their time, their
 * attention through a session, the work they were set, or their footing in a
 * group.
 */
export type ChallengeType =
  | 'topic'
  | 'understanding'
  | 'technical'
  | 'pace'
  | 'time'
  | 'coursework'
  | 'collaboration';

/**
 * One kind of difficulty, as one person met it.
 *
 * A record is a *group*, not a single answer: everything one person named that
 * belongs to the same kind arrives as one of these, and one fragment of glass.
 * Somebody who named Devops, Testing and Linux carries a single "a subject was
 * hard" record listing all three.
 */
export interface ChallengeRecord {
  /** Stable identity, so a difficulty worked through stays worked through. */
  id: string;
  personId: string;
  type: ChallengeType;
  severity: Severity;
  /** The kind's name — what the fragment is, said in one line. */
  title: string;
  /**
   * The exact things this person named inside this kind, in the sheet's own
   * words, commonest across the cohort first. Never empty.
   */
  members: string[];
}

export const CHALLENGE_LABELS: Record<ChallengeType, string> = {
  topic: 'A subject was hard',
  understanding: 'Following the explanation',
  technical: 'Technical trouble',
  pace: 'How the sessions ran',
  time: 'Time and scheduling',
  coursework: 'The work that was set',
  collaboration: 'Working with others',
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

/** The shard's length, as a multiple of the base shard. Size is impact. */
export const SEVERITY_SCALE: Record<Severity, number> = {
  low: 0.58,
  medium: 1,
  high: 1.52,
};

/**
 * The colour each family of glass is.
 *
 * Saturated and hot, not pale. An earlier pass had these as light pastels on
 * the reasoning that they are read through violet crystal and anything dark
 * arrives muddy — which is true, and is why these stay high in value. But light
 * *and* washed out reads as decoration, and a difficulty is not decorative.
 * Holding the value and pushing the chroma keeps them legible through the glass
 * while making them look like something that would cut.
 *
 * The hues stay spread right around the wheel so seven of them can sit on one
 * person and still be told apart.
 */
export const TYPE_COLOUR: Record<ChallengeType, string> = {
  topic: '#2f8bff',
  understanding: '#35d24a',
  technical: '#0fd6d6',
  pace: '#ffb400',
  time: '#ff2d55',
  coursework: '#8b3dff',
  collaboration: '#ff6a1f',
};

/**
 * How each family is cut, and how far into the vessel it sits.
 *
 * `points` is how many scattered points the fragment's hull is taken over —
 * fewer gives a blunter, chunkier piece, more gives a splintered one.
 *
 * `depth` is where its centre rests, as a fraction of the orb's radius, and it
 * sits near one on purpose: a fragment whose centre is at the shell has half of
 * itself driven into the crystal and half still standing out of it, which is
 * what having struck reads as. Set well under one they float in the middle of
 * the orb like debris that was always there, which says nothing happened.
 */
export const TYPE_CUT: Record<
  ChallengeType,
  { points: number; depth: number }
> = {
  topic: { points: 11, depth: 0.88 },
  understanding: { points: 7, depth: 0.8 },
  technical: { points: 12, depth: 0.9 },
  pace: { points: 10, depth: 1.0 },
  time: { points: 8, depth: 1.02 },
  coursework: { points: 9, depth: 0.96 },
  collaboration: { points: 10, depth: 1.06 },
};

/* ------------------------------------------------------------------ *
 * The two judgements
 * ------------------------------------------------------------------ */

/**
 * Which family each named difficulty belongs to.
 *
 * Keyed by the id in `odyssey.json`. Every one of the twenty-six is listed
 * rather than pattern-matched, because a rule that guessed from the words would
 * put "Self Learning by Trainee members" — a class on the timetable — in with
 * the complaints about how sessions ran.
 */
export const FAMILY_OF: Record<string, ChallengeType> = {
  // Subjects that were taught, and were hard.
  'ai-topics': 'topic',
  'backend-nextjs': 'topic',
  cybersecurity: 'topic',
  'data-visualization': 'topic',
  'data-visualization-project': 'topic',
  devops: 'topic',
  iot: 'topic',
  linux: 'topic',
  'self-learning-by-trainee-members': 'topic',
  testing: 'topic',
  'web-mobile-application': 'topic',

  // The explanation did not land.
  'concept-explanation': 'understanding',
  'understanding-concepts': 'understanding',

  // The machinery got in the way.
  'technical-issues': 'technical',

  // How the sessions themselves ran.
  'long-discussions': 'pace',
  'repeated-topics': 'pace',
  'topic-switching': 'pace',
  'training-pace': 'pace',
  'waiting-time': 'pace',

  // Fitting it all in.
  'scheduling-timeline': 'time',
  'time-management': 'time',

  // The work that was set.
  assignments: 'coursework',
  'lack-of-practical-sessions': 'coursework',
  'training-content': 'coursework',

  // Other people.
  'group-activities': 'collaboration',
  teamwork: 'collaboration',
};

/**
 * How much each difficulty cost, low to high.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  EDITORIAL. The sheet records *what* each person struggled with and never
 *  *how badly*, so this is a judgement rather than a reading, and the key on
 *  screen says so. It is the one number in the third month that nobody in the
 *  cohort supplied.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The scale is what the difficulty costs, not how loudly it would be
 * complained about:
 *
 *   high     it stops you learning the thing at all. Not following the
 *            explanation, an environment that will not run, or a pace you have
 *            already fallen off — nothing later lands until these are fixed.
 *   medium   it holds up one front. A subject you find hard is real work but it
 *            is one subject; coursework, scheduling and a difficult group are
 *            the same shape.
 *   low      it costs time and attention but not comprehension. Sitting through
 *            a long discussion or a topic you already had is a waste, and being
 *            wasted is not the same as being stuck.
 */
export const IMPACT_OF: Record<string, Severity> = {
  // Stops the learning outright.
  'concept-explanation': 'high',
  'lack-of-practical-sessions': 'high',
  'technical-issues': 'high',
  'training-pace': 'high',
  'understanding-concepts': 'high',

  // Holds up one front.
  'ai-topics': 'medium',
  assignments: 'medium',
  'backend-nextjs': 'medium',
  cybersecurity: 'medium',
  'data-visualization': 'medium',
  'data-visualization-project': 'medium',
  devops: 'medium',
  iot: 'medium',
  linux: 'medium',
  'scheduling-timeline': 'medium',
  'self-learning-by-trainee-members': 'medium',
  teamwork: 'medium',
  testing: 'medium',
  'time-management': 'medium',
  'topic-switching': 'medium',
  'training-content': 'medium',
  'web-mobile-application': 'medium',

  // Costs time, not comprehension.
  'group-activities': 'low',
  'long-discussions': 'low',
  'repeated-topics': 'low',
  'waiting-time': 'low',
};

/**
 * Where an unlisted difficulty lands.
 *
 * A row added to the sheet tomorrow draws as a middling problem of an
 * unidentified kind rather than crashing the month or vanishing from it. Both
 * tables above should be extended when that happens.
 */
const FAMILY_FALLBACK: ChallengeType = 'topic';
const IMPACT_FALLBACK: Severity = 'medium';

/* ------------------------------------------------------------------ *
 * The records
 * ------------------------------------------------------------------ */

interface RawChallenge {
  id: string;
  name: string;
  affectedPersonIds: string[];
}

const source = raw.challenges as unknown as RawChallenge[];

/** Mildest first, so the worst of a group can be found by taking the maximum. */
const SEVERITY_ORDER: Severity[] = ['low', 'medium', 'high'];

/** What each difficulty is called, by id. */
export const CHALLENGE_NAMES = new Map(source.map((c) => [c.id, c.name]));

/**
 * What falls under each kind, commonest across the cohort first.
 *
 * The key on screen reads off this: a colour means nothing until the viewer is
 * told which answers it stands for, and "a subject was hard" in particular
 * covers eleven different subjects.
 */
export const MEMBERS_OF: Record<ChallengeType, { name: string; count: number }[]> =
  (() => {
    const map = {} as Record<ChallengeType, { name: string; count: number }[]>;
    for (const type of Object.keys(CHALLENGE_LABELS) as ChallengeType[]) {
      map[type] = [];
    }
    for (const challenge of source) {
      map[FAMILY_OF[challenge.id] ?? FAMILY_FALLBACK].push({
        name: challenge.name,
        count: challenge.affectedPersonIds.length,
      });
    }
    for (const list of Object.values(map)) {
      // Ties broken by name, so the order is stable rather than incidental.
      list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    }
    return map;
  })();

/**
 * One record per person per kind, grouped by person.
 *
 * Person-major so that everything one vessel carries is contiguous, which is
 * what the arrival sequence in the third month reads off.
 *
 * A group is as big as the worst thing in it. Size is impact and nothing else,
 * so a kind that cost somebody their understanding is drawn large whether they
 * named one thing under it or four — how many they named is said in the list,
 * where it can be read as a number instead of guessed at from a silhouette.
 */
export const CHALLENGE_RECORDS: ChallengeRecord[] = (() => {
  const byPersonType = new Map<string, Map<ChallengeType, RawChallenge[]>>();
  for (const challenge of source) {
    for (const personId of challenge.affectedPersonIds) {
      const kinds = byPersonType.get(personId) ?? new Map<ChallengeType, RawChallenge[]>();
      const type = FAMILY_OF[challenge.id] ?? FAMILY_FALLBACK;
      const list = kinds.get(type) ?? [];
      list.push(challenge);
      kinds.set(type, list);
      byPersonType.set(personId, kinds);
    }
  }

  const records: ChallengeRecord[] = [];
  for (const [personId, kinds] of byPersonType) {
    for (const [type, named] of kinds) {
      let severity: Severity = 'low';
      for (const challenge of named) {
        const own = IMPACT_OF[challenge.id] ?? IMPACT_FALLBACK;
        if (SEVERITY_ORDER.indexOf(own) > SEVERITY_ORDER.indexOf(severity)) {
          severity = own;
        }
      }
      records.push({
        id: `${type}:${personId}`,
        personId,
        type,
        severity,
        title: CHALLENGE_LABELS[type],
        members: named
          .slice()
          .sort(
            (a, b) =>
              b.affectedPersonIds.length - a.affectedPersonIds.length ||
              a.name.localeCompare(b.name),
          )
          .map((challenge) => challenge.name),
      });
    }
  }
  return records;
})();

const byPerson = (() => {
  const map = new Map<string, ChallengeRecord[]>();
  for (const record of CHALLENGE_RECORDS) {
    const list = map.get(record.personId);
    if (list) list.push(record);
    else map.set(record.personId, [record]);
  }
  return map;
})();

/**
 * How many of the sixteen met each kind, most common first.
 *
 * Counted in people rather than in answers, so somebody who named six subjects
 * counts once against "a subject was hard" — the same way the class ranking
 * counts, so the two months answer in the same units. `leader` is the single
 * commonest answer inside that kind, which is what stops the ranking losing the
 * headline: it is one row down from "a subject was hard", not gone.
 */
export const CHALLENGE_RANKING: {
  type: ChallengeType;
  name: string;
  count: number;
  leader: { name: string; count: number } | null;
}[] = (() => {
  const met = new Map<ChallengeType, Set<string>>();
  for (const record of CHALLENGE_RECORDS) {
    const people = met.get(record.type) ?? new Set<string>();
    people.add(record.personId);
    met.set(record.type, people);
  }
  return [...met]
    .map(([type, people]) => ({
      type,
      name: CHALLENGE_LABELS[type],
      count: people.size,
      leader: MEMBERS_OF[type][0] ?? null,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
})();

/** Every kind this person ran into, in the order the data gives it. */
export function challengesOf(personId: string): ChallengeRecord[] {
  return byPerson.get(personId) ?? [];
}

/** The record behind one id, or null if the id is stale. */
export function challengeById(id: string): ChallengeRecord | null {
  return CHALLENGE_RECORDS.find((record) => record.id === id) ?? null;
}

/** The most kinds any one person carries. Sizes the instanced draw. */
export const MOST_PER_PERSON = Math.max(
  1,
  ...[...byPerson.values()].map((list) => list.length),
);
