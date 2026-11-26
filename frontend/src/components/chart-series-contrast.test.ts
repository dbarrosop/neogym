import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("Body, Energy and Calories charts colour series by metric and pass contrast in both themes", () => {
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
    output:
      "Body, Energy and Calories charts colour series by metric in Chart 1/2 with legible labels; no grey series.\n",
  });
}, 30_000);
