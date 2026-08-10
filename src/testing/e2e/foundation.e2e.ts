import { expect, test } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';

let server: ViteDevServer;

test.beforeAll(async () => {
  server = await createServer({
    server: { host: '127.0.0.1', port: 4181, strictPort: true },
  });
  await server.listen();
});

test.afterAll(async () => {
  await server.close();
});

test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') {
      await route.continue();
    } else {
      await route.abort();
    }
  });
});

test('direct deep links and the fallback route render through the SPA', async ({ page }) => {
  await page.goto('/pieces/anything');
  await expect(page.getByText('Player')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Piece anything' })).toBeVisible();

  await page.goto('/reports/attempt-42');
  await expect(page.getByText('Report')).toBeVisible();

  await page.goto('/missing');
  await expect(page.getByText('Not found')).toBeVisible();
});

test('all UI and mono font weights load locally with external network blocked', async ({ page }) => {
  const fontRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('.woff2')) fontRequests.push(request.url());
  });

  await page.goto('/');
  const loaded = await page.evaluate(async () => {
    const specs = [
      '400 16px "Space Grotesk"',
      '500 16px "Space Grotesk"',
      '700 16px "Space Grotesk"',
      '400 16px "IBM Plex Mono"',
      '500 16px "IBM Plex Mono"',
    ];
    return Promise.all(specs.map(async (spec) => (await document.fonts.load(spec)).length > 0));
  });

  expect(loaded).toEqual([true, true, true, true, true]);
  expect(fontRequests.length).toBeGreaterThanOrEqual(3);
  expect(fontRequests.every((url) => new URL(url).hostname === '127.0.0.1')).toBe(true);

  const headerStyles = await page.evaluate(() => {
    const wordmark = [...document.querySelectorAll('span')].find(
      (element) => element.textContent === 'Piano Practice Player',
    );
    const metadata = [...document.querySelectorAll('span')].find(
      (element) => element.textContent?.trim() === 'LOCAL LIBRARY · NO ACCOUNT',
    );
    const dot = document.querySelector('[aria-hidden="true"]');
    const dotStyle = dot ? getComputedStyle(dot) : null;
    const metadataStyle = metadata ? getComputedStyle(metadata) : null;
    const wordmarkStyle = wordmark ? getComputedStyle(wordmark) : null;

    return {
      dotHeight: dotStyle?.height,
      dotWidth: dotStyle?.width,
      metadataFontFamily: metadataStyle?.fontFamily,
      metadataFontSize: metadataStyle?.fontSize,
      wordmarkFontFamily: wordmarkStyle?.fontFamily,
      wordmarkFontSize: wordmarkStyle?.fontSize,
      wordmarkFontWeight: wordmarkStyle?.fontWeight,
    };
  });

  expect(headerStyles.dotWidth).toBe('10px');
  expect(headerStyles.dotHeight).toBe('10px');
  expect(headerStyles.wordmarkFontFamily).toContain('Space Grotesk');
  expect(headerStyles.wordmarkFontSize).toBe('19px');
  expect(headerStyles.wordmarkFontWeight).toBe('700');
  expect(headerStyles.metadataFontFamily).toContain('IBM Plex Mono');
  expect(headerStyles.metadataFontSize).toBe('11px');
});

test('route shells have no horizontal page scroll at both required viewports', async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    for (const path of ['/', '/pieces/anything', '/reports/attempt-42', '/missing']) {
      await page.goto(path);
      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(hasHorizontalScroll).toBe(false);
    }
  }
});
