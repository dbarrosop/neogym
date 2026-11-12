import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("rest timer links and actions survive navigation and storage restoration", () => {
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
      "Rest timers link to their originating session, keep actions separate, and restore legacy state.\n",
  });
}, 30_000);
