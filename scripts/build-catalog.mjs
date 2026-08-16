#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inflateRawSync } from "node:zlib";

import midiPackage from "@tonejs/midi";

const { Midi } = midiPackage;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIRROR_URL = "https://github.com/MutopiaProject/MutopiaProject.git";
const MUTOPIA_ORIGIN = "https://www.mutopiaproject.org";
const PUBLIC_DOMAIN_URL = `${MUTOPIA_ORIGIN}/legal.html`;
const PIANO_MIDI_ORIGIN = "http://piano-midi.de";
const PIANO_MIDI_LICENCE_URL = `${PIANO_MIDI_ORIGIN}/copy.htm`;
const PIANO_MIDI_LICENCE_NAME = "cc-by-sa Germany License";
const PIANO_MIDI_CREATOR = "Bernd Krueger";
const REQUEST_INTERVAL_MS = 1_000;
const MAX_DURATION_SECONDS = 30 * 60;
const CATALOG_TITLE_OVERRIDES = new Map([
  ["sonate-2-b-moll", "Finale (Sonata No. 2, 4th mvt)"],
]);
const CATALOG_SOURCE_OVERRIDES = new Map([
  ["pictures-at-an-exhibition", "piano-midi.de"],
]);
export const MIN_ALIAS_LENGTH = 4;
export const ALIAS_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "of",
  "on",
  "the",
  "to",
  "with",
]);

const LICENCES = new Map([
  ["Public Domain", { name: "Public Domain", url: PUBLIC_DOMAIN_URL }],
  [
    "Creative Commons Attribution 2.5",
    { name: "CC-BY-2.5", url: "https://creativecommons.org/licenses/by/2.5/" },
  ],
  [
    "Creative Commons Attribution 3.0",
    { name: "CC-BY-3.0", url: "https://creativecommons.org/licenses/by/3.0/" },
  ],
  [
    "Creative Commons Attribution 4.0",
    { name: "CC-BY-4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  ],
  [
    "Creative Commons Attribution-ShareAlike 2.5",
    { name: "CC-BY-SA-2.5", url: "https://creativecommons.org/licenses/by-sa/2.5/" },
  ],
  [
    "Creative Commons Attribution-ShareAlike 3.0",
    { name: "CC-BY-SA-3.0", url: "https://creativecommons.org/licenses/by-sa/3.0/" },
  ],
  [
    "Creative Commons Attribution-ShareAlike 4.0",
    { name: "CC-BY-SA-4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/" },
  ],
  [
    "Creative Commons Attribution-ShareAlike 4.0 International",
    { name: "CC-BY-SA-4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/" },
  ],
]);

export const PIANO_MIDI_PIECES = [
  {
    id: "mazeppa-transcendental-etude-no-4-s-139",
    title: "Mazeppa (Transcendental Étude No. 4, S.139)",
    rawComposer: "Liszt",
    page: "liszt.htm",
    assets: ["midis/liszt/liz_et_trans4.mid"],
  },
  {
    id: "la-campanella-grandes-etudes-de-paganini-no-3-s-141",
    title: "La Campanella (Grandes études de Paganini No. 3, S.141)",
    rawComposer: "Liszt",
    page: "liszt.htm",
    assets: ["midis/liszt/liz_et3.mid"],
  },
  {
    id: "hungarian-rhapsody-no-2-s-244",
    title: "Hungarian Rhapsody No. 2, S.244",
    rawComposer: "Liszt",
    page: "liszt.htm",
    assets: ["midis/liszt/liz_rhap02.mid"],
  },
  {
    id: "liebestraum-no-3-s-541",
    title: "Liebestraum No. 3, S.541",
    rawComposer: "Liszt",
    page: "liszt.htm",
    assets: ["midis/liszt/liz_liebestraum.mid"],
  },
  {
    id: "gaspard-de-la-nuit-complete",
    title: "Gaspard de la nuit (complete)",
    rawComposer: "Ravel",
    page: "ravel.htm",
    assets: [
      "midis/ravel/rav_ondi.mid",
      "midis/ravel/rav_gib.mid",
      "midis/ravel/rav_scarbo.mid",
    ],
  },
  {
    id: "scarbo-gaspard-de-la-nuit-no-3",
    title: "Scarbo (Gaspard de la nuit, No. 3)",
    rawComposer: "Ravel",
    page: "ravel.htm",
    assets: ["midis/ravel/rav_scarbo.mid"],
  },
  {
    id: "sonata-no-14-moonlight-complete",
    title: "Sonata No. 14 ‘Moonlight’ (complete)",
    rawComposer: "Beethoven",
    page: "beeth.htm",
    assets: [
      "midis/beethoven/mond_1.mid",
      "midis/beethoven/mond_2.mid",
      "midis/beethoven/mond_3.mid",
    ],
  },
  {
    id: "sonata-no-14-moonlight-2nd-movement",
    title: "Sonata No. 14 ‘Moonlight’ (2nd mvt)",
    rawComposer: "Beethoven",
    page: "beeth.htm",
    assets: ["midis/beethoven/mond_2.mid"],
  },
  {
    id: "sonata-no-14-moonlight-3rd-movement",
    title: "Sonata No. 14 ‘Moonlight’ (3rd mvt)",
    rawComposer: "Beethoven",
    page: "beeth.htm",
    assets: ["midis/beethoven/mond_3.mid"],
  },
  {
    id: "polonaise-op-53-in-a-flat-heroic",
    title: "Polonaise Op. 53 in A-flat (‘Heroic’)",
    rawComposer: "Chopin",
    page: "chopin.htm",
    assets: ["midis/chopin/chpn_op53.mid"],
  },
  {
    id: "etude-op-25-no-11-winter-wind",
    title: "Étude Op. 25 No. 11 (‘Winter Wind’)",
    rawComposer: "Chopin",
    page: "chopin.htm",
    assets: ["midis/chopin/chpn_op25_e11.mid"],
  },
  {
    id: "etude-op-25-no-12-ocean",
    title: "Étude Op. 25 No. 12 (‘Ocean’)",
    rawComposer: "Chopin",
    page: "chopin.htm",
    assets: ["midis/chopin/chpn_op25_e12.mid"],
  },
  {
    id: "marche-funebre-sonata-no-2-3rd-movement",
    title: "Marche funèbre (Sonata No. 2, 3rd mvt)",
    rawComposer: "Chopin",
    page: "chopin.htm",
    assets: ["midis/chopin/chpn_op35_3.mid"],
  },
  {
    id: "pictures-at-an-exhibition",
    title: "Pictures at an Exhibition",
    rawComposer: "Mussorgsky",
    page: "muss.htm",
    assets: [
      "midis/mussorgsky/muss_1.mid",
      "midis/mussorgsky/muss_2.mid",
      "midis/mussorgsky/muss_3.mid",
      "midis/mussorgsky/muss_4.mid",
      "midis/mussorgsky/muss_5.mid",
      "midis/mussorgsky/muss_6.mid",
      "midis/mussorgsky/muss_7.mid",
      "midis/mussorgsky/muss_8.mid",
    ],
  },
];

const ARRANGEMENT_DISPOSITIONS = [
  "Tchaikovsky — Waltz of the Flowers (The Nutcracker, piano arr.): skipped; the source's Tchaikovsky page contains The Seasons, not this arrangement, so there is no file-specific arrangement licence to verify.",
  "Bach — Toccata and Fugue in D minor, BWV 565 (piano arr.): skipped; the source's Bach page contains only WTC selections, so there is no file-specific arrangement licence to verify.",
  "Tchaikovsky — Dance of the Sugar Plum Fairy (The Nutcracker, piano arr.): skipped; the source's Tchaikovsky page contains The Seasons, not this arrangement, so there is no file-specific arrangement licence to verify.",
  "Schubert — Ständchen / Serenade (arr. Liszt, S.560 No. 7): skipped; the source's Schubert page does not list this transcription, so there is no file-specific arrangement licence to verify.",
  "Bach — Air on the G String (BWV 1068, piano arr.): skipped; the source's Bach page contains only WTC selections, so there is no file-specific arrangement licence to verify.",
  "Vivaldi — Summer (The Four Seasons, piano arr.): skipped; Vivaldi is absent from the source index, so there is no file-specific arrangement licence to verify.",
  "Vivaldi — Spring (The Four Seasons, piano arr.): skipped; Vivaldi is absent from the source index, so there is no file-specific arrangement licence to verify.",
  "Vivaldi — Winter (The Four Seasons, piano arr.): skipped; Vivaldi is absent from the source index, so there is no file-specific arrangement licence to verify.",
  "Rimsky-Korsakov — Flight of the Bumblebee (arr. Rachmaninoff): skipped; Rimsky-Korsakov is absent from the source index, so there is no file-specific arrangement licence to verify.",
];

function runGit(args, cwd) {
  const safeDirectory = resolve(cwd).replaceAll("\\", "/");
  const result = spawnSync("git", ["-c", `safe.directory=${safeDirectory}`, ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}

async function ensureMirror(sourceDir, refresh) {
  if (!existsSync(join(sourceDir, ".git"))) {
    await mkdir(dirname(sourceDir), { recursive: true });
    const clone = spawnSync(
      "git",
      ["clone", "--depth", "1", "--filter=blob:none", "--sparse", MIRROR_URL, sourceDir],
      { encoding: "utf8", stdio: "inherit" },
    );
    if (clone.status !== 0) throw new Error("Could not clone the Mutopia GitHub mirror.");
    runGit(["sparse-checkout", "set", "ftp"], sourceDir);
  } else if (refresh) {
    runGit(["pull", "--ff-only"], sourceDir);
  }
  return runGit(["rev-parse", "HEAD"], sourceDir);
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...(await walk(path)));
    else paths.push(path);
  }
  return paths;
}

function unquote(value) {
  const match = value.match(/"((?:\\.|[^"\\])*)"/);
  return match?.[1].replaceAll('\\"', '"').replaceAll("\\\\", "\\").trim();
}

