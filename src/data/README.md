# Data

Reserved for the training dataset. Nothing in this directory is wired into the
scene yet — Phase 1 builds the world, Phase 2 populates it.

## Source

The normalized dataset lives at:

```
/home/finstein-emp/Desktop/torcher/Data viz/data/odyssey.json
```

It contains 16 people (`P01`–`P16`), 5 projects, 25 skills, 17 challenges and 10
logged weeks spanning June–August 2026. Each person carries a `journeySurvey`
with `startConfidence` and `nowConfidence` (1–5, as strings) plus `skillIds`,
and challenges carry `affectedPersonIds`.

`types.ts` declares the subset of that shape the visualization needs.

## Known gaps

These are absences in the source, not omissions to be filled in. The brief is
explicit that missing data is represented as missing and never fabricated:

- `aiToolIds` and `weeks` are empty for every person — no source links a person
  to a specific tool or active week.
- Nine skills have `popularity: null` because they come from the daily log,
  which has no per-person attribution. Any size or count encoding must handle
  null rather than coercing it to zero.
- One participant (`P16`) has several fields flagged in `placeholderFields`.
- Two people submitted the journey survey twice; merged answers are joined with
  `" | "`, so numeric parsing has to split on that separator before coercing.

## Import approach

When the data is brought in, copy it to `src/data/odyssey.json` and import it
directly — `resolveJsonModule` will need enabling in `tsconfig.app.json`. A
single copy inside `src/` is deliberate: the previous project kept two copies in
sync with a hook, which is a class of drift bug worth not inheriting.
