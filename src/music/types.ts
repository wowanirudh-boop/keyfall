export type NoteHand = "left" | "right" | "unknown";

export interface NoteEvent {
  id: string;
  midi: number;
  start: number;
  end: number;
  /** Normalized note velocity in the inclusive range [0, 1]. */
  velocity: number;
  hand: NoteHand;
}

export type PieceSource = "catalog" | "midi-upload" | "musicxml-upload";

export type ImportNoticeKind =
  | "dropped-notes"
  | "ornament-handling"
  | "structural-fallback";

export interface ImportNotice {
  kind: ImportNoticeKind;
  message: string;
}

export interface PieceDocument {
  id: string;
  title: string;
  composer: string;
  source: PieceSource;
  sourceCreator?: string;
  duration: number;
  notes: NoteEvent[];
  hasHandData: boolean;
  notices: ImportNotice[];
}

export interface ImportFileData {
  name: string;
  bytes: Uint8Array;
}

export type ImportErrorKind =
  | "unsupported-extension"
  | "too-large"
  | "too-long"
  | "unparseable"
  | "no-notes";

export interface ImportError {
  kind: ImportErrorKind;
  message: string;
}

export type ImportResult =
  | { ok: true; piece: PieceDocument }
  | { ok: false; error: ImportError };

export const IMPORT_ERROR_MESSAGES: Record<ImportErrorKind, string> = {
  "unsupported-extension":
    "Unsupported file type. Choose a .mid, .midi, .musicxml, .xml, or .mxl file.",
  "too-large": "This file is larger than 10 MB.",
  "too-long": "This piece is longer than 30 minutes.",
  unparseable: "This file could not be parsed as MIDI or MusicXML.",
  "no-notes": "This file contains no playable notes.",
};
