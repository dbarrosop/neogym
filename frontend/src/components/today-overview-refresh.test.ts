import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("Today revalidates cached cards and retries initial and background errors", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      fileURLToPath(new URL("../../scripts/today-overview-refresh.fixture.tsx", import.meta.url)),
    ],
    { cwd: fileURLToPath(new URL("../..", import.meta.url)), timeout: 20_000 },
  );
  expect({
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }).toEqual({
    exitCode: 0,
    output: "Today revalidates cached cards and recovers from initial and background errors.\n",
  });
}, 30_000);
