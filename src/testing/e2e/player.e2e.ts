import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { build, preview, type PreviewServer } from "vite";

let server: PreviewServer;

test.use({ serviceWorkers: "block" });

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

test("keyboard and waterfall stay viewport-bound at both required sizes", async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(
      "/src/testing/e2e/player-harness.html?notices=all&listening=1&transient=1&speed=0.5",
    );
    await expect(page.getByTestId("waterfall-stage")).toBeVisible();
    await expect(page.getByTestId("piano-keyboard")).toBeVisible();
    await expect(page.locator("[data-midi]")).toHaveCount(88);

    const layout = await page.evaluate(() => ({
      clientHeight: document.documentElement.clientHeight,
      clientWidth: document.documentElement.clientWidth,
      playerHeight: document.querySelector<HTMLElement>("[data-testid=player-view]")?.getBoundingClientRect().height,
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(layout.playerHeight).toBe(viewport.height);
    expect(layout.scrollHeight).toBe(layout.clientHeight);
    expect(layout.scrollWidth).toBe(layout.clientWidth);
  }
});

test("[T14 AC1, AC5] comfortable density preserves every measured band", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: false });
  });
  await mkdir(resolve("test-results/visual/t14-after"), { recursive: true });
  const cases = [
    { width: 1440, height: 900, header: 71, notes: 573, keyboard: 135, transport: 121 },
    { width: 1024, height: 768, header: 71, notes: 460.8125, keyboard: 115.1875, transport: 121 },
    { width: 768, height: 1024, header: 71, notes: 678.40625, keyboard: 153.59375, transport: 121 },
  ];

  for (const expected of cases) {
    await page.setViewportSize(expected);
    await page.goto("/src/testing/e2e/player-harness.html?piece=air&position=0");
    await expect(page.getByTestId("player-view")).toHaveAttribute("data-density", "comfortable");
    const layout = await page.evaluate(() => {
      const height = (testId: string) =>
        document
          .querySelector<HTMLElement>(`[data-testid="${testId}"]`)!
          .getBoundingClientRect().height;
      return {
        header: height("player-header"),
        notes: height("waterfall-stage"),
        keyboard: height("piano-keyboard"),
        transport: height("player-transport"),
      };
    });
    expect(layout.header).toBeCloseTo(expected.header, 3);
    expect(layout.notes).toBeCloseTo(expected.notes, 3);
    expect(layout.keyboard).toBeCloseTo(expected.keyboard, 3);
    expect(layout.transport).toBeCloseTo(expected.transport, 3);
    await page.screenshot({
      path: resolve(
        "test-results/visual/t14-after",
        `${expected.width}x${expected.height}.png`,
      ),
    });
  }
});

