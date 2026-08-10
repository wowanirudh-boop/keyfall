# T01 — Convert the repo and build the design foundation

**Depends on:** nothing — this runs **first**. The spikes (T00) need the test
runner this task sets up.
**Handoff sections:** README §Design Tokens, §Assets, §1 header row
**Decisions:** D-001 (stack), D-013 (sizes), D-014 (`@theme`), D-015 (Tailwind)

---

## Goal

Turn the rejected Keyfall prototype into a clean Vite + React SPA with the design
system wired and three routes. No feature logic.

## Starting point

This repo currently contains a **rejected prototype**: `keyfall-piano-prototype`,
Vinext `1.0.0-beta.2` with React Server Components, the entire UI in a 449-line
`app/page.tsx`, and one rendered-HTML test. Its palette (cream `#f3f0e7`, coral
`#f25f4c`) does not match the design handoff — that is why it was rejected.

Read `docs/decisions.md` D-001 before touching anything.

## Part 1 — Convert the toolchain

**Keep:** Vite, React 19, TypeScript, Tailwind 4 (`tailwindcss` +
`@tailwindcss/postcss`), Wrangler + `@cloudflare/vite-plugin`,
`@vitejs/plugin-react`, ESLint, `.gitignore`.

**Remove:** `vinext`, `@vitejs/plugin-rsc`, `react-server-dom-webpack`,
`@next/eslint-plugin-next`, `next.config.ts`, `next-env.d.ts`, and the generated
`.next/` `.vinext/` `dist/` `build/` directories. The app becomes a plain Vite
SPA with a client entry (`index.html` + `src/main.tsx`).

**Delete outright:**
- `app/page.tsx`, `app/layout.tsx` — the rejected prototype UI
- `tests/rendered-html.test.mjs` — it tests that UI
- `worker/index.ts` and the empty `db/` and `drizzle/` folders — the PRD forbids
  a backend (AGENTS.md #7)
- `app/globals.css` moves to `src/design/globals.css`; keep only its
  `@import "tailwindcss"` line and the box-sizing/margin reset. **The `:root`
  palette in it (`--paper`, `--coral`, `--navy`, …) is the rejected design —
  delete every one of those variables.**

**Rename:** package name `keyfall-piano-prototype` → `piano-practice-player`.

**Git:** the repo was created by a Codex sandbox user, so git commands fail until
you run, once:
```bash
git config --global --add safe.directory "D:/Anirudh/Coding Projects/Codex/Learn the Piano"
```
Commit the conversion as one commit before starting Part 2, so the prototype
removal is reviewable on its own.

## Part 2 — Design foundation

- Directory skeleton exactly as `BUILD_PLAN.md` §Repository layout (an empty
  `index.ts` per folder is fine). The guardrail's grader scope is path-based, so
  the layout is load-bearing, not cosmetic.
- `src/design/tokens.ts` — **already exists and is authoritative. Do not edit it.**
- `src/design/globals.css` — port every token from `tokens.ts` into a Tailwind 4
  **`@theme` block** (D-014), so utilities and CSS variables generate from the
  same values: `--color-hand-right`, `--color-card`, `--radius-card`, and so on.
  `tokens.ts` stays the definition site and the thing tests assert against;
  `@theme` is derived from it and must not drift.
- Self-hosted **Space Grotesk** (400/500/700) and **IBM Plex Mono** (400/500) as
  woff2 under `src/assets/fonts/`, loaded via `@font-face` with
  `font-display: swap`. The handoff loads these from Google Fonts; the app must
  not, because the player has to work offline.
- Base styles: `background: color.bg`, `color: color.text`,
  `-webkit-font-smoothing: antialiased`, default UI font Space Grotesk.
- Routes via `react-router-dom`: `/`, `/pieces/:pieceId`, `/reports/:attemptId`,
  plus a not-found route. Deep links must resolve (SPA fallback — configure now,
  verify in T10).
- `AppHeader` per §1: 10px cyan dot (`color.handRight`, 50% radius) + wordmark
  "Piano Practice Player" at 19px/700, letter-spacing -0.01em; right side mono
  11px `color.monoDim1`, letter-spacing 0.06em, "LOCAL LIBRARY · NO ACCOUNT".
- Shared primitives **as stubs with real styling**, no consumers yet:
  `GhostButton`, `TogglePill`, `StatusBanner`, `MonoLabel`, `ErrorPanel`, `Modal`.
- npm scripts per `AGENTS.md` §Commands, including `check:guardrails` →
  `node scripts/check-guardrails.mjs` and `preview` (T10 verifies offline
  behaviour against the production build; the dev server bypasses the service
  worker).
- Vitest + Testing Library + Playwright configured and green on a smoke test.

## Acceptance criteria

1. `npm run check` passes after a clean `npm install`.
2. `npm run build` produces a static SPA. No `vinext`, `@vitejs/plugin-rsc`,
   `react-server-dom-webpack`, `next.config.ts` or `next-env.d.ts` remain, and
   nothing imports `next/*` or declares `'use server'`.
3. Both font families render from local files with the network blocked
   (DevTools → Network → Offline, hard reload).
4. Every route renders its placeholder; an unknown route renders not-found; a
   direct deep link to `/pieces/anything` does not 404 in dev.
5. `GhostButton` and `TogglePill` match §4's ghost button and toggle pill styles
   (border `color.border3`, 12px, `color.secondary`; toggle "on" = accent border,
   `accent + alpha.toggleOnBg` background, accent text).
6. **Every `@theme` value matches `tokens.ts`.** Write a test that imports
   `tokens.ts`, parses `globals.css`, and asserts the two agree — this is the
   only thing preventing silent drift between the two representations.
7. No raw hex, `rgb()`, or Tailwind arbitrary colour (`bg-[#…]`) outside
   `src/design/`. A component using `bg-card` or `var(--color-card)` passes.
8. The prototype's rejected palette (`--paper`, `--paper-deep`, `--ink`,
   `--muted`, `--coral`, `--cyan`, `--navy`) appears nowhere.
9. "Keyfall" appears nowhere under `src/`, in `package.json`, or in shipped
   output. (It stays in `BUILD_PLAN.md` and `docs/decisions.md` as the record of
   what was replaced — that is deliberate.)
10. `git status` is clean after a build; `dist/`, `.next/`, `.vinext/`,
    `node_modules/` ignored.

## Verify

```bash
npm install
npm run check
npm run build
npm run dev     # then: offline reload, check both fonts + all three routes
```

## Done

- [ ] Ten criteria asserted, 6 explicitly (it is the anti-drift test)
- [ ] Conversion committed separately from the new foundation
- [ ] `src/design/tokens.ts` unmodified
- [ ] `PRD.md` and `design_handoff_piano_practice_player/` unmodified
- [ ] Prototype UI, its test, and the worker are gone

## Traps

- Tailwind **stays** — it is the token delivery mechanism (D-015). What is banned
  is arbitrary colour values (`bg-[#101216]`), which are raw hex in disguise.
- Arbitrary values for *sizes* the handoff specifies (`p-[7px_11px]`) are correct
  and expected — the handoff's per-element values beat any scale (D-013).
- Do not keep any part of the prototype's visual language. Same repo, same
  toolchain, entirely different design.
- Do not create primitives speculatively — the handoff names six; stub only
  those, and wire them when a real screen needs them.
- The wordmark is text, not a logo asset. This product ships zero image assets.
