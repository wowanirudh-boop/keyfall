import { Midi } from "@tonejs/midi";

import {
  IMPORT_ERROR_MESSAGES,
  type ImportErrorKind,
  type ImportFileData,
  type ImportNotice,
  type ImportResult,
  type NoteEvent,
  type NoteHand,
  type PieceDocument,
  type PieceSource,
} from "./types";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_DURATION_SECONDS = 30 * 60;
const MIN_PIANO_MIDI = 21;
const MAX_PIANO_MIDI = 108;
const PERCUSSION_CHANNEL = 9;
const SUPPORTED_EXTENSIONS = new Set(["mid", "midi", "musicxml", "xml", "mxl"]);
const ORNAMENT_NOTICE =
  "Ornaments use their principal written notes; grace notes play as short written notes.";
const STRUCTURAL_NOTICE =
  "This file's repeats or navigation marks could not be resolved, so it was imported in written order — playback may not match the full piece.";

interface NormalizedTrack {
  sourceIndex: number;
  notes: Array<{
    sourceIndex: number;
    midi: number;
    start: number;
    end: number;
    velocity: number;
  }>;
}

interface MusicXmlMidi {
  midi: Midi;
  notices: ImportNotice[];
  metadataText: string;
  hasHandStaves: boolean;
}

function failure(kind: ImportErrorKind): ImportResult {
  return { ok: false, error: { kind, message: IMPORT_ERROR_MESSAGES[kind] } };
}

function extensionOf(name: string) {
  const separator = name.lastIndexOf(".");
  return separator < 0 ? "" : name.slice(separator + 1).toLowerCase();
}

function titleFromName(name: string) {
  const separator = name.lastIndexOf(".");
  return (separator < 0 ? name : name.slice(0, separator)) || "Untitled piece";
}

