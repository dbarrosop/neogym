import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("session logging refreshes Progress and uses earlier logged same-workout history", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      fileURLToPath(new URL("../../scripts/session-logging.fixture.tsx", import.meta.url)),
    ],
    { cwd: fileURLToPath(new URL("../..", import.meta.url)), timeout: 20_000 },
  );
  expect({
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }).toEqual({
    exitCode: 0,
    output:
      "Session logging refreshes Progress and handles missing history and earlier logged same-workout references.\n",
  });
}, 30_000);
