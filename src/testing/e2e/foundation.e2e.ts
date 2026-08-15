import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build, preview, type PreviewServer } from 'vite';

let server: PreviewServer;

test.beforeAll(async () => {
  await build({ logLevel: 'silent' });
  server = await preview({
    logLevel: 'silent',
    preview: { host: '127.0.0.1', port: 4181, strictPort: true },
  });
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

test('[T10 AC3, AC4] deeplink routes and the Pages fallback resolve through the production SPA', async ({ page }) => {
  expect(readFileSync(resolve('dist/_redirects'), 'utf8').trim()).toBe('/* /index.html 200');

  await page.goto('/pieces/anything');
  await expect(
    page.getByRole('heading', { name: 'This piece is not in My pieces.' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: '← Home' })).toHaveAttribute('href', '/');

  await page.goto('/reports/attempt-42');
  await expect(
    page.getByRole('heading', { name: 'This attempt is not on this device.' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: '← Home' })).toHaveAttribute('href', '/');

  await page.goto('/missing');
  await expect(page.getByText('Not found')).toBeVisible();
});

test('[T10 AC5, AC6, AC7, AC9] offline package contains only the intended precache and install metadata', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  const serviceWorker = readFileSync(resolve('dist/sw.js'), 'utf8');
  const manifest = JSON.parse(readFileSync(resolve('dist/manifest.webmanifest'), 'utf8')) as {
    display: string;
    icons: Array<{ purpose?: string; sizes: string; src: string; type?: string }>;
    start_url: string;
  };
  const html = readFileSync(resolve('dist/index.html'), 'utf8');

  expect(serviceWorker).toContain('catalog/manifest.json');
  expect(serviceWorker).toMatch(/\.woff2/);
  expect(serviceWorker).toContain('catalog\\/scores');
  expect(serviceWorker).toContain('clientsClaim');
  expect(serviceWorker).not.toContain('audio/salamander');
  expect(serviceWorker).not.toContain('import.worker');
  expect(html).not.toContain('SKIP_WAITING');
  expect(manifest).toMatchObject({ display: 'standalone', start_url: '/' });
  expect(manifest.icons).toEqual([
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ]);
  expect(html).toContain('name="theme-color"');
  expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
  expect(html).toContain('name="apple-mobile-web-app-title" content="Piano Practice Player"');
  expect(html).toContain('rel="apple-touch-icon"');

  await page.goto('/');
  expect(await page.evaluate(() => Boolean(globalThis.crypto?.subtle))).toBe(true);
  expect(
    await page.evaluate(() =>
      document.querySelector('link[rel="manifest"]')?.getAttribute('href'),
    ),
  ).toBe('/manifest.webmanifest');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();

  const session = await page.context().newCDPSession(page);
  const installability = await session.send('Page.getInstallabilityErrors') as {
    installabilityErrors: unknown[];
  };
  expect(installability.installabilityErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('[T05c AC1] header and all UI font weights load locally with external network blocked', async ({ page }) => {
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
    const about = [...document.querySelectorAll('button')].find(
      (element) => element.textContent?.trim() === 'About',
    );
    const dot = document.querySelector('[aria-hidden="true"]');
    const dotStyle = dot ? getComputedStyle(dot) : null;
    const aboutStyle = about ? getComputedStyle(about) : null;
    const wordmarkStyle = wordmark ? getComputedStyle(wordmark) : null;

    return {
      dotHeight: dotStyle?.height,
      dotWidth: dotStyle?.width,
      aboutBorderStyle: aboutStyle?.borderStyle,
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
  expect(headerStyles.aboutBorderStyle).toBe('solid');
  await expect(page.getByText('LOCAL LIBRARY · NO ACCOUNT')).toHaveCount(0);
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
