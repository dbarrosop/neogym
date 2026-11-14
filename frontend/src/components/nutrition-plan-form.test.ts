import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("plan editor retimes, merges and moves entries by time slot", () => {
  // Isolate module mocks and DOM globals from the other component tests.
  const result = Bun.spawnSync(
    [
      process.execPath,
      fileURLToPath(new URL("../../scripts/nutrition-plan-form.fixture.tsx", import.meta.url)),
    ],
    { cwd: fileURLToPath(new URL("../..", import.meta.url)), timeout: 20_000 },
  );
  expect({
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }).toEqual({
    exitCode: 0,
    output:
      "Plan editor slots retime and merge on commit, add empty slots and rows, and move entries between times.\n",
  });
}, 25_000);
