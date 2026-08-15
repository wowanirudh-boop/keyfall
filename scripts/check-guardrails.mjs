#!/usr/bin/env node
/**
 * Machine-checks the hard rules in AGENTS.md.
 * Exit 0 = clean, 1 = violations. Wired to `npm run check:guardrails`.
 *
 * Design note: every rule here corresponds to a defect class found in review.
 * Test files, fixtures and the design layer are exempted from the content rules
 * on purpose — several acceptance criteria require tests that assert on exactly
 * the strings these rules ban (e.g. "the grader contains no Date.now").
 * A guardrail that cries wolf gets disabled, and then it protects nothing.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const TOKENS_REL = 'src/design/tokens.ts';
/** Colour literals and design constants are permitted only in the design layer. */
const DESIGN_DIR = 'src/design/';
const READONLY = ['PRD.md', 'design_handoff_piano_practice_player'];
const SCANNED = /\.(ts|tsx|js|jsx|mjs|cjs|css|scss)$/;
/** Tests and fixtures legitimately contain the strings the content rules ban. */
const TEST_LIKE = /(\.(test|spec)\.[jt]sx?$)|(^|\/)(__tests__|__fixtures__|__mocks__|e2e|tests|testing)\//;

const violations = [];
const fail = (file, line, rule, detail) => violations.push({ file, line, rule, detail });

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', '.git', 'coverage', 'test-results', 'playwright-report'].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SCANNED.test(name)) out.push(full);
  }
  return out;
}

const toPosix = (p) => p.split(sep).join('/');

// ------------------------------------------------------------------ rules

