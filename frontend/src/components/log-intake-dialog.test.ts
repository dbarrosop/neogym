import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("log intake dialog names its pickers, previews macros and logs food", () => {
  // Isolate module mocks and DOM globals from the other component tests.
  const result = Bun.spawnSync(
    [
      process.execPath,
      fileURLToPath(new URL("../../scripts/log-intake-dialog.fixture.tsx", import.meta.url)),
    ],
    { cwd: fileURLToPath(new URL("../..", import.meta.url)), timeout: 20_000 },
  );
  expect({
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }).toEqual({
    exitCode: 0,
    output: "Log intake dialog names its pickers, previews macros and logs food or a meal.\n",
  });
}, 25_000);
