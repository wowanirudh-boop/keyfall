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

### D-032 — Playlists are ordered references, and the shipped one is read-only
**2026-08-13 · Decided — additive to the PRD, F1**

Requested: Rousseau's "Classical" playlist inside the app. That needs a playlist
feature, and a playlist is a genuinely new product object, so it gets a decision
before it gets code.

**A playlist is an ordered list of references, not a container of scores.** An
entry names a catalog id (or a saved-piece id for uploads); the score itself
stays in the one place it already lives. Two playlists holding the same piece
therefore cost nothing extra, and a piece re-imported later does not
desynchronise from a stale copy inside a playlist row.

**An entry may point at a piece the learner has never opened.** Tapping it runs
the same import-and-save path as a search result. This is the point: the
Rousseau list is mostly aspiration, and a playlist that could only hold pieces
you had already played would be useless for it.

**The seeded playlist is read-only, with Duplicate as the escape hatch.** It is
generated from `catalog/playlists/rousseau-classical.tsv` at build time. If the
user could edit it in place, the next catalog build would silently overwrite
their edits or, worse, be unable to and drift. Read-only plus copy-to-edit is
the only version of this that stays honest across rebuilds.

**Auto-advance is deliberately not in the first cut.** Playing straight through
a playlist sounds like a small addition and is not: it needs answers for what
happens at the end of a piece, whether an A–B loop suppresses the advance,
whether speed carries to the next piece, and what the transport shows. Those are
transport decisions, not playlist decisions. Shipping the list first tells us
whether continuous play is even wanted.

This does brush against the PRD non-goal "no gamification / curriculum /
lessons". A playlist is neither — it is an ordering the learner controls, with
no progression, no unlocking and no grading. The non-goal stands.

### D-033 — Audio files are not an import format, and the rejection says why
**2026-08-13 · Decided — no**

Asked: why is MP3 not supported, and can it be added?

The waterfall needs **symbolic** note data — pitch, onset, duration, and ideally
which staff each note is on. MIDI and MusicXML carry all four. MP3, WAV, M4A and
FLAC carry none of them; they carry a waveform. Adding them is not a parser, it
is **automatic music transcription**, an ML problem with an error rate.

The PRD already answers the adjacent question. §4 rules out microphone listening
because "polyphonic audio transcription is far less accurate" than MIDI, and §4
rules out PDF/OMR for the same class of reason: an error-prone converter in the
middle of a practice tool teaches you the errors.

The strongest candidate if this is ever revisited is Spotify's **Basic Pitch**
(Apache-2.0, runs locally in the browser, no backend, so it fits local-first).
It was rejected for now on three counts. Piano transcription puts notes in the
wrong octave and loses inner voices under pedal, and a practice player that
shows a wrong note is worse than one that shows nothing. It produces **no staff
information**, so hand colouring — the feature D-026 exists to serve — would be
dead on every transcribed piece. And it is a ~20 MB model against an offline
budget that already refuses to precache 1 MB of piano samples (D-008).

Adding more *symbolic* formats (`.kar`, `.rmi`, `.abc`, `.krn`) was also
considered and dropped: cheap to build, but nothing anyone actually has is in
them.

What ships instead is honesty. The import rejection currently lists the accepted
extensions, which reads as an arbitrary allowlist. It now says why: an audio
file has no note data in it, and points at where to find a MIDI or MusicXML of
the same piece. Revisit only if the answer changes from "the format cannot carry
it" to "we chose not to".

### D-034 — A second catalog source, gated on its licence
**2026-08-13 · Decided — pending verification**

Resolving the 72-item Rousseau list against the shipped catalog found 24 rows
present (23 distinct works — Clair de Lune is listed twice) and 37 absent. They are absent because **Mutopia does not have them**: it
carries four Liszt works (all Consolations), no Ravel, no Vivaldi, and nothing
from The Nutcracker. No amount of re-running the existing build finds them.

**piano-midi.de** (Bernd Krueger) is the proposed second source: ~300 classical
piano MIDI performances covering most of the gap, and reported by several
secondary sources as CC-BY-SA with attribution to the sequencer. That licence
family is already handled — 210 of the 596 shipped rows are CC-BY-*, each
carrying `licence.creator`, and `catalog/LICENCES.md` already records them.

**This is provisional.** The licence page could not be read from the machine
that wrote this entry: piano-midi.de is HTTP-only and the request was refused
by the egress proxy. T13's first acceptance criterion is to read the terms
first-hand and stop if they do not permit redistribution. Recording a
second-hand licence claim as fact is exactly the mistake PRD F2's guardrail
exists to prevent.

Where both sources carry the same work, Mutopia wins: it is an engraving, so its
staff split is real hand data rather than an inference from a performance.

Not candidates, and why: **IMSLP** licences vary per upload and most content is
page scans, so it is viable file-by-file at best. **OpenScore** is CC0 but its
corpora are Lieder and string quartets, not solo piano. **MuseScore.com** is
user-uploaded with mixed licences and a ToS that forbids scraping.

### D-035 — PWA install icons are the one image-asset exception
**2026-08-13 · Decided — resolves a conflict Codex blocked on**

T10 AC7 asked for an installable PWA. AGENTS.md #6 says the product has no image
or SVG assets. Codex stopped and reported the conflict rather than picking a
side, which is the harness working.

Both were verified before deciding. **Chrome's installability criteria require a
manifest with a 192×192 and a 512×512 icon**; there is no icon-free route to an
install prompt. **iOS Safari uses `apple-touch-icon`** for Add to Home Screen and
falls back to a screenshot of the page without one — and an iPad home-screen
launch is the whole point of T10 for this user.

Rule 6 wins on intent and loses on letter. It sits beside "no icon library", and
its purpose is that the *interface* is built from design tokens and text glyphs
rather than imported artwork. A home-screen icon is never rendered by the app at
all — it is packaging consumed by the OS launcher. So the rule is narrowed to
what it always meant, and the exception is made explicit and small:

- **Exactly four files**, in `public/icons/`: `icon-192.png`, `icon-512.png`,
  `icon-512-maskable.png`, `apple-touch-icon.png` (180×180).
- Referenced from **two places only**: the generated web app manifest and
  `index.html`. Nothing under `src/` may import them, and `check:guardrails`
  gains a rule that fails the build if anything does.
- The artwork is the wordmark reduced to its mark: `color.handRight` on
  `color.bg`, both read from `tokens.ts`. No new visual language, no third
  colour. If `color.handRight` ever changes, the icons are regenerated.
