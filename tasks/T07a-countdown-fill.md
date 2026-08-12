# T07a — Countdown fill so prepared keys show their order

**Depends on:** T07
**Handoff sections:** README §4 keyboard (prepare state)
**Algorithms:** `docs/algorithms.md` §4 — "Countdown fill on prepared keys" — **normative**
**Design reference:** `docs/mockups/countdown-fill-options.html` — open in a browser,
press play. Illustrative only: it shows the chosen encoding next to the three
rejected ones. **Do not copy its markup, class names or colour literals**; it was
written outside the design system. Where it and `docs/algorithms.md` differ, the
algorithms doc wins.
**PRD:** F5 (v1.1) · **Decisions:** D-022

---

## The problem

Every key with a note inside the 1-second lead window gets the same outline. In an
arpeggio that means five or six keys lit identically, so the highlight communicates
*soon* but never *next*. In real practice this was the biggest comprehension
failure in the product — you can see which keys are coming and not the order.

## The fix

Each prepared key **fills from the bottom** in its hand colour as its note
approaches. Fill height is the fraction of the lead time elapsed, so the fullest
key is next and the fill depth is the time remaining. Order and timing in one
continuous signal, with nothing new added to the screen.

Per `docs/algorithms.md` §4:

```ts
const imminence = Math.min(1, Math.max(0, 1 - (n.start - t) / leadTime));
```

Rendered as a layer inside the key: `height = imminence * 100%`, background
`handColour + alpha.prepareFill`, sitting **behind** the key label, clipped to the
key, and cleared the moment the key enters the press state.

The existing prepare border and inset glow stay — the fill is added to them, not
instead of them, so a prepared key still reads as prepared at a glance and the
fill answers "which one first" on closer look.

## Acceptance criteria

1. A key's fill height equals its `imminence` to within 1%: 0% when the note
   enters the lead window, ~100% the instant before it sounds.
2. **Chords fill identically.** Notes sharing a `start` produce equal fill at
   every sampled moment — the cue must not imply an order a chord does not have.
3. Where one key has two upcoming notes in the window, the **soonest** wins;
   fill never decreases while a nearer note is pending.
4. Fill is cleared on press: a sounding key shows the press style with no
   residual fill.
5. Hand colour is preserved — left fills orange, right fills cyan, and a piece
   with no hand data fills in the single colour.
6. The fill is behind the label; the label stays legible at every fill height,
   at both 1440×900 and 1024×768.
7. Lead time stays **musical**, so at 0.25× a key takes 4 wall-clock seconds to
   fill. Assert in both framings, as T07 AC2 does.
8. No measurable frame-time regression against T06 AC12's hitch gate on the dense
   fixture — the fill is one extra element per *prepared* key, not per key.

## Verify

```bash
npm test -- src/player
npm run test:e2e -- --grep "highlight|fill"
npm run check
```

## Done

- [ ] Eight criteria asserted, 2 and 3 explicitly — they are the ones that keep
      the cue truthful
- [ ] Screenshots at both viewports showing a partially-filled run and a chord
- [ ] Behaviour compared against `docs/mockups/countdown-fill-options.html`
      (the countdown-fill panel) — matching the *behaviour*, with styling taken
      from `tokens.ts`
- [ ] No settings toggle added; this replaces the old prepare rendering outright

## Traps

- Do not animate the fill with a CSS transition. It is already continuous because
  `imminence` is recomputed every frame; a transition would lag the truth.
- Do not let the fill overflow the key or paint over the label — `overflow:
  hidden` on the key, fill below the label in stacking order.
- A chord that fills unevenly is a bug, not a nicety. It teaches a false order.
