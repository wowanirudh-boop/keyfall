declare module "verovio/wasm" {
  export default function createVerovioModule(): Promise<unknown>;
}

declare module "verovio/esm" {
  export class VerovioToolkit {
    constructor(module: unknown);
    destroy(): void;
    getLog(): string;
    getMEI(options?: Record<string, unknown>): string;
    loadData(data: string): boolean;
    loadZipDataBuffer(data: ArrayBuffer): boolean;
    renderToMIDI(): string;
    setOptions(options: Record<string, unknown>): boolean;
  }
}
