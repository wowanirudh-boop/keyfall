# Algorithms — extracted from the design prototype

Every algorithm below is transcribed from
`design_handoff_piano_practice_player/Piano Practice Player.dc.html`
with line references. **Implement these exactly.** The handoff README says the
geometry, time→pixel mapping and report math "are the parts worth copying
verbatim as algorithms" — this file is that copy, so no one needs to re-read the
prototype.

Where this file says **CHANGED**, the prototype's approach does not survive
production constraints and the replacement is mandatory. Every **CHANGED** block
has a matching entry in `docs/decisions.md`; that file is the complete list of
deviations, and no others may be introduced without adding one.

---

## 1. Pitch helpers (prototype L329–370)

```ts
const BLACK_PITCH_CLASSES = [1, 3, 6, 8, 10];       // C#, D#, F#, G#, A#

// MIDI number -> display label. Sharps use U+266F (♯), NOT ASCII '#'.
function keyLabel(m: number): string {
  const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  return names[m % 12].replace('#', '♯') + (Math.floor(m / 12) - 1);
}
// keyLabel(60) === 'C4'   keyLabel(21) === 'A0'   keyLabel(108) === 'C8'
// keyLabel(66) === 'F♯4'  keyLabel(70) === 'A♯4'
```

## 2. Keyboard geometry (prototype L415–424)

Computed **once** for MIDI 21–108. All positions are percentages of keyboard width.

```ts
const whiteWidth = 100 / 52;                 // 1.923076...%
const blackWidth = whiteWidth * 0.62;        // 1.192307...%

let w = 0;                                    // count of white keys emitted so far
for (let m = 21; m <= 108; m++) {
  if (BLACK_PITCH_CLASSES.includes(m % 12)) {
    blacks.push({ midi: m, left: w * whiteWidth - blackWidth / 2, width: blackWidth });
  } else {
    whites.push({ midi: m, left: w * whiteWidth, width: whiteWidth });
    w++;
  }
}
```

Note the black-key `left` uses `w` **before** increment — i.e. the index of the
*next* white key — then shifts left by half a black width to straddle the gap.

Invariants (assert in tests): `whites.length === 52`, `blacks.length === 36`,
`whites[0].midi === 21`, `whites[51].midi === 108`, black keys carry
`z-index: 2` and height `62%`.

## 3. Waterfall time→pixel mapping (prototype L529–537, L659)

```ts
const pps = waterfallHeightPx / lookaheadSeconds;   // pixels per MUSICAL second
```

Per note, absolutely positioned inside the moving layer:

```ts
{
  left:       keyGeom.left + '%',
  width:      keyGeom.width * 0.86 + '%',
  marginLeft: keyGeom.width * 0.07 + '%',
  bottom:     note.start * pps + 'px',
  height:     Math.max(5, (note.end - note.start) * pps) + 'px',
  background: handColor,
  borderRadius: '3px',
  boxShadow:  `0 0 14px ${handColor}55`,
}
```

The containing layer moves once per frame:

```ts
{ position:'absolute', left:0, right:0, bottom:0, height:'100%',
  transform: `translateY(${t * pps}px)`, willChange: 'transform' }
```

A note whose `start === t` lands with its bottom edge exactly on the strike line
(the 1px `color.strikeLine` rule at the bottom of the stage). `pps` depends only
on measured height and lookahead — **never on speed**. That is what makes the
visible window constant in musical time; wall-clock preview grows as speed drops.

> Colour literals appear in the style blocks above only because they are
> transcribed from the prototype. In code every one of them comes from
> `src/design/tokens.ts` — `handColor` is `color.handRight`/`color.handLeft`, the
> glow suffix is `alpha.noteGlow`, and the guardrail rejects raw hex outside the
> design layer.

