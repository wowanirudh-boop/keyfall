import { describe, expect, it } from "vitest";

import {
  knownMidiBytes,
  outOfRangeMidiBytes,
  percussionOnlyMidiBytes,
  singleTrackMidiBytes,
  tempoChangeMidiBytes,
  twoTrackMidiBytes,
} from "./__fixtures__/midiFixtures";
import { parsePieceBytes } from "./parse";
import type { ImportResult, PieceDocument } from "./types";

function pieceFrom(result: ImportResult): PieceDocument {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.piece;
}

describe("MIDI import", () => {
  it("preserves a known file's count, duration, and endpoint onsets within 1 ms", async () => {
    const piece = pieceFrom(
      await parsePieceBytes({ name: "known.mid", bytes: knownMidiBytes() }),
    );

    expect(piece.notes).toHaveLength(3);
    expect(piece.notes[0].start).toBeCloseTo(0.25, 3);
    expect(piece.notes.at(-1)?.start).toBeCloseTo(2.5, 3);
    expect(piece.duration).toBeCloseTo(3.25, 3);
  });

  it("applies an explicit tempo change to note onsets", async () => {
    const piece = pieceFrom(
      await parsePieceBytes({ name: "tempo-change.midi", bytes: tempoChangeMidiBytes() }),
    );

    expect(piece.notes.map((note) => note.start)).toEqual([0, 1, 2]);
  });

  it("excludes channel 10 and reports percussion-only files as no notes", async () => {
    const result = await parsePieceBytes({
      name: "percussion.mid",
      bytes: percussionOnlyMidiBytes(),
    });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: "no-notes",
        message: "This file contains no playable notes.",
      },
    });
  });

  it("drops out-of-range pitches and reports the exact count", async () => {
    const piece = pieceFrom(
      await parsePieceBytes({ name: "range.mid", bytes: outOfRangeMidiBytes() }),
    );

    expect(piece.notes.map((note) => note.midi)).toEqual([21, 108]);
    expect(piece.notices).toContainEqual({
      kind: "dropped-notes",
      message:
        "2 notes fell outside the 88-key range and were dropped — this file may not be a piano arrangement.",
    });
  });

  it("uses median pitch for exactly two MIDI tracks", async () => {
    const piece = pieceFrom(
      await parsePieceBytes({ name: "two-track.mid", bytes: twoTrackMidiBytes() }),
    );

    expect(piece.hasHandData).toBe(true);
    expect(piece.notes.filter((note) => note.midi < 60).every((note) => note.hand === "left")).toBe(
      true,
    );
    expect(piece.notes.filter((note) => note.midi > 60).every((note) => note.hand === "right")).toBe(
      true,
    );
  });

  it("keeps single-track MIDI hand data unknown", async () => {
    const piece = pieceFrom(
      await parsePieceBytes({ name: "single-track.mid", bytes: singleTrackMidiBytes() }),
    );

    expect(piece.hasHandData).toBe(false);
    expect(piece.notes.every((note) => note.hand === "unknown")).toBe(true);
  });

  it("sorts notes and produces stable ids for identical bytes", async () => {
    const bytes = twoTrackMidiBytes();
    const first = pieceFrom(await parsePieceBytes({ name: "stable.mid", bytes }));
    const second = pieceFrom(await parsePieceBytes({ name: "stable.mid", bytes }));

    expect(first.notes.every((note, index) => index === 0 || first.notes[index - 1].start <= note.start)).toBe(
      true,
    );
    expect(first.notes.map((note) => note.id)).toEqual(second.notes.map((note) => note.id));
    expect(first.id).toBe(second.id);
  });
});
