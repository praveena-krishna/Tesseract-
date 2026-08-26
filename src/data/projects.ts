/**
 * What each team actually built.
 *
 * The names and descriptions here come from the team themselves, not from the
 * dataset — the daily logs record only a short working title for each project
 * and nothing about what it does, which is not enough to derive a form from.
 * Rosters still come from the source; only the description is supplied.
 *
 * Four of the five match their logged title plainly. The fifth, AeroTwin, is
 * logged as "Twinz 360" and is identified here by elimination: it is the one
 * remaining roster once the other four are matched, and the name is consistent
 * with a digital-twin project.
 */

export interface ProjectModel {
  /** Project id in the source dataset, which carries the roster. */
  id: string;
  name: string;
  /** One or two sentences. Shown beside the artifact and nowhere else. */
  description: string;
  /** What the form is, so the metaphor is stated rather than guessed at. */
  reading: string;
}

export const PROJECTS: Record<string, ProjectModel> = {
  'ar-robot': {
    id: 'ar-robot',
    name: 'AR Car Rover',
    description:
      'A smart rover driven from a phone through app controls and gestures, with an ESP32 running the motors and an ultrasonic sensor watching for obstacles.',
    reading: 'a chassis on wheels, facing its heading, pinging the dark ahead of it',
  },
  'ai-companion': {
    id: 'ai-companion',
    name: 'AI Companion & Movie Studio',
    description:
      'An AI companion and movie studio in one: conversation, media creation and interactive experience around a single intelligence.',
    reading: 'an intelligence held in a lens, with the exchange circling it',
  },
  'vivid-echo': {
    id: 'vivid-echo',
    name: 'VividEcho',
    description:
      'A spatial-memory platform that ties personal experience to physical place, keeping memory persistent and location-aware.',
    reading: 'a memory at the centre and the rooms it was left in, still returning',
  },
  'twinz-360': {
    id: 'twinz-360',
    name: 'AeroTwin',
    description:
      'Construction-site monitoring from drone video, with AI object detection feeding a 3D digital twin of the site.',
    reading: 'a structure rising floor by floor while something circles above, surveying',
  },
  vibesync: {
    id: 'vibesync',
    name: 'VibeSync',
    description:
      'An AI platform that shapes personalised digital environments around a person’s mood and preferences.',
    reading: 'a surface that will not hold one shape, reforming to whoever is reading it',
  },
};

export function projectOf(teamId: string): ProjectModel | undefined {
  return PROJECTS[teamId];
}