function sourceFields(source) {
  const direct = new Map();
  const references = new Map();
  for (const line of source.split(/\r?\n/)) {
    if (/^\s*%/.test(line)) continue;
    const match = line.match(/^\s*([A-Za-z][\w-]*)\s*=\s*(.+)$/);
    if (!match) continue;
    const [, name, value] = match;
    const quoted = unquote(value);
    if (quoted && !direct.has(name)) direct.set(name, quoted);
    const reference = value.match(/^\\([A-Za-z][\w-]*)\s*$/)?.[1];
    if (reference && !references.has(name)) references.set(name, reference);
  }
  const get = (name) => direct.get(name) ?? direct.get(references.get(name));
  return { get };
}

function cleanComposer(value, composerCode) {
  const composer = value?.replace(/\s*\(\s*\d{3,4}[\s\S]*\)\s*$/, "").trim();
  if (composer) return composer;
  return composerCode?.replace(/[A-Z]+$/, "").replaceAll(/([a-z])([A-Z])/g, "$1 $2");
}

export function isSoloKeyboardInstrument(value) {
  if (!value) return false;
  const instruments = value
    .split(",")
    .map((instrument) => fold(instrument))
    .filter(Boolean);
  const soloKeyboardNames = new Set(["piano", "pianoforte", "harpsichord", "clavichord"]);
  return instruments.includes("piano") && instruments.every((instrument) => soloKeyboardNames.has(instrument));
}

export function fold(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function publicationDirectory(sourceDir, sourcePath) {
  const parts = relative(sourceDir, sourcePath).split(sep);
  const generatedSourceIndex = parts.findIndex((part) => /-lys$/i.test(part));
  const directoryParts = parts.slice(0, generatedSourceIndex >= 0 ? generatedSourceIndex : -1);
  return join(sourceDir, ...directoryParts);
}

export function parsePieceSource(source, sourcePath, sourceDir) {
  const fields = sourceFields(source);
  const instrument = fields.get("mutopiainstrument");
  if (!isSoloKeyboardInstrument(instrument)) return null;
  const publicationId = source.match(/Mutopia-\d{4}\/\d{2}\/\d{2}-(\d+)/)?.[1];
  if (!publicationId) {
    const relativePath = relative(sourceDir, sourcePath).replaceAll("\\", "/");
    return { drop: `missing published Mutopia ID (${relativePath})` };
  }
  const fieldLicence = fields.get("license") ?? fields.get("copyright");
  const explicitLicence = [...LICENCES.keys()].find((licence) => source.includes(licence));
  return {
    publicationId,
    sourcePath,
    publicationDirectory: publicationDirectory(sourceDir, sourcePath),
    title: fields.get("mutopiatitle") ?? fields.get("title"),
    rawComposer: fields.get("composer") ?? fields.get("mutopiacomposer"),
    composer: cleanComposer(fields.get("composer"), fields.get("mutopiacomposer")),
    composerCode: fields.get("mutopiacomposer"),
    instrument,
    recoveredInstrument: fold(instrument) !== "piano",
    opus: fields.get("mutopiaopus") ?? fields.get("opus"),
    subtitle: fields.get("subtitle"),
    arranger: fields.get("arranger"),
    creator: fields.get("maintainer"),
    licenceText: LICENCES.has(fieldLicence) ? fieldLicence : (explicitLicence ?? fieldLicence),
  };
}

function mergePublication(records) {
  const preferred = [...records].sort((left, right) => {
    const leftName = basename(left.sourcePath).toLowerCase();
    const rightName = basename(right.sourcePath).toLowerCase();
    const score = (name) =>
      (/(?:^|[-_])all\.ly$/.test(name) ? 0 : 10) +
      (/(?:a4|letter|let)\.ly$/.test(name) ? 10 : 0) +
      name.length;
    return score(leftName) - score(rightName) || leftName.localeCompare(rightName);
  });
  const first = preferred[0];
  const value = (field) => preferred.find((record) => record[field])?.[field];
  return {
    publicationId: first.publicationId,
    publicationDirectory: preferred
      .map((record) => record.publicationDirectory)
      .sort((left, right) => left.length - right.length || left.localeCompare(right))[0],
    sourcePaths: preferred.map((record) => record.sourcePath),
    title: value("title"),
    rawComposer: value("rawComposer"),
    composer: value("composer"),
    instrument: value("instrument"),
    recoveredInstrument: preferred.some((record) => record.recoveredInstrument),
    opus: value("opus"),
    subtitle: value("subtitle"),
    arranger: value("arranger"),
    creator: value("creator"),
    licenceText: value("licenceText"),
  };
}

function baselineAliases(piece, curated) {
  const foldedTitle = fold(piece.title);
  const withoutParentheses = fold(piece.title.replace(/\s*[([][^\])]*[\])]/g, " "));
  const withoutCatalogue = fold(
    piece.title.replace(
      /(?:,?\s*)\b(?:op(?:us)?|bwv|woo|k(?:v)?|hob|sz|s)\.?\s*[a-z0-9./-]+(?:\s*(?:no|nr)\.?\s*\d+)?/gi,
      " ",
    ),
  );
  const surname = fold(piece.composer.split(",")[0] ?? "");
  return [...new Set([withoutParentheses, withoutCatalogue, surname, ...(curated ?? [])].map(fold))]
    .filter(
      (alias) =>
        alias.length >= MIN_ALIAS_LENGTH &&
        !ALIAS_STOP_WORDS.has(alias) &&
        alias !== foldedTitle &&
        !foldedTitle.includes(alias),
    )
    .sort();
}

