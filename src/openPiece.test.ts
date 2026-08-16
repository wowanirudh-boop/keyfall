import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./music", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./music")>();
  return { ...actual, importPiece: vi.fn() };
});

import type { CatalogEntry } from "./catalog";
import { importPiece, type PieceDocument } from "./music";
import { importAndSaveCatalogEntry, savePiecePreservingSpeed } from "./openPiece";

const piece: PieceDocument = {
  id: "saved-piece",
  title: "Saved piece",
  composer: "Composer",
  source: "catalog",
  duration: 12,
  notes: [],
  hasHandData: false,
  notices: [],
};

function catalogEntry(licenceUrl: string): CatalogEntry {
  return {
    id: "same-piece-id",
    title: "Catalog title",
    composer: "Catalog composer",
    rawComposer: "Catalog composer",
    aliases: [],
    asset: "catalog.mid",
    format: "midi",
    licence: {
      name: "Licence",
      url: licenceUrl,
      sourceUrl: "https://example.test/catalog.mid",
      sha256: "0".repeat(64),
      creator: "Catalog creator",
    },
  };
}

beforeEach(() => {
  vi.mocked(importPiece).mockReset();
  vi.mocked(importPiece).mockResolvedValue({ ok: true, piece });
});

describe("savePiecePreservingSpeed", () => {
  it("[T12a AC5] keeps a previously saved lastSpeed on catalog reopen", async () => {
    const save = vi.fn().mockResolvedValue({ saved: true });
    const repository = {
      get: vi.fn().mockResolvedValue({ lastSpeed: 0.5 }),
      save,
    };
    const bytes = new Uint8Array([1, 2, 3]);

    await savePiecePreservingSpeed(repository as never, piece, "saved.mid", bytes);

    expect(save).toHaveBeenCalledWith({
      piece,
      originalName: "saved.mid",
      originalBytes: bytes,
      lastSpeed: 0.5,
    });
  });
});

describe("importAndSaveCatalogEntry", () => {
  it.each([
    ["http://piano-midi.de/copy.htm", "piano-midi.de"],
    ["https://creativecommons.org/licenses/by-sa/4.0/", "Mutopia Project"],
  ])(
    "[T13a AC1, AC2, AC4, AC6] derives %s into the re-imported document",
    async (licenceUrl, sourceCollection) => {
      const bytes = new Uint8Array([1, 2, 3]);
      const save = vi.fn().mockResolvedValue({ saved: true });
      const library = {
        get: vi.fn().mockResolvedValue({ ...piece, lastSpeed: 0.5 }),
        save,
      };

      await importAndSaveCatalogEntry(
        catalogEntry(licenceUrl),
        { open: vi.fn().mockResolvedValue(bytes) } as never,
        library as never,
      );

      expect(save).toHaveBeenCalledWith({
        piece: {
          ...piece,
          id: "same-piece-id",
          title: "Catalog title",
          composer: "Catalog composer",
          source: "catalog",
          sourceCollection,
          sourceCreator: "Catalog creator",
        },
        originalName: "catalog.mid",
        originalBytes: bytes,
        lastSpeed: 0.5,
      });
    },
  );
});