> **CHANGED — windowing is mandatory.** The prototype lays out *every* note in
> the piece. At the 30-minute upload limit a dense score is 10,000–16,000 notes,
> each an absolutely-positioned div with a glow, inside a layer ~350,000px tall
> carrying `will-change: transform`. That does not composite.
>
> Keep the single-`translateY` layer and the exact per-note styles above, but
> populate the layer from a **time window**: notes intersecting
> `[t - 2, t + lookaheadSeconds + 2]` in musical seconds, keyed by stable note
> id. Recompute the slice on seek, speed change and when `t` crosses the window
> margin — not every frame. Positions stay in absolute piece coordinates
> (`bottom: note.start * pps`), so the transform math is unchanged and notes do
> not shift when the window is rebuilt.

Lookahead overlay format string (prototype L661), exactly:

```ts
`${lookahead}S MUSICAL LOOKAHEAD · ${(lookahead / speed).toFixed(1)}S AT ${speed}x`
// 1x    -> "3S MUSICAL LOOKAHEAD · 3.0S AT 1x"
// 0.5x  -> "3S MUSICAL LOOKAHEAD · 6.0S AT 0.5x"
// 0.25x -> "3S MUSICAL LOOKAHEAD · 12.0S AT 0.25x"
```

## 4. Per-frame key state derivation (prototype L540–547)

Derived every frame, **never stored** (handoff: "Derived per frame (do not store)").

```ts
const press: Record<number, Hand> = {};
const prepare: Record<number, Hand> = {};
const error: Record<number, true> = {};

for (const n of notesSortedByStart) {
  if (n.start > t + lookaheadSeconds) break;          // notes MUST be start-sorted
  if (t >= n.start && t < n.end) {
    press[n.midi] = n.hand;
  } else if (t >= n.start - leadTime && t < n.start && !press[n.midi]) {
    prepare[n.midi] = n.hand;
  }
  // Flash runs for errorFlashMusicalSeconds from the instant the verdict was
  // PUBLISHED, not from note start. A `wrong` publishes on input; a `missed`
  // publishes when the note goes overdue at start + toleranceMs (D-011). Timing
  // the window from n.start would leave a missed note only 0.05s of flash.
  const v = liveVerdicts.get(n.id);            // { kind, publishedAt } | undefined
  if (listening && v && (v.kind === 'wrong' || v.kind === 'missed')
      && t >= v.publishedAt && t - v.publishedAt < errorFlashMusicalSeconds) {
    error[n.midi] = true;
  }
}
```

Precedence is strict: **error > press > prepare > idle**.

**What feeds `error[]` in production.** The prototype reads a precomputed fake
verdict array. In the app the error map is fed by the *live* grading pass
(§10), which publishes a provisional verdict per expected note:

- `wrong` — the moment a mismatched input is paired to that expectation.
- `missed` — when the expectation goes **overdue**, i.e. `t` passes
  `n.start + toleranceMs` with no matching input. This is knowable live and is
  what PRD F6 means by flashing on a missed note.

A provisional verdict may later be revised by the authoritative pass; the flash
is transient and the report always wins (D-003, D-011).

> **CHANGED — start from a cursor, not index 0.** The prototype scans from the
> first note every frame. Maintain a cursor index advanced monotonically with
> `t`, reset on seek (binary search). Same output, O(visible) per frame.

The error flash window `0.35` is in **musical** seconds — 350 ms at 1×, which is
what the handoff's "~350ms" describes, and 1.4 s of wall clock at 0.25×. Keep it
musical so the flash stays visually tied to the note that caused it and scales
with the learner's practice speed. `grading.errorFlashMusicalSeconds` is the
single source for this value; there is no separate millisecond constant.

## 5. Playback clock (prototype L454–476)

Prototype uses a rAF accumulator; production replaces it with the audio clock.

```ts
// Prototype:
const dt = Math.min(0.05, (now - last) / 1000);   // clamp survives tab-switch
let t = state.t + dt * state.speed;
if (a != null && b != null && t >= b) t = a;      // A–B loop
if (t >= duration) { t = duration; playing = false; }
```

Rules that must survive the rewrite:

- **Loop wrap:** `t >= b` snaps to `a` (never overshoots past `b`).
- **End:** playback stops at `duration`.
- **Play from end:** `if (t >= duration - 0.01) t = (a ?? 0)` before starting.
- **Seek:** clamp to `[0, duration]`.
- **Speed change:** takes effect immediately, position preserved.

