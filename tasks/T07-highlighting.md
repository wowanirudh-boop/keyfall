# T07 — Anticipatory key highlighting (F5)

**Depends on:** the MVP gate, which closes at the end of T03
**Handoff sections:** README §4 keyboard — prepare state, press-now state
**Algorithms:** `docs/algorithms.md` §4
**PRD:** F5

---

## Goal

The learner's hands are ready before the note, and unmistakably cued at the
moment it sounds.

## Deliverables

Extend `PianoKeyboard` with the **prepare** state and the press-now **label
enlargement**. The pressed/sounding key style itself already shipped in T05 (PRD
F3 is an MVP clause). No new components.

## Behaviour

**Prepare** — begins `tunables.highlightLeadTimeSeconds` (1.0) **musical**
seconds before onset, so 0.25× gives 4.0 s of wall clock automatically. Style:
bg `color.keyWhitePrepare` / `color.keyBlackPrepare`, border `1px solid
<hand> + alpha.prepareBorder`, `shadow.prepareKey(hand)`, label coloured in the
hand colour.

**Press-now label enlargement** — the key colour/glow already changes at onset
(T05). What this task adds is the label **font-size jump**: 9→13px (white),
7→10px (black), from `keyLabelSize`, transitioned over `motion.keyLabelMs`
(60 ms linear), with weight 500 and `color.onAccent`. Key background continues to
transition over `motion.keyBackgroundMs` (40 ms linear). Reverts when the note
ends.

The font-size jump is the learner's explicit "font goes bigger" cue from the
PRD. It is not decorative — do not soften it into an opacity or scale change.

**Overlaps** — every simultaneously upcoming note highlights. Hand colours are
preserved in both prepare and press states. A key already pressed is never shown
as preparing (`!press[midi]` guard in §4).

Lead time stays one internal constant. **No settings screen** — the PRD excludes
settings expansion.

## Acceptance criteria

1. At 1×, a key enters prepare exactly 1.0 s before its note's `start`.
2. At 0.25×, the same transition happens 4.0 s of wall clock before onset, and
   still 1.0 musical second before — assert both framings.
3. The label enlargement begins at `start` and reverts at `end`, within one frame.
4. Label font-size is 9→13 (white) and 7→10 (black) px across the transition,
   read from `keyLabelSize`.
5. A chord highlights every constituent key, each in its own hand colour.
6. A key that is pressed and also has an upcoming note does not render prepare.
7. Prepare and press-now render correctly when `hasHandData === false` (single
   colour).
8. No measurable frame-time regression versus T05 on the dense fixture.

## Verify

```bash
npm test -- src/player
npm run test:e2e -- --grep "highlight"
npm run check
```

## Done

- [ ] Eight criteria asserted, criterion 2 in both time framings
- [ ] Side-by-side visual check against the prototype's prepare/press states
- [ ] No settings UI added

## Traps

- Lead time is musical, not wall-clock. Getting this wrong makes slow practice
  give *less* preparation instead of more — the exact opposite of the point.
- The prepare guard is `!press[midi]`, evaluated against the same frame's press
  map. Order matters.
