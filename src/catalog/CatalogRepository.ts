import { catalogAssetUrl } from "./assets";

export interface CatalogEntry {
  id: string;
  title: string;
  composer: string;
  rawComposer: string;
  arranger?: string;
  aliases: string[];
  asset: string;
  format: "midi" | "musicxml";
  durationSeconds?: number;
  licence: {
    name: string;
    url: string;
    sourceUrl: string;
    sha256: string;
    creator?: string;
  };
}

export interface CatalogRepositoryOptions {
  loadManifest?: () => Promise<unknown>;
  loadAsset?: (asset: string) => Promise<Uint8Array>;
  warn?: (message: string) => void;
}

export class CatalogAssetError extends Error {}

export function fold(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const foldedEntryCache = new WeakMap<CatalogEntry, { title: string; composer: string }>();

function foldedEntry(entry: CatalogEntry) {
  const cached = foldedEntryCache.get(entry);
  if (cached) return cached;
  const fields = { title: fold(entry.title), composer: fold(entry.composer) };
  foldedEntryCache.set(entry, fields);
  return fields;
}

export function searchCatalog(
  entries: readonly CatalogEntry[],
  query: string,
  sort: CatalogSort = "composer",
) {
  const foldedQuery = fold(query);
  if (!foldedQuery) return [];
  const rank = (entry: CatalogEntry) => {
    const { title, composer } = foldedEntry(entry);
    if (title === foldedQuery) return 0;
    if (title.startsWith(foldedQuery)) return 1;
    if (title.includes(foldedQuery)) return 2;
    if (composer.includes(foldedQuery)) return 3;
    if (
      entry.aliases.some(
        (alias) =>
          alias === foldedQuery ||
          alias.includes(foldedQuery) ||
          (alias.length >= 4 && foldedQuery.includes(alias)),
      )
    ) {
      return 4;
    }
    return null;
  };
  return entries
    .map((entry, index) => ({ entry, index, rank: rank(entry) }))
    .filter((match): match is { entry: CatalogEntry; index: number; rank: number } =>
      match.rank !== null,
    )
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        compareCatalogEntries(left.entry, right.entry, sort) ||
        left.index - right.index,
    )
    .map((match) => match.entry);
}

/**
 * Numeric-aware and accent-insensitive. Plain `localeCompare` sorts string-wise,
 * which put "Invention 15" before "Invention 2" and "Prelude Op. 23, No. 10"
 * before "No. 2" — 24 such pairs across the shipped catalog (D-028).
 */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export type CatalogSort = "composer" | "title" | "shortest" | "longest";

export const CATALOG_SORTS: ReadonlyArray<{ id: CatalogSort; label: string }> = Object.freeze([
  { id: "composer", label: "Composer A–Z" },
  { id: "title", label: "Title A–Z" },
  { id: "shortest", label: "Shortest first" },
  { id: "longest", label: "Longest first" },
]);

export function isCatalogSort(value: unknown): value is CatalogSort {
  return CATALOG_SORTS.some((sort) => sort.id === value);
}

/** Entries with no declared duration sort last in both duration orders. */
function compareDuration(left: CatalogEntry, right: CatalogEntry, longestFirst: boolean) {
  const leftDuration = left.durationSeconds;
  const rightDuration = right.durationSeconds;
  if (leftDuration === undefined && rightDuration === undefined) return 0;
  if (leftDuration === undefined) return 1;
  if (rightDuration === undefined) return -1;
  return longestFirst ? rightDuration - leftDuration : leftDuration - rightDuration;
}

export function compareCatalogEntries(
  left: CatalogEntry,
  right: CatalogEntry,
  sort: CatalogSort = "composer",
) {
  const byComposer = () => collator.compare(left.composer, right.composer);
  const byTitle = () => collator.compare(left.title, right.title);
  const tieBreak = byTitle() || byComposer() || collator.compare(left.id, right.id);

  if (sort === "title") return byTitle() || byComposer() || collator.compare(left.id, right.id);
  if (sort === "shortest") return compareDuration(left, right, false) || tieBreak;
  if (sort === "longest") return compareDuration(left, right, true) || tieBreak;
  return byComposer() || byTitle() || collator.compare(left.id, right.id);
}