> **CHANGED — Tone.js Transport is the clock.** Maintain one musical-time
> position at 1× and map it to the audio clock via the current speed. The
> `min(0.05, dt)` clamp is a rAF artefact and disappears. The engine is the sole
> authority for position; React reads snapshots from it.

## 6. A–B loop marker rules (prototype L493–494, L499–510)

These are asymmetric **by design** — transcribe exactly, do not "fix":

```ts
setA(): a = t;  if (b != null && b <= t) b = null;     // pushing A past B clears B
setB(): if (a != null && t <= a) { a = t; b = a_old; } // setting B before A swaps
        else { b = t; }
clearLoop(): a = null; b = null;

// Drag clamps (0.5s minimum separation):
dragA: a = Math.min(t, b != null ? b - 0.5 : duration);
dragB: b = Math.max(t, a != null ? a + 0.5 : 0);
```

While listen mode is active, `setA`/`setB` do nothing except show the transient
notice: *"A–B loop is off while listen mode runs. Stop listening to drill a section."*

## 7. Search folding and matching (prototype L357, L528)

```ts
// NOTE: the diacritic class below must be written with the escape form
// /[̀-ͯ]/g — literal combining marks do not survive copy/paste.
const fold = (s: string) => (s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')     // strip diacritics
  .replace(/[^a-z0-9 ]/g, ' ')         // punctuation -> space
  .replace(/\s+/g, ' ')
  .trim();

const q = fold(query);
const results = q ? catalog.filter(c =>
     fold(c.title).includes(q)
  || fold(c.composer).includes(q)
  || c.aliases.some(a => a.includes(q) || q.includes(a))   // bidirectional on ALIASES only
) : [];
```

Aliases are stored **already folded** in the manifest, so the bidirectional test
compares folded to folded. An empty-string alias would match every query — the
manifest validator rejects empty aliases.

Golden cases (must be tests): `"fur elise"` → Für Elise; `"gymnopedie"` →
Gymnopédie No. 1; `"FÜR ELISE"` and `"fur  elise!"` both match; empty query →
zero results (not all results); Escape clears the query. Include at least one
case that can only pass via an alias — a query matching neither the folded title
nor the composer — so the alias path is genuinely covered.

## 8. Time formatting (prototype L358–362)

```ts
const mmss = (t: number) => {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};
// mmss(0) === '0:00'  mmss(46) === '0:46'  mmss(125) === '2:05'
```

## 9. Report aggregation (prototype L583–601)

Transcribed against the canonical `NoteEvent.hand` type
(`'left' | 'right' | 'unknown'`), not the prototype's `'R' | 'L'`.

```ts
const NB = 26;                                     // report.bucketCount
const buckets = new Array(NB).fill(0);
const judgedTo = attemptEndTime ?? duration;

const tally = { correct: 0, wrong: 0, missed: 0, early: 0, late: 0, extra: 0 };
// Per-hand [correct, total]. 'unknown' is tracked but never displayed.
const hand = { left: [0, 0], right: [0, 0], unknown: [0, 0] };

for (const n of expectedNotes) {
  if (n.start > judgedTo) continue;                // only notes actually reached
  expected++;
  hand[n.hand][1]++;
  const v = verdictOf(n);                          // 'correct'|'wrong'|'missed'|'early'|'late'
  tally[v]++;
  if (v === 'correct') hand[n.hand][0]++;
  else buckets[Math.min(NB - 1, Math.floor((n.start / duration) * NB))]++;
}
tally.extra = extraNotes.length;                   // counted, never in `expected`

const accuracy      = expected ? Math.round((tally.correct / expected) * 100) : 0;
const pitchAccuracy = expected
  ? Math.round(((tally.correct + tally.late + tally.early) / expected) * 100)
  : 0;

const totalMistakes = buckets.reduce((a, b) => a + b, 0);
const maxBucket     = Math.max(1, ...buckets);     // the 1 floor guards empty
// indexOf(maxBucket) returns -1 when every bucket is 0, because maxBucket is
// then the synthetic 1. A flawless attempt has no worst bucket.
const worstIndex    = totalMistakes > 0 ? buckets.indexOf(maxBucket) : null;
```

