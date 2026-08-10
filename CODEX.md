# Running this build with Codex

The harness is designed for **one task per conversation**. Each run starts fresh,
reads `AGENTS.md` automatically, and is told exactly which task file to execute.
That is what keeps an eleven-task build from drifting.

Works the same way in the desktop app and the CLI — only the mechanics differ.

---

# Desktop app

## One-time setup

1. **Install Node.js** if you haven't (needed for `npm`). Check by opening a
   terminal and running `node --version`.
2. Open Codex and point it at this folder:
   `D:\Anirudh\Coding Projects\Codex\Learn the Piano`
3. In Codex's settings, set:
   - **Model:** the strongest coding model available to you. This build is
     spec-heavy and fidelity-sensitive; a faster/cheaper model will drift.
   - **Approval mode:** one that lets Codex **edit files and run terminal
     commands** without asking every time. Every task ends in a verification
     gate the agent has to actually run (`npm run check`). If it can't run
     commands, it will report work as done without verifying it.
4. Confirm it can see the harness — ask it:
   *"Read AGENTS.md and tasks/README.md, then tell me the task order and the
   first three hard rules. Don't write any code."*
   If it answers correctly, the harness is wired up.

## The loop

For each task, in the order below:

1. **Start a new conversation.** Do not continue the previous task's thread —
   stale context is how a build starts inventing components nobody asked for.
2. Paste that task's prompt (they're listed below).
3. Let it work. Review the diff it shows you before accepting.
4. Ask it to run `npm run check` if it hasn't, and read the output yourself.
5. Only then move to the next task.

## The prompts, in order

Paste one per conversation. Nothing else needed — `AGENTS.md` carries the rules.

```
Execute tasks/T01-foundation.md. Follow AGENTS.md exactly. Stop when the task's Done checklist is complete, and report against each acceptance criterion individually.
```

Then the same sentence with each of these, in this order:

| # | File | What it delivers |
|---|---|---|
| 1 | `tasks/T01-foundation.md` | Project scaffold, tokens, fonts, routes |
| 2 | `tasks/T00-spikes.md` | Three de-risking spikes |
| 3 | `tasks/T02-music-model.md` | MIDI/MusicXML import |
| 4 | `tasks/T04-playback-engine.md` | Playback engine + audio |
| 5 | `tasks/T05-visualization.md` | Waterfall + keyboard |
| 6 | `tasks/T06-transport.md` | Play, speed, scrub, A–B loop |
| 7 | `tasks/T03-catalog-home.md` | Catalog, library, Home — **MVP done** |
| 8 | `tasks/T07-highlighting.md` | Anticipatory key highlighting |
| 9 | `tasks/T08-listen-grading.md` | Web MIDI + grading |
| 10 | `tasks/T09-reports.md` | Report + attempt history |
| 11 | `tasks/T10-offline-deploy.md` | Offline + deployment |

The numbering is deliberate: T01 runs before T00 because the spikes need a
bundler, and T03 runs after T06 because its criteria need a working player.

## Before you accept a task

1. `npm run check` is green.
2. Open the test files and confirm the acceptance criteria are really asserted.
   Don't take the summary's word for it.
3. For a visual task, open the app at 1440×900 and 1024×768 and walk that
   screen's states from `docs/design-contract.md` §3.
4. For a visual task, open the prototype side by side. In a terminal, from
   `design_handoff_piano_practice_player`:
   ```bash
   python -m http.server 8000
   ```
   then load `http://localhost:8000/Piano%20Practice%20Player.dc.html`.
   (`npx serve` works if you don't have Python.)
5. Check that `src/design/tokens.ts` wasn't modified — it's authoritative and
   pre-seeded. If it changed, reject the task.

## When a task fails

Don't say "try again". Say what failed and point at the source:

```
In tasks/T05-visualization.md, acceptance criterion 4 fails: the visible note set differs between 1x and 0.25x. docs/algorithms.md §3 says pps must never depend on speed. Find where speed leaks into the pixel mapping and fix it.
```

If it's failing because the spec is ambiguous, fix the spec first — edit the task
file or add a `docs/decisions.md` entry — then re-run. An agent guessing at an
ambiguity produces work that looks finished and isn't.

## Two things Codex can't do for you

- **The licence audit** (T03). Twelve pieces each need a verified source URL,
  licence URL and checksum, per asset. This is research, not code. Start it now,
  in parallel — it's the only genuinely blocking item.
- **Spike S-3** (T00) needs the Roland RP302 plugged in, in Chrome and Edge. If
  you can't run it, the task tells Codex to mark it BLOCKED and carry on with a
  documented default.

---

# CLI (alternative)

```bash
npm install -g @openai/codex
codex login
```

Copy the profile in `.codex/config.toml` into `~/.codex/config.toml`, then run
one task per invocation:

```bash
codex --profile piano "Execute tasks/T01-foundation.md. Follow AGENTS.md exactly."
```

`codex exec --profile piano "..."` runs unattended. The `.codex/config.toml`
profile is **CLI-only** — the desktop app uses its own settings UI.

---

# Guardrails that run without you

`npm run check:guardrails` machine-checks the hard rules from `AGENTS.md`: no
prototype runtime imports, no `simulate:` scaffolding, no raw colours outside
`src/design/`, no banned dependencies (in imports *or* `package.json`), no
nondeterminism in the grader, no ASCII `#` in key labels, and no drift in the
pinned token values (lookahead 3, lead 1.0, 26 buckets, 52/36 keys, 300 ms
tolerance, 21–108 range).

It's wired into `npm run check`, so every task gate runs it. It's deliberately
narrow — every rule enforces something that produced a real defect in review, not
a style preference.