test("[T14 AC2, AC4, AC6, AC7] compact landscape geometry fits without document scroll", async ({
  page,
}) => {
  const cases = [
    { width: 932, height: 430, notesMin: 210, transport: "single-row", transportHeight: 52 },
    { width: 932, height: 320, notesMin: 120, transport: "single-row", transportHeight: 52 },
    { width: 844, height: 390, notesMin: 0, transport: "single-row", transportHeight: 52 },
    { width: 667, height: 375, notesMin: 140, transport: "two-row", transportHeight: 88 },
  ];

  for (const expected of cases) {
    await page.setViewportSize(expected);
    await page.goto("/src/testing/e2e/player-harness.html?piece=air&position=0");
    await expect(page.getByTestId("player-view")).toHaveAttribute("data-density", "compact");
    await expect(page.getByTestId("player-transport")).toHaveAttribute(
      "data-layout",
      expected.transport,
    );
    const layout = await page.evaluate(() => {
      const rect = (testId: string) =>
        document
          .querySelector<HTMLElement>(`[data-testid="${testId}"]`)!
          .getBoundingClientRect();
      const header = rect("player-header");
      return {
        headerHeight: header.height,
        headerChildrenFit: [...document.querySelector("[data-testid=player-header]")!.children]
          .every((element) => {
            const bounds = element.getBoundingClientRect();
            return bounds.left >= header.left && bounds.right <= header.right;
          }),
        notesHeight: rect("waterfall-stage").height,
        transportHeight: rect("player-transport").height,
        seekHeight: rect("seek-bar").height,
        clientHeight: document.documentElement.clientHeight,
        scrollHeight: document.documentElement.scrollHeight,
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });
    expect(layout.headerHeight).toBe(44);
    expect(layout.transportHeight).toBe(expected.transportHeight);
    expect(layout.headerChildrenFit).toBe(true);
    expect(layout.notesHeight).toBeGreaterThanOrEqual(expected.notesMin);
    expect(layout.seekHeight).toBeGreaterThanOrEqual(34);
    expect(layout.scrollHeight).toBe(layout.clientHeight);
    expect(layout.scrollWidth).toBe(layout.clientWidth);
    const title = page.getByTestId("player-title-line");
    await expect(title).toContainText("Air — BWV Anh. 131");
    await expect(title).toContainText("BACH, JOHANN SEBASTIAN");
    await expect(title).toContainText("Mutopia Project");
  }
});

test("[T14 AC3, AC6, AC11] every practice control remains visible and operable at both densities", async ({
  page,
}) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 932, height: 430 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/src/testing/e2e/player-harness.html?piece=air&position=12&controls=1");
    const buttons = [
      /Library/,
      "Note colours",
      "Audio on",
      "Listen mode",
      "Play",
      "1x",
      "0.5x",
      "0.25x",
      "Set A",
      "Set B",
      "Clear",
    ] as const;
    for (const name of buttons) {
      const control = page.getByRole("button", { name });
      await expect(control).toBeVisible();
      await expect(control).toBeEnabled();
    }
    await expect(page.getByRole("slider", { name: "Volume" })).toBeVisible();
    await expect(page.getByTestId("seek-bar")).toBeVisible();

    const volume = page.getByRole("slider", { name: "Volume" });
    const volumeBounds = await volume.boundingBox();
    if (!volumeBounds) throw new Error("Volume slider has no bounds");
    await page.mouse.click(volumeBounds.x + volumeBounds.width * 0.4, volumeBounds.y + 15);
    await expect(volume).toHaveValue("40");

    await page.getByRole("button", { name: "Note colours" }).click();
    await page.getByRole("button", { name: "Swap hands" }).click();
    await expect(page.getByRole("button", { name: "Swap hands" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Note colours" })).toHaveCount(0);

    await page.getByRole("button", { name: "Audio on" }).click();
    await expect(page.getByRole("button", { name: "Muted" })).toBeVisible();
    await page.getByRole("button", { name: "Muted" }).click();
    await page.getByRole("button", { name: "Listen mode" }).click();
    await page.getByRole("button", { name: "Play" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    for (const speed of ["0.5x", "0.25x", "1x"]) {
      await page.getByRole("button", { name: speed }).click();
      await expect(page.getByRole("button", { name: speed })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }

    const seek = page.getByTestId("seek-bar");
    const seekBounds = await seek.boundingBox();
    if (!seekBounds) throw new Error("Seek bar has no bounds");
    await page.mouse.move(seekBounds.x + seekBounds.width * 0.25, seekBounds.y + 17);
    await page.mouse.down();
    await page.mouse.up();
    await page.getByRole("button", { name: "Set A" }).click();
    await page.mouse.move(seekBounds.x + seekBounds.width * 0.6, seekBounds.y + 17);
    await page.mouse.down();
    await page.mouse.up();
    await page.getByRole("button", { name: "Set B" }).click();
    const marker = page.getByTestId("loop-marker-a");
    const markerBounds = await marker.boundingBox();
    if (!markerBounds) throw new Error("Loop marker A has no bounds");
    await page.mouse.move(
      markerBounds.x + markerBounds.width / 2,
      markerBounds.y + markerBounds.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(seekBounds.x + seekBounds.width * 0.2, seekBounds.y + 17);
    await expect(seek).toHaveAttribute("data-scrubbing", "a");
    await page.mouse.up();
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page.getByTestId("loop-marker-a")).toHaveCount(0);
    await page.getByRole("button", { name: /Library/ }).click();

    await page.waitForTimeout(4_300);
    for (const name of buttons) {
      const currentName = name === "Play" ? "Pause" : name;
      await expect(page.getByRole("button", { name: currentName })).toBeVisible();
    }
  }
});

test("[T14 AC8, AC9] Chromium fullscreen survives a rejected orientation lock", async ({
  page,
}) => {
  await page.setViewportSize({ width: 932, height: 430 });
  await page.goto("/src/testing/e2e/player-harness.html?piece=air");
  expect(await page.evaluate(() => document.fullscreenEnabled)).toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(screen.orientation, "lock", {
      configurable: true,
      value: () => {
        document.body.dataset.orientationLock = "attempted";
        return Promise.reject(new Error("unsupported"));
      },
    });
  });

  await page.getByRole("button", { name: "Full screen" }).click();
  await expect(page.getByRole("button", { name: "Exit full screen" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.fullscreenElement?.getAttribute("data-testid") === "player-view",
    ),
  ).toBe(true);
  await expect(page.locator("body")).toHaveAttribute("data-orientation-lock", "attempted");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Full screen" })).toBeVisible();
});

test("[T14 AC5] measured-height hysteresis does not oscillate around 620px", async ({ page }) => {
  await page.setViewportSize({ width: 932, height: 430 });
  await page.goto("/src/testing/e2e/player-harness.html?piece=air");
  await expect(page.getByTestId("player-view")).toHaveAttribute("data-density", "compact");
  await page.setViewportSize({ width: 932, height: 625 });
  await expect(page.getByTestId("player-view")).toHaveAttribute("data-density", "compact");
  await page.setViewportSize({ width: 932, height: 632 });
  await expect(page.getByTestId("player-view")).toHaveAttribute("data-density", "comfortable");
  await page.setViewportSize({ width: 932, height: 615 });
  await expect(page.getByTestId("player-view")).toHaveAttribute("data-density", "comfortable");
  await page.setViewportSize({ width: 932, height: 608 });
  await expect(page.getByTestId("player-view")).toHaveAttribute("data-density", "compact");
});

test("[T14 AC2] player has no dead scroll while Home and Report remain scrollable", async ({ page }) => {
  await page.setViewportSize({ width: 932, height: 430 });
  await page.goto("/src/testing/e2e/player-harness.html?piece=air");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight === document.documentElement.clientHeight,
    ),
  ).toBe(true);

  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight > document.documentElement.clientHeight,
    ),
  ).toBe(true);

  await page.goto("/reports/missing-attempt");
  const reportCanScroll = await page.evaluate(() => {
    const filler = document.createElement("div");
    filler.style.height = "1000px";
    document.body.append(filler);
    return {
      bodyOverflow: getComputedStyle(document.body).overflowY,
      scrollable: document.documentElement.scrollHeight > document.documentElement.clientHeight,
    };
  });
  expect(reportCanScroll.bodyOverflow).not.toBe("hidden");
  expect(reportCanScroll.scrollable).toBe(true);
});

