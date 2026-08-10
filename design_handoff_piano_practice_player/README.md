# Handoff: Piano Practice Player

## Overview
An interactive practice player that replaces YouTube piano tutorials. A learner picks a piece (catalog search or file upload) and gets a Rousseau/Synthesia-style falling-notes visualization over a labeled 88-key keyboard, with practice-first transport controls (0.25x/0.5x/1x, precise scrubbing, A–B loop). V1 adds anticipatory key highlighting and a MIDI "listen mode" that grades playing and produces a mistake report.

Source of truth for requirements: `PRD.md` in this bundle. Where this README and the PRD disagree, the PRD wins.

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype showing intended look and behavior, not production code to copy. The task is to **recreate these designs in the target codebase's environment** (React/Vue/Svelte/etc.) using its established patterns and libraries. If no codebase exists yet, pick the framework and implement there.

`Piano Practice Player.dc.html` is written against a small in-house streaming-template runtime (`support.js`). Read it for layout, styling, geometry math, and state logic — do not port the runtime. The keyboard geometry, waterfall time→pixel mapping, and grading/report math in its logic class are the parts worth copying verbatim as algorithms.

Open it by serving the folder (`python3 -m http.server`) and loading the .dc.html file; `support.js` must sit beside it.

## Fidelity
**High-fidelity.** Colors, type, spacing, and interaction behavior are final-intent. Recreate pixel-closely using the codebase's own component library where equivalents exist. The prototype is deliberately **silent** (no audio synthesis) and its **MIDI input is simulated** — real implementations must add Tone.js playback and Web MIDI capture.

## Screens / Views

### 1. Home (search + My pieces)
**Purpose:** get from a piece name to a playable visualization; reopen yesterday's piece.
**Layout:** single scrolling column, `max-width: 880px`, centered, page padding `40px 32px 120px`, vertical `gap: 36px` between blocks.
- **Header row:** flex, baseline-aligned, space-between. Left: 10px cyan dot (`#4CC2FF`, 50% radius) + wordmark "Piano Practice Player" (19px/700, letter-spacing -0.01em). Right: mono 11px `#6B727C`, letter-spacing 0.06em — "LOCAL LIBRARY · NO ACCOUNT".
- **Search field:** height 62px, padding `0 18px`, `1px solid #23262C` on `#14161A`, radius 8px, flex row gap 12px. Leading mono "/" glyph `#6B727C` 12px. Input: transparent, 17px, color `#E8EAED`, letter-spacing -0.01em, placeholder "Search a piece — Für Elise, Moonlight Sonata, Gymnopédie". Trailing "Clear" button appears only when the query is non-empty: `#1D2026` bg, 12px, padding 7px 11px, radius 5px; hover bg `#262A31`, color `#E8EAED`.
- **Results list:** section label mono 11px `#6B727C` — "N MATCHES · PUBLIC DOMAIN & CC SOURCES". Each row: grid `1fr auto`, gap 18px, padding `16px 18px`, `1px solid #1D2026` on `#101216`, radius 8px, cursor pointer; hover border `#34576B`, bg `#131820`. Left column gap 6px: title 16px/500; byline 13px `#8A9099` (composer · arranger); meta mono 11px `#5B626B` uppercase (source + license). Right: duration mono 13px `#4CC2FF`.
- **My pieces:** heading row (14px/500 "My pieces" + mono 11px `#5B626B` "N SAVED LOCALLY"). Rows: grid `1fr auto auto`, gap 16px, padding `14px 16px`, same card border/bg, radius 8px; hover border `#2C3037`. Title 15px/500; sub mono 11px `#5B626B` (e.g. "BEETHOVEN · PRACTISED YESTERDAY · 0.5x"); duration mono 12px `#8A9099`; "delete" button `1px solid #23262C`, mono 11px `#5B626B`, hover color `#FF3B6B` / border `#4A2230`.
- **Empty library:** `1px dashed #23262C`, radius 8px, padding 30px, centered 13px `#6B727C` — "Nothing saved yet. Every piece you open — searched or uploaded — is kept here for tomorrow."

