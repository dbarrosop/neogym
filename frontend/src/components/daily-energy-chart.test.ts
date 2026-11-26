import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("Energy trend colours lines by metric, dashes today's partial row and averages full days", () => {
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
      "Energy draws orange active and blue resting lines from zero with today's partial row dashed, full-day averages and nullable tooltips.\n",
  });
}, 30_000);
