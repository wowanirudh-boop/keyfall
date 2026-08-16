# T12b — Playlists the user makes

**Depends on:** T12a · **PRD:** F1 (piece selection) · **Decisions:** D-032, D-042

---

## Goal

The learner creates their own playlists in the app: make one, name it, add and
remove pieces, reorder them, duplicate, delete. T12a proved the shape with a
read-only list; this task makes it writable.

**This is the task that carries the migration risk.** There is a real, populated
library on the user's iPad. A Dexie upgrade that drops `pieces` is not an
inconvenience, it is a failed task. Everything below is arranged so that risk is
faced first and proven with a test, not reasoned about.

## Deliverables

### 1. Storage — the v1 → v2 upgrade

Bump `PianoDatabase` to version 2 and add a `playlists` table. Additive only:

```ts
version(2).stores({
  pieces: "id,lastOpened",
  attempts: "id,pieceId,createdAt",
  playlists: "id,updatedAt",
})
```

```ts
interface StoredPlaylist {
  id: string;              // "pl-" + crypto.randomUUID()
  name: string;
  entries: PlaylistEntry[];
  createdAt: number;
  updatedAt: number;
}

interface PlaylistEntry {
  ref: string;             // catalog entry id, or a saved piece id for uploads
  kind: "catalog" | "saved";
}
```

**Do this first, and prove it before building any UI.** Write a test that seeds
a version-1 database with several pieces and attempts, opens it at version 2,
and asserts every piece and attempt survives with its fields intact. Reasoning
about Dexie's upgrade semantics is not evidence; the test is.

Note the shipped playlist from T12a is **not** in this table. It stays a
build-time artefact loaded from `playlists.json` — that is what keeps it
read-only across rebuilds (D-032). The UI merges the two lists for display; the
store holds only what the user made.

### 2. Repository

`PlaylistRepository`, or new methods on `LibraryRepository` — your call, state
which and why in the report:

`listPlaylists`, `getPlaylist`, `createPlaylist(name)`, `renamePlaylist`,
`deletePlaylist`, `addToPlaylist(id, entry)`, `removeFromPlaylist(id, ref)`,
`movePlaylistEntry(id, ref, toIndex)`, `duplicatePlaylist(id, name)`.

Every write bumps `updatedAt`. Writes are **idempotent**: adding a ref already
present is a no-op, not a second row — the same rule the T12a build applies to
the duplicated Clair de Lune.

**Ids are `crypto.randomUUID()`, not a slug of the name.** Two playlists called
"Evening practice" made on two devices must not collide, and slugs collide by
construction. Cross-device sync is a stated eventual direction that is not being
built now (D-043); this is the one choice that costs nothing today and is
expensive to unpick later, so it is made now and nothing else is. Do **not** add
sync scaffolding, device ids, conflict resolution or a `syncedAt` field — that
would be speculative work against requirements that do not exist yet.

`duplicatePlaylist` on the shipped playlist reads it from `playlists.json` and
writes a normal user playlist. The copy has no seed marker of any kind, so it is
editable like any other. This is the escape hatch D-032 promised.

### 3. UI

**Home.** The Playlists section from T12a gains a "New playlist" control and now
lists user playlists beneath the shipped one.

**Playlist page.** The T12a page becomes editable when the playlist is the
user's: inline-editable name, per-row remove and move up/down (`↑ ↓ ×`), and
Duplicate / Delete in the header. On the shipped playlist these stay **absent**,
exactly as in T12a — except Duplicate, which appears there too.

**Adding a piece.** An "Add to playlist" control on the search/browse row and in
the player header. It opens the existing `Modal` listing the user's editable
playlists plus "New playlist…". Nothing else about the row changes — the primary
tap still opens the piece.

Visual language, glyph rules and the 375px constraint are as T12a.

### 4. Deletion safety

Deleting a playlist is one tap and destroys an ordering built by hand. Require
confirmation in the `Modal`, naming the playlist and its piece count, and saying
plainly that **no pieces are deleted**.

Deleting a *piece* from My pieces leaves playlist references intact: a
`kind: "catalog"` entry re-imports on next open. A `kind: "saved"` entry whose
piece is gone renders as an unavailable row with a remove control — not a crash,
and not a silent disappearance.

## Acceptance criteria

1. **Upgrading a populated v1 database to v2 preserves every piece and every
   attempt.** Proven by a test that seeds v1 directly, not by inspection.
2. Create, rename, duplicate and delete a playlist; all four survive a reload.
3. Add a piece from a search result, from browse, and from the player header;
   adding the same piece twice leaves one entry.
4. Remove an entry and reorder entries; the order survives a reload.
5. Duplicating the shipped playlist produces an editable copy with the same
   entries in the same order, and the shipped one is unchanged.
6. The shipped playlist remains read-only: rename, reorder, remove and delete
   are absent.
7. Deleting a playlist asks first, and afterwards every piece is still in My pieces.
8. A `kind: "saved"` entry whose piece was deleted renders an unavailable row
   with a working remove control.
9. No horizontal page scroll at 375px, 768px, 1024px and 1440px on Home, the
   playlist page and the add-to-playlist modal.

## Verify

```bash
npm run check
npm run build && npm run preview
npm run test:e2e -- --grep "playlist"
```

Then, on a build with a populated library, reload and confirm nothing was lost.

## Done

- [ ] Nine criteria verified against the production build
- [ ] v1 → v2 upgrade tested with a populated database, test committed
- [ ] Report states which repository shape was chosen and why
- [ ] `docs/decisions.md` updated for any deviation

## Explicitly out of scope

- **Auto-advance / continuous play.** Still deferred (D-032, O-9). It needs
  answers for end-of-piece, A–B loop interaction and speed carry-over, and those
  are transport decisions. If it is wanted after using T12a, it gets its own task.
- Nested playlists, tags, smart playlists, sorting by anything but user order.
- Sharing, export, import. No account, no backend.
- Per-playlist progress tracking. That is T09.

## Traps

- **Dexie must not drop `pieces` on upgrade.** Additive `version(2).stores()`
  only. Test it against a seeded v1 database before anything else.
- The shipped playlist does not get written into the table. Copying it in at
  first run means the next catalog build either overwrites the user's edits or
  silently drifts from them — the exact failure D-032 exists to prevent.
- A playlist entry is a reference. Never copy score data into a playlist row.
- `duplicatePlaylist` must produce something with no trace of seed-ness, or the
  copy inherits read-only and the escape hatch does nothing.
