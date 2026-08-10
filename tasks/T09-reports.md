# T09 — Reports and attempt history

**Depends on:** T08
**Handoff sections:** README §6 Post-run report
**Algorithms:** `docs/algorithms.md` §9 · **Decisions:** D-007
**PRD:** F6 (report clauses)

---

## Goal

Turn a graded attempt into something that changes what the learner practises
next.

## Deliverables

`ReportScreen`, `ReportHeader`, `AccuracyCard`, `PitchAccuracyCard`,
`HandAccuracyCard`, `MistakeTypeGrid`, `MistakeTimeline`, `AttemptHistory`.

## Calculations — exactly per §9

```
accuracy      = correct / expected
pitchAccuracy = (correct + early + late) / expected
```

Three details that are easy to get wrong:

1. **Extras are counted and displayed but never enter the `expected`
   denominator.** They have no expected note, so they cannot.
2. **Buckets divide the full piece duration**, not the played range. A partial
   attempt leaves the tail buckets empty rather than rescaling.
3. `expected` counts only notes with `start <= attemptEnd`, so an interrupted
   attempt is scored on what was actually reached.

Per-hand accuracy renders **only** when `hasHandData === true`; otherwise the
BY HAND card is omitted entirely.

## Timeline

26 bars, `height: max(3%, count / maxBucket × 100%)`. Empty `color.border2`;
ordinary `color.handRight + alpha.timelineBar`; the heaviest bucket **or** any
bucket at or above `report.hotBucketThreshold` of max in `color.error`. Footer:
`0:00` · `HEAVIEST AT 0:16–0:20` · total duration. Header right: "CLICK A BAR TO
PRACTISE THERE".

**Relative dates in the attempt history** ("TODAY · 18:42", "YESTERDAY · 19:10")
read the clock, which report *aggregation* must never do. Put the formatting in a
presentation helper that takes `now` as an argument, so the aggregation stays
pure and the formatter stays testable.

**Clicking a bar** navigates to `/pieces/:id?t=<bucketStart>&speed=0.5`, paused
(D-007). Invalid or missing params fall back to `t=0, speed=1`.

## History

T08 writes attempts to IndexedDB; this task reads and renders them. Listed newest
first, the current attempt's percentage in `color.handRight`. No charts — the
PRD explicitly says a simple list is enough for V1.

## Acceptance criteria

1. Both formulas match §9 on hand-built fixtures, including the rounding
   (`Math.round(x * 100)`).
2. A fixture with extras proves they appear in the mistake counts and **not** in
   the denominator.
3. A partial attempt (`attemptEnd` at 40% of duration) scores only notes reached,
   and the tail buckets are empty — not rescaled.
4. Bucket boundaries: a note at `start === duration` lands in bucket 25, not 26
   (the `Math.min(NB - 1, …)` clamp).
5. The heaviest bucket and any bucket ≥ 70% of max render in the error colour.
6. Clicking a bucket lands on the player at that time, paused, at 0.5×.
7. A report with zero mistakes renders every bucket empty and 100% accuracy
   without dividing by zero, and **omits the "HEAVIEST AT …" footer segment**
   rather than pointing at bucket 0 — `worstIndex` is `null` when there are no
   mistakes (`docs/algorithms.md` §9).
8. `hasHandData === false` omits the BY HAND card entirely.
9. Attempts survive a page reload and list newest first.
10. A malformed or unknown `attemptId` renders a not-found state, not a crash.

## Verify

```bash
npm test -- src/report
npm run test:e2e -- --grep "report"
npm run check
```

## Done

- [ ] Ten criteria asserted
- [ ] Every Report state in `docs/design-contract.md` §3 verified at both viewports
- [ ] Round-trip verified: play → interrupt → report → click bucket → practise

## Traps

- Rescaling buckets to the played range would make two attempts
  non-comparable — the whole point of the history list. Divide by full duration.
- `Math.max(1, ...buckets)` guards the empty case; a naive `Math.max(...[])` is
  `-Infinity`.
