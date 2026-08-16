# Design contract

The design handoff is the **sole UI source of truth**:

```
design_handoff_piano_practice_player/
  README.md                      <- every colour, size, spacing and state, per screen
  Piano Practice Player.dc.html  <- the working prototype
  PRD.md                         <- byte-identical to the repo-root PRD.md (verified)
```

This file does **not** restate the README — that would drift. It adds the three
things the README lacks: a component map, a complete state inventory, and the
fidelity gate.

**Read `README.md` §"Screens / Views" before building any component.** Read the
matching section again before marking it done.

---

## 1. Rules

1. **Every colour comes from `src/design/tokens.ts`**, delivered through
   Tailwind's `@theme` block (D-014/D-015) as utilities (`bg-card`,
   `text-hand-right`) or CSS variables (`var(--color-card)`).
   `npm run check:guardrails` fails the build on raw hex, `rgb()`, **or a
   Tailwind arbitrary colour** (`bg-[#101216]`) outside `src/design/`.
   `space` and `type` are reference scales, not allowlists — where the handoff
   states an exact size for a specific element, use it literally, including as an
   arbitrary Tailwind value like `p-[7px_11px]` (D-013).
2. **Recreate, don't port.** Never import `support.js`, `DCLogic`, `x-dc`,
   `sc-for`, or any prototype runtime symbol. Read the prototype for layout,
   geometry and state logic; write idiomatic React.
3. **Prototype-only chrome never ships:** the fixed bottom "STATES" strip, its
   `padding-bottom: 42px` shell reservation, and every `simulate:` button
   (rejected file / valid upload / no device).
4. **The prototype's data is fake.** The 8-entry `CATALOG`, the Für Elise note
   array, the hash-based `judge()` grading and the hardcoded 7 extra notes are
   scaffolding. Only the *formulas* survive (`docs/algorithms.md` §9).
5. **Fonts are self-hosted.** The handoff loads Space Grotesk and IBM Plex Mono
   from Google Fonts; the app must ship them locally so the player works offline.
6. **Glyphs are text, not icons.** `▶ ❙❙ ← → ♯ ·` — no icon library, no SVG, no
   image assets anywhere.
7. Sharps render as **U+266F (♯)**, never ASCII `#`.

## 2. Component map

Route → components → design section. Build in this order within each task.

### `/` — Home
| Component | Handoff section | Notes |
|---|---|---|
| `AppHeader` | §1 header row | cyan dot + wordmark, mono "LOCAL LIBRARY · NO ACCOUNT" |
| `CatalogSearch` | §1 search field | 62px tall, leading `/` glyph, Clear button only when non-empty, Escape clears |
| `SearchResults` / `SearchResultRow` | §1 results list | mono count label, duration in `handRight` |
| `NoResultsUpload` | §2 | `<label>` wrapping hidden file input; format/limit hint beside it |
| `UploadError` | §2 upload error | never a spinner; user stays on the view |
| `CatalogUnavailableBanner` | §3 | amber; sits **above** the search field; results hidden, library + upload stay live |
| `MyPieces` / `SavedPieceRow` | §1 My pieces | delete button turns `error` on hover |
| `EmptyLibrary` | §1 empty library | dashed border, exact copy from the README |
| `UploadControl` (My pieces) | — (D-021) | ghost button in the My pieces heading row; one upload implementation, two entry points |
| `CatalogBrowse` | §1 results list, unfiltered | empty query shows the sorted, paginated catalog |
| `AboutPanel` | — (D-023) | `Modal`; carries the sampler + Mutopia attribution moved off Home |

### `/pieces/:pieceId` — Player
| Component | Handoff section | Notes |
|---|---|---|
| `PlayerHeader` | §4 header | ← Library, title block, `HandLegend`, mute toggle, listen toggle |
| `TogglePill` | §4 toggle pill style | shared by mute + listen; `on` = accent border, `accent+18` bg |
| `ImportNoticeStrip` | §4 dropped-notes notice | persistent, amber, sits under the header |
| `WaterfallStage` | §4 waterfall | lookahead overlay top-left; listening pill top-right |
| `PianoKeyboard` | §4 keyboard | 4 states: idle / prepare / press-now / error |
| `TransportRow1` | §4 transport row 1 | play button, time readout, `SeekBar` |
| `SeekBar` + `LoopRegion` + `LoopMarker` | §4 seek bar, loop region | 34px hit area, `touch-action: none`, pointer capture |
| `TransportRow2` | §4 transport row 2 | speed selector, loop controls, shortcut hint; **wraps** |
| `TransientNotice` | §4 notice strip | auto-dismiss 4200ms |
| `VolumeSlider` | — (D-020) | beside the mute toggle; seek-bar styling; perceptual `p²` gain |
| Countdown fill | §4 prepare state (D-022) | fill height = imminence; chords fill identically |
| `ListenSetupModal` / `MidiDeviceRow` | §5 | footnote about Chrome/Edge, pedals, A–B |
| `MidiUnsupportedError` | §5 no-device error | concrete recovery steps |

