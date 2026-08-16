# T13b — The e2e suite is red; get it green and prove which failures were ours

**Depends on:** T13, T13a · **Decisions:** D-045

---

## Goal

`npm run test:e2e` currently reports **8 failed, 23 passed**, reproducibly. A red
suite is worse than a slow one: the next task cannot tell new breakage from old,
which is precisely how the two defects in D-044 and D-045 survived.

**Two of the eight are provably caused by T13.** They are not "unrelated
baseline failures" and must not be reported as such again.

## How to run it at all

Each spec calls vite's `build()` then `preview()` on **port 4181** in its own
`beforeAll`. So:

- **Nothing else may be listening on 4181.** A stray `vite dev` or `vite preview`
  makes specs fail with `Port 4181 is already in use` and 26 tests not run — a
  failure mode with nothing to do with the code. Check the port is free first.
- Harness pages (`src/testing/e2e/*-harness.html`) exist **only** in the builds
  that name them as extra rollup inputs (`home.e2e.ts`, `player.e2e.ts`,
  `00-player-performance.e2e.ts`). They are not in a plain `vite build`.

## The two that are ours — fix these

### 1. `home.e2e.ts:270` — hardcoded Chopin match count

```ts
await expect(results.getByRole("button")).toHaveCount(47);
```

The catalog now matches **51** pieces for "chopin". Exactly four of them are
T13's additions: Winter Wind, Ocean, Marche funèbre, Polonaise Op. 53.
47 + 4 = 51.

Note the same test derives its *other* numbers from the manifest at runtime
(`shippedManifest.length`), which is why those assertions still pass. **Do the
same here**: compute the expected count from `shippedManifest` rather than
hardcoding 51, so the next source addition does not re-break it.

### 2. `playlist.e2e.ts:62` and `:71` — stale playlist figures

```ts
await expect(homePlaylists.getByText("25 PIECES · 1H 29M")).toBeVisible();
await expect(page.getByText("39 more works from this playlist are not in the catalog yet.")).toBeVisible();
```

The playlist is now **38 pieces** and **26 missing**. Derive both from
`catalog/playlists.json` — it carries `entries.length` and `counts` precisely so
tests and UI never disagree. Do not hardcode 38 and 26.

## The other six — diagnose, do not dismiss

`home.e2e.ts:281`, `home.e2e.ts:547`, `player.e2e.ts:64`, `player.e2e.ts:172`,
`player.e2e.ts:274`, `player.e2e.ts:348`.

Several fail on `getByTestId('player-view')` never appearing, and one shows a
strict-mode violation where "Known timing fixture" matches two elements —
symptoms of harness or fixture problems, not obviously catalog data.

**For each of the six, establish and report which of these it is:**

1. **Caused by T13 or T13a** — fix it here.
2. **Genuinely pre-existing** — prove it by running that spec on the commit
   before T13 and reporting the result. A claim without that check is not
   evidence. If pre-existing, fix it here anyway unless it needs a product
   decision, in which case say what the decision is and stop.
3. **Environmental** — a port collision, a stale `dist`, a missing snapshot
   baseline. Say so and make the suite robust against it.

Do not close this task with any test still failing and no explanation.

## Acceptance criteria

1. `npm run test:e2e` reports **zero failures**, run with port 4181 free.
2. No count assertion anywhere in `src/testing/e2e/` is a hardcoded catalog- or
   playlist-derived number. Each is computed from `catalog/manifest.json` or
   `catalog/playlists.json`.
3. Adding a piece to the catalog does not break the suite. Prove it: add a
   throwaway row, run the suite, remove it. Report what you observed.
4. Each of the six unexplained failures is classified as caused / pre-existing /
   environmental, **with the evidence**, and fixed unless it needs a decision.
5. `npm run check` still passes.
6. No test is deleted, skipped, or weakened to make the suite green. If a test
   is genuinely wrong, say why in the report and in `docs/decisions.md`.

## Verify

```bash
npm run check
npm run test:e2e
```

## Traps

- **Making tests pass by loosening them is not fixing them.** Changing
  `toHaveCount(47)` to `not.toHaveCount(0)` destroys the assertion's value.
  Derive the real number.
- The suite takes about 3.2 minutes because every spec runs a full production
  build. That is slow, not broken — do not "optimise" it in this task.
- Do not touch `catalog/`, the manifest, or the licence records. This task fixes
  tests, not data.
