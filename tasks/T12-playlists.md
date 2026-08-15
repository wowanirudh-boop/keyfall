# T12 — Playlists

**Depends on:** T11 · **PRD:** F1 (piece selection) · **Decisions:** D-032

---

## Goal

A learner can group pieces into a named list and work through it, instead of
re-finding the same six pieces in a 596-row catalog every evening.

One seeded playlist ships with the app — "Classical Rousseau", built from
`catalog/playlists/rousseau-classical.tsv`. Everything else the learner makes
themselves.

## What a playlist is

A **playlist is an ordered list of catalog ids and saved-piece ids**, with a
name. It is not a folder, not a course, and it does not copy score data — two
playlists can contain the same piece and there is still one copy in IndexedDB.

Read D-032 before starting. The three things that decision pins down:

1. A playlist entry may reference a piece that is **not yet in My pieces**.
   Opening it runs the existing catalog import-and-save path, the same as
   clicking a search result. A playlist is a wish list as much as a library.
2. **Seeded playlists are read-only.** "Duplicate" makes an editable copy. If
   the user could edit the shipped one, a later catalog build would silently
   fight their edits.
3. **No auto-advance in this task.** Playing straight through is a transport
   behaviour with its own end-of-piece, loop-interaction and speed questions.
   Deliberately deferred — see "Explicitly out of scope".

## Deliverables

### Storage — `src/library/`

Bump `PianoDatabase` to **version 2** and add a `playlists` table:

```ts
interface StoredPlaylist {
  id: string;            // "pl-" + a stable slug, or a content hash for seeds
  name: string;
  entries: PlaylistEntry[];
  seed?: string;         // set only on shipped playlists, e.g. "rousseau-classical"
  createdAt: number;
  updatedAt: number;
}

interface PlaylistEntry {
  ref: string;           // catalog entry id, or a saved piece id for uploads
  kind: "catalog" | "saved";
}
```

`version(2).stores({ pieces: "id,lastOpened", attempts: "id,pieceId,createdAt",
playlists: "id,updatedAt" })` — additive. **Dexie must not drop `pieces` on
upgrade.** There is a real library on the user's iPad; losing it is a failed
task, not an inconvenience.

`LibraryRepository` (or a sibling `PlaylistRepository` — your call, state it in
the report) gains: `listPlaylists`, `getPlaylist`, `createPlaylist(name)`,
`renamePlaylist`, `deletePlaylist`, `addToPlaylist(id, entry)`,
`removeFromPlaylist(id, ref)`, `movePlaylistEntry(id, ref, toIndex)`,
`duplicatePlaylist(id, name)`.

Every write bumps `updatedAt`. Writes are idempotent: adding a ref already in
the playlist is a no-op, not a duplicate row.

### Seed — `scripts/build-catalog.mjs` and `catalog/`

`catalog/playlists/rousseau-classical.tsv` is already in the repo. It has 72
rows and a documented header. Extend the catalog build to emit
`catalog/playlists.json` from every `.tsv` in `catalog/playlists/`:

- Rows with status `have` or `verify` contribute their `catalog_id`, in file
  order, **deduplicated by id, first occurrence wins**. The playlist genuinely
  lists Clair de Lune twice (positions 9 and 69); the TSV keeps both rows as a
  faithful capture, and the emitted playlist holds one entry — the same
  idempotency rule D-032 applies to a user adding a piece twice.
- Trailing empty columns may be absent: a row with no note ends after
  `catalog_id`. Pad to five fields; do not index blindly.
- Rows with status `missing` or `excluded` contribute nothing.
- **Fail the build** if a `have`/`verify` row names a `catalog_id` that is not
  in `manifest.json`. A seed playlist pointing at a piece that does not ship is
  a dead row in the UI.
- Emit the counts into `catalog/BUILD_LOG.md`: how many rows resolved, how many
  were skipped as missing, how many as excluded.

The app loads `playlists.json` the way it loads `manifest.json`, and validates
it with the same shape of guard — a malformed seed must not take Home down.

The `.tsv` files are build **input**. `vite.config.ts`'s `catalogStaticAsset`
plugin copies all of `catalog/` into `dist/`, so exclude `catalog/playlists/*.tsv`
from that copy — the generated `playlists.json` is what ships.

