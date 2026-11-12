import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("session logging stays open without history and uses real reference counts to advance", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      fileURLToPath(new URL("../../scripts/session-logging.fixture.tsx", import.meta.url)),
    ],
    { cwd: fileURLToPath(new URL("../..", import.meta.url)), timeout: 20_000 },
  );
  expect({
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }).toEqual({
    exitCode: 0,
    output: "Session logging stays open without history and advances only at a reference count.\n",
  });
}, 30_000);
