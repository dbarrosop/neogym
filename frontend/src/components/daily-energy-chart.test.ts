import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("Energy chart keeps active/resting colours consistent and legible in both themes", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      fileURLToPath(new URL("../../scripts/daily-energy-chart.fixture.tsx", import.meta.url)),
    ],
    { cwd: fileURLToPath(new URL("../..", import.meta.url)), timeout: 20_000 },
  );
  expect({
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }).toEqual({
    exitCode: 0,
    output:
      "Energy uses an orange active fill and accent resting line with legible labels and nullable tooltips.\n",
  });
}, 30_000);
