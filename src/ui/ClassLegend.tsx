import { useMemo } from 'react';
import { learningByPerson, SHOWN_PER_PERSON } from '../data/classes';
import { classIcon } from './classIcons';
import { skillById, traineeById } from '../data/world';
import { CLASSES_MONTH } from './LensControl';
import { useWorldStore } from '../store/useWorldStore';

/** A row of the key: a class, and in the ranked view how many liked it. */
interface ClassEntry {
  id: string;
  name: string;
  count?: number;
}

/**
 * The key to the classes.
 *
 * Fifteen classes appear across the sixteen people, each drawn as its own form
 * in its own colour. Neither channel is memorable on its own at that count — a
 * viewer cannot hold fifteen silhouettes or fifteen hues in their head — so the
 * world names them instead of expecting anybody to learn them.
 *
 * A key rather than a caption on purpose. Naming one class at a time as the
 * pointer finds it says nothing about the other fourteen, and the question this
 * month raises is comparative: who liked what, and what did most people like.
 * That can only be read off a list of all of them at once.
 *
 * It lists only the classes actually drawn. A key naming things that are not on
 * screen would send the viewer hunting for them.
 */
export function ClassLegend() {
  const lens = useWorldStore((state) => state.lens);
  const enteredMonth = useWorldStore((state) => state.enteredMonth);
  const hoveredSession = useWorldStore((state) => state.hoveredSession);
  const openedSession = useWorldStore((state) => state.openedSession);
  const focusedTraineeId = useWorldStore((state) => state.focusedTraineeId);
  const hoveredTraineeId = useWorldStore((state) => state.hoveredTraineeId);
  const ranked = useWorldStore((state) => state.ranked);
  const toggleRanked = useWorldStore((state) => state.toggleRanked);

  /** Which class the pointer is on, so the key can answer it. */
  const attended = (openedSession ?? hoveredSession)?.split(':')[1] ?? null;

  /**
   * Whose classes the key is answering, if anybody's.
   *
   * A chosen person outranks a hovered one, so sweeping the pointer across the
   * month cannot take the key away from whoever is being read.
   */
  // The ranked view is about all sixteen at once, so it deliberately ignores
  // whoever is being pointed at — narrowing it to one person would answer the
  // opposite of the question it is there to answer.
  const subject = ranked ? null : focusedTraineeId ?? hoveredTraineeId;

  /**
   * How many people liked each class, most liked first.
   *
   * Counted in people rather than in sessions, so the figure answers the
   * question somebody actually asks out loud — how many of them liked this —
   * and stays comparable with the difficulty ranking, which counts the same
   * way. Only the sessions the world actually draws are counted, so the key
   * cannot claim a popularity the orbs do not show.
   */
  const ranking = useMemo(() => {
    const tally = new Map<string, number>();
    for (const [, profile] of learningByPerson) {
      const theirs = new Set(
        profile.sessions.slice(0, SHOWN_PER_PERSON).map((session) => session.classId),
      );
      for (const classId of theirs) tally.set(classId, (tally.get(classId) ?? 0) + 1);
    }
    return [...tally]
      .map(([id, count]) => ({ id, count, name: skillById.get(id)?.name ?? id }))
      // Ties broken by name, so the order is stable rather than incidental.
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, []);

  const classes = useMemo(() => {
    const shown = new Set<string>();
    // Pointing at somebody narrows the key to what *they* liked. Fifteen
    // entries with fourteen greyed out still makes the reader find the two that
    // are not; showing only theirs answers the question outright, and the full
    // list is one pointer movement away.
    if (subject) {
      const profile = learningByPerson.get(subject);
      profile?.sessions
        .slice(0, SHOWN_PER_PERSON)
        .forEach((session) => shown.add(session.classId));
    } else {
      for (const [, profile] of learningByPerson) {
        profile.sessions
          .slice(0, SHOWN_PER_PERSON)
          .forEach((session) => shown.add(session.classId));
      }
    }
    return [...shown]
      .map((id) => ({ id, name: skillById.get(id)?.name ?? id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [subject]);

  if (lens !== 'classes' || enteredMonth !== CLASSES_MONTH) return null;

  return (
    <aside className="legend" aria-label="Classes">
      <div className="legend__head">
        <p className="legend__title">
          {ranked
            ? 'Most liked'
            : subject
              ? `${traineeById.get(subject)?.name ?? 'They'} · liked most`
              : 'Classes'}
        </p>
        <button
          type="button"
          className="legend__toggle"
          aria-pressed={ranked}
          onClick={toggleRanked}
          title="Rank every class by how many people liked it"
        >
          Overall
        </button>
      </div>

      {ranked && <p className="legend__note">how many of the 16 liked it</p>}
      <ul className="legend__list">
        {((ranked ? ranking : classes) as ClassEntry[]).map((entry) => (
          <li
            key={entry.id}
            className="legend__item"
            // Picking one out dims the rest, so the key answers the pointer
            // instead of being a static block of text beside the world.
            data-attended={attended === null ? undefined : attended === entry.id}
          >
            {/*
              The form itself, not a coloured dot. Shape is half of how these
              are told apart inside a vessel, so the key shows the geometry the
              world draws rather than only the hue it is drawn in.
            */}
            <img
              className="legend__form"
              src={classIcon(entry.id)}
              alt=""
              aria-hidden="true"
              draggable={false}
            />
            <span className="legend__name">{entry.name}</span>
            {entry.count !== undefined && (
              <span className="legend__count">{entry.count}</span>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
