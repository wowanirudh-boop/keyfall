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
const REQUEST_INTERVAL_MS = 1_000;
const MAX_DURATION_SECONDS = 30 * 60;
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

  await rm(outputDir, { recursive: true, force: true });
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
    const asset = `${id}.mid`;
    const row = {
      id,
      mutopiaId: piece.publicationId,
      title: piece.title,
      composer: piece.composer,
      rawComposer: piece.rawComposer,
      ...(piece.arranger ? { arranger: piece.arranger } : {}),
      aliases: baselineAliases(piece, aliases[piece.publicationId]),
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

async function main() {
  const refresh = process.argv.includes("--refresh");
  const sourceDir = resolve(process.env.MUTOPIA_SOURCE_DIR ?? join(ROOT, "work", "mutopia"));
  const outputDir = resolve(process.env.CATALOG_OUTPUT_DIR ?? join(ROOT, "catalog"));
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
  await buildCatalog({
    sourceDir,
    outputDir,
    cacheDir,
    aliases,
    composerAliases,
    revision,
    fetchDirectory: async (url, piece) =>
      String(await cachedFetch(url, `listings/${piece.publicationId}.html`)),
    fetchAsset: async (url) =>
      cachedFetch(url, `assets/${createHash("sha256").update(url).digest("hex")}.mid`),
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
