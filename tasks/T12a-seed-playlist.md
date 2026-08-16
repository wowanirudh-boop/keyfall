# T12a — The shipped playlist (read-only)

**Depends on:** T11 · **PRD:** F1 (piece selection) · **Decisions:** D-032, D-038, D-042

---

## Goal

"Classical Rousseau" ships with the app: an ordered, read-only list built at
build time from `catalog/playlists/rousseau-classical.tsv`, so the learner stops
re-finding the same pieces in a 596-row catalog every evening.

**This task changes no database schema.** There is a real library on the user's
iPad; the Dexie v1→v2 upgrade that user-made playlists need is deliberately kept
out of the critical path and lives in T12b. If you find yourself opening
`PianoDatabase`, stop — you are in the wrong task.

## The shape, decided

Read D-032 first. Three things it pins down: a playlist is an ordered list of
**references**, not a container of scores; an entry may point at a piece the
learner has never opened, and opening it runs the existing import-and-save path;
the shipped playlist is **read-only**.

The UI shape was chosen from `docs/mockups/playlist-options.html` and approved
2026-08-16 (D-042). Build **A1 + B1 + C2**:

- **A1** — a "Playlists" section on Home, and the playlist opens as its own page.
- **B1** — no play-through. The player is **not touched by this task**: no
  next/previous, no auto-advance, no playlist context threaded into the route.
- **C2** — show the 25 playable rows, then one honest line naming what is absent.

## Deliverables

### 0. First — apply D-038's four TSV corrections

`catalog/playlists/rousseau-classical.tsv` still carries four `verify` rows.
D-038 resolved all four from the Mutopia paths in each row's
`licence.sourceUrl`. This was originally T03e's first deliverable and has been
**moved here**, because it is this task's input and splitting it across two
tasks invites a merge conflict. Change only the status column and the note:

| Line | Work | Set status to | Because |
|---|---|---|---|
| 70 | Étude Op. 10 No. 1 ('Waterfall') | `have` | `etude-c-dur` → `O10/chp-10-01/` |
| 77 | Étude Op. 10 No. 12 ('Revolutionary') | `have` | `etude-c-moll` → `O10/op-10-12-wfi/` |
| 61 | Étude Op. 25 No. 12 ('Ocean') | `missing` | that id is Op. 10 No. 12; clear `catalog_id` |
| 67 | Marche funèbre (Sonata No. 2, 3rd mvt) | `missing` | `sonate-2-b-moll` is the **4th** movement; clear `catalog_id` |

Rewrite each note to state the evidence rather than the doubt. Afterwards the
file has **zero** `verify` rows: 26 `have`, 39 `missing`, 7 `excluded`, and 25
distinct catalog ids once Clair de Lune is deduplicated.

Do not re-derive this by ear or from durations. The evidence is
`licence.sourceUrl` in `manifest.json`, and it is already read.

### 1. Build — `scripts/build-catalog.mjs` emits `catalog/playlists.json`

Every `.tsv` in `catalog/playlists/` becomes one playlist. Parsing rules:

- Columns are `status`, `composer`, `work`, `catalog_id`, `note`, tab-separated.
  Lines starting with `#` are comments; the first non-comment line is a header.
- **Trailing empty columns may be absent** — a row with no note ends after
  `catalog_id`. Pad to five fields; do not index blindly.
- `have` rows contribute their `catalog_id`, **in file order, deduplicated by
  id, first occurrence wins**. Clair de Lune genuinely appears at positions 9
  and 69; the TSV keeps both as a faithful capture and the emitted playlist
  holds one entry.
- `missing` and `excluded` rows contribute no entry, but they **do** contribute
  to the counts below.
- **Fail the build** if a `have` row names a `catalog_id` absent from
  `manifest.json`. A seed entry pointing at a piece that does not ship is a dead
  row in the UI.