### `/reports/:attemptId` — Report
| Component | Handoff section | Notes |
|---|---|---|
| `ReportHeader` | §6 header | mono sub: attempt · speed · played · expected notes |
| `AccuracyCard` / `PitchAccuracyCard` / `HandAccuracyCard` | §6 stat cards | 46px/700 numerals; accuracy card has the brighter border |
| `MistakeTypeGrid` | §6 "What went wrong" | five cards, dot colours split error vs amber |
| `MistakeTimeline` | §6 "Where the mistakes are" | 26 bars, clickable |
| `AttemptHistory` | §6 earlier attempts | current attempt's % in `handRight` |

Shared primitives — build only these, only when a second consumer appears:
`GhostButton`, `TogglePill`, `StatusBanner`, `MonoLabel`, `ErrorPanel`, `Modal`.

## 3. State inventory

Every state below must be reachable and visually verified. In the prototype the
"STATES" strip jumped between them; in the app they are reached through real
flows, so the component tests are the only place several of them are exercised.

**Home:** empty library · library populated · results · no results/upload ·
upload error (bad extension, >10 MB, >30 min, unparseable, zero notes) ·
catalog unavailable · query non-empty (Clear visible).

**Player:** paused at 0:00 · playing · scrubbing (tooltip visible) · each speed
(1× / 0.5× / 0.25×) · muted · A set only · A+B set (loop active) · dragging a
marker · dropped-notes notice · transient notice · hand data present (two
colours) · hand data absent (single colour, legend collapsed).

**Listen:** setup modal · no device error · active/listening pill · error flash ·
attempt ended by stop / seek / speed change / disconnect / piece end.

**Report:** full attempt · partial attempt · no mistakes (empty buckets) ·
hand data absent (BY HAND card omitted) · attempt history empty vs populated.

**Asset failure (not in the handoff — new, see decisions D-006):** catalog entry
opens but its score asset 404s or fails checksum. Reuse the §2 upload-error card
styling verbatim with a message naming the piece and offering upload.

## 4. Responsive gate

- Player is a **viewport-height flex column, no page scroll**: header → optional
  notice → waterfall (`flex: 1`) → keyboard (clamped) → transport.
- Home and Report scroll in a single centred column (880px / 900px max-width).
- Verified at **1440×900** (laptop) and **1024×768** (tablet landscape).
- No horizontal page scroll at any width ≥ 1024.
- Everything is pointer-event driven so mouse and touch behave identically.
  `touch-action: none` on the seek bar and markers.

## 5. Fidelity gate (per screen, before a task is done)

1. Open the prototype beside the app at the same viewport size: `python -m
   http.server 8000` in the handoff folder, then load the `.dc.html` over HTTP
   (`support.js` must sit beside it).
2. Walk the README section line by line; every stated value matches.
3. Every state in §3 for that screen renders correctly.
4. `npm run check:guardrails` passes.
5. Visual snapshots approved at both sizes.

Deviations require an entry in `docs/decisions.md`. The **visual/behavioural**
deviations are D-006 (asset-failure state), D-009 (listen auto-start, kept as
designed), D-012 (sampler attribution line) and D-047 (keyboard contrast) — the
first three are additive; D-047 deliberately replaces the keyboard palette and
state contrast. D-011 resolves a PRD-vs-decision conflict
about the live `missed` flash. The **engineering** deviations, which change no
visuals at all, are D-002 (windowed waterfall), D-003/D-004 (grading), D-005
(clock domains) and D-014 (tokens as CSS custom properties); `docs/algorithms.md`
marks each at its point of use.
