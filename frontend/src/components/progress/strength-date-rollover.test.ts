import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

for (const timeZone of ["America/Los_Angeles", "Europe/Madrid"]) {
  test(`Strength updates week and recent-exercise windows across local dates in ${timeZone}`, () => {
    const result = Bun.spawnSync(
      [
        process.execPath,
        fileURLToPath(
          new URL("../../../scripts/strength-date-rollover.fixture.tsx", import.meta.url),
        ),
      ],
      {
        cwd: fileURLToPath(new URL("../../..", import.meta.url)),
        env: { ...process.env, TZ: timeZone },
        timeout: 20_000,
      },
    );
    expect({
      exitCode: result.exitCode,
      output: result.stdout.toString() + result.stderr.toString(),
    }).toEqual({
      exitCode: 0,
      output: "Strength query, weekly buckets and ten-date exercise window advance together.\n",
    });
  }, 30_000);
}