- Committed as files rather than generated at build time. Generating them needs
  a raster library, and adding a dependency to avoid four
  small PNGs trades a small exception for a larger one.

Rejected: dropping installability to keep the rule absolute. That costs the iPad
home-screen launch, which is the feature, to protect a rule against a case it
was not written for.

**Separately, T10 AC7 was wrong on its own terms.** It named Lighthouse's
"installable" audit; **Lighthouse removed the PWA category entirely in v12.0.0**
(April 2024). The criterion now checks the real thing — DevTools reporting no
manifest installability errors on the deployed origin, an install affordance in
the browser, and iOS Add to Home Screen showing the icon rather than a
screenshot.

### D-036 — Static Pages, not Workers, and the vite plugin goes
**2026-08-13 · Decided — after the first deploy failed · PARTLY SUPERSEDED BY D-037**

> The deploy-target half of this decision no longer holds: Cloudflare's
> dashboard no longer offers a Git-connected Pages project. See D-037.
> The `@cloudflare/vite-plugin` removal below still stands.

The first Cloudflare build failed with:

```
Using redirected Wrangler configuration.
 - Configuration being used: "dist/wrangler.json"
 - Original user's configuration: "wrangler.jsonc"
✘ [ERROR] Cannot start service: Host version "0.27.3" does not match binary version "0.28.1"
```

There is no `wrangler.jsonc` in this repo. The project had been created as a
**Workers** project — the dashboard's default for new projects — so the build
took the Workers path, generated a config and tried to boot `workerd`. The
version mismatch is a symptom; running `workerd` at all is the mistake.

**This product has no server component and never will** (AGENTS.md #7: no
backend, no API routes, no database, no secrets). It is a static SPA plus a
bundled catalog. The deploy target is a **Cloudflare Pages project**, where the
build output is uploaded as files and wrangler is never executed. That removes
the whole failure class rather than pinning versions against it.

Two pieces of debris were feeding the wrong path, both left over from the Vinext
scaffold D-001 removed:

- **`@cloudflare/vite-plugin` is unused.** `vite.config.ts` does not reference
  it; it survived only because BUILD_PLAN's dependency list was written while
  Vinext was still around and said "already in the repo, keep". An unused
  dependency that changes how the host detects your project type is worse than
  useless. It is removed from `devDependencies` and from BUILD_PLAN's approved
  list. `wrangler` itself stays — it is still the tool for a manual
  `pages deploy` and for local checks.
- **`.wrangler/deploy/config.json` points at `dist/server/wrangler.json`**, an
  SSR output path that has not existed since D-001. It is gitignored so it never
  reached Cloudflare, but it misdirects local wrangler runs. Delete it.

Not chosen: **Workers Static Assets**, which is Cloudflare's newer recommendation
and would work with an `assets` block and `not_found_handling:
"single-page-application"`. It keeps wrangler in the build path for a site that
needs nothing wrangler provides, and on a free account plain Pages serves static
assets without the Workers request accounting. Revisit only if this app ever
grows a server side, which AGENTS.md #7 forbids.

**Node version is the next trap.** `package.json` requires `node >=22.13.0` and
Cloudflare's build image defaults lower. The Pages project needs
`NODE_VERSION=22` (or a `.node-version` file) or the build fails on engines
before it reaches anything interesting.

### D-037 — Workers Static Assets, because Git-connected Pages no longer exists
**2026-08-13 · Decided — supersedes D-036's deploy target**

D-036 chose a Pages project on the grounds that this app has no server component
and a static Pages build never executes wrangler. That reasoning was sound and
the conclusion is now unavailable: **Cloudflare has put Pages into maintenance
mode** and the dashboard routes every Git connection into the Workers flow. The
screen offers a *Deploy command* (`npx wrangler deploy`) and no *Build output
directory* field, because on Workers the output location comes from the repo's
Wrangler config rather than from the dashboard.

So the real choice is not Pages-vs-Workers. It is:

| | Deploys | Cost |
|---|---|---|
| Pages, direct upload | manual: build, then drag `dist` every time | none |
| Workers Static Assets, Git-connected | automatic on push | a `wrangler.jsonc` in the repo |

Automatic wins. The manual route is exactly the chore that gets skipped until
the live site is quietly months behind, and this project's whole operating model
is that an agent pushes changes.

Both things D-036 worried about are covered on Workers Static Assets:

- **SPA deep links** — `assets.not_found_handling: "single-page-application"`
  serves `index.html` for any path that is not a real file. **`public/_redirects`
  must be deleted**, not kept: see the correction below.
- **The manifest `Content-Type`** (AC11) — Workers Static Assets reads the same
  `_headers` file, so the fix Codex already pushed carries over unchanged. Up to
  100 rules, 2,000 characters per line, and it does not apply to responses
  generated by Worker code — none of which binds here.

The config is assets-only, with **no `main`**: there is no Worker script, so
nothing of AGENTS.md #7 ("no backend") is conceded. Cloudflare serves files and
runs no code of ours.

