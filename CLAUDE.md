# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```
npm run dev       # vite, serves on http://localhost:5173
npm run build     # tsc -b && vite build — the ONLY typecheck; there is no `typecheck` script
npm run lint      # oxlint (NOT eslint — there is no eslint config)
npm run preview   # serve the production build
```

There is no test script and no test framework. There is no formatter — no prettier, no biome, no
`.editorconfig`. Match the surrounding file's style by hand.

Typecheck a change with `npx tsc --noEmit -p tsconfig.app.json`; `npm run build` also does it.

The project directory name contains a space, so quote paths in shell commands.

## How to verify a change

Build it, then hand it over: confirm `npm run build` passes, make sure the dev server is up, and
tell the user which month and which lens to click to see what changed. They judge the result.

Do not build headless screenshot harnesses to check appearance. Headless falls back to SwiftShader
at roughly 1 FPS, which is fine for draw-call counts and state but useless for anything timed, and
two things defeat screenshot diffing outright: film grain resamples every frame, and idle camera
drift keeps the azimuth moving. Assert against the `?debug` readout if you must assert.

`README.md`'s Verification section says the opposite — that puppeteer-core screenshots are good for
judging appearance. It is stale and this file overrides it; nothing in the tree uses puppeteer-core.
The `/show` skill performs the handover described above.

URL flags: `?debug` shows frame timing, draw calls, geometry/program counts and camera framing;
`?nogl` forces the no-WebGL fallback.

## Editing hooks

Every `Write`/`Edit` fires `.claude/hooks/glsl-guard.sh` and `.claude/hooks/lint-edited.sh` (oxlint
on the single edited file, errors only — warnings are dropped because the `useFrame` mutation
convention trips oxlint's immutability rule across nearly every scene file). Both need `jq` on PATH.

## Git

Never commit unless explicitly asked. Leave work in the working tree.

## TypeScript

`strict` is deliberately off. Do not enable it and do not flag its absence. These flags are on and
do constrain how code must be written:

- `verbatimModuleSyntax` — type-only imports must use `import type`
- `erasableSyntaxOnly` — no enums, no parameter properties, no namespaces; use `as const` objects
- `noUnusedLocals`, `noUnusedParameters` — an unused variable fails the build

## Conventions

- **Every constant lives in `src/config/`.** No magic numbers anywhere else. `index.ts` is a
  partial barrel — `ORBS`, `TEAMS`, `MEDALLION`, `GROWTH`, `CHALLENGES`, `DIMENSION`, `BONDS`,
  `PROJECTS_CONFIG`, `SHELL_FADE` and `HYPER_TURN` are not in it. Import those from the file itself
  (`../config/dimensions`, `../config/orbs`), never from `../config`.
- **High-frequency work mutates refs, buffers and uniforms inside `useFrame`.** Never React state —
  a value that changes per frame must not re-render the tree.
- **Missing data is shown as missing, never fabricated.** `src/data/README.md` documents the gaps:
  `aiToolIds` and `weeks` are empty for everyone, nine skills have `popularity: null` (handle the
  null, do not coerce to 0), `P16` carries `placeholderFields`, and two people double-submitted so
  some answers are joined with `" | "` and must be split before numeric parsing. The middle month's
  confidence is interpolated and must be labelled as such wherever it is shown.
- `src/data/odyssey.json` is the single copy of the dataset. Do not add a second one. The classes,
  the challenges and the Databricks ratings in it come from `Trainees data.csv` at the repository
  root, which is the cohort sheet and the authority for all three.
- **Challenge impact is the one figure nobody supplied.** The sheet records what each person
  struggled with and never how badly, so the fragment sizes come from `IMPACT_OF` in
  `src/data/challenges.ts` — a judgement, labelled as one in the key on screen. Do not present it
  as recorded.
- **In the Databricks lens every vessel glows at the same brightness.** Brightness carries no data;
  that was built and rejected. A person's rating is the weight of their line to the knowledge core —
  one thin strand per point out of four, since WebGL ignores `linewidth` — and an unrated person has
  no line at all rather than the thinnest one. `src/data/ratings.ts` holds them; the cohort's real
  answers cluster hard (twelve threes, two fours, two twos), so a nearly uniform field of beams is
  correct rather than a bug.

## WebGL gotchas

These are not guessable and each one has cost a debugging session:

- **GLSL lives in `.glsl.ts` files as template literals.** A backtick anywhere in shader source or
  its comments silently terminates the literal. `half` is a reserved word — using it as a variable
  name fails the whole program to compile, and a material whose shader will not compile draws
  nothing at all rather than erroring loudly.
- **A varying must be declared exactly once per stage, and read only in a stage that declares it.**
  Either mistake fails the program silently. `.claude/hooks/glsl-guard.sh` catches this on every
  edit to a `.glsl.ts` file — but not in `src/shaders/frameFresnel.ts`, which holds shader source
  under a name the guard does not match.
- **`InstancedMesh` caches its bounding sphere on first use and never refreshes it.** Anything that
  moves must call `computeBoundingSphere()` each frame or raycasting silently stops hitting it.
- **A vertex shader gets 16 attribute slots**, and each attribute takes a whole slot whatever its
  type — `attribute float` costs the same as a vec4. An instanced mesh spends 7 before you start
  (position, normal, uv, four matrix rows), so pack extra per-instance floats into vec4s.
- **`mergeGeometries` returns null on mixed indexed/non-indexed input.** Call `toNonIndexed()` first.
- **Group `renderOrder` propagates to descendants**, and it decides whether translucent layers
  composite over or under each other. Something meant to be seen *inside* the glass orbs must draw
  before them, not after.
- Glass orbs use normal blending with per-frame depth-sorted instances, never additive — additive
  layers write no depth.
- No depth of field. It was tried and removed: the additive atmosphere writes no depth, so the pass
  finds the far plane and blurs it maximally. Any retry must composite the atmosphere after the blur.
- Nothing synchronises. Pulse and orbital periods are deliberately offset from each other.

## Scope discipline

The three months are separate systems and the user scopes work to one of them at a time. Month 1 is
learning and classes, Month 2 is teams and project constellations, Month 3 is challenges. When asked
to change one, change only that one — leave the others, the Tesseract geometry, the camera and the
existing interactions alone.
