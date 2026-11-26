import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("Progress preserves loaded rows and trends through paging and refetch errors", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      fileURLToPath(
        new URL("../../../scripts/progress-history-retry.fixture.tsx", import.meta.url),
      ),
    ],
    { cwd: fileURLToPath(new URL("../../..", import.meta.url)), timeout: 20_000 },
  );
  expect({
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }).toEqual({
    exitCode: 0,
    output: "Progress preserves loaded rows and trends through paging and refetch errors.\n",
  });
}, 30_000);
