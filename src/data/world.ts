import raw from './odyssey.json';
import { parseRating } from './trainees';

/**
 * The derived world model.
 *
 * Everything the visualization renders is computed here, once, from the source
 * dataset — orb complexity, gravitational strength, project maturity, the shape
 * of each of the three months. Keeping the derivation in one place is what lets
 * the three months be a single continuous transformation of one model rather
 * than three separately authored scenes.
 *
 * Where the source cannot answer a question, the model says so rather than
 * inventing a value. Those gaps are listed in `PROVENANCE` at the foot of this
 * file and surfaced in the interface, because a visualization that hides which
 * of its numbers are real is worse than one that shows fewer numbers.
 */

export type MonthIndex = 0 | 1 | 2;
export const MONTH_LABELS = ['M01', 'M02', 'M03'] as const;
export const MONTH_TITLES = ['Foundation', 'Collaboration', 'Mastery'] as const;

/** Which month each logged week belongs to. Ten weeks across three months. */
const WEEK_MONTH: Record<number, MonthIndex> = {
  1: 0, 2: 0, 3: 0, 4: 0,
  5: 1, 6: 1, 7: 1,
  8: 2, 9: 2, 10: 2,
};

interface RawWeek {
  week: number;
  days?: string[];
  skillIds?: string[];
  projectIds?: string[];
}

const weeks = raw.weeks as unknown as RawWeek[];

/* ------------------------------------------------------------------ *
 * Curriculum timeline
 * ------------------------------------------------------------------ */

/**
 * The month each skill first appears in the daily logs.
 *
 * This is the spine of the whole temporal system: it is real, dated evidence of
 * when a topic entered the training, which is what allows a trainee's orb to
 * gain internal structure over time instead of being assigned an invented
 * learning curve.
 */
const skillFirstMonth = new Map<string, MonthIndex>();
/** How many logged weeks mention each skill, per month. */
const skillActivity = new Map<string, [number, number, number]>();

const projectFirstMonth = new Map<string, MonthIndex>();
const projectActivity = new Map<string, [number, number, number]>();

for (const week of weeks) {
  const month = WEEK_MONTH[week.week];
  if (month === undefined) continue;

  for (const id of week.skillIds ?? []) {
    const seen = skillFirstMonth.get(id);
    if (seen === undefined || month < seen) skillFirstMonth.set(id, month);
    const counts = skillActivity.get(id) ?? [0, 0, 0];
    counts[month] += 1;
    skillActivity.set(id, counts);
  }

  for (const id of week.projectIds ?? []) {
    const seen = projectFirstMonth.get(id);
    if (seen === undefined || month < seen) projectFirstMonth.set(id, month);
    const counts = projectActivity.get(id) ?? [0, 0, 0];
    counts[month] += 1;
    projectActivity.set(id, counts);
  }
}

/**
 * Skills the surveys record but the daily logs never date.
 *
 * These are things like "Group Project" and "Self Learning" — real skills that
 * were never a scheduled topic, so there is no honest date to attach. They are
 * treated as present throughout rather than assigned a fabricated arrival.
 */
export const UNDATED_SKILL_IDS = raw.skills
  .map((skill) => skill.id)
  .filter((id) => !skillFirstMonth.has(id));

function firstMonthOfSkill(id: string): MonthIndex {
  return skillFirstMonth.get(id) ?? 0;
}

/* ------------------------------------------------------------------ *
 * Challenges
 * ------------------------------------------------------------------ */

/**
 * Many challenges name a training topic — "Devops", "Testing", "IoT" — and so
 * inherit that topic's date. The rest describe the experience itself ("Time
 * management", "Keeping up with the training pace") and are present from the
 * start, since nothing in the source says otherwise.
 */
const challengeMonth = new Map<string, MonthIndex>();
for (const challenge of raw.challenges) {
  challengeMonth.set(challenge.id, firstMonthOfSkill(challenge.id));
}

const challengesByPerson = new Map<string, string[]>();
for (const challenge of raw.challenges) {
  for (const personId of challenge.affectedPersonIds) {
    const list = challengesByPerson.get(personId);
    if (list) list.push(challenge.id);
    else challengesByPerson.set(personId, [challenge.id]);
  }
}

export const challengeById = new Map(raw.challenges.map((c) => [c.id, c]));
export const skillById = new Map(raw.skills.map((s) => [s.id, s]));

/* ------------------------------------------------------------------ *
 * People
 * ------------------------------------------------------------------ */

export interface TraineeModel {
  id: string;
  name: string;
  projectId: string | null;
  /** Self-reported confidence at the start and at the end, 1–5. */
  confidenceStart: number | null;
  confidenceEnd: number | null;
  /** Self-reported rating of their team, 1–5. Drives gravitational strength. */
  teamRating: number | null;
  skillIds: string[];
  challengeIds: string[];
  /** Skills held by the end of each month, cumulative. */
  skillsByMonth: [string[], string[], string[]];
  /** Challenges in play by each month, cumulative. */
  challengesByMonth: [string[], string[], string[]];
  /** Confidence at each month; the middle value is interpolated, not recorded. */
  confidenceByMonth: [number | null, number | null, number | null];
}

