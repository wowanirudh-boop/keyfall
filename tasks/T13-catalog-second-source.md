# T13 — A second catalog source, and closing the Rousseau gaps

**Depends on:** T12 · **PRD:** F2 (music acquisition, legal guardrail) ·
**Decisions:** D-034

---

## Goal

37 of the 72 rows in `catalog/playlists/rousseau-classical.tsv` are marked
`missing`. They are missing because **Mutopia does not have them**, not because
the build skipped them — Mutopia is a small volunteer project and carries no
Liszt beyond four Consolations, no Ravel, no Vivaldi, and none of the Nutcracker.

This task adds a second licence-clean source so the seeded playlist stops being
half empty, and re-resolves the TSV against the enlarged catalog.

## The licence gate — clear this before writing any fetch code

**Stop and report if any of this does not hold.** PRD F2's guardrail is that the
app auto-fetches only from sources whose licences permit redistribution. Getting
this wrong is not a bug, it is a legal problem, and the app is deployed publicly
(T10).

The proposed source is **piano-midi.de** (Bernd Krueger): roughly 300 classical
piano MIDI performances, repertoire that overlaps this playlist closely —
Liszt, Debussy, Tchaikovsky, Ravel, Mussorgsky, Schubert, Rachmaninoff. Multiple
secondary sources describe the files as **CC-BY-SA (Germany)** with attribution
to "Bernd Krueger, http://www.piano-midi.de".

**I could not verify this first-hand.** `http://piano-midi.de/copy.htm` was
unreachable from the machine that wrote this task — the site is HTTP-only and
the egress proxy returned 418. So:

- [ ] Fetch `http://www.piano-midi.de/copy.htm` and read the licence yourself.
- [ ] Record the exact licence name, version and required attribution wording in
      `docs/decisions.md` D-034 and in `catalog/LICENCES.md`.
- [ ] Confirm redistribution is permitted. If the terms turn out to be
      non-commercial-only, "personal use", or unclear — **stop, report, and
      propose an alternative.** Do not ship it and do not guess.
- [ ] Note that these are *performances*, not engravings. The credit line is the
      performer/sequencer, which is exactly what `licence.creator` already holds
      for Mutopia typesetters.

If piano-midi.de fails the gate, candidate fallbacks to evaluate, in order:
KernScores (CCARH, Humdrum `**kern` → MIDI), IMSLP per-file (licences vary
per upload; only viable file-by-file), and hand-sourcing from Mutopia's own
unreleased submissions. **OpenScore is not a candidate** — its CC0 corpora are
Lieder and string quartets, not solo piano.

## Deliverables

### 1. `scripts/build-catalog.mjs` becomes multi-source

Today the script assumes Mutopia: it clones the Mutopia git mirror, walks
`.ly` files, and scrapes `piece-info.cgi` for licence metadata. Refactor so a
**source adapter** supplies `{ id, title, composer, rawComposer, asset bytes,
licence }` and the shared pipeline handles everything downstream — the piano
filter, the 30-minute cap, the sha256, the alias generation, the composer
canonicalisation, the manifest write and `LICENCES.md`.

The existing Mutopia path must come out of this refactor **byte-identical**:
same 596 rows, same ids, same checksums. Prove it — diff the regenerated
manifest against the committed one and report the diff as empty.

The new adapter fetches over **plain HTTP** if that is all the source offers,
keeps the existing 1-request-per-second interval, and caches downloads under
`work/` so a re-run does not re-hammer the site.

### 2. Composer canonicalisation

`scripts/catalog-composers.json` maps raw spellings to canonical
"Surname, Forename". A second source brings new spellings and new composers
(Ravel, Vivaldi). Extend the map; the existing test that every manifest row uses
a known canonical composer must keep passing.

New rows must not collide with existing ones: the manifest already asserts no
duplicate (title, composer) pair. Where both sources carry the same work, prefer
**Mutopia** (it is an engraving, so its hand/staff split is real) and log the
skip. A piano-midi.de performance is a recorded performance — its track split is
usually still left/right hand, but verify on a sample and say what you found.

