import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
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
    expect(layout.flexWrap).toBe("nowrap");
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