function disambiguateTitles(publications) {
  const groups = new Map();
  for (const piece of publications) {
    const key = fold(piece.title ?? "");
    const group = groups.get(key) ?? [];
    group.push(piece);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const metadataCounts = new Map();
    for (const piece of group) {
      const metadata = piece.opus ?? piece.subtitle;
      const key = fold(metadata ?? "");
      metadataCounts.set(key, (metadataCounts.get(key) ?? 0) + 1);
    }
    for (const piece of group) {
      const metadata = piece.opus ?? piece.subtitle;
      const metadataKey = fold(metadata ?? "");
      const distinguishing =
        metadata &&
        metadataKey &&
        !fold(piece.title).includes(metadataKey) &&
        metadataCounts.get(metadataKey) === 1
          ? metadata
          : `Mutopia ${piece.publicationId}`;
      piece.title = `${piece.title} — ${distinguishing}`;
    }
  }
}

function slug(value) {
  const base = fold(value).replaceAll(" ", "-").slice(0, 80).replace(/-+$/g, "");
  return base || "piece";
}

function publicationUrl(sourceDir, directory) {
  const relativeDirectory = relative(sourceDir, directory).replaceAll("\\", "/");
  return new URL(`${relativeDirectory.replace(/^\/+/, "")}/`, `${MUTOPIA_ORIGIN}/`).href;
}

function scoreLinks(html, directoryUrl) {
  const links = [];
  for (const match of html.matchAll(/href=["']([^"']+(?:\.(?:mid|midi)|-mids\.zip))["']/gi)) {
    const url = new URL(match[1].replaceAll("&amp;", "&"), directoryUrl);
    if (url.origin === MUTOPIA_ORIGIN && url.pathname.startsWith("/ftp/")) links.push(url.href);
  }
  return [...new Set(links)].sort();
}

function selectName(names, piece) {
  const sourceStems = piece.sourcePaths.map((path) =>
    basename(path, extname(path)).replace(/[-_](?:a4|letter|let)$/i, "").toLowerCase(),
  );
  const directoryStem = basename(piece.publicationDirectory).toLowerCase();
  const rank = (name) => {
    const stem = basename(name, extname(name)).toLowerCase();
    if (stem === directoryStem) return 0;
    if (sourceStems.includes(stem)) return 1;
    if (/(?:^|[-_])(?:all|complete)(?:$|[-_])/.test(stem)) return 2;
    if (stem.startsWith(directoryStem)) return 3;
    return 4;
  };
  return [...names].sort((left, right) => rank(left) - rank(right) || left.localeCompare(right))[0];
}

function selectScoreLink(links, piece) {
  const direct = links.filter((url) => !new URL(url).pathname.toLowerCase().endsWith(".zip"));
  return selectName(direct.length > 0 ? direct : links, piece);
}

function findSignature(bytes, signature) {
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset -= 1) {
    if (bytes.readUInt32LE(offset) === signature) return offset;
  }
  return -1;
}

