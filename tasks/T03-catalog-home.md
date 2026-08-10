# T03 — Catalog, library and Home screen · 🚦 MVP GATE

**Depends on:** T02 **and T06** — several acceptance criteria here ("lands on
the player paused at 0:00", "reopens and plays without re-parsing") require a
working player, so this runs after the transport is done.
**Handoff sections:** README §1 Home, §2 No results / upload, §3 Search offline
**PRD:** F1, F2

---

## Goal

Get from a piece name to an opened piece, and back to yesterday's piece in one
tap. Everything local. Completing this closes the MVP loop.

## Catalog manifest schema

`catalog/manifest.json`, validated on load. A row failing validation is dropped
with a console warning; the catalog still ships.

```ts
type CatalogEntry = {
  id: string;                 // stable slug, e.g. "fur-elise"
  title: string;
  composer: string;
  arranger?: string;          // rendered in the result byline when present
  aliases: string[];          // stored ALREADY FOLDED; empty strings rejected
  asset: string;              // path under catalog/scores/, e.g. "fur-elise.mid"
  format: 'midi' | 'musicxml';
  durationSeconds?: number;   // shown in results when known
  licence: {
    name: string;             // e.g. "Public domain", "CC0-1.0", "CC-BY-4.0"
    url: string;              // link to the licence text
    sourceUrl: string;        // where this exact asset came from
    sha256: string;           // checksum of the asset file as shipped
  };
};
```

**Validation is five fields:** `licence.name`, `licence.url`, `licence.sourceUrl`,
`licence.sha256`, and the checksum actually matching the asset bytes.

## Deliverables

- `CatalogRepository` — reads and validates the bundled manifest, folded search.
- `LibraryRepository` — Dexie over IndexedDB: `pieces` (metadata, original upload
  bytes, normalized timeline, lastOpened, lastSpeed) and `attempts` (T09 writes).
- Components per `docs/design-contract.md` §2 Home.
- Bundled seed catalog with locally shipped score files.

## Seed catalog — licence gate

Twelve pieces, classical (the learner's stated repertoire). Candidates: Für
Elise · Gymnopédie No. 1 · Moonlight Sonata I · Clair de Lune · Prelude in C
BWV 846 · Minuet in G · Mozart K.545 I · Chopin Prelude Op. 28 No. 4 · Chopin
Nocturne Op. 9 No. 2 · Gnossienne No. 1 · Burgmüller Arabesque · Schumann Melody.

**No entry ships until its manifest row passes the five-field validation above —
verified per asset, not per composition.** Mozart K.545 is public domain as a
composition; a particular engraving or MIDI realization of it may not be. Mutopia
is the cleanest source; IMSLP mixes licences and needs per-file checking. This is
PRD R7, the only blocking item in the project — **start it on day 1, in parallel
with everything else.**

This is human research work, not something to synthesize. If the assets are not
available when you reach this task: build the loader, validator, search and every
Home component against a **fixture manifest** under `src/catalog/__fixtures__/`,
ship `catalog/manifest.json` containing only the rows that are genuinely
verified (even if that is zero), and record the audit status in
`catalog/LICENCES.md`. Never invent a licence, a source URL or a checksum.

## Behaviour

- **Search** exactly per `docs/algorithms.md` §7: fold (lowercase → NFD → strip
  diacritics → punctuation to space → collapse → trim), match folded title,
  folded composer, and aliases **bidirectionally** (alias contains query OR
  query contains alias). Empty query → no results, not all results. Escape
  clears. The Clear button appears only when the query is non-empty.
- **Opening a piece** (search result, library row, or upload) parses it, saves
  it, prepends it to My Pieces if absent, and navigates to the player **paused
  at 0:00** with the loop cleared and listen mode off.
- **Delete** removes the piece and its stored bytes from IndexedDB.
- **Catalog unavailable** (manifest load/validate fails): the §3 amber banner
  above the search field; results hidden; upload and My Pieces stay fully
  interactive.
- **Asset failure (D-006)** — entry opens but the score asset 404s or its
  checksum mismatches: render the §2 upload-error card styling verbatim, naming
  the piece and offering the upload path. No new visual language.
- **Storage full:** the piece stays usable for the session with a clear "not
  saved locally" warning. Call `navigator.storage.persist()` on first save.

## Acceptance criteria

1. Golden search cases pass: `"fur elise"` → Für Elise; `"gymnopedie"` →
   Gymnopédie No. 1; `"FÜR ELISE"` and `"fur  elise!"` both match; empty query
   returns zero results; **and at least one case that matches only via an alias**
   (query matching neither folded title nor composer), so the alias path is
   really covered.
2. Every shipped manifest row passes the five-field validation; a row missing any
   field, or whose checksum does not match its asset bytes, is dropped, and a
   test proves both cases.
3. Opening any piece lands on the player paused at 0:00 with no loop.
4. A piece opened, then reopened from My Pieces after a full page reload, plays
   without re-parsing the original file.
5. Deleting a piece removes it from the list and from IndexedDB.
6. All five upload failures render their specific message and leave the user on
   the view — never a spinner, never a crash.
7. Catalog-unavailable renders the §3 banner with upload and library still live.
8. Asset-failure renders the D-006 card.
9. Empty library renders the §1 dashed empty state with the handoff's exact copy.
10. Result rows render title, composer, **arranger when present**, source and
    duration (PRD F1).
11. The Salamander CC-BY 3.0 attribution line renders at the foot of Home
    (D-012).

## Verify

```bash
npm test -- src/catalog src/library
npm run test:e2e -- --grep "search|upload|library"
npm run check
```

## Done

- [ ] Eleven criteria asserted
- [ ] Manifest licence audit committed as `catalog/LICENCES.md`, with each row
      marked verified or outstanding — never assumed
- [ ] Every Home state in `docs/design-contract.md` §3 verified at both viewports
- [ ] No `simulate:` control anywhere

## 🚦 MVP gate

The MVP is complete only when all of the following hold:

- [ ] F1–F4 acceptance criteria in `PRD.md` §7 are each satisfied and traceable
      to a test
- [ ] A piece can be found, opened, played, slowed, scrubbed and looped
- [ ] The piece reopens from My Pieces after a full browser restart
- [ ] Player works with the network blocked once the piece is open
- [ ] Every Home and Player state in `docs/design-contract.md` §3 verified at
      1440×900 and 1024×768
- [ ] 30-minute dense fixture: ≥ 58 fps, seek responsive, memory stable
- [ ] `npm run check` and `npm run test:e2e` green
- [ ] Zero prototype scaffolding in the bundle
- [ ] Licence audit status recorded — a piece with an unverified licence is not
      shipped in the manifest

## Traps

- Alias matching is bidirectional; title and composer matching is **not**.
  Transcribe §7 exactly.
- Opening a piece must clear loop markers and listen mode, not just set `t = 0`.
- Do not ship the prototype's 8-entry fake `CATALOG`.
