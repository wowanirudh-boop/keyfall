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
- Web app manifest and the four install icons permitted by **D-035** — read it
  before creating any file under `public/icons/`. AGENTS.md #6 still forbids
  image assets everywhere else, and the guardrail below enforces it.

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

## Live URL

**https://piano-practice-player.wowanirudh.workers.dev** — deployed 2026-08-13,
Git-connected to `wowanirudh-boop/keyfall`, rebuilds on every push to `main`.

The earlier `piano-practice-player.pages.dev` is **dead** — that Pages project was
deleted when the target moved to Workers (D-037). A Workers deployment is served
from `<name>.<account-subdomain>.workers.dev`, not `.pages.dev`. Anything
bookmarked or added to a home screen under the old address must be re-added.

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

**Deploy as Workers Static Assets, Git-connected (D-037, supersedes D-036).**
Cloudflare has put Pages into maintenance mode; the dashboard no longer offers a
Git-connected Pages project, which is why there is no *Build output directory*
field. Two files in the repo replace the dashboard fields:

- `wrangler.jsonc` — assets-only, **no `main`**, with
  `not_found_handling: "single-page-application"` for deep links. This replaces
  `_redirects`, which must **not** be present: `/* /index.html 200` is rejected
  by Workers as an infinite loop and fails the whole deploy (D-037).
- `.node-version` containing `22` — `package.json` requires `node >=22.13.0` and
  the build image defaults lower. A file beats hunting for a build-variables
  field in a dashboard that keeps changing.

Dashboard settings then reduce to: repository, project name
`piano-practice-player`, build command `npm run build`, deploy command
`npx wrangler deploy`.

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
7. **Installable on the deployed origin.** Lighthouse's PWA category was removed
   in v12.0.0, so do not cite it. Check the criteria directly: DevTools →
   Application → Manifest reports no installability errors, and the browser
   offers an install affordance. No console errors on a cold load.
8. `crypto.subtle` is available on the deployed origin and catalog checksum
   verification runs — open a catalog piece on the live URL, not just locally.
9. Added to an iPad home screen, the app shows its own icon (not a screenshot
   of the page), opens without browser chrome, and the player still fits the
   viewport (D-027's `100dvh`).
10. `npm run check:guardrails` fails if anything under `src/` imports a file
    from `public/icons/`, and passes as shipped. The D-035 exception stays a
    packaging exception.
11. **`/manifest.webmanifest` is served with `Content-Type:
    application/manifest+json`** on the deployed origin. Verified 2026-08-13 on
    the live site: Cloudflare Pages sends **no `Content-Type` at all** for
    `.webmanifest`, while it correctly sends `image/png` for the icons — and
    `x-content-type-options: nosniff` is set, so the browser is forbidden from
    guessing. Chrome tolerated it (the manifest fetched, parsed and linked), but
    an untyped manifest behind `nosniff` is not something to rely on, and other
    browsers are stricter. Fix with a `public/_headers` file — the same Pages
    mechanism as the `_redirects` already shipped:

    ```
    /manifest.webmanifest
      Content-Type: application/manifest+json
    ```

    Check it with `curl -sSI https://<origin>/manifest.webmanifest`, not by
    inspecting the file in `dist/` — the file was always fine; the header was
    missing.

## Verify

```bash
npm run build
npm run preview           # then: DevTools > Network > Offline, hard reload
npm run test:e2e -- --grep "offline|deeplink"
npm run check
```

## Done

- [ ] Eleven criteria verified against the **production build**, not dev
- [ ] Exactly four files under `public/icons/`, no more (D-035)
- [ ] Precache manifest inspected; no sample assets in it, total size recorded
- [ ] Deployed once and deep links confirmed on the live URL
- [ ] Salamander CC-BY 3.0 attribution visible in the shipped UI

## Traps

- **`_redirects` and Workers Static Assets do not mix.** The Pages SPA rule
  `/* /index.html 200` is refused as a redirect loop, because `html_handling`
  strips `/index` and `.html`. Use `not_found_handling` instead and delete the
  file. `_headers` is fine and is still the AC11 mechanism.
- **Verify headers on the deployed origin, not files in `dist/`.** A correct
  file served with the wrong (or missing) `Content-Type` is a different bug
  and `dist/` cannot show it. AC11 exists because that gap was reported as a
  pass.
- **A build log naming a `wrangler.jsonc` that is not in the repo means
  Cloudflare generated one** — the config is missing or not being found. Fix
  that rather than chasing the `workerd` version mismatch it reports
  downstream (D-037).

- Verifying offline in `npm run dev` proves nothing — Vite's dev server bypasses
  the service worker. Always test `npm run preview` or the deployed build.
- An over-eager precache that swallows the samples blows the first-load budget
  and defeats D-008.
