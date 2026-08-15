# T11 — Mobile audio, hand colours, sorting and Home navigation

**Status: DONE — implemented 2026-08-13, outside the Codex harness.**
**Depends on:** T07a · **Decisions:** D-024 … D-031

---

> **Read this first.** This task file is retrospective. The code was written
> directly rather than specified and handed to Codex, which is not how this
> repo works — every other unit of work in `tasks/` was specified first, built
> by Codex against acceptance criteria, and verified. This file exists so the
> harness record has no gap, not as a template to copy. Future work goes back
> through the normal route.
>
> The reasoning for every change is in `docs/decisions.md` D-024 … D-031. Those
> entries are the authority; this file is the index.

## What shipped

| # | Change | Decision |
|---|---|---|
| 1 | Web Audio claims the iOS *playback* session so the iPhone ring/silent switch stops muting it; context re-resumes after lock/interruption; a strip appears when audio is held back | D-024 |
| 2 | MIDI hand assignment works at any track count, not only two | D-025 |
| 3 | Hand colours and the hand→colour mapping are user-selectable | D-026 |
| 4 | The player header fits a 375px screen; shell uses `100dvh` | D-027 |
| 5 | Catalog ordering is numeric; a sort selector is exposed | D-028 |
| 6 | Home leads with the learner's own pieces; browse gained a composer filter | D-029 |
| 7 | Re-opening a piece from search keeps its practice speed | D-030 |
| 8 | The keyboard windows to the piece's range below 11px per white key | D-031 |

## Evidence gathered before the changes

Measured on the running preview, not inferred:

- Player header laid out to **531px inside a 375px viewport**. Title width 0,
  `header-audio-controls` spanning 261–418, Listen mode at 436–531, all under
  `overflow: hidden`. After: `scrollWidth === clientWidth === 375`.
- **My pieces began at y=3909** on a 375px-wide Home. After: y=234.
- `midiHands` returned nothing for **27 of 596** catalog pieces. After: 3, all
  genuinely single-track (`ellen-s-song`, `lace`, `prelude-op-45`).
- **24 adjacent pairs** in the shipped manifest sorted out of numeric order
  ("Invention 15" before "Invention 2").
- Für Elise's mixed hand colours were traced to the source MIDI and found
  **correct** — the coda alternates the E/D♯ tremolo between staves. No
  renderer defect. See D-026.

## Files

New: `src/playback/audioSession.ts`, `src/design/handPalette.ts`,
`src/player/handColors.tsx`, `src/player/HandColorControl.tsx`,
`src/player/keyboardWindow.ts` (+ three test files).

Changed: `src/App.tsx`, `src/catalog/CatalogRepository.ts`,
`src/home/HomeView.tsx`, `src/home/HomeRoute.tsx`, `src/music/parse.ts`,
`src/playback/{PlaybackEngine,TonePlaybackRuntime,runtime}.ts`,
`src/player/{PianoKeyboard,PlayerHeader,PlayerView,WaterfallStage,Notices,keyboardGeometry}.tsx`.

## Verified

```
npm run check   # types + lint + guardrails + 198 unit tests — all pass
npm run build   # clean
```

Driven on the production preview at 1440×900, 1024×768, 768×1024 and 375×812:
no horizontal page overflow at any size, player at viewport height, header
never overflowing, and every falling note landing on its own key in both the
full and the windowed keyboard.

## Not verified — carry forward

- [ ] **D-024 needs an iPhone.** The silent-switch fix cannot be reproduced in a
      desktop browser. Acceptance is: ringer switch set to silent, open a piece
      over LAN, press play, hear it. Until someone does that on the device, this
      is a well-founded fix, not a confirmed one.
- [ ] Three single-track catalog pieces still render in one colour (D-025).
- [ ] The keyboard window helps least on wide-range pieces — Für Elise spans
      A1–E7, so a 375px screen still only reaches 9.4px per key (D-031).