export function extractMidiEntries(zipBytes) {
  const bytes = Buffer.from(zipBytes);
  const endOffset = findSignature(bytes, 0x06054b50);
  if (endOffset < 0) throw new Error("downloaded MIDI archive has no ZIP directory");
  const entryCount = bytes.readUInt16LE(endOffset + 10);
  let offset = bytes.readUInt32LE(endOffset + 16);
  const entries = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (bytes.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("downloaded MIDI archive has an invalid ZIP directory");
    }
    const compression = bytes.readUInt16LE(offset + 10);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const localOffset = bytes.readUInt32LE(offset + 42);
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if (/\.(?:mid|midi)$/i.test(name)) {
      if (bytes.readUInt32LE(localOffset) !== 0x04034b50) {
        throw new Error("downloaded MIDI archive has an invalid ZIP entry");
      }
      const localNameLength = bytes.readUInt16LE(localOffset + 26);
      const localExtraLength = bytes.readUInt16LE(localOffset + 28);
      const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize);
      const data = compression === 0 ? Buffer.from(compressed) : compression === 8 ? inflateRawSync(compressed) : null;
      if (!data || data.length !== uncompressedSize) {
        throw new Error("downloaded MIDI archive uses an unsupported ZIP entry");
      }
      entries.push({ name, bytes: data });
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function createCachedFetcher(cacheDir) {
  let previousRequestAt = 0;
  return async (url, cacheName) => {
    const cachePath = join(cacheDir, cacheName);
    if (existsSync(cachePath)) return readFile(cachePath);
    const waitFor = REQUEST_INTERVAL_MS - (Date.now() - previousRequestAt);
    if (waitFor > 0) await new Promise((resolveWait) => setTimeout(resolveWait, waitFor));
    const response = await fetch(url, {
      headers: { "User-Agent": "PianoPracticePlayerCatalogBuilder/1.0" },
    });
    previousRequestAt = Date.now();
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(cachePath, bytes);
    return bytes;
  };
}

function copyMidiTrack(sourceTrack, output, offsetSeconds) {
  const track = output.addTrack();
  track.name = sourceTrack.name;
  track.channel = sourceTrack.channel;
  track.instrument.number = sourceTrack.instrument.number;
  for (const note of sourceTrack.notes) {
    track.addNote({
      midi: note.midi,
      time: offsetSeconds + note.time,
      duration: note.duration,
      velocity: note.velocity,
      noteOffVelocity: note.noteOffVelocity,
    });
  }
  for (const changes of Object.values(sourceTrack.controlChanges)) {
    for (const change of changes) {
      track.addCC({
        number: change.number,
        time: offsetSeconds + change.time,
        value: change.value,
      });
    }
  }
  for (const bend of sourceTrack.pitchBends) {
    track.addPitchBend({ time: offsetSeconds + bend.time, value: bend.value });
  }
}

export function concatenateMidiAssets(assets) {
  if (assets.length === 1) return Buffer.from(assets[0]);
  const output = new Midi();
  output.header.setTempo(120);
  let offsetSeconds = 0;
  for (const bytes of assets) {
    const source = new Midi(bytes);
    for (const track of source.tracks) copyMidiTrack(track, output, offsetSeconds);
    offsetSeconds += source.duration;
  }
  return Buffer.from(output.toArray());
}

export function createPianoMidiSourceAdapter({ cacheDir, composerAliases, fetchUrl }) {
  const cachedFetch = fetchUrl ?? createCachedFetcher(cacheDir);
  return {
    key: "piano-midi.de",
    priority: 1,
    revision: "apex HTTP inventory checked 2026-08-16",
    async load() {
      const pages = new Map();
      const assets = new Map();
      const rows = [];
      for (const piece of PIANO_MIDI_PIECES) {
        const pageUrl = `${PIANO_MIDI_ORIGIN}/${piece.page}`;
        let page = pages.get(piece.page);
        if (!page) {
          page = String(await cachedFetch(pageUrl, `pages/${piece.page}`));
          pages.set(piece.page, page);
        }
        for (const assetPath of piece.assets) {
          if (!page.includes(`href="${assetPath}"`)) {
            throw new Error(`${pageUrl} does not list ${assetPath}`);
          }
          if (!assets.has(assetPath)) {
            assets.set(
              assetPath,
              Buffer.from(
                await cachedFetch(
                  `${PIANO_MIDI_ORIGIN}/${assetPath}`,
                  `assets/${assetPath.replaceAll("/", "-")}`,
                ),
              ),
            );
          }
        }
        const composer = composerAliases[piece.rawComposer];
        if (!composer) {
          throw new Error(`piano-midi.de composer is not mapped (${piece.rawComposer})`);
        }
        const bytes = concatenateMidiAssets(piece.assets.map((assetPath) => assets.get(assetPath)));
        rows.push({
          id: piece.id,
          title: piece.title,
          composer,
          rawComposer: piece.rawComposer,
          aliases: baselineAliases({ title: piece.title, composer }),
          asset: `${piece.id}.mid`,
          format: "midi",
          licence: {
            name: PIANO_MIDI_LICENCE_NAME,
            url: PIANO_MIDI_LICENCE_URL,
            sourceUrl:
              piece.assets.length === 1
                ? `${PIANO_MIDI_ORIGIN}/${piece.assets[0]}`
                : pageUrl,
            creator: PIANO_MIDI_CREATOR,
          },
          bytes,
          sourceKey: "piano-midi.de",
          sourceAssets: piece.assets.map((assetPath) => `${PIANO_MIDI_ORIGIN}/${assetPath}`),
        });
      }
      return {
        rows,
        dropped: [],
        arrangementDispositions: ARRANGEMENT_DISPOSITIONS,
      };
    },
  };
}

function licenceFor(value) {
  return LICENCES.get(value?.trim());
}

function validateMidi(bytes) {
  let midi;
  try {
    midi = new Midi(bytes);
  } catch {
    throw new Error("downloaded asset is not valid MIDI");
  }
  const noteCount = midi.tracks.reduce((total, track) => total + track.notes.length, 0);
  if (noteCount === 0) throw new Error("downloaded MIDI contains no notes");
  if (!Number.isFinite(midi.duration) || midi.duration <= 0) {
    throw new Error("downloaded MIDI has no usable duration");
  }
  if (midi.duration > MAX_DURATION_SECONDS) {
    throw new Error("downloaded MIDI is longer than 30 minutes");
  }
  return midi.duration;
}

function markdownCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll(/\r?\n/g, " ");
}

const PLAYLIST_HEADER = ["status", "composer", "work", "catalog_id", "note"];

function incrementComposer(counts, composer) {
  counts.set(composer, (counts.get(composer) ?? 0) + 1);
}

function composerSurname(composer) {
  return composer.split(",")[0].trim();
}

export function parsePlaylistTsv(source, { fileName, manifestIds }) {
  const id = basename(fileName, extname(fileName));
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`Playlist file ${fileName} does not have a slug-safe name.`);
  }

  const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
  let name;
  let headerSeen = false;
  const entries = [];
  const seenIds = new Set();
  const missingByComposer = new Map();
  const playableByComposer = new Map();
  let missing = 0;
  let excluded = 0;

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    if (!line.trim()) continue;
    if (line.startsWith("#")) {
      const directive = line.match(/^#\s*name:\s*(.+?)\s*$/i);
      if (directive) name = directive[1];
      continue;
    }

    if (!headerSeen) {
      const header = line.split("\t").map((field) => field.trim());
      if (header.length !== PLAYLIST_HEADER.length ||
          header.some((field, fieldIndex) => field !== PLAYLIST_HEADER[fieldIndex])) {
        throw new Error(
          `Playlist ${fileName}:${lineNumber} must use the header ${PLAYLIST_HEADER.join(", ")}.`,
        );
      }
      headerSeen = true;
      continue;
    }

    const fields = line.split("\t");
    while (fields.length < PLAYLIST_HEADER.length) fields.push("");
    const [status, composer, work, catalogId] = fields.map((field) => field.trim());
    const row = `${fileName}:${lineNumber} (${work || "unnamed row"})`;

    if (status === "verify") {
      throw new Error(`Playlist row ${row} still has status verify.`);
    }
    if (status === "have") {
      if (!manifestIds.has(catalogId)) {
        throw new Error(
          `Playlist row ${row} names catalog_id ${catalogId || "(empty)"}, which is absent from manifest.json.`,
        );
      }
      incrementComposer(playableByComposer, composer);
      if (!seenIds.has(catalogId)) {
        seenIds.add(catalogId);
        entries.push({ ref: catalogId, kind: "catalog" });
      }
      continue;
    }
    if (status === "missing") {
      missing += 1;
      incrementComposer(missingByComposer, composer);
      continue;
    }
    if (status === "excluded") {
      excluded += 1;
      continue;
    }
    throw new Error(`Playlist row ${row} has unknown status ${status || "(empty)"}.`);
  }

  if (!headerSeen) throw new Error(`Playlist ${fileName} has no header row.`);

  const missingComposers = [...missingByComposer]
    .map(([composer, missingCount]) => ({
      surname: composerSurname(composer),
      missing: missingCount,
      playable: playableByComposer.get(composer) ?? 0,
    }))
    .filter(({ missing: missingCount, playable }) => missingCount > playable)
    .sort(
      (left, right) =>
        right.missing - left.missing ||
        left.playable - right.playable ||
        left.surname.localeCompare(right.surname),
    )
    .slice(0, 4)
    .map(({ surname }) => surname);

  return {
    id,
    name: name ?? id,
    entries,
    counts: { resolved: entries.length, missing, excluded },
    missingComposers,
  };
}

function playlistLogSection(files) {
  const rows = files.map(
    ({ fileName, playlist }) =>
      `| \`${markdownCell(fileName)}\` | ${playlist.counts.resolved} | ${playlist.counts.missing} | ${playlist.counts.excluded} |`,
  );
  return `## Playlists

| Source | Resolved | Missing | Excluded |
|---|---:|---:|---:|
${rows.join("\n")}`;
}

