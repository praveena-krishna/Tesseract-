/**
 * What each person ran into, and what came of working it through.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  PLACEHOLDER DATA — replace the `CHALLENGE_RECORDS` array below.
 *  Nothing outside this file knows any of these values. Swap the array for
 *  the real records, keep the shape, and the world follows.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Worth knowing before that swap: the source dataset already carries real
 * challenge records — seventeen of them, naming fifteen of the sixteen people,
 * and they describe exactly this kind of topic ("Devops", "Time management").
 * The kinds below are shaped to match, so the real records should drop in with
 * little more than a rename.
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
 * The kinds of difficulty.
 *
 * Each carries its own colour, and here that is the point rather than a thing
 * to apologise for: eight kinds sitting together around one person need to be
 * told apart at a glance, and hue is the only channel that survives being small,
 * half-lit and seen edge-on. Size is already saying how bad it was, so it is
 * not available to say what it was.
 */
export type ChallengeType =
  | 'time'
  | 'tooling'
  | 'communication'
  | 'understanding'
  | 'environment'
  | 'technical'
  | 'confidence'
  | 'attendance';

export interface ChallengeRecord {
  /** Stable identity, so a difficulty worked through stays worked through. */
  id: string;
  personId: string;
  type: ChallengeType;
  severity: Severity;
  /** One line naming what happened. */
  title: string;
  /** One line on what working through it taught them. */
  learned: string;
}

