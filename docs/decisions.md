# Decisions

Numbered, dated, and binding. If a decision turns out wrong, add a superseding
entry rather than editing history. Codex must not silently deviate from any of
these; unresolved questions belong in §Open, not in code.

---

### D-001 — Stack: Vite + React 19 + TypeScript + Tailwind 4, static on Cloudflare
**2026-08-10 · Decided — supersedes the earlier "no repo exists" version**

An earlier draft of this decision claimed no existing repo could be found and
chose a stack from scratch. **That was wrong.** The repo exists — this one. It
contained a working prototype: `keyfall-piano-prototype`, Vinext `1.0.0-beta.2`
+ Vite 8 + React 19 (RSC) + Tailwind 4 + Cloudflare Wrangler, with the whole UI
in a 449-line `app/page.tsx` and one rendered-HTML test. Its palette
(`#f3f0e7` paper, `#f25f4c` coral) does not match the design handoff, which is
why it was rejected.

The stack decision, made with the real repo in view:

- **Keep:** Vite, React 19, TypeScript, Tailwind 4, Cloudflare deployment,
  ESLint config, `.gitignore`.
- **Drop:** **Vinext and React Server Components.** This app is ~100%
  client-side — Web MIDI, Web Audio, Web Workers, IndexedDB, a service worker
  and rAF rendering. Server rendering buys nothing, every component would carry
  `'use client'`, and `1.0.0-beta.2` is real risk to take for zero benefit.
  Plain Vite SPA instead.
- **Delete:** the prototype UI (`app/page.tsx`, `app/layout.tsx`,
  `app/globals.css` beyond its Tailwind import) and `tests/rendered-html.test.mjs`,
  which tests it. `worker/index.ts` goes too — the PRD forbids a backend.
- **Rename:** `keyfall-piano-prototype` → `piano-practice-player`.
- **Deploy:** Cloudflare Pages, static, with an SPA fallback so `/pieces/:id`
  and `/reports/:id` deep links resolve (D-007).

*Note for whoever reads this later: git in this repo was created by a Codex
sandbox user, so it needs
`git config --global --add safe.directory "D:/Anirudh/Coding Projects/Codex/Learn the Piano"`
before any git command works.*

### D-002 — Waterfall renders a time window, not the whole piece
**2026-08-10 · Decided · 2026-08-11 rationale corrected by spike S-1**

See `docs/algorithms.md` §3. The single-`translateY` technique and every per-note
style are kept; only the population strategy changes to a windowed slice.

**The original rationale was partly wrong and S-1 measured it.** This decision
predicted the full-piece layer "does not composite". It does — on a 144 Hz
display both strategies animated at 144.24 fps, because once the layer is
painted, moving it is GPU work regardless of node count. Anyone re-testing fps
alone would conclude windowing was unnecessary. It is not; the cost is elsewhere:

| Metric | Full layer (16,000 notes) | Windowed (71 notes) |
|---|---:|---:|
| Time to first paint | 185.5 ms | 8.3 ms |
| Seek repaint | **142.6 ms — misses the 100 ms gate** | 12.5 ms |
| Notes in DOM | 16,000 | 71 |

The binding reason for D-002 is **seek repaint and first paint**, not frame rate.
Scrubbing is the core practice interaction (PRD F4, ±100 ms), and the full layer
fails it by 42 ms. Treat the heap column in `docs/spike-results.md` as GC noise
rather than evidence — the full layer's heap fell during the run.

### D-003 — Grading runs two passes; the authoritative one is offline
**2026-08-10 · Decided**

Live feedback must classify instantly, but `missed` is not knowable until a note
is overdue, and a note flashed as `extra` can later re-match as `wrong`. A single
streaming grader would therefore either lie live or lag. Two passes
(`docs/algorithms.md` §10): a streaming pass that only drives the key flash, and
a deterministic pass over the recorded event log at attempt end that produces the
report. The report always wins. This also makes the grader a pure function of its
event log — the only way the required test coverage is achievable.

### D-004 — Candidate window is clamped by same-pitch neighbour spacing
**2026-08-10 · Decided**

A flat ±900ms window spans ~7 notes at sixteenth-notes/♩=120, where one
mis-pairing cascades. The window is `min(900ms, half the gap to the neighbouring
same-pitch expectation)`. The ±300ms correct/early/late tolerance is unchanged
and stays in **real** time — human motor precision is absolute, not musical.
PRD R5 (tolerance tuning) remains open pending hardware testing.

