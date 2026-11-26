import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("TrendChart follows the chart rules in the rendered SVG", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      fileURLToPath(new URL("../../../scripts/trend-chart.fixture.tsx", import.meta.url)),
    ],
    { cwd: fileURLToPath(new URL("../../..", import.meta.url)), timeout: 30_000 },
  );
  expect({
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }).toEqual({
    exitCode: 0,
    output:
      "Trend charts colour by metric, dot every reading, dash the partial period to an open dot, align dual axes and speak their summaries.\n",
  });
}, 40_000);
