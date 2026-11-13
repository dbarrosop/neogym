import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("full-page Body/Energy writes refresh the recent Today overview after success", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      fileURLToPath(
        new URL("../../../scripts/progress-today-invalidation.fixture.tsx", import.meta.url),
      ),
    ],
    { cwd: fileURLToPath(new URL("../../..", import.meta.url)), timeout: 20_000 },
  );
  expect({
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }).toEqual({
    exitCode: 0,
    output: "Full-page Body/Energy create, edit and delete invalidate Today only after success.\n",
  });
}, 30_000);
