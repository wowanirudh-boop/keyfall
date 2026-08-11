import { expect, test, chromium, type BrowserContext, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import midiPackage from "@tonejs/midi";
import { build, preview, type PreviewServer } from "vite";

const { Midi } = midiPackage;
const IMPORT_ERROR_MESSAGES = {
  "unsupported-extension":
    "Unsupported file type. Choose a .mid, .midi, .musicxml, .xml, or .mxl file.",
  "too-large": "This file is larger than 10 MB.",
  "too-long": "This piece is longer than 30 minutes.",
  unparseable: "This file could not be parsed as MIDI or MusicXML.",
  "no-notes": "This file contains no playable notes.",
} as const;

function knownMidiBytes() {
  const midi = new Midi();
  midi.header.setTempo(120);
  midi.name = "Known timing fixture";
  const track = midi.addTrack();
  track.addNote({ midi: 60, time: 0.25, duration: 0.5, velocity: 0.8 });
  return midi.toArray();
}

function longMidiBytes() {
  const midi = new Midi();
  midi.header.setTempo(120);
  midi.addTrack().addNote({ midi: 60, time: 1_800, duration: 0.001 });
  return midi.toArray();
}

function emptyMidiBytes() {
  const midi = new Midi();
  midi.header.setTempo(120);
  return midi.toArray();
}

let server: PreviewServer;

test.beforeAll(async () => {
  await build({
    logLevel: "silent",
    build: {
      rollupOptions: {
        input: {
          app: resolve("index.html"),
          homeHarness: resolve("src/testing/e2e/home-harness.html"),
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

async function findFurElise(page: Page) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Search catalog" }).fill("fur elise");
  const result = page.getByRole("button", { name: /^Für Elise Ludwig van Beethoven/ });
  await expect(result).toBeVisible();
  return result;
}

async function indexedDbHasPiece(page: Page, pieceId: string) {
  return page.evaluate(
    (id) =>
      new Promise<boolean>((resolveResult, reject) => {
        const request = indexedDB.open("piano-practice-player");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const get = database.transaction("pieces", "readonly").objectStore("pieces").get(id);
          get.onerror = () => reject(get.error);
          get.onsuccess = () => {
            database.close();
            resolveResult(Boolean(get.result));
          };
        };
      }),
    pieceId,
  );
}

test("search opens, practices offline, reloads from library without parsing, and deletes", async ({
  page,
  context,
}) => {
  const result = await findFurElise(page);
  await result.click();

  await expect(page.getByRole("heading", { name: "Für Elise" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  await expect(page.getByText(/^0:00 \/ 2:10$/)).toBeVisible();
  await expect(page.getByTestId("loop-region")).toHaveCount(0);
  await expect.poll(() => indexedDbHasPiece(page, "fur-elise")).toBe(true);

  await page.getByRole("button", { name: "0.5x" }).click();
  const seekBar = page.getByTestId("seek-bar");
  const bounds = await seekBar.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) throw new Error("Seek bar has no bounds");
  await page.mouse.click(bounds.x + bounds.width * 0.2, bounds.y + bounds.height / 2);
  await page.getByRole("button", { name: "Set A" }).click();
  await page.mouse.click(bounds.x + bounds.width * 0.4, bounds.y + bounds.height / 2);
  await page.getByRole("button", { name: "Set B" }).click();
  await expect(page.getByTestId("loop-region")).toBeVisible();

  await context.setOffline(true);
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await context.setOffline(false);

  await page.getByRole("button", { name: "← Library" }).click();
  await expect(page.getByText("1 SAVED LOCALLY")).toBeVisible();
  let workerRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("import.worker")) workerRequests += 1;
  });
  await page.reload();
  await expect(page.getByText("1 SAVED LOCALLY")).toBeVisible();
  await page.getByRole("button", { name: /^Für Elise LUDWIG VAN BEETHOVEN/ }).click();
  await expect(page.getByRole("heading", { name: "Für Elise" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  expect(workerRequests).toBe(0);

  await page.getByRole("button", { name: "← Library" }).click();
  await page.getByRole("button", { name: "Delete Für Elise" }).click();
  await expect(page.getByText("0 SAVED LOCALLY")).toBeVisible();
  await expect.poll(() => indexedDbHasPiece(page, "fur-elise")).toBe(false);
});

test("library reopens a piece after a full browser restart", async () => {
  const profile = resolve("test-results/persistent-library-profile");
  let context = await chromium.launchPersistentContext(profile, { headless: true });
  await allowLocalRequests(context);
  let page = context.pages()[0] ?? (await context.newPage());
  await page.goto("http://127.0.0.1:4181/");
  await page.getByRole("textbox", { name: "Search catalog" }).fill("fur elise");
  await page.getByRole("button", { name: /^Für Elise Ludwig van Beethoven/ }).click();
  await expect(page.getByRole("heading", { name: "Für Elise" })).toBeVisible();
  await context.close();

  context = await chromium.launchPersistentContext(profile, { headless: true });
  await allowLocalRequests(context);
  page = context.pages()[0] ?? (await context.newPage());
  let workerRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("import.worker")) workerRequests += 1;
  });
  await page.goto("http://127.0.0.1:4181/");
  await expect(page.getByText("1 SAVED LOCALLY")).toBeVisible();
  await page.getByRole("button", { name: /^Für Elise LUDWIG VAN BEETHOVEN/ }).click();
  await expect(page.getByRole("heading", { name: "Für Elise" })).toBeVisible();
  expect(workerRequests).toBe(0);
  await context.close();
});

test("upload shows every specific failure and a valid file joins the library", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Search catalog" }).fill("not in catalog");
  const input = page.locator('input[type="file"]');
  const cases = [
    {
      name: "score.pdf",
      buffer: Buffer.from("pdf"),
      message: IMPORT_ERROR_MESSAGES["unsupported-extension"],
    },
    {
      name: "too-large.mid",
      buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
      message: IMPORT_ERROR_MESSAGES["too-large"],
    },
    {
      name: "too-long.mid",
      buffer: Buffer.from(longMidiBytes()),
      message: IMPORT_ERROR_MESSAGES["too-long"],
    },
    {
      name: "broken.mid",
      buffer: Buffer.from("not midi"),
      message: IMPORT_ERROR_MESSAGES.unparseable,
    },
    {
      name: "empty.mid",
      buffer: Buffer.from(emptyMidiBytes()),
      message: IMPORT_ERROR_MESSAGES["no-notes"],
    },
  ];

  for (const upload of cases) {
    await input.setInputFiles({ name: upload.name, mimeType: "application/octet-stream", buffer: upload.buffer });
    await expect(page.getByRole("alert")).toContainText(upload.message);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("progressbar")).toHaveCount(0);
  }

  await input.setInputFiles({
    name: "known.mid",
    mimeType: "audio/midi",
    buffer: Buffer.from(knownMidiBytes()),
  });
  await expect(page.getByRole("heading", { name: "Known timing fixture" })).toBeVisible();
  await page.getByRole("button", { name: "← Library" }).click();
  await expect(page.getByText("Known timing fixture", { exact: true })).toBeVisible();
});

test("catalog search unavailable keeps upload and library live", async ({ page }) => {
  await page.route("**/*.mid", (route) => route.abort());
  await page.goto("/");

  await expect(
    page.getByText(
      "Catalog search is unavailable right now. Uploading a file and opening pieces from My pieces both still work offline.",
    ),
  ).toBeVisible();
  const input = page.locator('input[type="file"]');
  await input.setInputFiles({
    name: "offline.mid",
    mimeType: "audio/midi",
    buffer: Buffer.from(knownMidiBytes()),
  });
  await expect(page.getByRole("heading", { name: "Known timing fixture" })).toBeVisible();
  await page.getByRole("button", { name: "← Library" }).click();
  await expect(page.getByText("Known timing fixture", { exact: true })).toBeVisible();
});

test("search asset failure renders the D-006 upload card", async ({ page }) => {
  const result = await findFurElise(page);
  await page.route(/fur-elise-.*\.mid/, (route) => route.abort());
  await result.click();

  await expect(page.getByRole("alert")).toContainText("Für Elise");
  await expect(page.getByText("Upload a MIDI or MusicXML file")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("Home visual state inventory is saved at both required viewports", async ({ page }) => {
  const states = [
    "empty",
    "populated",
    "results",
    "no-results",
    "upload-unsupported-extension",
    "upload-too-large",
    "upload-too-long",
    "upload-unparseable",
    "upload-no-notes",
    "catalog-unavailable",
    "query",
    "asset-failure",
  ];
  await mkdir(resolve("test-results/visual"), { recursive: true });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    for (const state of states) {
      await page.goto(`/src/testing/e2e/home-harness.html?state=${state}`);
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(layout.scrollWidth).toBe(layout.clientWidth);
      await page.screenshot({
        path: resolve("test-results/visual", `home-${state}-${viewport.width}x${viewport.height}.png`),
        fullPage: true,
      });
    }
  }
});
