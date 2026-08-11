import { describe, expect, it, vi } from "vitest";

import type { PieceDocument } from "../music";
import { LibraryRepository, type PianoDatabase, relativeOpened } from "./LibraryRepository";

const piece: PieceDocument = {
  id: "saved-piece",
  title: "Saved piece",
  composer: "Composer",
  source: "midi-upload",
  duration: 12,
  notes: [{ id: "n1", midi: 60, start: 0, end: 1, velocity: 0.8, hand: "unknown" }],
  hasHandData: false,
  notices: [],
};

function databaseWith(overrides: Partial<PianoDatabase["pieces"]> = {}) {
  return {
    pieces: {
      put: vi.fn().mockResolvedValue(piece.id),
      get: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(1),
      delete: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    },
  } as unknown as PianoDatabase;
}

describe("LibraryRepository", () => {
  it("stores original bytes, the normalized timeline, metadata, and requests persistence once", async () => {
    const database = databaseWith();
    const requestPersistence = vi.fn().mockResolvedValue(true);
    const repository = new LibraryRepository({
      database,
      now: () => 123,
      requestPersistence,
    });
    const bytes = new Uint8Array([1, 2, 3]);

    await expect(
      repository.save({ piece, originalName: "saved.mid", originalBytes: bytes, lastSpeed: 0.5 }),
    ).resolves.toEqual({ saved: true });
    await repository.save({ piece, originalName: "saved.mid", originalBytes: bytes });

    expect(requestPersistence).toHaveBeenCalledOnce();
    expect(database.pieces.put).toHaveBeenCalledWith(
      expect.objectContaining({
        id: piece.id,
        notes: piece.notes,
        originalName: "saved.mid",
        originalBytes: bytes,
        lastOpened: 123,
        lastSpeed: 0.5,
      }),
    );
  });

  it("keeps a piece usable for the session when IndexedDB rejects the save", async () => {
    const database = databaseWith({ put: vi.fn().mockRejectedValue(new Error("QuotaExceeded")) });
    const repository = new LibraryRepository({
      database,
      now: () => 123,
      requestPersistence: async () => false,
    });

    await expect(
      repository.save({
        piece,
        originalName: "saved.mid",
        originalBytes: new Uint8Array([1]),
      }),
    ).resolves.toEqual({ saved: false });
    await expect(repository.get(piece.id)).resolves.toEqual(expect.objectContaining(piece));
  });

  it("[AC5] removes both the session copy and the IndexedDB record", async () => {
    const database = databaseWith();
    const repository = new LibraryRepository({
      database,
      now: () => 123,
      requestPersistence: async () => true,
    });
    await repository.save({
      piece,
      originalName: "saved.mid",
      originalBytes: new Uint8Array([1]),
    });

    await repository.delete(piece.id);

    expect(database.pieces.delete).toHaveBeenCalledWith(piece.id);
    await expect(repository.get(piece.id)).resolves.toBeUndefined();
  });

  it("formats My Pieces dates from an injected current time", () => {
    const now = 3 * 86_400_000;
    expect(relativeOpened(now, now)).toBe("TODAY");
    expect(relativeOpened(now - 86_400_000, now)).toBe("YESTERDAY");
    expect(relativeOpened(0, now)).toBe("3 DAYS AGO");
  });
});
