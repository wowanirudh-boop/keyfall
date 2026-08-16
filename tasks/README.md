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

## Post-MVP work (v1.1)

Written after the MVP shipped and was used. Run in this order; all are independent
of T08–T10.

| Order | Task | Fixes |
|---|---|---|
| A | [T04a](T04a-velocity-fix.md) ✅ | Audio 42 dB too quiet |
| B | [T03a](T03a-secure-context-fix.md) ✅ | Catalog dead off localhost |
| C | [T03c](T03c-lazy-catalog-validation.md) ✅ | Every score downloaded at startup |
| D | [T05b](T05b-upload-entry-point.md) ✅ | Upload unreachable without a failed search |
| E | [T05a](T05a-volume-control.md) ✅ | No volume control |
| F | [T03b](T03b-catalog-expansion.md) ✅ | 12 pieces → 460 |
| G | [T03d](T03d-catalog-quality.md) | Search broken by junk aliases; BWV 846 missing; composer names unnormalised; no browse |
| H | [T07a](T07a-countdown-fill.md) | Prepared keys give no order — the biggest comprehension failure |
| I | [T05c](T05c-chrome-cleanup.md) | Attribution off Home, header jargon, transport hints |
| J | [T13b](T13b-e2e-baseline-repair.md) | Six unclassified e2e failures; `npm run check` never ran Playwright |
| K | [T14](T14-player-landscape-fit.md) | Phone held sideways: a scroll to nowhere, and 5–29% of the screen for the falling notes |
| L | [T15](T15-keyboard-contrast.md) | White key vs black key is 1.09:1 — the keyboard is one colour |

T14 depends on T13b, so that a failing e2e test found during T14 can be trusted
to belong to T14. **T15 depends on nothing** and can run at any point, including
alongside T14 — they share no files beyond `PianoKeyboard.tsx`, where T14 touches
only the container's height and T15 only the keys' colours. Run them in separate
conversations regardless, per the one-task-one-run rule.

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
