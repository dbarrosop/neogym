import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("exercise recency excludes skipped rows before limiting and keeps strength/cardio history", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      fileURLToPath(new URL("../../scripts/exercises-recency.fixture.tsx", import.meta.url)),
    ],
    { cwd: fileURLToPath(new URL("../..", import.meta.url)), timeout: 10_000 },
  );
  expect({
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }).toEqual({
    exitCode: 0,
    output: "Exercise recency includes logged strength/cardio only, before the row limit.\n",
  });
}, 15_000);
