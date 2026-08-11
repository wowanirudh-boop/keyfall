# T06 — Transport controls

**Depends on:** T04, T05. The MVP gate sits at the end of **T03**, which lands
after this task.
**Handoff sections:** README §4 Transport rows 1 and 2, §Interactions
**Algorithms:** `docs/algorithms.md` §5, §6, §8
**PRD:** F4

---

## Goal

Practice-first transport: play, slow down, scrub precisely, drill a section.

## Deliverables

`PlayButton`, `TimeReadout`, `SeekBar`, `LoopRegion`, `LoopMarker`,
`SpeedSelector`, `LoopControls`, `PlayerShortcuts`.

## Behaviour

**Play button** — 46px circle. Paused: `color.handRight` bg, `color.onAccent`
glyph `▶` 15px. Playing: `color.control` bg, `color.text` glyph `❙❙` 13px.

**Time readout** — mono 13px, `min-width: 96px`, `m:ss / m:ss` per §8.

**Seek bar** — 34px hit area with `touch-action: none`; 4px track; played portion
`color.handRight`; playhead 3px × 18px `color.text` with `shadow.playhead`.
Pointer events with `setPointerCapture`, so mouse and touch behave identically.
While dragging: tooltip above the handle (`color.text` bg, `color.bg` text, mono
11px) **and the visualization updates live** — the learner finds a passage by
sight. On release the previous playing/paused state is preserved.

**Speed selector** — 1× / 0.5× / 0.25×. Selected: border `color.handRight`, bg
`color.handRightTint`, text `color.handRight`. Immediate effect, position kept.

**A–B loop** — transcribe `docs/algorithms.md` §6 exactly. The rules are
**asymmetric on purpose**: `setA` clears B when B ≤ t; `setB` swaps when t ≤ A.
Markers drag with a 0.5 s minimum separation. Loop region: fill
`color.amber + alpha.loopFill`, border `1px solid color.amber + alpha.loopBorder`,
16px tall. Label `LOOPING 0:07–0:15`.

**Shortcuts** — player route only. Space toggles play (`preventDefault`), ← / →
seek ∓5 s. Do not fire while a text input has focus.

**End of piece** — stops at duration; play from the end restarts at 0, or at A
when a loop is set.

## Acceptance criteria

1. Dragging the bar with a mouse and with synthetic touch events produces
   identical positions.
2. **Seek lands within ±100 ms** of the drop position, asserted at 20 positions
   across a 10-minute piece at every speed. *(PRD F4.)*
3. Dragging while playing keeps playing on release; dragging while paused stays
   paused.
4. The visualization updates during the drag, not only on release.
5. Speed change mid-playback preserves position and is audible on the next note.
6. `setA` with B already before the playhead clears B. `setB` before A swaps
   them. Markers cannot come closer than 0.5 s by dragging.
7. Loop wraps at B to A with no drift over 50 wraps and no overshoot past B.
8. Space, ←, → work on the player route and nowhere else; Space does not scroll
   the page.
9. Play at the end restarts at 0 without a loop, at A with one.
10. Transport row 2 wraps at 1024px without horizontal page scroll.
11. The time readout formats as `m:ss / m:ss` per `docs/algorithms.md` §8 —
    golden cases `0:00`, `0:46`, `2:05`, and a negative or non-finite input
    clamps to `0:00` (PRD F4).
12. **No frame hitches while scrubbing.** T05's perf harness records only a
    60-second *average* fps (`(commitCount - 1) / elapsedSeconds`), which cannot
    detect the failure T05's own trap warns about: rebuilding the waterfall
    window every frame, or on every seek tick, instead of on threshold crossing.
    A 150 ms rebuild stall every few seconds costs ~2% of frames — it passes a
    ≥ 58 fps average comfortably and looks like a visible stutter.

    Extend the harness to record the **longest frame interval** and the **count
    of frames over 32 ms**, then assert during a continuous 10-second drag across
    the 30-minute dense fixture: longest frame **< 50 ms**, and frames over 32 ms
    **< 1%**. Scrubbing is the highest window-rebuild-rate interaction in the
    product, so this is where the cadence is really tested.

## Verify

```bash
npm test -- src/transport
npm run test:e2e -- --grep "transport|scrub|loop|shortcut"
npm run check
```

## Done

- [ ] Twelve criteria asserted; 2 and 12 explicitly (a PRD number, and the hitch gate T05 could not catch)
- [ ] Every Player transport state in `docs/design-contract.md` §3 verified at
      both viewports
- [ ] Loop region and markers use `alpha.loopFill` / `alpha.loopBorder`, not
      literal hex

## Traps

- Do not normalize the A–B asymmetry. It is transcribed from the prototype and
  is the specified behaviour.
- `touch-action: none` on the bar *and* the markers, or touch drag scrolls the
  page instead of seeking.
- Shortcuts must not leak into the Home search field.
