# T03e — Catalog metadata corrections

**Depends on:** nothing · **PRD:** F2 (catalog quality) · **Decisions:** D-038

---

## Goal

Two mislabelled catalog entries, found while resolving the seed playlist.
Neither is a playlist bug — they mislead catalog **search** for every user,
playlist or not. This task is independent of T12a and can run before or after it.

## 1. ~~Correct the four `verify` rows in the seed TSV~~ — moved to T12a

**Moved 2026-08-16.** This was T03e's first deliverable and now lives in
**T12a §0**, because the corrected TSV is T12a's direct input and having two
tasks edit the same four lines invites a merge conflict. Do not touch
`catalog/playlists/rousseau-classical.tsv` in this task.

## 2. Fix two mislabelled catalog entries

Both entries claim far more than the file contains, so search offers the wrong
thing and the piece is not what the title promises.

- **`sonate-2-b-moll`** — titled "Sonate 2 b-moll", 82s. Its source is
  `ChopinFF/O35/chp-op-35-4-scholz-fi/`: the **finale only**, not the sonata.
- **`pictures-at-an-exhibition`** — 237s against a suite that runs ~33 minutes.
  Establish from its `sourceUrl` what it actually contains (most likely
  Promenade, or a single movement).

Retitle both to name what is really in the file. **Derive the correction from
the source URL and the file itself, not from the existing title** — that is the
mistake being fixed. Prefer a title format already used elsewhere in the
manifest rather than inventing one.

Then check whether this class of defect is broader: report how many manifest
rows have a `durationSeconds` implausible for the work their title names. Do
not fix those in this task — just report the count and the ten worst.

**Where the fix belongs.** If titles are derived in `scripts/build-catalog.mjs`
from Mutopia metadata, a hand-edit will be overwritten on the next build. Find
the generating path first and put the correction where it survives a rebuild —
an override map keyed by id is fine; say which you chose and why in the report.

## Acceptance criteria

1. `catalog/playlists/rousseau-classical.tsv` is **unchanged** by this task.
2. Both mislabelled entries are retitled, and the correction survives a full
   `npm run build:catalog` (or whatever the catalog build script is called).
3. Searching the app for "Pictures at an Exhibition" and for the Chopin sonata
   returns a title that honestly describes the audio that plays.
4. The report gives the implausible-duration count and the ten worst rows.
5. `catalog/LICENCES.md` and the row count are unchanged — this task retitles,
   it does not add or drop pieces.

## Verify

```bash
npm run check
npm run build && npm run preview
```

Then search both titles in the running app and play each one.

## Done

- [ ] Two retitles survive a catalog rebuild
- [ ] Implausible-duration audit reported
- [ ] Any deviation from D-038 gets its own decision entry

## Traps

- Derive each correction from `licence.sourceUrl` and the file itself, never
  from the existing title. Trusting the title is the bug being fixed.
- Do not touch `catalog/playlists/*.tsv`, `catalog/playlists.json`, or any
  playlist code. All of that belongs to T12a.
