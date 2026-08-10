import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Keyfall prototype", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Keyfall/);
  assert.match(html, /See the music/);
  assert.match(html, /My pieces/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("keeps the prototype frontend-only", async () => {
  const [page, packageJson, hosting] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /function Player/);
  assert.match(page, /type Screen = "home" \| "player"/);
  assert.doesNotMatch(packageJson, /drizzle|sqlite/);
  assert.match(hosting, /"d1": null/);
  assert.match(hosting, /"r2": null/);
});
