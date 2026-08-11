import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import shippedManifest from "../../catalog/manifest.json";
import { FIXTURE_ASSETS, FIXTURE_MANIFEST } from "./__fixtures__/manifest";
import {
  CatalogAssetError,
  CatalogRepository,
  validateCatalogEntry,
} from "./CatalogRepository";

function fixtureRepository(manifest: unknown = FIXTURE_MANIFEST) {
  return new CatalogRepository({
    loadManifest: async () => manifest,
    loadAsset: async (asset) => FIXTURE_ASSETS[asset],
    warn: vi.fn(),
  });
}

describe("CatalogRepository", () => {
  it("[AC1] matches all golden folded cases, including an alias-only query", async () => {
    const repository = fixtureRepository();
    await repository.load();

    expect(repository.search("fur elise").map((entry) => entry.title)).toEqual(["Für Elise"]);
    expect(repository.search("gymnopedie").map((entry) => entry.title)).toEqual([
      "Gymnopédie No. 1",
    ]);
    expect(repository.search("FÜR ELISE").map((entry) => entry.title)).toEqual(["Für Elise"]);
    expect(repository.search("fur  elise!").map((entry) => entry.title)).toEqual([
      "Für Elise",
    ]);
    expect(repository.search("")).toEqual([]);
    expect(repository.search("bagatelle no 25").map((entry) => entry.title)).toEqual([
      "Für Elise",
    ]);
  });

  it("[AC2] drops rows with missing fields and checksum mismatches while loading valid rows", async () => {
    const warn = vi.fn();
    const missingSource = structuredClone(FIXTURE_MANIFEST[0]) as unknown as {
      licence: Record<string, unknown>;
    };
    delete missingSource.licence.sourceUrl;
    const mismatched = {
      ...structuredClone(FIXTURE_MANIFEST[1]),
      licence: { ...FIXTURE_MANIFEST[1].licence, sha256: "0".repeat(64) },
    };
    const repository = new CatalogRepository({
      loadManifest: async () => [FIXTURE_MANIFEST[2], missingSource, mismatched],
      loadAsset: async (asset) => FIXTURE_ASSETS[asset],
      warn,
    });

    await expect(repository.load()).resolves.toEqual([FIXTURE_MANIFEST[2]]);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("[AC2] validates every shipped row and its exact on-disk checksum", () => {
    for (const row of shippedManifest) {
      expect(validateCatalogEntry(row)).not.toBeNull();
      const bytes = readFileSync(resolve("catalog/scores", row.asset));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(row.licence.sha256);
    }
  });

  it("[AC8] reports an asset that changes after manifest validation", async () => {
    let reads = 0;
    const repository = new CatalogRepository({
      loadManifest: async () => [FIXTURE_MANIFEST[0]],
      loadAsset: async () => {
        reads += 1;
        return reads === 1 ? FIXTURE_ASSETS["fur-elise.mid"] : new Uint8Array([0]);
      },
      warn: vi.fn(),
    });
    const [entry] = await repository.load();

    await expect(repository.open(entry)).rejects.toBeInstanceOf(CatalogAssetError);
  });
});