### 3. Re-resolve the seed playlist

Re-run the resolution behind `catalog/playlists/rousseau-classical.tsv`:

- Every `missing` row that the new source supplies flips to `have` with its new
  `catalog_id`.
- The four `verify` rows get settled. Each is a Chopin étude or the Chopin
  sonata where the catalog title does not name the opus; look up the row's
  `mutopiaId` on `piece-info.cgi` and set `have` or `missing` accordingly.
  Specifically: `etude-c-moll` is either Op. 10 No. 12 or Op. 25 No. 12 —
  whichever it is, the other becomes `missing`. Same shape for `etude-c-dur`
  (Op. 10 No. 1 vs Op. 10 No. 7) and `etude-ges-dur` (Op. 10 No. 5 vs
  Op. 25 No. 9). `sonate-2-b-moll` is 82 seconds, which is far too short for the
  Marche funèbre — find out what it actually contains and retitle or drop it.
- `excluded` rows stay excluded. Do not source them. Two are third-party
  arrangements with live copyright (Kreisler's *Liebesleid*, Wilhousky's *Carol
  of the Bells*), one is Rousseau's own composition, and four are compilation
  videos rather than works.
- Report the final tally: how many of the 72 rows resolve, and name what is
  still absent. (72 rows, 71 distinct works — Clair de Lune appears twice.)

### 4. Report what cannot be closed

Some of these works may not exist in any redistributable source. That is an
acceptable outcome. What is not acceptable is quietly leaving them out. The
report names each unresolved work and why.

## Acceptance criteria

1. The licence gate above is cleared in writing before any asset is fetched, and
   D-034 records the verified terms.
2. Regenerating the Mutopia-only catalog produces a manifest **identical** to the
   committed one — same ids, titles, composers, checksums, order.
3. Every new row carries `licence.name`, `licence.url`, `licence.sourceUrl`,
   `licence.sha256` and `licence.creator`. The manifest validator rejects a row
   missing any of them, as it does today for non-public-domain rows.
4. `catalog/LICENCES.md` lists every new row with its creator and checksum, and
   states the second source's licence terms in full.
5. No duplicate (title, composer) pair across the merged catalog.
6. Every new asset parses through `parsePieceBytes` and yields at least one note
   inside A0–C8; anything that does not is dropped with a logged reason.
7. Hand data: report what fraction of new rows produce `hasHandData === true`.
   D-025's assignment runs on them unchanged.
8. `catalog/playlists/rousseau-classical.tsv` has zero `verify` rows left, and
   the build emits the resolved playlist without failing.
9. `npm run check` passes, including the existing catalog tests.
10. Total shipped catalog weight recorded in `BUILD_LOG.md`; flag it if the
    `dist/catalog` directory passes 20 MB, since it ships to Cloudflare Pages.

## Verify

```bash
node scripts/build-catalog.mjs          # then: git diff catalog/manifest.json
npm run check
npm run build && npm run preview        # open several new pieces and play them
```

## Done

- [ ] Licence gate cleared and written down, or the task stopped and reported
- [ ] Mutopia regeneration byte-identical
- [ ] Ten criteria verified
- [ ] Unresolved works named individually in the report

## Traps

- **Do not fetch anything from Rousseau's channel.** The TSV lists *works*. His
  arrangements and recordings are his own copyrighted output and are not an
  input to this project in any form.
- The Mutopia adapter's behaviour is pinned by tests that read the shipped
  manifest. If the refactor changes ids or aliases, those tests will fail — that
  is the safety net working, not a test to update.
- A performance MIDI carries expressive timing. That is fine for the waterfall
  but means note starts are not on the grid; do not "correct" them. The player
  renders what the file says (D-025's principle).
- Rate-limit and cache. Re-running the build should not re-download 300 files.
