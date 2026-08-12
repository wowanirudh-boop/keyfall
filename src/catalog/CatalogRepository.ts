import { catalogAssetUrl } from "./assets";

export interface CatalogEntry {
  id: string;
  title: string;
  composer: string;
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

export function searchCatalog(entries: readonly CatalogEntry[], query: string) {
  const foldedQuery = fold(query);
  if (!foldedQuery) return [];
  const rank = (entry: CatalogEntry) => {
    const title = fold(entry.title);
    const composer = fold(entry.composer);
    if (title === foldedQuery) return 0;
    if (entry.aliases.includes(foldedQuery)) return 1;
    if (title.startsWith(foldedQuery)) return 2;
    if (title.includes(foldedQuery)) return 3;
    if (entry.aliases.some((alias) => alias.includes(foldedQuery))) return 4;
    if (composer.includes(foldedQuery)) return 5;
    return null;
  };
  return entries
    .map((entry, index) => ({ entry, index, rank: rank(entry) }))
    .filter((match): match is { entry: CatalogEntry; index: number; rank: number } =>
      match.rank !== null,
    )
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map((match) => match.entry);
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