### UI

**Home.** A "Playlists" section between the Continue card and My pieces:
each playlist as a row with its name and piece count; tapping it opens the
playlist view; a "New playlist" control. If the learner has no playlists, the
section still shows the seeded one.

**Playlist view.** A route — `/playlists/:playlistId`. Lists the entries in
order with title, composer and duration; tapping one opens the player. Per row:
remove, and move up/down. Header: name (inline-editable, except on seeds),
total duration, piece count, and Duplicate / Delete.

**Adding a piece.** An "Add to playlist" control on the search/browse row and in
the player header. It opens the existing `Modal`, listing the user's editable
playlists plus "New playlist…". Nothing else on the row changes — the primary
tap still opens the piece.

Follow the existing visual language exactly: `GHOST_BUTTON_CLASS_NAME`,
`Modal`, the card/border tokens, mono meta lines. No new colours (AGENTS.md #4),
no icons — glyphs only (`↑ ↓ ×`).

**Mobile.** The playlist row grid must not overflow 375px. T11 (D-027) is the
worked example: controls wrap onto their own line below `md`, and every control
stays inside the viewport.

### Deletion safety

Deleting a playlist is one tap and destroys ordering the user built by hand.
Require a confirmation step in the `Modal` naming the playlist and its piece
count. Deleting a playlist **never deletes pieces** — say so in the dialog.

Deleting a *piece* from My pieces leaves any playlist reference intact: the
entry re-imports from the catalog on next open. A `kind: "saved"` entry whose
piece is gone renders as an unavailable row with a remove control, not a crash.

## Acceptance criteria

1. Create, rename, duplicate and delete a playlist; all four survive a reload.
2. Add a piece from a search result, from browse, and from the player header;
   adding the same piece twice leaves one entry.
3. Remove an entry and reorder entries; order survives a reload.
4. Opening an entry that is **not** in My pieces imports and saves it, then
   plays — identical behaviour to opening it from search, including keeping any
   previously saved `lastSpeed` (D-030).
5. The seeded "Classical Rousseau" playlist is present on a fresh profile,
   contains exactly the rows the build resolved, and is not editable: rename,
   reorder, remove and delete are absent or disabled; Duplicate produces an
   editable copy.
6. Upgrading a database that already holds pieces from version 1 to version 2
   preserves every piece and attempt. Test this by seeding a v1 database in the
   test, not by reasoning about it.
7. Deleting a playlist asks first, and leaves every piece in My pieces.
8. A seed entry whose catalog id is missing fails the **build**, and a saved
   entry whose piece was deleted renders an unavailable row in the **app**.
9. No horizontal page scroll at 375px, 768px, 1024px and 1440px on Home, the
   playlist view and the add-to-playlist modal.
10. `catalog/BUILD_LOG.md` records the resolved / missing / excluded counts for
    every seed file.

## Verify

```bash
npm run check
npm run build && npm run preview     # then drive Home → playlist → player
npm run test:e2e -- --grep "playlist"
```

## Done

- [ ] Ten criteria verified against the production build
- [ ] v1 → v2 upgrade tested with a populated database
- [ ] `docs/decisions.md` D-032 reflects what was actually built; any deviation
      gets its own entry
- [ ] PRD F1 playlist bullets all satisfied, or the gap named in the report

## Explicitly out of scope

Say so in the report if you are tempted by any of these; do not build them.

- **Auto-advance / continuous play.** Needs its own decision: what happens at
  the end of a piece, whether A–B loop suppresses it, whether speed carries over.
- Nested playlists, tags, smart/auto playlists, sorting a playlist by anything
  other than the user's own order.
- Sharing, export, import. There is no account and no backend (AGENTS.md #7).
- Progress tracking per playlist. That is T09 territory.

## Traps

- **The seed is data, not code.** No piece ids in `.tsx`. If the TSV changes,
  the app changes with no source edit.
- A playlist entry is a *reference*. Copying the score into the playlist row
  would double the storage of every piece in two playlists and desynchronise on
  re-import.
- `duplicatePlaylist` must clear `seed` on the copy, or the copy inherits
  read-only.
