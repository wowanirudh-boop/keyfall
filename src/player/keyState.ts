import { grading, tunables } from "../design/tokens";
import type { NoteEvent, NoteHand } from "../music/types";

export type VisibleKeyStateKind = "idle" | "prepare" | "pressed" | "error";

export type VisibleKeyState =
  | { kind: "idle" | "pressed" | "error"; hand: NoteHand }
  | { kind: "prepare"; hand: NoteHand; imminence: number };

export interface LiveVerdict {
  kind: "correct" | "wrong" | "missed" | "early" | "late";
  publishedAt: number;
}

export interface KeyStateOptions {
  listening?: boolean;
  liveVerdicts?: ReadonlyMap<string, LiveVerdict>;
  seekRevision?: number;
}

function lowerBoundStart(notes: readonly NoteEvent[], target: number) {
  let low = 0;
  let high = notes.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (notes[middle].start < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

function firstPrefixEndAfter(prefixMaxEnds: readonly number[], target: number) {
  let low = 0;
  let high = prefixMaxEnds.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (prefixMaxEnds[middle] <= target) low = middle + 1;
    else high = middle;
  }
  return low;
}

export class KeyStateScanner {
  private readonly prefixMaxEnds: number[];
  private cursor = 0;
  private lastPosition = Number.NEGATIVE_INFINITY;
  private lastSeekRevision = -1;

  constructor(private readonly notes: readonly NoteEvent[]) {
    let maximumEnd = Number.NEGATIVE_INFINITY;
    this.prefixMaxEnds = notes.map((note) => {
      maximumEnd = Math.max(maximumEnd, note.end);
      return maximumEnd;
    });
  }

  derive(position: number, options: KeyStateOptions = {}) {
    const seekRevision = options.seekRevision ?? 0;
    const jumped = position < this.lastPosition || position - this.lastPosition > tunables.lookaheadSeconds;
    if (this.lastSeekRevision !== seekRevision || jumped) {
      const firstActive = firstPrefixEndAfter(this.prefixMaxEnds, position);
      const firstPreparing = lowerBoundStart(
        this.notes,
        position - tunables.highlightLeadTimeSeconds,
      );
      this.cursor = Math.min(firstActive, firstPreparing);
    } else {
      while (
        this.cursor < this.notes.length &&
        this.prefixMaxEnds[this.cursor] <= position
      ) {
        this.cursor += 1;
      }
    }

    this.lastPosition = position;
    this.lastSeekRevision = seekRevision;

    const pressed = new Map<number, NoteHand>();
    const preparing = new Map<number, { hand: NoteHand; imminence: number }>();
    const errors = new Map<number, NoteHand>();

    for (let index = this.cursor; index < this.notes.length; index += 1) {
      const note = this.notes[index];
      if (note.start > position + tunables.lookaheadSeconds) break;

      if (position >= note.start && position < note.end) {
        pressed.set(note.midi, note.hand);
      } else if (
        position >= note.start - tunables.highlightLeadTimeSeconds &&
        position < note.start &&
        !pressed.has(note.midi) &&
        !preparing.has(note.midi)
      ) {
        const imminence = Math.min(
          1,
          Math.max(
            0,
            1 - (note.start - position) / tunables.highlightLeadTimeSeconds,
          ),
        );
        preparing.set(note.midi, { hand: note.hand, imminence });
      }

      const verdict = options.liveVerdicts?.get(note.id);
      if (
        options.listening &&
        verdict &&
        (verdict.kind === "wrong" || verdict.kind === "missed") &&
        position >= verdict.publishedAt &&
        position - verdict.publishedAt < grading.errorFlashMusicalSeconds
      ) {
        errors.set(note.midi, note.hand);
      }
    }

    const states = new Map<number, VisibleKeyState>();
    for (const [midi, prepare] of preparing) {
      states.set(midi, { kind: "prepare", ...prepare });
    }
    for (const [midi, hand] of pressed) states.set(midi, { kind: "pressed", hand });
    for (const [midi, hand] of errors) states.set(midi, { kind: "error", hand });
    return states;
  }

  get cursorIndex() {
    return this.cursor;
  }
}
