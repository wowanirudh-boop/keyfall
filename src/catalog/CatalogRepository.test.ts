import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import shippedManifestJson from "../../catalog/manifest.json";
import composerAliases from "../../scripts/catalog-composers.json";
import { FIXTURE_ASSETS, FIXTURE_MANIFEST } from "./__fixtures__/manifest";
import {
  CatalogAssetError,
  CatalogRepository,
  searchCatalog,
  type CatalogEntry,
  validateCatalogEntry,
} from "./CatalogRepository";

const shippedManifest = shippedManifestJson as Array<CatalogEntry & { mutopiaId: string }>;

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

    expect(entries.length).toBeGreaterThanOrEqual(460);
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

  it("[T03b AC6] [T03d AC8, AC9] matches all full-catalog golden cases in under 50 ms", async () => {
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

  it("[T03d AC6] ranks exact title, prefix, substring, composer, then alias", () => {
    const base = structuredClone(FIXTURE_MANIFEST[0]);
    const entries = [
      { ...base, id: "alias", title: "Study", composer: "Writer, Ada", aliases: ["prelude nickname"] },
      { ...base, id: "composer", title: "Nocturne", composer: "Prelude, Ada", aliases: [] },
      { ...base, id: "substring", title: "Evening Prelude", composer: "Writer, Ada", aliases: [] },
      { ...base, id: "prefix", title: "Prelude in G", composer: "Writer, Ada", aliases: [] },
      { ...base, id: "exact", title: "Prelude", composer: "Writer, Ada", aliases: [] },
    ];

    expect(searchCatalog(entries, "prelude").map((entry) => entry.id)).toEqual([
      "exact",
      "prefix",
      "substring",
      "composer",
      "alias",
    ]);
  });

  it("[T03d AC2] ships only non-redundant aliases of at least four characters", () => {
    for (const row of shippedManifest) {
      const foldedTitle = row.title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9 ]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      for (const alias of row.aliases) {
        expect(alias.length, `${row.id}: ${alias}`).toBeGreaterThanOrEqual(4);
        expect(foldedTitle.includes(alias), `${row.id}: ${alias}`).toBe(false);
      }
    }
  });

  it("[T03d AC1] returns the expected top five for Bach, Chopin, and Scriabin", () => {
    expect(searchCatalog(shippedManifest, "bach").slice(0, 5).map((entry) => entry.title)).toEqual([
      "Fugue sur le nom de Bach",
      "Rondo in E-flat Major",
      "Ach, was soll ich Sünder machen",
      "Air — BWV Anh. 131",
      "Applicatio",
    ]);
    expect(searchCatalog(shippedManifest, "chopin").slice(0, 5).map((entry) => entry.title)).toEqual([
      "Ballade number 4",
      "Etüde a-moll",
      "Etüde As-Dur",
      "Etüde C-Dur",
      "Etüde c-moll",
    ]);
    expect(searchCatalog(shippedManifest, "scriabin").slice(0, 5).map((entry) => entry.title)).toEqual([
      "Prelude — Op. 11",
      "Prelude — Op. 59, No. 2",
      "Préludes opus 16 - 1.",
      "Préludes opus 16 - 2.",
      "Préludes opus 16 - 3.",
    ]);
  });

  it("[T03d AC3] ships BWV 846 and finds it through all required names", () => {
    const bwv846 = shippedManifest.find((entry) => entry.mutopiaId === "5");
    expect(bwv846).toBeDefined();
    for (const query of ["prelude in c", "bwv 846", "well tempered"]) {
      expect(searchCatalog(shippedManifest, query)).toContainEqual(bwv846);
    }
    expect(readFileSync(resolve("catalog/BUILD_LOG.md"), "utf8")).toContain(
      "Mutopia 5: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.",
    );
  });

  it("[T03d AC4] uses only known canonical composers and preserves every raw spelling", () => {
    const knownComposers = new Set(Object.values(composerAliases));
    for (const row of shippedManifest) {
      expect(knownComposers.has(row.composer), row.composer).toBe(true);
      expect(row.rawComposer.trim()).not.toBe("");
    }
    const chopinRows = shippedManifest.filter((entry) => entry.composer === "Chopin, Frédéric");
    expect(chopinRows).toHaveLength(47);
    expect(searchCatalog(shippedManifest, "chopin")).toEqual(chopinRows.sort((left, right) =>
      left.title.localeCompare(right.title) || left.id.localeCompare(right.id),
    ));
  });

  it("[T03d AC5] has no duplicate visible title and composer pairs", () => {
    const visiblePairs = shippedManifest.map((entry) => `${entry.title}\u0000${entry.composer}`);
    expect(new Set(visiblePairs).size).toBe(visiblePairs.length);
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
    expect(shippedManifest.length).toBeGreaterThanOrEqual(460);
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
