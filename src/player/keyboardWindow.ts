/**
 * Narrowing the 88-key run to the range a piece actually uses (D-031).
 *
 * The design specifies all 88 keys, and on a laptop or an iPad that is what
 * renders — this module returns the full window and nothing moves. On a 375px
 * phone the same row gives each white key 7.2px: the labels are unreadable and
 * a falling note is thinner than the strike line. Below a usable key width the
 * keyboard and the waterfall scroll together to the piece's own range, which is
 * typically four to five octaves rather than seven and a quarter.
 *
 * The window is a pure function of the notes and the available width, so the
 * keyboard and the waterfall cannot disagree about where a pitch sits.
 */

import { keyboard } from "../design/tokens";
import { whiteIndexAtOrAbove, whiteIndexAtOrBelow } from "./keyboardGeometry";

/** Below this, key labels stop being legible at arm's length. */
export const MIN_WHITE_KEY_PX = 11;
/** Never window tighter than this, or a two-note piece fills the screen. */
export const MIN_VISIBLE_WHITE_KEYS = 21; // three octaves

export interface KeyboardWindow {
  /** Multiplier applied to the 88-key coordinate space. 1 = the full keyboard. */
  scale: number;
  /** How far to shift that space left, as a percentage of the container. */
  offsetPercent: number;
  visibleWhiteKeys: number;
}

export const FULL_KEYBOARD_WINDOW: KeyboardWindow = Object.freeze({
  scale: 1,
  offsetPercent: 0,
  visibleWhiteKeys: keyboard.whiteCount,
});

function windowFromWhiteRange(firstWhite: number, lastWhite: number): KeyboardWindow {
  const visibleWhiteKeys = lastWhite - firstWhite + 1;
  const scale = keyboard.whiteCount / visibleWhiteKeys;
  return {
    scale,
    offsetPercent: (firstWhite / keyboard.whiteCount) * 100 * scale,
    visibleWhiteKeys,
  };
}

export function keyboardWindowFor(
  midiValues: readonly number[],
  availableWidthPx: number,
): KeyboardWindow {
  if (availableWidthPx <= 0) return FULL_KEYBOARD_WINDOW;
  if (availableWidthPx / keyboard.whiteCount >= MIN_WHITE_KEY_PX) return FULL_KEYBOARD_WINDOW;
  if (midiValues.length === 0) return FULL_KEYBOARD_WINDOW;

  let lowest = Infinity;
  let highest = -Infinity;
  for (const midi of midiValues) {
    if (midi < lowest) lowest = midi;
    if (midi > highest) highest = midi;
  }

  let firstWhite = whiteIndexAtOrBelow(Math.max(keyboard.midiLow, lowest));
  let lastWhite = whiteIndexAtOrAbove(Math.min(keyboard.midiHigh, highest));

  // Grow symmetrically to the floor, then off the other end once one side hits
  // the edge of the keyboard.
  while (lastWhite - firstWhite + 1 < MIN_VISIBLE_WHITE_KEYS) {
    if (firstWhite > 0) firstWhite -= 1;
    else if (lastWhite < keyboard.whiteCount - 1) lastWhite += 1;
    else break;

    if (lastWhite - firstWhite + 1 >= MIN_VISIBLE_WHITE_KEYS) break;
    if (lastWhite < keyboard.whiteCount - 1) lastWhite += 1;
    else if (firstWhite === 0) break;
  }

  if (lastWhite - firstWhite + 1 >= keyboard.whiteCount) return FULL_KEYBOARD_WINDOW;
  return windowFromWhiteRange(firstWhite, lastWhite);
}

/** Style for the element that holds the 88-key coordinate space. */
export function keyboardWindowStyle(window: KeyboardWindow) {
  return {
    left: `${-window.offsetPercent}%`,
    width: `${window.scale * 100}%`,
  };
}
