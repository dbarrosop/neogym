import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("split indexes never auto-select deleted rows from an invalidated cache", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      fileURLToPath(new URL("../../../scripts/split-index-selection.fixture.tsx", import.meta.url)),
    ],
    { cwd: fileURLToPath(new URL("../../..", import.meta.url)), timeout: 20_000 },
  );
  expect({
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }).toEqual({
    exitCode: 0,
    output:
      "Split indexes block unconfirmed rows, survive failed/paused refetches, and preserve idle-stale empty/widening states.\n",
  });
}, 25_000);
