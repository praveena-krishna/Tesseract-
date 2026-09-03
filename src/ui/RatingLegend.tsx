import { RATING_MAX, ratingOf } from '../data/ratings';
import type { Rating } from '../data/ratings';
import { traineeById } from '../data/world';
import { MEDALLION } from '../config/dimensions';
import { useWorldStore } from '../store/useWorldStore';

/** The four weights, thinnest first, as the scale reads. */
const STEPS: Exclude<Rating, null>[] = [1, 2, 3, 4];

/**
 * The key to how heavily each person's line runs.
 *
 * Weight is the one channel in this month carrying an assessment rather than a
 * count, and it is the only thing distinguishing the sixteen here — every
 * vessel burns identically, so a viewer who cannot read the lines cannot read
 * the month at all. That makes this the key the lens most needs.
 *
 * Each row is drawn at the weight it stands for, out of the same strands the
 * world draws, so the key is on the scale of the thing it explains rather than
 * being four tidy rules chosen to look even.
 */
export function RatingLegend() {
  const lens = useWorldStore((state) => state.lens);
  const enteredMonth = useWorldStore((state) => state.enteredMonth);
  const focusedTraineeId = useWorldStore((state) => state.focusedTraineeId);
  const hoveredTraineeId = useWorldStore((state) => state.hoveredTraineeId);

  // A chosen person outranks a hovered one, so sweeping the pointer across the
  // month cannot take the key away from whoever is being read.
  const subject = focusedTraineeId ?? hoveredTraineeId;
  const theirs = subject ? ratingOf(subject) : null;

  if (lens !== 'databricks' || enteredMonth !== MEDALLION.MONTH) return null;

  return (
    <aside className="legend" aria-label="What each person's line means">
      <div className="legend__head">
        <p className="legend__title">How thick a person&rsquo;s line runs</p>
      </div>
      <p className="legend__note">their rating, out of {RATING_MAX}</p>

      <ul className="legend__list legend__list--weights">
        {STEPS.map((rating) => (
          <li key={rating} className="legend__item">
            <span className="weight-key__mark" aria-hidden="true">
              {/*
                Drawn as the strands the world draws, not as one rule of
                varying width — the beam out there is made of separate lines,
                and a key that smoothed them into a solid bar would be
                explaining something the viewer cannot find.
              */}
              {Array.from({ length: rating }, (_, strand) => (
                <span key={strand} className="weight-key__strand" />
              ))}
            </span>
            <span className="legend__name">
              {rating} / {RATING_MAX}
            </span>
          </li>
        ))}
      </ul>

      {/*
        Said outright, because the alternative reading is the wrong one: no line
        looks like the very bottom of the scale, and it is not — nobody assessed
        them at all.
      */}
      <p className="legend__note legend__note--foot">
        A person with no rating recorded has no line, rather than the thinnest
        one.
      </p>

      {subject && (
        <div className="legend__detail">
          <p className="legend__title legend__title--second">
            {traineeById.get(subject)?.name ?? subject}
          </p>
          <p className="legend__note">
            {theirs === null
              ? 'No rating recorded'
              : `${theirs} of ${RATING_MAX}`}
          </p>
        </div>
      )}
    </aside>
  );
}
