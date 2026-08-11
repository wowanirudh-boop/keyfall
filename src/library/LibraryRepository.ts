import Dexie, { type Table } from "dexie";

import type { PieceDocument } from "../music";
import type { PlaybackSpeed } from "../playback";

export const LIBRARY_DATABASE_NAME = "piano-practice-player";

export interface StoredPiece extends PieceDocument {
  originalName: string;
  originalBytes: Uint8Array;
  lastOpened: number;
  lastSpeed: PlaybackSpeed;
}

export interface StoredAttempt {
  id: string;
  pieceId: string;
  createdAt: number;
  report: unknown;
}

export interface SavedPieceSummary {
  id: string;
  title: string;
  composer: string;
  duration: number;
  lastOpened: number;
  lastSpeed: PlaybackSpeed;
}

export interface SavePieceInput {
  piece: PieceDocument;
  originalName: string;
  originalBytes: Uint8Array;
  lastSpeed?: PlaybackSpeed;
}

export class PianoDatabase extends Dexie {
  pieces!: Table<StoredPiece, string>;
  attempts!: Table<StoredAttempt, string>;

  constructor(name = LIBRARY_DATABASE_NAME) {
    super(name);
    this.version(1).stores({
      pieces: "id,lastOpened",
      attempts: "id,pieceId,createdAt",
    });
  }
}

export interface LibraryRepositoryOptions {
  database?: PianoDatabase;
  now?: () => number;
  requestPersistence?: () => Promise<boolean>;
}

function defaultPersistenceRequest() {
  return navigator.storage?.persist?.() ?? Promise.resolve(false);
}

export class LibraryRepository {
  readonly #database: PianoDatabase;
  readonly #now: () => number;
  readonly #requestPersistence: () => Promise<boolean>;
  readonly #sessionPieces = new Map<string, StoredPiece>();
  #persistenceRequested = false;

  constructor(options: LibraryRepositoryOptions = {}) {
    this.#database = options.database ?? new PianoDatabase();
    this.#now = options.now ?? Date.now;
    this.#requestPersistence = options.requestPersistence ?? defaultPersistenceRequest;
  }

  async save({ piece, originalName, originalBytes, lastSpeed = 1 }: SavePieceInput) {
    if (!this.#persistenceRequested) {
      this.#persistenceRequested = true;
      try {
        await this.#requestPersistence();
      } catch {
        // Persistence is a best-effort browser hint; IndexedDB may still succeed.
      }
    }

    const stored: StoredPiece = {
      ...piece,
      notes: piece.notes.map((note) => ({ ...note })),
      notices: piece.notices.map((notice) => ({ ...notice })),
      originalName,
      originalBytes: originalBytes.slice(),
      lastOpened: this.#now(),
      lastSpeed,
    };
    this.#sessionPieces.set(piece.id, stored);

    try {
      await this.#database.pieces.put(stored);
      return { saved: true as const };
    } catch {
      return { saved: false as const };
    }
  }

  async list(): Promise<SavedPieceSummary[]> {
    const rows = await this.#database.pieces.orderBy("lastOpened").reverse().toArray();
    return rows.map(({ id, title, composer, duration, lastOpened, lastSpeed }) => ({
      id,
      title,
      composer,
      duration,
      lastOpened,
      lastSpeed,
    }));
  }

  async get(pieceId: string) {
    const sessionPiece = this.#sessionPieces.get(pieceId);
    if (sessionPiece) return sessionPiece;
    const stored = await this.#database.pieces.get(pieceId);
    if (stored) this.#sessionPieces.set(pieceId, stored);
    return stored;
  }

  async touch(pieceId: string) {
    const lastOpened = this.#now();
    const sessionPiece = this.#sessionPieces.get(pieceId);
    if (sessionPiece) sessionPiece.lastOpened = lastOpened;
    await this.#database.pieces.update(pieceId, { lastOpened });
  }

  async setLastSpeed(pieceId: string, lastSpeed: PlaybackSpeed) {
    const sessionPiece = this.#sessionPieces.get(pieceId);
    if (sessionPiece) sessionPiece.lastSpeed = lastSpeed;
    await this.#database.pieces.update(pieceId, { lastSpeed });
  }

  async delete(pieceId: string) {
    this.#sessionPieces.delete(pieceId);
    await this.#database.pieces.delete(pieceId);
  }
}

export function relativeOpened(lastOpened: number, now: number) {
  const elapsedDays = Math.floor(Math.max(0, now - lastOpened) / 86_400_000);
  if (elapsedDays === 0) return "TODAY";
  if (elapsedDays === 1) return "YESTERDAY";
  return `${elapsedDays} DAYS AGO`;
}
