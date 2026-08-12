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

function uploadFailureCases() {
  return [
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
    preview: {
      host: "127.0.0.1",
      port: 4181,
      strictPort: true,
      allowedHosts: ["piano.test"],
    },
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

test("[T03c AC1, AC2] Home requests no score until one piece is opened exactly once", async ({
  page,
}) => {
  const scoreRequests: string[] = [];
  page.on("request", (request) => {
    if (/\.(?:mid|midi|musicxml|xml|mxl)$/.test(new URL(request.url()).pathname)) {
      scoreRequests.push(request.url());
    }
  });

  const result = await findFurElise(page);
  expect(scoreRequests).toEqual([]);
  await expect(page.getByText("MUTOPIAPROJECT · PUBLIC DOMAIN · STELIOS SAMELIS")).toBeVisible();

  await result.click();
  await expect(page.getByRole("heading", { name: "Für Elise" })).toBeVisible();
  await expect(
    page.getByText(
      "LUDWIG VAN BEETHOVEN · MUTOPIA CATALOG · STELIOS SAMELIS",
    ),
  ).toBeVisible();
  expect(scoreRequests).toHaveLength(1);
  expect(scoreRequests[0]).toMatch(/\/catalog\/scores\/fur-elise\.mid$/);
});

test("[T03b AC5] fetches the static manifest outside entry JS and stays inside the first-load budget", async ({
  page,
}) => {
  const responses: Array<Promise<{ url: string; type: string; body: Buffer }>> = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.hostname !== "127.0.0.1") return;
    const type = response.request().resourceType();
    if (!["document", "script", "stylesheet", "font", "fetch"].includes(type)) return;
    responses.push(
      response.body().then((body) => ({ url: response.url(), type, body: Buffer.from(body) })),
    );
  });

  await page.goto("/");
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForLoadState("networkidle");
  const loaded = await Promise.all(responses);
  const manifestResponses = loaded.filter(({ url }) =>
    new URL(url).pathname.endsWith("/catalog/manifest.json"),
  );
  const scoreResponses = loaded.filter(({ url }) =>
    new URL(url).pathname.startsWith("/catalog/scores/"),
  );
  const firstLoadBytes = loaded.reduce((total, response) => total + response.body.length, 0);
  const entryScripts = loaded.filter(({ type }) => type === "script");

  expect(manifestResponses).toHaveLength(1);
  expect(scoreResponses).toHaveLength(0);
  expect(firstLoadBytes).toBeLessThanOrEqual(1.5 * 1024 * 1024);
  expect(entryScripts.every(({ body }) => !body.toString("utf8").includes('"mutopiaId"'))).toBe(
    true,
  );
});

test("[T03a AC1, AC5] catalog is searchable from a non-localhost plain-HTTP origin", async () => {
  const browser = await chromium.launch({
    args: ["--host-resolver-rules=MAP piano.test 127.0.0.1", "--no-proxy-server"],
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto("http://piano.test:4181/");
    await expect
      .poll(() =>
        page.evaluate(() => ({
          hostname: window.location.hostname,
          protocol: window.location.protocol,
          secure: window.isSecureContext,
          subtle: Boolean(globalThis.crypto?.subtle),
        })),
      )
      .toEqual({ hostname: "piano.test", protocol: "http:", secure: false, subtle: false });

    await page.getByRole("textbox", { name: "Search catalog" }).fill("fur elise");
    await expect(
      page.getByRole("button", { name: /^Für Elise Ludwig van Beethoven/ }),
    ).toBeVisible();
    await expect(page.getByText("1 MATCH · PUBLIC DOMAIN & CC SOURCES")).toBeVisible();
    await expect(page.getByText("Catalog search is unavailable right now.")).toHaveCount(0);
  } finally {
    await context.close();
    await browser.close();
  }
});

test("[T03b AC8] a real manifest-fetch failure keeps upload and My Pieces working", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Upload", { exact: true }).setInputFiles({
    name: "known.mid",
    mimeType: "audio/midi",
    buffer: Buffer.from(knownMidiBytes()),
  });
  await expect(page.getByRole("heading", { name: "Known timing fixture" })).toBeVisible();
  await page.getByRole("button", { name: "← Library" }).click();
  await expect(page.getByText("Known timing fixture", { exact: true })).toBeVisible();

  await page.route("**/catalog/manifest.json", (route) => route.abort());
  await page.reload();
  await expect(
    page.getByText(
      "Catalog search is unavailable right now. Uploading a file and opening pieces from My pieces both still work offline.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Upload a MIDI or MusicXML file", { exact: true })).toBeVisible();
  await page.getByRole("button").filter({ hasText: "Known timing fixture" }).click();
  await expect(page.getByRole("heading", { name: "Known timing fixture" })).toBeVisible();
});

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

