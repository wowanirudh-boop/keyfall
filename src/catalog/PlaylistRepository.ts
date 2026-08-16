import type { CatalogEntry } from "./CatalogRepository";

export interface PlaylistReference {
  ref: string;
  kind: "catalog";
}

export interface PlaylistCounts {
  resolved: number;
  missing: number;
  excluded: number;
}

export interface PlaylistDocument {
  id: string;
  name: string;
  entries: PlaylistReference[];
  counts: PlaylistCounts;
  missingComposers: string[];
}

export interface LoadedPlaylistEntry extends PlaylistReference {
  catalogEntry: CatalogEntry;
}

export interface LoadedPlaylist extends Omit<PlaylistDocument, "entries"> {
  entries: LoadedPlaylistEntry[];
  durationSeconds: number;
}

export interface PlaylistRepositoryOptions {
  loadPlaylists?: () => Promise<unknown>;
  warn?: (message: string) => void;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isCount(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function validatePlaylistDocument(value: unknown): PlaylistDocument | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const counts = row.counts as Record<string, unknown> | undefined;
  if (
    !isNonEmptyString(row.id) ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.id) ||
    !isNonEmptyString(row.name) ||
    !Array.isArray(row.entries) ||
    !row.entries.every(
      (entry) =>
        Boolean(entry) &&
        typeof entry === "object" &&
        (entry as Record<string, unknown>).kind === "catalog" &&
        isNonEmptyString((entry as Record<string, unknown>).ref) &&
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(
          (entry as Record<string, unknown>).ref as string,
        ),
    ) ||
    new Set(row.entries.map((entry) => (entry as PlaylistReference).ref)).size !==
      row.entries.length ||
    !counts ||
    !isCount(counts.resolved) ||
    counts.resolved !== row.entries.length ||
    !isCount(counts.missing) ||
    !isCount(counts.excluded) ||
    !Array.isArray(row.missingComposers) ||
    !row.missingComposers.every(isNonEmptyString)
  ) {
    return null;
  }
  return value as PlaylistDocument;
}

async function fetchPlaylists() {
  const response = await fetch("/catalog/playlists.json");
  if (!response.ok) throw new Error(`Playlists request failed with ${response.status}`);
  return response.json() as Promise<unknown>;
}

export class PlaylistRepository {
  #playlists: LoadedPlaylist[] = [];
  readonly #loadPlaylists: () => Promise<unknown>;
  readonly #warn: (message: string) => void;

  constructor(options: PlaylistRepositoryOptions = {}) {
    this.#loadPlaylists = options.loadPlaylists ?? fetchPlaylists;
    this.#warn = options.warn ?? console.warn;
  }

  async load(catalogEntries: readonly CatalogEntry[]) {
    const value = await this.#loadPlaylists();
    const documents =
      value && typeof value === "object"
        ? (value as Record<string, unknown>).playlists
        : undefined;
    if (!Array.isArray(documents)) throw new Error("Playlist catalog must contain playlists");

    const catalogById = new Map(catalogEntries.map((entry) => [entry.id, entry]));
    const playlists: LoadedPlaylist[] = [];
    for (const [index, value] of documents.entries()) {
      const document = validatePlaylistDocument(value);
      if (!document) {
        this.#warn(`Playlist row ${index} was dropped: invalid playlist fields.`);
        continue;
      }
      const entries: LoadedPlaylistEntry[] = [];
      for (const reference of document.entries) {
        const catalogEntry = catalogById.get(reference.ref);
        if (!catalogEntry) {
          this.#warn(
            `Playlist ${document.id} reference ${reference.ref} was dropped: absent from catalog manifest.`,
          );
          continue;
        }
        entries.push({ ...reference, catalogEntry });
      }
      playlists.push({
        ...document,
        entries,
        durationSeconds: entries.reduce(
          (total, entry) => total + (entry.catalogEntry.durationSeconds ?? 0),
          0,
        ),
      });
    }
    if (documents.length > 0 && playlists.length === 0) {
      throw new Error("No playlists could be loaded");
    }
    this.#playlists = playlists;
    return [...playlists];
  }

  list() {
    return [...this.#playlists];
  }
}
