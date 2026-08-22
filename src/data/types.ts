/**
 * Shape of the training dataset the world will be built from.
 *
 * Reserved for the next phase — nothing renders from these yet. They are
 * declared now so the visual systems that follow can be written against a fixed
 * contract instead of against whatever the JSON happens to contain.
 *
 * Source: 16 trainees, 5 project teams, 25 skills, 17 challenges and 10 logged
 * weeks that bucket into the three months.
 */

export interface Trainee {
  id: string;
  name: string;
  /** Self-reported confidence at the start and end of training, 1–5. */
  confidenceStart: number | null;
  confidenceEnd: number | null;
  skillIds: string[];
  challengeIds: string[];
  projectId: string | null;
}

export interface Team {
  id: string;
  name: string;
  memberIds: string[];
}

export interface Skill {
  id: string;
  name: string;
  /** Number of trainees reporting the skill; null where the source is the daily log. */
  popularity: number | null;
}

export interface Challenge {
  id: string;
  name: string;
  affectedTraineeIds: string[];
  /** Count of affected trainees, used later to size fractures. */
  size: number;
}

/** The three temporal states the ten logged weeks resolve into. */
export interface MonthBucket {
  index: 0 | 1 | 2;
  label: string;
  weeks: number[];
}

export interface TrainingData {
  trainees: Trainee[];
  teams: Team[];
  skills: Skill[];
  challenges: Challenge[];
  months: MonthBucket[];
}
