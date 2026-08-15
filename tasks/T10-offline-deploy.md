# T10 — Offline packaging and deployment

**Depends on:** nothing outstanding — **this is the next runnable task.**
T09 is blocked behind T08, which needs the RP302 plugged in. Deployment is not.
**PRD:** §9 offline-tolerant, local-first · **Decisions:** D-001, D-007, D-008

---

## Goal

The app works at the piano with the Wi-Fi off, and deep links resolve in
production.

## Deliverables

- Generated service worker (Workbox via `vite-plugin-pwa`, or equivalent).
- Cloudflare Pages deployment config with SPA fallback.

## Caching policy

| Asset | Policy | Why |
|---|---|---|
| App shell, JS, CSS | Precache | must boot offline |
| Self-hosted fonts | Precache | UI is unreadable without them |
| Catalog manifest | Precache | search must work offline |
| Catalog score assets | Cache on first open | 12 pieces is too much to precache |
| Salamander samples | **Never precache** (D-008) | multi-MB; lazy-loads behind the synth fallback |

Parsed pieces already live in IndexedDB from T03; the service worker does not
duplicate them.

## Deployment

Static build, no server runtime, no API routes, no database, no secrets.
**SPA fallback** so `/pieces/:id` and `/reports/:id` resolve on a cold load — a
Cloudflare Pages `_redirects` with `/* /index.html 200`, or the framework
equivalent. Without it every deep link 404s, including the report→player
navigation from D-007 after a reload.

Add an attempt-not-found and piece-not-found state for links whose IndexedDB
records no longer exist (different browser, cleared storage).

## Attribution gate — **already cleared, verify and move on**

Written when six of twelve seed scores were CC-BY-SA and the manifest had no
creator field. Both have since changed. Verified 2026-08-13 against the shipped
catalog:

- 596 rows: 386 Public Domain, 210 under CC-BY or CC-BY-SA (2.5 / 3.0 / 4.0).
- **Every one of the 210 non-public-domain rows carries `licence.creator`**, and
  the manifest validator already rejects a non-PD row without one.
- `catalog/LICENCES.md` records each row's creator, licence, source page and
  SHA-256, generated from Mutopia mirror commit `2144afd6`.
- Creator is surfaced on search/browse rows and in the player header.
- Salamander CC-BY 3.0 attribution is behind About (D-023).

So the checklist below is a re-check, not a build:

- [ ] Confirm the three surfaces still render creator after T11's header rework.
- [ ] Confirm `catalog/LICENCES.md` row count matches the manifest row count.

The two clarifications from the original gate still stand and still matter, so
nobody over-corrects: **ShareAlike does not reach the application.** Bundling a
score with software is aggregation, not derivation, and the shipped assets are
byte-identical originals (their checksums prove it). No derivative score is
distributed and the app's own licence is unaffected.

If T13 lands a second source first, its rows must clear the same bar before this
deploys.

## Hosting — the decision, and why

**Cloudflare Pages.** `wrangler` and `@cloudflare/vite-plugin` are already in
`devDependencies` and on BUILD_PLAN's approved list, so this needs no new
dependency and no new decision. The build is static: no server runtime, no API
routes, no database, no secrets, no environment variables.

Measured on the current production build:

| | |
|---|---|
| `dist` total | **17 MB**, 623 files |
| `dist/catalog` | 7.7 MB (596 MIDI files + manifest) |
| `dist/assets` | 8.3 MB — of which the Verovio worker is 7.9 MB |
| `dist/audio` | 1.1 MB (Salamander samples) |
| main JS bundle | 657 kB (192 kB gzipped) |

Comfortably inside Cloudflare Pages' limits (25 MB per file, 20,000 files per
deployment). The 7.9 MB Verovio worker is lazy — it loads only when a MusicXML
file is imported — so it never touches first paint. Do not let a service-worker
precache swallow it; that is the same mistake as precaching the samples (D-008).

**Two things that will break the deploy if missed:**

1. **SPA fallback.** `_redirects` with `/* /index.html 200`, or the framework
   equivalent. Without it every deep link 404s on a cold load — `/pieces/:id`,
   `/playlists/:id` once T12 lands, and the report→player navigation from D-007.
2. **HTTPS, which Pages gives free.** This is not cosmetic. `crypto.subtle` is
   `undefined` outside a secure context, and the catalog's checksum verification
   depends on it — this exact failure already killed the catalog once when the
   app was served over plain HTTP on the LAN. A LAN preview at
   `http://192.168.88.x:4173` is *not* a secure context; the deployed origin is.

Alternatives considered: GitHub Pages needs a `404.html` SPA hack and a public
repo; Netlify and Vercel are equivalent to Pages but would be a fourth vendor.
No reason to move off the one already wired in.

Also add, while deploying:

- [ ] `<meta name="theme-color">` and `apple-mobile-web-app-*` tags — this is
      used from an iPad home screen, and `index.html` currently carries only the
      viewport tag.
- [ ] A piece-not-found and attempt-not-found state for deep links whose
      IndexedDB records do not exist in this browser (O-7).

## Acceptance criteria

1. With the network blocked after a first visit: the app boots, My Pieces lists
   saved pieces, and a saved piece opens and plays.
2. Fonts render offline (no fallback-font flash).
3. A cold deep link to `/pieces/:id`, `/playlists/:id` (if T12 has landed) and
   `/reports/:id` resolves in the deployed build, not just in dev.
4. A deep link to a piece that is not in this browser's IndexedDB renders the
   not-found state with a route back to Home.
5. Samples are absent from the precache manifest; first play works before they
   finish downloading (synth fallback audible), then upgrades without an audible
   restart.
6. A service worker update does not strand a running session — new version
   activates on next load, not mid-practice.
7. Lighthouse: installable, offline-capable, no console errors on a cold load.
8. `crypto.subtle` is available on the deployed origin and catalog checksum
   verification runs — open a catalog piece on the live URL, not just locally.
9. Added to an iPad home screen, the app opens without browser chrome and the
   player still fits the viewport (D-027's `100dvh`).

## Verify

```bash
npm run build
npm run preview           # then: DevTools > Network > Offline, hard reload
npm run test:e2e -- --grep "offline|deeplink"
npm run check
```

## Done

- [ ] Seven criteria verified against the **production build**, not dev
- [ ] Precache manifest inspected; no sample assets in it, total size recorded
- [ ] Deployed once and deep links confirmed on the live URL
- [ ] Salamander CC-BY 3.0 attribution visible in the shipped UI

## Traps

- Verifying offline in `npm run dev` proves nothing — Vite's dev server bypasses
  the service worker. Always test `npm run preview` or the deployed build.
- An over-eager precache that swallows the samples blows the first-load budget
  and defeats D-008.
