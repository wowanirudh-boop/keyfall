# T08 — Web MIDI and grading (F6)

**Depends on:** T07, S-3 results
**Handoff sections:** README §5 Listen setup, §4 listening pill and error flash
**Algorithms:** `docs/algorithms.md` §10, §11
**PRD:** F6 · **Decisions:** D-003, D-004, D-005, D-009

---

## Goal

Capture the learner's playing from the Roland RP302 and classify every note
honestly enough that they trust the report.

## Deliverables

`ListenModeToggle`, `ListenSetupModal`, `MidiDeviceRow`, `MidiUnsupportedError`,
`MidiInputController`, `ClockBridge`, `AttemptSession`, `AttemptGrader`.

## Behaviour

**Device flow** — request MIDI access **only** after the learner opens listen
setup, never on page load. List inputs with name, port and status dot. The
selected device stays visible while active (the §4 listening pill: "LISTENING ·
ROLAND RP302"). No device or unsupported browser → the §5 error with concrete
recovery steps (USB Computer port, power on, reopen, use Chrome/Edge).

**Starting** — picking a device resets to 0:00, clears A–B, and starts playback
(`tunables.listenAutoStart`, D-009). A–B controls are disabled while listening;
attempting to set a marker shows the 4.2 s notice instead.

**Ending** — an attempt ends on piece completion, stop/pause, seek, speed change,
or device disconnect (with a message for disconnects). The report covers the
portion actually played, always.

**Clock bridge (D-005)** — convert Web MIDI `event.timeStamp` into musical time
per §11, using `getOutputTimestamp()` and `outputLatency`, re-sampled at attempt
start and on device change. Use the baseline measured in S-3. **This is not
optional**: without it every note carries a 20–150 ms systematic bias that reads
as "everything late" and destroys trust in the report — the failure the PRD names
as fatal for F6.

**Grading — two passes (D-003, D-011).**
*Live:* streaming, drives only the key error flash — duration
`grading.errorFlashMusicalSeconds` (0.35 **musical** seconds, so 350 ms at 1× and
1.4 s at 0.25×). Publishes provisional `wrong` and `extra` on input, and
provisional `missed` when an expectation goes **overdue** (`t > start +
toleranceMs` with no match) — that is when a missed note becomes knowable, and
PRD F6 requires flashing it.
*Authoritative:* runs at attempt end over the recorded event log, per §10.
Deterministic, pure, no clock reads. The report always wins over the live flash.

**Attempt persistence is owned by this task.** `AttemptSession` writes the
completed `AttemptReport` to the `attempts` store on every ending path. T09 reads
and renders it. That keeps the five ending paths testable here rather than
straddling two tasks.

**Candidate window (D-004)** — `min(900ms, half the gap to the neighbouring
same-pitch expectation)`. A flat ±900 ms spans ~7 notes at sixteenths/♩=120 and
one mis-pairing cascades.

Velocity, note-off duration and all pedal/CC messages are ignored. Chords are
graded note-by-note.

## Acceptance criteria

1. Every grader category is asserted from a hand-built event log: correct, wrong
   (incl. octave-error subtype), missed, extra, early, late.
2. **Conservation** holds on every fixture:
   `correct + wrong + missed + early + late === expected` and
   `playedCount === correct + wrong + early + late + extra`.
3. Repeated same pitch at 125 ms spacing pairs one-to-one in order — no
   cascade. This is the D-004 regression test.
4. A chord played with one wrong note yields exactly one wrong and the rest
   correct — not a chord-level verdict.
5. The grader is deterministic: the same event log grades identically across 100
   runs, and contains no `Math.random`/`Date.now`/`new Date`.
6. Clock bridge converts a synthetic MIDI timestamp to musical time within 5 ms
   of the expected value, at each speed.
7. MIDI access is not requested until listen setup opens (assert no
   `requestMIDIAccess` call on page load).
8. Each of the five attempt-ending paths produces a stored report over the
   played portion, readable from IndexedDB after a reload.
9. Disconnect mid-attempt ends the attempt with a message, no crash, no hang.
10. A–B controls are disabled while listening and show the notice.
11. Live flash renders `missed` only once the expectation is overdue
    (`t > start + toleranceMs`), never at onset (D-011).
12. Pedal/CC messages arriving mid-attempt change nothing.
13. The flash lasts 0.35 musical seconds — verified as 350 ms at 1× and 1.4 s at
    0.25×, from the single `grading.errorFlashMusicalSeconds` constant.

## Hardware gate (manual, both Chrome and Edge)

- [ ] Roland RP302 enumerates and connects
- [ ] A deliberately clean run scores **≥ 95%**
- [ ] Deliberate wrong notes are **always** caught
- [ ] Measured clock offset and jitter recorded, compared against S-3's baseline
- [ ] Power-cycling the piano mid-attempt is handled per S-3's observed behaviour

**If the clean run fails, suspect the clock bridge before the matching
algorithm.** A uniform "everything is late" pattern is the D-005 signature.

## Verify

```bash
npm test -- src/listen src/grading
npm run test:e2e -- --grep "listen"
npm run check
```

## Done

- [ ] Thirteen criteria asserted
- [ ] Hardware gate completed and numbers recorded in `docs/spike-results.md`
- [ ] PRD R5 (tolerance at 0.25×) and R6 (permission UX) answered from real use

## Traps

- Grading off audio time instead of MIDI timestamps silently reintroduces the
  bias the clock bridge exists to remove.
- Extra notes must never enter the `expected` denominator.
- The live pass and the authoritative pass are allowed to disagree; that is the
  design. Do not try to reconcile them by weakening the offline pass.
- `src/grading/` is guardrail-scoped for determinism: no `Math.random`,
  `Date.now`, `new Date`, `performance.now` or `crypto.randomUUID` in it. Clock
  reads belong in `src/listen/ClockBridge`, which converts timestamps *before*
  they reach the grader.
