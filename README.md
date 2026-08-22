# The Tesseract

One living 3D training universe: sixteen people, three months, a single
continuous space.

Everything exists inside the tesseract. There are no pages, no dashboard and no
charts — the world itself is the interface, and its physics are the
visualization.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typechecks, then bundles to dist/
npm run preview  # serve the production build
```

### URL flags

| Flag     | Effect                                                                 |
| -------- | ---------------------------------------------------------------------- |
| `?debug` | Frame timing, draw-call / geometry / program counts, and camera framing |
| `?nogl`  | Forces the no-WebGL fallback, for testing that path                     |

The `?debug` camera readout (`cam d… orig… az… pol…`) is how framing is actually
judged. `orig` — the camera's distance from the world's centre — is the number
that matters most, because the structure occupies specific radial bands and a
camera parked inside one ends up embedded in a metal beam.

### Controls

Drag to orbit, scroll or pinch to move closer. Click a person to enter them;
click a project formation to enter it; click empty space to let go. By keyboard:
arrow keys orbit, `+` / `-` change distance, `[` and `]` step through the
people, `Escape` steps back out, `Home` returns to the opening view.

## The system

Every layer is a consequence of the one beneath it, and all of them are on
screen at once.

- **The tesseract** — three nested shells of bevelled metal, the dimensional
  links between their corresponding vertices, and a volumetric core. Members
  dissolve as the camera closes on them, so it can travel inside the structure
  rather than being held outside by a beam in the way.
- **Sixteen vessels** — indigo-violet glass, one per person. The interior is
  raymarched along a refracted ray, so what is inside sits at real depth.
- **Skills inside them** — a constellation of nodes suspended within each
  vessel. Not labels: the count and density are what that person had learned by
  the current month, and the interiors visibly fill in over time.
- **Gravity** — team bonding is simulated, not animated. Each orb is pulled
  toward its team's centre by a force scaled by how that person rated their
  team, repelled by its neighbours, and held by a restoring pull toward where it
  sits when working alone.
- **Projects** — a formation condenses between members as the collaboration that
  builds it takes hold. It has no independent existence; weaken collaboration
  and it comes apart.
- **Challenges** — physical instability. A person under strain distorts, their
  interior churns, and the links they are part of fray.
- **Three months** — one continuous transformation of the same world, driven by
  dated evidence in the daily logs.
- **What-if** — counterfactual conditions applied to that same model, so the
  world in front of you re-solves rather than a mockup opening elsewhere.

## Data honesty

The visualization derives everything from the source dataset and says so where
it cannot.

- **Skills are dated from the daily logs.** Twenty of the twenty-five appear in
  the weekly records, which is what makes the temporal system real rather than
  an invented learning curve. Five come from surveys and were never scheduled
  topics; they are treated as present throughout rather than given a fabricated
  arrival date.
- **The middle month's confidence is interpolated.** People were asked how they
  felt at the beginning and at the end, never in between. The interface labels
  that value as interpolated wherever it appears.
- **One trainee never reported confidence**, and two answered the survey twice.
  The first rests at the neutral baseline; the others' submissions are averaged,
  since both are theirs and neither has a better claim.
- **Collaboration peaks in month two.** That is what the logs say — project
  mentions rise and then stop, because the work was finished. Formation maturity
  is therefore cumulative and holds, while live activity falls away.

## Architecture

```
src/
  config/       every colour, dimension and timing — no magic numbers elsewhere
  data/         the source dataset and the derived world model
  sim/          gravity, and the counterfactual layer
  scene/        what lives in the canvas
    Tesseract/  the structure: shells, geometry, links, core
    Trainees/   the vessels, the skills inside them, the identity label
    Teams/      connections and project formations
    Environment/backdrop and particulate
  shaders/      GLSL strings and the material patcher
  interaction/  camera rig, keyboard, motion preference
  store/        interaction state (zustand)
  ui/           the near-invisible DOM layer
```

Four rules hold the visual quality, each learned by breaking it:

- **Metal needs reflectance.** A near-black base colour at high metalness makes
  a black mirror, leaving only the fresnel rim visible — which reads as a
  glowing wire. The frames use a steel value so the lighting can model them.
- **Members need thickness.** A strut thin enough to read as a line has no
  visible chamfer, and the chamfer carries the travelling highlight.
- **Absorption cannot be additive.** The orbs are dark-tinted glass, and
  additive blending only ever brightens what is behind it. They use normal
  blending with instances depth-sorted every frame, since they write no depth.
- **Nothing synchronises.** Pulse periods and orbital tempos are mutually
  offset, so the field never falls into a metronome.

### The proximity dissolve

Structural members clear out of the camera's way, computed **per fragment** from
that fragment's own distance to the lens. Fading a shell as a whole object was
the obvious approach and the wrong one: it takes the far side with it, and the
far side of the surrounding shell is exactly what makes being inside the
tesseract legible.

It dissolves by dithering rather than by blending, so the material stays opaque
and keeps writing depth. A partially transparent frame would either occlude the
orbs behind it while being see-through, or stop occluding them entirely — both
worse than a member that visibly disperses as it clears.

The camera avoids the orbs, though, rather than fading them: they are the
subject, and a vessel the lens has ended up inside fills the frame with its own
interior.

## Performance

Roughly 35 draw calls per frame. Each shell is one merged geometry for its
struts and another for its joints; all sixteen dimensional links are a single
`LineSegments`; the orbs, their halos, and every skill node across all sixteen
people are one instanced call each; the whole collaboration layer — every curve
and every project core — is two more.

The orb interior is the most expensive shader in the scene, so its noise hash is
a few multiplies rather than the usual `fract(sin(dot(...)))`. That hash is the
innermost loop of the frame, and a trigonometric one there costs hundreds of
`sin` calls per fragment.

High-frequency work mutates refs, buffers and uniforms inside `useFrame` and
never touches React state.

### Depth of field, and why there isn't any

It was tried and removed. The atmosphere here — particulate, halos, the core,
the dimensional links — is additively blended and deliberately writes no depth.
A depth-of-field pass reads the depth *behind* those layers, finds the far
plane, and blurs them maximally, turning the particulate into exactly the lens
bokeh the composition was designed to avoid. Any future attempt has to composite
the atmosphere after the blur.

## Verification

`puppeteer-core` is a dev dependency driving the system Chrome for screenshots
and behavioural checks. Headless rendering here falls back to SwiftShader: the
output is colour-accurate but only a frame or two per second, so it is useful
for judging appearance, draw calls and state, and **never** for frame rate.

Two traps worth knowing before writing a check against this app. The film grain
resamples every frame, so comparing screenshots reports "changed" every time and
proves nothing — assert against the `?debug` readout instead. And the idle
camera drift means azimuth keeps moving after any scripted move settles, so an
exact-equality assertion on framing will fail for a correct camera.