### 2. No results / upload (same screen, alternate state)
Card: `1px solid #1D2026` on `#101216`, radius 8px, padding 26px, column gap 18px.
- Headline 15px/500: `Nothing in the catalog matches "<query>".`
- Body 13px/1.55 `#8A9099`, max-width 52ch, explains the redistribution-license constraint and offers upload.
- Primary upload control is a `<label>` wrapping a hidden file input: bg `#4CC2FF`, color `#06121A`, 14px/500, padding `12px 18px`, radius 6px; hover `#77D2FF`. Beside it, mono 11px `#5B626B`: ".mid .midi .musicxml .xml .mxl · max 10 MB · max 30 min".
- **Upload error:** `1px solid #4A2230` on `#1A0E14`, radius 6px, padding `13px 15px`, 6px `#FF3B6B` dot + 13px/1.5 `#F0B9C6` message naming the file and the accepted formats. Never a spinner; user stays on this view.
- The two mono "simulate:" buttons are prototype scaffolding — **do not ship them**.

### 3. Search offline (banner state)
Above the search field: `1px solid #4A3A22` on `#1B1509`, radius 6px, padding `14px 16px`, 6px `#FFB25E` dot + 13px/1.5 `#E0C9A5`: "Catalog search is unavailable right now. Uploading a file and opening pieces from My pieces both still work offline." Search results hidden; library and upload remain interactive.

### 4. Player
Full-viewport flex column, no page scroll. Top→bottom: header, optional notice strip, waterfall (flex:1), keyboard (fixed), transport.
- **Header:** padding `14px 22px`, bottom border `#1A1D22`, bg `#0E1013`, flex gap 18px. "← Library" ghost button (`1px solid #23262C`, 12px, `#8A9099`; hover `#E8EAED`/`#3A3F47`). Title block: 15px/500 title (ellipsized) + mono 11px `#5B626B` "COMPOSER · SOURCE". Hand legend: two 8px squares radius 2px (`#4CC2FF` RIGHT, `#FF7A45` LEFT) with mono 11px `#5B626B` labels. Then "Audio on / Muted" toggle and "Listen mode" toggle (pill style below).
- **Toggle pill style:** `1px solid <accent|#23262C>`, bg `<accent>18` when on, color accent when on else `#8A9099`, 12px, padding `7px 11px`, radius 5px.
- **Dropped-notes notice:** padding `9px 22px`, bg `#1B1509`, bottom border `#2E2513`, mono 11px `#C9A874`: "4 notes fell outside the 88-key range and were dropped — this file may not be a piano arrangement."
- **Waterfall:** `position: relative; overflow: hidden`, bg gradient `#0A0B0D → #0D0F13`. Inner absolutely-positioned layer holds every note; the layer is moved with `transform: translateY(t * pps)` (one transform per frame, notes themselves static — this is the performance-critical detail). `pps = waterfallHeight / lookaheadSeconds`; each note gets `bottom: start * pps`, `height: max(5, duration * pps)`. Note width = 86% of its key lane with 7% left margin; radius 3px; bg = hand color; `box-shadow: 0 0 14px <hand>55`. A 1px `#2A2F36` strike line sits at the bottom edge; a note reaching it is the note sounding.
  - Top-left overlay: mono 10px `#3E444C`, letter-spacing 0.1em — "3S MUSICAL LOOKAHEAD · 6.0S AT 0.5x". The visible window is **constant in musical time**; wall-clock preview grows as speed drops.
  - While listening, top-right pill: `1px solid #2A3B33` on `#0D1512`, radius 20px, 7px `#3ED598` dot, mono 11px `#7FD4AE` — "LISTENING · ROLAND RP302".
- **Keyboard:** `height: clamp(112px, 15vh, 158px)`, bg `#0A0B0D`, top border `#1A1D22`, `padding: 0 4px`, position relative. MIDI 21–108 (A0–C8). 52 white keys, width `100/52 %`, left `whiteIndex * width`, full height, radius `0 0 4px 4px`. Black keys: width `0.62 × whiteWidth`, left `nextWhiteIndex * whiteWidth − blackWidth/2`, height 62%, radius `0 0 3px 3px`, `z-index: 2`.
  - Idle white key: bg `#151821`, border `1px solid #252A32`. Idle black: bg `#0C0E11`, border `#20242B`.
  - Labels: IBM Plex Mono, bottom-aligned (padding-bottom 7px white / 5px black). White horizontal 9px `#5E6672`; black `writing-mode: vertical-rl` 7px `#4A515A`. Sharps use ♯ (U+266F), e.g. "F♯3", "C4".
  - **Prepare state** (F5, starts `leadTime` musical seconds before the note): bg `#161B21`/`#14181D`, border `1px solid <hand>88`, `inset 0 -8px 14px <hand>22`, label colored in the hand color.
  - **Press-now state:** bg + border = hand color, `box-shadow: 0 -2px 20px <hand>66`, label color `#06121A`, weight 500, **font-size jumps to 13px (white) / 10px (black)** with `transition: font-size 60ms linear` — this is the user's "font goes bigger" cue. `transition: background 40ms linear` on the key.
  - **Error flash** (listen mode, wrong/missed): bg `#FF3B6B`, border `#FF6E90`, glow `0 0 18px #FF3B6B88`, label `#2A0A12`, ~350ms. No counters or popups during play.
