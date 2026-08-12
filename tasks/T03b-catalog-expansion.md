# T03b — Expand the bundled catalog to the full Mutopia piano collection

**Depends on:** T03a, and **T03c** — expanding the catalog before startup stops
fetching every asset would download hundreds of scores on every page load.
**PRD:** F1 · **Decisions:** D-016 (budgets), D-018 (manifest delivery), T10's
attribution gate — which this task closes early

---

## Goal

Go from 12 pieces to the whole of Mutopia's piano-solo repertoire, so searching a
piece usually finds it. Still no backend, still no runtime network dependency on
anyone else's server.

## Why not live internet search

Mutopia and IMSLP send no CORS headers and expose no search API, so browser
JavaScript cannot query them directly — that needs a proxy, i.e. a backend, which
D-001 rules out. Bundling their collection at build time gets most of the benefit
with none of the architecture. Upload stays the escape hatch for anything modern
or copyrighted, which could never be auto-fetched legally anyway.

## Part 1 — The ingestion script

Write `scripts/build-catalog.mjs`, committed and re-runnable. It is a **build-time
tool**, never shipped and never run by the app.

- Source the archive from the Mutopia GitHub mirror rather than scraping the
  website — it carries the same per-piece metadata without hammering their host.
  If you fall back to HTTP, rate-limit to ~1 request/second and cache locally so
  a re-run does not re-download.
- Filter to **solo piano** pieces that have a usable MIDI (or MusicXML) file.
- For each piece extract: title, composer, the **maintainer/typesetter**, licence
  name, licence URL, source URL, and the asset itself.
- Compute the SHA-256 of the exact bytes being committed.
- Emit `catalog/manifest.json` plus assets under `catalog/scores/`, and rewrite
  `catalog/LICENCES.md` from the same data.
- **Drop, and log, any piece whose licence cannot be determined.** A piece
  missing licence data does not ship. Never infer a licence from the composer
  being long dead — that is about the composition, not the engraving.

## Part 2 — Schema: add the creator credit

Add `licence.creator` to `CatalogEntry`, required for every non-public-domain
row. This is **T10's attribution gate, pulled forward** — retrofitting hundreds
of rows later is far more expensive than populating them now while the script is
already parsing the metadata.

Surface it wherever source is already shown (handoff §1 result meta, §4 player
header). Same mono treatment, no new visual language.

## Part 3 — Stop bundling the manifest into the JS (D-018)

`CatalogRepository` currently does `import bundledManifest from
"../../catalog/manifest.json"`. At 12 rows that is free. At several hundred it
puts a few hundred KB of JSON into the entry chunk that every user downloads
before the app paints, and D-016 caps first load at 1.5 MB.

Move the manifest to a **fetched static asset** (`/catalog/manifest.json`),
loaded once on Home and cached by the service worker in T10.

This has a welcome side effect: the "catalog search is unavailable" banner
becomes genuinely reachable again. Until now it could only fire through the
secure-context bug T03a fixed — a failure state with no real cause. Now it covers
a real one: the manifest fetch failing.

## Acceptance criteria

1. `scripts/build-catalog.mjs` regenerates `catalog/` from scratch and is
   idempotent — a second run with no upstream change produces no diff.
2. Every shipped row passes the five-field validation **plus** `licence.creator`
   for non-public-domain rows. A row missing any of it is dropped by the script,
   not shipped broken, and the drop is logged with a reason.
3. Every shipped asset's SHA-256 matches its manifest row, verified against the
   committed bytes.
4. `catalog/LICENCES.md` is regenerated and lists every piece with its licence
   and creator.
5. The manifest is **not** in the entry chunk — assert it is fetched, and that
   first-load transfer still meets D-016's 1.5 MB budget with the larger catalog.
6. Search golden cases still pass at full scale: `"fur elise"`, `"gymnopedie"`,
   `"moonlight sonata"`, an alias-only match, plus the diacritic and punctuation
   cases. Add a scale assertion: search over the full catalog returns in under
   50 ms.
7. Result ordering is sensible when a query matches many pieces — exact title
   matches rank above substring matches. With hundreds of rows, "sonata"
   matching 80 pieces in arbitrary order is a worse experience than 12 in any
   order, so this now matters.
8. Manifest-fetch failure renders the existing catalog-unavailable banner, with
   upload and My Pieces still working — the real version of the state D-006 and
   D-017 describe.
9. A non-public-domain piece shows its creator credit in the result row and the
   player header.

## Alias strategy

Hand-authoring aliases for hundreds of pieces is not realistic. Generate a
baseline automatically — strip opus/catalogue numbers, drop parenthetical
qualifiers, index composer surname alone — and keep a small hand-curated list
for the famous nicknames a generator cannot know ("Moonlight", "Für Elise",
"Raindrop", "Revolutionary"). Curated aliases live in a separate file the script
merges in, so regenerating the catalog never destroys them.

## Verify

```bash
node scripts/build-catalog.mjs
npm run check
npm run test:e2e
npm run build && npm run preview -- --host   # search from the iPad
```

## Done

- [ ] Nine criteria asserted; 5 and 7 explicitly
- [ ] Catalog size and total asset weight recorded in `catalog/LICENCES.md`
- [ ] Every dropped piece logged with a reason; no piece ships without a licence
- [ ] T10's attribution gate can be ticked off as satisfied by this task
- [ ] Verified by searching from the iPad, not just localhost

## Traps

- Score assets are cached **on first open**, never precached (D-016). Several
  hundred MIDI files must not enter the service worker's precache manifest in
  T10 — that would turn a 1.5 MB first load into tens of MB.
- Do not let the script run at app runtime or in CI-on-every-build. It is run
  deliberately, and its output is committed and reviewed.
- Public-domain rows legitimately have no creator requirement. Do not invent one
  to satisfy a uniform schema.
