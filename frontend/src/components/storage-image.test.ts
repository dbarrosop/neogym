import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("exercise images honour reduced motion and fall back without a photo", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      fileURLToPath(new URL("../../scripts/storage-image.fixture.tsx", import.meta.url)),
    ],
    { cwd: fileURLToPath(new URL("../..", import.meta.url)), timeout: 20_000 },
  );
  expect({
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }).toEqual({
    exitCode: 0,
    output: "Exercise images honour reduced motion, pager dots and thumbnail fallback.\n",
  });
}, 30_000);
