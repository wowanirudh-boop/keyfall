import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { knownMidiBytes } from "./__fixtures__/midiFixtures";
import { importPiece } from "./importer";
import { parsePieceBytes } from "./parse";
import type { ImportFileData, ImportResult } from "./types";

describe("worker import API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is async and transfers parsing through a Worker", async () => {
    let constructed = false;
    let terminated = false;
    let transferred = false;

    class TestWorker {
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent<ImportResult>) => void) | null = null;

      constructor(_url: URL, options: WorkerOptions) {
        constructed = options.type === "module";
      }

      postMessage(data: ImportFileData, transfer: Transferable[]) {
        transferred = transfer.length === 1;
        queueMicrotask(async () => {
          const result = await parsePieceBytes(data);
          this.onmessage?.({ data: result } as MessageEvent<ImportResult>);
        });
      }

      terminate() {
        terminated = true;
      }
    }

    vi.stubGlobal("Worker", TestWorker);
    const bytes = knownMidiBytes();
    const file = {
      name: "worker.mid",
      arrayBuffer: async () => bytes.slice().buffer,
    } as File;
    let settled = false;
    const pending = importPiece(file).then((result) => {
      settled = true;
      return result;
    });

    expect(settled).toBe(false);
    const result = await pending;
    expect(result.ok).toBe(true);
    expect({ constructed, transferred, terminated }).toEqual({
      constructed: true,
      transferred: true,
      terminated: true,
    });
  });

  it("keeps the parse module free of DOM and React imports", async () => {
    const source = await readFile(resolve("src/music/parse.ts"), "utf8");

    expect(source).not.toMatch(/from ["']react|document\.|window\.|DOMParser|\bFile\b/);
  });
});
