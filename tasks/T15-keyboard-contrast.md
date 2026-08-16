# T15 — White keys white, black keys black

**Depends on:** nothing. Independent of T14; either order works.
**Handoff sections:** README §4 keyboard (4 states: idle / prepare / press-now / error)
**PRD:** F3, F5 · **Decisions:** D-047 (preserving D-022's encoding)
**Design reference:** `docs/mockups/keyboard-contrast-options.html`

---

## Why

`keyWhiteFace: #151821` beside `keyBlackFace: #0C0E11` is **1.09:1** — measurably
one colour. WCAG 1.4.11 requires 3:1 to identify a control, and telling a white
key from a black key is the whole job of this component. In daylight the ratio
falls to 1.02:1, which is why the phone is worse than the laptop.

Read D-047 before starting. **This changes design tokens the handoff specifies**,
which hard rule 4 forbids without a decision — D-047 is that decision. Do not
extend it to any colour it does not name.

## 1. The palette

`src/design/tokens.ts` and the matching `@theme` block in
`src/design/globals.css`. These two must stay in step (D-014); changing one and
not the other is the classic failure here.

| Token | From | To |
|---|---|---|
| `keyWhiteFace` | `#151821` | `#F0F2F6` |
| `keyBlackFace` | `#0C0E11` | `#0B0D11` |
| `keyWhiteBorder` | `#252A32` | `#767D88` |
| `keyBlackBorder` | `#20242B` | `#363D48` |
| `keyWhitePrepare` | `#161B21` | `#EAEDF3` |
| `keyBlackPrepare` | `#14181D` | `#12161C` |
| `keyWhiteLabel` | `#5E6672` | `#5B626B` |
| `keyBlackLabel` | `#4A515A` | `#9AA1AB` |

Two additions, both named by D-047:

- `keyLitRing: '#06121A'` — the outline on a lit white key, and the countdown
  fill on a prepared one.
- `alpha.prepareFillDark: 'E6'` — that fill's alpha over a white key.

One change to an existing alpha:

- `alpha.prepareFill: '66'` → `'88'`. On a black key `66` is 2.42:1 against the
  face — under the bar since it shipped, invisible for the same reason everything
  else was. `88` gives 3.47:1.

Resulting figures, all computed live in the design reference:

| | Now | After |
|---|---|---|
| White key vs black key | 1.09:1 | **17.35:1** |
| ...in daylight | 1.02:1 | **5.33:1** |
| White key vs the line between two white keys | 1.23:1 | 3.70:1 |
| White key label | 3.06:1 | 5.50:1 |
| Black key label | 2.41:1 | 7.46:1 |
| Error state on a white key | 2.12:1 (at the drafted ivory) | 3.08:1 |

`keyBlackBorder` at 1.78:1 against its own face is **deliberately not held to
3:1**. It is dimension, not identification — a black key is 17.35:1 against the
white keys either side of it, and that is what tells you which key it is. Say so
in a comment so the next person does not "fix" it.

## 2. The lit key gains a ring

`#4CC2FF` against a white key is 1.79:1 — a lit white key would read by hue
alone, which fails in greyscale and for a colour-blind viewer. In `keyStyle`,
when `state.kind === 'pressed'` **and the key is white**, add
`outline: 2px solid keyLitRing; outline-offset: -2px`, so the ring sits inside
without changing the key's box. The border stays the hand colour and the glow
shadow is unchanged. The ring is 16.89:1 against the white face and 9.44:1
against the accent.

Black keys get no ring — a lit black key is already 9.69:1 against its own face.

The `error` state keeps `errorKeyBorder` and its glow unchanged, and now clears
3:1 against a white key on its own. Verify it; do not redesign it.

## 3. The countdown fill runs dark on a white key

D-022's encoding — **fill height equals imminence, chords fill identically** — is
unchanged. Only the colour is.

- **White key:** `keyLitRing` at `alpha.prepareFillDark`. 13.40:1 against the key,
  7.49:1 against an accent-lit neighbour, and it reads as the key filling with
  shadow.
- **Black key:** `activeColor` at `alpha.prepareFill` (now `88`).

Hand identity on a prepared white key is carried by the border and the inset
hand-coloured glow, both already there and both unchanged. The fill carries
imminence only — which is all D-022 ever specified it to carry.

The label on a prepared white key must survive the fill rising past it: it sits at
the bottom of the key, so once the fill covers it the label needs to be light.
Set the prepared white-key label to `keyWhiteFace` — the idle relationship,
inverted. The prepared black-key label stays `activeColor`.

## Acceptance criteria

1. `tokens.ts` and the `@theme` block carry identical values for all ten keyboard
   entries plus the two additions; a test asserts they cannot drift.
2. A unit test computes WCAG contrast from the token values and asserts:
   white face vs black face ≥ 3:1; white face vs `keyWhiteBorder` ≥ 3:1; both key
   labels ≥ 4.5:1 against their faces; `keyLitRing` ≥ 3:1 against both
   `keyWhiteFace` and `handRight`; the error colour ≥ 3:1 against `keyWhiteFace`;
   and the black-key countdown fill composited over `keyBlackFace` ≥ 3:1.
   **This test is the deliverable** — it is what stops the palette drifting back.
3. A lit white key renders the 2px `keyLitRing` outline; a lit black key does not.
4. A prepared white key's fill is `keyLitRing` at `prepareFillDark`; a prepared
   black key's is `activeColor` at `prepareFill`. Fill height still equals
   `imminence` and chords still fill identically — the existing D-022 tests must
   pass **unmodified**.
5. All four keyboard states render correctly for both key colours, both hands, and
   the single-colour case when a piece has no hand data. Twelve combinations;
   enumerate them.
6. Hand-colour selection (D-026) still works: every palette option produces a
   readable lit key on a white key. Assert the ring is present for each.
7. `npm run check:guardrails` passes — no raw hex escaped `src/design/`.
8. Existing keyboard and waterfall tests pass unmodified. Any test that must
   change is named in the report with the reason.

## Verify

```bash
npm test -- src/player src/design
npm run test:e2e -- --grep "keyboard|highlight"
npm run check
```

`npm run test:e2e` needs port 4181 free. Run the full suite: this touches a
screen, and per D-045 a failure found here belongs to this task until evidence
says otherwise.

## Done

- [ ] Eight criteria asserted, 2 explicitly
- [ ] Screenshots of the keyboard in all four states at 1440×900 and 932×430,
      attached to the report
- [ ] `docs/design-contract.md` §5 updated: D-047 added to the permitted visual
      deviations beside D-006, D-009, D-011 and D-012
- [ ] Report states whether anything outside the keyboard shifted visually. The
      answer should be nothing

## Traps

- **Change only the tokens listed.** The stage, waterfall, strike line, notes and
  hand colours are out of scope. If a change appears to need one of them, stop and
  say so.
- `handColors.tsx` resolves the active colour per hand. The ring is a property of
  the **key**, not the hand — do not thread it through the hand palette.
- The keyboard is drawn twice over: `PianoKeyboard` for the keys and
  `WaterfallStage` for the notes above, sharing `keyboardGeometry`. Notes are
  unchanged. If a note's appearance moves, something has leaked.
- `keyWhiteFace` is **`#F0F2F6`, confirmed by Anirudh on 2026-08-16** after
  comparing it against pure `#FFFFFF` on the device (O-12, closed). Do not
  substitute `#FFFFFF`, and do not "round" it to a neater value — the choice was
  made by eye on the screen this app is used on, which no contrast figure
  overrides.