### D-005 — Clock domains are explicitly reconciled
**2026-08-10 · Decided**

Web MIDI timestamps (`performance.now()` domain) and Tone.js position
(`AudioContext` domain) are converted via `AudioContext.getOutputTimestamp()`
plus `outputLatency` compensation, re-sampled at attempt start and on device
change. Without this every note carries a 20–150ms systematic bias that reads as
"everything late" — the exact failure the PRD names as fatal for F6. See
`docs/algorithms.md` §11.

### D-006 — Catalog asset failure reuses the upload-error card
**2026-08-10 · Decided — additive to the handoff**

The handoff defines "search unavailable" and "upload rejected" but not "catalog
entry opened, asset 404s or checksum mismatch". That state is reachable in
production (bundled asset corrupted, cache eviction mid-fetch). It reuses the §2
upload-error card **styling verbatim** — no new visual language — with a message
naming the piece and offering the upload path.

### D-007 — Cross-route player state travels in the URL
**2026-08-10 · Decided**

The report's timeline buckets navigate to the player at a given time, paused, at
0.5×. Transient player state otherwise lives inside the player route, so this
crossing uses query params: `/pieces/:id?t=16.4&speed=0.5`. No global store, no
module-level singleton. Unknown/invalid params fall back to `t=0, speed=1`.

### D-008 — Sampler is lazy-loaded with a synth fallback
**2026-08-10 · Decided**

Salamander Grand Piano (CC-BY 3.0, attribution required in the UI) is a
multi-megabyte asset. Precaching it in the service worker would make first run
slow for a feature the learner may immediately mute. It loads on first play;
until it resolves, a lightweight Tone.js synth carries playback so the app is
never blocked on a download. Budget: **≤ 8 MB** for the sampled subset; if the
chosen subset exceeds that, reduce sample density before shipping.

### D-009 — Listen mode keeps the handoff's auto-start
**2026-08-10 · Decided, with a reservation**

The handoff starts playback the instant a MIDI device is picked. That reliably
costs the learner the first bar while their hands travel from trackpad to keys.
The design is followed as written — `tunables.listenAutoStart = true` — because
"follow the design" is an explicit instruction and this is behaviour, not an
oversight. The constant exists so the alternative (armed/ready state) is a
one-line change once real hardware testing confirms the problem.

### D-010 — Base tempo is honoured; expressive deviation is ignored
**2026-08-10 · Decided — clarifies PRD R2**

"Ignore expressive tempo markings" must not be read as "ignore tempo". The
notated tempo map — base and section tempo marks, `♩=72`, *Allegro* — **is
honoured**, or every piece plays at a default 120 and sounds wrong. What is
ignored is *continuous expressive deviation*: rit., accel., fermata, rubato,
articulation, dynamics, pedal. Steady tempo is a practice feature, not a
limitation.

### D-011 — Live flash includes `missed`, published when the note goes overdue
**2026-08-10 · Decided — resolves a PRD/D-003 conflict**

`PRD.md` F6 requires the key to flash "on a wrong **or missed** note". An
earlier reading of D-003 said never to render a live `missed`, on the grounds
that it is unknowable in the moment. Both are satisfiable: a missed note becomes
knowable the instant it goes **overdue** — `t > start + toleranceMs` with no
matching input — which is still during playback and still visually beside the
note. The live pass publishes `missed` at that point. Live verdicts stay
provisional; the authoritative pass may revise them, and the report always wins.

### D-012 — Sampler attribution lives in the Home footer
**2026-08-10 · Decided — additive to the handoff**

Salamander Grand Piano is CC-BY 3.0, so attribution must be visible in the
shipped UI, and the handoff defines no element for it. It renders as a single
mono 11px `color.monoDim2` line at the foot of the Home column, matching the
existing metadata type style — the same treatment as "LOCAL LIBRARY · NO
ACCOUNT". No new visual language, no new component, and it is absent from the
player so it cannot intrude on practice.

### D-013 — Spacing and type follow the handoff's per-component values
**2026-08-10 · Decided — clarifies a rule that would otherwise deadlock**

`tokens.ts` exports the handoff's *declared* spacing scale, but the handoff's own
component specs use values off that scale (`7px 11px` on the toggle pill,
`9px 22px` on the notice strip, `40px 32px 120px` on the Home page). The scale
is a **reference, not an allowlist**: where the handoff states a value for a
specific element, use it literally. The freeze in AGENTS.md #4 applies to
**colours** — those must come from `tokens.ts` and are machine-checked. Sizes are
governed by the handoff text.

