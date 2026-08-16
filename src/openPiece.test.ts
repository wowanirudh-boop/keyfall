import { describe, expect, it, vi } from "vitest";

import type { PieceDocument } from "./music";
import { savePiecePreservingSpeed } from "./openPiece";

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
