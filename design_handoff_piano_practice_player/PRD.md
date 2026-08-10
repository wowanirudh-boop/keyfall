# PRD — Piano Practice Player

**Working name:** Piano Practice Player
**Version:** 1.0 (finalized — ready as tech-spec source)
**Author:** Anirudh (with Claude)
**Date:** 2026-08-10

---

## 1. Problem Statement

Learning piano from YouTube tutorial videos requires constantly pausing, rewinding, and squinting to figure out which keys the performer is pressing. The learner spends more time operating the video player than practicing. The cost is slow progress, broken practice flow, and frustration — the video was made for watching, not for practicing.

This product replaces the YouTube video with a purpose-built, interactive practice player: pick a piece, and get a Rousseau-style falling-notes visualization over a labeled 88-key keyboard, with playback controls designed for practice (slow speeds, precise scrubbing), and later, guidance (upcoming-key highlighting) and feedback (listen mode that detects and categorizes mistakes via the piano's MIDI output).

## 2. Target User & Context

- A single learner (initially the author), beginner-to-intermediate, self-taught.
- **Repertoire is mostly classical** — which public-domain catalogs cover well. Catalog search is therefore the primary, most-polished path; upload is the fallback for the occasional modern piece.
- Practices on a **Roland RP302 digital piano**; connects to a laptop via the piano's USB Computer port (class-compliant USB-MIDI). **Pedals are not used and are never graded or displayed.**
- Uses the app in a **browser on a laptop or tablet** placed at the piano. Touch and mouse must both work.
- Not a product for teachers, classrooms, or social features — a personal practice tool (though built as a web app so it can scale later).

## 3. Goals

1. **Eliminate YouTube from the practice loop**: the learner can go from naming a piece to a playable keyboard visualization in under 2 minutes (catalog hit) or under 1 minute (file upload).
2. **Make slow practice first-class**: 0.25x / 0.5x / 1x playback with no pitch distortion, and scrubbing accurate enough to land on any specific moment (±100 ms).
3. **Always know which key**: every key shown by name; (V1) upcoming keys highlighted before they must be pressed, emphasized at the press moment.
4. **(V1) Turn practice into feedback**: after playing along, the learner sees which notes were wrong, missed, extra, or mistimed — and where in the piece mistakes cluster.

## 4. Non-Goals

- **No staff/sheet-music notation view** — the product is keyboard-visualization-first; notation rendering is a separate, later concern (P2).
- **No PDF ingestion / optical music recognition (OMR)** — only machine-readable formats (MIDI, MusicXML). OMR is error-prone and a project in itself.
- **No pedal support** — user does not use pedals; sustain/soft events are ignored everywhere.
- **No exported video files (MP4)** — the interactive renderer is the product; export adds scope with no practice value.
- **No microphone-based listening** — listen mode is MIDI-only; polyphonic audio transcription is far less accurate and unnecessary given the RP302's USB-MIDI.
- **No accounts, cloud sync, or sharing** — pieces and progress live in browser local storage for MVP/V1.
- **No native mobile apps** — responsive web app only.
- **No gamification / curriculum / lessons** — this is a practice player, not a course.

## 5. Scope Summary

| Phase | Features |
|---|---|
| **MVP** | F1 Piece selection · F2 Music acquisition · F3 Player view · F4 Transport controls |
| **V1** | F5 Anticipatory key highlighting · F6 Listen mode (MIDI) with mistake analysis |
| **Out of scope** | Everything in Non-Goals |

## 6. User Stories

Ordered by priority.

- As a learner, I want to type the name of a piece and get a playable visualization, so that I can start practicing without hunting for videos.
- As a learner, I want to upload a MIDI/MusicXML file I found myself, so that pieces missing from public catalogs are still practicable.
- As a learner, I want a keyboard view with the name on every key, so that I never have to guess which key a note is.
- As a learner, I want to slow playback to 0.5x or 0.25x without pitch change, so that I can follow difficult passages.
- As a learner, I want to drag the progress bar and land on an exact moment, so that I can replay one difficult passage instead of restarting the piece.
- As a learner, I want to mark a passage with A–B markers and have it loop automatically, so that I can drill a difficult bar hands-free.
- As a learner, I want my recently opened pieces saved locally, so that daily practice of the same piece doesn't require re-searching or re-uploading.
- (V1) As a learner, I want upcoming keys highlighted on the keyboard before they must be pressed and emphasized at the press moment, so that my hands are prepared in time.
- (V1) As a learner, I want the app to listen to my playing through the piano's USB-MIDI and show me what I got wrong (wrong / missed / extra / early / late), so that I know what to fix.
- (V1) As a learner, I want to see where in the piece my mistakes cluster and which types dominate, so that I can target my practice.

## 7. Functional Requirements

### MVP

#### F1 — Piece selection (P0)

The home screen has a search box and a "My pieces" list.

- [ ] User types a piece name; the system searches its catalog of legally redistributable scores (public-domain / CC-licensed sources such as Mutopia, IMSLP, MuseScore public-domain sets — final source list is a tech-spec decision).
- [ ] The MVP ships with a **seeded catalog focused on common classical repertoire** (the user's stated repertoire). Catalog breadth grows over time and is not an MVP gate, but the seed must cover well-known teaching pieces (e.g., Für Elise, Gymnopédie No. 1, Clair de Lune tier).
- [ ] Search tolerates diacritics and common alternate titles ("Fur Elise" finds "Für Elise"; "Moonlight Sonata" finds "Piano Sonata No. 14") — classical naming is messy and the catalog path fails without this.
- [ ] Results show title, composer, arranger (if any), source, and duration where available; multiple matches/arrangements are listed for the user to choose.
- [ ] No results → the UI says so plainly and offers the upload path (F2) in the same view.
- [ ] Catalog search unavailable (offline, service down) → a clear message; the upload path and My pieces remain fully usable.
- [ ] Every successfully opened piece (searched or uploaded) is auto-saved to a local "My pieces" library; reopening is one click/tap. Pieces can be deleted from the library.

#### F2 — Music acquisition (P0)

- [ ] Accepted upload formats: `.mid`/`.midi`, `.musicxml`/`.xml`, `.mxl`. Anything else is rejected with a message naming the accepted formats.
- [ ] Upload validation: file parses, contains at least one note, ≤ 10 MB, ≤ 30 min duration. Malformed or empty files produce a specific, human-readable error (not a spinner or crash) and leave the user on the upload view.
- [ ] Multi-track files: tracks flagged as piano (or the only note-bearing tracks) are used by default; if the file has multiple note-bearing tracks, all are merged for display. (Per-track toggle is P1.)
- [ ] MIDI percussion channels (channel 10) are always excluded. Notes outside the 88-key range (A0–C8) are dropped; if any are dropped, the player shows a one-line notice (a signal the file may not be a piano arrangement).
- [ ] **Legal guardrail (product constraint):** the app auto-fetches only from sources whose licenses permit redistribution. It never scrapes or proxies copyrighted commercial sheet music. User-uploaded files are the user's responsibility; the app stores them locally only.

#### F3 — Player view (P0)

- [ ] Full 88-key keyboard (A0–C8) rendered at the bottom of the player; layout matches a real piano (correct black-key grouping).
- [ ] **Key names always visible**: white keys labeled with letter + octave (e.g., C4); black keys labeled with sharp name (e.g., F#3). Labels remain legible at tablet sizes.
- [ ] Falling notes (Rousseau/Synthesia style) descend from the top; a note reaches the keyboard exactly when it sounds; note length = held duration; the corresponding key visually depresses/lights while sounding.
- [ ] Upcoming notes are visible at least **3 seconds of musical time** before they sound (musical time = time at 1x; at 0.25x this means 12 s of wall-clock preview). The visible window is constant in musical time across speeds.
- [ ] **Hand coloring**: when the source distinguishes hands (MusicXML staves, or a 2-track MIDI), left and right hand notes/keys use two distinct colors; otherwise a single color. No user setting needed in MVP.
- [ ] Synthesized piano audio plays in sync with the visualization; a mute toggle exists (practice while playing yourself). Volume slider is P1.

#### F4 — Transport controls (P0)

- [ ] The player always opens **paused at 0:00**.
- [ ] Play / pause via button and spacebar.
- [ ] Speed selector: 1x, 0.5x, 0.25x. Audio pitch is unchanged at every speed (inherent to MIDI synthesis — this is a requirement, not an implementation note). Switching speed mid-playback takes effect immediately without losing position.
- [ ] Progress bar spanning the piece: current time / total duration displayed as mm:ss.
- [ ] **Drag-to-seek** with mouse or touch: while dragging, the timestamp under the handle is shown and the visualization updates live so the user can find a passage by sight; on release, playback state (playing/paused) is preserved. Seek accuracy within ±100 ms of the chosen position.
- [ ] Keyboard shortcuts: space = play/pause; ← / → = jump 5 s back/forward (directly serves the "going back repeatedly" pain).
- [ ] **A–B section loop**: the user places an A and a B marker on the seek bar (click/tap to place, draggable to adjust); playback repeats the A→B section until the loop is cleared. Works at every speed; markers are visible on the bar; a single control clears the loop. Placing B before A is prevented or auto-swapped.
- [ ] **End of piece**: playback stops at the end; pressing play from the end restarts from 0:00 (or from marker A when a loop is active).

### V1

#### F5 — Anticipatory key highlighting (P0 for V1)

- [ ] Keys for upcoming notes are highlighted on the keyboard in a "prepare" color starting a fixed lead time before they sound. The lead time is defined in **musical time** (default 1.0 s at 1x; tunable in tech spec) — so slower speeds automatically give more wall-clock preparation (4.0 s at 0.25x).
- [ ] At the moment the note must sound, the key switches to a "press now" state: stronger color and the key's name label enlarges noticeably (the user's "font goes bigger" cue), reverting when the note ends.
- [ ] Multiple simultaneous/overlapping upcoming notes all highlight; hand colors are preserved in both prepare and press states.

#### F6 — Listen mode with mistake analysis (P0 for V1)

**Mode of operation:** play-along. The piece plays (at any speed, with F5 highlighting available); the app simultaneously captures the learner's playing from the RP302 via Web MIDI and compares it against the expected notes.

- [ ] Device flow: app lists available MIDI inputs, user picks one, connection status is always visible. No device / unsupported browser → clear instructions (use Chrome/Edge, connect USB) rather than silent failure.
- [ ] **Mistake taxonomy** (each played or expected note resolves to exactly one):
  - **Correct** — right pitch within the timing tolerance.
  - **Wrong note** — a played note matching an expected note's timing window but not its pitch (includes octave errors, flagged as a subtype).
  - **Missed note** — expected note with no matching input.
  - **Extra note** — played note matching no expected note.
  - **Early / Late** — right pitch, outside tolerance but within the note's match window; default tolerance ±300 ms real time (tunable; exact matching algorithm is a tech-spec decision).
- [ ] Chords are graded note-by-note. Sustain pedal data (if any arrives) is ignored. Note velocity/dynamics are not graded.
- [ ] **Live feedback is subtle**: on a wrong or missed note, the affected keyboard key flashes a distinct error color briefly — no counters, popups, or waterfall overlays during play. All detail is deferred to the report.
- [ ] **An attempt ends** when the piece ends or the user stops it. Seeking, changing speed, or a MIDI device disconnect during an attempt also ends it (with a message for disconnects); the report for the portion actually played is offered in all cases.
- [ ] **Listen mode and A–B loop are mutually exclusive in V1**: enabling one disables the other with a brief notice (loop jumps are seeks, and seeks end attempts). Grading looped drills pass-by-pass is a Future Consideration (P2), noted so the attempt model isn't designed to preclude it.
- [ ] **Post-run report** per attempt: headline **accuracy % = correct ÷ expected notes** (early/late do NOT count as correct), with **pitch accuracy** ((correct + early + late) ÷ expected) shown alongside so timing problems and note problems are distinguishable at a glance; counts by mistake type; per-hand breakdown when hand data exists; and a piece timeline showing where mistakes cluster (clicking a cluster seeks the player there).
- [ ] Reports are stored locally per piece so the learner can compare attempts over time (simple list; no charts required for V1).

## 8. Key UX Flows

**First piece (happy path):** Home → type "Für Elise" → pick from matches → player opens paused at 0:00 → set 0.5x → press play → practice.

**Piece not found:** Home → search returns nothing → same screen offers "Upload a MIDI or MusicXML file" → file validates → player opens. Piece appears in My pieces either way.

**Daily practice:** Home → My pieces → tap yesterday's piece → player opens paused at 0:00 → drag seek to the difficult passage → set A–B markers around it → practice the looping section at 0.25x, using ← for quick 5 s replays elsewhere.

**(V1) Feedback session:** Player → enable Listen mode → device check passes → play along at 0.5x → run ends (or user stops) → report shows 82% accuracy, mistakes cluster at 1:10–1:25, mostly "late" on left hand → click cluster → player seeks there → practice that passage.

## 9. Constraints & Principles

- **Reuse-first:** do not build a playback engine or MIDI parser from scratch. Candidates: Tone.js (transport: play/pause/seek/rate), @tonejs/midi (MIDI parsing), an existing MusicXML **parser** for parsing only — there is no notation rendering in this product — and html-midi-player as a reference implementation. Custom code is limited to the waterfall + keyboard canvas and the mistake-matching logic. Final selections are tech-spec decisions.
- **Browsers:** Chrome and Edge fully supported (Web MIDI requirement for V1); MVP playback should also work in Firefox/Safari but they are not V1 targets.
- **Offline-tolerant:** once a piece is open, playback and (V1) listen mode work without network.
- **Local-first:** all pieces, settings, and reports live in browser storage; no backend account system. (A backend may exist solely for catalog search.)
- **Latency:** visualization and audio must stay in sync within ~50 ms; Web MIDI input timestamps are used for grading (not audio).

## 10. Success Metrics

Personal-tool scale — measured by instrumentation or honest self-report:

- **Time-to-practice:** piece name → playable visualization in < 2 min (catalog) / < 1 min (upload). Measured from first keystroke in search to first play press.
- **YouTube elimination:** 0 YouTube visits needed during a practice session of a supported piece (self-report over first 2 weeks).
- **Scrub fidelity:** seeking to a chosen passage succeeds first try (no overshoot hunting) in ≥ 90% of attempts.
- **(V1) Detection trust:** a deliberately clean run scores ≥ 95% accuracy (false-mistake rate < 5%); a deliberately wrong note is always caught. If the learner stops trusting the report, F6 has failed regardless of algorithmic metrics.

## 11. Risks & Open Questions

**Open (for the tech spec):**

| # | Risk / question | Owner | Blocking? |
|---|---|---|---|
| R2 | **MusicXML→performance fidelity**: repeats, voltas, tempo changes, ornaments must play back as they'd actually be performed. MIDI files sidestep this; MusicXML needs care. | Tech spec | No — MIDI is the fallback |
| R5 | **Timing tolerance tuning**: ±300 ms default may mis-grade at 0.25x practice speeds; matching algorithm needs real-world tuning against actual playing. | Tech spec | No |
| R6 | **Web MIDI permission UX** in Chrome (permission prompt, device sleep/wake) needs verification on the RP302 specifically. | Tech spec | No |
| R7 | **Per-source license verification**: each seeded catalog source's redistribution terms must be checked individually before ingestion (IMSLP in particular mixes licenses). | Tech spec | Yes — before catalog ingestion |

**Resolved during the critique loop (user decisions):**

- ~~R1~~ Repertoire is **mostly classical** → catalog search is the primary polished path; seed catalog focuses on classical teaching repertoire.
- ~~R3~~ **A–B loop is in the MVP** (F4).
- ~~R4~~ V1 live feedback is **subtle live + full report** (F6).

## 12. Phasing

1. **MVP** = F1–F4. Usable daily from this point; validates the core loop before any V1 work.
2. **V1** = F5, then F6 (F6 depends on nothing in F5, but F5 is smaller and immediately useful — ship it first).

## 13. Revision Log

| Version | Change | Rationale |
|---|---|---|
| 0.1 | Initial draft | Structure per plan; locked decisions from user Q&A (web app, interactive player, auto-fetch + upload, RP302 USB-MIDI, no pedals) baked in. Added beyond the literal feature list: local "My pieces" library (daily-practice loop is broken without it) and ← / → 5 s jump keys (directly serves the stated rewind pain). Deliberately excluded: metronome, wait-mode, A–B loop (pending user decision, R3). |
| 0.2 | Critique pass 1 fixes + user decisions | **Fixed:** search-unavailable failure state (F1); seeded-catalog scoping so catalog breadth can't balloon the MVP (F1); percussion/out-of-range note handling for messy real-world MIDIs (F2); musical-time vs wall-clock ambiguity in lookahead (F3) and highlight lead time (F5); player opens paused (F4); listen-mode attempt-ending rules for seek/speed-change/disconnect (F6); MusicXML parser wording that implied a notation view (§9); added R7 per-source license check. **User decisions applied:** classical repertoire (§2, F1), A–B loop in MVP (F4), subtle live + report feedback (F6). **Flagged, judged not worth solving:** duplicate-piece dedup rules (tech-spec detail), piece rename (P1 nicety at most), first-run onboarding (single self-explanatory screen), accessibility beyond browser defaults (personal tool). |
| 0.3 | Critique pass 2 fixes | Defined the A–B-loop × listen-mode interaction (mutually exclusive in V1; pass-by-pass loop grading noted as P2); defined end-of-piece behavior; added title-alias/diacritic tolerance to search (classical naming makes the catalog path fail without it); pinned down the accuracy formula (early/late excluded from headline accuracy, pitch accuracy shown alongside). |
| 1.0 | Finalized | Critique pass 3 (verification): all 6 original features trace to requirements with acceptance criteria; MVP/V1 split matches the user's instruction; all locked decisions present; zero remaining issues judged worth solving. Ready as tech-spec source. |
