/**
 * A colour for each class, so one artifact can be told from another.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  Keyed by class id. Add a line when a class is added; anything without an
 *  entry falls back to the neutral below rather than disappearing.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * All sixteen classes appear across the sixteen people, which is more than
 * shape alone can carry — the forms differ, but at the size they are drawn
 * inside a vessel a viewer cannot hold sixteen silhouettes in their head at
 * once. Hue does that work, and it is the reason there is a key on screen:
 * sixteen colours are not memorable either, so the world names them rather than
 * expecting anybody to learn them.
 *
 * The hues are spread right around the wheel and kept light. These are read
 * through indigo glass, so anything dark or deeply saturated arrives as a
 * muddy smudge rather than as a colour.
 */

export const CLASS_COLOUR: Record<string, string> = {
  'ai-topics': '#8ab6ff',
  'backend-nextjs': '#7ee0c0',
  cybersecurity: '#ff8f8f',
  'data-visualization': '#ffc46b',
  'data-visualization-project': '#ffdf8f',
  database: '#b39aff',
  databricks: '#ff9f5c',
  devops: '#6fd3ff',
  git: '#ff9ecf',
  'group-project': '#a8e57a',
  iot: '#5cd7a8',
  linux: '#ffd166',
  'self-learning-by-trainee-members': '#c9b6f5',
  // Chartreuse: the one gap left on the wheel once the other fifteen have
  // taken their hues, and far enough from both the yellow of Linux and the
  // green of Group Project to be told from either through the glass.
  testing: '#d9e86b',
  'ui-ux': '#ff8ab0',
  'web-mobile-application': '#79c6ff',
};

/** For a class with no entry: visible, and obviously not one of the keyed ones. */
export const CLASS_COLOUR_FALLBACK = '#c3ccd8';

export function classColour(classId: string): string {
  return CLASS_COLOUR[classId] ?? CLASS_COLOUR_FALLBACK;
}
