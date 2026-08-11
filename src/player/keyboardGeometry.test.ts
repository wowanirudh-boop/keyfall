import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { keyboard } from "../design/tokens";
import { KEYBOARD_GEOMETRY, keyLabel } from "./keyboardGeometry";

describe("keyboard geometry", () => {
  it("[AC1] creates the exact 52 white and 36 black key geometry", () => {
    const { whites, blacks } = KEYBOARD_GEOMETRY;
    const whiteWidth = 100 / 52;
    const blackWidth = whiteWidth * keyboard.blackWidthRatio;

    expect(whites).toHaveLength(52);
    expect(blacks).toHaveLength(36);
    expect(whites[0].midi).toBe(21);
    expect(whites[51].midi).toBe(108);
    for (const black of blacks) {
      const whiteIndexBefore = whites.filter((white) => white.midi < black.midi).length;
      expect(Number(black.width.toFixed(4))).toBe(Number(blackWidth.toFixed(4)));
      expect(Number(black.left.toFixed(4))).toBe(
        Number((whiteIndexBefore * whiteWidth - blackWidth / 2).toFixed(4)),
      );
    }
  });

  it("[AC2] labels the keyboard endpoints and accidentals with U+266F", () => {
    expect(keyLabel(60)).toBe("C4");
    expect(keyLabel(66)).toBe("F♯4");
    expect(keyLabel(21)).toBe("A0");
    expect(keyLabel(108)).toBe("C8");

    const playerDirectory = resolve(process.cwd(), "src/player");
    const productionSource = readdirSync(playerDirectory)
      .filter((file) => /\.(ts|tsx)$/.test(file) && !file.includes(".test."))
      .map((file) => readFileSync(resolve(playerDirectory, file), "utf8"))
      .join("\n");
    const asciiSharp = String.fromCodePoint(35);
    expect(productionSource).not.toContain(asciiSharp);
  });
});
