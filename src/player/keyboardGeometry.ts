import { keyboard } from "../design/tokens";

export interface KeyGeometry {
  midi: number;
  left: number;
  width: number;
  black: boolean;
}

const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const BLACK_PITCH_CLASSES = new Set<number>(keyboard.blackPitchClasses);

function createKeyboardGeometry() {
  const whites: KeyGeometry[] = [];
  const blacks: KeyGeometry[] = [];
  const whiteWidth = 100 / keyboard.whiteCount;
  const blackWidth = whiteWidth * keyboard.blackWidthRatio;
  let whiteIndex = 0;

  for (let midi = keyboard.midiLow; midi <= keyboard.midiHigh; midi += 1) {
    if (BLACK_PITCH_CLASSES.has(midi % 12)) {
      blacks.push({
        midi,
        left: whiteIndex * whiteWidth - blackWidth / 2,
        width: blackWidth,
        black: true,
      });
    } else {
      whites.push({
        midi,
        left: whiteIndex * whiteWidth,
        width: whiteWidth,
        black: false,
      });
      whiteIndex += 1;
    }
  }

  return { whites, blacks, all: [...whites, ...blacks] };
}

export const KEYBOARD_GEOMETRY = createKeyboardGeometry();
export const KEY_GEOMETRY_BY_MIDI = new Map(
  KEYBOARD_GEOMETRY.all.map((key) => [key.midi, key]),
);

/** Position of each white key in the 52-key run, for windowing the keyboard. */
export const WHITE_INDEX_BY_MIDI = new Map(
  KEYBOARD_GEOMETRY.whites.map((key, index) => [key.midi, index]),
);

/** Nearest white key at or below `midi` — black keys have no white index. */
export function whiteIndexAtOrBelow(midi: number) {
  for (let candidate = midi; candidate >= keyboard.midiLow; candidate -= 1) {
    const index = WHITE_INDEX_BY_MIDI.get(candidate);
    if (index !== undefined) return index;
  }
  return 0;
}

/** Nearest white key at or above `midi`. */
export function whiteIndexAtOrAbove(midi: number) {
  for (let candidate = midi; candidate <= keyboard.midiHigh; candidate += 1) {
    const index = WHITE_INDEX_BY_MIDI.get(candidate);
    if (index !== undefined) return index;
  }
  return keyboard.whiteCount - 1;
}

export function keyLabel(midi: number) {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}
