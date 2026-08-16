import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import midiPackage from "@tonejs/midi";
import { describe, expect, it } from "vitest";

// The production ingestion tool is intentionally plain Node.js, outside the app build.
// @ts-expect-error The committed build script does not need a TypeScript declaration file.
import {
  buildCatalog,
  buildCatalogFromAdapters,
  buildPlaylists,
  concatenateMidiAssets,
  createPianoMidiSourceAdapter,
  extractMidiEntries,
  isSoloKeyboardInstrument,
  PIANO_MIDI_PIECES,
  parsePieceSource,
} from "../scripts/build-catalog.mjs";
import { parsePieceBytes } from "../src/music/parse";

const { Midi } = midiPackage;

function midiBytes() {
  const midi = new Midi();
  midi.header.setTempo(120);
  midi.addTrack().addNote({ midi: 60, time: 0, duration: 1, velocity: 0.8 });
  return midi.toArray();
}

function storedZip(name: string, data: Uint8Array) {
  const encodedName = Buffer.from(name);
  const payload = Buffer.from(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(payload.length, 18);
  local.writeUInt32LE(payload.length, 22);
  local.writeUInt16LE(encodedName.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(payload.length, 20);
  central.writeUInt32LE(payload.length, 24);
  central.writeUInt16LE(encodedName.length, 28);
  const centralOffset = local.length + encodedName.length + payload.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + encodedName.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([local, encodedName, payload, central, encodedName, end]);
}

async function treeDigest(directory: string) {
  const names = (await readdir(directory, { recursive: true })).sort();
  const hash = createHash("sha256");
  for (const name of names) {
    try {
      hash.update(name).update(await readFile(join(directory, name)));
    } catch {
      // Directory entries carry no bytes.
    }
  }
  return hash.digest("hex");
}

describe("catalog ingestion", () => {
  it("[T03b AC1-AC4] rebuilds idempotently, credits CC rows, hashes bytes, and logs drops", async () => {
    const root = await mkdtemp(join(tmpdir(), "piano-catalog-"));
    const sourceDir = join(root, "source");
    const outputDir = join(root, "catalog");
    const validDir = join(sourceDir, "ftp", "Composer", "valid");
    const invalidDir = join(sourceDir, "ftp", "Composer", "invalid");
    await mkdir(validDir, { recursive: true });
    await mkdir(invalidDir, { recursive: true });
    await writeFile(
      join(validDir, "valid.ly"),
      `\\header {
        mutopiatitle = "Étude, Op. 1"
        composer = "Example Composer"
        mutopiainstrument = "Piano"
        license = "Creative Commons Attribution-ShareAlike 4.0"
        maintainer = "Careful Typesetter"
        footer = "Mutopia-2026/08/12-42"
      }`,
    );
    await writeFile(
      join(invalidDir, "invalid.ly"),
      `\\header {
        mutopiatitle = "Unlicensed Study"
        composer = "Example Composer"
        mutopiainstrument = "Piano"
        maintainer = "Careful Typesetter"
        footer = "Mutopia-2026/08/12-43"
      }`,
    );
    const logs: string[] = [];
    const options = {
      sourceDir,
      outputDir,
      cacheDir: join(root, "cache"),
      aliases: { 42: ["famous study"] },
      composerAliases: { "Example Composer": "Composer, Example" },
      revision: "fixture-revision",
      fetchDirectory: async (url: string) =>
        `<a href="${new URL("valid.mid", url)}">MIDI</a>`,
      fetchAsset: async () => midiBytes(),
      log: (message: string) => logs.push(message),
    };

    const first = await buildCatalog(options);
    const firstDigest = await treeDigest(outputDir);
    const second = await buildCatalog(options);

    expect(second.manifest).toEqual(first.manifest);
    expect(await treeDigest(outputDir)).toBe(firstDigest);
    expect(first.manifest).toHaveLength(1);
    expect(first.manifest[0].composer).toBe("Composer, Example");
    expect(first.manifest[0].rawComposer).toBe("Example Composer");
    expect(first.manifest[0].aliases).toContain("famous study");
    expect(first.manifest[0].licence.creator).toBe("Careful Typesetter");
    expect(first.manifest[0].licence.sha256).toBe(
      createHash("sha256").update(midiBytes()).digest("hex"),
    );
    expect(first.dropped).toEqual([
      "Mutopia 43: licence cannot be determined (missing)",
    ]);
    expect(logs).toContain("DROP: Mutopia 43: licence cannot be determined (missing)");
    expect(await readFile(join(outputDir, "LICENCES.md"), "utf8")).toContain(
      "Careful Typesetter",
    );
    expect(await readFile(join(outputDir, "BUILD_LOG.md"), "utf8")).toContain(
      "licence cannot be determined",
    );
    expect(await readFile(join(outputDir, "BUILD_LOG.md"), "utf8")).toContain(
      "`Example Composer` → **Composer, Example**",
    );
  });

  it("[T03e AC2, AC3] applies the source-derived Chopin finale title during every Mutopia build", async () => {
    const root = await mkdtemp(join(tmpdir(), "piano-catalog-title-"));
    const sourceDir = join(root, "source");
    const scoreDir = join(sourceDir, "ftp", "ChopinFF", "O35", "chp-op-35-4-scholz-fi");
    await mkdir(scoreDir, { recursive: true });
    await writeFile(
      join(scoreDir, "finale.ly"),
      `\\header {
        mutopiatitle = "Sonate 2 b-moll"
        composer = "Frédéric Chopin (1810 - 1849)"
        mutopiainstrument = "Piano"
        license = "Public Domain"
        footer = "Mutopia-2026/08/12-1727"
      }`,
    );

    const result = await buildCatalog({
      sourceDir,
      outputDir: join(root, "catalog"),
      cacheDir: join(root, "cache"),
      aliases: {},
      composerAliases: { "Frédéric Chopin": "Chopin, Frédéric" },
      revision: "fixture-revision",
      fetchDirectory: async (url: string) => `<a href="${new URL("finale.mid", url)}">MIDI</a>`,
      fetchAsset: async () => midiBytes(),
      log: () => undefined,
    });

    expect(result.manifest).toHaveLength(1);
    expect(result.manifest[0]).toMatchObject({
      id: "sonate-2-b-moll",
      title: "Finale (Sonata No. 2, 4th mvt)",
    });
  });

  it("[T03b AC2] permits a public-domain row without a creator but identifies unpublished files", () => {
    const sourceDir = join("fixture", "mirror");
    const published = parsePieceSource(
      `mutopiatitle = "Study"
       composer = "Composer"
       mutopiainstrument = "piano"
       license = "Public Domain"
       footer = "Mutopia-2026/08/12-9"`,
      join(sourceDir, "ftp", "study.ly"),
      sourceDir,
    );
    const unpublished = parsePieceSource(
      `mutopiatitle = "Draft"
       composer = "Composer"
       mutopiainstrument = "Piano"
       license = "Public Domain"`,
      join(sourceDir, "ftp", "draft.ly"),
      sourceDir,
    );

    expect(published.creator).toBeUndefined();
    expect(published.licenceText).toBe("Public Domain");
    expect(unpublished.drop).toContain("missing published Mutopia ID");
  });

  it("[T03b AC2] reads an enumerated licence explicitly embedded in legacy footer markup", () => {
    const sourceDir = join("fixture", "mirror");
    const parsed = parsePieceSource(
      `mutopiatitle = "Legacy Sonata"
       composer = "Composer"
       mutopiainstrument = "Piano"
       copyright = \\markup { "Copyright © 2007" "Creative Commons Attribution-ShareAlike 2.5" }
       maintainer = "Legacy Typesetter"
       footer = "Mutopia-2026/08/12-10"`,
      join(sourceDir, "ftp", "legacy.ly"),
      sourceDir,
    );

    expect(parsed.licenceText).toBe("Creative Commons Attribution-ShareAlike 2.5");
  });

  it("[T03d AC3] accepts solo keyboard alternatives but rejects ensemble piano scores", () => {
    expect(isSoloKeyboardInstrument("Harpsichord, Piano")).toBe(true);
    expect(isSoloKeyboardInstrument("Harpsichord, Piano, Clavichord")).toBe(true);
    expect(isSoloKeyboardInstrument("Voice and Piano")).toBe(false);
    expect(isSoloKeyboardInstrument("Cello, Piano")).toBe(false);
  });

  it("[T03b AC1, AC3] extracts exact MIDI members from a generated-score ZIP", () => {
    const expected = midiBytes();
    const entries = extractMidiEntries(storedZip("movement-1.mid", expected));

    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("movement-1.mid");
    expect(entries[0].bytes).toEqual(Buffer.from(expected));
  });

  it("[T13 AC3, AC4] adapts the curated apex inventory with exact licence metadata", async () => {
    const pages = new Map<string, string>();
    for (const piece of PIANO_MIDI_PIECES) {
      pages.set(
        piece.page,
        `${pages.get(piece.page) ?? ""}${piece.assets.map((asset: string) => `href="${asset}"`).join("\n")}`,
      );
    }
    const adapter = createPianoMidiSourceAdapter({
      cacheDir: "unused-in-fixture",
      composerAliases: {
        Beethoven: "Beethoven, Ludwig van",
        Chopin: "Chopin, Frédéric",
        Liszt: "Liszt, Franz",
        Mussorgsky: "Mussorgsky, Modest Petrovich",
        Ravel: "Ravel, Maurice",
      },
      fetchUrl: async (url: string) =>
        url.endsWith(".htm") ? pages.get(url.split("/").at(-1) ?? "") : midiBytes(),
    });

    const result = await adapter.load();

    expect(result.rows).toHaveLength(14);
    expect(result.arrangementDispositions).toHaveLength(9);
    for (const row of result.rows) {
      expect(row.licence).toMatchObject({
        name: "cc-by-sa Germany License",
        url: "http://piano-midi.de/copy.htm",
        creator: "Bernd Krueger",
      });
      expect(row.licence.sourceUrl).toMatch(/^http:\/\/piano-midi\.de\//);
    }
    expect(result.rows.find((row: { id: string }) => row.id === "pictures-at-an-exhibition"))
      .toMatchObject({
        title: "Pictures at an Exhibition",
        composer: "Mussorgsky, Modest Petrovich",
        licence: { sourceUrl: "http://piano-midi.de/muss.htm" },
        sourceAssets: PIANO_MIDI_PIECES.find(
          (piece: { id: string }) => piece.id === "pictures-at-an-exhibition",
        )?.assets.map((asset: string) => `http://piano-midi.de/${asset}`),
      });
    expect(() => new Midi(concatenateMidiAssets([midiBytes(), midiBytes()]))).not.toThrow();
  });

  it("[T03e AC2, AC5] replaces the incomplete Mutopia Pictures row without changing the row count", async () => {
    const root = await mkdtemp(join(tmpdir(), "piano-catalog-replacement-"));
    const bytes = Buffer.from(midiBytes());
    const baseRow = {
      id: "pictures-at-an-exhibition",
      title: "Pictures at an Exhibition",
      composer: "Mussorgsky, Modest Petrovich",
      rawComposer: "Mussorgsky",
      aliases: [],
      asset: "pictures-at-an-exhibition.mid",
      format: "midi",
    };
    const mutopiaRow = {
      ...baseRow,
      mutopiaId: "475",
      licence: {
        name: "CC-BY-SA-4.0",
        url: "https://creativecommons.org/licenses/by-sa/4.0/",
        sourceUrl: "https://www.mutopiaproject.org/pictures.zip#baba.mid",
        creator: "Knute Snortum",
      },
      bytes,
      sourceKey: "mutopia",
    };
    const pianoRow = {
      ...baseRow,
      licence: {
        name: "cc-by-sa Germany License",
        url: "http://piano-midi.de/copy.htm",
        sourceUrl: "http://piano-midi.de/muss.htm",
        creator: "Bernd Krueger",
      },
      bytes,
      sourceKey: "piano-midi.de",
      sourceAssets: ["http://piano-midi.de/midis/mussorgsky/muss_1.mid"],
    };
    const result = await buildCatalogFromAdapters({
      adapters: [
        {
          key: "mutopia",
          priority: 0,
          revision: "fixture-mutopia",
          load: async () => ({ rows: [mutopiaRow], baseBuildLog: "# Catalog ingestion log" }),
        },
        {
          key: "piano-midi.de",
          priority: 1,
          revision: "fixture-piano-midi",
          load: async () => ({ rows: [pianoRow], arrangementDispositions: [] }),
        },
      ],
      outputDir: join(root, "catalog"),
      composerAliases: { Mussorgsky: "Mussorgsky, Modest Petrovich" },
      parseAsset: async () => ({
        ok: true,
        piece: { notes: [{ midi: 60 }], hasHandData: true },
      }),
      log: () => undefined,
    });

    expect(result.manifest).toHaveLength(1);
    expect(result.manifest[0]).toMatchObject({
      id: "pictures-at-an-exhibition",
      licence: { creator: "Bernd Krueger", sourceUrl: "http://piano-midi.de/muss.htm" },
    });
    expect(result.manifest[0].mutopiaId).toBeUndefined();
    expect(result.duplicateDrops).toEqual([
      "mutopia pictures-at-an-exhibition: skipped because piano-midi.de supplies the complete work",
    ]);
  });

  it("[T13 AC2, AC5] gives Mutopia priority over a duplicate second-source work", async () => {
    const root = await mkdtemp(join(tmpdir(), "piano-catalog-merge-"));
    const bytes = Buffer.from(midiBytes());
    const mutopiaRow = {
      id: "mutopia-study",
      mutopiaId: "42",
      title: "Priority Study",
      composer: "Composer, Example",
      rawComposer: "Example Composer",
      aliases: [],
      asset: "mutopia-study.mid",
      format: "midi",
      durationSeconds: 1,
      licence: {
        name: "Public Domain",
        url: "https://www.mutopiaproject.org/legal.html",
        sourceUrl: "https://www.mutopiaproject.org/ftp/priority.mid",
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
      bytes,
      sourceKey: "mutopia",
    };
    const pianoRow = {
      ...mutopiaRow,
      id: "piano-midi-study",
      mutopiaId: undefined,
      asset: "piano-midi-study.mid",
      licence: {
        name: "cc-by-sa Germany License",
        url: "http://piano-midi.de/copy.htm",
        sourceUrl: "http://piano-midi.de/midis/study.mid",
        creator: "Bernd Krueger",
      },
      sourceKey: "piano-midi.de",
      sourceAssets: ["http://piano-midi.de/midis/study.mid"],
    };
    const result = await buildCatalogFromAdapters({
      adapters: [
        {
          key: "mutopia",
          priority: 0,
          revision: "fixture-mutopia",
          load: async () => ({ rows: [mutopiaRow], baseBuildLog: "# Catalog ingestion log" }),
        },
        {
          key: "piano-midi.de",
          priority: 1,
          revision: "fixture-piano-midi",
          load: async () => ({ rows: [pianoRow], arrangementDispositions: [] }),
        },
      ],
      outputDir: join(root, "catalog"),
      parseAsset: async () => ({
        ok: true,
        piece: { notes: [{ midi: 60 }], hasHandData: false },
      }),
      log: () => undefined,
    });

    expect(result.manifest.map((row: { id: string }) => row.id)).toEqual(["mutopia-study"]);
    expect(result.duplicateDrops).toHaveLength(1);
    expect(result.duplicateDrops[0]).toContain("Mutopia wins");
  });

  it("[T13 AC3, AC6, AC7] production-parses every shipped second-source asset", async () => {
    const manifest = JSON.parse(await readFile("catalog/manifest.json", "utf8"));
    const rows = manifest.filter(
      (row: { licence: { url: string } }) =>
        row.licence.url === "http://piano-midi.de/copy.htm",
    );
    let handRows = 0;

    expect(rows).toHaveLength(14);
    for (const row of rows) {
      expect(row.licence).toEqual(
        expect.objectContaining({
          name: "cc-by-sa Germany License",
          url: "http://piano-midi.de/copy.htm",
          creator: "Bernd Krueger",
          sourceUrl: expect.stringMatching(/^http:\/\/piano-midi\.de\//),
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      );
      const parsed = await parsePieceBytes({
        name: row.asset,
        bytes: await readFile(join("catalog", "scores", row.asset)),
      });
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;
      expect(parsed.piece.notes.length).toBeGreaterThan(0);
      expect(parsed.piece.notes.every((note) => note.midi >= 21 && note.midi <= 108)).toBe(true);
      if (parsed.piece.hasHandData) handRows += 1;
    }
    expect(await readFile("catalog/BUILD_LOG.md", "utf8")).toContain(
      `Rows with \`hasHandData === true\`: **${handRows}/${rows.length}`,
    );
  });

  it("[T03e AC2, AC5] ships the complete Pictures source and the source-derived Chopin title", async () => {
    const manifest = JSON.parse(await readFile("catalog/manifest.json", "utf8"));
    const pictures = manifest.find(
      (row: { id: string }) => row.id === "pictures-at-an-exhibition",
    );
    const finale = manifest.find((row: { id: string }) => row.id === "sonate-2-b-moll");

    expect(manifest).toHaveLength(609);
    expect(pictures).toMatchObject({
      title: "Pictures at an Exhibition",
      composer: "Mussorgsky, Modest Petrovich",
      licence: {
        name: "cc-by-sa Germany License",
        url: "http://piano-midi.de/copy.htm",
        sourceUrl: "http://piano-midi.de/muss.htm",
        creator: "Bernd Krueger",
      },
    });
    expect(pictures.mutopiaId).toBeUndefined();
    expect(pictures.durationSeconds).toBeGreaterThan(29 * 60);
    expect(pictures.durationSeconds).toBeLessThanOrEqual(30 * 60);
    expect(finale).toMatchObject({
      title: "Finale (Sonata No. 2, 4th mvt)",
      licence: {
        sourceUrl:
          "https://www.mutopiaproject.org/ftp/ChopinFF/O35/chp-op-35-4-scholz-fi/chp-op-35-4-scholz-fi.mid",
      },
    });
  });
});

describe("playlist ingestion", () => {
  it("[T12a AC1, AC2, AC8] ships the corrected seed in first-occurrence order", async () => {
    const source = await readFile("catalog/playlists/rousseau-classical.tsv", "utf8");
    const generated = JSON.parse(await readFile("catalog/playlists.json", "utf8"));
    const playlist = generated.playlists[0];
    const firstOccurrenceOrder = [
      ...new Set(
        source
          .split(/\r?\n/)
          .filter((line) => line.startsWith("have\t"))
          .map((line) => line.split("\t")[3]),
      ),
    ];

    expect(source).not.toMatch(/^verify\t/m);
    expect(playlist.id).toBe("rousseau-classical");
    expect(playlist.entries.map((entry: { ref: string }) => entry.ref)).toEqual(
      firstOccurrenceOrder,
    );
    expect(playlist.entries).toHaveLength(38);
    expect(
      playlist.entries.filter(
        (entry: { ref: string }) => entry.ref === "suite-bergamasque-clair-de-lune",
      ),
    ).toHaveLength(1);
    expect(playlist.counts).toEqual({ resolved: 38, missing: 26, excluded: 7 });
    expect(playlist.missingComposers).toEqual([
      "Vivaldi",
      "Tchaikovsky",
      "Rimsky-Korsakov",
      "Schubert",
    ]);
    expect(await readFile("catalog/BUILD_LOG.md", "utf8")).toContain(
      "| `rousseau-classical.tsv` | 38 | 26 | 7 |",
    );
  });

  it.each([
    {
      status: "have",
      catalogId: "absent-piece",
      message: "unknown.tsv:3 (Unshipped work)",
    },
    {
      status: "verify",
      catalogId: "known-piece",
      message: "unknown.tsv:3 (Unshipped work)",
    },
  ])("[T12a AC3] rejects a $status row and names it", async ({ status, catalogId, message }) => {
    const root = await mkdtemp(join(tmpdir(), "piano-playlist-invalid-"));
    const playlistsDir = join(root, "playlists");
    await mkdir(playlistsDir);
    await writeFile(join(root, "manifest.json"), JSON.stringify([{ id: "known-piece" }]));
    await writeFile(
      join(playlistsDir, "unknown.tsv"),
      `# name: Test playlist\nstatus\tcomposer\twork\tcatalog_id\tnote\n${status}\tComposer, Ada\tUnshipped work\t${catalogId}\n`,
    );

    await expect(
      buildPlaylists({
        playlistsDir,
        manifestPath: join(root, "manifest.json"),
        outputPath: join(root, "playlists.json"),
        buildLogPath: join(root, "BUILD_LOG.md"),
      }),
    ).rejects.toThrow(message);
  });

  it("[T12a AC8] re-derives counts and gap composers after a TSV-only change", async () => {
    const root = await mkdtemp(join(tmpdir(), "piano-playlist-derived-"));
    const playlistsDir = join(root, "playlists");
    const manifestPath = join(root, "manifest.json");
    const outputPath = join(root, "playlists.json");
    const buildLogPath = join(root, "BUILD_LOG.md");
    const header = "status\tcomposer\twork\tcatalog_id\tnote";
    await mkdir(playlistsDir);
    await writeFile(manifestPath, JSON.stringify([{ id: "piece-one" }]));
    await writeFile(
      join(playlistsDir, "derived.tsv"),
      `${header}\nmissing\tAlpha, Ada\tFirst\nmissing\tAlpha, Ada\tSecond\nmissing\tBeta, Bea\tThird\n`,
    );

    const before = await buildPlaylists({
      playlistsDir,
      manifestPath,
      outputPath,
      buildLogPath,
    });
    await writeFile(
      join(playlistsDir, "derived.tsv"),
      `${header}\nhave\tAlpha, Ada\tFirst\tpiece-one\nmissing\tAlpha, Ada\tSecond\nmissing\tBeta, Bea\tThird\n`,
    );
    const after = await buildPlaylists({
      playlistsDir,
      manifestPath,
      outputPath,
      buildLogPath,
    });

    expect(before.playlists[0].counts.missing).toBe(3);
    expect(before.playlists[0].missingComposers).toEqual(["Alpha", "Beta"]);
    expect(after.playlists[0].counts.missing).toBe(2);
    expect(after.playlists[0].missingComposers).toEqual(["Beta"]);
  });
});