const RULES = [
  {
    id: 'prototype-runtime',
    // AGENTS.md #2 — never port the design prototype's runtime.
    re: /\bDCLogic\b|require\(['"].*support\.js|from\s+['"].*support\.js|data-dc-script|<\/?x-dc|<sc-for\b/,
    msg: 'imports or references the design prototype runtime',
  },
  {
    id: 'prototype-scaffolding',
    // AGENTS.md #3 — the simulate buttons never ship.
    re: /\bsimulateBadFile\b|\bsimulateGoodFile\b|['"]simulate:\s/,
    msg: 'ships prototype-only scaffolding',
  },
  {
    id: 'states-strip',
    // AGENTS.md #3 — the prototype's bottom STATES strip and its shell reservation.
    re: /padding-?[Bb]ottom:\s*['"]?42px/,
    msg: 'reserves space for the prototype-only STATES strip',
  },
  {
    id: 'stale-product-name',
    re: /\bKeyfall\b/i,
    msg: 'references the wrong product name (this product is "Piano Practice Player")',
  },
  {
    id: 'ascii-sharp-label',
    // AGENTS.md #9 — key labels use U+266F.
    re: /['"`][A-G]#-?\d['"`]/,
    msg: 'uses ASCII "#" in a key label; sharps must be U+266F (♯)',
  },
  {
    id: 'nondeterministic-grading',
    // AGENTS.md #8 — the grader is a pure function of its event log.
    // Scoped by path to the modules that compute verdicts and reports. Storing
    // an attempt's createdAt in a repository is legitimate and stays out of scope.
    re: /Math\.random\s*\(|Date\.now\s*\(|new Date\s*\(|performance\.now\s*\(|crypto\.randomUUID\s*\(/,
    msg: 'uses a nondeterministic source inside the grader',
    // Scoped to src/grading/ only. Report *aggregation* must be pure too, but
    // src/report/ also renders the attempt history's relative dates ("TODAY ·
    // 18:42"), which legitimately reads the clock — so purity there is enforced
    // by tests, not by this rule. See AGENTS.md #8.
    only: /^src\/grad(ing|er)\//,
  },
  {
    id: 'banned-dependency',
    // AGENTS.md #6. Catches static import, dynamic import, require and CSS @import.
    // Tailwind is permitted (D-015); it is arbitrary colour values that are not.
    re: /(?:from\s+|import\s*\(\s*|require\s*\(\s*|@import\s+)['"](react-icons|lucide-react|@mui\/|antd|bootstrap|redux|@reduxjs\/|zustand|jotai|recoil|recharts|chart\.js|victory|d3|styled-components|@emotion\/)/,
    msg: 'imports a dependency banned by AGENTS.md #6',
  },
  {
    id: 'vinext-residue',
    // D-001 dropped Vinext/RSC. These would silently reintroduce it.
    re: /from\s+['"]vinext|['"]use server['"]|next\/(navigation|router|link|image|font)/,
    msg: 'reintroduces Vinext / Next / RSC, which D-001 removed',
  },
  {
    id: 'pwa-icon-import',
    // D-035: install icons are OS packaging and must never enter the app UI.
    re: /['"`](?:\/icons\/|(?:\.\.\/)*public\/icons\/)/,
    msg: 'references a packaging-only PWA icon from application source',
  },
];

/**
 * Tailwind arbitrary COLOUR values — `bg-[#101216]`, `text-[rgb(…)]`.
 * These are raw colours wearing utility-class syntax (D-015). Arbitrary values
 * for sizes the handoff specifies (`p-[7px_11px]`) are fine and not matched.
 */
const TW_ARBITRARY_COLOUR = /-\[(#[0-9a-fA-F]{3,8}|rgba?\([^\]]*\)|hsla?\([^\]]*\))\]/;

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const RGB = /\brgba?\s*\(/;
/** Strips string-free comment text so a rule cannot trip on prose. */
const isCommentLine = (l) => /^\s*(\/\/|\*|\/\*|<!--)/.test(l);
/** A trailing comment after code — strip it before the colour check. */
const stripTrailingComment = (l) => l.replace(/\/\/.*$/, '');

// ------------------------------------------------------------------ scan

const files = walk(SRC);

for (const abs of files) {
  const rel = relative(ROOT, abs);
  const posix = toPosix(rel);
  const inDesignLayer = posix.startsWith(DESIGN_DIR);
  const isTestLike = TEST_LIKE.test(posix);
  const lines = readFileSync(abs, 'utf8').split(/\r?\n/);

  lines.forEach((raw, i) => {
    const n = i + 1;
    if (isCommentLine(raw)) return;      // prose may reference anything
    if (isTestLike) return;              // tests assert on the banned strings by design

    for (const rule of RULES) {
      if (rule.only && !rule.only.test(posix)) continue;
      if (rule.re.test(raw)) fail(rel, n, rule.id, rule.msg);
    }

    // AGENTS.md #4 — colours live in the design layer and nowhere else.
    // URL fragments and DOM id selectors can look like hex ("#abc"); skip them.
    if (!inDesignLayer && TW_ARBITRARY_COLOUR.test(raw)) {
      fail(rel, n, 'raw-colour',
        `Tailwind arbitrary colour ${raw.match(TW_ARBITRARY_COLOUR)[0]} — use a token utility (bg-card, text-hand-right) from the @theme block (D-014/D-015)`);
    }
    if (!inDesignLayer && !/href\s*=|xlink:href|getElementById|querySelector/.test(raw)) {
      const code = stripTrailingComment(raw);
      if (/(?<![\w$])#[0-9a-fA-F]{3,8}\b/.test(code) && !/this\.#|#\{/.test(code)) {
        fail(rel, n, 'raw-colour', `raw hex colour ${code.match(HEX)?.[0]} — import from src/design/tokens.ts`);
      } else if (RGB.test(code)) {
        fail(rel, n, 'raw-colour', 'raw rgb()/rgba() colour — import from src/design/tokens.ts');
      }
    }
  });
}

// --------------------------------------------- tokens contract (always runs)

const tokensPath = join(ROOT, TOKENS_REL);
if (!existsSync(tokensPath)) {
  fail(TOKENS_REL, 0, 'missing-tokens', 'src/design/tokens.ts is missing — it is authoritative and pre-seeded');
} else {
  const src = readFileSync(tokensPath, 'utf8');
  const required = ['color', 'alpha', 'space', 'type', 'radius', 'shadow', 'motion',
                    'font', 'keyLabelSize', 'tunables', 'keyboard', 'waterfall', 'report', 'grading'];
  for (const name of required) {
    if (!new RegExp(`export const ${name}\\b`).test(src)) {
      fail(TOKENS_REL, 0, 'tokens-contract', `export "${name}" was removed from tokens.ts`);
    }
  }
  // Values the design pins exactly. `(?![\d.])` stops 3 from matching in 3.5.
  const pinned = [
    [/lookaheadSeconds:\s*3(?![\d.])/, 'tunables.lookaheadSeconds must be 3'],
    [/highlightLeadTimeSeconds:\s*1(\.0)?(?![\d.])/, 'tunables.highlightLeadTimeSeconds must be 1.0'],
    [/bucketCount:\s*26(?![\d.])/, 'report.bucketCount must be 26'],
    [/whiteCount:\s*52(?![\d.])/, 'keyboard.whiteCount must be 52'],
    [/blackCount:\s*36(?![\d.])/, 'keyboard.blackCount must be 36'],
    [/toleranceMs:\s*300(?![\d.])/, 'grading.toleranceMs must be 300'],
    [/candidateWindowMs:\s*900(?![\d.])/, 'grading.candidateWindowMs must be 900'],
    [/midiLow:\s*21(?![\d.])/, 'keyboard.midiLow must be 21'],
    [/midiHigh:\s*108(?![\d.])/, 'keyboard.midiHigh must be 108'],
  ];
  for (const [re, msg] of pinned) {
    if (!re.test(src)) fail(TOKENS_REL, 0, 'tokens-pinned', msg);
  }
}

for (const p of READONLY) {
  if (!existsSync(join(ROOT, p))) {
    fail(p, 0, 'missing-reference', 'read-only reference material is missing');
  }
}

// AGENTS.md #6 — banned packages must not appear in the manifest either, not
// just in import statements.
const pkgPath = join(ROOT, 'package.json');
if (existsSync(pkgPath)) {
  // Tailwind is intentionally absent from this list — it stays (D-015).
  const BANNED_PKGS = /^(react-icons|lucide-react|antd|bootstrap|redux|zustand|jotai|recoil|recharts|chart\.js|victory|d3|styled-components|vinext|next|@emotion\/.*|@mui\/.*|@reduxjs\/.*)$/;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    for (const field of ['dependencies', 'devDependencies']) {
      for (const name of Object.keys(pkg[field] ?? {})) {
        if (BANNED_PKGS.test(name)) {
          fail('package.json', 0, 'banned-dependency', `"${name}" is banned by AGENTS.md #6`);
        }
      }
    }
  } catch {
    fail('package.json', 0, 'invalid-manifest', 'package.json is not valid JSON');
  }
}

// ------------------------------------------------------------------ report

if (violations.length === 0) {
  console.log(`check:guardrails — clean (${files.length} source file${files.length === 1 ? '' : 's'} scanned).`);
  process.exit(0);
}

const byRule = violations.reduce((m, v) => ((m[v.rule] ??= []).push(v), m), {});
console.error(`\ncheck:guardrails — ${violations.length} violation(s):\n`);
for (const [rule, list] of Object.entries(byRule)) {
  console.error(`  [${rule}] ${list[0].detail}`);
  for (const v of list.slice(0, 12)) console.error(`      ${v.file}${v.line ? ':' + v.line : ''}`);
  if (list.length > 12) console.error(`      … and ${list.length - 12} more`);
  console.error('');
}
console.error('See AGENTS.md "Hard rules".\n');
process.exit(1);