- **Transport, row 1:** padding `16px 22px 10px`, flex gap 16px. Play button: 46px circle, no border; paused → bg `#4CC2FF`, color `#06121A`, "▶" 15px; playing → bg `#1D2026`, color `#E8EAED`, "❙❙" 13px. Time readout mono 13px, min-width 96px, "m:ss / m:ss".
  - Seek bar: 34px-tall hit area (`touch-action: none`), 4px track radius 2px `#23262C`; played portion 4px `#4CC2FF`; playhead 3px × 18px `#E8EAED` with `0 0 10px #4CC2FF88`. Drag via pointer events with `setPointerCapture`; while dragging show a tooltip above the handle (bg `#E8EAED`, color `#0B0C0E`, mono 11px, radius 3px) and update the visualization live. Playing/paused state is preserved on release. Accuracy target ±100 ms.
  - Loop region: `#FFB25E1F` fill, `1px solid #FFB25E55`, height 16px, radius 3px, spanning A→B. A/B markers: `#FFB25E` chips, `#0B0C0E` mono 9px, padding `1px 4px`, radius 2px, `cursor: grab`, centered on their time, draggable (clamped so B > A; placing B before A swaps).
- **Transport, row 2:** padding `0 22px 16px`, flex gap 22px, wraps. "SPEED" mono 10px `#5B626B` label + 1x/0.5x/0.25x buttons (selected: border `#4CC2FF`, bg `#0E2331`, color `#4CC2FF`; idle: border `#23262C`, color `#8A9099`; mono 12px, padding 7px 11px, radius 5px). "LOOP" label + Set A / Set B / Clear pills + mono 11px `#FFB25E` "LOOPING 0:07–0:15" when active. Right-aligned mono 10px `#3E444C` hint: "SPACE PLAY · ← → 5s · DRAG BAR TO SCRUB".
- **Notice strip** (transient, 4.2s): top border `#1A1D22`, bg `#14110A`, mono 11px `#C9A874` — e.g. "A–B loop is off while listen mode runs. Stop listening to drill a section."

### 5. Listen setup (modal over player)
Backdrop `rgba(6,7,9,0.78)`, centered. Panel: max-width 460px, `1px solid #23262C` on `#14161A`, radius 10px, padding 26px, column gap 20px. Title 17px/500 "Listen mode"; body 13px/1.55 `#8A9099`. Device rows: full-width buttons, padding `14px 16px`, `1px solid #23262C` on `#101216`, radius 7px, space-between; name 14px `#E8EAED`, port mono 11px `#5B626B`, 8px status dot (`#3ED598` available / `#3A3F47` other). Footnote mono 11px/1.6 `#5B626B`: "Web MIDI needs Chrome or Edge. Pedals are ignored. A–B loop turns off while listening." Cancel ghost button bottom-right.
**No-device error:** `1px solid #4A2230` on `#1A0E14`, radius 6px, 13px/1.55 `#F0B9C6` with concrete recovery steps (USB Computer port, power on, reopen, use Chrome/Edge).

