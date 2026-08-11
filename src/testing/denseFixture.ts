import type { NoteEvent, PieceDocument } from "../music/types";

export interface DenseFixtureOptions {
  durationSeconds?: number;
  notesPerSecond?: number;
  seed?: number;
}

const DEFAULT_DURATION_SECONDS = 30 * 60;
const DEFAULT_NOTE_COUNT = 16_000;
const DEFAULT_SEED = 0x5eed1234;

function seededRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

export function createDenseFixture({
  durationSeconds = DEFAULT_DURATION_SECONDS,
  notesPerSecond = DEFAULT_NOTE_COUNT / DEFAULT_DURATION_SECONDS,
  seed = DEFAULT_SEED,
}: DenseFixtureOptions = {}): PieceDocument {
  const random = seededRandom(seed);
  const noteCount = Math.round(durationSeconds * notesPerSecond);
  const notes: NoteEvent[] = [];

  for (let index = 0; index < noteCount; index += 1) {
    const chordOffset = index % 24;
    const chordStart = Math.floor(index / 24) * (24 / notesPerSecond);
    const nominalStart = index / notesPerSecond;
    const start = Math.min(
      durationSeconds - 0.01,
      chordOffset < 6
        ? chordStart
        : nominalStart + (random() - 0.5) * (0.2 / notesPerSecond),
    );
    const hand = index % 7 < 3 ? "left" : "right";
    const basePitch = hand === "left" ? 36 : 60;
    const midi = basePitch + Math.floor(random() * 25);
    const duration = index % 29 === 0 ? 4 + random() * 8 : 0.08 + random() * 1.4;

    notes.push({
      id: `dense-${seed >>> 0}-${index}`,
      midi,
      start,
      end: Math.min(durationSeconds, start + duration),
      velocity: 48 + Math.floor(random() * 80),
      hand,
    });
  }

  notes.sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));

  return {
    id: `dense-${seed >>> 0}`,
    title: "Deterministic dense fixture",
    composer: "",
    source: "midi-upload",
    duration: durationSeconds,
    notes,
    hasHandData: true,
    notices: [],
  };
}
