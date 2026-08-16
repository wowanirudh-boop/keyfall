# T03f — 22 more catalog rows name a work but contain one movement

**Depends on:** T03e · **PRD:** F2 (catalog quality) · **Decisions:** D-038, D-049

---

## Goal

T03e fixed two rows of a defect the audit then found **22 more** of. The cause is
structural, not clerical: where a Mutopia entry's asset is a multi-file archive,
the build picked **one member** and kept the **collection's** title. So the
catalog offers "French Suite No. 6" and plays 84 seconds of its Allemande.

This is the single largest source of dishonesty left in the catalog, and it
misleads search for every user.

## The 22, ten worst by shortness

| Duration | Title | What it actually is |
|---:|---|---|
| 0:18 | Passepied (et Menuet) | only the Passepied |
| 0:40 | The Virtuoso Pianist (Part I) | `hanon01.mid`; archive holds Nos. 1–20 |
| 0:49 | English Suite II: Gigue | **source path names the Prelude** |
| 0:58 | Preludio con Fuga | one of two archive members |
| 0:58 | Sonatina — O 36 | one of three movements |
| 1:17 | Clementi's Art of Playing on the Piano Forte | lesson 1 of a large archive |
| 1:24 | French Suite No. 6 | only the Allemande, of eight |
| 1:36 | French Suite No. 5 | only the Allemande, of seven |
| 2:06 | Six sonates faciles… (I) | one movement |
| 2:06 | Six Partitas… No. 1 | first of six movements |

The remaining twelve are in T03e's audit output. **Re-run the audit rather than
working from this table** — T03e's own fixes may have shifted it, and the table
is a summary, not the list.

## One of these is a different, worse bug

**English Suite II: Gigue** is not over-claiming — the audit says its source path
names the **Prelude**. A user searching for the Gigue gets a different movement
entirely. Verify it first and fix it first; if confirmed, it is a wrong label,
not an incomplete one, and it should be called out separately in the report.

## How to fix each row

Two legitimate outcomes. Choose per row and **state the choice and why** for all
22 in the report:

1. **Merge the archive's members into the complete work**, as T03e did for
   Pictures at an Exhibition (D-049). Right where the archive genuinely holds the
   whole work and the members are movements of it — the French Suites, the
   Partita, the Sonatina. The title then becomes true as it stands.
2. **Retitle to name what the file contains** — "French Suite No. 5: Allemande".
   Right where merging is wrong or impossible: `hanon01.mid` out of an exercise
   collection is not a movement of a larger work, and Clementi's lesson 1 is not
   "the Art of Playing".

Prefer merging where the work is a genuine multi-movement whole, because it
gives the learner the piece they searched for. Prefer retitling where the
collection is a set of independent items.

Do **not** silently drop a row. A short honest row is worth more than a missing
one.

## Constraints

- Corrections must survive `npm run build`. T03e added
  `CATALOG_TITLE_OVERRIDES` and `CATALOG_SOURCE_OVERRIDES` in
  `scripts/build-catalog.mjs` — extend those mechanisms rather than inventing a
  third, and do not hand-edit `manifest.json`.
- Any merged asset needs a full licence record and a fresh SHA-256, and its
  member files listed in the build script the way the Pictures merge lists
  `muss_1.mid`–`muss_8.mid`. The manifest's `sourceUrl` may point at the
  collection; the members must be recoverable from version control.
- `catalog/LICENCES.md` regenerates; that is expected (D-049).
- Merging changes durations, which changes total catalog weight. Keep the
  `dist/catalog` figure in `BUILD_LOG.md` current and under the 20 MiB gate.
- **Do not touch `catalog/playlists/*.tsv` or any playlist code.** If a merged
  row is in the seed playlist, the playlist JSON's duration changes on its own —
  report the before/after, do not edit the playlist.

## Acceptance criteria

1. A re-run of the implausible-duration audit reports **zero** rows whose title
   claims a scope the file does not contain, or every remaining row is listed
   with a reason it is a false positive.
2. Each of the 22 is merged or retitled, with the choice justified in the report.
3. The English Suite II mislabelling is verified and fixed, and reported apart
   from the over-claiming rows.
4. Every merged asset carries name, url, sourceUrl, SHA-256 and creator, and its
   members are named in `scripts/build-catalog.mjs`.
5. Row count changes only if a merge collapses several rows into one; if so, the
   before/after count and the reason are in the report.
6. `npm run check` **and** `npm run test:e2e` pass, with port 4181 free. The e2e
   counts are data-driven since T13b, so a changed catalog should not break them
   — if it does, that is a finding worth reporting, not a number to edit.
7. `npm run build` passes and `dist/catalog` stays under the gate.

## Traps

- **Trusting the title is the bug.** Derive every decision from
  `licence.sourceUrl`, the archive's member list, and the file itself.
- A merge concatenates separate renderings; seams in tempo or dynamics are
  expected and are not a defect to "fix" by editing note data. Never alter the
  music.
- Hanon and Clementi are exercise collections. Merging 20 exercises into one
  40-minute "piece" would be worse than the bug — retitle those.
