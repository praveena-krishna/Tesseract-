import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { projectOf } from '../data/projects';
import { teamOfTrainee, trainees } from '../data/world';
import { isTypingTarget } from '../interaction/typingTarget';
import { useWorldStore } from '../store/useWorldStore';

/** The key that opens the search from anywhere, as it is in every list ever. */
const OPEN_KEY = '/';

interface Entry {
  id: string;
  name: string;
  /** What they belong to, so the list distinguishes people by more than a name. */
  project: string | null;
}

/**
 * The sixteen, in the order a list is read rather than the order they were
 * logged. A roster whose order nobody can predict is a roster that has to be
 * read end to end every time.
 */
const ROSTER: Entry[] = trainees
  .map((trainee) => {
    const team = teamOfTrainee.get(trainee.id);
    const project = team ? projectOf(team.id) : undefined;
    return { id: trainee.id, name: trainee.name, project: project?.name ?? null };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

/**
 * Narrows the roster to what somebody has typed.
 *
 * Matches anywhere in the name, because these are given names and surnames and
 * a viewer may well remember either. What has been typed from the start of a
 * name is still sorted first, so typing the beginning of somebody's name does
 * put them at the top rather than merely somewhere in the list.
 */
function search(query: string): Entry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return ROSTER;

  return ROSTER.filter((entry) => entry.name.toLowerCase().includes(needle)).sort(
    (a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(needle);
      const bStarts = b.name.toLowerCase().startsWith(needle);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return a.name.localeCompare(b.name);
    },
  );
}

/**
 * Finding one person among sixteen.
 *
 * The world is the interface everywhere else, and it stays the interface here:
 * this control does not show anybody, it only says who to go to. Choosing a
 * name sends the camera to that person's vessel inside the month, lights them
 * and names them there. Nothing opens over the top, and nothing about the
 * tesseract changes — the only thing this adds is a way of reaching somebody
 * without first having to point at fifteen other people to rule them out.
 *
 * Collapsed by default, in the same language as every other mark in the
 * interface. A list of sixteen names permanently open beside the world would be
 * a directory with a visualization next to it, which is the wrong way round.
 */
export function PeopleSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  /** Which result the keyboard is on. Pointer users never see it move. */
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const phase = useWorldStore((state) => state.phase);
  const focusedTraineeId = useWorldStore((state) => state.focusedTraineeId);
  const pendingFindId = useWorldStore((state) => state.pendingFindId);
  const findTrainee = useWorldStore((state) => state.findTrainee);
  const focusTrainee = useWorldStore((state) => state.focusTrainee);
  const focusTeam = useWorldStore((state) => state.focusTeam);
  const hoverTrainee = useWorldStore((state) => state.hoverTrainee);

  const results = useMemo(() => search(query), [query]);

  // A filtered list whose highlight stayed where it was would leave the cursor
  // pointing past the end of the results, and Enter would then choose nobody.
  // Clamped where it is read rather than reset when the query changes: the
  // narrowing and the correction then happen in the same render, so the list is
  // never briefly drawn with its highlight off the end of itself.
  const at = cursor < results.length ? cursor : 0;

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    // Leaving the pointer's hover behind would keep a name standing in the
    // world over somebody the viewer is no longer considering.
    hoverTrainee(null);
  }, [hoverTrainee]);

  const choose = useCallback(
    (id: string) => {
      findTrainee(id);
      hoverTrainee(null);
      close();
    },
    [close, findTrainee, hoverTrainee],
  );

  /** Releases whoever is being observed, returning to the whole field. */
  const showAll = useCallback(() => {
    focusTrainee(null);
    focusTeam(null);
    setQuery('');
  }, [focusTeam, focusTrainee]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event)) return;
      if (event.key !== OPEN_KEY) return;
      setOpen(true);
      // Otherwise the slash lands in the field the moment it is focused.
      event.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const onFieldKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      close();
      event.preventDefault();
      return;
    }

    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (step !== 0 && results.length > 0) {
      setCursor((at + step + results.length) % results.length);
      event.preventDefault();
      return;
    }

    if (event.key === 'Enter' && results[at]) {
      choose(results[at].id);
      event.preventDefault();
    }
  };

  const travelling = pendingFindId !== null;

  return (
    <div className="people-search" data-visible={phase === 'ready'} data-open={open}>
      <button
        type="button"
        className="people-search__toggle"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        title="Find one of the sixteen by name — press /"
      >
        Find someone
      </button>

      {open && (
        <div className="people-search__body">
          <input
            ref={inputRef}
            type="text"
            className="people-search__field"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            onKeyDown={onFieldKeyDown}
            placeholder="Type a name"
            aria-label="Search the sixteen by name"
            autoComplete="off"
            spellCheck={false}
          />

          <ul className="people-search__list" role="listbox" aria-label="People">
            {results.map((entry, index) => (
              <li key={entry.id}>
                <button
                  type="button"
                  className="people-search__person"
                  role="option"
                  aria-selected={entry.id === focusedTraineeId}
                  data-cursor={index === at}
                  data-chosen={entry.id === focusedTraineeId}
                  onClick={() => choose(entry.id)}
                  onPointerEnter={() => {
                    setCursor(index);
                    hoverTrainee(entry.id);
                  }}
                  onPointerLeave={() => hoverTrainee(null)}
                >
                  <span className="people-search__name">{entry.name}</span>
                  {entry.project && (
                    <span className="people-search__project">{entry.project}</span>
                  )}
                </button>
              </li>
            ))}
            {results.length === 0 && (
              <li className="people-search__empty">Nobody by that name</li>
            )}
          </ul>

          <div className="people-search__foot">
            <span className="people-search__count">
              {travelling
                ? 'Travelling to them'
                : `${results.length} of ${ROSTER.length}`}
            </span>
            <button
              type="button"
              className="people-search__reset"
              onClick={showAll}
              disabled={focusedTraineeId === null}
            >
              Show all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
