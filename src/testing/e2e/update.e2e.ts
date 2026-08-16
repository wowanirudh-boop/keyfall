import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { build, preview, type Plugin, type PreviewServer } from "vite";

let server: PreviewServer | undefined;

function versionMarker(version: string): Plugin {
  return {
    name: "update-test-version-marker",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        return html.replace(
          "</body>",
          `<output data-testid="build-version" style="position:fixed;left:4px;top:80px">${version}</output></body>`,
        );
      },
    },
  };
}

async function buildVersion(version: string) {
  await build({ logLevel: "silent", plugins: [versionMarker(version)] });
}

async function startPreview() {
  server = await preview({
    logLevel: "silent",
    preview: { host: "127.0.0.1", port: 4181, strictPort: true },
  });
}

async function stopPreview() {
  await server?.close();
  server = undefined;
}

async function playedPercentage(page: Page) {
  return page.getByTestId("played-track").evaluate((track) =>
    Number.parseFloat((track as HTMLElement).style.width),
  );
}

test.afterEach(stopPreview);

test("[T10a AC1-AC6] a production build prompts and yields to a waiting worker only on request", async ({
  context,
  page,
}) => {
  test.setTimeout(90_000);
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1") await route.continue();
    else await route.abort();
  });

  await buildVersion("Previous build");
  await startPreview();

  await page.goto("/");
  await expect(page.getByTestId("build-version")).toHaveText("Previous build");
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolveControl) => {
        navigator.serviceWorker.addEventListener("controllerchange", () => resolveControl(), {
          once: true,
        });
      });
    }
    if (registration.waiting) throw new Error("A first-install worker must not be waiting");
  });
  await expect(page.getByTestId("update-notice")).toHaveCount(0);

  await page.getByRole("region", { name: "Playlists" }).getByRole("button").click();
  await page
    .getByRole("region", { name: "Classical Rousseau pieces" })
    .getByRole("button")
    .first()
    .click();
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  const positionBeforeBuild = await playedPercentage(page);

  await stopPreview();
  await buildVersion("Updated build");
  await startPreview();

  let mainFrameNavigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) mainFrameNavigations += 1;
  });
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration?.update();
  });

  const notice = page.getByTestId("update-notice");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("A new version is ready.");
  await expect(page.getByTestId("build-version")).toHaveText("Previous build");
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect.poll(() => playedPercentage(page)).toBeGreaterThan(positionBeforeBuild);
  expect(mainFrameNavigations).toBe(0);

  const positionBeforeDismiss = await playedPercentage(page);
  await page.getByRole("button", { name: "Dismiss update notice" }).click();
  await expect(notice).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect.poll(() => playedPercentage(page)).toBeGreaterThan(positionBeforeDismiss);
  expect(mainFrameNavigations).toBe(0);

  await page.reload();
  await expect(page.getByTestId("build-version")).toHaveText("Previous build");
  await expect(notice).toBeVisible();
  const navigationsBeforeReloadControl = mainFrameNavigations;

  mkdirSync(resolve("test-results/visual"), { recursive: true });
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 375, height: 812 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(notice).toBeVisible();
    const layout = await page.evaluate(() => {
      const update = document.querySelector<HTMLElement>("[data-testid='update-notice']");
      const transport = document.querySelector<HTMLElement>("button[aria-label='Play']");
      const updateBounds = update?.getBoundingClientRect();
      const transportBounds = transport?.getBoundingClientRect();
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        updateBottom: updateBounds?.bottom,
        transportTop: transportBounds?.top,
      };
    });
    expect(layout.scrollWidth).toBe(layout.clientWidth);
    expect(layout.updateBottom).toBeLessThanOrEqual(layout.transportTop ?? 0);
    await page.screenshot({
      path: resolve(
        "test-results/visual",
        `t10a-update-${viewport.width}x${viewport.height}.png`,
      ),
    });
  }

  await page.getByRole("button", { name: "Reload" }).click();
  await expect(page.getByTestId("build-version")).toHaveText("Updated build");
  await expect(notice).toHaveCount(0);
  expect(mainFrameNavigations).toBe(navigationsBeforeReloadControl + 1);
  await page.getByRole("button", { name: "← Library" }).click();
  await expect(page.getByRole("region", { name: "Playlists" })).toContainText(
    "Classical Rousseau",
  );
});