async function writePlaylistBuildLog(buildLogPath, files) {
  const current = existsSync(buildLogPath) ? await readFile(buildLogPath, "utf8") : "";
  const marker = "\n## Playlists\n";
  const markerIndex = current.indexOf(marker);
  const base = markerIndex >= 0 ? current.slice(0, markerIndex) : current;
  await writeFile(
    buildLogPath,
    `${base.trimEnd()}\n\n${playlistLogSection(files)}\n`,
  );
}

export async function buildPlaylists({
  playlistsDir,
  manifestPath,
  outputPath,
  buildLogPath,
}) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (!Array.isArray(manifest)) throw new Error("Catalog manifest must be an array");
  const manifestIds = new Set(manifest.map((entry) => entry?.id).filter(Boolean));
  const fileNames = (await readdir(playlistsDir))
    .filter((fileName) => extname(fileName).toLowerCase() === ".tsv")
    .sort((left, right) => left.localeCompare(right));
  const files = [];

  for (const fileName of fileNames) {
    const playlist = parsePlaylistTsv(await readFile(join(playlistsDir, fileName), "utf8"), {
      fileName,
      manifestIds,
    });
    files.push({ fileName, playlist });
  }

  const output = { playlists: files.map(({ playlist }) => playlist) };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  await writePlaylistBuildLog(buildLogPath, files);
  return output;
}

function licenceDocument(manifest, revision, totalBytes) {
  const rows = manifest.map((entry) => {
    const pageUrl = `${MUTOPIA_ORIGIN}/cgibin/piece-info.cgi?id=${entry.mutopiaId}`;
    const creator = entry.licence.creator ?? "Not required (public domain)";
    return `| ${markdownCell(entry.title)} | ${markdownCell(entry.composer)} | ${markdownCell(creator)} | [${entry.licence.name}](${entry.licence.url}) | [Mutopia ${entry.mutopiaId}](${pageUrl}) | \`${entry.asset}\` · \`${entry.licence.sha256}\` |`;
  });
  return `# Catalog licence audit

Generated from the Mutopia GitHub mirror at commit \`${revision}\`.

- Shipped pieces: **${manifest.length}**
- Total score asset weight: **${totalBytes.toLocaleString("en-US")} bytes (${(totalBytes / 1024 / 1024).toFixed(2)} MiB)**

Every row records the exact downloaded MIDI bytes, their SHA-256, the score's
licence, and the Mutopia maintainer/typesetter credit.

| Piece | Composer | Creator / typesetter | Licence | Source page | Shipped asset / SHA-256 |
|---|---|---|---|---|---|
${rows.join("\n")}
`;
}

function buildLogDocument(revision, dropped, composerMappings, recovered) {
  const rows = dropped.length > 0 ? dropped.map((reason) => `- ${reason}`).join("\n") : "- None";
  const mappings = composerMappings
    .map(({ raw, canonical }) => `- \`${markdownCell(raw)}\` → **${markdownCell(canonical)}**`)
    .join("\n");
  const recoveredRows = recovered.length > 0 ? recovered.map((reason) => `- ${reason}`).join("\n") : "- None";
  return `# Catalog ingestion log

Source revision: \`${revision}\`

## Normalisation rules

- Solo-keyboard declarations may list piano with harpsichord, clavichord, or pianoforte. The former exact-\`Piano\` test incorrectly excluded these rows.
- Aliases are folded, must contain at least ${MIN_ALIAS_LENGTH} characters, cannot be a stop word, and cannot be a strict substring of the folded visible title.
- Composer spellings are mapped through \`scripts/catalog-composers.json\`; the original upstream composer remains in each manifest row as \`rawComposer\`.
- Folded title collisions gain upstream opus/subtitle metadata, falling back to the Mutopia catalogue number when that metadata is not distinguishing.

## Recovered candidates

${recoveredRows}

## Composer mappings

${mappings || "- None"}

## Dropped candidates

Dropped candidates: **${dropped.length}**

${rows}
`;
}

