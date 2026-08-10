import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe('foundation contract', () => {
  it('provides the complete check command surface', () => {
    const scripts = JSON.parse(read('package.json')).scripts;

    expect(scripts).toMatchObject({
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview',
      test: 'vitest run',
      'test:e2e': 'playwright test',
      'check:types': 'tsc --noEmit',
      'check:guardrails': 'node scripts/check-guardrails.mjs',
      check: 'npm run check:types && npm run check:guardrails && npm test',
    });
  });

  it('is a plain React SPA without the rejected server stack', () => {
    const packageJson = JSON.parse(read('package.json'));
    const packages = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const legacyPaths = [
      'app/page.tsx',
      'app/layout.tsx',
      'next.config.ts',
      'next-env.d.ts',
      'tests/rendered-html.test.mjs',
      'worker/index.ts',
    ];

    expect(packageJson.name).toBe('piano-practice-player');
    expect(packages).not.toHaveProperty('vinext');
    expect(packages).not.toHaveProperty('@vitejs/plugin-rsc');
    expect(packages).not.toHaveProperty('react-server-dom-webpack');
    expect(legacyPaths.every((path) => !existsSync(join(root, path)))).toBe(true);
    expect(read('vite.config.ts')).toContain('appType: "spa"');
    expect(read('index.html')).toContain('/src/main.tsx');
  });

  it('loads all required font weights from non-empty local WOFF2 files', () => {
    const css = read('src/design/globals.css');
    const fontFiles = [
      'src/assets/fonts/space-grotesk-latin.woff2',
      'src/assets/fonts/ibm-plex-mono-400-latin.woff2',
      'src/assets/fonts/ibm-plex-mono-500-latin.woff2',
    ];

    expect(css).not.toMatch(/https?:\/\//);
    expect(css.match(/font-family: "Space Grotesk"/g)).toHaveLength(3);
    expect(css).toMatch(/font-weight: 400/);
    expect(css).toMatch(/font-weight: 500/);
    expect(css).toMatch(/font-weight: 700/);
    expect(css.match(/font-family: "IBM Plex Mono"/g)).toHaveLength(2);
    expect(fontFiles.every((path) => statSync(join(root, path)).size > 0)).toBe(true);
  });

  it('contains no raw component colours or rejected palette variables', () => {
    const productionFiles = walk(join(root, 'src')).filter((path) => {
      const rel = relative(root, path).replaceAll('\\', '/');
      return /\.(css|ts|tsx)$/.test(rel) && !/\.(test|spec)\.[jt]sx?$/.test(rel);
    });
    const outsideDesign = productionFiles.filter(
      (path) => !relative(root, path).replaceAll('\\', '/').startsWith('src/design/'),
    );
    const productionText = productionFiles.map((path) => readFileSync(path, 'utf8')).join('\n');
    const componentText = outsideDesign.map((path) => readFileSync(path, 'utf8')).join('\n');

    expect(componentText).not.toMatch(/#[0-9a-f]{3,8}\b|\brgba?\s*\(|-\[(#[0-9a-f]{3,8}|rgba?\()/i);
    expect(productionText).not.toMatch(/--(paper|paper-deep|ink|muted|coral|cyan|navy)\b/i);
  });

  it('uses the current product name throughout shipped source and metadata', () => {
    const sourceText = walk(join(root, 'src'))
      .filter((path) => !/\.(test|spec)\.[jt]sx?$/.test(path))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');

    expect(`${sourceText}\n${read('package.json')}`).not.toMatch(/keyfall/i);
    expect(read('index.html')).toContain('<title>Piano Practice Player</title>');
  });

  it('ignores all generated and dependency directories', () => {
    const gitignore = read('.gitignore');

    for (const pattern of ['/node_modules', '/dist/', '/.next/', '/.vinext/', '/build/']) {
      expect(gitignore).toContain(pattern);
    }
  });
});
