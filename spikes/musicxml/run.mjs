import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import midiPackage from "@tonejs/midi";
import { JSDOM } from "jsdom";
import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";
import { build } from "vite";

const { Midi } = midiPackage;
const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = path.join(here, "fixtures");
const scoreFiles = [
  "bach-bwv846.musicxml",
  "clara-schumann-op1-no1.musicxml",
  "mozart-k545-exposition.musicxml",
];

function child(element, name) {
  return [...element.children].find((candidate) => candidate.localName === name) ?? null;
}

function children(element, name) {
  return [...element.children].filter((candidate) => candidate.localName === name);
}

function pitchToMidi(note) {
  const pitch = child(note, "pitch");
  if (!pitch) {
    return null;
  }

  const semitone = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[
    child(pitch, "step")?.textContent.trim()
  ];
  const alter = Number(child(pitch, "alter")?.textContent ?? 0);
  const octave = Number(child(pitch, "octave")?.textContent);
  return (octave + 1) * 12 + semitone + alter;
}

function sourceStaffNotes(xml) {
  const document = new JSDOM(xml, { contentType: "text/xml" }).window.document;
  const staffEvents = new Map([
    [1, []],
    [2, []],
  ]);
  let absoluteQuarter = 0;
  let divisions = 1;

  for (const measure of document.querySelectorAll("part:first-of-type > measure")) {
    let cursor = 0;
    let previousNoteStart = 0;
    let measureEnd = 0;

    for (const item of measure.children) {
      if (item.localName === "attributes") {
        divisions = Number(child(item, "divisions")?.textContent ?? divisions);
        continue;
      }

      if (item.localName === "backup" || item.localName === "forward") {
        const duration = Number(child(item, "duration")?.textContent ?? 0) / divisions;
        cursor += item.localName === "backup" ? -duration : duration;
        continue;
      }

      if (item.localName !== "note") {
        continue;
      }

      const duration = Number(child(item, "duration")?.textContent ?? 0) / divisions;
      const isChord = child(item, "chord") !== null;
      const start = isChord ? previousNoteStart : cursor;
      const midi = pitchToMidi(item);
      const tieTypes = children(item, "tie").map((tie) => tie.getAttribute("type"));
      const isContinuation = tieTypes.includes("stop") && !tieTypes.includes("start");
      const staff = Number(child(item, "staff")?.textContent ?? 1);

      if (midi !== null && !isContinuation && staffEvents.has(staff)) {
        staffEvents.get(staff).push({ start: absoluteQuarter + start, midi });
      }

      if (!isChord) {
        previousNoteStart = start;
        cursor += duration;
      }
      measureEnd = Math.max(measureEnd, start + duration, cursor);
    }

    absoluteQuarter += measureEnd;
  }

  for (const events of staffEvents.values()) {
    events.sort((left, right) => left.start - right.start || left.midi - right.midi);
  }

  return staffEvents;
}

function editDistance(left, right) {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        current[rightIndex - 1] + 1,
        previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous = current;
  }

  return previous[right.length];
}

function unorderedPitchMismatch(left, right) {
  const leftCounts = new Map();
  const rightCounts = new Map();
  for (const pitch of left) leftCounts.set(pitch, (leftCounts.get(pitch) ?? 0) + 1);
  for (const pitch of right) rightCounts.set(pitch, (rightCounts.get(pitch) ?? 0) + 1);
  const matched = [...leftCounts].reduce(
    (total, [pitch, count]) => total + Math.min(count, rightCounts.get(pitch) ?? 0),
    0,
  );
  return Math.max(left.length - matched, right.length - matched);
}

function bestStaffTrackMapping(source, midi) {
  const tracks = midi.tracks
    .map((track, index) => ({
      index,
      channel: track.channel,
      name: track.name,
      pitches: [...track.notes]
        .sort((left, right) => left.ticks - right.ticks || left.midi - right.midi)
        .map((note) => note.midi),
    }))
    .filter((track) => track.pitches.length > 0);
  const staff1 = source.get(1).map((note) => note.midi);
  const staff2 = source.get(2).map((note) => note.midi);
  let best = null;

  for (const rightTrack of tracks) {
    for (const leftTrack of tracks) {
      if (rightTrack.index === leftTrack.index) {
        continue;
      }
      const mismatches =
        unorderedPitchMismatch(staff1, rightTrack.pitches) +
        unorderedPitchMismatch(staff2, leftTrack.pitches);
      if (!best || mismatches < best.mismatches) {
        best = {
          rightTrack,
          leftTrack,
          mismatches,
          handAssignmentMismatches:
            Math.abs(staff1.length - rightTrack.pitches.length) +
            Math.abs(staff2.length - leftTrack.pitches.length),
          orderedPitchEditDistance:
            editDistance(staff1, rightTrack.pitches) + editDistance(staff2, leftTrack.pitches),
        };
      }
    }
  }

  return {
    trackCount: tracks.length,
    sourceNoteCount: staff1.length + staff2.length,
    ...best,
  };
}

