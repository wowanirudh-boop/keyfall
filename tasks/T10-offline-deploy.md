# T10 — Offline packaging and deployment

**Depends on:** T09 (or the MVP gate, if shipping MVP before V1)
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

## Acceptance criteria

1. With the network blocked after a first visit: the app boots, My Pieces lists
   saved pieces, and a saved piece opens and plays.
2. Fonts render offline (no fallback-font flash).
3. A cold deep link to `/pieces/:id` and `/reports/:id` resolves in the deployed
   build, not just in dev.
4. A deep link to a piece that is not in this browser's IndexedDB renders the
   not-found state with a route back to Home.
5. Samples are absent from the precache manifest; first play works before they
   finish downloading (synth fallback audible), then upgrades without an audible
   restart.
6. A service worker update does not strand a running session — new version
   activates on next load, not mid-practice.
7. Lighthouse: installable, offline-capable, no console errors on a cold load.

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
