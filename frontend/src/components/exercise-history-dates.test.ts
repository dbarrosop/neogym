import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("strength history disambiguates other years without expanding current-year dates", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      fileURLToPath(new URL("../../scripts/exercise-history-dates.fixture.tsx", import.meta.url)),
    ],
    {
      cwd: fileURLToPath(new URL("../..", import.meta.url)),
      env: { ...process.env, TZ: "America/Los_Angeles" },
      timeout: 10_000,
    },
  );
  expect({
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }).toEqual({
    exitCode: 0,
    output:
      "Strength history shows other years and keeps current-year dates compact in local time.\n",
  });
}, 15_000);
