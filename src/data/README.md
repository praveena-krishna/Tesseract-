# Data

The training dataset, and the layer that turns it into the world. Everything on
screen is derived from this directory — there is no second source and no scene
file with numbers typed into it.

## Source

`odyssey.json` is the single copy of the dataset. Two things fed it:

- **`Trainees data.csv`**, the cohort sheet, at the repository root. One row per
  trainee, with the classes they named, the difficulties they named, and their
  rating of the Databricks class out of four. This is the authority for all
  three: the class lists are carried into `people[].skillIds` and counted into
  `skills[].popularity`, the difficulties into `challenges[]`, and the Databricks
  rating into `ratings.ts`.
- **The earlier survey exports** — the daily tracking log, the journey survey and
  the feedback survey — which supply everything else: confidence at the start and
  at the end, team ratings, the ten weekly logs that date each topic, and the
  project rosters.

The journey survey had asked two of the sheet's questions first, and its answers
disagreed with it — people named difficulties on the sheet they had not named in
the survey, and one person's sheet row lists seven classes the survey does not.
Those two fields, `journeySurvey.interestTopics` and `journeySurvey.toughestTopics`,
now carry the sheet's answer rather than the survey's, so the file holds one
reading of each fact instead of two that contradict. Nothing on screen read the
survey copies — the world has always drawn from `skillIds` and `challenges[]` —
so this changes the record rather than the picture. The feedback survey's
`usefulTopics` and `biggestDifficulty` are left alone: they are different
questions, not older answers to these ones.

It contains 16 people (`P01`–`P16`), 5 projects, 25 skills, 26 challenges and 10
logged weeks spanning June–August 2026.

`types.ts` declares the subset of that shape the visualization needs. It is not
the only reader: `world.ts` builds the model the scene is drawn from, and
`classes.ts`, `challenges.ts` and `ratings.ts` each carry one month's reading.

## Known gaps

These are absences in the source, not omissions to be filled in. The brief is
explicit that missing data is represented as missing and never fabricated:

- `aiToolIds` and `weeks` are empty for every person — no source links a person
  to a specific tool or active week.
- Nine skills have `popularity: null` because they come from the daily log,
  which has no per-person attribution. Any size or count encoding must handle
  null rather than coercing it to zero.
- One participant (`P16`) has several fields flagged in `placeholderFields`. Her
  difficulties used to be among them, filled in with a guess, and the sheet has
  since answered that question properly — so the guess is gone and the flag with
  it.
- One participant (`P04`) never submitted the journey survey, so his
  `journeySurvey` is null. His classes and difficulties still come from the sheet
  like everyone else's; he simply has no survey to hold a second copy of them.
- Two people submitted the journey survey twice; merged answers are joined with
  `" | "`, so numeric parsing has to split on that separator before coercing.
- Confidence was asked at the start and at the end and never in between, so the
  middle month is a straight interpolation and is labelled as such wherever it
  is shown.
- The sheet's list columns are pipe-separated (`A | B | C`), not
  comma-separated, so that names containing a comma cannot split in two.

## The one judgement

The cohort sheet records *what* each person struggled with and never *how badly*.
Impact — the size each fragment is drawn at in the third month — is therefore
decided in `IMPACT_OF` in `challenges.ts` rather than read from anywhere, on the
principle that a difficulty which stops you learning outranks one that only
wastes your time. It is the single figure in the world that nobody in the cohort
supplied, and the key on screen says so.