### D-014 — Tokens reach components through Tailwind 4's `@theme`
**2026-08-10 · Decided — revised once the real stack was known**

Tailwind 4 is already in this repo and stays (D-015). Its `@theme` block is
natively a design-token system: it declares tokens and emits them as CSS custom
properties, which is exactly what an earlier version of this decision proposed
building by hand.

`src/design/tokens.ts` remains the **single source of truth**. T01 ports it into
an `@theme` block in `app/globals.css`, generating utilities and CSS variables
from the same values (`--color-hand-right`, `--color-card`, `--radius-card`, …).
Components use Tailwind utilities that resolve to those tokens
(`bg-card`, `text-hand-right`), or `var(--color-…)` in CSS. The TS file stays the
place values are defined and the place tests assert against; `@theme` is
generated from it and must not drift.

### D-015 — Tailwind 4 stays, with arbitrary colour values banned
**2026-08-10 · Decided — supersedes the blanket "no CSS framework" rule**

An earlier draft banned CSS frameworks outright, to stop exact handoff values
drifting into scattered utility classes. With Tailwind already in the repo and
`@theme` available (D-014), the framework is not the risk — **arbitrary values
are**. `bg-[#101216]` would reintroduce raw hex under a different syntax and slip
past a naive check.

So: Tailwind is permitted and expected; `@theme` carries the tokens; and
`bg-[#…]`, `text-[#…]`, and every other arbitrary **colour** literal is a
guardrail failure, exactly like a raw hex in a style object. Arbitrary values for
one-off *sizes* the handoff specifies (`p-[7px_11px]`) are fine — that is D-013
applied to Tailwind syntax.

### D-016 — Asset budget, split by load phase
**2026-08-11 · Decided — closes a gap S-2 exposed**

Spike S-2 hit a real inconsistency: `tasks/T00-spikes.md` referred to "the ≤ 8 MB
total asset budget" while D-008 defines 8 MB as the **sampled-piano subset**
budget specifically. It resolved this correctly by precedence, but the effect was
that nothing owned the total — which T10 needs before it can decide what to
precache. The budget is therefore split by when a user actually pays for it:

| Phase | Budget | Contents |
|---|---:|---|
| **First load** (precached) | **≤ 1.5 MB** | app shell, JS/CSS, self-hosted fonts (~52 KB measured), catalog manifest |
| **On first play** (lazy) | **≤ 8 MB** | Salamander sampled-piano subset (D-008) |
| **On first MusicXML open** (lazy) | **≤ 2.5 MB gzip** | Verovio converter — measured at 2.24 MiB gzip |
| Per score asset | — | cached on first open, not precached |

MIDI-only users must never download Verovio, and no user downloads the sampler
before pressing play. T10 verifies the precache manifest against the first-load
budget; exceeding a lazy budget needs a superseding decision, not a quiet bump.

### D-017 — Catalog-unavailable reuses the no-results upload card
**2026-08-11 · Decided — resolves PRD F1 versus the prototype state**

PRD F1 and T03 require upload to remain fully usable when catalog search is
unavailable. The prototype's offline state hides results but only renders its
upload control inside the no-results state, leaving no upload control reachable
when the offline query is empty. The shipped offline state therefore places the
existing §2 no-results/upload card directly below the search field, with the
headline "Open a local score while catalog search is unavailable." All card
geometry, body copy, upload control, limits hint, and error treatment remain
unchanged; this adds no new visual language.

### D-018 — The catalog manifest is a fetched asset, not a JS import
**2026-08-11 · Decided — supersedes T03's static import**

`CatalogRepository` imported `catalog/manifest.json` directly, so the manifest
was compiled into the entry chunk. Correct at 12 rows; wrong at the several
hundred T03b brings, where a few hundred KB of JSON would be downloaded by every
user before first paint, against D-016's 1.5 MB first-load budget.

The manifest becomes a static asset fetched once on Home, precached by the
service worker in T10 (it is small and search must work offline). Score assets
remain cached on first open, never precached.

Side effect worth naming: this makes the "catalog search is unavailable" banner
reachable for a real reason. Until T03a it could only fire because of the
secure-context bug — a failure state with no legitimate cause. It now covers
manifest-fetch failure, which is what D-006 and D-017 always described.

