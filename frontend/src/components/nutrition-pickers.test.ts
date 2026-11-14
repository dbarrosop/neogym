import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("food and meal pickers are labelled comboboxes with keyboard support", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      fileURLToPath(new URL("../../scripts/nutrition-pickers.fixture.tsx", import.meta.url)),
    ],
    { cwd: fileURLToPath(new URL("../..", import.meta.url)), timeout: 20_000 },
  );
  expect({
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }).toEqual({
    exitCode: 0,
    output: "Food and meal pickers expose combobox, listbox and keyboard behaviour.\n",
  });
}, 30_000);
