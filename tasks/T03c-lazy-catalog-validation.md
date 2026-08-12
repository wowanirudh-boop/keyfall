# T03c — Stop downloading every score at startup

**Depends on:** T03a. **Blocks T03b — do not expand the catalog before this.**
**PRD:** F1 · **Decisions:** D-016 (score assets are cached on first open, never
precached)

---

## The bug

`CatalogRepository.load()` loops over every manifest row and does
`await this.#loadAsset(entry.asset)` purely to verify a checksum
(`src/catalog/CatalogRepository.ts`, the `load()` method). Confirmed live in the
browser: opening the app issues **twelve `.mid` requests** before you have
searched for anything, and `open()` then fetches the chosen file **a second
time**.

At 12 pieces this is ~200 KB and invisible. **T03b takes the catalog to several
hundred pieces**, at which point every page load downloads the entire
collection — tens of megabytes, on a tablet, before the search box does
anything. D-016 says score assets are "cached on first open, not precached", and
this is the precise opposite.

T03a fixed the secure-context crash but left this architecture in place. The
instruction "at runtime, load the asset and use it" was ambiguous; this task is
the unambiguous version.

## The fix

**`load()` must issue zero asset requests.** Validate manifest *fields* only —
that is a pure, synchronous check over data already in memory.

Checksums stay verified where they are meaningful:

- **Build/test time** — the manifest validation test already hashes every asset
  against its committed bytes. That is the gate that decides what ships, and it
  stays exactly as it is.
- **On open** — `open()` already fetches the asset it needs; verifying there is
  free, and it is the only place a corrupted or evicted file can actually hurt.
  Keep the D-006 failure card for a genuine mismatch or a 404.

Also remove the duplicate fetch: opening a piece should request its asset once.

## Acceptance criteria

1. `load()` performs **no** network requests. Assert with a mocked loader that
   `loadAsset` is never called during `load()`.
2. Opening a piece requests its asset **exactly once**.
3. A 404 or checksum mismatch **on open** still raises `CatalogAssetError` and
   renders the D-006 card.
4. A manifest row with invalid fields is still dropped at load, with its warning.
5. The manifest validation test still hashes all shipped assets against their
   committed bytes — the shipping gate is unchanged.
6. **Scale guard:** with a synthetic 300-row manifest, `load()` completes in
   under 50 ms and issues zero requests. This is the assertion that makes T03b
   safe; without it the regression returns the moment the catalog grows.

## Verify

```bash
npm run check
npm run test:e2e
npm run build && npm run preview -- --host
# In DevTools → Network, load Home: there must be no .mid requests until you open a piece.
```

## Done

- [ ] Six criteria asserted, 1 and 6 explicitly
- [ ] Verified by hand in DevTools: zero `.mid` requests on Home, exactly one on
      opening a piece
- [ ] D-016's "cached on first open, not precached" is now true in behaviour,
      not just on paper

## Traps

- Do not keep a "verify the first N rows" compromise. Either startup fetches
  assets or it does not; a partial version reintroduces the same scaling problem
  with a smaller constant.
- Do not delete checksum verification. It moves to where it is meaningful — the
  build gate and the open path — and both must still fail on a real mismatch.
