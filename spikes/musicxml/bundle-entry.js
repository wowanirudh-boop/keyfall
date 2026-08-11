import createVerovioModule from "verovio/wasm";
import { VerovioToolkit } from "verovio/esm";

globalThis.createVerovioToolkit = async function createToolkit() {
  return new VerovioToolkit(await createVerovioModule());
};