- **Fail the build** if any row still has status `verify`. T03e removes the last
  four; a new one appearing means someone added an unresolved row.

Emitted shape — carry the counts, because the UI states them (C2) and they must
shrink automatically when T13 lands more pieces:

```json
{
  "playlists": [{
    "id": "rousseau-classical",
    "name": "Classical Rousseau",
    "entries": [{ "ref": "ballade-number-4", "kind": "catalog" }],
    "counts": { "resolved": 25, "missing": 39, "excluded": 7 },
    "missingComposers": ["Liszt", "Ravel", "Vivaldi", "Beethoven"]
  }]
}
```

`name` comes from the file, not from code — add a `# name:` directive to the
TSV header block and parse it; fall back to the filename.

**`missingComposers` — derived, and not by raw missing count.** Counting missing
rows alone puts Chopin first (10 missing), and Chopin is the *best*-served
composer in this playlist with 11 playable pieces. Naming him as a gap would be
false. The line means "composers you largely cannot play", so:

1. **Eligible:** composers where `missing > playable` — more of their listed
   works are absent than present.
2. **Sort:** `missing` descending, then `playable` ascending, then surname
   alphabetically. The last two keys exist so ties are deterministic; four
   composers currently tie at 3 missing, and an unstable order would churn the
   generated JSON on every build.
3. **Take** the first four. Fewer than four eligible is fine — emit what there is.

Against the corrected TSV that yields `["Liszt", "Ravel", "Vivaldi",
"Beethoven"]`: Liszt 6 missing / 1 playable, Ravel and Vivaldi 3 / 0, Beethoven
3 / 2. Chopin (10 / 11) and Debussy (3 / 3) are correctly excluded.

Assert this exact array in a test. It is the one output where a plausible-looking
wrong answer would ship silently. Nothing in this list is hand-written in a `.tsx`.

Record resolved / missing / excluded per file in `catalog/BUILD_LOG.md`.

The `.tsv` files are build **input**. `vite.config.ts`'s `catalogStaticAsset`
plugin copies `catalog/` into `dist/`; exclude `catalog/playlists/*.tsv` from
that copy so only the generated JSON ships.

### 2. Loading — `src/catalog/`

Load and validate `playlists.json` exactly the way `manifest.json` is loaded and
validated today, including the lazy-validation approach from T03c. **A malformed
or missing `playlists.json` must not take Home down** — the Playlists section
disappears, everything else works, same posture as `CatalogUnavailableBanner`.

An entry whose `ref` is not in the loaded manifest is dropped at load with a
console warning, not rendered as a broken row. The build already prevents this;
this is the belt to the build's braces.

### 3. Home — the Playlists section

Between the Continue card and My pieces, following the existing section
pattern (`secLabel` mono heading, card rows):

- One row per playlist: name, then a mono meta line `25 PIECES · 1H 52M`.
- Tapping the row navigates to the playlist page.
- The section is hidden entirely when no playlists load.

### 4. The playlist page — `/playlists/:playlistId`

A new route in `AppRoutes`. Header: back control to Home, the playlist name, and
a mono sub-line `25 OF 64 · 1H 52M`. Then the entries in playlist order, each
row showing index, title, composer and duration, tapping opens the piece.

Below the last row, the C2 line, in the mono meta style:

```
39 more works from this playlist are not in the catalog yet.
Liszt, Ravel, Debussy and Tchaikovsky are the big gaps.
```

Both sentences are generated from `counts` and `missingComposers`. When
`missing` is 0 the whole block is absent. Handle the singular ("1 more work").

**Read-only, visibly so.** No rename, reorder, remove, delete or add controls
anywhere. Not disabled — **absent**. Duplicate-to-edit belongs to T12b, when
there is somewhere for the copy to live.

An unknown `:playlistId` renders the existing `MissingRecord` shell.

### 5. Opening an entry

