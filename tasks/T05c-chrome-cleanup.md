# T05c — Home and transport chrome cleanup

**Depends on:** T05b
**Handoff sections:** README §1 header row, §4 transport row 2
**PRD:** F3, F4 · **Decisions:** D-023

---

## Why

Three pieces of chrome that survived from the design handoff and do not earn their
place in use. Each is small; together they are most of what makes Home feel
underwhelming.

## 1. Move the sampler attribution off Home (D-023)

"Salamander Grand Piano by Alexander Holm · CC BY 3.0" currently sits under the
Home content. It **cannot be deleted** — the samples ship with the app, CC-BY 3.0
requires attribution on redistribution, and the app is publicly deployed.

Move it into a small **About** affordance: a ghost-styled "About" control in the
Home header (opposite the wordmark), opening the existing `Modal` primitive with

- what the app is, in one line,
- the Salamander credit with its licence link,
- a line noting catalogue scores come from the Mutopia Project under their
  individual licences, linking to `catalog/LICENCES.md` content or the Mutopia
  licence page.

Present, findable, and off the front page.

## 2. Remove "LOCAL LIBRARY · NO ACCOUNT"

It was meant to reassure that nothing is uploaded anywhere. It reads as unexplained
jargon to the person it is aimed at, which means it is not doing its job. Delete it
from the header. The reassurance moves into the About panel, phrased plainly:
everything stays on this device; there is no account and nothing is uploaded.

## 3. Fix the transport hint

Currently `SPACE PLAY · ← → 5s · DRAG BAR TO SCRUB` — cryptic and partly
redundant.

- Drop the space hint. The play button is a 46px circle in the accent colour; it
  does not need a caption.
- Drop "drag bar to scrub". A progress bar affords dragging.
- Keep one hint, written as words: **`← → SKIP 5 SECONDS`**. That is the only
  non-obvious control, and it is the one that serves the original pain of
  replaying a passage.

Keep the existing mono 10px `color.monoDim3` treatment and right alignment.

## Acceptance criteria

1. Home header shows the wordmark and an About control; "LOCAL LIBRARY · NO
   ACCOUNT" appears nowhere.
2. The Salamander credit and its CC-BY 3.0 link are absent from the Home body and
   present in the About panel.
3. About opens and closes via the existing `Modal` primitive, closes on Escape and
   on backdrop click, and returns focus to the About control.
4. The About panel names the Mutopia Project as the catalogue source with a
   licence link.
5. Transport hint reads `← → SKIP 5 SECONDS` and nothing else; the shortcuts
   themselves are unchanged and still work.
6. Both viewports still layout clean with no horizontal scroll; screenshots saved.
7. No licence text is removed from the repository — `catalog/LICENCES.md` and
   `public/audio/salamander/ATTRIBUTION.md` are untouched.

## Verify

```bash
npm test -- src/home src/transport
npm run test:e2e -- --grep "about|header|transport"
npm run check
```

## Done

- [ ] Seven criteria asserted, 2 and 7 explicitly — attribution must move, not vanish
- [ ] About panel reviewed for plain language: no jargon, no apology
- [ ] Screenshots of Home header and the About panel at both viewports

## Traps

- Attribution is a licence obligation, not a design element. Moving it is fine;
  removing it is a breach. If in doubt, keep it visible.
- Do not build a settings panel. About is informational only — no controls.
