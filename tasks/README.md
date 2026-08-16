# Tasks

One file per unit of work. Execute **one at a time, in order**. Do not batch.

| Order | Task | Depends on | Delivers | PRD |
|---|---|---|---|---|
| 1 | [T01](T01-foundation.md) | — | Tokens, fonts, routes, shell | — |
| 2 | [T00](T00-spikes.md) | T01 | Three de-risking spikes | — |
| 3 | [T02](T02-music-model.md) | T00 (S-2) | Import pipeline, canonical note model | F2 |
| 4 | [T04](T04-playback-engine.md) | T02 | Playback engine, audio | F3, F4 |
| 5 | [T05](T05-visualization.md) | T02, T04, S-1 | Waterfall, keyboard | F3 |
| 6 | [T06](T06-transport.md) | T04, T05 | Transport, loop | F4 |
| 7 | [T03](T03-catalog-home.md) | T02, T06 | Catalog, library, Home — **🚦 MVP gate** | F1, F2 |
| 8 | [T07](T07-highlighting.md) | MVP gate | Anticipatory highlighting | F5 |
| 9 | [T08](T08-listen-grading.md) | T07, S-3 | Web MIDI, grading | F6 |
| 10 | [T09](T09-reports.md) | T08 | Report, history | F6 |
| 11 | [T10](T10-offline-deploy.md) | T09 | Service worker, deployment | §9 |

## Post-MVP work (v1.1) — status board

Written after the MVP shipped and was used. **Keep this table current when a task
is reported complete** — it went stale for a dozen tasks once and the cost was
having to re-derive what was done from the decision log.

### Done

| Task | Fixed |
|---|---|
| [T04a](T04a-velocity-fix.md) ✅ | Audio 42 dB too quiet |
| [T03a](T03a-secure-context-fix.md) ✅ | Catalog dead off localhost |
| [T03c](T03c-lazy-catalog-validation.md) ✅ | Every score downloaded at startup |
| [T05b](T05b-upload-entry-point.md) ✅ | Upload unreachable without a failed search |
| [T05a](T05a-volume-control.md) ✅ | No volume control |
| [T03b](T03b-catalog-expansion.md) ✅ | 12 pieces → 460 |
| [T03d](T03d-catalog-quality.md) ✅ | Junk aliases, missing BWV 846, no browse |
| [T07a](T07a-countdown-fill.md) ✅ | Prepared keys gave no order |
| [T05c](T05c-chrome-cleanup.md) ✅ | Attribution off Home, header jargon |
| T11 ✅ | Mobile audio, hand colours, sorting, Home |
| [T12a](T12a-seed-playlist.md) ✅ | Shipped read-only "Classical Rousseau" playlist |
| [T13](T13-catalog-second-source.md) ✅ | piano-midi.de as a second source; 596 → 609 pieces |
| [T13a](T13a-source-attribution-fix.md) ✅ | Player credited every piece to Mutopia |
| [T13b](T13b-e2e-baseline-repair.md) ✅ | 8 red e2e tests; `npm run check` never ran Playwright |
| [T03e](T03e-catalog-metadata-fixes.md) ✅ | Two rows claiming far more than their file held |
| [T15](T15-keyboard-contrast.md) ✅ | White vs black key was 1.09:1; now 17.35:1 (D-047) |

[T12](T12-playlists.md) is a stub: it was split into T12a and T12b.

### Ready to run

| Task | Why |
|---|---|
| [T10a](T10a-update-prompt.md) | **Do this first.** No deploy has reached a returning browser since T10 — the update prompt was configured and never built (D-050) |
| [T03f](T03f-archive-member-titles.md) | 22 rows name a work but hold one movement; one names the wrong movement entirely |
| [T14](T14-player-landscape-fit.md) | Landscape phone: a scroll to nowhere, 5–29% of the screen for the notes |
| [T12b](T12b-user-playlists.md) | Playlists the user makes. Carries the Dexie v1→v2 migration — the riskiest change left |

T14's dependency on T13b is **satisfied**. T15 shares only `PianoKeyboard.tsx`
with T14, where T14 touches the container height and T15 the key colours — still
run them in separate conversations, per the one-task-one-run rule.

### Blocked on Anirudh

| Task | Needs |
|---|---|
| The 25 unsourced playlist works | O-14 — Musopen returns 403 to every tool here. Needs a human browser to say whether it carries MIDI or LilyPond, and under what licence (D-048) |
| T15 follow-up *(only if the phone disagrees)* | O-12 was closed to `#F0F2F6` during the T15 run. If a side-by-side on the phone at night favours pure `#FFFFFF`, it is a one-token change — but the value shipped is the lower-glare of the two |

### Blocked on hardware

[T08](T08-listen-grading.md) and [T09](T09-reports.md) both wait on the Roland
RP302 — O-3 and O-4 need measurements from the actual instrument.

**T03 moved after T06.** Its acceptance criteria ("opening a piece lands on the
player paused at 0:00", "reopens and plays without re-parsing") need a working
player, so it cannot precede one. The MVP gate now sits at the end of T03, where
the full loop — find → open → play → slow → scrub → loop → reopen tomorrow —
first exists.

Everything is a chain. If two agents are available, the only safe parallelism is
T04 alongside T05's geometry work, and both must reconverge before T06.

**Off the critical path but blocking the MVP gate:** the seed catalog licence
audit (T03, PRD R7). It is slow, non-engineering work — start it on day 1.

## Before starting any task

Read, in this order: `AGENTS.md` → the task file → the handoff README section the
task names → `docs/algorithms.md` for any section the task cites.

## Reporting a task complete

State what you built, which acceptance criteria you verified and how, the test
output, and anything unresolved. A criterion you could not satisfy is reported as
unsatisfied — never narrowed until it passes.