Reuse the existing `saveAndOpen` path that a search result uses — no second
implementation. That gets import-and-save for a piece not yet in My pieces, and
it preserves a previously saved `lastSpeed` (D-030). Verify that last part
rather than assuming it.

### Visual language

`GHOST_BUTTON_CLASS_NAME`, `Modal`, the card/border tokens, mono meta lines.
No new colours (AGENTS.md #4). Glyphs only, no icons (`› ← ▶`). Follow
`docs/design-contract.md`; the mockup shows intent, not a pixel spec — tokens
win where they disagree.

**Mobile.** The playlist row grid must not overflow 375px; T11 (D-027) is the
worked example. Long titles ellipsize, they do not wrap the duration off-screen.

## Acceptance criteria

1. `catalog/playlists.json` is generated by the build and contains exactly 25
   entries for `rousseau-classical`, in first-occurrence TSV order, with Clair
   de Lune appearing once.
2. Counts in the JSON read `resolved: 25, missing: 39, excluded: 7`, and
   `BUILD_LOG.md` records them.
3. A `have` row pointing at an unknown `catalog_id`, or any `verify` row, fails
   the build with a message naming the row.
4. Home shows the Playlists section on a **fresh profile** with an empty
   library, and tapping through opens the playlist page.
5. Opening an entry that is not in My pieces imports, saves and plays it —
   identical to opening it from search, including keeping a previously saved
   `lastSpeed` (D-030).
6. No editing affordance exists anywhere on the playlist: no rename, reorder,
   remove, delete or add.
7. Deleting `playlists.json` from `dist/` leaves Home fully usable with the
   Playlists section simply absent — no error screen, no blank page.
8. The C2 line states 39 and names exactly `Liszt, Ravel, Vivaldi and
   Beethoven`, both derived; changing a row in the TSV to `have` and rebuilding
   changes the number and can change the names, with no source edit. Chopin
   never appears in that list while he has more playable pieces than missing.
9. No horizontal page scroll at 375px, 768px, 1024px and 1440px on Home and the
   playlist page.
10. `PianoDatabase` is untouched and still at version 1. Confirm by diff.

## Verify

```bash
npm run check
npm run build && npm run preview
```

Then drive Home → playlist → player, and re-run with `dist/catalog/playlists.json`
deleted to prove criterion 7.

```bash
npm run test:e2e -- --grep "playlist"
```

## Done

- [ ] Ten criteria verified against the production build, not the dev server
- [ ] `docs/decisions.md` D-042 reflects what was actually built; any deviation
      gets its own entry
- [ ] PRD F1 playlist bullets satisfied, or the gap named in the report
- [ ] Report states plainly whether the database was touched

## Explicitly out of scope

Say so in the report if you are tempted; do not build it.

- **Anything the user can edit.** Create, rename, reorder, add, remove, delete,
  duplicate — all T12b, all needing the v2 migration.
- **Any player change at all.** No next/previous, no auto-advance, no "back to
  playlist". B1 was chosen precisely to keep the player out of this task.
- Nested playlists, tags, smart playlists, sorting by anything but playlist order.
- Sharing, export, import. No account, no backend (AGENTS.md #7).
- Per-playlist progress. That is T09.

## Traps

- **The seed is data, not code.** No piece ids, playlist names, counts or
  composer names in `.tsx`. Change the TSV, rebuild, the app changes.
- A playlist entry is a **reference**. Never copy score data into it.
- The duplicate Clair de Lune rows are deliberate. Deduplicate in the build;
  do not "fix" the TSV.
- `missingComposers` must be derived, and derived by the *eligibility* rule, not
  by raw missing count. Raw count names Chopin, who has 11 playable pieces here —
  the line would be false on the day it shipped, not just after T13.
- The four-way tie at 3 missing rows is real. Without the documented tie-break
  the generated JSON reorders between builds and the diff is noise.
- Do not add a `playlists` table "while you are here". T12b owns that, and the
  migration is the riskiest thing in this feature.
