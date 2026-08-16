import { afterEach, describe, expect, it, vi } from "vitest";

import { FIXTURE_MANIFEST } from "./__fixtures__/manifest";
import { PlaylistRepository, validatePlaylistDocument } from "./PlaylistRepository";

const playlist = {
  id: "fixture-playlist",
  name: "Fixture playlist",
  entries: [
    { ref: "fur-elise", kind: "catalog" },
    { ref: "missing-piece", kind: "catalog" },
  ],
  counts: { resolved: 2, missing: 3, excluded: 1 },
  missingComposers: ["Example"],
};

describe("PlaylistRepository", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("[T12a AC7] fetches the static playlist catalog and validates it lazily", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ playlists: [{ ...playlist, entries: playlist.entries.slice(0, 1), counts: { ...playlist.counts, resolved: 1 } }] }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const repository = new PlaylistRepository();

    const loaded = await repository.load(FIXTURE_MANIFEST);

    expect(loaded).toHaveLength(1);
    expect(loaded[0].entries[0].catalogEntry).toBe(FIXTURE_MANIFEST[0]);
    expect(loaded[0].durationSeconds).toBe(FIXTURE_MANIFEST[0].durationSeconds);
    expect(fetchMock).toHaveBeenCalledWith("/catalog/playlists.json");
  });

  it("[T12a AC2] drops a reference absent from the loaded manifest and warns", async () => {
    const warn = vi.fn();
    const repository = new PlaylistRepository({
      loadPlaylists: async () => ({ playlists: [playlist] }),
      warn,
    });

    const [loaded] = await repository.load(FIXTURE_MANIFEST);

    expect(loaded.entries.map((entry) => entry.ref)).toEqual(["fur-elise"]);
    expect(warn).toHaveBeenCalledWith(
      "Playlist fixture-playlist reference missing-piece was dropped: absent from catalog manifest.",
    );
  });

  it("[T12a AC7] rejects malformed data so its caller can hide the section", async () => {
    const repository = new PlaylistRepository({
      loadPlaylists: async () => ({ playlists: [{ ...playlist, name: "" }] }),
      warn: vi.fn(),
    });

    await expect(repository.load(FIXTURE_MANIFEST)).rejects.toThrow(
      "No playlists could be loaded",
    );
    expect(validatePlaylistDocument({ ...playlist, counts: { ...playlist.counts, missing: -1 } })).toBeNull();
  });
});
