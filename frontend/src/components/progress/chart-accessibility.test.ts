import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("Progress charts announce endpoint trends without hiding keyboard access", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      fileURLToPath(
        new URL("../../../scripts/progress-chart-accessibility.fixture.tsx", import.meta.url),
      ),
    ],
    { cwd: fileURLToPath(new URL("../../..", import.meta.url)), timeout: 20_000 },
  );
  expect({
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }).toEqual({
    exitCode: 0,
    output: "All four Progress sections expose endpoint trends and retain chart keyboard access.\n",
  });
}, 30_000);
