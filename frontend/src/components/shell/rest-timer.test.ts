import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("rest timers preserve navigation and same-owner restores without leaking across accounts", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      fileURLToPath(new URL("../../../scripts/rest-timer.fixture.tsx", import.meta.url)),
    ],
    { cwd: fileURLToPath(new URL("../../..", import.meta.url)), timeout: 20_000 },
  );
  expect({
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }).toEqual({
    exitCode: 0,
    output:
      "Rest timers preserve session links and same-owner restores, and isolate account changes and expiry.\n",
  });
}, 30_000);
