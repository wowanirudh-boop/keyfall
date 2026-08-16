import type { LoadedPlaylist } from "../../catalog";
import { FIXTURE_MANIFEST } from "../../catalog/__fixtures__/manifest";

const entries = FIXTURE_MANIFEST.slice(0, 2).map((catalogEntry) => ({
  ref: catalogEntry.id,
  kind: "catalog" as const,
  catalogEntry,
}));

export const FIXTURE_PLAYLIST: LoadedPlaylist = {
  id: "fixture-playlist",
  name: "Fixture playlist",
  entries,
  counts: { resolved: entries.length, missing: 3, excluded: 1 },
  missingComposers: ["Alpha", "Beta"],
  durationSeconds: entries.reduce(
    (total, entry) => total + (entry.catalogEntry.durationSeconds ?? 0),
    0,
  ),
};
