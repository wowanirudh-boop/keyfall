import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import shippedManifest from "../../catalog/manifest.json";
import { FIXTURE_ASSETS, FIXTURE_MANIFEST } from "./__fixtures__/manifest";
import {
  CatalogAssetError,
  CatalogRepository,
  searchCatalog,
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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("[T03a AC1] [T03c AC1, AC2] loads without score requests, then opens once without SubtleCrypto", async () => {
    vi.stubGlobal("crypto", {});
    const warn = vi.fn();
    const loadAsset = vi.fn(async (asset: string) =>
      new Uint8Array(readFileSync(resolve("catalog/scores", asset))),
    );
    const repository = new CatalogRepository({
      loadManifest: async () => shippedManifest,
      loadAsset,
      warn,
    });

    const entries = await repository.load();

    expect(entries.length).toBeGreaterThan(300);
    expect(loadAsset).not.toHaveBeenCalled();
    expect(repository.search("fur elise").map((entry) => entry.title)).toEqual(["Für Elise"]);
    await expect(repository.open(entries[0])).resolves.toBeInstanceOf(Uint8Array);
    expect(loadAsset).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("[T03b AC5] fetches the manifest once from its static URL", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(FIXTURE_MANIFEST), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const repository = new CatalogRepository({
      loadAsset: async (asset) => FIXTURE_ASSETS[asset],
    });

    await expect(repository.load()).resolves.toEqual(FIXTURE_MANIFEST);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/catalog/manifest.json");
  });

  it("[T03b AC6] matches all full-catalog golden cases in under 50 ms", async () => {
    const repository = fixtureRepository(shippedManifest);
    await repository.load();
    const startedAt = performance.now();

    expect(repository.search("fur elise").map((entry) => entry.title)).toEqual(["Für Elise"]);
    expect(repository.search("gymnopedie")[0]?.title).toBe("Gymnopédie No. 1");
    expect(repository.search("moonlight sonata")[0]?.title).toContain("Moonlight");
    expect(repository.search("FÜR ELISE").map((entry) => entry.title)).toEqual(["Für Elise"]);
    expect(repository.search("fur  elise!").map((entry) => entry.title)).toEqual([
      "Für Elise",
    ]);
    expect(repository.search("")).toEqual([]);
    expect(repository.search("bagatelle no 25").map((entry) => entry.title)).toEqual([
      "Für Elise",
    ]);
    expect(repository.search("etude c-moll")[0]?.title).toBe("Etüde c-moll");
    expect(repository.search("prelude op. 28, no. 15")[0]?.title).toBe(
      "Prelude: Op. 28, No. 15",
    );
    expect(performance.now() - startedAt).toBeLessThan(50);
  });

  it("[T03b AC7] ranks an exact title above a substring title", () => {
    const exact = { ...structuredClone(FIXTURE_MANIFEST[0]), title: "Sonata" };
    const substring = {
      ...structuredClone(FIXTURE_MANIFEST[1]),
      title: "Piano Sonata No. 1",
    };

    expect(searchCatalog([substring, exact], "sonata")).toEqual([exact, substring]);
  });

  it("[T03c AC4] drops a row with invalid manifest fields and warns", async () => {
    const warn = vi.fn();
    const missingSource = structuredClone(FIXTURE_MANIFEST[0]) as unknown as {
      licence: Record<string, unknown>;
    };
    delete missingSource.licence.sourceUrl;
    const repository = new CatalogRepository({
      loadManifest: async () => [FIXTURE_MANIFEST[2], missingSource],
      loadAsset: async (asset) => FIXTURE_ASSETS[asset],
      warn,
    });

    await expect(repository.load()).resolves.toEqual([FIXTURE_MANIFEST[2]]);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      "Catalog row 1 was dropped: invalid manifest fields.",
    );
  });

  it("[T03b AC2] requires creator credit only for non-public-domain rows", () => {
    const publicDomain = structuredClone(FIXTURE_MANIFEST[0]);
    const missingCreator = structuredClone(FIXTURE_MANIFEST[2]) as unknown as {
      licence: Record<string, unknown>;
    };
    delete missingCreator.licence.creator;

    expect(validateCatalogEntry(publicDomain)).toEqual(publicDomain);
    expect(validateCatalogEntry(missingCreator)).toBeNull();
  });

  it("[T03a AC2] [T03c AC3] raises CatalogAssetError when the score 404s on open", async () => {
    const warn = vi.fn();
    const loadAsset = vi.fn(async () => {
      throw new Error("404");
    });
    const repository = new CatalogRepository({
      loadManifest: async () => [FIXTURE_MANIFEST[0]],
      loadAsset,
      warn,
    });
    const [entry] = await repository.load();

    await expect(repository.open(entry)).rejects.toBeInstanceOf(CatalogAssetError);
    expect(loadAsset).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("[T03a AC3] [T03c AC3] raises CatalogAssetError for a checksum mismatch on open", async () => {
    const warn = vi.fn();
    const mismatched = {
      ...structuredClone(FIXTURE_MANIFEST[0]),
      licence: { ...FIXTURE_MANIFEST[0].licence, sha256: "0".repeat(64) },
    };
    const loadAsset = vi.fn(async (asset: string) => FIXTURE_ASSETS[asset]);
    const repository = new CatalogRepository({
      loadManifest: async () => [mismatched],
      loadAsset,
      warn,
    });
    const [entry] = await repository.load();

    await expect(repository.open(entry)).rejects.toBeInstanceOf(CatalogAssetError);
    expect(loadAsset).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("[T03a AC4] [T03b AC2, AC3] [T03c AC5] validates all shipped rows and exact checksums", () => {
    expect(shippedManifest).toHaveLength(460);
    for (const row of shippedManifest) {
      expect(validateCatalogEntry(row)).not.toBeNull();
      const bytes = readFileSync(resolve("catalog/scores", row.asset));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(row.licence.sha256);
      if (row.licence.name !== "Public Domain") {
        expect(row.licence.creator?.trim()).toBeTruthy();
      }
    }
  });

  it("[T03b AC4] lists every shipped piece, licence, creator, count, and total weight", () => {
    const audit = readFileSync(resolve("catalog/LICENCES.md"), "utf8");
    const totalBytes = shippedManifest.reduce(
      (total, row) => total + readFileSync(resolve("catalog/scores", row.asset)).byteLength,
      0,
    );

    expect(audit).toContain(`Shipped pieces: **${shippedManifest.length}**`);
    expect(audit).toContain(`**${totalBytes.toLocaleString("en-US")} bytes`);
    for (const row of shippedManifest) {
      expect(audit).toContain(`Mutopia ${row.mutopiaId}`);
      expect(audit).toContain(`\`${row.asset}\``);
      expect(audit).toContain(row.licence.creator ?? "Not required (public domain)");
    }
  });

  it("[T03c AC6] validates 300 manifest rows in under 50 ms without score requests", async () => {
    const manifest = Array.from({ length: 300 }, (_, index) => ({
      ...structuredClone(FIXTURE_MANIFEST[0]),
      id: `piece-${index}`,
      title: `Piece ${index}`,
      asset: `piece-${index}.mid`,
    }));
    const loadAsset = vi.fn(async () => new Uint8Array());
    const repository = new CatalogRepository({
      loadManifest: async () => manifest,
      loadAsset,
      warn: vi.fn(),
    });
    const startedAt = performance.now();

    const entries = await repository.load();
    const elapsed = performance.now() - startedAt;

    expect(entries).toHaveLength(300);
    expect(loadAsset).not.toHaveBeenCalled();
    expect(elapsed).toBeLessThan(50);
  });
});