export function browseCatalog(
  entries: readonly CatalogEntry[],
  sort: CatalogSort = "composer",
) {
  return [...entries].sort((left, right) => compareCatalogEntries(left, right, sort));
}

/** Composer name -> number of pieces, in the browse order composers appear. */
export function composerIndex(entries: readonly CatalogEntry[]) {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.composer, (counts.get(entry.composer) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([composer, count]) => ({ composer, count }))
    .sort((left, right) => collator.compare(left.composer, right.composer));
}

function isWebUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function validateCatalogEntry(value: unknown): CatalogEntry | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const licence = row.licence as Record<string, unknown> | undefined;
  const nonEmpty = (candidate: unknown) => typeof candidate === "string" && candidate.trim() !== "";
  if (
    !nonEmpty(row.id) ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.id as string) ||
    !nonEmpty(row.title) ||
    !nonEmpty(row.composer) ||
    !nonEmpty(row.rawComposer) ||
    (row.arranger !== undefined && !nonEmpty(row.arranger)) ||
    !Array.isArray(row.aliases) ||
    !row.aliases.every((alias) => nonEmpty(alias) && alias === fold(alias as string)) ||
    !nonEmpty(row.asset) ||
    !/^[a-z0-9][a-z0-9-]*\.(mid|midi|musicxml|xml|mxl)$/.test(row.asset as string) ||
    (row.format !== "midi" && row.format !== "musicxml") ||
    (row.durationSeconds !== undefined &&
      (typeof row.durationSeconds !== "number" ||
        !Number.isFinite(row.durationSeconds) ||
        row.durationSeconds <= 0)) ||
    !licence ||
    !nonEmpty(licence.name) ||
    !nonEmpty(licence.url) ||
    !isWebUrl(licence.url as string) ||
    !nonEmpty(licence.sourceUrl) ||
    !isWebUrl(licence.sourceUrl as string) ||
    typeof licence.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(licence.sha256) ||
    (licence.name !== "Public Domain" && !nonEmpty(licence.creator)) ||
    (licence.creator !== undefined && !nonEmpty(licence.creator))
  ) {
    return null;
  }
  return value as CatalogEntry;
}

export async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function checksumMatches(bytes: Uint8Array, expected: string) {
  if (!globalThis.crypto?.subtle) return true;
  return (await sha256(bytes)) === expected;
}

async function fetchAsset(asset: string) {
  const response = await fetch(catalogAssetUrl(asset));
  if (!response.ok) throw new Error(`Asset request failed with ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function fetchManifest() {
  const response = await fetch("/catalog/manifest.json");
  if (!response.ok) throw new Error(`Manifest request failed with ${response.status}`);
  return response.json() as Promise<unknown>;
}

export class CatalogRepository {
  #entries: CatalogEntry[] = [];
  readonly #loadManifest: () => Promise<unknown>;
  readonly #loadAsset: (asset: string) => Promise<Uint8Array>;
  readonly #warn: (message: string) => void;

  constructor(options: CatalogRepositoryOptions = {}) {
    this.#loadManifest = options.loadManifest ?? fetchManifest;
    this.#loadAsset = options.loadAsset ?? fetchAsset;
    this.#warn = options.warn ?? console.warn;
  }

  async load() {
    const manifest = await this.#loadManifest();
    if (!Array.isArray(manifest)) throw new Error("Catalog manifest must be an array");

    const entries: CatalogEntry[] = [];
    for (const [index, value] of manifest.entries()) {
      const entry = validateCatalogEntry(value);
      if (!entry) {
        this.#warn(`Catalog row ${index} was dropped: invalid manifest fields.`);
        continue;
      }
      foldedEntry(entry);
      entries.push(entry);
    }
    if (manifest.length > 0 && entries.length === 0) {
      throw new Error("No catalog entries could be loaded");
    }
    this.#entries = entries;
    return [...entries];
  }

  list() {
    return [...this.#entries];
  }

  search(query: string) {
    return searchCatalog(this.#entries, query);
  }

  async open(entry: CatalogEntry) {
    try {
      const bytes = await this.#loadAsset(entry.asset);
      if (!(await checksumMatches(bytes, entry.licence.sha256))) {
        throw new Error("checksum mismatch");
      }
      return bytes;
    } catch {
      throw new CatalogAssetError(`The score file for “${entry.title}” could not be opened.`);
    }
  }
}
