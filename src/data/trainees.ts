import raw from './odyssey.json';
import type { Challenge, Skill, Team, Trainee, TrainingData } from './types';

/**
 * Normalises the source dataset into the contract the world is built against.
 *
 * The source carries real gaps, and the rule for this project is that missing
 * data stays missing: a trainee with no recorded confidence gets null, not a
 * default, so that later phases can render an absence rather than inventing a
 * value to make the scene look fuller.
 */

/** Separator used where one person submitted the same survey twice. */
const MERGED_SEPARATOR = '|';

/**
 * Reads a 1–5 survey rating.
 *
 * Two people answered the journey survey twice and their responses were merged
 * into strings like `"3 | 2"`. Averaging the submissions is the honest reading:
 * both answers are that person's, and neither has a claim to being the real one.
 * Blank strings and nulls alike mean the question was never answered.
 */
export function parseRating(value: string | null | undefined): number | null {
  if (value == null) return null;

  const parts = String(value)
    .split(MERGED_SEPARATOR)
    .map((part) => Number.parseFloat(part.trim()))
    .filter((part) => Number.isFinite(part));

  if (parts.length === 0) return null;
  return parts.reduce((sum, part) => sum + part, 0) / parts.length;
}

interface RawPerson {
  id: string;
  name: string;
  projectIds: string[];
  skillIds: string[];
  journeySurvey: { startConfidence?: string | null; nowConfidence?: string | null } | null;
}

const rawPeople = raw.people as unknown as RawPerson[];

/** Challenge lookup by person, built once by inverting the source's mapping. */
const challengesByPerson = new Map<string, string[]>();
for (const challenge of raw.challenges) {
  for (const personId of challenge.affectedPersonIds) {
    const list = challengesByPerson.get(personId);
    if (list) list.push(challenge.id);
    else challengesByPerson.set(personId, [challenge.id]);
  }
}

export const trainees: Trainee[] = rawPeople.map((person) => ({
  id: person.id,
  name: person.name,
  confidenceStart: parseRating(person.journeySurvey?.startConfidence),
  confidenceEnd: parseRating(person.journeySurvey?.nowConfidence),
  skillIds: person.skillIds,
  challengeIds: challengesByPerson.get(person.id) ?? [],
  projectId: person.projectIds[0] ?? null,
}));

export const teams: Team[] = raw.projects.map((project) => ({
  id: project.id,
  name: project.name,
  memberIds: project.memberIds,
}));

export const skills: Skill[] = raw.skills.map((skill) => ({
  id: skill.id,
  name: skill.name,
  popularity: skill.popularity,
}));

export const challenges: Challenge[] = raw.challenges.map((challenge) => ({
  id: challenge.id,
  name: challenge.name,
  affectedTraineeIds: challenge.affectedPersonIds,
  size: challenge.size,
}));

/**
 * The ten logged weeks resolve into three months. This split comes from the
 * source data's own week numbering, not from calendar dates, because the logs
 * are the only record of what was actually happening when.
 */
export const months: TrainingData['months'] = [
  { index: 0, label: 'M01', weeks: [1, 2, 3, 4] },
  { index: 1, label: 'M02', weeks: [5, 6, 7] },
  { index: 2, label: 'M03', weeks: [8, 9, 10] },
];

export const trainingData: TrainingData = {
  trainees,
  teams,
  skills,
  challenges,
  months,
};

/** The world is built around exactly sixteen people; never more, never fewer. */
export const TRAINEE_COUNT = 16;

if (trainees.length !== TRAINEE_COUNT) {
  throw new Error(
    `Expected ${TRAINEE_COUNT} trainees in the dataset, found ${trainees.length}`,
  );
}

export const traineeById = new Map(trainees.map((trainee) => [trainee.id, trainee]));
