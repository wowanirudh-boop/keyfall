import { describe, expect, it } from "vitest";

import { createDenseFixture } from "./denseFixture";

describe("createDenseFixture", () => {
  it("creates the deterministic 30-minute, 16,000-note default piece", () => {
    const first = createDenseFixture();
    const second = createDenseFixture();

    expect(first).toEqual(second);
    expect(first.duration).toBe(1_800);
    expect(first.notes).toHaveLength(16_000);
    expect(first).toMatchObject({
      composer: "",
      source: "midi-upload",
      hasHandData: true,
      notices: [],
    });
    expect(first.notes.every((note, index, notes) => index === 0 || notes[index - 1].start <= note.start)).toBe(true);
  });

  it("contains mixed chords, sustained notes, dense passages, and both hands", () => {
    const piece = createDenseFixture();
    const starts = new Map<number, number>();

    for (const note of piece.notes) {
      starts.set(note.start, (starts.get(note.start) ?? 0) + 1);
    }

    expect(Math.max(...starts.values())).toBeGreaterThanOrEqual(6);
    expect(piece.notes.some((note) => note.end - note.start >= 4)).toBe(true);
    expect(piece.notes.some((note) => note.hand === "left")).toBe(true);
    expect(piece.notes.some((note) => note.hand === "right")).toBe(true);
  });

  it("honours requested duration, density, and seed", () => {
    const first = createDenseFixture({ durationSeconds: 10, notesPerSecond: 4, seed: 1 });
    const second = createDenseFixture({ durationSeconds: 10, notesPerSecond: 4, seed: 2 });

    expect(first.duration).toBe(10);
    expect(first.notes).toHaveLength(40);
    expect(first.notes).not.toEqual(second.notes);
  });
});
