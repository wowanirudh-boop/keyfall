# T03a — Catalog must load outside a secure context

**Depends on:** T03. Small, urgent — the app is unusable on the iPad without it.
**PRD:** F1 (catalog availability) · **Decisions:** D-006

---

## The bug

On the iPad, over `http://192.168.88.4:4173`, every catalog row is dropped and
the "Catalog search is unavailable right now" banner shows. The 12 pieces are
present and valid; nothing is wrong with the manifest.

`CatalogRepository` verifies each asset's SHA-256 at **runtime** using
`crypto.subtle.digest` (`src/catalog/CatalogRepository.ts:96`). `crypto.subtle`
only exists in a **secure context** — HTTPS, or `http://localhost` /
`http://127.0.0.1`. A plain-HTTP LAN address is not a secure context, so
`crypto.subtle` is `undefined`, the digest call throws, the catch at line 141
drops the row as "asset unavailable", and all 12 rows disappear.

This passed every gate because tests and the PC browser both run on localhost,
which *is* a secure context. It only appears on another device over the LAN —
which is the product's actual usage posture: a tablet on the music stand.

## The fix

**Runtime checksum verification is the wrong place for this check.** The assets
are bundled into our own build at build time; hashing them again in the browser
proves nothing about supply-chain integrity that the build did not already
establish. It is a build-time guarantee being paid for at runtime.

- Keep checksum verification in the **manifest validation test**, where it
  already runs against the on-disk bytes and genuinely gates what ships.
- At runtime, load the asset and use it. If `crypto.subtle` is available, an
  opportunistic verification is fine — but a **missing `crypto.subtle` must
  never drop a row**.
- Keep D-006's real failure states: asset 404s, or a checksum that actually
  mismatches where verification did run. Those still render the D-006 card.

## Acceptance criteria

1. With `crypto.subtle` undefined (simulate a non-secure context), all 12 rows
   load, search works, and the unavailable banner does **not** show.
2. A 404 on a score asset still drops that row and renders the D-006 card.
3. Where verification does run, a genuine checksum mismatch still drops the row.
4. The manifest validation test still verifies all 12 checksums against on-disk
   bytes — the shipping gate is unchanged.
5. An e2e test loads the app from a **non-localhost origin over plain HTTP** and
   asserts the catalog is searchable. This is the case every existing test
   missed; without it the bug can return silently.

## Verify

```bash
npm run check
npm run test:e2e
npm run build && npm run preview -- --host   # then load from another device
```

## Done

- [ ] Five criteria asserted, 1 and 5 explicitly
- [ ] Verified by hand on an iPad over the LAN address, not just localhost
- [ ] No new visual language; the banner still exists for real outages

## Traps

- Do not "fix" this by making the banner conditional on navigator.onLine. The
  catalog is bundled and always present; online status is irrelevant to it.
- Do not delete checksum verification. Move it to where it is meaningful.
