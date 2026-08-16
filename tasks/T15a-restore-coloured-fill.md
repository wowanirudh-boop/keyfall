# T15a — Put the hand colour back in the countdown fill

**Depends on:** T15 · **PRD:** F5 · **Decisions:** D-022, D-047, D-051

---

## Goal

D-047 made the countdown fill near-black on white keys, because the hand colour
is only 1.79:1 against the new light key face. Anirudh has seen all three
candidates rendered on the real palette and **chosen the hand-coloured fill**
(D-051). Put it back.

This is a **one-branch revert, not a redesign.** Everything else D-047 did stays:
the light key face, the pressed-key ring, the black-key fill at `88`, the
borders, the labels. Those are what took identification from 1.09:1 to 17.35:1
and they are not in question.

## The change

`src/player/PianoKeyboard.tsx`, in the `prepare` fill:

```ts
background: geometry.black
  ? `${activeColor}${alpha.prepareFill}`
  : `${color.keyLitRing}${alpha.prepareFillDark}`,
```

becomes the same expression for both — `${activeColor}${alpha.prepareFill}`.
The branch disappears; white and black keys fill in the active hand colour at
alpha `88`. That is exactly the rendering Anirudh approved in
`docs/mockups/countdown-fill-on-white-keys.html` (the middle option).

Then:

- **Delete `alpha.prepareFillDark`** from `src/design/tokens.ts` — it has no
  remaining consumer — and drop it from the `toMatchObject` assertion in
  `src/design/keyboardContrast.test.ts`. Do not leave a dead token.
- **Revert the expectations T15 changed** in the two combined keyboard tests and
  the T07 highlight e2e test. T15's report names them; they were changed only
  because the fill went dark, so they go back to expecting the hand colour.
- **`color.keyLitRing` stays.** It is still the pressed-key ring, which is a
  different state and is unaffected.

## What must not change

- `keyWhiteFace: #F0F2F6`, `keyBlackFace: #0B0D11`, the borders and the labels.
- The 2px `#06121A` ring on a lit white key.
- The black-key fill alpha `88` — D-047 raised it from `66` for its own reason
  (2.42:1 → 3.47:1 on a black key) and that reason still holds.
- Every assertion in `keyboardContrast.test.ts` other than the
  `prepareFillDark` entry. **Do not weaken the black-key fill assertion, the
  ring assertions, the label assertions or the error assertion** to make
  anything pass. If one of them fails, that is a finding to report, not a number
  to edit.

## Pin the decision so it is not silently undone

Add an assertion that the white-key countdown fill uses the **hand colour**, not
`keyLitRing`. Someone reading D-047 later will see a 1.79:1 fill and try to
"fix" it; the test should stop them and point at D-051.

Do **not** add a ≥3:1 assertion for the white-key fill. It is 1.79:1 by
decision. Recording the exception is the job here, not enforcing a bar the
product owner has knowingly set aside.

## Acceptance criteria

1. A prepared white key fills in the hand colour — blue for the right hand,
   orange for the left — at alpha `88`, matching the approved mockup.
2. A prepared black key is unchanged from what T15 shipped.
3. `alpha.prepareFillDark` no longer exists anywhere in the repo.
4. The lit white key still carries its 2px ring; the key faces, borders and
   labels are byte-identical to T15.
5. A test asserts the white-key fill derives from the active hand colour and
   cites D-051.
6. No contrast assertion is removed or loosened except the `prepareFillDark`
   token entry.
7. `npm run check` and `npm run test:e2e` both pass, port 4181 free.
8. Verified on a production build at 375px and 1440×900, both hands, with a
   screenshot of a prepared white key in each hand colour.

## Traps

- The fill is drawn **behind** the label (`z-index`), and the label on a white
  key is `#5B626B`. Check the label is still readable where the fill has risen
  past it — if it is not, report it rather than changing the label colour, which
  is a D-047 value.
- Do not reopen the white key face colour. O-12 is closed, confirmed on the
  phone.
- Do not "compromise" by darkening the hand colour slightly. That option was
  shown and rejected on sight; ship the colour that was approved.
