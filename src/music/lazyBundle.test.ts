import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";

import { build } from "vite";
import { describe, expect, it } from "vitest";

describe("music import bundle", () => {
  it("keeps Verovio in a MusicXML-only lazy chunk within D-016", async () => {
    const result = await build({
      configFile: false,
      logLevel: "silent",
      build: {
        write: false,
        lib: {
          entry: resolve("src/music/__fixtures__/bundle-entry.ts"),
          formats: ["es"],
        },
      },
    });
    const outputs = Array.isArray(result) ? result : [result];
    const chunks = outputs.flatMap((output) =>
      "output" in output ? output.output.filter((item) => item.type === "chunk") : [],
    );
    const entry = chunks.find((chunk) => chunk.isEntry);
    const lazyChunks = chunks.filter((chunk) => !chunk.isEntry);
    const lazyGzipBytes = lazyChunks.reduce(
      (total, chunk) => total + gzipSync(chunk.code).byteLength,
      0,
    );

    expect(entry).toBeDefined();
    expect(entry?.dynamicImports.length).toBeGreaterThan(0);
    expect(entry?.code).not.toContain("vrvToolkit_constructor");
    expect(lazyChunks.some((chunk) => chunk.code.includes("vrvToolkit_constructor"))).toBe(true);
    expect(lazyGzipBytes).toBeLessThanOrEqual(2.5 * 1024 * 1024);
  }, 30_000);

  it("declares both shipped parsers as production dependencies", async () => {
    const packageJson = JSON.parse(
      await readFile(resolve("package.json"), "utf8"),
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

    expect(packageJson.dependencies).toMatchObject({
      "@tonejs/midi": expect.any(String),
      verovio: expect.any(String),
    });
    expect(packageJson.devDependencies).not.toHaveProperty("@tonejs/midi");
    expect(packageJson.devDependencies).not.toHaveProperty("verovio");
  });
});
