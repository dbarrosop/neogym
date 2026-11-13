import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

test("form pages move Cancel and Save into sticky bars while dialogs keep inline actions", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      fileURLToPath(new URL("../../../scripts/form-page.fixture.tsx", import.meta.url)),
    ],
    { cwd: fileURLToPath(new URL("../../..", import.meta.url)), timeout: 20_000 },
  );
  expect({
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }).toEqual({
    exitCode: 0,
    output: "Form pages move Cancel and Save into sticky bars; dialogs keep inline actions.\n",
  });
}, 30_000);
