import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("nutrition keeps planned actions beside logged intake and advances Today's next slot", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      fileURLToPath(new URL("../../scripts/nutrition-timeline.fixture.tsx", import.meta.url)),
    ],
    { cwd: fileURLToPath(new URL("../..", import.meta.url)), timeout: 20_000 },
  );
  expect({
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }).toEqual({
    exitCode: 0,
    output:
      "Planned slot actions survive same-time intake and re-logging; Today advances with the local clock.\n",
  });
});