export const CHALLENGE_LABELS: Record<ChallengeType, string> = {
  time: 'Time management',
  tooling: 'Tool adaptation',
  communication: 'Communication',
  understanding: 'Understanding concepts',
  environment: 'Environment issues',
  technical: 'Technical error',
  confidence: 'Self doubt',
  attendance: 'Attendance issues',
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

/** The shard's length, as a multiple of the base shard. Size is severity. */
export const SEVERITY_SCALE: Record<Severity, number> = {
  low: 0.58,
  medium: 1,
  high: 1.52,
};

/**
 * The colour each kind of glass is.
 *
 * Saturated and hot, not pale. An earlier pass had these as light pastels on
 * the reasoning that they are read through violet crystal and anything dark
 * arrives muddy — which is true, and is why these stay high in value. But light
 * *and* washed out reads as decoration, and a difficulty is not decorative.
 * Holding the value and pushing the chroma keeps them legible through the glass
 * while making them look like something that would cut.
 *
 * The hues stay spread right around the wheel so eight of them can sit on one
 * person and still be told apart.
 */
export const TYPE_COLOUR: Record<ChallengeType, string> = {
  time: '#ff2d55',
  tooling: '#2f8bff',
  communication: '#ff6a1f',
  understanding: '#35d24a',
  environment: '#ffb400',
  technical: '#0fd6d6',
  confidence: '#8b3dff',
  attendance: '#ff2fa0',
};

/**
 * How each kind is cut, and how far into the vessel it sits.
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
  time: { points: 8, depth: 1.02 },
  tooling: { points: 11, depth: 0.88 },
  communication: { points: 9, depth: 0.96 },
  understanding: { points: 7, depth: 0.8 },
  environment: { points: 10, depth: 1.0 },
  technical: { points: 12, depth: 0.9 },
  confidence: { points: 8, depth: 0.76 },
  attendance: { points: 10, depth: 1.06 },
};

/* ------------------------------------------------------------------ *
 * PLACEHOLDER RECORDS — replace this array
 * ------------------------------------------------------------------ */
export const CHALLENGE_RECORDS: ChallengeRecord[] = [
  { id: 'C01', personId: 'P01', type: 'technical', severity: 'medium', title: 'Model kept diverging in training', learned: 'Debugging under pressure' },
  { id: 'C02', personId: 'P01', type: 'time', severity: 'high', title: 'Two projects wanted the same week', learned: 'Protecting focus time' },
  { id: 'C03', personId: 'P02', type: 'tooling', severity: 'high', title: 'Machine failed mid-sprint', learned: 'Working around broken hardware' },
  { id: 'C04', personId: 'P02', type: 'confidence', severity: 'medium', title: 'Held back from demoing the work', learned: 'Showing work before it is finished' },
  { id: 'C05', personId: 'P03', type: 'environment', severity: 'low', title: 'Local setup drifted from the team’s', learned: 'Reproducible setups' },
  { id: 'C06', personId: 'P03', type: 'understanding', severity: 'medium', title: 'Lost on the embedding step', learned: 'Asking for the whole picture first' },
  { id: 'C07', personId: 'P04', type: 'technical', severity: 'medium', title: 'Silent API change in a dependency', learned: 'Reading release notes first' },
  { id: 'C08', personId: 'P05', type: 'tooling', severity: 'high', title: 'Fought the framework for a week', learned: 'Choosing the simpler tool' },
  { id: 'C09', personId: 'P05', type: 'understanding', severity: 'low', title: 'Misread an error for two days', learned: 'Reading the error properly' },
  { id: 'C10', personId: 'P06', type: 'attendance', severity: 'low', title: 'Missed two sessions to a clash', learned: 'Guarding the calendar' },
  { id: 'C11', personId: 'P07', type: 'communication', severity: 'high', title: 'Stuck on integration alone for days', learned: 'Asking earlier' },
  { id: 'C12', personId: 'P07', type: 'time', severity: 'medium', title: 'Underestimated the last mile', learned: 'Estimating from evidence' },
  { id: 'C13', personId: 'P08', type: 'environment', severity: 'medium', title: 'Setup differed from production', learned: 'Containers over checklists' },
  { id: 'C14', personId: 'P09', type: 'technical', severity: 'low', title: 'Version mismatch across the team', learned: 'Pinning versions' },
  { id: 'C15', personId: 'P10', type: 'tooling', severity: 'medium', title: 'Lost a day of work unbacked', learned: 'Backing up early' },
  { id: 'C16', personId: 'P10', type: 'communication', severity: 'low', title: 'Handover missed a key detail', learned: 'Writing the handover down' },
  { id: 'C17', personId: 'P11', type: 'time', severity: 'low', title: 'Repeating a manual step daily', learned: 'Automating the tedious part' },
  { id: 'C18', personId: 'P12', type: 'attendance', severity: 'medium', title: 'Split across too many streams', learned: 'Saying no to overload' },
  { id: 'C19', personId: 'P12', type: 'confidence', severity: 'high', title: 'Doubted the approach and stalled', learned: 'Testing the idea instead of arguing it' },
  { id: 'C20', personId: 'P13', type: 'understanding', severity: 'medium', title: 'Could not reproduce a bug', learned: 'Writing the failing test first' },
  { id: 'C21', personId: 'P14', type: 'technical', severity: 'high', title: 'Shipped a regression to the demo', learned: 'Testing before shipping' },
  { id: 'C22', personId: 'P15', type: 'environment', severity: 'medium', title: 'Nobody could rebuild their fix', learned: 'Documenting the fix' },
  { id: 'C23', personId: 'P15', type: 'communication', severity: 'low', title: 'Talked past a teammate for a day', learned: 'Repeating the ask back' },
  { id: 'C24', personId: 'P16', type: 'confidence', severity: 'medium', title: 'Waited to be told what to pick up', learned: 'Choosing the next piece of work' },
  { id: 'C25', personId: 'P07', type: 'environment', severity: 'high', title: 'Rebuilt the environment three times', learned: 'Scripting the setup once' },
  { id: 'C26', personId: 'P12', type: 'time', severity: 'medium', title: 'Deadline moved under them twice', learned: 'Replanning without restarting' },
  { id: 'C27', personId: 'P02', type: 'understanding', severity: 'low', title: 'Took a while on the data model', learned: 'Drawing it before coding it' },
  { id: 'C28', personId: 'P05', type: 'attendance', severity: 'low', title: 'Missed a review in week two', learned: 'Guarding the calendar' },
  { id: 'C29', personId: 'P14', type: 'communication', severity: 'medium', title: 'Feedback arrived too late to use', learned: 'Asking for it sooner' },
  { id: 'C30', personId: 'P09', type: 'confidence', severity: 'low', title: 'Rewrote working code from doubt', learned: 'Trusting a passing test' },
];

const byPerson = (() => {
  const map = new Map<string, ChallengeRecord[]>();
  for (const record of CHALLENGE_RECORDS) {
    const list = map.get(record.personId);
    if (list) list.push(record);
    else map.set(record.personId, [record]);
  }
  return map;
})();

/** Everything this person ran into, in the order the data gives it. */
export function challengesOf(personId: string): ChallengeRecord[] {
  return byPerson.get(personId) ?? [];
}

/** The record behind one id, or null if the id is stale. */
export function challengeById(id: string): ChallengeRecord | null {
  return CHALLENGE_RECORDS.find((record) => record.id === id) ?? null;
}

/** The most difficulties any one person carries. Sizes the instanced draw. */
export const MOST_PER_PERSON = Math.max(
  1,
  ...[...byPerson.values()].map((list) => list.length),
);