### D-019 — Live internet search stays out; the catalog is bundled
**2026-08-11 · Decided — makes an implicit scoping choice explicit**

The original request asked for sheet music fetched "from public sources", and
auto-fetch was chosen over upload-only. What shipped is a **bundled** catalog.
That narrowing happened gradually across the PRD critique loop ("seeded catalog…
not an MVP gate") and D-001 ("no external search service"), and was never stated
plainly. Stating it now.

Browser JavaScript cannot query Mutopia or IMSLP directly: neither sends CORS
headers, neither exposes a search API. Live search therefore requires a proxy
service — a backend the PRD rules out for a local-first app with no accounts.

The resolution is T03b: bundle Mutopia's full piano collection at build time, so
search covers hundreds of pieces with no runtime dependency on anyone's server.
Upload remains the route for modern or copyrighted pieces, which could never be
auto-fetched legally regardless.

**If bundled breadth proves insufficient**, the escalation is a small Cloudflare
Worker indexing Mutopia and IMSLP — the Wrangler setup already exists. That
would supersede D-001's "no backend" clause and needs its own decision entry
first, including what happens to offline search when the index is remote.

### D-020 — Volume control promoted from P1 into the player
**2026-08-12 · Decided — supersedes the PRD's deferral**

PRD F3 shipped a mute toggle and marked a volume slider P1. Using the app showed
that was wrong. The central V1 activity is playing along with the reference
audio, which requires it **quieter than your own piano** — not silent, not full.
Mute is binary, and device volume moves everything together, so neither serves
the case.

The handoff defines no volume control, so this is an additive deviation
(`tasks/T05a-volume-control.md`). It introduces no new visual language: it
borrows the seek bar's track, fill and handle styling and sits beside the
existing mute toggle in the player header.

Two details that decide whether it feels right:

- **Perceptual mapping.** Gain is `position²`, not linear — a linear slider
  compresses everything useful into the bottom third.
- **Independent from mute.** Volume 0 and muted are different states, and mute
  must not silently rewrite the volume the user set.

This is a genuine scope addition, not a bug fix, and it is recorded as one.

### D-021 — Upload has a permanent entry point in My pieces
**2026-08-12 · Decided — additive to the handoff**

Verified in the running app: with a working catalog and an empty search box,
**no upload control exists on Home**. Upload lives only inside the §2 no-results
card, so a learner holding a MIDI file must first search for something that does
not exist.

D-017 already found this hole in the offline state and fixed it there. This is
the same defect in the normal state. The fix (`tasks/T05b-upload-entry-point.md`)
adds a ghost-button upload control to the **My pieces** heading row — the
learner's own library is where "add a piece" belongs — reusing the existing
upload component so there is one implementation behind two entry points.

The §2 card keeps its primary blue button; it is the main offer in that state,
whereas in My pieces it is a secondary action. No new visual language.

### D-022 — Prepared keys use a countdown fill to encode order
**2026-08-12 · Decided — supersedes F5's uniform prepare outline**

The prepare state outlined every key with a note arriving inside the lead window
identically. With an arpeggio or a dense passage that means five or six keys lit
at once, and the highlight says *soon* but never *next*. In real practice this
was the single biggest comprehension failure — the learner can see which keys are
coming and not the order to press them.

Four encodings were mocked up and compared side by side on the same passage:
countdown fill, fade-by-imminence, ordinal numbers, and next-note-only.
**Countdown fill wins** because it carries order and timing in one continuous
signal: the key fills from the bottom as its note approaches, so the fullest key
is next and the fill depth *is* the time remaining. Nothing new appears on
screen — the fill lives inside the existing key.

It also degrades honestly. Simultaneous notes fill at the same rate and look
identical, which is true; an ordinal scheme would have to invent an order for a
chord that has none.

Rejected, with reasons worth keeping: **ordinal numbers** are clearest for a
beginner but add a second thing to read while the hands are busy and churn on
every note; **fade-by-imminence** costs nothing but four levels of dimness is
about the limit of peripheral discrimination; **next-only** is unambiguous and
discards the preparation time the lead exists to provide.

### D-023 — Sampler attribution moves off Home, behind About
**2026-08-12 · Decided — the nearest legal reading of "remove it"**

The request was to remove the "Salamander Grand Piano by Alexander Holm · CC BY
3.0" line. It cannot simply be deleted: the samples ship with the app, CC-BY 3.0
requires attribution on redistribution, and the app is deployed publicly.

The line moves off the Home screen into a small **About** affordance, where it is
present, findable and out of the way. The alternative — switching to a CC0 sample
set and dropping the credit entirely — was rejected because it means a
worse-sounding piano, and the piano is the reference the learner plays against.

Same treatment applies to catalogue creator credits: they stay on result rows and
the player header, where they identify the edition, which is useful as well as
required.

### D-024 — Web Audio claims the playback session on iOS
**2026-08-13 · Decided — fixes "no sound on my phone"**

Reported symptom: the app is audible on the iPad it is used on daily, silent on
an iPhone. The difference is hardware. iOS puts Web Audio in the *ambient* audio
session by default, and an ambient session is silenced by the physical
Ring/Silent switch — no error, no state change, `context.state` still
`"running"`. Modern iPads have no such switch; iPhones do.

`src/playback/audioSession.ts` sets `navigator.audioSession.type = "playback"`
(Safari 16.4+) inside the gesture that starts playback, which outranks the
switch. Where that API is missing *and* the device is touch-capable, a silent
looping `<audio>` element is attached instead — an HTMLMediaElement pulls the
page into the media session on older iOS. Desktop browsers get neither: they
have no ringer switch, and a permanently looping decoder would be pure cost.

The same module re-resumes the context on `visibilitychange`, `pageshow`,
`focus` and `pointerdown`. iOS suspends or interrupts the context on screen
lock, on a call and on backgrounding, and never resumes it by itself.
`PlaybackSnapshot.audioBlocked` surfaces a non-running context as a strip in the
player rather than leaving the transport ticking in silence.

Not verifiable from this machine: it needs an iPhone with the switch set to
silent. The fix is the standard one for this failure and is unit-tested at the
seams, but the acceptance test is the device.

### D-025 — MIDI hand assignment covers any track count
**2026-08-13 · Decided — supersedes the "exactly two tracks" rule**

`midiHands` returned nothing unless a file had exactly two note-bearing tracks,
so **27 of the 596 shipped catalog pieces rendered entirely in the right-hand
colour** — fugues split a track per voice, four-hand arrangements have four, and
some engravers emit three. That is not "no hand data available"; it is hand data
the reader threw away.

Tracks are now ranked by median pitch and cut at the widest gap between
consecutive medians, which is the staff break when there is one. Two tracks
behave exactly as before. Evenly spaced voices leave every gap equal, so ties
break toward the middle rather than lopping off the bass alone. Single-track
files stay `unknown`: there is no second voice to split against, and inventing a
split point inside one track fabricates information the file does not carry.
Three pieces remain uncoloured on that basis.

For a five- or six-voice fugue there is no true two-hand answer — the hands
share voices constantly. Those pieces get a defensible split rather than a
correct one; "One colour" in D-026 is the honest way out.

### D-026 — Hand colours are selectable, and so is the hand mapping
**2026-08-13 · Decided — closes O-6, additive to the handoff**

O-6 asked whether hand colours should be configurable and leaned no, on the
grounds that blue/orange is already colour-blind-safe. Two things overrode that.

First, the reported defect: colours "getting mixed" mid-phrase. Investigated on
Für Elise, and **the colours are correct** — the closing E/D♯ tremolo really is
written alternating between the staves, two notes each, and the app is painting
what the score says. Nothing to fix in the renderer. But there is no way for a
reader to tell that from a broken file, and no way to opt out of it while
practising the passage.

So the mode, not just the palette, is selectable: `score` (default, paint by
staff), `swapped` (for files whose staves are reversed) and `single` (one colour,
ignore hands). The panel says plainly where the colours come from.

Second, the palette itself. `tokens.ts` stays authoritative for the default pair
— "Sky & ember" *is* `color.handRight`/`color.handLeft`, so an untouched install
matches the handoff exactly. Four alternative pairs and two custom pickers live
in `src/design/handPalette.ts`, inside the design layer where colour literals
belong. Every preset separates by luminance as well as hue, so it survives
deuteranopia and protanopia. Selection is stamped onto the document root as
`--color-hand-*`, overriding Tailwind's `@theme` values, so utility classes and
computed inline styles cannot drift apart.

This does reverse the "no settings screen" non-goal in spirit. It is one modal
reached from the player header, scoped to note colour, and it exists because the
default was actively confusing a real user.

### D-027 — The player fits a phone
**2026-08-13 · Decided — fixes a header that ran off the screen**

At 375px the player header laid out to 531px in a single non-wrapping row. The
piece title collapsed to zero width, the volume slider and the Audio on/Muted
toggle were clipped past the right edge, and Listen mode was entirely
off-screen — with `overflow: hidden` above it, so nothing could be scrolled to.
An unreachable mute toggle is indistinguishable from broken audio, which is very
likely part of what the phone report was about.

The controls now carry `w-full` below `md` and wrap onto their own row. The hand
legend hides below `lg`, where the colour swatches on the picker say the same
thing in less space. Listen mode renders `disabled` while T08 is unbuilt rather
than as a control that silently does nothing.

The shell moves from `h-screen` to `100dvh` with `h-screen` as fallback: `100vh`
on mobile Safari measures the viewport *without* browser chrome, which put the
speed and loop row underneath the address bar.

### D-028 — Catalog ordering is numeric, and the sort is exposed
**2026-08-13 · Decided — fixes a real mis-sort**

`compareCatalogEntries` used plain `localeCompare`, which orders string-wise:
"Invention 15" before "Invention 2", "Prelude Op. 23, No. 10" before "No. 2",
"Sonata No. 32" before "Sonata No. 5". Twenty-four such pairs in the shipped
catalog. It now uses `Intl.Collator(undefined, { numeric: true, sensitivity:
"base" })`, and a test asserts no adjacent pair in the shipped manifest sorts out
of numeric order.

Sort order was also fixed and invisible. There is now a selector — composer A–Z,
title A–Z, shortest, longest — applying to both browse and search results.
Duration sorts push entries with no declared duration last in both directions.

### D-029 — Home leads with the learner's own pieces
**2026-08-13 · Decided — additive to the handoff**

The handoff's Home is a search box over a catalog. In daily use it opened on
"Giselle - Pas de deux", and **My pieces sat roughly 3,900px down a phone
screen**, below 25 catalog rows — about ten screens of scrolling to reach the
piece you are actually learning. 596 pieces were navigable only through 24
Previous/Next pages.

Home now opens with a Continue-practising card for the most recently opened
piece, then My pieces, then search and browse under a heading. Browse gained a
composer filter alongside the sort, which collapses the 24-page walk into one
selection. Page position resets when the sort or composer changes, adjusted
during render rather than in an effect so the new list never paints at the stale
offset.

### D-030 — Re-opening a piece keeps its practice speed
**2026-08-13 · Decided — bug fix**

Opening a catalog piece re-imports and re-saves it, and `save()` defaults
`lastSpeed` to 1. So finding a piece through search rather than through My pieces
silently discarded the speed the learner had settled on. `saveAndOpen` now reads
the stored `lastSpeed` first and carries it through.

### D-031 — The keyboard windows to the piece's range on small screens
**2026-08-13 · Decided — additive to the handoff**

The design specifies all 88 keys, and above roughly 570px of width that is what
renders — a laptop and an iPad are untouched. At 375px the same row gives each
white key 7.2px: the labels are unreadable and a falling note is thinner than
the strike line.

Below 11px per white key the keyboard narrows to the range the piece actually
uses, never tighter than three octaves. The waterfall applies the identical
window, so a note still lands on its own key. The window is a pure function of
the piece's pitches and the available width, which is what keeps the two views
from disagreeing.

It is a mitigation, not a cure: Für Elise spans A1–E7, so 375px still only buys
9.4px per key. A piece with a narrower range gains much more.

---

## Open — must be resolved by the named task, not by improvisation

| # | Question | Resolved by |
|---|---|---|
| O-1 | Does Verovio's MIDI export preserve per-staff track/channel separation? If not, MusicXML needs its own parse path to keep staff→hand mapping. | `tasks/T00-spikes.md` S-2 |
| O-2 | Is Verovio's WASM payload justified against the offline budget, versus a lighter MusicXML parser? | `tasks/T00-spikes.md` S-2 |
| O-3 | Measured clock offset and jitter on the actual Roland RP302 in Chrome and Edge. PRD R6. | `tasks/T08-listen-grading.md` |
| O-4 | Real-world ±300ms tolerance suitability at 0.25×. PRD R5. | `tasks/T08-listen-grading.md` |
| O-6 | ~~Should hand colours be configurable?~~ **Closed by D-026** — yes, and the hand *mapping* with them. | Closed 2026-08-13 |
| O-5 | Per-asset redistribution licence for all 12 seed pieces. PRD R7 — **blocking for the MVP gate**. | `tasks/T03-catalog-home.md`, started day 1 |
