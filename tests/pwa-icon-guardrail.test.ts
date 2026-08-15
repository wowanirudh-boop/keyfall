import { rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, expect, it } from "vitest";

const probe = resolve("src/__pwa_icon_guardrail_probe__.ts");

afterEach(() => rmSync(probe, { force: true }));

it("[T10 AC10] rejects any source reference to the packaging-only PWA icons", () => {
  writeFileSync(probe, 'export const forbiddenIcon = "/icons/icon-192.png";\n');

  const result = spawnSync(process.execPath, ["scripts/check-guardrails.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  expect(result.status).toBe(1);
  expect(result.stderr).toContain("[pwa-icon-import]");
});
