# Piano Practice Player — Build Plan v2

**Supersedes v1.** Changes from v1 are marked **[FIX]** with the reason. Sources
of truth, in precedence order: `PRD.md` → design handoff → this plan.

---

## Summary

Build a local-first React/TypeScript web app that replaces YouTube piano
tutorials with a falling-notes practice player, recreating the design handoff
pixel-closely at laptop and landscape-tablet sizes.

- **[FIX] Stack is Vite + React 18 + TypeScript**, deployed static to Cloudflare
  Pages. v1 assumed an existing "Vinext/Keyfall" app with tests to replace; no
  such repo exists here (see `docs/decisions.md` D-001). If one does exist
  elsewhere, reconcile before writing code.
- Do not import `support.js` or port the prototype runtime. Reuse only its
  documented geometry, timing and report algorithms — transcribed in
  `docs/algorithms.md` so nobody re-derives them.
- Ship MVP features F1–F4 first, then F5 highlighting, then F6 MIDI grading.
- Bundled, licence-verified classical catalog. No backend, accounts, cloud
  storage or external search service.
- Remove all prototype-only state navigation and `simulate:` controls.

## Architecture

Three client-side routes: `/` (search, upload, My Pieces), `/pieces/:pieceId`
(player, transport, guide, listen), `/reports/:attemptId` (report, history).
Transient player state stays inside the player route; no global state library.

**[FIX]** Report → player navigation carries position and speed as query params
(`/pieces/:id?t=16.4&speed=0.5`). v1 kept player state route-local while also
requiring the report to set position, speed and paused state across routes —
without a named mechanism that becomes a module-level singleton. D-007.

### Domain types

`CatalogEntry` · `PieceDocument` · `NoteEvent` (stable id, MIDI pitch, musical
start/end seconds, velocity, `left | right | unknown` hand) · `ImportNotice` ·
`PlaybackSnapshot` · `AttemptEvent` · `AttemptReport`.

### Services

| Service | Responsibility |
|---|---|
| `CatalogRepository` | Reads and validates the bundled manifest; folded local search |
| `PieceImporter` | Worker-based MIDI/MusicXML parsing into `PieceDocument` |
| `LibraryRepository` | IndexedDB persistence via Dexie |
| `PlaybackEngine` | Tone.js clock, sampled audio, scheduling, seek, speed, mute, loop |
| `MidiInputController` | Web MIDI permission, enumeration, timestamps, disconnect |
| `ClockBridge` | **[FIX]** Web MIDI ↔ AudioContext time conversion (D-005) |
| `AttemptGrader` | Deterministic note matching and report generation |

### Dependencies (the approved list — AGENTS.md #6 refers here)

**Already in the repo, keep:** `react` 19, `react-dom` 19, `typescript`, `vite`,
`tailwindcss` 4 + `@tailwindcss/postcss` (D-015), `wrangler`,
`@vitejs/plugin-react`, the ESLint set.

**Remove (D-036):** `@cloudflare/vite-plugin` — unused since D-001 dropped
Vinext, and it steers Cloudflare's build detection toward a Workers deploy
this static site must not take.

**Already in the repo, remove (D-001):** `vinext`, `@vitejs/plugin-rsc`,
`react-server-dom-webpack`, `@next/eslint-plugin-next`, and `next-env.d.ts` /
`next.config.ts`.

**Add — runtime:** `react-router-dom` (three routes + SPA fallback), `tone`
(transport + sampler), `@tonejs/midi` (MIDI parsing), `dexie` (IndexedDB), a
MusicXML parse path per spike S-2 (`verovio` if it passes, otherwise a lighter
parser named in the spike write-up), and — **only if S-2 picks a parser that does
not handle `.mxl` natively** — a zip reader such as `fflate`. Verovio handles
`.mxl` itself.

**Add — build/test:** `vitest`, `@testing-library/react`,
`@testing-library/user-event`, `jsdom`, `@playwright/test`, `vite-plugin-pwa`
(T10 service worker).

Anything else needs a `docs/decisions.md` entry first. Explicitly excluded: icon
libraries, state-management libraries, charting libraries, CSS-in-JS.

### Repository layout

Fixed, because the guardrail's grader scope and every task's verify command are
path-based:

