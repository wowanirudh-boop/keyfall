import { describe, expect, it } from "vitest";

import { keyboard } from "../design/tokens";
import { KEY_GEOMETRY_BY_MIDI } from "./keyboardGeometry";
import {
  FULL_KEYBOARD_WINDOW,
  keyboardWindowFor,
  keyboardWindowStyle,
  MIN_VISIBLE_WHITE_KEYS,
  MIN_WHITE_KEY_PX,
} from "./keyboardWindow";

/** Where a key lands, in percent of the visible keyboard, under a window. */
function positionOf(midi: number, window: { scale: number; offsetPercent: number }) {
  const geometry = KEY_GEOMETRY_BY_MIDI.get(midi)!;
  return {
    left: geometry.left * window.scale - window.offsetPercent,
    width: geometry.width * window.scale,
  };
}

const FUR_ELISE_RANGE = [40, 45, 52, 57, 64, 69, 71, 75, 76, 88];

describe("keyboardWindowFor", () => {
  it("[D-031] leaves a laptop and an iPad on all 88 keys", () => {
    expect(keyboardWindowFor(FUR_ELISE_RANGE, 1440)).toBe(FULL_KEYBOARD_WINDOW);
    expect(keyboardWindowFor(FUR_ELISE_RANGE, 1024)).toBe(FULL_KEYBOARD_WINDOW);
    expect(keyboardWindowFor(FUR_ELISE_RANGE, 768)).toBe(FULL_KEYBOARD_WINDOW);
    // The threshold itself, exactly.
    expect(keyboardWindowFor(FUR_ELISE_RANGE, MIN_WHITE_KEY_PX * keyboard.whiteCount)).toBe(
      FULL_KEYBOARD_WINDOW,
    );
  });

  it("[D-031] narrows to the piece's range on a phone, widening the keys", () => {
    const window = keyboardWindowFor(FUR_ELISE_RANGE, 375);
    expect(window).not.toBe(FULL_KEYBOARD_WINDOW);
    expect(window.visibleWhiteKeys).toBeLessThan(keyboard.whiteCount);
    expect(375 / window.visibleWhiteKeys).toBeGreaterThan(375 / keyboard.whiteCount);
  });

  it("[D-031] keeps every note of the piece on screen", () => {
    const window = keyboardWindowFor(FUR_ELISE_RANGE, 375);
    for (const midi of FUR_ELISE_RANGE) {
      const { left, width } = positionOf(midi, window);
      expect(left).toBeGreaterThanOrEqual(-0.001);
      expect(left + width).toBeLessThanOrEqual(100.001);
    }
  });

  it("[D-031] never zooms past three octaves for a narrow piece", () => {
    const window = keyboardWindowFor([60, 62, 64], 375);
    expect(window.visibleWhiteKeys).toBeGreaterThanOrEqual(MIN_VISIBLE_WHITE_KEYS);
  });

  it("[D-031] falls back to the full keyboard when the piece spans it", () => {
    expect(keyboardWindowFor([keyboard.midiLow, keyboard.midiHigh], 375)).toBe(
      FULL_KEYBOARD_WINDOW,
    );
    expect(keyboardWindowFor([], 375)).toBe(FULL_KEYBOARD_WINDOW);
    expect(keyboardWindowFor(FUR_ELISE_RANGE, 0)).toBe(FULL_KEYBOARD_WINDOW);
  });

  it("[D-031] pins the window's first and last white key to the container edges", () => {
    const window = keyboardWindowFor(FUR_ELISE_RANGE, 375);
    const style = keyboardWindowStyle(window);
    expect(style.width).toBe(`${window.scale * 100}%`);
    expect(style.left).toBe(`${-window.offsetPercent}%`);
    expect(window.scale * 100).toBeGreaterThan(100);
  });
});
