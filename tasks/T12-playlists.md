# T12 — Playlists · SPLIT, do not execute this file

**Superseded 2026-08-16.** This task was written as one piece of work and is now
two. Its contents have been rewritten into:

| | Task | Scope |
|---|---|---|
| **P0** | [`T12a-seed-playlist.md`](T12a-seed-playlist.md) | The shipped, read-only "Classical Rousseau" playlist, built from `catalog/playlists/*.tsv`. **No database change.** |
| **P1** | [`T12b-user-playlists.md`](T12b-user-playlists.md) | Playlists the user creates. Carries the Dexie v1→v2 migration. |

The split exists so the riskiest part of this feature — a schema upgrade against
a real, populated library on the user's iPad — stays off the critical path until
the shape has been proven by something that cannot lose data.

The UI was chosen from `docs/mockups/playlist-options.html` and is recorded in
`docs/decisions.md` **D-042**. The product shape is D-032.

This file is kept only so links to it resolve. **Execute T12a, then T12b.**