```
src/design/     tokens.ts, globals.css with the @theme block   (colour literals allowed here only)
src/assets/     self-hosted fonts (woff2). No images, no SVG — glyphs are text.
src/music/      importers, canonical NoteEvent model, fixtures
src/catalog/    manifest loading, folded search
src/library/    Dexie repositories (pieces, attempts)
src/playback/   PlaybackEngine, sampler
src/player/     waterfall, keyboard, player header
src/transport/  seek bar, speed, loop, shortcuts
src/listen/     Web MIDI, ClockBridge, AttemptSession
src/grading/    AttemptGrader (pure, deterministic)
src/report/     report screen and aggregation
src/testing/    shared fixtures, incl. the 30-minute dense generator
catalog/        seed manifest + score assets + LICENCES.md
spikes/         T00 throwaway harnesses — never imported by src/
```

### Persistence

IndexedDB `pieces` (metadata, original upload bytes, normalized timeline,
last-opened, last speed) and `attempts` (full reports, indexed by piece and
date). `localStorage` for mute and preferred MIDI device. Uploaded pieces stay
usable for the session if storage is full, with a clear "not saved locally"
warning. **[FIX]** Request `navigator.storage.persist()` on first save — the
entire value proposition is that yesterday's piece is still there, and an
unpersisted origin can be evicted silently.

---

## Build order

### T01 — Design foundation and shell
**Runs first.** The spikes need a bundler and test runner, so scaffolding
precedes them.
Tokens (`src/design/tokens.ts`, pre-seeded and authoritative) emitted as CSS
custom properties (D-014), self-hosted Space Grotesk + IBM Plex Mono, the three
routes, loading/not-found states, and only those shared primitives with a second
consumer. Product name is "Piano Practice Player" throughout. The handoff folder
and `PRD.md` are never modified.

### T00 — De-risking spikes (after T01)
**[FIX] New.** Three unknowns can invalidate downstream work; each is time-boxed
to half a day. Verovio staff→hand preservation (O-1/O-2), waterfall performance
at 16k notes (validates D-002), Web MIDI clock offset on real hardware (D-005).
Numbered T00 because it gates decisions in T02/T05/T08, but it runs after T01 —
S-1 and S-2 need a bundler, and S-3 needs the piano physically connected. See
`tasks/T00-spikes.md`, which defines the fallback when a spike cannot run.

### T02 — Canonical music model and import pipeline
Built **before** player UI so every later component consumes real data.

- MIDI via `@tonejs/midi`: apply tempo maps, exclude channel 10, merge
  note-bearing tracks, drop pitches outside 21–108 (notice when any are dropped).
- MusicXML/MXL: expand to performance order, convert to timed events, normalize
  through the same path. **[FIX]** Hand assignment must survive that conversion —
  the MIDI path's rule (two tracks, lower median pitch = left) is not the
  MusicXML rule (staff 1 = right, staff 2 = left), and silently falling back to
  the pitch heuristic is wrong for any cross-hand passage. Gated on spike S-2.
- Reject: unsupported extension, >10 MB, >30 min, malformed, zero notes — each
  with its own specific message.
- **[FIX]** Honour the tempo map and base/section tempo marks; ignore only
  continuous expressive deviation (rit., accel., fermata, rubato, articulation,
  dynamics, pedal). v1's "ignore expressive tempo text" could be read as
  stripping base tempo, which makes every piece play at a default 120. D-010.
- Structural fallback: if repeats/voltas/D.C./D.S./Fine cannot be resolved,
  import linearly with a persistent prominent warning.
- Ornaments render as principal written notes; grace notes literally as short
  notes; documented notice either way.
- Parsing runs in one Web Worker.

### T04 — Playback engine
`PlaybackEngine` independent of React rendering. Tone.js, locally hosted
Salamander subset, short schedule-ahead queue (never schedule a whole 30-minute
piece). One musical-time position at 1×, mapped to the audio clock by speed. On
seek or speed change: cancel future events, preserve position, re-anchor, rebuild
queue. AudioContext starts only from a user gesture. **[FIX]** Sampler
lazy-loads behind a synth fallback, ≤ 8 MB budget (D-008).

### T05 — Player visualization
Waterfall + keyboard, per `docs/algorithms.md` §2–§4. **[FIX] Windowed
rendering** — keep the single-`translateY` layer and every per-note style, but
populate from notes intersecting `[t-2, t+lookahead+2]` musical seconds (D-002).
**[FIX]** Advance the per-frame key-state scan from a cursor rather than index 0.

