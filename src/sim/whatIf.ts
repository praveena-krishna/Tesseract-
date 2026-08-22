import type { MonthIndex, TraineeModel } from '../data/world';
import { teamOfTrainee, trainees } from '../data/world';

/**
 * The counterfactual layer.
 *
 * Each setting is a condition of the training that could have been different.
 * They are applied to the derived world model, not to a separate mock — the
 * same orbs, the same gravity, the same project formations respond, because a
 * what-if that renders somewhere else is a mockup rather than a simulation.
 */
export interface WhatIf {
  /** Training length. Two months removes the final month entirely. */
  months: 2 | 3;
  /** A person who never joined. Their orb is absent and their team is smaller. */
  removedTraineeId: string | null;
  /** How much people worked together, 0–1, against the recorded baseline of 1. */
  collaboration: number;
  /** A topic never taught. Nobody holds it, and its structures never form. */
  removedSkillId: string | null;
  /** Support and resources available, 0–1. Below 1, challenges bite harder. */
  support: number;
}

export const DEFAULT_WHAT_IF: WhatIf = {
  months: 3,
  removedTraineeId: null,
  collaboration: 1,
  removedSkillId: null,
  support: 1,
};

export function isBaseline(whatIf: WhatIf): boolean {
  return (
    whatIf.months === DEFAULT_WHAT_IF.months &&
    whatIf.removedTraineeId === null &&
    whatIf.collaboration === 1 &&
    whatIf.removedSkillId === null &&
    whatIf.support === 1
  );
}

/** The state of one person at one moment, after counterfactuals are applied. */
export interface TraineeState {
  model: TraineeModel;
  present: boolean;
  /** Skills held right now. */
  skillIds: string[];
  /** Challenges in play right now. */
  challengeIds: string[];
  confidence: number | null;
  /** 0–1 internal complexity, from how much this person has learned. */
  complexity: number;
  /** 0–1 instability from unresolved difficulty; drives distortion. */
  turbulence: number;
  /** 0–1 pull toward teammates. */
  bonding: number;
}

/**
 * Caps the visible month to the training's length.
 *
 * Shortening the training does not merely hide the third month; it means the
 * third month never happened, so the world holds at the end of the second.
 */
export function effectiveMonth(month: MonthIndex, whatIf: WhatIf): MonthIndex {
  return whatIf.months === 2 ? (Math.min(month, 1) as MonthIndex) : month;
}

export function resolveTrainee(
  model: TraineeModel,
  month: MonthIndex,
  whatIf: WhatIf,
  maxSkills: number,
  maxChallenges: number,
): TraineeState {
  const capped = effectiveMonth(month, whatIf);
  const present = model.id !== whatIf.removedTraineeId;

  const skillIds = model.skillsByMonth[capped].filter(
    (id) => id !== whatIf.removedSkillId,
  );
  const challengeIds = model.challengesByMonth[capped];

  // Less support does not create new difficulties; it makes the recorded ones
  // harder to absorb, so the same challenge load reads as more instability.
  const load = challengeIds.length / maxChallenges;
  const turbulence = Math.min(1, load * (2 - whatIf.support));

  const team = teamOfTrainee.get(model.id);
  const rating = model.teamRating != null ? model.teamRating / 5 : 0.5;
  const cohesion = team ? team.cohesion : 0.5;
  const bonding = Math.max(0, Math.min(1, ((rating + cohesion) / 2) * whatIf.collaboration));

  return {
    model,
    present,
    skillIds,
    challengeIds,
    confidence: model.confidenceByMonth[capped],
    complexity: Math.min(1, skillIds.length / maxSkills),
    turbulence,
    bonding,
  };
}

/**
 * How strongly teams are bound at a given moment.
 *
 * Collaboration is barely present in the first month, when the logs show people
 * working largely alone, and rises as the project work takes over. Scaling by
 * the collaboration setting lets the counterfactual pull the field back apart.
 */
export function collaborationStrength(month: MonthIndex, whatIf: WhatIf): number {
  const capped = effectiveMonth(month, whatIf);
  const base = [0.12, 0.85, 1][capped];
  return base * whatIf.collaboration;
}

/** Every person, resolved for the current moment. */
export function resolveAll(
  month: MonthIndex,
  whatIf: WhatIf,
  maxSkills: number,
  maxChallenges: number,
): TraineeState[] {
  return trainees.map((model) =>
    resolveTrainee(model, month, whatIf, maxSkills, maxChallenges),
  );
}
