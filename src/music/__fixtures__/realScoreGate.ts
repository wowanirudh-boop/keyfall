import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { Midi } from "@tonejs/midi";
import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";

import { musicXmlHandAssignments } from "../parse";
import type { NoteEvent, NoteHand, PieceDocument } from "../types";

export const REAL_SCORE_FILES = [
  "bach-bwv846.musicxml",
  "clara-schumann-op1-no1.musicxml",
  "mozart-k545-exposition.musicxml",
] as const;

function child(element: Element, name: string) {
  return [...element.children].find((candidate) => candidate.localName === name) ?? null;
}

function children(element: Element, name: string) {
  return [...element.children].filter((candidate) => candidate.localName === name);
}

function pitchToMidi(note: Element) {
  const pitch = child(note, "pitch");
  if (!pitch) return null;
  const semitone = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  }[child(pitch, "step")?.textContent?.trim() ?? ""];
  if (semitone === undefined) return null;
  const alter = Number(child(pitch, "alter")?.textContent ?? 0);
  const octave = Number(child(pitch, "octave")?.textContent);
  return (octave + 1) * 12 + semitone + alter;
}

function sourceStaffPitches(xml: string) {
  const document = new DOMParser().parseFromString(xml, "text/xml");
  const pitches = new Map<number, number[]>([
    [1, []],
    [2, []],
  ]);

  for (const note of document.querySelectorAll("part:first-of-type > measure > note")) {
    const midi = pitchToMidi(note);
    const tieTypes = children(note, "tie").map((tie) => tie.getAttribute("type"));
    const isContinuation = tieTypes.includes("stop") && !tieTypes.includes("start");
    const staff = Number(child(note, "staff")?.textContent ?? 1);
    if (midi !== null && !isContinuation && pitches.has(staff)) {
      pitches.get(staff)?.push(midi);
    }
  }

  return pitches;
}

function unorderedPitchMismatch(left: readonly number[], right: readonly number[]) {
  const leftCounts = new Map<number, number>();
  const rightCounts = new Map<number, number>();
  for (const pitch of left) leftCounts.set(pitch, (leftCounts.get(pitch) ?? 0) + 1);
  for (const pitch of right) rightCounts.set(pitch, (rightCounts.get(pitch) ?? 0) + 1);
  const matched = [...leftCounts].reduce(
    (total, [pitch, count]) => total + Math.min(count, rightCounts.get(pitch) ?? 0),
    0,
  );
  return Math.max(left.length - matched, right.length - matched);
}

function trackIndex(note: NoteEvent) {
  const value = note.id.match(/:t(\d+):/)?.[1];
  return value === undefined ? -1 : Number(value);
}

function bytesFromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export interface RealScoreGateResult {
  filename: string;
  piece: PieceDocument;
  sourceAttackCount: number;
  assignmentMismatches: number;
  pitchContentDifferences: number;
  expectedHands: ReadonlyMap<string, NoteHand>;
  rightTrackIndex: number;
  leftTrackIndex: number;
}

export async function evaluateRealScore(filename: (typeof REAL_SCORE_FILES)[number]) {
  const path = resolve("src/music/__fixtures__/real-scores", filename);
  const bytes = new Uint8Array(await readFile(path));
  const xml = new TextDecoder().decode(bytes);
  const source = sourceStaffPitches(xml);
  const toolkit = new VerovioToolkit(await createVerovioModule());
  let midi: Midi;
  try {
    toolkit.setOptions({ expandNever: true });
    if (!toolkit.loadData(xml)) throw new Error(`Verovio could not load ${filename}`);
    midi = new Midi(bytesFromBase64(toolkit.renderToMIDI()));
  } finally {
    toolkit.destroy();
  }
  const candidates = midi.tracks
    .map((track, index) => ({
      index,
      notes: [...track.notes].sort(
        (left, right) => left.time - right.time || left.midi - right.midi,
      ),
    }))
    .filter((track) => track.notes.length > 0);
  const staff1 = source.get(1) ?? [];
  const staff2 = source.get(2) ?? [];
  let best:
    | {
        right: (typeof candidates)[number];
        left: (typeof candidates)[number];
        pitchContentDifferences: number;
      }
    | undefined;

  for (const right of candidates) {
    for (const left of candidates) {
      if (left.index === right.index) continue;
      const pitchContentDifferences =
        unorderedPitchMismatch(staff1, right.notes.map((note) => note.midi)) +
        unorderedPitchMismatch(staff2, left.notes.map((note) => note.midi));
      if (!best || pitchContentDifferences < best.pitchContentDifferences) {
        best = { right, left, pitchContentDifferences };
      }
    }
  }

  if (!best) throw new Error(`${filename} did not produce two note-bearing tracks`);
  if (candidates.length !== 2) {
    throw new Error(`${filename} produced ${candidates.length} note-bearing tracks`);
  }
  const pieceId = `real-score-${filename.replace(/\.musicxml$/, "")}`;
  const productionHands = musicXmlHandAssignments(
    candidates.map((track) => track.index),
    true,
  );
  const notes: NoteEvent[] = candidates.flatMap((track) =>
    track.notes.map((note, index) => ({
      id: `${pieceId}:t${track.index}:n${index}`,
      midi: note.midi,
      start: note.time,
      end: note.time + note.duration,
      velocity: note.velocity,
      hand: productionHands.get(track.index) ?? "unknown",
    })),
  ).sort(
    (left, right) =>
      left.start - right.start || left.midi - right.midi || left.id.localeCompare(right.id),
  );
  const piece: PieceDocument = {
    id: pieceId,
    title: filename.replace(/\.musicxml$/, ""),
    composer: "",
    source: "musicxml-upload",
    duration: Math.max(...notes.map((note) => note.end)),
    notes,
    hasHandData: true,
    notices: [],
  };
  const expectedHands = new Map<string, NoteHand>();
  for (const note of notes) {
    expectedHands.set(note.id, trackIndex(note) === best.left.index ? "left" : "right");
  }
  const wrongTrackAssignments = notes.filter(
    (note) => note.hand !== expectedHands.get(note.id),
  ).length;

  return {
    filename,
    piece,
    sourceAttackCount: staff1.length + staff2.length,
    assignmentMismatches:
      Math.abs(staff1.length - best.right.notes.length) +
      Math.abs(staff2.length - best.left.notes.length) +
      wrongTrackAssignments,
    pitchContentDifferences: best.pitchContentDifferences,
    expectedHands,
    rightTrackIndex: best.right.index,
    leftTrackIndex: best.left.index,
  } satisfies RealScoreGateResult;
}
