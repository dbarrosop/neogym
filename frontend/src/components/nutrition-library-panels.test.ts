import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("Foods and Meals show a selected-item panel from 1100 px", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      fileURLToPath(new URL("../../scripts/nutrition-library-panels.fixture.tsx", import.meta.url)),
    ],
    { cwd: fileURLToPath(new URL("../..", import.meta.url)), timeout: 20_000 },
  );
  expect({
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }).toEqual({
    exitCode: 0,
    output: "Foods and Meals select rows into a side panel from 1100 px and link below it.\n",
  });
}, 30_000);
