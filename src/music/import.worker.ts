/// <reference lib="webworker" />

import { parsePieceBytes } from "./parse";
import { IMPORT_ERROR_MESSAGES, type ImportFileData, type ImportResult } from "./types";

const worker = self as DedicatedWorkerGlobalScope;

worker.onmessage = async (event: MessageEvent<ImportFileData>) => {
  let result: ImportResult;
  try {
    result = await parsePieceBytes(event.data);
  } catch {
    result = {
      ok: false,
      error: {
        kind: "unparseable",
        message: IMPORT_ERROR_MESSAGES.unparseable,
      },
    };
  }
  worker.postMessage(result);
};

export {};
