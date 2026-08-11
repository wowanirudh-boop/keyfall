import { IMPORT_ERROR_MESSAGES, type ImportResult } from "./types";

export async function importPiece(file: File): Promise<ImportResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());

  return new Promise((resolve) => {
    const worker = new Worker(new URL("./import.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<ImportResult>) => {
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = () => {
      worker.terminate();
      resolve({
        ok: false,
        error: {
          kind: "unparseable",
          message: IMPORT_ERROR_MESSAGES.unparseable,
        },
      });
    };
    worker.postMessage({ name: file.name, bytes }, [bytes.buffer]);
  });
}
