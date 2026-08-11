import { describe, expect, it } from "vitest";

import { emptyMidiBytes, longMidiBytes } from "./__fixtures__/midiFixtures";
import { parsePieceBytes } from "./parse";
import { IMPORT_ERROR_MESSAGES, type ImportErrorKind } from "./types";

describe("import validation", () => {
  it("returns a distinct, non-throwing result for all five failures", async () => {
    const cases: Array<{
      expected: ImportErrorKind;
      file: { name: string; bytes: Uint8Array };
    }> = [
      {
        expected: "unsupported-extension",
        file: { name: "score.pdf", bytes: new Uint8Array([1]) },
      },
      {
        expected: "too-large",
        file: { name: "large.mid", bytes: new Uint8Array(10 * 1024 * 1024 + 1) },
      },
      {
        expected: "too-long",
        file: { name: "long.mid", bytes: longMidiBytes() },
      },
      {
        expected: "unparseable",
        file: { name: "broken.musicxml", bytes: new TextEncoder().encode("<broken") },
      },
      {
        expected: "no-notes",
        file: { name: "empty.mid", bytes: emptyMidiBytes() },
      },
    ];

    const messages = new Set<string>();
    for (const validationCase of cases) {
      const result = await parsePieceBytes(validationCase.file);
      expect(result).toEqual({
        ok: false,
        error: {
          kind: validationCase.expected,
          message: IMPORT_ERROR_MESSAGES[validationCase.expected],
        },
      });
      if (!result.ok) messages.add(result.error.message);
    }

    expect(messages.size).toBe(5);
  });
});
