import { cpSync } from "node:fs";
import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

function catalogStaticAsset(): Plugin {
  return {
    name: "catalog-static-asset",
    writeBundle(options) {
      cpSync(resolve("catalog"), resolve(options.dir ?? "dist", "catalog"), {
        force: true,
        recursive: true,
      });
    },
  };
}

export default defineConfig({
  appType: "spa",
  build: { assetsInlineLimit: 0 },
  plugins: [react(), catalogStaticAsset()],
  server: isCodexSeatbeltSandbox
    ? { watch: { useFsEvents: false, usePolling: true } }
    : undefined,
});
