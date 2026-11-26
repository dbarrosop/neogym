import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("the meal editor shows per-row kcal, named row actions and the delete pre-check", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      fileURLToPath(new URL("../../scripts/meal-editor.fixture.tsx", import.meta.url)),
    ],
    { cwd: fileURLToPath(new URL("../..", import.meta.url)), timeout: 20_000 },
  );
  expect({
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }).toEqual({
    exitCode: 0,
    output: "The meal editor shows per-row kcal, named row actions and blocks plan-used deletes.\n",
  });
}, 30_000);
