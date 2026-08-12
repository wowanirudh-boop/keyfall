import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { build, preview, type PreviewServer } from "vite";

let server: PreviewServer;

test.beforeAll(async () => {
  await build({
    logLevel: "silent",
    build: {
      rollupOptions: {
        input: {
          app: resolve("index.html"),
          playerHarness: resolve("src/testing/e2e/player-harness.html"),
        },
      },
    },
  });
  server = await preview({
    logLevel: "silent",
    preview: { host: "127.0.0.1", port: 4181, strictPort: true },
  });
});

test.afterAll(async () => {
  await server.close();
});

test.beforeEach(async ({ page }) => {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1") await route.continue();
    else await route.abort();
  });
});

test("[AC12, T07a fill AC8] transport scrub hitch gate stays below 50 ms with under one percent slow frames", async ({ page }) => {
  test.setTimeout(30_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/src/testing/e2e/player-harness.html?mode=scrub");
  const seekBar = page.getByTestId("seek-bar");
  const bounds = await seekBar.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) throw new Error("Seek bar has no bounds");

  await page.mouse.move(bounds.x, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.evaluate(() => window.__startScrubMeasurement?.());
  const startedAt = Date.now();
  let step = 0;
  while (Date.now() - startedAt < 10_100) {
    const progress = (step % 200) / 199;
    await page.mouse.move(bounds.x + bounds.width * progress, bounds.y + bounds.height / 2);
    await page.waitForTimeout(12);
    step += 1;
  }
  await page.mouse.up();
  await page.waitForFunction(() => window.__scrubMetrics?.done);
  const metrics = await page.evaluate(() => window.__scrubMetrics);
  const fillCounts = await page.evaluate(() => ({
    fills: document.querySelectorAll("[data-countdown-fill]").length,
    preparedKeys: document.querySelectorAll('[data-state="prepare"]').length,
  }));

  expect(metrics?.elapsedSeconds).toBeGreaterThanOrEqual(10);
  expect(metrics?.longestFrameIntervalMs).toBeLessThan(50);
  expect((metrics?.framesOver32Ms ?? Number.POSITIVE_INFINITY) / (metrics?.frameCount ?? 1)).toBeLessThan(0.01);
  expect(metrics?.noteCount).toBeLessThan(400);
  expect(fillCounts.fills).toBe(fillCounts.preparedKeys);
});

test("[T07 AC8] highlighting sustains 58 fps with stable memory for 60 seconds", async ({ page }) => {
  test.setTimeout(75_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const session = await page.context().newCDPSession(page);
  await page.goto("/src/testing/e2e/player-harness.html?mode=dense&runMs=60000");
  await page.waitForSelector("[data-note-id]");
  await session.send("HeapProfiler.collectGarbage");
  const before = await session.send("Performance.getMetrics");
  const beforeHeap = before.metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value ?? 0;

  await page.waitForFunction(() => window.__playerMetrics?.done, undefined, { timeout: 70_000 });
  const metrics = await page.evaluate(() => window.__playerMetrics);
  await session.send("HeapProfiler.collectGarbage");
  const after = await session.send("Performance.getMetrics");
  const afterHeap = after.metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value ?? 0;

  expect(metrics?.elapsedSeconds).toBeGreaterThanOrEqual(60);
  expect(metrics?.fps).toBeGreaterThanOrEqual(58);
  expect(metrics?.noteCount).toBeLessThan(400);
  expect(afterHeap - beforeHeap).toBeLessThan(5 * 1024 * 1024);
});
