import { useMemo } from 'react';
import { PROJECTS } from '../data/projects';
import { projectIcon } from './projectIcons';
import { TEAM_MONTH } from './LensControl';
import { useWorldStore } from '../store/useWorldStore';

/**
 * The key to what the five teams built.
 *
 * Each project is drawn as its own constellation in its own colour, and five
 * figures scattered across a month is exactly the case a key exists for: the
 * viewer can see that the shapes differ long before they can say which is
 * which. Naming them together also answers the comparative question the month
 * raises — what did the five teams make — which no single hovered label can.
 *
 * Choosing or pointing at a team lights its entry and dims the rest, so the key
 * answers the world rather than sitting beside it.
 */
export function ProjectLegend() {
  const lens = useWorldStore((state) => state.lens);
  const enteredMonth = useWorldStore((state) => state.enteredMonth);
  const focusedTeamId = useWorldStore((state) => state.focusedTeamId);
  const hoveredTeamId = useWorldStore((state) => state.hoveredTeamId);

  const attended = focusedTeamId ?? hoveredTeamId;
  const projects = useMemo(() => Object.values(PROJECTS), []);

  if (lens !== 'projects' || enteredMonth !== TEAM_MONTH) return null;

  return (
    <aside className="legend" aria-label="Projects">
      <p className="legend__title">What each team built</p>
      <ul className="legend__list">
        {projects.map((project) => (
          <li
            key={project.id}
            className="legend__item"
            data-attended={attended === null ? undefined : attended === project.id}
          >
            <img
              className="legend__form"
              src={projectIcon(project.id)}
              alt=""
              aria-hidden="true"
              draggable={false}
            />
            <span className="legend__name">{project.name}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
