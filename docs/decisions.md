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
**2026-08-10 · Decided — supersedes the prototype's approach**

See `docs/algorithms.md` §3. The prototype's full-piece static layer is correct
for its ~200-note demo and fails at the PRD's 30-minute upload limit
(10,000–16,000 glowing absolutely-positioned divs in a ~350,000px layer under
`will-change: transform`). The single-`translateY` technique and every per-note
style are kept; only the population strategy changes to a windowed slice.

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

---

## Open — must be resolved by the named task, not by improvisation

| # | Question | Resolved by |
|---|---|---|
| O-1 | Does Verovio's MIDI export preserve per-staff track/channel separation? If not, MusicXML needs its own parse path to keep staff→hand mapping. | `tasks/T00-spikes.md` S-2 |
| O-2 | Is Verovio's WASM payload justified against the offline budget, versus a lighter MusicXML parser? | `tasks/T00-spikes.md` S-2 |
| O-3 | Measured clock offset and jitter on the actual Roland RP302 in Chrome and Edge. PRD R6. | `tasks/T08-listen-grading.md` |
| O-4 | Real-world ±300ms tolerance suitability at 0.25×. PRD R5. | `tasks/T08-listen-grading.md` |
| O-5 | Per-asset redistribution licence for all 12 seed pieces. PRD R7 — **blocking for the MVP gate**. | `tasks/T03-catalog-home.md`, started day 1 |