export async function buildCatalog({
  sourceDir,
  outputDir,
  cacheDir,
  aliases,
  composerAliases,
  revision,
  fetchDirectory,
  fetchAsset,
  log = console.log,
}) {
  const sourceFiles = (await walk(join(sourceDir, "ftp"))).filter((path) => extname(path) === ".ly");
  const groups = new Map();
  const dropped = [];
  const composerMappings = new Map();
  const recovered = [];

  for (const sourcePath of sourceFiles) {
    const parsed = parsePieceSource(await readFile(sourcePath, "utf8"), sourcePath, sourceDir);
    if (!parsed) continue;
    if (parsed.drop) {
      dropped.push(parsed.drop);
      continue;
    }
    const records = groups.get(parsed.publicationId) ?? [];
    records.push(parsed);
    groups.set(parsed.publicationId, records);
  }

  const publications = [...groups.values()].map(mergePublication);
  for (const piece of publications) {
    const canonicalComposer = composerAliases?.[piece.composer];
    piece.composerMapped = Boolean(canonicalComposer);
    if (canonicalComposer) {
      piece.composer = canonicalComposer;
      composerMappings.set(piece.rawComposer, canonicalComposer);
    }
    if (piece.recoveredInstrument) {
      recovered.push(
        `Mutopia ${piece.publicationId}: accepted solo-keyboard declaration \`${piece.instrument}\`; the former exact-\`Piano\` filter excluded it.`,
      );
    }
  }
  disambiguateTitles(publications);
  const slugCounts = new Map();
  for (const publication of publications) {
    const base = slug(publication.title ?? `mutopia-${publication.publicationId}`);
    slugCounts.set(base, (slugCounts.get(base) ?? 0) + 1);
  }

  const playlistSourceDir = join(outputDir, "playlists");
  const playlistSources = existsSync(playlistSourceDir)
    ? await Promise.all(
        (await readdir(playlistSourceDir))
          .filter((fileName) => extname(fileName).toLowerCase() === ".tsv")
          .map(async (fileName) => ({
            fileName,
            source: await readFile(join(playlistSourceDir, fileName)),
          })),
      )
    : [];
  await rm(outputDir, { recursive: true, force: true });
  if (playlistSources.length > 0) {
    await mkdir(playlistSourceDir, { recursive: true });
    await Promise.all(
      playlistSources.map(({ fileName, source }) =>
        writeFile(join(playlistSourceDir, fileName), source),
      ),
    );
  }
  await mkdir(join(outputDir, "scores"), { recursive: true });

  const manifest = [];
  for (const piece of publications.sort(
    (left, right) => Number(left.publicationId) - Number(right.publicationId),
  )) {
    const label = `Mutopia ${piece.publicationId}`;
    const fail = (reason) => dropped.push(`${label}: ${reason}`);
    if (!piece.title) {
      fail("missing title");
      continue;
    }
    if (!piece.composer) {
      fail("missing composer");
      continue;
    }
    if (!piece.composerMapped) {
      fail(`composer is not mapped (${piece.rawComposer})`);
      continue;
    }
    const licence = licenceFor(piece.licenceText);
    if (!licence) {
      fail(`licence cannot be determined (${piece.licenceText ?? "missing"})`);
      continue;
    }
    if (licence.name !== "Public Domain" && !piece.creator) {
      fail("non-public-domain score is missing its creator/typesetter");
      continue;
    }

    const directoryUrl = publicationUrl(sourceDir, piece.publicationDirectory);
    let assetUrl;
    let sourceUrl;
    let bytes;
    try {
      const html = fetchDirectory
        ? await fetchDirectory(directoryUrl, piece)
        : String(await createCachedFetcher(cacheDir)(directoryUrl, `listings/${piece.publicationId}.html`));
      assetUrl = selectScoreLink(scoreLinks(html, directoryUrl), piece);
      if (!assetUrl) throw new Error("no MIDI asset found");
      const isZip = new URL(assetUrl).pathname.toLowerCase().endsWith(".zip");
      const cacheName = `assets/${createHash("sha256").update(assetUrl).digest("hex")}.${isZip ? "zip" : "mid"}`;
      const downloaded = Buffer.from(
        fetchAsset
          ? await fetchAsset(assetUrl, piece)
          : await createCachedFetcher(cacheDir)(assetUrl, cacheName),
      );
      if (isZip) {
        const entries = extractMidiEntries(downloaded);
        const selectedName = selectName(entries.map((entry) => entry.name), piece);
        const selected = entries.find((entry) => entry.name === selectedName);
        if (!selected) throw new Error("MIDI archive contains no MIDI members");
        bytes = selected.bytes;
        sourceUrl = `${assetUrl}#${encodeURIComponent(selected.name)}`;
      } else {
        bytes = downloaded;
        sourceUrl = assetUrl;
      }
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
      continue;
    }

    let durationSeconds;
    try {
      durationSeconds = validateMidi(bytes);
    } catch (error) {
      fail(error instanceof Error ? error.message : String(error));
      continue;
    }

    const baseId = slug(piece.title);
    const id = slugCounts.get(baseId) === 1 ? baseId : `${baseId}-${piece.publicationId}`;
    const title = CATALOG_TITLE_OVERRIDES.get(id) ?? piece.title;
    const asset = `${id}.mid`;
    const row = {
      id,
      mutopiaId: piece.publicationId,
      title,
      composer: piece.composer,
      rawComposer: piece.rawComposer,
      ...(piece.arranger ? { arranger: piece.arranger } : {}),
      aliases: baselineAliases({ ...piece, title }, aliases[piece.publicationId]),
      asset,
      format: "midi",
      durationSeconds,
      licence: {
        name: licence.name,
        url: licence.url,
        sourceUrl,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        ...(piece.creator ? { creator: piece.creator } : {}),
      },
    };
    await writeFile(join(outputDir, "scores", asset), bytes);
    manifest.push(row);
  }

  manifest.sort(
    (left, right) =>
      left.title.localeCompare(right.title) ||
      left.composer.localeCompare(right.composer) ||
      left.id.localeCompare(right.id),
  );
  dropped.sort();
  recovered.sort();
  const sizes = await Promise.all(
    manifest.map(async (entry) => (await stat(join(outputDir, "scores", entry.asset))).size),
  );
  const totalBytes = sizes.reduce((total, size) => total + size, 0);

  await writeFile(join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(outputDir, "LICENCES.md"), licenceDocument(manifest, revision, totalBytes));
  await writeFile(
    join(outputDir, "BUILD_LOG.md"),
    buildLogDocument(
      revision,
      dropped,
      [...composerMappings].map(([raw, canonical]) => ({ raw, canonical })).sort((left, right) =>
        left.raw.localeCompare(right.raw),
      ),
      recovered,
    ),
  );
  await writeFile(join(outputDir, "index.ts"), "export {};\n");
  for (const reason of dropped) log(`DROP: ${reason}`);
  log(`Shipped ${manifest.length} pieces (${totalBytes} bytes); dropped ${dropped.length}.`);
  return { manifest, dropped, totalBytes };
}

export function createMutopiaSourceAdapter(options) {
  return {
    key: "mutopia",
    priority: 0,
    revision: options.revision,
    async load() {
      const result = await buildCatalog(options);
      const rows = await Promise.all(
        result.manifest.map(async (row) => ({
          ...row,
          bytes: await readFile(join(options.outputDir, "scores", row.asset)),
          sourceKey: "mutopia",
        })),
      );
      return {
        rows,
        dropped: result.dropped,
        baseBuildLog: await readFile(join(options.outputDir, "BUILD_LOG.md"), "utf8"),
      };
    },
  };
}

function inspectMidiAsset({ bytes }) {
  const midi = new Midi(bytes);
  const medians = midi.tracks
    .filter((track) => track.channel !== 9)
    .map((track) => track.notes.filter((note) => note.midi >= 21 && note.midi <= 108))
    .filter((notes) => notes.length > 0)
    .map((notes) => {
      const pitches = notes.map((note) => note.midi).sort((left, right) => left - right);
      const middle = Math.floor(pitches.length / 2);
      return pitches.length % 2 === 0
        ? (pitches[middle - 1] + pitches[middle]) / 2
        : pitches[middle];
    })
    .sort((left, right) => left - right);
  const hasHandData = medians.some((median, index) => index > 0 && median > medians[index - 1]);
  return {
    ok: medians.length > 0,
    ...(medians.length > 0
      ? { piece: { notes: [{ midi: medians[0] }], hasHandData } }
      : { error: { message: "MIDI contains no notes in A0–C8" } }),
  };
}

function mergedLicenceDocument(manifest, revisions, totalBytes) {
  const rows = manifest.map((entry) => {
    const isMutopia = entry.mutopiaId !== undefined;
    const pageUrl = isMutopia
      ? `${MUTOPIA_ORIGIN}/cgibin/piece-info.cgi?id=${entry.mutopiaId}`
      : entry.licence.sourceUrl;
    const sourceLabel = isMutopia ? `Mutopia ${entry.mutopiaId}` : "piano-midi.de";
    const creator = entry.licence.creator ?? "Not required (public domain)";
    return `| ${markdownCell(entry.title)} | ${markdownCell(entry.composer)} | ${markdownCell(creator)} | [${entry.licence.name}](${entry.licence.url}) | [${sourceLabel}](${pageUrl}) | \`${entry.asset}\` · \`${entry.licence.sha256}\` |`;
  });
  return `# Catalog licence audit

Generated from the Mutopia GitHub mirror at commit \`${revisions.mutopia}\` and
the piano-midi.de apex-domain inventory (${revisions["piano-midi.de"]}).

- Shipped pieces: **${manifest.length}**
- Total score asset weight: **${totalBytes.toLocaleString("en-US")} bytes (${(totalBytes / 1024 / 1024).toFixed(2)} MiB)**

## piano-midi.de terms

The source states:

> The MIDI, audio(MP3, OGG) and video files of Bernd Krueger are licensed under
> the cc-by-sa Germany License. This means, that you can use and adapt the
> files, as long as you attribute to the copyright holder Name: Bernd Krueger,
> Source: http://www.piano-midi.de. The distribution or public playback of the
> files is only allowed under identical license conditions.

Every piano-midi.de file and same-licence composite below ships under those
identical conditions. The licence is recorded exactly as worded, with no version
number or invented deed URL. Creator attribution is **Bernd Krueger** and the
licence statement is [http://piano-midi.de/copy.htm](${PIANO_MIDI_LICENCE_URL}).

## Per-piece audit

Every row records the exact shipped MIDI bytes, their SHA-256, the applicable
licence, and the creator/typesetter or performer/sequencer credit.

| Piece | Composer | Creator / typesetter | Licence | Source page | Shipped asset / SHA-256 |
|---|---|---|---|---|---|
${rows.join("\n")}
`;
}

