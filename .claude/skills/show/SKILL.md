---
name: show
description: Build the project, make sure the dev server is running, and say exactly where to click to see a change. Use after finishing a visual change so the user can judge it.
disable-model-invocation: true
---

Hand a finished visual change over for the user to look at. They judge the result — do not try to
verify appearance yourself with headless screenshots.

## Steps

1. **Typecheck and build.**

   ```
   npm run build
   ```

   If it fails, stop and fix it. Do not hand over a broken build.

2. **Check the dev server.**

   ```
   curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5173/
   ```

   `200` means it is already up — say so and reuse it, do not start a second one. Anything else,
   start it in the background with `npm run dev` and wait for the port to answer.

3. **Say where to look.** Name the exact route to what changed. The world is three nested boxes and
   the keyboard is the fastest way in:

   | | key | what is in it | lenses |
   |---|---|---|---|
   | Month 1 | `1` | the sixteen individually, and the classes each liked | People, Classes |
   | Month 2 | `2` | team gravity, five project cores and their constellations | People, Teams, Projects |
   | Month 3 | `3` | what each person found hard | People, Challenges |

   Lenses are the row along the bottom, and a lens is dimmed in a month it does not apply to.
   Behaviour is click-gated on purpose: entering a month shows the people and stops there, so say
   which lens to click, not just which month.

   Add `?debug` to the URL when the change is about draw calls, framing or performance.

4. **Say what to expect, and how long.** Team gravity holds for 2.5s before it starts and ramps over
   4s more, and each project figure only assembles once its own team has gathered — so several
   seconds pass between clicking Projects and seeing the constellations. Say so, or a correct
   change reads as a broken one.

5. **Report honestly.** State what you changed and what you did not verify. If something in the
   change is uncertain or you had to assume something, say that here rather than letting the user
   discover it.

## Do not

- Do not commit. This repository commits only when explicitly asked.
- Do not screenshot headlessly to judge appearance — SwiftShader runs at about 1 FPS, film grain
  resamples every frame and the idle camera drifts, so diffs are meaningless.
- Do not start a second dev server if one is already answering on 5173.