async function convertScore(verovioModule, filename) {
  const xml = await fs.readFile(path.join(fixtureDirectory, filename), "utf8");
  const source = sourceStaffNotes(xml);
  const toolkit = new VerovioToolkit(verovioModule);

  try {
    toolkit.setOptions({ expandNever: true });
    if (!toolkit.loadData(xml)) {
      throw new Error(`Verovio could not load ${filename}: ${toolkit.getLog()}`);
    }
    const midi = new Midi(Buffer.from(toolkit.renderToMIDI(), "base64"));
    const mapping = bestStaffTrackMapping(source, midi);
    const mismatchRate = mapping.mismatches / mapping.sourceNoteCount;

    return {
      filename,
      sourceNotes: {
        staff1: source.get(1).length,
        staff2: source.get(2).length,
        staff2AboveMiddleC: source.get(2).filter((note) => note.midi > 60).length,
      },
      convertedTracks: mapping.trackCount,
      staff1Destination: {
        track: mapping.rightTrack.index,
        channel: mapping.rightTrack.channel,
        notes: mapping.rightTrack.pitches.length,
        notesAboveMiddleC: mapping.rightTrack.pitches.filter((pitch) => pitch > 60).length,
      },
      staff2Destination: {
        track: mapping.leftTrack.index,
        channel: mapping.leftTrack.channel,
        notes: mapping.leftTrack.pitches.length,
        notesAboveMiddleC: mapping.leftTrack.pitches.filter((pitch) => pitch > 60).length,
      },
      handAssignmentMismatches: mapping.handAssignmentMismatches,
      pitchContentDifferences: mapping.mismatches,
      orderedPitchEditDistance: mapping.orderedPitchEditDistance,
      handAssignmentMismatchRatePercent:
        Math.round((mapping.handAssignmentMismatches / mapping.sourceNoteCount) * 100_000) / 1_000,
      handAssignmentMatchRatePercent:
        Math.round((1 - mapping.handAssignmentMismatches / mapping.sourceNoteCount) * 100_000) / 1_000,
      pitchContentMismatchRatePercent: Math.round(mismatchRate * 100_000) / 1_000,
      converterLog: toolkit.getLog().trim(),
    };
  } finally {
    toolkit.destroy();
  }
}

function makeStructuralNotesAudible(xml, transform) {
  const dom = new JSDOM(xml, { contentType: "text/xml" });
  const document = dom.window.document;
  const steps = ["C", "D", "E", "F", "G", "A", "B"];
  const pitchToMeasure = new Map();

  [...document.querySelectorAll("part:first-of-type > measure")].forEach((measure, index) => {
    const stepIndex = index % steps.length;
    const octave = 3 + Math.floor(index / steps.length);
    const midi = (octave + 1) * 12 + [0, 2, 4, 5, 7, 9, 11][stepIndex];
    pitchToMeasure.set(midi, index + 1);
    for (const rest of measure.querySelectorAll("note > rest")) {
      const pitch = document.createElement("pitch");
      const stepElement = document.createElement("step");
      stepElement.textContent = steps[stepIndex];
      pitch.append(stepElement);
      const octaveElement = document.createElement("octave");
      octaveElement.textContent = String(octave);
      pitch.append(octaveElement);
      rest.replaceWith(pitch);
    }
  });

  transform?.(document);
  return { xml: dom.serialize(), pitchToMeasure };
}

function hasAdjacent(order, left, right, startIndex = 0) {
  return order.slice(startIndex).some((value, index, values) => value === left && values[index + 1] === right);
}

function removeElements(document, selector) {
  for (const element of document.querySelectorAll(selector)) {
    element.remove();
  }
}

function renderStructuralCase(verovioModule, xml, transform) {
  const toolkit = new VerovioToolkit(verovioModule);

  try {
    const audibleFixture = makeStructuralNotesAudible(xml, transform);
    toolkit.loadData(audibleFixture.xml);
    const midi = new Midi(Buffer.from(toolkit.renderToMIDI(), "base64"));
    const pitches = midi.tracks
      .flatMap((track) => track.notes)
      .sort((left, right) => left.ticks - right.ticks || left.midi - right.midi)
      .map((note) => audibleFixture.pitchToMeasure.get(note.midi))
      .filter((measure) => measure !== undefined);
    const performanceOrder = pitches.filter((measure, index) => index === 0 || pitches[index - 1] !== measure);
    const expansionMap = toolkit.renderToExpansionMap();
    return {
      performanceOrder,
      expansionMapEntries: Object.keys(expansionMap).length,
      largestExpansionCopies: Math.max(...Object.values(expansionMap).map((ids) => ids.length)),
      converterLog: toolkit.getLog().trim(),
    };
  } finally {
    toolkit.destroy();
  }
}

