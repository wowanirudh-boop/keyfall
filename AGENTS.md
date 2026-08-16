# AGENTS.md — Piano Practice Player

You are building a local-first web app that replaces YouTube piano tutorials with
a falling-notes practice player. Read this file fully before your first edit.

## Truth hierarchy

When two sources disagree, the higher one wins. Never resolve a conflict by
guessing — stop and say which two sources conflict.

1. `PRD.md` — what the product must do (v1.0, frozen)
2. `design_handoff_piano_practice_player/` — how it
   must look and behave. `README.md` in that folder is the per-screen spec;
   `Piano Practice Player.dc.html` is the working prototype.
3. `docs/decisions.md` — binding decisions, including every permitted deviation
4. `docs/algorithms.md` — the prototype's algorithms, already transcribed
5. `docs/design-contract.md` — component map, state inventory, fidelity gate
6. `BUILD_PLAN.md` — build order and scope
7. `tasks/*.md` — the unit of work you are executing

## Hard rules

These are not preferences. Violating one is a failed task.

1. **Never modify** `PRD.md` or anything under `design_handoff_piano_practice_player/`.
   They are read-only reference.
2. **Never import the prototype runtime.** No `support.js`, `DCLogic`, `x-dc`,
   `sc-for`, `data-dc-script`. Read the prototype; write idiomatic React.
3. **Never ship prototype scaffolding**: the bottom "STATES" strip, its
   `padding-bottom: 42px`, any `simulate:` button, the fake `CATALOG` array, the
   hash-based `judge()` grading, the hardcoded 7 extra notes.
4. **All colours come from `src/design/tokens.ts`.** It is the single source;
   T01 ports it into Tailwind's `@theme` block, which generates the utilities and
   CSS variables components actually use (`bg-card`, `text-hand-right`,
   `var(--color-hand-right)`) — D-014. Banned outside `src/design/`: raw hex,
   `rgb()`, **and Tailwind arbitrary colour values like `bg-[#101216]`**, which
   are the same violation in different syntax (D-015). `tokens.ts` is pre-seeded
   and authoritative — do not add, rename or "improve" its entries. A colour
   missing there is missing from the design; stop and ask.
   **Sizes are different:** `space` and `type` are reference scales, not
   allowlists. Where the handoff states an exact value for a specific element
   (`7px 11px` on the toggle pill, `40px 32px 120px` on the Home page), use it
   literally — that is the design (D-013).
5. **Never invent product behaviour.** If the PRD and handoff do not define a
   state, it does not exist. Proposing one means adding a `docs/decisions.md`
   entry first.
6. **No new dependencies** beyond the approved list in `BUILD_PLAN.md`
   §Dependencies without a decision entry. Specifically: no icon library, no
   state management library, no charting library, no CSS-in-JS. **Tailwind 4
   stays** (D-015). Glyphs are text characters (`▶ ❙❙ ← → ♯ ·`); the **user
   interface contains no image or SVG assets**. One carve-out, and only one:
   the PWA install icons under `public/icons/` (D-035). They are OS packaging,
   never rendered by the app, and `check:guardrails` enforces that nothing
   under `src/` imports them.
   **Vinext, Next and React Server Components are removed** (D-001) — do not
   reintroduce them, and do not add `'use server'` or `next/*` imports.
7. **No backend.** No API routes, database, secrets, telemetry or external
   search service. The catalog is bundled.
8. **Determinism in the grader.** No `Math.random()` and no clock reads inside
   `src/grading/` — the grader is a pure function of its event log, and the
   guardrail enforces it. Report *aggregation* must be pure for the same reason,
   but `src/report/` also formats the attempt history's relative dates, which
   legitimately reads the clock; keep that in a helper that takes `now` as an
   argument.
9. Sharps render as **U+266F (`♯`)**, never ASCII `#`.
10. Ask before deleting or rewriting a file you did not create in this task.

## Working protocol

Execute **one task file at a time**, in dependency order. For each:

1. Read the task file, then re-read the handoff README section it names.
2. Restate the acceptance criteria in your own words before coding. If any
   criterion is ambiguous, stop and ask — do not pick an interpretation.
3. Implement, writing tests alongside (not after).
4. Run the task's verification commands. All must pass.
5. Walk the task's Done checklist explicitly, item by item.
6. Report: what you built, what you verified, anything you could not resolve.

Do not start the next task in the same run. Do not batch tasks.

## Commands

```bash
npm install
npm run dev                 # local dev server
npm run build               # production build
npm run preview             # serve the production build (offline/SW checks)
npm test                    # unit + component tests
npm run test:e2e            # Playwright
npm run check:types         # tsc --noEmit
npm run lint                # eslint
npm run check:guardrails    # repo rules above, machine-checked
npm run check               # types + lint + guardrails + unit tests — the gate
```

`npm run check` must pass before any task is reported complete.

## Definition of done (every task)

- [ ] `npm run check` passes. Two exceptions, both stated in the task files:
      T01 creates the project that makes `check` runnable, and T00's spike code
      is throwaway and not held to the production guardrails.
- [ ] **`npm run test:e2e` passes too, whenever the task changes catalog data,
      routes, or anything a screen renders.** `check` runs types, lint,
      guardrails and *unit* tests only — it does not run Playwright, so a green
      `check` says nothing about the end-to-end suite. Several e2e tests assert
      **hardcoded counts** derived from the catalog (matches for a search term,
      pieces in a playlist), and adding pieces silently invalidates them.
      Run it with **nothing else listening on port 4181** — each spec builds and
      serves its own preview there, so a stray `vite dev` or `vite preview`
      makes the whole suite fail in ways that have nothing to do with the code.
- [ ] **A failing test is yours until proven otherwise.** Do not report a
      failure as "pre-existing", "unrelated" or "out of scope" without evidence:
      check the failing assertion against what the task changed, and if still
      unsure, run the same spec on the previous commit and say so. Two failures
      have already been mislabelled this way (D-045); both were caused by the
      task reporting them.
- [ ] New behaviour has tests; every acceptance criterion in the task file maps
      to at least one assertion
- [ ] **If the task touches a screen:** every state listed for that screen in
      `docs/design-contract.md` §3 renders correctly at 1440×900 **and**
      1024×768, with no horizontal page scroll and the player at viewport height
- [ ] No TODO, stub, placeholder copy or commented-out code left behind
- [ ] Any deviation from the handoff has a `docs/decisions.md` entry

## Traps specific to this codebase

- **The waterfall must render a time window, not the whole piece.** The
  prototype lays out every note; that fails at the 30-minute limit. Keep the
  single-`translateY` layer, window the contents. `docs/algorithms.md` §3, D-002.
- **Web MIDI and Tone.js live in different clock domains.** Converting them is
  not optional; skipping it biases every graded note by 20–150 ms and reads as
  "everything late". §11, D-005.
- **Grading is two passes.** Live flash is provisional; the report is computed
  offline from the event log and always wins. §10, D-003.
- **Buckets divide the full piece duration**, not the played range. **Extra
  notes never enter the `expected` denominator.** §9.
- **Lookahead and highlight lead are in musical time**, so wall-clock preview
  grows as speed drops. `pps` never depends on speed.
- **A–B marker rules are asymmetric on purpose** (setA clears B, setB swaps).
  Transcribe them; do not normalize them. §6.
- **Hand assignment differs by source format** — MusicXML uses staves, MIDI uses
  two-track median pitch. Do not let one silently stand in for the other.
- Notes must stay **sorted by start time**; the per-frame scan breaks otherwise.

## Reporting

Be concrete. "Implemented the seek bar" is not a report. Say what you built,
which acceptance criteria you verified and how, what the test output was, and
what you are unsure about. If you could not satisfy a criterion, say so plainly
rather than narrowing it until it passes.