test("[T05b AC3, AC4, AC5] no-results upload shows every failure and saves a valid file", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Search catalog" }).fill("not in catalog");
  const input = page.getByLabel("Upload a MIDI or MusicXML file", { exact: true });

  for (const upload of uploadFailureCases()) {
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

test("[T05b AC1, AC2, AC3] My pieces upload works with the library empty and populated", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("0 SAVED LOCALLY")).toBeVisible();
  await expect(page.getByText("Upload", { exact: true })).toBeVisible();

  await page.getByLabel("Upload", { exact: true }).setInputFiles({
    name: "known.mid",
    mimeType: "audio/midi",
    buffer: Buffer.from(knownMidiBytes()),
  });
  await expect(page.getByRole("heading", { name: "Known timing fixture" })).toBeVisible();
  await page.getByRole("button", { name: "← Library" }).click();

  await expect(page.getByText("1 SAVED LOCALLY")).toBeVisible();
  await expect(page.getByText("Known timing fixture", { exact: true })).toBeVisible();
  await expect(page.getByText("Upload", { exact: true })).toBeVisible();
});

test("[T05b AC4] My pieces upload keeps all five failures in place", async ({ page }) => {
  await page.goto("/");
  const library = page.getByRole("region", { name: "My pieces" });
  const input = library.getByLabel("Upload", { exact: true });

  for (const upload of uploadFailureCases()) {
    await input.setInputFiles({
      name: upload.name,
      mimeType: "application/octet-stream",
      buffer: upload.buffer,
    });
    await expect(library.getByRole("alert")).toContainText(upload.message);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("progressbar")).toHaveCount(0);
  }
});

test("[T05b AC6] catalog-unavailable keeps only the D-017 upload card", async ({ page }) => {
  await page.goto("/src/testing/e2e/home-harness.html?state=catalog-unavailable");

  await expect(page.getByText("Open a local score while catalog search is unavailable.")).toBeVisible();
  await expect(page.getByLabel("Upload a MIDI or MusicXML file", { exact: true })).toHaveCount(1);
  await expect(page.getByLabel("Upload", { exact: true })).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(1);
});

test("[T03c AC1, AC3] a score outage is deferred to open while upload and library stay live", async ({
  page,
}) => {
  await page.route("**/*.mid", (route) => route.abort());
  await page.goto("/");

  await expect(page.getByText("Catalog search is unavailable right now.")).toHaveCount(0);
  await page.getByRole("textbox", { name: "Search catalog" }).fill("fur elise");
  await page.getByRole("button", { name: /^Für Elise Ludwig van Beethoven/ }).click();
  await expect(page.getByRole("alert")).toContainText("Für Elise");

  const input = page.getByLabel("Upload a MIDI or MusicXML file", { exact: true });
  await input.setInputFiles({
    name: "offline.mid",
    mimeType: "audio/midi",
    buffer: Buffer.from(knownMidiBytes()),
  });
  await expect(page.getByRole("heading", { name: "Known timing fixture" })).toBeVisible();
  await page.getByRole("button", { name: "← Library" }).click();
  await expect(page.getByText("Known timing fixture", { exact: true })).toBeVisible();
});

test("[T03a AC2] [T03c AC3] checksum mismatch on open renders the D-006 upload card", async ({
  page,
}) => {
  const result = await findFurElise(page);
  await page.route(/\/catalog\/scores\/fur-elise\.mid$/, (route) =>
    route.fulfill({
      body: Buffer.from([0]),
      contentType: "audio/midi",
      status: 200,
    }),
  );
  await result.click();

  await expect(page.getByRole("alert")).toContainText("Für Elise");
  await expect(page.getByText("Upload a MIDI or MusicXML file")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("[T05b AC7] Home upload visual state inventory is saved at both required viewports", async ({
  page,
}) => {
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