function mergedBuildLogDocument({
  baseBuildLog,
  revisions,
  manifest,
  pianoRows,
  pianoHandRows,
  totalBytes,
  dropped,
  duplicateDrops,
  arrangementDispositions,
}) {
  const compositeRows = pianoRows
    .filter((row) => row.sourceAssets.length > 1)
    .map(
      (row) =>
        `- **${markdownCell(row.title)}**: ${row.sourceAssets.map((url) => `[source MIDI](${url})`).join(", ")}; concatenated in listed movement order and retained under the same licence.`,
    );
  const droppedRows = dropped.length > 0 ? dropped.map((reason) => `- ${reason}`).join("\n") : "- None";
  const duplicateRows = duplicateDrops.length > 0
    ? duplicateDrops.map((reason) => `- ${reason}`).join("\n")
    : "- None";
  const handPercent = pianoRows.length === 0 ? 0 : (pianoHandRows / pianoRows.length) * 100;
  return `${baseBuildLog.trimEnd()}

## Source adapters

- Mutopia: \`${revisions.mutopia}\` (priority 0; wins duplicate works)
- piano-midi.de: ${revisions["piano-midi.de"]} (priority 1; fetched from \`${PIANO_MIDI_ORIGIN}/\` over HTTP)

The adapters supply ids, titles, raw and canonical composer names, exact asset
bytes and per-row licence records. The merged writer validates, hashes, de-duplicates,
sorts and writes both sources through one path.

## piano-midi.de parser gate

- Accepted rows: **${pianoRows.length}**
- Rows with \`hasHandData === true\`: **${pianoHandRows}/${pianoRows.length} (${handPercent.toFixed(1)}%)**
- The build-time MIDI gate yielded at least one A0–C8 note for every accepted row.
- \`tests/build-catalog.test.ts\` independently runs every shipped row through the production \`parsePieceBytes\` path and checks this result and the hand-data fraction.

### Same-licence composites

${compositeRows.join("\n") || "- None"}

### Arrangement rights checks

${arrangementDispositions.map((reason) => `- ${reason}`).join("\n")}

### Duplicate-source skips

${duplicateRows}

### Second-source drops

${droppedRows}

## Shipped catalog weight

- Pieces: **${manifest.length}**
- Score assets: **${totalBytes.toLocaleString("en-US")} bytes (${(totalBytes / 1024 / 1024).toFixed(2)} MiB)**
- 20 MiB deployment flag: **${totalBytes > 20 * 1024 * 1024 ? "OVER — inspect dist/catalog before deployment" : "clear at the score-asset stage"}**
`;
}

async function preservePlaylistSources(outputDir) {
  const playlistSourceDir = join(outputDir, "playlists");
  const sources = existsSync(playlistSourceDir)
    ? await Promise.all(
        (await readdir(playlistSourceDir))
          .filter((fileName) => extname(fileName).toLowerCase() === ".tsv")
          .map(async (fileName) => ({ fileName, source: await readFile(join(playlistSourceDir, fileName)) })),
      )
    : [];
  return { playlistSourceDir, sources };
}

export async function buildCatalogFromAdapters({
  adapters,
  outputDir,
  composerAliases,
  parseAsset,
  log = console.log,
}) {
  const loaded = [];
  for (const adapter of [...adapters].sort((left, right) => left.priority - right.priority)) {
    loaded.push({ adapter, result: await adapter.load() });
  }

  const revisions = Object.fromEntries(loaded.map(({ adapter }) => [adapter.key, adapter.revision]));
  const baseBuildLog = loaded.find(({ result }) => result.baseBuildLog)?.result.baseBuildLog ?? "# Catalog ingestion log";
  const arrangementDispositions = loaded.flatMap(
    ({ result }) => result.arrangementDispositions ?? [],
  );
  const dropped = [];
  const duplicateDrops = [];
  const seenIds = new Map();
  const seenWorks = new Map();
  const accepted = [];
  let pianoHandRows = 0;

  for (const { adapter, result } of loaded) {
    if (adapter.key !== "mutopia") dropped.push(...(result.dropped ?? []));
    for (const candidate of result.rows) {
      const { bytes, sourceKey, sourceAssets = [], ...candidateRow } = candidate;
      const label = `${adapter.key} ${candidateRow.id}`;
      const requiredSource = CATALOG_SOURCE_OVERRIDES.get(candidateRow.id);
      if (requiredSource && sourceKey !== requiredSource) {
        const reason = `${label}: skipped because ${requiredSource} supplies the complete work`;
        duplicateDrops.push(reason);
        log(`SKIP: ${reason}`);
        continue;
      }
      const idOwner = seenIds.get(candidateRow.id);
      if (sourceKey === "piano-midi.de") {
        const canonicalComposer = composerAliases?.[candidateRow.rawComposer];
        if (composerAliases && !canonicalComposer) {
          dropped.push(`${label}: composer is not mapped (${candidateRow.rawComposer})`);
          continue;
        }
        if (canonicalComposer) candidateRow.composer = canonicalComposer;
        candidateRow.aliases = baselineAliases({
          title: candidateRow.title,
          composer: candidateRow.composer,
        });
      }
      const workKey = `${fold(candidateRow.title)}\u0000${fold(candidateRow.composer)}`;
      const workOwner = seenWorks.get(workKey);
      if (idOwner || workOwner) {
        const winner = idOwner ?? workOwner;
        const reason = `${label}: skipped because ${winner} has priority (Mutopia wins when sources overlap)`;
        duplicateDrops.push(reason);
        log(`SKIP: ${reason}`);
        continue;
      }
      if (
        !candidateRow.id ||
        !candidateRow.title ||
        !candidateRow.composer ||
        !candidateRow.rawComposer ||
        !candidateRow.asset ||
        !candidateRow.licence?.name ||
        !candidateRow.licence?.url ||
        !candidateRow.licence?.sourceUrl ||
        !candidateRow.licence?.creator && candidateRow.licence?.name !== "Public Domain"
      ) {
        dropped.push(`${label}: missing required catalog or licence metadata`);
        continue;
      }

      let durationSeconds;
      try {
        durationSeconds = validateMidi(bytes);
      } catch (error) {
        dropped.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }

      if (sourceKey === "piano-midi.de") {
        const parsed = await parseAsset({ asset: candidateRow.asset, bytes });
        if (!parsed.ok || parsed.piece.notes.length === 0) {
          const reason = parsed.ok ? "production parser yielded no A0–C8 notes" : parsed.error.message;
          dropped.push(`${label}: ${reason}`);
          continue;
        }
        if (parsed.piece.hasHandData) pianoHandRows += 1;
      }

      const sha256 = createHash("sha256").update(bytes).digest("hex");
      if (candidateRow.licence.sha256 && candidateRow.licence.sha256 !== sha256) {
        throw new Error(`${label}: adapter checksum does not match its bytes`);
      }
      const row = {
        ...candidateRow,
        durationSeconds: candidateRow.durationSeconds ?? durationSeconds,
        licence: { ...candidateRow.licence, sha256 },
      };
      seenIds.set(row.id, label);
      seenWorks.set(workKey, label);
      accepted.push({ row, bytes, sourceKey, sourceAssets });
    }
  }

  accepted.sort(
    (left, right) =>
      left.row.title.localeCompare(right.row.title) ||
      left.row.composer.localeCompare(right.row.composer) ||
      left.row.id.localeCompare(right.row.id),
  );
  const { playlistSourceDir, sources } = await preservePlaylistSources(outputDir);
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(join(outputDir, "scores"), { recursive: true });
  if (sources.length > 0) {
    await mkdir(playlistSourceDir, { recursive: true });
    await Promise.all(sources.map(({ fileName, source }) => writeFile(join(playlistSourceDir, fileName), source)));
  }
  for (const { row, bytes } of accepted) {
    await writeFile(join(outputDir, "scores", row.asset), bytes);
  }

  const manifest = accepted.map(({ row }) => row);
  const pianoRows = accepted.filter(({ sourceKey }) => sourceKey === "piano-midi.de");
  const totalBytes = accepted.reduce((total, { bytes }) => total + bytes.byteLength, 0);
  await writeFile(join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(outputDir, "LICENCES.md"), mergedLicenceDocument(manifest, revisions, totalBytes));
  await writeFile(
    join(outputDir, "BUILD_LOG.md"),
    mergedBuildLogDocument({
      baseBuildLog,
      revisions,
      manifest,
      pianoRows,
      pianoHandRows,
      totalBytes,
      dropped,
      duplicateDrops,
      arrangementDispositions,
    }),
  );
  await writeFile(join(outputDir, "index.ts"), "export {};\n");
  for (const reason of dropped) log(`DROP: ${reason}`);
  log(`Shipped ${manifest.length} pieces (${totalBytes} bytes); dropped ${dropped.length}.`);
  return { manifest, dropped, duplicateDrops, totalBytes, pianoHandRows };
}

