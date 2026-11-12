import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("daily intake keeps owner-scoped estimates and live food-edit totals in one QueryClient", () => {
  // Isolate module mocks and DOM globals from the other component tests.
  const result = Bun.spawnSync(
    [
      process.execPath,
      fileURLToPath(
        new URL("../../scripts/daily-intake-account-isolation.fixture.tsx", import.meta.url),
      ),
    ],
    { cwd: fileURLToPath(new URL("../..", import.meta.url)), timeout: 20_000 },
  );
  expect({
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }).toEqual({
    exitCode: 0,
    output:
      "Daily intake isolates accounts across sign-out and delayed refetches; food-edit invalidation and exact ensureDay lookup remain live.\n",
  });
});