### 6. Post-run report
Scrolling column, max-width 900px, padding `34px 26px 120px`, gap 30px.
- Header: "← Player" ghost button + title 15px/500 + mono 11px `#5B626B` "ATTEMPT · 0.5x · 0:46 PLAYED · 349 EXPECTED NOTES".
- **Three stat cards**, grid `repeat(auto-fit, minmax(210px, 1fr))`, gap 14px, padding 22px, radius 8px, bg `#101216` (accuracy card border `#23262C`, others `#1D2026`). Card 1 ACCURACY: 46px/700 letter-spacing -0.03em, sub 12px `#8A9099` "N of M notes right on pitch and in time." Card 2 PITCH ACCURACY: same size in `#4CC2FF`, sub "Right notes, timing aside. The gap is timing, not reading." Card 3 BY HAND: two labeled 4px bars on `#1D2026` track, filled in the hand colors.
- **"What went wrong"** grid `repeat(auto-fit, minmax(150px, 1fr))`, gap 12px: five cards (Wrong note, Missed, Extra, Late, Early) each with a 7px square dot (`#FF3B6B` for wrong/missed, `#FFB25E` for extra/late/early), 12px `#8A9099` label, mono 24px count, 11px/1.45 `#5B626B` note (e.g. "Right pitch, past the ±300 ms window.").
- **"Where the mistakes are"**: card padding `20px 18px 14px`; 110px-tall flex row of 26 bars, gap 3px, radius 2px, height `max(3%, count/max × 100%)`. Empty bucket `#1D2026`; ordinary `#4CC2FF66`; heaviest / >70% of max `#FF3B6B`. Each bar is clickable → navigates to the player, seeks to that bucket's time, sets 0.5x, stays paused. Footer row mono 10px `#5B626B`: "0:00" · "HEAVIEST AT 0:16–0:20" · total duration. Header right: "CLICK A BAR TO PRACTISE THERE".
- **Earlier attempts:** rows grid `1fr auto auto auto`, gap 18px, padding `13px 16px`, card border/bg, mono 12px `#8A9099`; current attempt's percentage in `#4CC2FF`. Stored locally per piece.

### Prototype-only chrome
A fixed bottom "STATES" strip (`rgba(10,11,13,0.92)`, top border `#1A1D22`, z-index 60) jumps between the states above, and the shell reserves `padding-bottom: 42px` for it. **Remove both in production.**

## Interactions & Behavior
- **Search:** filters on folded strings — lowercase, NFD-normalize, strip diacritics and punctuation, collapse whitespace — matched against title, composer, and an alias list. Bidirectional substring test so "fur elise" finds "Für Elise" and "moonlight sonata" finds "Piano Sonata No. 14". Escape clears.
- **Upload validation:** extension whitelist `.mid .midi .musicxml .xml .mxl`, ≤10 MB, ≤30 min, must parse and contain ≥1 note. Each failure produces a specific message and leaves the user on the view. Channel 10 excluded; notes outside 21–108 dropped with the header notice. Multiple note-bearing tracks merge for display.
- **Opening a piece** always lands paused at 0:00, clears any loop, exits listen mode, and prepends the piece to My pieces if absent.
- **Playback loop:** rAF; `t += min(0.05, dt) * speed` (the clamp prevents a jump after tab-switch). Speed changes take effect immediately without losing position. At `t >= duration` playback stops; pressing play from the end restarts at 0 (or at marker A if a loop is set).
- **A–B loop:** while `a != null && b != null`, `t >= b` snaps to `a`. "Set A" at the playhead clears B if B ≤ A; "Set B" before A swaps them. Markers draggable, clamped 0.5s apart.
- **Keyboard shortcuts** (player only): Space play/pause (preventDefault), ←/→ seek ∓5s.
- **Listen mode:** picking a device resets to 0:00, clears the loop, and starts playing. Any seek, speed change, or disconnect **ends the attempt** and opens the report for the portion played. Enabling listen mode disables A–B loop; attempting to set A/B while listening shows the notice instead.
- **Report seeking:** clicking a timeline bucket returns to the player at that time, paused, at 0.5x.
- **Responsive:** the player is a viewport-height flex column — waterfall flexes, keyboard is clamped, transport row 2 wraps. Everything is pointer-event driven so touch and mouse behave identically. Verified at laptop (1440) and tablet-landscape widths.

## State Management
Player/session state: `screen` ('home' | 'player' | 'report'), `query`, `searched`, `offline`, `uploadError`, `library[]`, `piece`, `t`, `playing`, `speed` (1 | 0.5 | 0.25), `muted`, `a`, `b`, `scrub` (null | 'T' | 'A' | 'B'), `grab`, `wfH` (measured waterfall height), `listen` ('off' | 'setup' | 'active'), `device`, `noDevice`, `notice`, `attemptEnd`.