export async function reportDeployedCatalogWeight({ distCatalogDir, buildLogPath }) {
  const buildLogName = "BUILD_LOG.md";
  const sectionPattern = /\n## Deployed catalog weight\n[\s\S]*?(?=\n## Playlists\n|$)/;
  const current = await readFile(buildLogPath, "utf8");
  const withoutSection = current.replace(sectionPattern, "").trimEnd();
  const playlistMarker = "\n## Playlists\n";
  const playlistIndex = withoutSection.indexOf(playlistMarker);
  const beforePlaylists = playlistIndex >= 0 ? withoutSection.slice(0, playlistIndex) : withoutSection;
  const playlists = playlistIndex >= 0 ? withoutSection.slice(playlistIndex) : "";
  const files = (await walk(distCatalogDir)).filter((path) => basename(path) !== buildLogName);
  const otherBytes = (
    await Promise.all(files.map(async (path) => (await stat(path)).size))
  ).reduce((total, size) => total + size, 0);
  let totalBytes = otherBytes;
  let document = "";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const section = `## Deployed catalog weight

- \`dist/catalog\`: **${totalBytes.toLocaleString("en-US")} bytes (${(totalBytes / 1024 / 1024).toFixed(2)} MiB)**
- 20 MiB deployment flag: **${totalBytes > 20 * 1024 * 1024 ? "OVER — inspect before deployment" : "clear"}**`;
    document = `${beforePlaylists.trimEnd()}\n\n${section}${playlists}\n`;
    const nextTotal = otherBytes + Buffer.byteLength(document);
    if (nextTotal === totalBytes) break;
    totalBytes = nextTotal;
  }
  await writeFile(buildLogPath, document);
  await writeFile(join(distCatalogDir, buildLogName), document);
  return { totalBytes, overLimit: totalBytes > 20 * 1024 * 1024 };
}

async function main() {
  const catalogDir = resolve(process.env.CATALOG_OUTPUT_DIR ?? join(ROOT, "catalog"));
  const playlistsDir = join(catalogDir, "playlists");
  const manifestPath = join(catalogDir, "manifest.json");
  const playlistOutputPath = join(catalogDir, "playlists.json");
  const buildLogPath = join(catalogDir, "BUILD_LOG.md");
  if (process.argv.includes("--report-dist-weight")) {
    const result = await reportDeployedCatalogWeight({
      distCatalogDir: resolve(process.env.DIST_CATALOG_DIR ?? join(ROOT, "dist", "catalog")),
      buildLogPath,
    });
    console.log(
      `dist/catalog is ${result.totalBytes} bytes; 20 MiB flag ${result.overLimit ? "OVER" : "clear"}.`,
    );
    return;
  }
  if (process.argv.includes("--playlists-only")) {
    await buildPlaylists({ playlistsDir, manifestPath, outputPath: playlistOutputPath, buildLogPath });
    return;
  }

  const refresh = process.argv.includes("--refresh");
  const sourceDir = resolve(process.env.MUTOPIA_SOURCE_DIR ?? join(ROOT, "work", "mutopia"));
  const revision = await ensureMirror(sourceDir, refresh);
  const cacheDir = resolve(
    process.env.CATALOG_CACHE_DIR ?? join(ROOT, "work", "catalog-cache", revision),
  );
  const aliases = JSON.parse(
    await readFile(join(ROOT, "scripts", "catalog-aliases.json"), "utf8"),
  );
  const composerAliases = JSON.parse(
    await readFile(join(ROOT, "scripts", "catalog-composers.json"), "utf8"),
  );
  const cachedFetch = createCachedFetcher(cacheDir);
  const mutopiaOnly = process.argv.includes("--mutopia-only");
  const mutopiaOutputDir = mutopiaOnly
    ? catalogDir
    : resolve(process.env.MUTOPIA_STAGE_DIR ?? join(ROOT, "work", "catalog-mutopia-stage"));
  const mutopiaAdapter = createMutopiaSourceAdapter({
    sourceDir,
    outputDir: mutopiaOutputDir,
    cacheDir,
    aliases,
    composerAliases,
    revision,
    fetchDirectory: async (url, piece) =>
      String(await cachedFetch(url, `listings/${piece.publicationId}.html`)),
    fetchAsset: async (url) =>
      cachedFetch(url, `assets/${createHash("sha256").update(url).digest("hex")}.mid`),
  });
  if (mutopiaOnly) {
    await mutopiaAdapter.load();
  } else {
    const pianoMidiAdapter = createPianoMidiSourceAdapter({
      cacheDir: resolve(
        process.env.PIANO_MIDI_CACHE_DIR ?? join(ROOT, "work", "piano-midi-de"),
      ),
      composerAliases,
    });
    await buildCatalogFromAdapters({
      adapters: [mutopiaAdapter, pianoMidiAdapter],
      outputDir: catalogDir,
      composerAliases,
      parseAsset: inspectMidiAsset,
    });
  }
  if (!existsSync(playlistsDir)) return;
  await buildPlaylists({
    playlistsDir,
    manifestPath,
    outputPath: playlistOutputPath,
    buildLogPath,
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
