# T00 spike results

Measured 2026-08-11. The spike harnesses are intentionally isolated under
`spikes/`; the deterministic scale fixture is the one production-tree
exception required by T00.

## S-1 — Waterfall performance at scale

**Command:** `npm run dev -- --host 127.0.0.1 --port 4190 --strictPort`, then
open `/spikes/waterfall/index.html?strategy=full` and
`/spikes/waterfall/index.html?strategy=windowed`.

The page used the seeded default fixture: 1,800 seconds, 16,000 sorted notes,
mixed six-note chords, sustained notes, dense passages, and both hands. The
measurement ran in the Codex in-app Chromium browser at an explicit 1440×900
viewport on a 144 Hz display. Both strategies used one absolutely positioned
note layer and one `translate3d` update; B retained only notes intersecting
`[t-2, t+lookahead+2]` with a three-second lookahead.

| Metric | A: full layer | B: windowed |
| --- | ---: | ---: |
| Notes in DOM after seek | 16,000 | 71 |
| Time to first paint | 185.5 ms | 8.3 ms |
| Playback frame rate | 144.24 fps | 144.24 fps |
| JS heap before playback | 11.84 MiB | 12.12 MiB |
| JS heap after five seconds | 7.97 MiB | 11.90 MiB |
| Heap delta | -3.86 MiB | -0.22 MiB |
| Deterministic random seek target | 1,112.461 s | 1,112.461 s |
| Seek repaint | 142.6 ms | 12.5 ms |

The windowed result sustains well above 58 fps, has stable heap use over the
playback interval, and repaints a seek in 12.5 ms, below the 100 ms limit. The
full layer also composites efficiently enough to animate on this machine, but
its first paint is 22× slower and its seek misses the limit at 142.6 ms.

The layer's computed style was a transform matrix with
`will-change: transform` in both runs. The automated in-app browser does not
expose DevTools' Rendering → Layer borders overlay, so the border visualization
itself was not directly observed; this is the only S-1 instrumentation limit.

**Verdict: PASS — D-002 confirmed for the population strategy.** B passes every
numeric gate and removes 15,929 DOM nodes at the sampled seek. Keep the
windowed, single-translate layer. The `<canvas>` fallback is not needed.

## S-2 — MusicXML hand-data survival

**Command:** `npm run spike:musicxml`.

Candidate: Verovio 6.2.0 plus `@tonejs/midi` 2.0.28. Repeat expansion was
disabled only for the staff-survival comparison so a source attack was not
counted again merely because it was performed again. The harness chose the two
distinct note-bearing tracks with the closest pitch content, mapped source
staff 1 to the first and staff 2 to the second, then compared source attacks
with their corresponding destination-track events. Missing or coalesced events
count as assignment mismatches. Pitch-content differences are reported
separately from hand assignment.

| Real piano score | Staff 1 → track | Staff 2 → track | Source attacks | Assignment mismatches | Match | Staff 2 notes above C4, source → converted |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| Bach, BWV 846 | 0 / ch. 0 | 1 / ch. 0 | 535 | 2 | 99.626% | 14 → 14 |
| Clara Schumann, Op. 1 No. 1 | 0 / ch. 0 | 1 / ch. 0 | 852 | 0 | 100% | 206 → 206 |
| Mozart, K. 545 exposition | 0 / ch. 0 | 1 / ch. 0 | 191 | 0 | 100% | 26 → 26 |
| **Aggregate** |  |  | **1,578** | **2** | **99.873%** | **246 → 246** |

All three conversions emitted two distinguishable tracks, although both tracks
used MIDI channel 0. The Clara score is the explicit cross-hand fixture; its
206 staff-2 attacks above middle C all remained in the staff-2 track. Across
the three files, the pitch-content diagnostic found 20 differences (two Bach,
18 Clara), but none moved an event to the other staff's track; T02 should retain
this diagnostic in its note-by-note import test.