### T06 — Transport controls
Pointer-based seek identical for mouse and touch, ±100 ms accuracy, live
visualization while dragging, playing/paused preserved on release. Space toggles;
arrows seek ∓5 s. A–B marker rules transcribed exactly from
`docs/algorithms.md` §6 — they are asymmetric by design.

### T03 — Catalog, library, Home screen · 🚦 MVP gate
**[FIX] Moved after T06.** Its acceptance criteria ("opening a piece lands on the
player paused at 0:00", "reopens and plays without re-parsing") require a working
player, so it cannot precede one. The MVP gate sits at the end of this task,
where the full loop first exists.

12-piece bundled classical seed with locally shipped score files, using the
manifest schema in `tasks/T03-catalog-home.md`. **No entry ships until its exact
asset's licence name, licence URL, source URL and SHA-256 checksum are recorded
and the checksum verifies** — per asset, not per composition (Mozart K.545 is
public domain; a particular engraving of it may not be). **[FIX]** This is PRD
R7, the one blocking item, and it is slow non-engineering work — start it on day
1 in parallel, not when T03 begins.

Search folds and matches exactly as `docs/algorithms.md` §7. **[FIX]** Add the
asset-fetch/checksum failure state (D-006).

**[FIX] A thin vertical slice lands early**, inside T02–T06: one bundled MIDI →
parse → waterfall → transport → play, no persistence, synth audio. v1 of this
plan reached its first usable build only after the full stack of Dexie, Verovio,
sampler and licensed catalog. The slice validates the core loop and de-risks
D-002 and D-005 in days rather than weeks; the formal gate still requires
persistence, offline reopen and visual QA.

### T07 — Anticipatory highlighting (F5)
Prepare state 1.0 musical second before onset; press-now switches to the exact
handoff style with the enlarged label. Lead time is one internal constant, not a
settings screen.

### T08 — Web MIDI and grading (F6)
Request MIDI access only after opening listen setup. Selecting a device resets to
0:00, clears A–B and starts playback (handoff behaviour, D-009). Attempt ends on
completion, stop/pause, seek, speed change or disconnect. A–B disabled while
listening, with the 4.2 s notice. **[FIX]** Two-pass grading (D-003), clamped
candidate window (D-004), explicit clock conversion (D-005).

### T09 — Reports and attempt history
Formulas exactly per `docs/algorithms.md` §9: accuracy = correct ÷ expected;
pitch accuracy = (correct + early + late) ÷ expected; extras counted but never in
the denominator; 26 buckets over the **full** piece duration; bucket click →
player at that time, paused, 0.5×. Store completed and interrupted attempts,
newest first.

### T11 — Mobile audio, hand colours, sorting and Home navigation ✅ done

Shipped 2026-08-13, **outside this harness** — see `tasks/T11-*.md` for the
retrospective and D-024 … D-031 for the reasoning. Eight changes: iOS playback
audio session, hand assignment beyond two tracks, selectable hand colours and
mapping, a player header that fits 375px, numeric catalog sorting with a visible
sort control, Home reordered around the learner's own pieces, practice speed no
longer reset on re-open, and a keyboard that windows to the piece's range on
narrow screens.

### T03e — Catalog metadata corrections

Resolves the last four `verify` rows in the Rousseau TSV from the Mutopia source
paths already in the manifest (25 playable, not 24), and retitles two entries
that claim far more than their file contains. D-038.

### T12a — The shipped playlist (read-only)

"Classical Rousseau" as an ordered list of catalog references, generated into
`catalog/playlists.json` at build time from `catalog/playlists/*.tsv`. A
Playlists section on Home opening its own page; no player changes; the 39 absent
works get one derived line rather than silence or dead rows. **No schema
change.** D-032, D-042.

### T12b — Playlists the user makes

Create, rename, add, remove, reorder, duplicate, delete. Dexie goes to version 2
with an additive `playlists` table — the migration is the risk this split exists
to isolate, and it is proven against a seeded v1 database before any UI. The
shipped playlist stays a build artefact and is never written into the table.
No auto-advance — still O-9. D-032, D-042.

### T03f — 22 rows name a work but hold one movement

T03e's audit found the defect it fixed twice is systemic: where a Mutopia entry's
asset is a multi-file archive, the build took one member and kept the
collection's title. "French Suite No. 6" plays 84 seconds of its Allemande. One
row is worse — English Suite II is labelled Gigue and sourced from the Prelude.
Merge where the archive is a genuine whole, retitle where it is a set of
independent exercises. D-038, D-049.

### T13b — The e2e suite is red

8 of 31 Playwright tests fail. Two are provably T13's (a hardcoded count of 47
Chopin matches, now 51; the playlist's 25/39 figures, now 38/26); six need
diagnosis rather than dismissal. Counts must be derived from the manifest and
`playlists.json`, never hardcoded. D-045.

### T13a — The player names the wrong source

`PlayerHeader.tsx` hardcodes "MUTOPIA CATALOG" for every bundled piece. True of
all 596 until T13; false for the 13 piano-midi.de rows since. A licence matter,
not cosmetics — the fallback for already-stored pieces must be no label at all.
D-044.

### T13 — A second catalog source

Mutopia does not carry 39 of the 72 rows in the Rousseau list. Refactors
`scripts/build-catalog.mjs` behind a source adapter and adds piano-midi.de.
**The licence gate is cleared** — cc-by-sa Germany, attribution to Bernd
Krueger, share-alike (D-040); fetch from the apex domain, `www.` is dead. The
Mutopia path must regenerate byte-identical. D-034, D-040, D-041.

### T10 — Offline packaging and deployment
Service worker caches shell, fonts and catalog manifest; score assets cached on
first open; sampler excluded from precache (D-008). Verify My Pieces and playback
survive network loss. Static Cloudflare deploy with **[FIX]** SPA fallback so
`/pieces/:id` and `/reports/:id` deep links resolve, plus an attempt-not-found
state.

---

## Test and acceptance plan

**Unit** — search folding and aliases (golden cases in `docs/algorithms.md` §7);
88-key geometry and labels (52/36, `♯` glyph, A0/C8 endpoints); MIDI/MusicXML
normalization incl. tempo maps, repeats, ties, ornaments, channel-10 removal,
hand mapping, every validation failure; playback clock mapping, speed change,
seek, loop wrap and end behaviour on a fake clock; every grader category —
repeated pitches, chords, octave errors, overlapping windows, partial attempts,
plus the conservation assertions from §10.6; report formulas and bucket
boundaries.

**[FIX] Numeric acceptance criteria that v1 stated but never tested:**
- Seek accuracy within ±100 ms (PRD F4).
- Audio-to-visual drift under 50 ms (PRD §9).
- Lookahead constant in **musical** time across all three speeds — the invariant
  that makes slow practice work, and trivially unit-testable.
- Grader conservation: every expected and played note resolves exactly once.

**Component** — every state in `docs/design-contract.md` §3.

**End-to-end (Playwright)** — search→play, upload→play, reopen from My Pieces,
delete, scrub, loop, keyboard shortcuts, listen mode, interrupted attempt,
report→player seek.

**Visual** — snapshots approved against the handoff at 1440×900 and 1024×768. No
horizontal page scroll; player stays viewport-height.

**Performance** — 30-minute dense fixture (~16k notes): sustained 60 fps
scrolling, seek responsive, memory stable. This is the fixture that fails without
D-002.

**Hardware gate (manual)** — Roland RP302 in Chrome and Edge. A deliberately
clean run scores ≥ 95%; deliberate wrong notes are always caught. **[FIX]** Record
the measured clock offset and jitter; if the clean run fails, suspect D-005
before the matching algorithm.

**Browsers** — MVP playback smoke-tested in current Firefox and Safari; Web MIDI
grading targets Chrome and Edge only.

## Assumptions

The design handoff overrides everything visual. Prototype state selector,
simulated data and simulated MIDI never ship. PRD and handoff are never modified.
Local-first, bundled catalog, no backend. MVP → F5 → F6 are separate gates.
Tablet landscape is the smallest primary player target. Lookahead 3.0 musical
seconds; highlight lead 1.0 musical second; speeds exactly 1× / 0.5× / 0.25×;
grading tolerance ±300 ms real with a clamped ≤900 ms candidate window. No
notation view, OMR, microphone input, pedal handling, accounts, cloud sync,
sharing or settings expansion.