```jsonc
{
  "name": "piano-practice-player",
  "compatibility_date": "2026-08-13",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

**On the original `workerd` failure, honestly: it is not fully explained.** The
first build died on `Host version "0.27.3" does not match binary version
"0.28.1"`. The obvious theory — two `workerd` versions in the dependency tree —
was tested and is wrong: `npm ls workerd` shows a single deduped
`1.20260515.1`. The mismatch was therefore between Cloudflare's build image and
the project's pinned versions, on a build that was working from a config
Cloudflare generated rather than one in the repo. An explicit, checked-in
`wrangler.jsonc` removes that ambiguity. If the mismatch recurs, the lever is
the deploy command resolving to the project's own wrangler.

**Correction, after the first Workers build failed.** This entry originally said
`public/_redirects` was "redundant but harmless" on Workers and should be kept in
case the project ever moved back to Pages. That is wrong, and it cost a build:

```
Invalid _redirects configuration:
Line 1: Infinite loop detected in this rule. This would cause a redirect to
strip `.html` or `/index` and end up triggering this rule again. [code: 100324]
```

The file's single rule is `/* /index.html 200` — the canonical Pages SPA
fallback. Workers Static Assets applies `html_handling` (default
`auto-trailing-slash`) which strips `/index` and `.html`, so a rule rewriting
every path *to* `/index.html` re-matches itself. Cloudflare detects the cycle at
deploy time and refuses the whole deployment.

`_redirects` is therefore **deleted**. `not_found_handling:
"single-page-application"` is the Workers mechanism for the same job and is
already configured. The reasoning that was wrong is worth naming: keeping a file
that breaks the current target, to hedge against a hypothetical return to the
old one, inverts the cost. If this project ever moves back to Pages, adding two
lines back is trivial; discovering a broken deploy is not.

`_headers` is unaffected — it sets response headers and cannot form a cycle.

**Node version moves into the repo too.** `package.json` requires
`node >=22.13.0`. A `.node-version` file containing `22` pins it: Cloudflare's
build-image docs list `.node-version` and `.nvmrc` as equivalent to the
`NODE_VERSION` build variable, and a file is version-controlled and reviewable
rather than hidden in a dashboard that keeps moving.

Correcting an earlier claim in this log: **a `NODE_VERSION` variable was said to
be mandatory, and it is not.** Workers Builds defaults to Node 24.18.0, which
already satisfies the engines field, so the build would succeed with neither the
file nor the variable. The file is pinning for reproducibility, not a fix. Note
it pins CI to the image's preinstalled 22.x while local development is on 24.x —
harmless for a Vite build, but change it to `24` if that divergence ever
matters.

### D-038 — The four ambiguous Rousseau rows resolve to 25 playable, not 24
**2026-08-16 · Decided — data correction**

`rousseau-classical.tsv` carried four rows marked `verify`, each guessing at a
Chopin catalog id from a German title too generic to disambiguate. All four are
now settled, and not by listening or guessing: `manifest.json` records a
`licence.sourceUrl` for every row, and Mutopia's own directory paths name the
opus.

| Row | Claimed | id | Mutopia path | Verdict |
|---|---|---|---|---|
| 70 | Étude Op. 10 No. 1 | `etude-c-dur` | `O10/chp-10-01/` | **have** |
| 77 | Étude Op. 10 No. 12 | `etude-c-moll` | `O10/op-10-12-wfi/` | **have** |
| 61 | Étude Op. 25 No. 12 | `etude-c-moll` | same file as row 77 | **missing** |
| 67 | Marche funèbre (3rd mvt) | `sonate-2-b-moll` | `O35/chp-op-35-**4**-scholz-fi/` | **missing** |

So the seeded playlist resolves to **25 distinct playable pieces and 39 absent
works**, not 24 and 37. The generalisable point: the source path is harder
evidence than the title, and it was sitting in the manifest the whole time.

Two catalog-quality bugs fell out of this and are **not** playlist bugs:
`sonate-2-b-moll` is titled "Sonate 2 b-moll" but contains only the finale
(82s), and `pictures-at-an-exhibition` is 237s against a ~33-minute suite. Both
are mislabelled scope, and both will mislead search long after this playlist
ships.

### D-039 — Closing the catalog gap is a licensing problem, not a format problem
**2026-08-16 · Decided — scope correction, and a correction to D-034**

Asked: fetch the 39 absent works from anywhere, in any format, and convert them.
Conversion is the easy half and it is not what is blocking us. Every source
below was checked first-hand today; none of this is repeated from a secondary
claim.

> **Superseded the same day by D-040 on the central point.** The claim below —
> that piano-midi.de cannot be read from this machine — is **wrong**, and the
> diagnosis that it is "a filtering intermediary" is wrong with it. The host
> tested was `www.piano-midi.de`; the site lives on the **apex** domain. The rest
> of this entry (the kern licences, Commons, the arrangement trap) stands.

**piano-midi.de is still unreadable from this machine, and D-034 said why
incorrectly.** D-034 recorded the failure as the egress proxy refusing HTTP.
Plain HTTP is not blocked — `http://example.com` returns 200 from here. The
block is specific to that host: every request returns a bodyless `418 I'm a
teapot` with no `Server` header, which is a filtering intermediary rather than
the origin, and browser-identical headers do not defeat it. HTTPS is not served
(404, then a TLS handshake failure without `www`). O-8 therefore cannot be
closed from this machine at all — it needs a human browser, not another attempt.

**Humdrum/kern editions — the licences, read from the LICENSE files:**

| Corpus | Licence | Usable? |
|---|---|---|
| `mozart-piano-sonatas`, `scarlatti-keyboard-sonatas`, `joplin`, `haydn-piano-sonatas`, `bach-370-chorales` | CC BY-NC-SA 4.0 | only if the app is permanently non-commercial |
| `beethoven-piano-sonatas`, `chopin-preludes`, `chopin-mazurkas`, `chopin-humdrum-nifc`, `scriabin`, `vivaldi-op6` | **none declared** | **no** — no licence is all rights reserved |

A public-domain work does not make its *encoding* public domain; the digital
edition is a new copyrightable work. The repositories that would actually help
here — Beethoven and Chopin — are the unlicensed ones. Kern remains attractive
in principle because it carries staff information, which is real hand data
rather than an inference, but not at the price of shipping unlicensed files.

**Wikimedia Commons is ruled out** for this purpose: it holds page scans, PDFs
and recordings of these works, and no symbolic score data.

**Nine of the 39 are arrangements, and the arrangement carries its own
copyright** — the Vivaldi Four Seasons, the two Bach piano arrangements, both
Nutcracker numbers, Flight of the Bumblebee (arr. Rachmaninoff) and Ständchen
(arr. Liszt). "Find a MIDI of it" is not sufficient for any of them; the
specific arrangement must also be out of copyright. This is the same trap that
already excluded Liebesleid and Carol of the Bells, and it is why the sourcing
count cannot be treated as a single number.

**Consequence for T12a:** the playlist must be able to render a work it cannot
play regardless of how sourcing goes — the 7 excluded rows are permanently
unsourceable. That is a UI question, and it is in the design options rather than
assumed here.

**Left open, because it is not mine to decide:** whether the app is permanently
non-commercial. Answering yes unlocks the CC BY-NC-SA corpora, at the price of
a commitment that is awkward to reverse once files are shipped under it. See O-10.

### D-040 — piano-midi.de is CC-BY-SA and cleared for use. The blocker was a `www.`
**2026-08-16 · Decided — O-8 closed, and three sessions of wrong conclusions corrected**

`http://piano-midi.de/copy.htm` returns `200 OK` from Apache, 7205 bytes. It
always did. Every previous attempt — D-034's, and D-039's more confident one —
tested **`www.piano-midi.de`**, which is a different machine on a different IP
(82.165.134.185 vs 87.106.182.110) serving a Go placeholder that answers `404`
over HTTPS and a bodyless `418` over HTTP. Two sessions concluded "the site is
unreachable" and one concluded "a filtering intermediary is blocking that host".
Both were describing a dead subdomain and neither tried the apex.

The licence, read from the page:

> The MIDI, audio(MP3, OGG) and video files of Bernd Krueger are licensed under
> the cc-by-sa Germany License. This means, that you can use and adapt the
> files, as long as you attribute to the copyright holder Name: Bernd Krueger,
> Source: http://www.piano-midi.de. The distribution or public playback of the
> files is only allowed under identical license conditions.

**Redistribution is permitted.** Attribution is to *Bernd Krueger*, source
*http://www.piano-midi.de* — the licence names the broken host, so that string
goes in `licence.creator`/`licence.url` verbatim as the licence requires,
regardless of the fact that fetching must use the apex.

Two things this page does **not** say, and which must not be invented: it gives
**no version number** ("cc-by-sa Germany License", not "3.0 DE"), and it does not
name a deed URL. Record it exactly as worded and link the page itself. There is
**no NonCommercial clause** — the licence family here is BY-SA, not BY-NC-SA.

The composer index on that page is precisely the shape of our gap: Liszt,
Ravel, Debussy, Tchaikovsky, Rachmaninov, Mussorgsky, Schubert, Chopin,
Beethoven, Mozart. T13's gate is **cleared**; its sourcing work is unblocked.

The lesson is cheap to state and was expensive to learn twice: `www.` and the
apex are different hosts, and "the site is down" is a claim about a hostname,
not about a site. Test both before recording a source as unreachable.

### D-041 — The app is permanently non-commercial
**2026-08-16 · Decided — Anirudh, answering O-10**

Stated plainly so future sourcing decisions can lean on it: this app will not be
sold, monetised, ad-supported or licensed commercially, ever.

That unlocks the CC BY-NC-SA kern corpora (Mozart, Scarlatti, Joplin, Haydn,
Bach chorales) as legitimate sources. It turned out not to be needed for
piano-midi.de, which is BY-SA with no NC clause (D-040).

Two consequences to hold onto. **NC and SA sources cannot be merged into one
work** — BY-SA and BY-NC-SA are mutually incompatible — but that is not what we
do: each score is a separate file carrying its own `licence` record, which the
catalog already models per row. Keep it that way; never concatenate or bundle
scores of different licences into a single artefact. And **share-alike binds any
file we adapt**: a MIDI converted from a BY-SA or BY-NC-SA source ships under
that same licence, attributed, not relicensed.

### D-042 — The shipped playlist: a Home section, its own page, no play-through, and an honest footer
**2026-08-16 · Decided — Anirudh, from three option sets**

T12 was split into T12a (shipped, read-only, no schema change) and T12b (user
playlists, carrying the Dexie v1→v2 migration). Three UI questions were put up
as rendered options over the real resolved data in
`docs/mockups/playlist-options.html`. All three recommendations were approved.

**Where it lives — a "Playlists" section on Home, opening its own page** at
`/playlists/:playlistId`, rather than expanding inline or hiding behind a header
link. Inline expansion pushes My pieces below 25 rows and would be rebuilt the
moment T12b allows a second playlist; a header link is the least discoverable
version of the feature this task exists to deliver.

**No play-through.** The player is not touched: no next/previous, no
auto-advance, no playlist context threaded into the route. D-032 deferred this
because "play the next one" drags in transport questions — end-of-piece
behaviour, whether an A–B loop suppresses the advance, whether practice speed
carries over. Shipping without it keeps T12a small and turns O-9 into a question
answered by use rather than by speculation.

**The absent works get one honest line**, not silence and not 39 dead rows:
"39 more works from this playlist are not in the catalog yet", followed by the
composers most affected. Hiding them makes the app quietly drop more than half
the captured list; rendering all 64 makes three rows in five untappable in a
tool whose entire purpose is playing something.

Both halves of that line are **derived from the build**, never written in a
component — the count and the composer names must shrink on their own when T13
lands more pieces, or the line becomes a lie the day it ships.

**Amended the same day, after Codex found the spec contradicting itself.** The
task first said "the four composers with the most missing rows" while showing an
example naming four different ones. Working the numbers showed the *stated
algorithm* was the wrong half: by raw missing count the top entry is **Chopin,
with 10 missing and 11 playable** — the best-served composer in the playlist.
The line means "composers you largely cannot play", so eligibility is
`missing > playable`, sorted by missing desc, then playable asc, then surname.
That yields Liszt (6/1), Ravel (3/0), Vivaldi (3/0), Beethoven (3/2), and
excludes Chopin and Debussy (3/3) correctly. The two extra sort keys are not
decoration: four composers tie at 3 missing rows, and without them the generated
JSON reorders between builds.

The generalisable bit: a derived string can be perfectly well-derived and still
false. "Most missing" and "most absent" are different questions, and only the
data says which one the sentence is actually asking.

### D-043 — Accounts and sync are the destination, deliberately not the next stop
**2026-08-16 · Decided — Anirudh, direction recorded, no work authorised**

Asked how several people are meant to keep their own catalogues with no
database, no API and no authentication. The honest answer was that they cannot:
the app has no user identity at all, so one browser profile is one library, two
devices are two unrelated libraries, and nothing is shareable.

**The long-term intent is real accounts with sync across devices.** The
prioritisation call is to skip it for now: assume a single user on any device,
with **no syncing and no new functionality built for it**. Local profiles and
export/import were both offered and both declined — building either now would be
scope the user explicitly did not ask for.

**This changes how PRD §4 should be read.** It lists "No accounts, cloud sync,
or sharing" among the non-goals, and that reads as permanent. It is not — it is
a *sequencing* statement scoped to MVP/V1, which the line itself hints at
("for MVP/V1") but does not make obvious. AGENTS.md rule 1 forbids editing
`PRD.md`, so this entry is the correction: **do not treat accounts as
permanently refused.** When it is picked up it needs a PRD amendment from
Anirudh, not a decision entry from an agent, because it reverses a stated
non-goal and pulls in a backend, a bill, password handling and privacy
obligations that the product has never carried.

**What this does and does not license today.** It licenses nothing to be built.
It does license *cheap* choices that avoid painting the schema into a corner —
specifically, identifiers that stay unique when a second device eventually
exists. T12b already carries `createdAt`/`updatedAt` per playlist, which is what
a future merge would need, so no extra work is required there beyond making ids
collision-proof (see the amendment in T12b). Nothing else is to be added
speculatively: a sync design written now, against no backend and no requirements,
would be guesswork that ages badly.

### D-044 — T13 shipped, and it turned one true label into a false one
**2026-08-16 · Decided — completion note plus a severity correction**

The catalog is 609 rows: 596 Mutopia, byte-identical on regeneration, plus 13
from piano-midi.de, each carrying name, url, sourceUrl, sha256 and creator, all
with real hand data. The seed playlist went from 25 resolved / 39 missing to
**38 / 26**, and `missingComposers` correctly re-derived to Vivaldi,
Tchaikovsky, Rimsky-Korsakov, Schubert — the rule from D-042 working unattended,
which is what it was for.

Two rows worth noting: *Marche funèbre* and Étude Op. 25 No. 12 are now present
with the **correct** files. Those are exactly the two rows D-038 demoted after
finding the Mutopia ids were mislabelled, so that thread is closed properly
rather than papered over.

**The severity correction.** The report ended with "one pre-existing display
limitation remains: the player header labels every bundled piece 'Mutopia
catalog'". It is not pre-existing and it is not a display limitation.
`PlayerHeader.tsx:102` hardcodes `MUTOPIA CATALOG` for every catalog piece;
before T13 that was **true of all 596**, so the code was correct. T13 added 13
pieces from a different source and thereby made the statement false — the defect
was *introduced* here, not inherited.

It is also a licence matter rather than cosmetics. cc-by-sa Germany requires
attribution naming creator and source. Rendering the wrong source is worse than
rendering none: it asserts a false provenance about Bernd Krueger's work and
attaches Mutopia's name to files Mutopia never made. The app is publicly
deployed, so it is live. **T13a** fixes it, with silence as the fallback for
already-stored pieces — a wrong default is the whole bug.

The generalisable point: a hardcoded constant that is true of every row today
becomes a lie the moment a second source lands, and it will not fail a test that
was written when it was still true.

### D-045 — "Unrelated baseline failures" were ours, twice
**2026-08-16 · Decided — process correction**

T13a shipped correctly: `sourceCollection` on `PieceDocument`, derived from
`licence.url`, with `sourceLabel()` returning the stored value so legacy records
drop the segment through the existing filter. All seven criteria hold.

It ended with: *"An optional full e2e run passed both T13a cases but finished
23/31 due to eight unrelated baseline failures... I left those outside-scope
issues untouched."* The run reproduces exactly — 8 failed, 23 passed — and **at
least two of the eight are caused by T13**:

- `home.e2e.ts:270` asserts 47 catalog matches for "chopin". There are now 51.
  The four extra are Winter Wind, Ocean, Marche funèbre and Polonaise Op. 53 —
  T13's Chopin additions. 47 + 4 = 51.
- `playlist.e2e.ts` asserts "25 PIECES · 1H 29M" and "39 more works". The
  playlist is now 38 and 26.

Neither is unrelated and neither is a baseline. Six others remain genuinely
unclassified and are T13b's job to diagnose rather than dismiss.

**This is the second instance of the same pattern**, after D-044 recorded the
"pre-existing display limitation" that T13 had in fact introduced. Both times a
task changed the catalog, broke something that depended on the catalog, and
described the breakage as inherited. The common cause is that **`npm run check`
does not run Playwright** — it is types, lint, guardrails and unit tests. A task
can be honestly reported as green while leaving the e2e suite red.

Three changes follow. `AGENTS.md`'s definition of done now requires
`npm run test:e2e` for any task touching catalog data, routes or a screen; it
records that the suite needs port 4181 free because every spec builds and serves
its own preview there; and it states that **a failing test belongs to the task
that finds it until evidence says otherwise** — checking the assertion against
what changed, or running the spec on the previous commit.

The deeper lesson is about hardcoded counts. `home.e2e.ts` derives most of its
numbers from the manifest at runtime and those assertions survived; the one
literal `47` did not. A test that hardcodes a number derived from data under
active growth is a scheduled failure, and it fails long after the person who
wrote it has stopped watching.

**Closed by T13b, 2026-08-16 — 31 passed, verified independently.** The six
unexplained failures were classified with evidence from pre-T13 commit
`7981975`, which is the check this entry asked for. Four were environmental:
the built service worker served a precached manifest that bypassed Playwright's
network routing, and its navigation fallback replaced the generated harness
pages after first navigation. Service workers are now blocked for the harness
specs and for the single manifest-failure test only; the offline assertions in
`home.e2e.ts` and the `sw.js` precache inspection in `foundation.e2e.ts` still
run against a live worker, so PWA coverage is intact.

One of the six deserves recording on its own. `player.e2e.ts` asserted the
header laid out `nowrap`, while **D-027 requires it to wrap below `md`** — the
test had been asserting the opposite of a binding decision and passing only
because it was never run in this configuration. The assertion now matches
D-027. That is the difference between fixing a test and weakening one: the code
was right and the test was wrong.

Growth was then proven rather than asserted — a 610th row was added, the suite
stayed green, the row was removed and `manifest.json` restored to SHA
`1EA81605…57CB9A83` with a clean worktree.

### D-046 — The player fits a landscape phone with every control still on screen
**2026-08-16 · Decided — additive to the handoff; T14**

The handoff's responsive gate (`docs/design-contract.md` §4) is 1440×900 and
1024×768. A phone in landscape was never in it. Measured on the deployed app via
Playwright, opening *Air — BWV Anh. 131*:

| Viewport | Header | **Notes** | Keyboard | Transport | Notes' share |
|---|---|---|---|---|---|
| 932×430 — iPhone 14 Pro Max, installed | 71 | **126** | 112 | 121 | 29% |
| 932×390 — slim browser bar | 71 | **86** | 112 | 121 | 22% |
| 932×340 — Safari, both toolbars | 71 | **36** | 112 | 121 | 10% |
| 932×320 — worst realistic case | 71 | **16** | 112 | 121 | **5%** |
| 667×375 — small phone, header wraps to two rows | 105 | **37** | 112 | 121 | 10% |
| 1024×768 — iPad landscape | 71 | 461 | 115 | 121 | 60% |

The waterfall is the only part anyone reads while playing. iPad landscape is
already fine; the phone is not. Below roughly 338px of visible height the fixed
chrome exceeds the viewport outright and the transport is clipped with no way to
scroll to it, because the shell is `overflow: hidden`.

**Nothing hides.** An earlier draft of this decision proposed a "focus mode" that
auto-hid the chrome after 2.5s and moved speed and A–B behind a `⋯` sheet.
Rejected by Anirudh the same day, and correctly: *"keeping a focus mode removes
controls which defeats the purpose of careful study and practice."* The whole
value of this player over a video is that you can slow a passage, loop four bars
and re-run them — controls you reach for constantly, that must be there when you
look. A player you have to go searching through is a video player with extra
steps. **Every control stays visible at every size.** The `⋯` sheet and the
auto-hide are struck from the design.

**The scroll that reveals nothing** — the part being reported as broken — is
separate and goes first. `globals.css` sets `min-height: 100%` on `html`, `body`
and `#root` while `PlayerView` sizes the shell to `100dvh` (D-027). On a phone
those differ: `100%` resolves against the initial containing block, which mobile
browsers size to the viewport with the toolbars *hidden*, while `100dvh` is the
viewport as it stands. The difference, exactly one toolbar, becomes scrollable
empty space. Two-line fix.

**How everything fits without hiding anything.** Measured natural widths, taken
at 1440×900 where nothing is compressed: play 46 · time 96 · SPEED group 210 ·
LOOP group 214 — **566px of fixed transport controls**. A 932px or 844px screen
therefore has 160–250px left for the seek bar, so the two transport rows merge
into one. Below about 820px they do not fit, so the seek bar keeps its own row
and speed and loop share the one beneath — still two rows, but 44px each rather
than 72 and 48.

The header is the same story. Its controls are 456px at their widest and the
`← Library` button is 80px, so one row needs about 660px including a title —
comfortably inside a landscape phone. The 105px two-row header at 667px is
caused by the `w-full` wrap rule from D-027, which was the right fix for a narrow
*portrait* phone and is exactly wrong sideways, where width is the plentiful
dimension and height is the scarce one. It becomes conditional on being narrow
**and** tall.

**Two densities, chosen from the shell's own measured height.** Not a media
query: `PlayerView` already observes its own box with a `ResizeObserver`, and a
rotation, a fullscreen toggle, an iPad split view and a toolbar sliding away all
move that one number. `@media (max-height:)` sees only two of the four.

| | `comfortable` — ≥ 620px tall | `compact` — < 620px tall |
|---|---|---|
| Header | 71px, two lines | 44px, one line |
| Transport | 121px, two rows | 52px (≥820px wide) / 88px (narrower) |
| Keyboard | `clamp(112px, 15vh, 158px)` | `clamp(96px, 24vh, 158px)` |
| Controls hidden | none | **none** |

At 932×320 the notes go from 16px to 128px — 5% to 40%. At 932×430, from 126px to
231px — 29% to 54%. **Above 620px not a pixel moves**, so every viewport in the
fidelity gate is untouched.

**The single transport row was approved by Anirudh on 2026-08-16**, which is what
his 932px-wide phone gets. The two-row form below 820px is not a second design to
choose between — it is arithmetic: 566px of controls plus a seek bar wide enough
to scrub with does not fit a 667px screen on one line. It is the same controls on
two shorter rows, and it is what a smaller phone falls back to.

Three things do change at `compact`, and none is a control:

1. **Title and composer share one line** instead of stacking. Same words, one row
   shorter, truncating from the right.
2. **The `← → SKIP 5 SECONDS` hint drops.** It describes two keys on a hardware
   keyboard, on a device that has none. The shortcuts keep working.
3. **The RIGHT / LEFT text legend drops** — as it already does below 1024px. The
   swatches on the hand-colour button carry the same information.

**Fullscreen is a bonus, not the fix.** A toggle renders only where
`document.fullscreenEnabled` is true, and asks for a landscape orientation lock
inside the same gesture where supported. **Anirudh's device is an iPhone 14 Pro
Max, so it will not render for him**: Safari on iPhone has never reliably offered
the Fullscreen API for anything but a `<video>`, and caniuse lists Safari iOS as
*partial* through 26.5. A button that silently does nothing is worse than no
button, and this is exactly why the layout above has to stand on its own.

The iPhone equivalent already exists and costs nothing: the app ships
`display: standalone` (D-035, `vite.config.ts`), so **Add to Home Screen** launches
with no browser chrome at all — the full 430px, permanently, which is the 932×430
row of the table above. The install steps belong in the report to Anirudh, not in
code.

`index.html` also gains `viewport-fit=cover` with `env(safe-area-inset-*)`
padding; without it iOS letterboxes landscape and discards width on a notched
device. `docs/mockups/player-landscape-fit.html` renders every size above, and
measures the device it is opened on.

### D-047 — The keys go white and black
**2026-08-16 · Decided — a deliberate, recorded departure from the handoff; T15**

The shipped keyboard puts `keyWhiteFace: #151821` beside `keyBlackFace: #0C0E11`.
That is **1.09:1**. WCAG 1.4.11 requires 3:1 for visual information needed to
identify a control, and telling a white key from a black key is the entire job of
the component. The line between two white keys is 1.23:1, and the labels are
3.06:1 and 2.41:1 against 4.5:1 required.

**Why the phone is worse than the laptop.** A screen in a lit room reflects some
of that light, adding a constant luminance floor to every pixel. Contrast between
two near-blacks collapses toward 1.00:1 as that floor rises — the shipped pair
goes from 1.09:1 in a dark room to **1.02:1** in daylight. A laptop at a desk sits
in far less light than a phone on a music stand, and phone OLED panels flatten
everything below roughly 4% luminance regardless. Both key colours live there,
nine code values apart out of 255. The palette works only in the condition it was
chosen in.

**Decided: white keys `#F0F2F6`, black keys `#0B0D11`.** 17.35:1, and **5.33:1
even in daylight** — the best figure of any candidate, and the only palette in
which the error state also clears 3:1 (3.08:1 against a white key, where every
darker option fails it). It is what the instrument looks like, so the mental
model transfers for free.

**Why the middle was wrong, which is the useful part.** Two things need contrast
and, on one flat key face, they pull in opposite directions. *Identification* —
white key against black key — wants the face lighter. *State* — a lit key,
painted in the hand colour `#4CC2FF`, against an unlit one — wants it darker,
because the hand colour is itself a light blue. They cross at about `#5C6572`,
where identification reaches 3.41:1 and state falls to 2.94:1 and neither is
comfortable.

An ivory face, `#C6CBD4`, was drafted and **rejected on sight by Anirudh as
looking wrong**. There is a measurement behind that reaction: ivory is
**1.23:1** against the lit key, meaning the keyboard and the keys being played
are within a hair of the same lightness, so the whole band reads as one flat
mid-tone. The fix is to go *further*, not less far. At `#F0F2F6` the face is
clearly above the hand colour rather than level with it, so identification climbs
to 17.35:1 **and** the lit key separates by 1.79:1 instead of 1.23:1. Both
numbers improve together, which is the sign the trade-off has been left rather
than split. Rejected options are kept rendered in the mockup with live figures.

Three state changes follow, and they are the whole of the work:

- **A lit white key gains a 2px `#06121A` ring.** 1.79:1 on hue alone is not
  enough, and it fails outright in greyscale or for a colour-blind viewer. The
  ring is 16.89:1 against the white face and 9.44:1 against the accent, so the
  lit key stays outlined whatever the lighting. White keys only — a lit black key
  is already 9.69:1 against its own face.
- **The countdown fill (D-022) runs dark on a white key.** `#4CC2FF` over white is
  1.79:1 — the fill would be invisible. `#06121A` at `E6` gives 13.40:1 against
  the key and 7.49:1 against an accent-lit neighbour, and reads as the key filling
  with shadow. Hand identity is still carried, by the prepared key's border and
  its inset hand-coloured glow, both unchanged; the fill carries imminence only,
  which is exactly what D-022 specified.
- **The fill on a black key goes from alpha `66` to `88`.** At `66` it is 2.42:1
  against the key face — a shipped value that has always been under the bar and
  was invisible for the same reason everything else was. `88` gives 3.47:1. One
  hex digit, and it is the same defect as the rest of this entry.

The stage, the waterfall, the transport and every other surface are untouched.
The picture is a lit instrument in a dark room, which is what a piano looks like
in the situation this app is used in.

One value is deliberately not held to 3:1: the black key's top edge, `#363D48`, is
1.78:1 against its own face. It is dimension, not identification — a black key is
17.35:1 against the white keys either side of it, and that is what tells you which
key it is.

`docs/mockups/keyboard-contrast-options.html` renders this against the three
rejected candidates with every figure computed live and a room-light slider. It
also carries **Option 4b, the same palette at pure `#FFFFFF`**, which buys a
little more contrast everywhere and a little more glare in a dark room.

**`#F0F2F6` confirmed by Anirudh on 2026-08-16, after seeing both on the phone**
— option 4, not 4b. The value in the table above is final; O-12 is closed.

### D-048 — IMSLP is not a source, and 25 of the last 26 works have nowhere to come from
**2026-08-16 · Decided — research result, one source confirmed, one blocked**

After T13 the seed playlist has 26 works still absent. This entry records where
they can and cannot come from, so the question is not re-opened from scratch.

**IMSLP is ruled out — now with evidence rather than a hunch.** Earlier notes
called it "viable file-by-file at best". It is not viable at all for this
purpose. Its API exposes each upload block's files and its `|Copyright=` field,
so coverage is measurable: across **21 curated target groups** covering all 26
works, exactly **one** carried any symbolic file — a LilyPond source for
Debussy's *Rêverie*, CC BY-SA 4.0, and it is an arrangement **for violin and
piano**, not solo piano. Everything else is scans, parts and MP3s. IMSLP is a
library of images and recordings; it is not a source of machine-readable scores.

A methodological note worth keeping, because the first answer was wrong. An
initial sweep built its queries from the Rousseau titles and reported "0 of 26,
no page found" for twenty works — including Rêverie, whose page had been read
minutes earlier. Two causes: catalogue numbers differ between sources (Rousseau
"L. 68" vs IMSLP "CD 76"), and individual études and preludes have no page of
their own, living under the parent opus. **A search that returns nothing is a
claim about the query, not about the library** — the same failure shape as
D-040's `www.` and worth the same suspicion.

**Kunst der Fuge is ruled out.** Its terms state no website may re-host or reuse
its MIDI files without explicit authorisation, and admit no commercial use. Read
second-hand: the site returns 403 to this machine. The terms are unambiguous
enough that no first-hand read is needed to reject it.

**Musopen cannot be checked from here.** Both WebFetch and curl get 403 —
bot protection, not absence. Secondary sources describe roughly 2,000 works,
public domain or Creative Commons, in PDF, **MIDI and editable LilyPond**. If
accurate that is the most promising remaining lead by some distance. It is
recorded as unverified, and it is O-14. The precedent is D-040: piano-midi.de
looked unreachable too, and the block was an artefact, not the truth.

**One work is confirmed obtainable now.** `craigsapp/mozart-piano-sonatas`
carries `kern/sonata08-1.krn`, whose own header reads `OTL: Piano Sonata No. 8
in A minor` and `SCT1: K 310` — **Mozart K. 310, first movement**, one of the
26. The corpus is CC BY-NC-SA 4.0, usable because the app is permanently
non-commercial (D-041), and Humdrum `**kern` carries real staff information, so
the hand split is engraved rather than inferred from a performance.

**Net position: 1 of 26 sourceable today, 25 with nowhere to come from** until
Musopen is checked or a new source appears. Five of the 25 — the three Vivaldi
*Four Seasons*, Scriabin Op. 8/12 and *Flight of the Bumblebee* — are also
absent from piano-midi.de, so they are the least likely to ever arrive. Nine of
the 26 are arrangements whose arranger's rights need checking separately even if
a file is found; that constraint has not moved.

### D-049 — The complete Pictures replaces the mislabelled Baba Yaga fragment
**2026-08-16 · Decided — T03e source correction; explicit amendment to its criterion 5**

Mutopia 475 is titled *Pictures at an Exhibition*, but its selected archive
member is `baba.mid` and lasts 237 seconds. The source tree confirms that member
is only *The Hut on Fowl's Legs (Baba Yaga)*. Relabelling it would make the row
honest, but would leave the catalog without the complete suite.

piano-midi.de's Mussorgsky page lists eight ordered MIDI files spanning
Promenade–Gnomus through Baba Yaga–The Great Gate of Kiev, about 29:58 in all.
T03e therefore keeps the stable `pictures-at-an-exhibition` id and title but
replaces the fragment with a same-licence composite of those eight files. The
Mutopia row is skipped only in the merged catalog; `piano-midi.de` supplies the
bytes and the full per-row Bernd Krueger licence record established by D-040.
The catalog stays at 609 rows.

This explicitly supersedes T03e criterion 5 only where it said
`catalog/LICENCES.md` must remain unchanged. The file must change to tell the
truth about the replacement's creator, source URL and checksum. The criterion's
no-add/no-drop intent and unchanged row count still hold.

### D-050 — The update prompt was configured and never built, so no deploy has reached a returning user
**2026-08-16 · Decided — bug, found in use**

Reported: the live site shows the seed playlist in a private window and not in a
normal one, assumed to be caching.

It is not a CDN cache and the deploy is fine — the live `sw.js` precaches
`catalog/playlists.json`, so the current build is what is being served. The
worker never takes over. `vite.config.ts` sets `registerType: "prompt"` with
`skipWaiting: false`, so the generated worker yields only on receiving a
`SKIP_WAITING` message, and **nothing in `src/` has ever sent one** — there is no
`useRegisterSW` and no update UI. The new worker installs, enters `waiting`, and
stays. Reloading does not help, because the page remains controlled by the old
worker. A private window has no prior worker, so it installs the current one and
looks correct.

**Every deploy since T10 has been invisible to a returning browser** — T11's
mobile fixes, T12a's playlist, T13's 13 pieces, T13a's attribution fix. The
attribution defect D-044 called "live" was in fact live only for new visitors,
which makes it less urgent and this defect more so.

The fix is to build the prompt the config already assumes (T10a), not to switch
to `autoUpdate`. This app runs while the learner is playing: a silent reload
stops playback, loses the position and discards an A–B loop. Keeping
`skipWaiting: false` also avoids swapping assets under a page that may still
lazily load Verovio or the import worker. The notice must not auto-dismiss —
a missed toast leaves the user exactly as stuck as before.

Two things worth carrying forward. **A configuration option that names a
behaviour does not implement it**; `registerType: "prompt"` reads like a working
choice and is really a promise to write UI that was never written. And **the
defect is invisible to every test we have**, because tests always start from a
clean profile — the bug needs a *previous* worker to exist. Private-window
testing hides exactly this class of fault, and it is the class that hits real
users hardest, since only real users have a history.

**Closed 2026-08-16 — verified in production by Anirudh.** T10a shipped, and the
next deploy after it produced the notice on his own browser and reloaded into the
new build. That is the first confirmed update cycle the app has ever had. The
one-time manual escape it required is recorded and is now spent: every browser
that reached this build carries the prompt, so no future deploy needs it.

### D-051 — The countdown fill keeps the hand colour, at 1.79:1, on purpose
**2026-08-16 · Decided — Anirudh, overriding one third of D-047**

D-047 turned the countdown fill near-black on white keys, reasoning that
`#4CC2FF` at 1.79:1 against `#F0F2F6` would be invisible. Seen in use, the
result read as a black bar and lost what the fill was for. Anirudh: *"I prefer
the old fill colour though the keyboard right now is better."*

A third option was drafted and rendered — the **hand colour darkened** until it
cleared 3:1, keeping hue while gaining contrast (6.03:1 for the right hand,
7.31:1 for the left, at 45% hue strength). It was **rejected on sight**. The
same thing happened to the ivory key face in D-047: the arithmetically
reasonable middle looked wrong, and looking wrong is a real result.

**Decided: the fill is the hand colour at alpha `88` on every key, white and
black.** On a white key that is **1.79:1**, below the 3:1 WCAG floor for a state
cue. This is a knowing exception, not an oversight, and it is recorded here so
that a future reader of D-047 does not "fix" it back. `T15a` adds a test pinning
the fill to the hand colour for the same reason.

**What the exception costs, stated honestly.** The fill is the imminence cue —
how soon a key is due. On a white key it will be a pale wash, and in a bright
room it will be close to unreadable, which is precisely the condition D-047 was
written for. **What limits the damage:** the cue is redundant. The falling note
above the key is in full hand colour against a near-black stage, the prepared
key keeps its hand-coloured border and inset glow, and the pressed state has its
own 2px ring at 16.89:1 that this decision does not touch. The fill was never
the only signal, which is why trading it is survivable where trading key
identification was not.

**The rest of D-047 is untouched and is where the value was**: identification
went 1.09:1 → 17.35:1, the labels clear 4.5:1, the error state clears 3:1, and
the black-key fill went `66` → `88`. One of three state changes is reversed; the
palette that fixed the real defect stands.

The generalisable point, and it is the same one D-047 already recorded: contrast
maths can prove a thing is *legible* and say nothing about whether it is *good*.
Where the two disagree and the product owner has seen both rendered, the eye
decides — and the number gets written down next to it so nobody has to rediscover
the trade.

---

## Open — must be resolved by the named task, not by improvisation

| # | Question | Resolved by |
|---|---|---|
| O-1 | Does Verovio's MIDI export preserve per-staff track/channel separation? If not, MusicXML needs its own parse path to keep staff→hand mapping. | `tasks/T00-spikes.md` S-2 |
| O-2 | Is Verovio's WASM payload justified against the offline budget, versus a lighter MusicXML parser? | `tasks/T00-spikes.md` S-2 |
| O-3 | Measured clock offset and jitter on the actual Roland RP302 in Chrome and Edge. PRD R6. | `tasks/T08-listen-grading.md` |
| O-4 | Real-world ±300ms tolerance suitability at 0.25×. PRD R5. | `tasks/T08-listen-grading.md` |
| O-6 | ~~Should hand colours be configurable?~~ **Closed by D-026** — yes, and the hand *mapping* with them. | Closed 2026-08-13 |
| O-8 | ~~Does piano-midi.de's licence permit redistribution?~~ **Closed by D-040** — yes. cc-by-sa Germany, attribution to Bernd Krueger, share-alike. Fetch from the **apex** domain; `www.` is dead. | Closed 2026-08-16 |
| O-10 | ~~Is the app permanently non-commercial?~~ **Closed by D-041** — yes, permanently. | Closed 2026-08-16 |
| O-9 | Is continuous play through a playlist wanted, and what happens to loop/speed at a piece boundary? | after T12a ships and is used |
| O-11 | Accounts + cross-device sync. Direction confirmed, deprioritised (D-043). Needs a PRD amendment from Anirudh before any task exists, plus answers on hosting cost, auth provider, and what merges when two devices disagree. | not scheduled |
| O-12 | ~~`#F0F2F6` or pure `#FFFFFF` for the white key face?~~ **Closed 2026-08-16** — `#F0F2F6`, option 4. Pure white was the alternative and was not chosen. | Closed 2026-08-16 |
| O-13 | ~~Which phone?~~ **Closed 2026-08-16** — iPhone 14 Pro Max, 932×430 in landscape. The fullscreen button will not render there (D-046); Add to Home Screen is the route, and the compact density is what actually has to work. | Closed 2026-08-16 |
| O-14 | Does Musopen carry symbolic scores (MIDI / LilyPond) for any of the 25 unsourced works, and under what licence? **Unverifiable from this machine** — 403 to every tool (D-048). Needs Anirudh's browser, like D-040. | Anirudh, then a future catalog task |
| O-5 | Per-asset redistribution licence for all 12 seed pieces. PRD R7 — **blocking for the MVP gate**. | `tasks/T03-catalog-home.md`, started day 1 |