Derived per frame (do not store): pressed/prepare/error key maps, waterfall transform, progress geometry, report aggregates.

Real implementation adds: Tone.js Transport as the clock (replace the rAF accumulator), parsed note model from @tonejs/midi or a MusicXML parser, Web MIDI input subscription, IndexedDB/localStorage persistence for library + attempt reports, and the note-matching engine (±300 ms default tolerance, tunable; chords graded note-by-note; velocity and pedal ignored).

The prototype's grading is **fake**: a deterministic hash per expected note with a raised error rate in a 15.5–24.5s window, plus a hardcoded 7 extra notes. Replace it entirely. Keep the formulas: `accuracy = correct / expected`, `pitchAccuracy = (correct + early + late) / expected`.

## Design Tokens
**Colors** — bg `#0B0C0E`; stage `#0A0B0D`; panel `#0E1013`; card `#101216`; raised `#14161A`; control `#1D2026`; borders `#1A1D22` / `#1D2026` / `#23262C` / `#2C3037` / `#3A3F47`; key face `#151821` (white) / `#0C0E11` (black); key border `#252A32` / `#20242B`; text `#E8EAED`; secondary `#8A9099`; mono-dim `#6B727C` / `#5B626B` / `#3E444C`; right hand `#4CC2FF` (hover `#77D2FF`, tint `#0E2331`); left hand `#FF7A45`; amber/loop `#FFB25E` (bg `#1B1509`, border `#4A3A22`, text `#E0C9A5` / `#C9A874`); error `#FF3B6B` (bg `#1A0E14`, border `#4A2230`, text `#F0B9C6`); listening green `#3ED598` (text `#7FD4AE`, bg `#0D1512`, border `#2A3B33`); on-accent ink `#06121A`.

**Type** — Space Grotesk 400/500/700 for UI (display 46px/700 -0.03em; title 19px/700; heading 15–17px/500; body 13–14px; small 12px); IBM Plex Mono 400/500 for all times, counts, metadata, and key labels (24px counts; 13px transport time; 10–11px meta with 0.04–0.1em letter-spacing; 7–13px key labels). `text-wrap` default; `-webkit-font-smoothing: antialiased`.

**Spacing** — 3 · 4 · 6 · 7 · 8 · 10 · 12 · 14 · 16 · 18 · 22 · 26 · 30 · 36 · 40. **Radius** — 2 (chips/bars) · 3 · 4 · 5 (buttons) · 6 · 7 · 8 (cards) · 10 (modal) · 20/50% (pills, dots, play button). **Shadows** — note `0 0 14px <hand>55`; pressed key `0 -2px 20px <hand>66`; prepare `inset 0 -8px 14px <hand>22`; error `0 0 18px #FF3B6B88`; playhead `0 0 10px #4CC2FF88`. **Motion** — key bg 40ms linear; label size 60ms linear; everything else instant. Transient notices auto-dismiss at 4200ms.

**Configurable** (exposed as tweaks in the prototype, worth keeping as constants): right/left hand color, `lookaheadSeconds` (default 3, range 2–6), `highlightLeadTime` (default 1.0s musical, range 0.5–3), `keyLabels` ('all' | 'naturals' | 'c-only').

## Assets
None. No images, no icon set, no SVG. Glyphs are text characters: "▶", "❙❙", "←", "→", "♯", "·", "/". Fonts load from Google Fonts (Space Grotesk, IBM Plex Mono) — swap to the codebase's self-hosted equivalents if it has them.

## Files
- `Piano Practice Player.dc.html` — the full prototype: all six screens, keyboard geometry, waterfall math, transport, loop, listen mode, report.
- `support.js` — runtime required to open the prototype locally. Reference only; do not port.
- `PRD.md` — the product requirements this design implements, including acceptance criteria, non-goals (no notation view, no OMR, no pedals, no mic input, no accounts), and open technical questions.

## Notes for the implementer
- Build order follows the PRD's phasing: F1–F4 (MVP) first, then F5, then F6.
- Do not write a playback engine or MIDI parser from scratch — Tone.js for transport, @tonejs/midi for parsing, an existing MusicXML parser for parsing only (there is no notation rendering in this product).
- Keep audio/visual sync within ~50 ms and grade off Web MIDI input timestamps, not audio time.
- Only fetch scores from sources whose licenses permit redistribution; verify each source individually.
