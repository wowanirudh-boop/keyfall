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

## The licence gate — CLEARED 2026-08-16, read this before writing any fetch code

**The gate is passed. Do not re-litigate it, and do not re-verify it by guessing.**
`http://piano-midi.de/copy.htm` was read first-hand and records:

> The MIDI, audio(MP3, OGG) and video files of Bernd Krueger are licensed under
> the cc-by-sa Germany License. This means, that you can use and adapt the
> files, as long as you attribute to the copyright holder Name: Bernd Krueger,
> Source: http://www.piano-midi.de. The distribution or public playback of the
> files is only allowed under identical license conditions.

Redistribution is permitted. Full reasoning is in `docs/decisions.md` **D-040**.

**Use the apex domain to fetch. `www.piano-midi.de` is a dead host** — a
different IP serving a placeholder that returns `404` over HTTPS and a bodyless
`418` over HTTP. Two earlier sessions concluded the site was offline because
they only ever tried `www.`. Fetch from `http://piano-midi.de/…`. The site is
HTTP-only; do not assume an HTTPS mirror exists.

What the licence obliges, and what must therefore land in every row's `licence`
record:

- [ ] `licence.name` — record it **as worded**: `cc-by-sa Germany License`. The
      page gives **no version number**, so do not write "3.0 DE" or invent a
      deed URL. If you want a version, find one stated on the site itself.
- [ ] `licence.creator` — `Bernd Krueger`.
- [ ] `licence.url` — the licence statement's own page, `http://piano-midi.de/copy.htm`.
      The attribution *string* the licence demands names `http://www.piano-midi.de`;
      reproduce that verbatim in the attribution text even though fetching uses
      the apex. The licence's wording wins over our convenience.
- [ ] Share-alike: these files ship under the same licence. Add a piano-midi.de
      section to `catalog/LICENCES.md` stating that, alongside the Mutopia rows.
- [ ] These are **performances, not engravings**. The credit is to the
      performer/sequencer, which is what `licence.creator` already holds for
      Mutopia typesetters. Where both sources carry the same work, **Mutopia
      wins** (D-034): an engraving has real staff data, a performance infers it.

**Still stop and report** if a specific file's page contradicts the site-wide
terms, or if any row cannot be attributed. A file we cannot attribute is a file
we cannot ship.

If a work is absent from piano-midi.de too, the evaluated fallbacks are in
D-039: the CC BY-NC-SA Humdrum corpora are usable (the app is permanently
non-commercial, D-041) but cover little of the gap; the Beethoven and Chopin
kern repositories carry **no licence at all** and are therefore not usable;
Wikimedia Commons has no score data. **OpenScore is not a candidate** — its CC0
corpora are Lieder and string quartets, not solo piano.

## What this source actually covers — checked 2026-08-16, not assumed

A shallow pass over the composer pages. Treat it as a starting map, not a
substitute for resolving all 39 properly.

**Confirmed present** (~15 of the 39):

| Composer | Works | Closes |
|---|---|---|
| Beethoven | Sonata No. 14 Op. 27/2 (complete) | 2nd mvt, 3rd mvt, complete — **3 rows** |
| Liszt | La Campanella, Mazeppa, 19 Hungarian Rhapsodies | Campanella, Mazeppa, HR2, HR6 — **4 rows** |
| Ravel | Gaspard de la Nuit (Le Gibet listed, so the suite) | complete + Scarbo — **2 rows** |
| Chopin | Études Op. 10 and Op. 25 (sets), Polonaise Op. 53 | 10/3, 10/4, 25/5, 25/9, 25/11, Op. 53 — **6 rows** |

**Not available from this source at all — the composer is absent from the site
index entirely**, so do not spend time searching: **Vivaldi** (all three Four
Seasons rows), **Scriabin** (Étude Op. 8 No. 12), **Rimsky-Korsakov** (Flight of
the Bumblebee). That is **5 rows that stay `missing`** after this task. Say so
in the report rather than leaving them looking unattempted.

**Unconfirmed — the composer is on the site but the specific work did not turn
up in a quick pass.** Check each properly: Liszt *Liebestraum No. 3* and *Un
Sospiro*; Ravel *Pavane*; Chopin *Nocturne No. 20 posth.* and *Waltz Op. 64/2*;
all three Debussy; Mozart *K. 310* and *K. 265* (the site's numbering differs —
it lists "Sonata No. 8 D major, KV 311", which is **not** our K. 310);
Rachmaninoff (the site has Études-tableaux **Op. 33**, we need **Op. 39 No. 6**,
and Moments musicaux **Op. 16 No. 4** was not found); Schubert *Ständchen*;
both Bach arrangements; both Tchaikovsky Nutcracker numbers.

**A bonus outside the 39:** the site carries the full *Pictures at an
Exhibition* (1874). Our catalog row is a 237-second fragment mislabelled as the
whole suite (D-038, T03e). If the licence checks out, replacing it fixes that
defect properly instead of just retitling it. Coordinate with T03e rather than
both editing the same row.

**Nine of the absent works are arrangements** (the three Vivaldi *Four Seasons*,
both Bach piano arrangements, both Nutcracker numbers, Flight of the Bumblebee,
Ständchen). The underlying work being public domain does not make the
arrangement public domain. Each needs its own check, and "found a MIDI" is not
that check.

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
