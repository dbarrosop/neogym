// Isolate Playwright and checkout-lock mocks from the rest of the Bun suite.
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type { Manifest } from "./driver";
import { galleryDate, galleryPostgres } from "./seed";

const repo = resolve(import.meta.dir, "../../..");
const published = resolve(repo, "docs/web");
const output = await mkdtemp(resolve(tmpdir(), "neogym-gallery-preflight-"));
const manifestPath = resolve(output, "capture-manifest.json");
const validate = () =>
  Bun.spawnSync(["python3", "tools/web-gallery.py", "validate", "--output", output], { cwd: repo });

try {
  const manifest = JSON.parse(
    await readFile(resolve(published, "capture-manifest.json"), "utf8"),
  ) as Manifest;
  manifest.captureProfile["platform"] = process.platform;
  for (const frame of manifest.screenshots) {
    frame.captureProfile = manifest.captureProfile;
  }
  await cp(resolve(published, "screenshots"), resolve(output, "screenshots"), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest));
  assert.equal(validate().exitCode, 0, "The old evidence passes publication before the attempt");

  let browserClosed = false;
  mock.module("@playwright/test", () => ({
    chromium: {
      launch: () => ({
        version: () => manifest.captureProfile["browser"],
        close: () => {
          browserClosed = true;
        },
      }),
    },
    expect: undefined,
    request: {
      newContext: () => assert.fail("Do not open a request context if DB discovery fails"),
    },
  }));
  let unlocked = false;
  mock.module("./seed", () => ({
    galleryDate,
    galleryPostgres,
    lockGallery: () => () => {
      unlocked = true;
    },
    seedGalleryAccount: () => assert.fail("Do not seed if DB discovery fails"),
  }));
  // The real discovery rejects this before running Docker or reaching a database.
  process.env["DOCKER_CONTEXT"] = "";
  process.env["DOCKER_HOST"] = "tcp://127.0.0.1:2375";
  process.argv = process.argv.slice(0, 2).concat("--output", output, "--group", "roots");
  const { main } = await import("./capture");
  await assert.rejects(main, /Gallery fixtures require a local Docker socket/);
  assert(browserClosed);
  assert(unlocked);

  const after = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
  assert.equal(after.lastRun?.status, "failed");
  assert.equal(after.lastRun?.group, "roots");
  assert.deepEqual(after.screenshots, manifest.screenshots);
  assert.deepEqual(after.workflows, manifest.workflows);
  const result = validate();
  assert.notEqual(result.exitCode, 0);
  assert.match(result.stderr.toString(), /latest capture attempt did not finish successfully/);
} finally {
  await rm(output, { recursive: true, force: true });
}
