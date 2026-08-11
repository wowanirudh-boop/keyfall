# T05 — Player visualization

**Depends on:** T02, T04, S-1 verdict
**Handoff sections:** README §4 Player (waterfall, keyboard)
**Algorithms:** `docs/algorithms.md` §2, §3, §4
**PRD:** F3

---

## Goal

The falling-notes stage and the 88-key keyboard, pixel-close to the handoff, at
60 fps on real pieces.

## Deliverables

`WaterfallStage`, `PianoKeyboard`, `PlayerHeader`, `HandLegend`,
`ImportNoticeStrip`, `MidiConnectionBadge` (inert until T08), `TransientNotice`.

## Behaviour

**Geometry** — compute once for MIDI 21–108 per §2. 52 white, 36 black. Black
key `left = whiteIndexBefore × whiteWidth − blackWidth / 2`, width `0.62 ×
whiteWidth`, height `62%`, `z-index: 2`.

**Labels** — always visible. White: horizontal 9px `color.keyWhiteLabel`. Black:
`writing-mode: vertical-rl`, 7px `color.keyBlackLabel`. Sharps use **♯ (U+266F)**.

**Waterfall** — `pps = measuredHeight / lookaheadSeconds`. Per-note styles
exactly per §3. The containing layer moves with a single
`transform: translateY(t × pps)` per frame; notes are static within it.

**Windowed rendering (D-002) — mandatory.** Populate the layer only with notes
intersecting `[t − 2, t + lookahead + 2]` musical seconds, keyed by stable note
id. Rebuild on seek, speed change, resize, and when `t` crosses the window
margin — not every frame. Keep positions in absolute piece coordinates so notes
never shift when the window is rebuilt.

**Key states** — derived every frame, never stored. Precedence **error > press >
prepare > idle**, per §4. Advance the scan from a **cursor**, not index 0; reset
the cursor by binary search on seek.

**The pressed (sounding) state ships in this task, not T07.** PRD F3 is an MVP
clause: "the corresponding key visually depresses/lights while sounding". Render
the full press-now key style now — bg and border in the hand colour,
`shadow.pressedKey(hand)`, label `color.onAccent` at weight 500. T07 adds only
the *prepare* state and the label font-size enlargement. Prepare and error styles
may be implemented here but stay inert until T07/T08 wire their inputs.

**Resize** — `ResizeObserver` on the stage recalculates `pps` and the laid-out
slice.

**Hand colours** — right `color.handRight`, left `color.handLeft`. When
`hasHandData === false`, use `color.handRight` for everything and collapse the
legend.

**Lookahead overlay** — top-left, mono 10px: `"3S MUSICAL LOOKAHEAD · 6.0S AT
0.5x"`, recomputed as `lookahead / speed` to one decimal.

## Acceptance criteria

1. Geometry: 52 white + 36 black; `whites[0].midi === 21`;
   `whites[51].midi === 108`; black-key left/width match §2 to 4 decimal places.
2. Labels: `keyLabel(60) === 'C4'`, `keyLabel(66) === 'F♯4'`,
   `keyLabel(21) === 'A0'`, `keyLabel(108) === 'C8'`; no ASCII `#` anywhere.
3. A note with `start === t` renders with its bottom edge on the strike line
   (within 1px).
4. **Lookahead is constant in musical time:** the set of notes visible at
   position `t` is identical at 1×, 0.5× and 0.25×. *(This is the invariant that
   makes slow practice work — assert it directly.)*
5. The overlay reads "6.0S AT 0.5x" at 0.5× and "12.0S AT 0.25x" at 0.25×.
6. Key-state precedence holds: a key that is simultaneously pressed and in error
   renders error; pressed beats prepare.
7. Windowing: with a 16,000-note fixture, the DOM contains fewer than 400 note
   elements at any time, and every note that should be visible is present
   (compare against an unwindowed reference computation).
8. Sustained ≥ 58 fps and stable memory over 60 s of playback on the 30-minute
   dense fixture at 1440×900.
9. Resizing the window recomputes `pps` and keeps the note under the playhead
   under the playhead.
10. `hasHandData === false` renders one colour and the legend is collapsed.
11. **A sounding note lights its key** for exactly its duration, in its hand
    colour, with `shadow.pressedKey` — the PRD F3 MVP clause.
12. `PlayerHeader` renders the ← Library button, title block, `HandLegend`, the
    mute toggle and the listen toggle; the **mute toggle silences audio without
    changing position** and reflects "Audio on" / "Muted" (PRD F3).
13. `ImportNoticeStrip` renders every `ImportNotice` from T02 — dropped notes,
    structural fallback, ornament handling — persistently, and
    `TransientNotice` auto-dismisses at `motion.noticeMs` (4200 ms).
14. The waterfall background uses the `color.stage → color.stageGradientEnd`
    gradient and a 1px `color.strikeLine` rule at the bottom edge.
15. **Hand colours are correct on a real two-staff score.** T02's staff-mapping
    gate runs against an 8-note fixture; spike S-2 measured 99.873% across 1,578
    attacks on three real scores, and *that* measurement is currently protected
    by no test. Promote the three public-domain scores from
    `spikes/musicxml/fixtures/` (Bach BWV 846, Mozart K.545 exposition, Clara
    Schumann Op. 1 No. 1) into `src/music/__fixtures__/real-scores/`, point the
    existing ≥ 99% note-by-note gate at them, and assert here that the waterfall
    renders each note in the colour its source `<staff>` implies.

    This lands in T05 because this is where a silent regression becomes
    visible — wrong-coloured notes — rather than where it originates. Keep the
    small fixtures for the fast unit tests; the real scores gate correctness.

## Verify

```bash
npm test -- src/player
npm run test:e2e -- --grep "waterfall|keyboard"
npm run check
```

## Done

- [ ] Fifteen criteria asserted; 4, 7, 11 and 15 explicitly
- [ ] Verified side by side against the prototype at 1440×900 and 1024×768
- [ ] Pressed state live; prepare and error states implemented but inert
      (wired in T07/T08)
- [ ] `MidiConnectionBadge` is the §4 listening pill rendered by
      `WaterfallStage` — do not add a component the design map does not name
- [ ] Player is viewport-height with no page scroll at both sizes

## Traps

- `pps` must **never** depend on speed. If it does, lookahead stops being
  constant in musical time and criterion 4 fails.
- Notes must be `start`-sorted or the `break` in the §4 scan exits early and
  notes silently vanish.
- Rebuilding the window every frame defeats the point — rebuild on threshold
  crossing only.
- The error flash window (0.35) is **musical** seconds, so it is 1.4 s of wall
  clock at 0.25×. That is correct; do not convert it.
