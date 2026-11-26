import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { formatCooldown, secondsUntil } from "./otp-code-step";

describe("resend cooldown", () => {
  test("counts whole seconds up so the timer never reads 0:00 early", () => {
    expect(secondsUntil(60_000, 0)).toBe(60);
    expect(secondsUntil(60_000, 17_500)).toBe(43);
    expect(secondsUntil(60_000, 59_001)).toBe(1);
    expect(secondsUntil(60_000, 60_000)).toBe(0);
    expect(secondsUntil(60_000, 90_000)).toBe(0);
  });

  test("formats as m:ss", () => {
    expect(formatCooldown(42)).toBe("0:42");
    expect(formatCooldown(60)).toBe("1:00");
    expect(formatCooldown(5)).toBe("0:05");
    expect(formatCooldown(0)).toBe("0:00");
    expect(formatCooldown(-3)).toBe("0:00");
  });
});

test("the code step verifies once per code, clears rejected codes and resends after a cooldown", () => {
  const result = Bun.spawnSync(
    [
      process.execPath,
      fileURLToPath(new URL("../../scripts/otp-code-step.fixture.tsx", import.meta.url)),
    ],
    { cwd: fileURLToPath(new URL("../..", import.meta.url)), timeout: 20_000 },
  );
  expect({
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  }).toEqual({
    exitCode: 0,
    output:
      "The code step verifies once per code, clears rejected codes and resends after a cooldown.\n",
  });
}, 30_000);
