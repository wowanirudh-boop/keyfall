# T10a — Returning users are stuck on an old version forever

**Depends on:** T10 · **PRD:** F3 · **Decisions:** D-036, D-037, D-050

---

## The bug

The site shows the Rousseau playlist in a private window and not in a normal
one. It is not a stale CDN cache. The deployed build is correct — the live
`sw.js` precaches `catalog/playlists.json`. The service worker simply never
takes over.

`vite.config.ts` sets `registerType: "prompt"` with `skipWaiting: false`. The
generated worker therefore only steps aside when the page sends it a message:

```js
self.addEventListener("message", (e) => {
  e.data && e.data.type === "SKIP_WAITING" && self.skipWaiting();
});
```

**Nothing in `src/` ever sends that message.** There is no `useRegisterSW`, no
`onNeedRefresh`, no update UI of any kind. So on a browser that visited before,
the new worker installs, enters `waiting`, and stays there. A reload does not
help — the page stays under the old worker's control, so the old precache keeps
being served. A private window has no prior worker, installs the current one,
and shows the playlist.

**The blast radius is every deploy since T10**: T11's mobile fixes, T12a's
playlist, T13's 13 new pieces and T13a's attribution fix have all been invisible
to any returning browser. Treat this as the reason the app has appeared frozen,
not as one missing playlist.

Manual escape, for reference: closing **every** tab and window on the origin
releases the old worker, and the waiting one activates on the next visit. That
is not a fix to ship — it is the thing users will never think to do.

## What to build

Implement the prompt the configuration already assumes. Keep
`registerType: "prompt"` and `skipWaiting: false`.

Use `virtual:pwa-register/react`'s `useRegisterSW`. When `needRefresh` is true,
show a dismissible notice — *"A new version is ready."* with a **Reload**
control — and call `updateSW(true)` when it is chosen. That posts `SKIP_WAITING`
and reloads once the new worker takes control.

Follow the existing visual language: this is the `TransientNotice` /
`StatusBanner` family in `src/design/`, mono label, no new colours (AGENTS.md
#4), glyphs only. It must not overlap the transport at 375px.

**Do not switch to `autoUpdate`, and do not reload automatically.** This app is
used *while playing the piano*. A silent reload mid-piece stops playback, loses
the practice position and drops any A–B loop the learner set up. The user
chooses the moment. That is also why `skipWaiting` stays false: it avoids
swapping assets under a page that is mid-session and may still lazily load the
Verovio bundle or the import worker.

The notice must **not** auto-dismiss on a timer the way `TransientNotice` does —
a missed 4-second toast leaves the user stuck exactly as they are now. It stays
until dismissed or acted on.

## Acceptance criteria

1. With an older worker installed, loading the site shows the update notice, and
   choosing Reload brings the new version — the playlist appears without the
   user closing any tabs.
2. Dismissing the notice leaves the app fully usable on the old version, and the
   notice returns on the next load while an update is still waiting.
3. A first-time visitor never sees the notice.
4. No automatic reload happens at any point. Prove playback is uninterrupted:
   start a piece, trigger an update, confirm audio and position continue.
5. Offline still works — the T10 assertions in `home.e2e.ts` and the `sw.js`
   precache inspection in `foundation.e2e.ts` still pass unchanged.
6. No horizontal page scroll at 375px with the notice visible, and it does not
   cover the transport.
7. `npm run check` and `npm run test:e2e` both pass, port 4181 free.

## How to test it — this is the hard part

The failure only reproduces against a **previously installed** worker, so a
private window proves nothing.

1. `npm run build && npm run preview`, load the app, confirm a worker is active.
2. Change something visible, rebuild, and serve again **on the same origin and
   port** so the browser sees a new worker for the same scope.
3. Reload. The notice must appear. Choosing Reload must show the change.

An e2e test is worth writing here even though it is fiddly: this defect hid a
month of deploys, and it will recur silently if nothing watches it. If a full
automated version proves impractical, say so and cover what you can — for
instance asserting that the built `sw.js` contains the `SKIP_WAITING` listener
**and** that the app bundle contains a caller that posts it. That pairing is the
exact thing that was missing.

## Traps

- Verify against a **production build**. The worker does not behave the same in
  `vite dev`.
- `clientsClaim: true` does not rescue this. It only applies once the worker
  activates, and it cannot activate while the old one controls a client.
- Do not "fix" it by disabling the service worker or dropping the precache. The
  offline requirement is real (PRD F3, T10) — the iPad is used without a network.
- Do not bump the database version or touch catalog data.
