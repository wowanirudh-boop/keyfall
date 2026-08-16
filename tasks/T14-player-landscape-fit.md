# T14 — The landscape phone player, with every control still on screen

**Depends on:** T13b (a green e2e suite, so a failure found here is this task's)
**Handoff sections:** README §4 header, waterfall, transport rows 1 and 2
**PRD:** F3, F4 · **Decisions:** D-046 (extending D-027, D-031)
**Design reference:** `docs/mockups/player-landscape-fit.html`

---

## Why

Measured on the deployed app via Playwright, opening *Air — BWV Anh. 131*:

| Viewport | Header | **Notes** | Keyboard | Transport | Notes' share |
|---|---|---|---|---|---|
| 932×430 | 71 | **126** | 112 | 121 | 29% |
| 932×390 | 71 | **86** | 112 | 121 | 22% |
| 932×340 | 71 | **36** | 112 | 121 | 10% |
| 932×320 | 71 | **16** | 112 | 121 | **5%** |
| 667×375 | 105 | **37** | 112 | 121 | 10% |
| 1024×768 | 71 | 461 | 115 | 121 | 60% |

Read D-046 first. **The single most important constraint in this task: no control
may be hidden, collapsed into a menu, or auto-hidden at any size.** An earlier
draft proposed exactly that and was rejected — slowing a passage and looping four
bars are the things this player exists for, and they have to be there when you
look. If a layout only fits by hiding something, the layout is wrong.

Four changes, in this order. **1 is independent and fixes the reported symptom** —
do it first and verify it alone.

## 1. The scroll that reveals nothing

`src/design/globals.css` sets `min-height: 100%` on `html`, `body` and `#root`.
`PlayerView` sizes its shell to `100dvh` (D-027). On a phone `100%` resolves
against the initial containing block — the viewport with the toolbars *hidden* —
while `100dvh` is the viewport as it stands. The difference is scrollable empty
space exactly one toolbar tall.

- Change the three `min-height: 100%` rules to `min-height: 100dvh`, keeping
  `100%` as the preceding declaration so browsers without `dvh` still get a floor.
  This mirrors what `PlayerView` already does with `h-screen`.
- **Home and Report must still scroll.** Do not add `overflow: hidden` to `html`
  or `body`. The player shell's own `overflow-hidden` is enough once the heights
  agree.
- `index.html`: add `viewport-fit=cover` to the viewport meta, then pad the
  header, transport and keyboard container with `env(safe-area-inset-left/right/
  bottom)` via `max()` against the existing padding, so desktop is unchanged.
  Without `cover` iOS letterboxes landscape and throws away width on a notched
  device; with it and no padding, controls land under the notch.

## 2. Density, measured from the shell

`PlayerView` already measures its own width with a `ResizeObserver`
(`useMeasuredWidth`). Widen it to `useMeasuredSize` returning `{ width, height }`.

```
height >= 620  ->  'comfortable'
otherwise      ->  'compact'
```

Put the threshold in `src/design/tokens.ts` as a `playerDensity` export beside
`keyboard`, so it is data rather than a magic number in JSX. Add `data-density`
to the shell — the e2e tests assert on it and it makes the state visible when
driving the app by hand. Apply 12px of hysteresis at the boundary, or a shell
sitting on the threshold flips every frame while a toolbar animates.

**Not a media query.** A rotation, a fullscreen toggle, an iPad split view and a
toolbar sliding away all move this one number; `@media (max-height:)` sees two of
the four.

## 3. What `compact` looks like

| | `comfortable` (≥620px) | `compact` (<620px) |
|---|---|---|
| Header | 71px, two lines — **unchanged** | 44px, one line |
| Transport | 121px, two rows — **unchanged** | 52px if ≥820px wide, else 88px |
| Keyboard | `clamp(112px, 15vh, 158px)` | `clamp(96px, 24vh, 158px)` |

**Above 620px nothing changes.** 1440×900, 1024×768 and 768×1024 are all
`comfortable` and must render pixel-identically to today. That is criterion 1 and
the one most likely to break by accident.

**Compact header**, one row, in order: `←` ghost button · title line · hand-colour
swatch button · volume slider · Audio on/Muted · Listen mode · fullscreen (§4).
The title line carries title and metadata together —
`Air — BWV Anh. 131 · BACH · MUTOPIA CATALOG` — truncating from the right, so the
information survives one row shorter. The `w-full` wrap from D-027 becomes
conditional on narrow **and** tall; sideways it is exactly wrong, because width is
the plentiful dimension.

**Compact transport.** Measured natural widths at 1440×900: play 46 · time 96 ·
SPEED group 210 · LOOP group 214 = **566px fixed**.

- **≥820px wide — one row, 52px:** play (34px) · time · seek bar (flexible) ·
  SPEED group · LOOP group. At 932px that leaves ~250px of seek bar, at 844px
  ~160px.
- **<820px wide — two rows, 44px each:** seek row (play · time · seek), then
  speed and loop sharing the row below.

The seek bar keeps its **34px hit area and `touch-action: none`**
(design-contract §4). Shrink the visual bar, never the target — the row is 44–52px
tall precisely so the target still fits.

**The three things that drop, none of them a control:**

1. The `← → SKIP 5 SECONDS` hint. It names two keys on a hardware keyboard, on a
   device without one. The shortcuts themselves keep working.
2. The RIGHT / LEFT text legend — already hidden below `lg` today; the swatches
   say the same thing.
3. The title's second line, per above — merged, not removed.

Nothing else. No `⋯` menu, no sheet, no disclosure, no auto-hide.

## 4. The fullscreen toggle

A `TogglePill` reading `Full screen` / `Exit full screen`, beside the mute toggle,
rendered **only if `document.fullscreenEnabled` is true** — feature detection,
never a user-agent check. On click, inside the same gesture:

1. `shell.requestFullscreen()`, falling back to `webkitRequestFullscreen` if it is
   the only one present.
2. `screen.orientation.lock('landscape')`, wrapped so a rejection is swallowed. It
   is unsupported on iOS and rejects outside fullscreen on Android. **A failed
   lock must never fail or reverse the fullscreen.**

Listen to `fullscreenchange` for the label, so Escape or a system gesture does not
leave the pill lying. `screen.orientation.unlock()` on exit if it was locked.

**Expect the pill to be absent on an iPhone.** Safari there has never reliably
offered the Fullscreen API for non-`<video>` elements. That is correct behaviour,
not a defect — do not add a "your browser does not support this" message, render
nothing. §2 and §3 are what carry this task.

No new glyph: `⛶` and `⤢` have unreliable font coverage across iOS and Android,
and hard rule 6 forbids an icon library or SVG. The pill carries words, like
`Audio on` and `Listen mode`.

## Acceptance criteria

1. **At 1440×900, 1024×768 and 768×1024 the player is pixel-identical to before
   this task.** Screenshots before and after, compared, both saved.
2. `document.documentElement.scrollHeight === clientHeight` on the player route at
   932×430, 932×320, 844×390 and 667×375 — and Home and Report still scroll.
3. **Every control present at `comfortable` is visible and operable at `compact`,
   with no interaction to reveal it**: Library, hand colours, hand mapping,
   volume, mute, Listen mode, play/pause, seek, all three speeds, Set A, Set B,
   Clear. A test enumerates them at both densities and asserts each is visible.
   This is the criterion that defines the task.
4. Notes area ≥ 210px at 932×430, ≥ 120px at 932×320, ≥ 140px at 667×375 —
   versus 126, 16 and 37 today.
5. `data-density` reads `comfortable` at 900px tall and `compact` at 430px; a
   resize across the boundary does not oscillate.
6. The transport is one row at ≥820px wide and two at narrower, both at
   `compact`; the seek bar's hit area is ≥34px tall in every case, and A/B markers
   still drag by pointer at 430px tall.
7. The header is one row at `compact` at every width from 667px up, and the title
   line still shows composer and source, truncated.
8. The fullscreen pill is absent when `document.fullscreenEnabled` is false and
   present and working when true — both asserted, the first by stubbing.
9. `screen.orientation.lock` rejecting does not prevent or reverse fullscreen.
10. No horizontal page scroll at 320, 375, 390, 430, 667, 768, 820, 844, 932,
    1024 or 1440px.
11. Nothing anywhere in the player auto-hides, on any timer, at any density.

## Verify

```bash
npm test -- src/player src/transport
npm run test:e2e -- --grep "player|density|fullscreen"
npm run check
```

`npm run test:e2e` needs port 4181 free. Run the full e2e suite as well — this
touches a screen, and per D-045 a failure found here belongs to this task until
evidence says otherwise.

## Done

- [ ] Eleven criteria asserted; 1, 3 and 11 explicitly — they are the whole point
- [ ] Before/after screenshots at 1440×900, 1024×768, 768×1024, 932×430, 932×320,
      844×390, 667×375 saved and attached
- [ ] `docs/design-contract.md` §4 updated: the responsive gate names both
      densities and the landscape sizes
- [ ] Report states whether the fullscreen pill rendered in the browser tested,
      and which browser that was

## Traps

- **The fidelity gate is the risk, not the phone.** Anything reading the measured
  height that also applies at `comfortable` is a bug. Gate on the density value,
  never on a raw pixel comparison inlined at the call site.
- **If something will not fit, say so — do not hide it.** The answer is a smaller
  control, a tighter gap or a second row, never a menu. If none of those work at
  some size, stop and report it rather than inventing a disclosure.
- `useMeasuredWidth` ignores a zero measurement to survive first paint. Keep that
  for height too, or a shell measured at 0 falls into `compact` for one frame and
  flashes the wrong layout.
- The keyboard window (D-031) is a function of **width** and is untouched here. At
  932px landscape it already returns all 88 keys. Do not couple it to density.
- Do not derive density in an effect — that paints the wrong layout for a frame on
  rotation. Derive it during render, as `keyboardWindowFor` already does.
- The transient notice and the import notice strip are content, not chrome. They
  stay.
