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

URL flags: `?debug` shows frame timing, draw calls, geometry/program counts and camera framing;
`?nogl` forces the no-WebGL fallback.

## Git

Never commit unless explicitly asked. Leave work in the working tree.

## TypeScript

`strict` is deliberately off. Do not enable it and do not flag its absence. These flags are on and
do constrain how code must be written:

- `verbatimModuleSyntax` — type-only imports must use `import type`
- `erasableSyntaxOnly` — no enums, no parameter properties, no namespaces; use `as const` objects
- `noUnusedLocals`, `noUnusedParameters` — an unused variable fails the build

## Conventions

- **Every constant lives in `src/config/`.** No magic numbers anywhere else.
- **High-frequency work mutates refs, buffers and uniforms inside `useFrame`.** Never React state —
  a value that changes per frame must not re-render the tree.
- **Missing data is shown as missing, never fabricated.** `src/data/README.md` documents the gaps:
  `aiToolIds` and `weeks` are empty for everyone, nine skills have `popularity: null` (handle the
  null, do not coerce to 0), `P16` carries `placeholderFields`, and two people double-submitted so
  some answers are joined with `" | "` and must be split before numeric parsing. The middle month's
  confidence is interpolated and must be labelled as such wherever it is shown.
- `src/data/odyssey.json` is the single copy of the dataset. Do not add a second one.
- `src/data/README.md` and `src/data/types.ts` still say nothing is wired into the scene. That is
  stale — the scene renders from `src/data/` today.

## WebGL gotchas

These are not guessable and each one has cost a debugging session:

- **GLSL lives in `.glsl.ts` files as template literals.** A backtick anywhere in shader source or
  its comments silently terminates the literal. `half` is a reserved word — using it as a variable
  name fails the whole program to compile, and a material whose shader will not compile draws
  nothing at all rather than erroring loudly.
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