async function inspectStructure(verovioModule) {
  const xml = await fs.readFile(
    path.join(fixtureDirectory, "structure-repeats-jumps.musicxml"),
    "utf8",
  );
  const combined = renderStructuralCase(verovioModule, xml);
  const dalSegnoCase = renderStructuralCase(verovioModule, xml, (document) => {
    removeElements(document, "sound[dacapo], sound[tocoda]");
  });
  const toCodaCase = renderStructuralCase(verovioModule, xml, (document) => {
    removeElements(document, "sound[fine], sound[dalsegno], ending, repeat");
  });
  const daCapoIndex = combined.performanceOrder.indexOf(12);
  const dalSegnoIndex = dalSegnoCase.performanceOrder.indexOf(14);
  const codaDaCapoIndex = toCodaCase.performanceOrder.indexOf(12);

  return {
    fixture: "W3C 45e-Repeats-Fine-InvalidEndings",
    combined,
    isolatedPerformanceOrders: {
      dalSegnoAndFine: dalSegnoCase.performanceOrder,
      daCapoAndToCoda: toCodaCase.performanceOrder,
    },
    constructs: {
      repeats:
        combined.performanceOrder
          .slice(0, combined.performanceOrder.indexOf(3))
          .filter((measure) => measure === 1).length >= 3,
      voltas: [4, 5, 6, 9, 10, 11].every((measure) =>
        combined.performanceOrder.includes(measure),
      ),
      daCapo:
        daCapoIndex >= 0 && combined.performanceOrder.slice(daCapoIndex + 1).includes(1),
      dalSegno:
        dalSegnoIndex >= 0 &&
        hasAdjacent(dalSegnoCase.performanceOrder, 14, 7, dalSegnoIndex),
      toCoda:
        codaDaCapoIndex >= 0 &&
        hasAdjacent(toCodaCase.performanceOrder, 4, 13, codaDaCapoIndex),
      fine:
        combined.performanceOrder.at(-1) === 8 &&
        dalSegnoCase.performanceOrder.at(-1) === 8,
    },
  };
}

async function filesRecursively(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const item = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await filesRecursively(item)));
    } else {
      files.push(item);
    }
  }

  return files;
}

async function measureBrowserBundle() {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "piano-verovio-spike-"));

  try {
    await build({
      configFile: false,
      logLevel: "silent",
      build: {
        emptyOutDir: true,
        outDir: temporaryDirectory,
        rollupOptions: { input: path.join(here, "bundle-entry.js") },
      },
    });
    const files = await filesRecursively(temporaryDirectory);
    const buffers = await Promise.all(files.map((file) => fs.readFile(file)));
    return {
      emittedFiles: files.map((file) => path.relative(temporaryDirectory, file)),
      rawBytes: buffers.reduce((total, buffer) => total + buffer.length, 0),
      gzipBytes: buffers.reduce((total, buffer) => total + gzipSync(buffer).length, 0),
    };
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

const verovioModule = await createVerovioModule();
const scores = [];
for (const filename of scoreFiles) {
  scores.push(await convertScore(verovioModule, filename));
}
const totalSourceNotes = scores.reduce(
  (total, score) => total + score.sourceNotes.staff1 + score.sourceNotes.staff2,
  0,
);
const totalHandAssignmentMismatches = scores.reduce(
  (total, score) => total + score.handAssignmentMismatches,
  0,
);
const totalPitchContentDifferences = scores.reduce(
  (total, score) => total + score.pitchContentDifferences,
  0,
);
const output = {
  converter: "verovio 6.2.0",
  scores,
  aggregate: {
    sourceNotes: totalSourceNotes,
    handAssignmentMismatches: totalHandAssignmentMismatches,
    handAssignmentMismatchRatePercent:
      Math.round((totalHandAssignmentMismatches / totalSourceNotes) * 100_000) / 1_000,
    handAssignmentMatchRatePercent:
      Math.round((1 - totalHandAssignmentMismatches / totalSourceNotes) * 100_000) / 1_000,
    pitchContentDifferences: totalPitchContentDifferences,
  },
  structure: await inspectStructure(verovioModule),
  browserBundle: await measureBrowserBundle(),
};

console.log(JSON.stringify(output, null, 2));