interface RawPerson {
  id: string;
  name: string;
  projectIds: string[];
  skillIds: string[];
  journeySurvey: {
    startConfidence?: string | null;
    nowConfidence?: string | null;
    teamRating?: string | null;
  } | null;
}

function cumulativeByMonth(
  ids: string[],
  monthOf: (id: string) => MonthIndex,
): [string[], string[], string[]] {
  const result: [string[], string[], string[]] = [[], [], []];
  for (const id of ids) {
    const from = monthOf(id);
    for (let month = from; month < 3; month++) result[month].push(id);
  }
  return result;
}

export const trainees: TraineeModel[] = (raw.people as unknown as RawPerson[]).map(
  (person) => {
    const start = parseRating(person.journeySurvey?.startConfidence);
    const end = parseRating(person.journeySurvey?.nowConfidence);
    const challengeIds = challengesByPerson.get(person.id) ?? [];

    // The surveys asked how people felt at the beginning and at the end, and
    // never in between. The middle month is therefore a straight interpolation
    // and is labelled as such wherever it is shown.
    const middle = start != null && end != null ? (start + end) / 2 : (end ?? start);

    return {
      id: person.id,
      name: person.name,
      projectId: person.projectIds[0] ?? null,
      confidenceStart: start,
      confidenceEnd: end,
      teamRating: parseRating(person.journeySurvey?.teamRating),
      skillIds: person.skillIds,
      challengeIds,
      skillsByMonth: cumulativeByMonth(person.skillIds, firstMonthOfSkill),
      challengesByMonth: cumulativeByMonth(
        challengeIds,
        (id) => challengeMonth.get(id) ?? 0,
      ),
      confidenceByMonth: [start, middle, end ?? start],
    };
  },
);

export const TRAINEE_COUNT = 16;
if (trainees.length !== TRAINEE_COUNT) {
  throw new Error(
    `Expected ${TRAINEE_COUNT} trainees in the dataset, found ${trainees.length}`,
  );
}

export const traineeById = new Map(trainees.map((t) => [t.id, t]));
export const traineeIds = trainees.map((t) => t.id);

/* ------------------------------------------------------------------ *
 * Teams and their projects
 * ------------------------------------------------------------------ */

export interface TeamModel {
  id: string;
  name: string;
  memberIds: string[];
  /**
   * How fully formed the project is by each month, 0–1.
   *
   * Cumulative rather than per-month: the logs stop mentioning the projects in
   * the final month, but a project that stops being discussed has been
   * finished, not abandoned. Maturity therefore rises and then holds.
   */
  maturityByMonth: [number, number, number];
  /** Live activity in each month, 0–1 — how much churn the project is under. */
  activityByMonth: [number, number, number];
  /** Mean team rating of its members, 0–1. Drives how tightly they bind. */
  cohesion: number;
}

const maxProjectMentions = Math.max(
  1,
  ...raw.projects.map((project) => {
    const counts = projectActivity.get(project.id) ?? [0, 0, 0];
    return counts[0] + counts[1] + counts[2];
  }),
);

export const teams: TeamModel[] = raw.projects.map((project) => {
  const counts = projectActivity.get(project.id) ?? [0, 0, 0];
  const cumulative: [number, number, number] = [
    counts[0],
    counts[0] + counts[1],
    counts[0] + counts[1] + counts[2],
  ];

  const ratings = project.memberIds
    .map((id) => traineeById.get(id)?.teamRating)
    .filter((value): value is number => value != null);

  return {
    id: project.id,
    name: project.name,
    memberIds: project.memberIds,
    maturityByMonth: [
      cumulative[0] / maxProjectMentions,
      cumulative[1] / maxProjectMentions,
      cumulative[2] / maxProjectMentions,
    ],
    activityByMonth: [
      counts[0] / maxProjectMentions,
      counts[1] / maxProjectMentions,
      counts[2] / maxProjectMentions,
    ],
    // Where nobody rated their team, cohesion falls back to the midpoint rather
    // than to zero — silence is not evidence of a broken team.
    cohesion: ratings.length
      ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length / 5
      : 0.5,
  };
});

export const teamById = new Map(teams.map((team) => [team.id, team]));
export const teamOfTrainee = new Map<string, TeamModel>();
for (const team of teams) {
  for (const memberId of team.memberIds) teamOfTrainee.set(memberId, team);
}

/** Largest number of skills any one person holds; used to normalise complexity. */
export const MAX_SKILLS = Math.max(...trainees.map((t) => t.skillIds.length));
/** Largest challenge load any one person carries. */
export const MAX_CHALLENGES = Math.max(
  1,
  ...trainees.map((t) => t.challengeIds.length),
);

/**
 * What the source can and cannot tell us. Shown in the interface so the
 * distinction between recorded and derived is never hidden from the viewer.
 */
export const PROVENANCE = {
  datedSkills: skillFirstMonth.size,
  totalSkills: raw.skills.length,
  undatedSkills: UNDATED_SKILL_IDS.length,
  loggedDays: weeks.reduce((sum, week) => sum + (week.days?.length ?? 0), 0),
  interpolatedMiddleConfidence: true,
} as const;
