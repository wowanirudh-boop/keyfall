import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { build, preview, type PreviewServer } from "vite";

const playlistJsonPath = resolve("dist/catalog/playlists.json");
let playlistJson: Buffer;
let server: PreviewServer;

test.beforeAll(async () => {
  await build({ logLevel: "silent" });
  playlistJson = readFileSync(playlistJsonPath);
  server = await preview({
    logLevel: "silent",
    preview: { host: "127.0.0.1", port: 4181, strictPort: true },
  });
});

test.afterAll(async () => {
  await server.close();
});

async function allowLocalRequests(context: BrowserContext) {
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1") await route.continue();
    else await route.abort();
  });
}

test.beforeEach(async ({ context }) => {
  await allowLocalRequests(context);
});

async function storedLastSpeed(page: Page, pieceId: string) {
  return page.evaluate(
    (id) =>
      new Promise<number | undefined>((resolveResult, reject) => {
        const request = indexedDB.open("piano-practice-player");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const get = database.transaction("pieces", "readonly").objectStore("pieces").get(id);
          get.onerror = () => reject(get.error);
          get.onsuccess = () => {
            database.close();
            resolveResult(get.result?.lastSpeed);
          };
        };
      }),
    pieceId,
  );
}

test("[playlist] [T12a AC4-AC6, AC8] fresh Home opens, saves, and reopens an ordered read-only entry", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("0 SAVED LOCALLY")).toBeVisible();
  const homePlaylists = page.getByRole("region", { name: "Playlists" });
  await expect(homePlaylists.getByText("Classical Rousseau")).toBeVisible();
  await expect(homePlaylists.getByText("25 PIECES · 1H 29M")).toBeVisible();
  await homePlaylists.getByRole("button").click();

  await expect(page).toHaveURL(/\/playlists\/rousseau-classical$/);
  await expect(page.getByRole("heading", { name: "Classical Rousseau" })).toBeVisible();
  await expect(page.getByText("25 OF 64 · 1H 29M")).toBeVisible();
  const rows = page.getByRole("region", { name: "Classical Rousseau pieces" });
  await expect(rows.getByRole("button")).toHaveCount(25);
  await expect(
    page.getByText("39 more works from this playlist are not in the catalog yet."),
  ).toBeVisible();
  await expect(
    page.getByText("Liszt, Ravel, Vivaldi and Beethoven are the big gaps."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /\b(rename|reorder|remove|delete|add|duplicate)\b/i }),
  ).toHaveCount(0);

  await rows.getByRole("button").first().click();
  await expect(page.getByRole("heading", { name: "Ballade number 4" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  await expect.poll(() => storedLastSpeed(page, "ballade-number-4")).toBe(1);
  await page.getByRole("button", { name: "0.5x" }).click();
  await expect(page.getByRole("button", { name: "0.5x" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect.poll(() => storedLastSpeed(page, "ballade-number-4")).toBe(0.5);

  await page.getByRole("button", { name: "← Library" }).click();
  await page.getByRole("region", { name: "Playlists" }).getByRole("button").click();
  await page.getByRole("region", { name: "Classical Rousseau pieces" }).getByRole("button").first().click();
  await expect(page.getByRole("heading", { name: "Ballade number 4" })).toBeVisible();
  await expect(page.getByRole("button", { name: "0.5x" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("[playlist] [T12a AC7] deleting dist playlists JSON leaves Home usable", async ({ page }) => {
  expect(existsSync(resolve("dist/catalog/playlists/rousseau-classical.tsv"))).toBe(false);
  expect(existsSync(playlistJsonPath)).toBe(true);
  rmSync(playlistJsonPath);
  try {
    await page.goto("/");
    await expect(page.getByText("Piano Practice Player")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Search catalog" })).toBeVisible();
    await expect(page.getByRole("region", { name: "My pieces" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Playlists" })).toHaveCount(0);
  } finally {
    writeFileSync(playlistJsonPath, playlistJson);
  }
});

test("[playlist] [T12a AC9] Home and playlist have no horizontal scroll at all four widths", async ({
  page,
}) => {
  mkdirSync(resolve("test-results/visual"), { recursive: true });
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 768, height: 900 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const homePlaylists = page.getByRole("region", { name: "Playlists" });
    await expect(homePlaylists).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      `Home at ${viewport.width}px`,
    ).toBe(await page.evaluate(() => document.documentElement.clientWidth));
    if (viewport.width >= 1024) {
      await page.screenshot({
        path: resolve("test-results/visual", `playlist-home-${viewport.width}x${viewport.height}.png`),
        fullPage: true,
      });
    }

    await homePlaylists.getByRole("button").click();
    await expect(page.getByRole("heading", { name: "Classical Rousseau" })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      `Playlist at ${viewport.width}px`,
    ).toBe(await page.evaluate(() => document.documentElement.clientWidth));
    if (viewport.width >= 1024) {
      await page.screenshot({
        path: resolve("test-results/visual", `playlist-page-${viewport.width}x${viewport.height}.png`),
        fullPage: true,
      });
    }
  }
});
