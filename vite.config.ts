import { cpSync } from "node:fs";
import { relative, resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

import { color } from "./src/design/tokens";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

function catalogStaticAsset(): Plugin {
  const catalogDirectory = resolve("catalog");
  return {
    name: "catalog-static-asset",
    writeBundle(options) {
      cpSync(catalogDirectory, resolve(options.dir ?? "dist", "catalog"), {
        force: true,
        recursive: true,
        filter(source) {
          const catalogPath = relative(catalogDirectory, source).replaceAll("\\", "/");
          return !/^playlists\/[^/]+\.tsv$/i.test(catalogPath);
        },
      });
    },
  };
}

function themeColorMeta(): Plugin {
  return {
    name: "theme-color-meta",
    transformIndexHtml(html) {
      return html.replace("%PWA_THEME_COLOR%", color.bg);
    },
  };
}

export default defineConfig({
  appType: "spa",
  build: { assetsInlineLimit: 0 },
  plugins: [
    react(),
    themeColorMeta(),
    catalogStaticAsset(),
    VitePWA({
      injectRegister: "inline",
      registerType: "prompt",
      includeAssets: ["icons/apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "Piano Practice Player",
        short_name: "Piano Player",
        description: "A local-first falling-notes piano practice player.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: color.bg,
        theme_color: color.bg,
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
        navigateFallback: "index.html",
        globPatterns: [
          "index.html",
          "assets/*.{js,css,woff2}",
          "catalog/manifest.json",
          "catalog/playlists.json",
        ],
        globIgnores: ["assets/import.worker-*.js"],
        runtimeCaching: [
          {
            urlPattern: /\/catalog\/scores\/.+\.mid$/,
            handler: "CacheFirst",
            options: {
              cacheName: "catalog-scores",
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: isCodexSeatbeltSandbox
    ? { watch: { useFsEvents: false, usePolling: true } }
    : undefined,
});
