import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("Orange stays fill-only and chart lines and labels pass contrast in both themes", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      fileURLToPath(new URL("../../scripts/chart-series-contrast.fixture.tsx", import.meta.url)),
    ],
    { cwd: fileURLToPath(new URL("../..", import.meta.url)), timeout: 20_000 },
  );
  expect({
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }).toEqual({
    exitCode: 0,
    output: "Orange stays fill-only; Body and exercise trend lines and labels pass contrast.\n",
  });
}, 30_000);
