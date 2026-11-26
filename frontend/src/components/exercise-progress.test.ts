import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("exercise progress charts volume and Est. 1RM per session for the chosen period", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      fileURLToPath(new URL("../../scripts/exercise-progress.fixture.tsx", import.meta.url)),
    ],
    {
      cwd: fileURLToPath(new URL("../..", import.meta.url)),
      env: { ...process.env, TZ: "Europe/Stockholm" },
      timeout: 10_000,
    },
  );
  expect({
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }).toEqual({
    exitCode: 0,
    output: "Exercise progress charts volume and Est. 1RM per session for the chosen period.\n",
  });
}, 15_000);
