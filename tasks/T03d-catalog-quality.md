# T03d — Make 460 pieces findable

**Depends on:** T03b
**Handoff sections:** README §1 Home (search field, results list, My pieces)
**PRD:** F1 (v1.1) · **Decisions:** D-019

---

## Why

T03b delivered 460 pieces and made the catalog worse to use. Three defects and one
gap, all confirmed against the shipped manifest.

**1. A one-character alias breaks every search.** The Czerny entry carries the
alias `"c"`. Alias matching is bidirectional (`query.includes(alias)`), so any
query containing the letter "c" matches it — `bach`, `chopin`, `scriabin` all do.
Ten aliases of ≤4 characters exist. This is why composer search appears not to
work: it works, but junk matches outrank the real ones.

**2. BWV 846 was dropped.** The Prelude in C from WTC I shipped in the 12-piece
seed and did not survive the rebuild. It is one of the best-known beginner pieces
in the repertoire, and its absence is what surfaced this whole class of problem.
Find out why the ingestion dropped it and fix the cause, not just the row.

**3. Composer names are unnormalised.** Eight spellings of one person:
`F. Chopin`, `F. F. Chopin`, `Frédéric Chopin`, `Frederic Chopin`, `Chopin`,
`Frédéric François Chopin`, `F. Chopin. Op.33 No.1`, `Fr.Chopin (1810-1849),Op.23`.
Two for Scriabin. Grouping, sorting and browsing are all impossible against this.

**4. Nothing to do without a query.** Home is a search box over an empty list.
With 460 pieces the learner cannot see what exists, so the catalog may as well be
empty until they guess a name.

## The work

**Aliases.** Sanitise at generation: drop any alias shorter than 4 characters,
drop aliases equal to a stop-word, and drop aliases that are a strict substring of
the folded title (they add nothing). Keep the curated nickname list. Then make the
bidirectional test safe — `query.includes(alias)` only for aliases of ≥ 4
characters.

**Composer normalisation.** Map each upstream spelling to one canonical
`Surname, Forename` via a committed alias table the ingestion script applies. The
raw upstream string stays in the row for provenance; the canonical name is what
displays, sorts and groups.

**Title disambiguation.** Where a folded title collides across rows, append the
distinguishing metadata already present upstream (key, opus, catalogue number) so
no two visible rows read identically. Every result row shows its composer.

**Ranking.** Exact title match, then title prefix, then title substring, then
composer, then alias. Within a rank, sort by canonical composer then title.

**Browse.** Home shows the catalog when the query is empty: sorted A–Z by
canonical composer, paginated or virtualised, with the piece count visible. Reuse
the existing result-row component — this is the same list, unfiltered.

## Acceptance criteria

1. `"bach"` returns Bach pieces first; no Czerny, Chopin or Scriabin entry appears
   above them. Assert the top 5 for `bach`, `chopin` and `scriabin`.
2. No shipped alias is shorter than 4 characters, and none is a substring of its
   own folded title. Assert across the whole manifest.
3. **BWV 846 is in the catalog**, findable by `"prelude in c"`, `"bwv 846"` and
   `"well tempered"`, and the ingestion log explains why it was previously dropped.
4. Every row's canonical composer is one of a known set; searching `"chopin"`
   returns every Chopin piece regardless of upstream spelling. Assert the count.
5. No two visible rows share an identical title + composer pair.
6. Ranking order holds: an exact title match outranks a substring match, which
   outranks a composer match.
7. Empty query renders the browsable catalog — count visible, sorted by composer,
   paginated — not an empty region.
8. Search over 460 rows still returns in under 50 ms, and browsing does not render
   460 rows at once.
9. Existing golden cases still pass: `"fur elise"`, `"gymnopedie"`,
   `"moonlight sonata"`, diacritics, punctuation, alias-only.

## Verify

```bash
node scripts/build-catalog.mjs
npm test -- src/catalog src/home
npm run test:e2e -- --grep "search|browse"
npm run check
```

## Done

- [ ] Nine criteria asserted, 1 and 3 explicitly
- [ ] `catalog/BUILD_LOG.md` records the alias and composer normalisation rules
      and every piece dropped, with reasons
- [ ] Verified by searching for a composer on the iPad
- [ ] Home screenshots at both viewports: browse, results, no-results

## Traps

- Fix the alias rule in the **generator**, not by hand-editing the manifest — the
  manifest is regenerated and hand edits vanish.
- Normalisation must not silently merge two different people. Log every mapping.
- Do not drop the raw upstream composer string; it is the provenance record.