The production-style Vite build emitted 7,907,967 bytes (7.54 MiB) raw and
2,347,013 bytes (2.24 MiB) gzip. T00 calls D-008 an 8 MB total-asset budget,
while the binding D-008 text defines 8 MB specifically as the sampled-piano
subset budget. Following the higher-priority decision, the converter is an
additional lazy MusicXML-only chunk: its 2.24 MiB transfer cost is justified,
but it must not be precached or loaded for MIDI-only users.

### Structural expansion

The W3C `45e-Repeats-Fine-InvalidEndings` fixture was made audible in memory by
giving each measure a unique pitch; its notation and navigation markup were
left intact. Verovio's expansion map contained 308 entries with up to nine
rendered copies. The observed performance orders proved:

- repeats: measures 1–2 played three times;
- voltas: numbered alternate endings selected different measures on successive
  passes;
- D.C.: measure 12 returned to measure 1;
- D.S.: the isolated route ended `14 → 7 → 8`;
- To Coda: the isolated D.C. route contained `4 → 13` on the return pass;
- Fine: both D.C. and D.S. routes stopped at measure 8.

No tested navigation construct was left unexpanded. Verovio did warn that the
fixture's visual `heavy-light` bar style is unsupported; that did not alter the
performance order. Therefore the T02 structural-fallback warning list is empty
for repeats, voltas, D.C., D.S., To Coda, and Fine, while converter import
warnings must still be surfaced for unsupported or malformed input.

**Verdict: PASS — O-1 and O-2 confirmed.** Use Verovio, map its distinct staff
tracks directly (never the MIDI median-pitch heuristic), lazy-load the 2.24 MiB
gzip converter, and keep a ≥99% note-by-note staff-mapping gate.

## S-3 — Web MIDI clock offset on the Roland RP302

**Command:** `npm run spike:midi-clock`. Run the opened page once in Chrome and
once in Edge with the RP302 connected. Each run samples the paired
`getOutputTimestamp()` values every 250 ms and on note-on, records
`outputLatency`, plays a 120 BPM metronome for 60 seconds, calculates offset
mean/standard deviation and regression drift, records device state changes,
and downloads the complete JSON result.

A Windows present-device scan found no Roland or RP302 device, so the physical
measurement could not run.

| Required observation | Chrome | Edge |
| --- | --- | --- |
| Mean clock offset | Not measured | Not measured |
| Offset standard deviation | Not measured | Not measured |
| Drift over 60 seconds | Not measured | Not measured |
| `outputLatency` | Not measured | Not measured |
| Exact permission prompt and flow | Not observed; harness records verbatim text and request events | Not observed; harness records verbatim text and request events |
| SysEx | Harness requests `{ sysex: false }`; browser prompt effect not observed | Harness requests `{ sysex: false }`; browser prompt effect not observed |
| Power-off/on behavior and port id stability | Not observed; harness records state, connection, id, name, and manufacturer on every state change | Not observed; harness records state, connection, id, name, and manufacturer on every state change |

**Verdict: BLOCKED — awaiting Roland RP302 hardware. D-005 remains
unverified.** Proceed with the documented D-005 default: resample
`performanceTime - contextTime * 1000` at attempt start and device change,
convert every MIDI timestamp into the audio-context domain, and compensate for
`audioContext.outputLatency`. T08's Chrome-and-Edge RP302 hardware gate is the
real validation; it must fill the table above and meet ±30 ms corrected mean
and under 15 ms jitter before shipping.

## Decision and completion summary

- D-002: confirmed by S-1's windowed performance and seek measurements; direct
  Layer borders visualization remains an instrumentation limitation.
- O-1: confirmed — MusicXML staff separation survives as distinct MIDI tracks
  at 99.873% aggregate assignment match.
- O-2: confirmed — Verovio costs 2.24 MiB gzip and is acceptable as a lazy,
  MusicXML-only chunk.
- D-005: blocked awaiting RP302 hardware; the exact documented conversion is
  the required default for T08.
- Every requested “Also record” item is answered above, including blocked
  Chrome/Edge permission and power-cycle observations.