function hashBytes(bytes: Uint8Array) {
  let hash = 2_166_136_261;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function medianPitch(track: NormalizedTrack) {
  const pitches = track.notes.map((note) => note.midi).sort((left, right) => left - right);
  const middle = Math.floor(pitches.length / 2);
  return pitches.length % 2 === 0
    ? (pitches[middle - 1] + pitches[middle]) / 2
    : pitches[middle];
}

function midiHands(tracks: NormalizedTrack[]) {
  const hands = new Map<number, NoteHand>();
  if (tracks.length !== 2) {
    return hands;
  }

  const firstMedian = medianPitch(tracks[0]);
  const secondMedian = medianPitch(tracks[1]);
  if (firstMedian === secondMedian) {
    return hands;
  }

  const left = firstMedian < secondMedian ? tracks[0] : tracks[1];
  const right = left === tracks[0] ? tracks[1] : tracks[0];
  hands.set(left.sourceIndex, "left");
  hands.set(right.sourceIndex, "right");
  return hands;
}

export function musicXmlHandAssignments(
  sourceIndexes: readonly number[],
  hasHandStaves: boolean,
) {
  const hands = new Map<number, NoteHand>();
  if (hasHandStaves && sourceIndexes.length === 2) {
    hands.set(sourceIndexes[0], "right");
    hands.set(sourceIndexes[1], "left");
  }
  return hands;
}

function musicXmlHands(tracks: NormalizedTrack[], hasHandStaves: boolean) {
  return musicXmlHandAssignments(
    tracks.map((track) => track.sourceIndex),
    hasHandStaves,
  );
}

function normalizeMidi(
  midi: Midi,
  source: PieceSource,
  pieceId: string,
  notices: ImportNotice[],
  hasHandStaves: boolean,
) {
  let droppedNotes = 0;
  const tracks = midi.tracks
    .map((track, sourceIndex): NormalizedTrack | null => {
      if (track.channel === PERCUSSION_CHANNEL || track.notes.length === 0) {
        return null;
      }

      const notes = track.notes.flatMap((note, sourceNoteIndex) => {
        if (note.midi < MIN_PIANO_MIDI || note.midi > MAX_PIANO_MIDI) {
          droppedNotes += 1;
          return [];
        }
        return [
          {
            sourceIndex: sourceNoteIndex,
            midi: note.midi,
            start: note.time,
            end: note.time + note.duration,
            velocity: note.velocity,
          },
        ];
      });
      return notes.length > 0 ? { sourceIndex, notes } : null;
    })
    .filter((track): track is NormalizedTrack => track !== null);

  if (droppedNotes > 0) {
    notices.push({
      kind: "dropped-notes",
      message: `${droppedNotes} notes fell outside the 88-key range and were dropped — this file may not be a piano arrangement.`,
    });
  }

  const hands =
    source === "musicxml-upload" ? musicXmlHands(tracks, hasHandStaves) : midiHands(tracks);
  const notes: NoteEvent[] = tracks.flatMap((track) =>
    track.notes.map((note) => ({
      id: `${pieceId}:t${track.sourceIndex}:n${note.sourceIndex}`,
      midi: note.midi,
      start: note.start,
      end: note.end,
      velocity: note.velocity,
      hand: hands.get(track.sourceIndex) ?? "unknown",
    })),
  );
  notes.sort(
    (left, right) =>
      left.start - right.start || left.midi - right.midi || left.id.localeCompare(right.id),
  );

  return notes;
}

function bytesFromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function hasStructuralMarkup(text: string) {
  return /<(repeat|ending|segno|coda)\b|\b(dacapo|dalsegno|tocoda|fine)=/i.test(text);
}

function hasOrnamentMarkup(text: string) {
  return /<(trill-mark|trill|mordent|inverted-mordent|turn|inverted-turn|grace)\b|\bgrace=["']/i.test(
    text,
  );
}

function hasPianoStaves(sourceText: string, mei: string) {
  return (
    /<staves>\s*2\s*<\/staves>|<staff>\s*2\s*<\/staff>/i.test(sourceText) ||
    /<staffGrp\b[^>]*bar\.thru=["']true["'][\s\S]*?<staffDef\b[^>]*n=["']1["'][\s\S]*?<staffDef\b[^>]*n=["']2["'][\s\S]*?<\/staffGrp>/i.test(
      mei,
    )
  );
}

function hasStructuralWarning(log: string) {
  return /(unsupported|invalid|cannot|failed).*(repeat|ending|volta|dacapo|dalsegno|coda|fine|expansion)/i.test(
    log,
  );
}

function navigationValues(text: string, attribute: string) {
  const values = new Set<string>();
  const pattern = new RegExp(`\\b${attribute}=["']([^"']+)["']`, "gi");
  for (const match of text.matchAll(pattern)) {
    values.add(match[1]);
  }
  return values;
}

function hasUnresolvedNavigation(text: string) {
  const segnos = navigationValues(text, "segno");
  const codas = navigationValues(text, "coda");
  const missingSegno = [...navigationValues(text, "dalsegno")].some(
    (target) => !segnos.has(target),
  );
  const missingCoda = [...navigationValues(text, "tocoda")].some(
    (target) => !codas.has(target),
  );
  const invalidRepeat = [...text.matchAll(/<repeat\b[^>]*\bdirection=["']([^"']+)["']/gi)].some(
    (match) => match[1] !== "forward" && match[1] !== "backward",
  );
  return missingSegno || missingCoda || invalidRepeat;
}

async function renderMusicXml(
  bytes: Uint8Array,
  extension: string,
  expandNever: boolean,
) {
  const [{ default: createVerovioModule }, { VerovioToolkit }] = await Promise.all([
    import("verovio/wasm"),
    import("verovio/esm"),
  ]);
  const toolkit = new VerovioToolkit(await createVerovioModule());

  try {
    if (expandNever) {
      toolkit.setOptions({ expandNever: true });
    }
    const loaded =
      extension === "mxl"
        ? toolkit.loadZipDataBuffer(bytes.slice().buffer)
        : toolkit.loadData(new TextDecoder().decode(bytes));
    if (!loaded) {
      throw new Error("Verovio rejected the score");
    }
    const midi = new Midi(bytesFromBase64(toolkit.renderToMIDI()));
    return { midi, log: toolkit.getLog(), metadataText: toolkit.getMEI() };
  } finally {
    toolkit.destroy();
  }
}

async function musicXmlToMidi(bytes: Uint8Array, extension: string): Promise<MusicXmlMidi> {
  const sourceText = extension === "mxl" ? "" : new TextDecoder().decode(bytes);
  const notices: ImportNotice[] = [];
  let rendered;

  if (sourceText && hasUnresolvedNavigation(sourceText)) {
    rendered = await renderMusicXml(bytes, extension, true);
    notices.push({ kind: "structural-fallback", message: STRUCTURAL_NOTICE });
  } else {
    try {
      rendered = await renderMusicXml(bytes, extension, false);
      if (hasStructuralWarning(rendered.log)) {
        rendered = await renderMusicXml(bytes, extension, true);
        notices.push({ kind: "structural-fallback", message: STRUCTURAL_NOTICE });
      }
    } catch (error) {
      if (extension !== "mxl" && !hasStructuralMarkup(sourceText)) {
        throw error;
      }
      rendered = await renderMusicXml(bytes, extension, true);
      notices.push({ kind: "structural-fallback", message: STRUCTURAL_NOTICE });
    }
  }

  const metadataText = `${sourceText}\n${rendered.metadataText}`;
  if (hasOrnamentMarkup(metadataText)) {
    notices.push({ kind: "ornament-handling", message: ORNAMENT_NOTICE });
  }
  return {
    midi: rendered.midi,
    notices,
    metadataText,
    hasHandStaves: hasPianoStaves(sourceText, rendered.metadataText),
  };
}

function composerFromMetadata(text: string) {
  const match = text.match(
    /<(?:creator|persName)[^>]*(?:type|role)=["'](?:composer|cmp)["'][^>]*>([^<]+)</i,
  );
  return match?.[1]?.trim() ?? "";
}

function makeDocument(
  file: ImportFileData,
  midi: Midi,
  source: PieceSource,
  metadataText: string,
  notices: ImportNotice[],
  hasHandStaves = false,
): ImportResult {
  const pieceId = `${source === "midi-upload" ? "midi" : "musicxml"}-${hashBytes(file.bytes)}`;
  const notes = normalizeMidi(midi, source, pieceId, notices, hasHandStaves);
  if (notes.length === 0) {
    return failure("no-notes");
  }

  if (midi.duration > MAX_DURATION_SECONDS) {
    return failure("too-long");
  }
  const duration = Math.max(...notes.map((note) => note.end));

  const piece: PieceDocument = {
    id: pieceId,
    title: midi.name.trim() || titleFromName(file.name),
    composer: composerFromMetadata(metadataText),
    source,
    duration,
    notes,
    hasHandData: notes.some((note) => note.hand !== "unknown"),
    notices,
  };
  return { ok: true, piece };
}

export async function parsePieceBytes(file: ImportFileData): Promise<ImportResult> {
  const extension = extensionOf(file.name);
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    return failure("unsupported-extension");
  }
  if (file.bytes.byteLength > MAX_FILE_BYTES) {
    return failure("too-large");
  }

  try {
    if (extension === "mid" || extension === "midi") {
      return makeDocument(file, new Midi(file.bytes), "midi-upload", "", []);
    }
    const converted = await musicXmlToMidi(file.bytes, extension);
    return makeDocument(
      file,
      converted.midi,
      "musicxml-upload",
      converted.metadataText,
      converted.notices,
      converted.hasHandStaves,
    );
  } catch {
    return failure("unparseable");
  }
}
