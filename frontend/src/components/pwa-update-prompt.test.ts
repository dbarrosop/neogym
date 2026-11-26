import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("dismissing an update rearms the prompt for a later waiting worker", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      fileURLToPath(new URL("../../scripts/pwa-update-prompt.fixture.tsx", import.meta.url)),
    ],
    { cwd: fileURLToPath(new URL("../..", import.meta.url)), timeout: 10_000 },
  );
  expect({
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }).toEqual({
    exitCode: 0,
    output: "Dismissing an update still lets a later waiting worker offer Reload.\n",
  });
}, 15_000);
