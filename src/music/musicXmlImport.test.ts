import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parsePieceBytes } from "./parse";
import type { ImportResult, PieceDocument } from "./types";
import { evaluateRealScore, REAL_SCORE_FILES } from "./__fixtures__/realScoreGate";

async function fixture(name: string) {
  return new Uint8Array(await readFile(resolve("src/music/__fixtures__", name)));
}

function pieceFrom(result: ImportResult): PieceDocument {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.piece;
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

describe("MusicXML import", () => {
  it("maps staff tracks note by note and never applies the MIDI median heuristic", async () => {
    const piece = pieceFrom(
      await parsePieceBytes({
        name: "cross-hand.musicxml",
        bytes: await fixture("cross-hand.musicxml"),
      }),
    );
    const expected = new Map<number, "left" | "right">([
      [48, "right"],
      [50, "right"],
      [52, "right"],
      [53, "right"],
      [79, "left"],
      [81, "left"],
      [83, "left"],
      [84, "left"],
    ]);
    const matched = piece.notes.filter((note) => note.hand === expected.get(note.midi)).length;
    const rightPitches = piece.notes.filter((note) => note.hand === "right").map((note) => note.midi);
    const leftPitches = piece.notes.filter((note) => note.hand === "left").map((note) => note.midi);
    const pitchContentDifferences = piece.notes.filter((note) => !expected.has(note.midi)).length;

    expect(matched / expected.size).toBeGreaterThanOrEqual(0.99);
    expect(pitchContentDifferences).toBe(0);
    expect(median(rightPitches)).toBeLessThan(median(leftPitches));
    expect(piece.hasHandData).toBe(true);
    expect(piece.composer).toBe("T02 fixture");
    expect(piece.source).toBe("musicxml-upload");
  });

  it("keeps the real-score staff mapping gate at or above 99 percent", async () => {
    const scores = [];
    for (const filename of REAL_SCORE_FILES) scores.push(await evaluateRealScore(filename));
    const sourceAttacks = scores.reduce((total, score) => total + score.sourceAttackCount, 0);
    const mismatches = scores.reduce((total, score) => total + score.assignmentMismatches, 0);
    const pitchContentDifferences = scores.reduce(
      (total, score) => total + score.pitchContentDifferences,
      0,
    );

    expect(sourceAttacks).toBe(1_578);
    expect(mismatches).toBe(2);
    expect((sourceAttacks - mismatches) / sourceAttacks).toBeGreaterThanOrEqual(0.99);
    expect(pitchContentDifferences).toBe(20);
    for (const score of scores) {
      expect(score.piece.hasHandData).toBe(true);
      expect(score.rightTrackIndex).toBe(0);
      expect(score.leftTrackIndex).toBe(1);
      expect(
        score.piece.notes.every((note) => note.hand === score.expectedHands.get(note.id)),
      ).toBe(true);
    }
  }, 30_000);

  it("expands a repeated four-bar section to eight bars in performance order", async () => {
    const piece = pieceFrom(
      await parsePieceBytes({
        name: "repeat.musicxml",
        bytes: await fixture("repeat-4-bars.musicxml"),
      }),
    );

    expect(piece.notes.map((note) => note.midi)).toEqual([60, 62, 64, 65, 60, 62, 64, 65]);
    expect(piece.notes.map((note) => note.start)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(piece.notices.some((notice) => notice.kind === "structural-fallback")).toBe(false);
  });

  it("imports a compressed MXL score through the same staff-preserving path", async () => {
    const piece = pieceFrom(
      await parsePieceBytes({
        name: "cross-hand.mxl",
        bytes: await fixture("cross-hand.mxl"),
      }),
    );

    expect(piece.notes).toHaveLength(8);
    expect(piece.notes.filter((note) => note.midi < 60).every((note) => note.hand === "right")).toBe(
      true,
    );
    expect(piece.notes.filter((note) => note.midi > 60).every((note) => note.hand === "left")).toBe(
      true,
    );
  });

  it("does not invent hands for two separate single-staff MusicXML parts", async () => {
    const piece = pieceFrom(
      await parsePieceBytes({
        name: "two-parts.musicxml",
        bytes: await fixture("two-parts.musicxml"),
      }),
    );

    expect(piece.notes).toHaveLength(2);
    expect(piece.hasHandData).toBe(false);
    expect(piece.notes.every((note) => note.hand === "unknown")).toBe(true);
  });

  it("coalesces a stop-plus-start tie continuation into one sustained attack", async () => {
    const piece = pieceFrom(
      await parsePieceBytes({
        name: "ties.musicxml",
        bytes: await fixture("tied-chain.musicxml"),
      }),
    );

    expect(piece.notes).toHaveLength(1);
    expect(piece.notes[0]).toMatchObject({ midi: 60, start: 0 });
    expect(piece.notes[0].end).toBeCloseTo(1.5, 2);
  });

  it("attaches the persistent ornament-handling notice", async () => {
    const piece = pieceFrom(
      await parsePieceBytes({
        name: "ornament.xml",
        bytes: await fixture("ornament.musicxml"),
      }),
    );

    expect(piece.notices).toContainEqual({
      kind: "ornament-handling",
      message:
        "Ornaments use their principal written notes; grace notes play as short written notes.",
    });
    expect(piece.notes.map((note) => note.midi)).toEqual([62, 64]);
    expect(piece.notes[0].end - piece.notes[0].start).toBeLessThan(0.3);
  });

  it("falls back to written order with a persistent warning for unresolved navigation", async () => {
    const piece = pieceFrom(
      await parsePieceBytes({
        name: "unsupported-navigation.musicxml",
        bytes: await fixture("unsupported-navigation.musicxml"),
      }),
    );

    expect(piece.notes.map((note) => note.midi)).toEqual([60, 62]);
    expect(piece.notices).toContainEqual({
      kind: "structural-fallback",
      message:
        "This file's repeats or navigation marks could not be resolved, so it was imported in written order — playback may not match the full piece.",
    });
  });
});