`worstIndex === null` hides the footer's "HEAVIEST AT …" segment; it does not
render "HEAVIEST AT 0:00". Per-hand cards render only when
`piece.hasHandData === true`; `unknown` never appears in the UI.

Three details that are easy to get wrong and **must** match:

1. Buckets divide the **full piece duration**, not the played range — a partial
   attempt leaves the tail buckets empty rather than rescaling.
2. **Extra notes are counted and displayed but never enter the `expected`
   denominator.** They have no expected note, so they cannot.
3. `expected` counts notes with `start <= judgedTo` only, so an interrupted
   attempt is scored on what was actually reached.

Bucket bar rendering: `height: max(3%, count / maxBucket * 100%)`; empty bucket
`color.border2`; ordinary `color.handRight + alpha.timelineBar`; the heaviest
bucket **or** any bucket at or above `report.hotBucketThreshold` (70%) of max
renders `color.error`. Clicking a bucket → player at that bucket's start time,
paused, speed 0.5×.

## 10. Note matching — production only

The prototype's grading is fake (a deterministic hash, L400–413). Replace it
entirely. The design contributes only the formulas in §9.

**Two passes, and they are allowed to disagree.**

*Live pass* (streaming, drives the key error flash only): on each incoming
note-on, look for an unmatched same-pitch expectation within the candidate
window and classify provisionally as `wrong` or `extra`. Separately, an
expectation that goes overdue (`t > start + toleranceMs`, no match) publishes a
provisional `missed` — that is the point at which a missed note becomes
knowable, and PRD F6 requires flashing it (D-011). Live verdicts are provisional
and may be revised.

*Authoritative pass* (runs at attempt end over the recorded event log, produces
the report):

1. Build the candidate set: every (played, expected) pair with the same pitch
   whose onsets fall within `min(900ms, half the gap to the neighbouring
   same-pitch expectation)`.
   **The clamp matters:** sixteenth notes at ♩=120 are 125ms apart, so a flat
   ±900ms window spans ~7 notes and one mis-pairing cascades through a run.
2. Sort candidate pairs by `|Δt|` ascending and greedily accept, skipping pairs
   whose played note or expectation is already consumed. Ties break on stable
   note id so the pass is deterministic.
3. Accepted pair with `|Δt| <= 300ms` → **correct**; otherwise **early** (played
   before expected) or **late**.
4. Unconsumed played note: pair with the closest unconsumed expectation of *any*
   pitch within ±300ms → **wrong** (flag `octaveError` when the pitch classes
   match but octaves differ). Otherwise → **extra**.
5. Unconsumed expectation → **missed**.
6. Every expected and every played note resolves to exactly one verdict. Assert
   this: `correct + wrong + missed + early + late === expected` and
   `playedCount === correct + wrong + early + late + extra`.

Velocity, note-off duration and all pedal/CC messages are ignored for grading.
Chords are graded note-by-note; a chord is not "one event".

## 11. Clock-domain conversion — production only

Web MIDI `event.timeStamp` is in the `performance.now()` domain. Tone.js
position is in the `AudioContext` domain. Grading across the two without
conversion introduces a systematic 20–150ms bias (worse over Bluetooth) that
reads as "everything late" and destroys trust in the report.

```ts
// Sample periodically; both fields come from the same call.
const { contextTime, performanceTime } = audioContext.getOutputTimestamp();
const offset = performanceTime - contextTime * 1000;        // ms
const midiEventToMusicalTime = (ts: number) =>
  ((ts - offset) / 1000 - transportStartContextTime) * speedFactor;
```

Compensate for `audioContext.outputLatency` as well: the learner plays in time
with what they **hear**, so the reference is audible output time, not scheduled
time. Re-sample the offset at attempt start and on device change; do not compute
it once at boot.
