import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("logged meal and entry deletion require confirmation and remain retryable on failure", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      fileURLToPath(new URL("../../scripts/logged-meal-delete.fixture.tsx", import.meta.url)),
    ],
    { cwd: fileURLToPath(new URL("../..", import.meta.url)), timeout: 20_000 },
  );
  expect({
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }).toEqual({
    exitCode: 0,
    output:
      "Logged meal and entry deletion requires confirmation, preserves failed deletes, and refreshes totals after success.\n",
  });
}, 25_000);
