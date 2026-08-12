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
  extractMidiEntries,
  parsePieceSource,
} from "../scripts/build-catalog.mjs";

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

  it("[T03b AC1, AC3] extracts exact MIDI members from a generated-score ZIP", () => {
    const expected = midiBytes();
    const entries = extractMidiEntries(storedZip("movement-1.mid", expected));

    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("movement-1.mid");
    expect(entries[0].bytes).toEqual(Buffer.from(expected));
  });
});