test("[T14 AC10] no tested width creates horizontal page scroll", async ({ page }) => {
  for (const width of [320, 375, 390, 430, 667, 768, 820, 844, 932, 1024, 1440]) {
    const height = width < 667 ? 900 : width >= 1024 ? 900 : 430;
    await page.setViewportSize({ width, height });
    await page.goto("/src/testing/e2e/player-harness.html?piece=air");
    const horizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(horizontalScroll, `${width}x${height}`).toBe(false);
  }
});

test("[T05a AC3, AC4, AC5, AC7, AC8] volume and header states persist and fit", async ({
  browser,
  context,
  page,
}) => {
  await mkdir(resolve("test-results/visual"), { recursive: true });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/src/testing/e2e/player-harness.html?piece=first");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const slider = page.getByRole("slider", { name: "Volume" });
    await expect(slider).toHaveValue("100");
    await expect(page.getByRole("button", { name: "← Library" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Prelude in C major" })).toBeVisible();
    await expect(page.getByTestId("hand-legend")).toBeVisible();
    await expect(page.getByRole("button", { name: "Audio on" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Listen mode" })).toBeVisible();

    const layout = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>("[data-testid=player-header]")!;
      const headerBounds = header.getBoundingClientRect();
      return {
        flexWrap: getComputedStyle(header).flexWrap,
        headerChildrenFit: [...header.children].every((child) => {
          const bounds = child.getBoundingClientRect();
          return bounds.left >= headerBounds.left && bounds.right <= headerBounds.right;
        }),
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        touchAction: getComputedStyle(
          document.querySelector<HTMLElement>("input[aria-label=Volume]")!,
        ).touchAction,
      };
    });
    expect(layout.flexWrap).toBe("wrap");
    expect(layout.headerChildrenFit).toBe(true);
    expect(layout.scrollWidth).toBe(layout.clientWidth);
    expect(layout.touchAction).toBe("none");
    await page.screenshot({
      path: resolve(
        "test-results/visual",
        `player-volume-default-${viewport.width}x${viewport.height}.png`,
      ),
    });

    const sliderBounds = await slider.boundingBox();
    if (!sliderBounds) throw new Error("Volume slider has no bounds");
    await page.mouse.move(sliderBounds.x + sliderBounds.width / 2, sliderBounds.y + 15);
    await page.mouse.down();
    await page.mouse.up();
    await expect(slider).toHaveValue("50");
    await page.screenshot({
      path: resolve(
        "test-results/visual",
        `player-volume-half-${viewport.width}x${viewport.height}.png`,
      ),
    });

    await page.reload();
    await expect(page.getByRole("slider", { name: "Volume" })).toHaveValue("50");
    await page.goto("/src/testing/e2e/player-harness.html?piece=second");
    await expect(page.getByRole("slider", { name: "Volume" })).toHaveValue("50");

    const storageState = await context.storageState();
    const restartedContext = await browser.newContext({ storageState, viewport });
    const restartedPage = await restartedContext.newPage();
    await restartedPage.goto("/src/testing/e2e/player-harness.html?piece=second");
    await expect(restartedPage.getByRole("slider", { name: "Volume" })).toHaveValue("50");
    await restartedContext.close();

    await page.getByRole("button", { name: "Audio on" }).click();
    await expect(page.getByRole("button", { name: "Muted" })).toBeVisible();
    await expect(page.getByRole("slider", { name: "Volume" })).toHaveValue("50");
    await page.screenshot({
      path: resolve(
        "test-results/visual",
        `player-volume-muted-${viewport.width}x${viewport.height}.png`,
      ),
    });
    await page.getByRole("button", { name: "Muted" }).click();
    await expect(page.getByRole("slider", { name: "Volume" })).toHaveValue("50");

    const restoredSlider = page.getByRole("slider", { name: "Volume" });
    const restoredBounds = await restoredSlider.boundingBox();
    if (!restoredBounds) throw new Error("Volume slider has no bounds after reload");
    await page.mouse.move(restoredBounds.x, restoredBounds.y + 15);
    await page.mouse.down();
    await page.mouse.up();
    await expect(restoredSlider).toHaveValue("0");
    await expect(page.getByRole("button", { name: "Audio on" })).toBeVisible();
    await page.screenshot({
      path: resolve(
        "test-results/visual",
        `player-volume-zero-${viewport.width}x${viewport.height}.png`,
      ),
    });
  }
});

test("[T07 highlight, T07a fill AC1-AC7] countdown fill and press cues render at both required sizes", async ({ page }) => {
  await mkdir(resolve("test-results/visual"), { recursive: true });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/src/testing/e2e/player-harness.html?position=5.25");
    const rightPrepare = page.getByTestId("piano-key-67");
    const leftPrepare = page.getByTestId("piano-key-61");
    await expect(rightPrepare).toHaveAttribute("data-state", "prepare");
    await expect(rightPrepare).toHaveAttribute("data-hand", "right");
    await expect(leftPrepare).toHaveAttribute("data-state", "prepare");
    await expect(leftPrepare).toHaveAttribute("data-hand", "left");
    await expect(rightPrepare.locator("span:not([data-countdown-fill])")).toHaveCSS("font-size", "9px");
    await expect(leftPrepare.locator("span:not([data-countdown-fill])")).toHaveCSS("font-size", "7px");
    const chordFill = await page.evaluate(() =>
      [67, 61].map((midi) => {
        const key = document.querySelector<HTMLElement>(`[data-midi="${midi}"]`)!;
        const fill = key.querySelector<HTMLElement>("[data-countdown-fill]")!;
        const label = key.querySelector<HTMLElement>("span:not([data-countdown-fill])")!;
        return {
          height: fill.style.height,
          imminence: Number(fill.dataset.imminence),
          fillBeforeLabel: Boolean(fill.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING),
          labelZIndex: getComputedStyle(label).zIndex,
        };
      }),
    );
    expect(chordFill.map((fill) => fill.height)).toEqual(["25%", "25%"]);
    expect(chordFill.map((fill) => fill.imminence)).toEqual([0.25, 0.25]);
    expect(chordFill.every((fill) => fill.fillBeforeLabel && fill.labelZIndex === "3")).toBe(true);
    await page.screenshot({
      path: resolve("test-results/visual", `player-highlight-prepare-${viewport.width}x${viewport.height}.png`),
    });
    await page.screenshot({
      path: resolve("test-results/visual", `player-countdown-fill-chord-${viewport.width}x${viewport.height}.png`),
    });

    await page.goto("/src/testing/e2e/player-harness.html?position=6.8");
    const runMidi = [57, 60, 64, 69, 71];
    const runFill = await page.evaluate((midiValues) =>
      midiValues.map((midi) => {
        const key = document.querySelector<HTMLElement>(`[data-midi="${midi}"]`)!;
        const fill = key.querySelector<HTMLElement>("[data-countdown-fill]")!;
        return {
          state: key.dataset.state,
          height: Number.parseFloat(fill.style.height) / 100,
        };
      }), runMidi);
    expect(runFill.map((fill) => fill.state)).toEqual(runMidi.map(() => "prepare"));
    runFill.forEach((fill, index) => {
      expect(fill.height).toBeCloseTo([0.8, 0.6, 0.4, 0.2, 0][index], 6);
    });
    await expect(page.getByTestId("piano-key-57").locator("span:not([data-countdown-fill])")).toBeVisible();
    await expect(page.getByTestId("piano-key-71").locator("span:not([data-countdown-fill])")).toBeVisible();
    await page.screenshot({
      path: resolve("test-results/visual", `player-countdown-fill-run-${viewport.width}x${viewport.height}.png`),
    });

    await page.goto("/src/testing/e2e/player-harness.html?position=4");
    const whitePress = page.getByTestId("piano-key-60");
    const blackPress = page.getByTestId("piano-key-66");
    await expect(whitePress).toHaveAttribute("data-state", "pressed");
    await expect(blackPress).toHaveAttribute("data-state", "pressed");
    await expect(whitePress.locator("span:not([data-countdown-fill])")).toHaveCSS("font-size", "13px");
    await expect(blackPress.locator("span:not([data-countdown-fill])")).toHaveCSS("font-size", "10px");
    await expect(whitePress.locator("span:not([data-countdown-fill])")).toHaveCSS("font-weight", "500");
    await expect(whitePress.locator("[data-countdown-fill]")).toHaveCount(0);
    await expect(blackPress.locator("[data-countdown-fill]")).toHaveCount(0);
    await page.screenshot({
      path: resolve("test-results/visual", `player-highlight-press-${viewport.width}x${viewport.height}.png`),
    });

    await page.goto("/src/testing/e2e/player-harness.html?position=5.25&hand=none");
    await expect(page.getByTestId("piano-key-67")).toHaveAttribute("data-hand", "right");
    await expect(page.getByTestId("piano-key-61")).toHaveAttribute("data-hand", "right");
    const singleColourFills = await page.evaluate(() =>
      [67, 61].map((midi) =>
        getComputedStyle(
          document.querySelector(`[data-midi="${midi}"] [data-countdown-fill]`)!,
        ).backgroundColor,
      ),
    );
    expect(singleColourFills[0]).toBe(singleColourFills[1]);
    const layout = await page.evaluate(() => ({
      clientHeight: document.documentElement.clientHeight,
      clientWidth: document.documentElement.clientWidth,
      playerHeight: document.querySelector<HTMLElement>("[data-testid=player-view]")?.getBoundingClientRect().height,
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(layout.playerHeight).toBe(viewport.height);
    expect(layout.scrollHeight).toBe(layout.clientHeight);
    expect(layout.scrollWidth).toBe(layout.clientWidth);
    await page.screenshot({
      path: resolve("test-results/visual", `player-highlight-single-colour-${viewport.width}x${viewport.height}.png`),
    });
  }
});

test("[T15 keyboard contrast] captures idle, prepare, press-now, and error at both report sizes", async ({ page }) => {
  await mkdir(resolve("test-results/visual"), { recursive: true });
  const states = [
    { name: "idle", url: "?position=0", whiteMidi: 60, blackMidi: 61, state: "idle" },
    { name: "prepare", url: "?position=5.25", whiteMidi: 67, blackMidi: 61, state: "prepare" },
    { name: "press-now", url: "?position=4", whiteMidi: 60, blackMidi: 66, state: "pressed" },
    { name: "error", url: "?position=4.1&listening=1&error=1", whiteMidi: 64, blackMidi: 66, state: "error" },
  ] as const;

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 932, height: 430 },
  ]) {
    await page.setViewportSize(viewport);
    for (const state of states) {
      await page.goto(`/src/testing/e2e/player-harness.html${state.url}`);
      await page.evaluate(async () => {
        await document.fonts.ready;
      });
      const whiteKey = page.getByTestId(`piano-key-${state.whiteMidi}`);
      const blackKey = page.getByTestId(`piano-key-${state.blackMidi}`);
      await expect(whiteKey).toHaveAttribute("data-state", state.state);
      await expect(blackKey).toHaveAttribute("data-state", state.state);

      if (state.state === "idle") {
        const faces = await Promise.all([
          whiteKey.evaluate((element) => getComputedStyle(element).backgroundColor),
          blackKey.evaluate((element) => getComputedStyle(element).backgroundColor),
        ]);
        expect(faces[0]).not.toBe(faces[1]);
      } else if (state.state === "prepare") {
        await expect(whiteKey.locator("[data-countdown-fill]")).toHaveCount(1);
        await expect(blackKey.locator("[data-countdown-fill]")).toHaveCount(1);
      } else if (state.state === "pressed") {
        await expect(whiteKey).toHaveCSS("outline-width", "2px");
        await expect(whiteKey).toHaveCSS("outline-offset", "-2px");
        await expect(blackKey).toHaveCSS("outline-style", "none");
      }

      await page.getByTestId("piano-keyboard").screenshot({
        path: resolve(
          "test-results/visual",
          `t15-keyboard-${state.name}-${viewport.width}x${viewport.height}.png`,
        ),
      });
    }
  }
});

test("transport hint, loop, scrub, and shortcut states work at both required sizes", async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/src/testing/e2e/player-harness.html?position=0");
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
    await expect(page.getByText("0:00 / 2:00")).toBeVisible();
    await expect(page.getByText("← → SKIP 5 SECONDS", { exact: true })).toBeVisible();
    await expect(page.getByText(/SPACE PLAY|DRAG BAR TO SCRUB/)).toHaveCount(0);
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText("0:05 / 2:00")).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByText("0:00 / 2:00")).toBeVisible();
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

    const seekBar = page.getByTestId("seek-bar");
    const bounds = await seekBar.boundingBox();
    expect(bounds).not.toBeNull();
    if (!bounds) throw new Error("Seek bar has no bounds");
    await page.mouse.move(bounds.x + bounds.width * 0.1, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.2, bounds.y + bounds.height / 2);
    await expect(page.getByTestId("scrub-tooltip")).toBeVisible();
    await page.mouse.up();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

    for (const speed of ["0.5x", "0.25x", "1x"]) {
      await page.getByRole("button", { name: speed }).click();
      await expect(page.getByRole("button", { name: speed })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }

    await page.getByRole("button", { name: "Set A" }).click();
    await expect(page.getByTestId("loop-marker-a")).toBeVisible();
    await page.mouse.move(bounds.x + bounds.width * 0.4, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await page.getByRole("button", { name: "Set B" }).click();
    await expect(page.getByTestId("loop-region")).toBeVisible();
    await expect(page.getByText(/^LOOPING /)).toBeVisible();

    const markerA = page.getByTestId("loop-marker-a");
    const markerBounds = await markerA.boundingBox();
    expect(markerBounds).not.toBeNull();
    if (!markerBounds) throw new Error("Loop marker A has no bounds");
    await page.mouse.move(
      markerBounds.x + markerBounds.width / 2,
      markerBounds.y + markerBounds.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.3, bounds.y + bounds.height / 2);
    await expect(seekBar).toHaveAttribute("data-scrubbing", "a");
    await page.mouse.up();

    const layout = await page.evaluate(() => ({
      clientHeight: document.documentElement.clientHeight,
      clientWidth: document.documentElement.clientWidth,
      playerHeight: document.querySelector<HTMLElement>("[data-testid=player-view]")?.getBoundingClientRect().height,
      rowWrap: getComputedStyle(document.querySelector("[data-testid=transport-row-2]")!).flexWrap,
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(layout.playerHeight).toBe(viewport.height);
    expect(layout.rowWrap).toBe("wrap");
    expect(layout.scrollHeight).toBe(layout.clientHeight);
    expect(layout.scrollWidth).toBe(layout.clientWidth);
  }
});

test("Player visual state inventory is saved at both required viewports", async ({ page }) => {
  const states = [
    { name: "paused-zero", query: "position=0" },
    { name: "playing", query: "playing=1" },
    { name: "scrubbing", query: "position=12", interaction: "scrub" },
    { name: "speed-1", query: "speed=1" },
    { name: "speed-05", query: "speed=0.5" },
    { name: "speed-025", query: "speed=0.25" },
    { name: "muted", query: "muted=1" },
    { name: "loop-a", query: "loop=a" },
    { name: "loop-active", query: "loop=active" },
    { name: "marker-dragging", query: "loop=active", interaction: "marker" },
    { name: "dropped-notes", query: "notices=dropped" },
    { name: "transient-notice", query: "transient=1" },
    { name: "hand-present", query: "hand=present" },
    { name: "hand-absent", query: "hand=none" },
  ];
  await mkdir(resolve("test-results/visual"), { recursive: true });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    for (const state of states) {
      await page.goto(`/src/testing/e2e/player-harness.html?${state.query}`);
      await expect(page.getByTestId("player-view")).toBeVisible();
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      const seekBar = page.getByTestId("seek-bar");
      if (state.interaction === "scrub") {
        const bounds = await seekBar.boundingBox();
        if (!bounds) throw new Error("Seek bar has no bounds");
        await page.mouse.move(bounds.x + bounds.width * 0.3, bounds.y + bounds.height / 2);
        await page.mouse.down();
        await expect(page.getByTestId("scrub-tooltip")).toBeVisible();
      }
      if (state.interaction === "marker") {
        const marker = page.getByTestId("loop-marker-a");
        const markerBounds = await marker.boundingBox();
        const seekBounds = await seekBar.boundingBox();
        if (!markerBounds || !seekBounds) throw new Error("Loop marker has no bounds");
        await page.mouse.move(
          markerBounds.x + markerBounds.width / 2,
          markerBounds.y + markerBounds.height / 2,
        );
        await page.mouse.down();
        await page.mouse.move(
          seekBounds.x + seekBounds.width * 0.2,
          seekBounds.y + seekBounds.height / 2,
        );
        await expect(seekBar).toHaveAttribute("data-scrubbing", "a");
      }

      const layout = await page.evaluate(() => ({
        clientHeight: document.documentElement.clientHeight,
        clientWidth: document.documentElement.clientWidth,
        playerHeight: document.querySelector<HTMLElement>("[data-testid=player-view]")?.getBoundingClientRect().height,
        scrollHeight: document.documentElement.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(layout.playerHeight).toBe(viewport.height);
      expect(layout.scrollHeight).toBe(layout.clientHeight);
      expect(layout.scrollWidth).toBe(layout.clientWidth);
      await page.screenshot({
        path: resolve("test-results/visual", `player-${state.name}-${viewport.width}x${viewport.height}.png`),
      });
      if (state.interaction) await page.mouse.up();
    }
  }
});
