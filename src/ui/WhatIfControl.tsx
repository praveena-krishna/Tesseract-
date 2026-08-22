import { useState } from 'react';
import { skillById, trainees } from '../data/world';
import { isBaseline } from '../sim/whatIf';
import { useWorldStore } from '../store/useWorldStore';

/** Topics worth asking counterfactuals about — the ones most people held. */
const KEY_SKILL_IDS = ['ai-topics', 'databricks', 'git', 'database', 'data-visualization'];

/**
 * The counterfactual conditions.
 *
 * These do not open a separate model or a comparison view. Each control changes
 * a condition of the training and the world in front of you re-solves: gravity
 * weakens and teams drift apart, a person's vessel fades and the project they
 * were building loses definition, a topic is never taught and the structures
 * for it never appear inside anyone.
 *
 * Collapsed by default. The world is the subject, and a permanently open panel
 * of controls would make this look like a dashboard with a 3D view attached.
 */
export function WhatIfControl() {
  const [open, setOpen] = useState(false);
  const whatIf = useWorldStore((state) => state.whatIf);
  const setWhatIf = useWorldStore((state) => state.setWhatIf);
  const resetWhatIf = useWorldStore((state) => state.resetWhatIf);
  const phase = useWorldStore((state) => state.phase);

  const modified = !isBaseline(whatIf);

  return (
    <div className="whatif" data-visible={phase === 'ready'} data-open={open}>
      <button
        type="button"
        className="whatif__toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        What if
        {modified && <span className="whatif__dot" aria-label="conditions changed" />}
      </button>

      {open && (
        <div className="whatif__body">
          <label className="whatif__row">
            <span className="whatif__name">Training length</span>
            <select
              className="whatif__input"
              value={whatIf.months}
              onChange={(event) =>
                setWhatIf({ months: Number(event.target.value) === 2 ? 2 : 3 })
              }
            >
              <option value={3}>Three months</option>
              <option value={2}>Two months</option>
            </select>
          </label>

          <label className="whatif__row">
            <span className="whatif__name">Without</span>
            <select
              className="whatif__input"
              value={whatIf.removedTraineeId ?? ''}
              onChange={(event) =>
                setWhatIf({ removedTraineeId: event.target.value || null })
              }
            >
              <option value="">Everyone present</option>
              {trainees.map((trainee) => (
                <option key={trainee.id} value={trainee.id}>
                  {trainee.name}
                </option>
              ))}
            </select>
          </label>

          <label className="whatif__row">
            <span className="whatif__name">Collaboration</span>
            <input
              className="whatif__slider"
              type="range"
              min={0}
              max={100}
              value={Math.round(whatIf.collaboration * 100)}
              onChange={(event) =>
                setWhatIf({ collaboration: Number(event.target.value) / 100 })
              }
            />
            <span className="whatif__value">
              {Math.round(whatIf.collaboration * 100)}%
            </span>
          </label>

          <label className="whatif__row">
            <span className="whatif__name">Never taught</span>
            <select
              className="whatif__input"
              value={whatIf.removedSkillId ?? ''}
              onChange={(event) =>
                setWhatIf({ removedSkillId: event.target.value || null })
              }
            >
              <option value="">Full curriculum</option>
              {KEY_SKILL_IDS.map((id) => (
                <option key={id} value={id}>
                  {skillById.get(id)?.name ?? id}
                </option>
              ))}
            </select>
          </label>

          <label className="whatif__row">
            <span className="whatif__name">Support</span>
            <input
              className="whatif__slider"
              type="range"
              min={0}
              max={100}
              value={Math.round(whatIf.support * 100)}
              onChange={(event) => setWhatIf({ support: Number(event.target.value) / 100 })}
            />
            <span className="whatif__value">{Math.round(whatIf.support * 100)}%</span>
          </label>

          <button
            type="button"
            className="whatif__reset"
            onClick={resetWhatIf}
            disabled={!modified}
          >
            Restore what happened
          </button>
        </div>
      )}
    </div>
  );
}
