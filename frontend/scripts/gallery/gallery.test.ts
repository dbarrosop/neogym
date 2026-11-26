import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { buildSchema, parse, validate } from "graphql";
import { AREAS } from "../../src/lib/navigation";
import {
  captureOrigin,
  LOCAL_AUTH,
  LOCAL_GRAPHQL,
  LOCAL_MAIL,
  LOCAL_STORAGE,
  newOTP,
  otpFromMail,
} from "./backend";
import catalog from "./catalog.json";
import { recordedPath, upsert, type WorkflowRecord } from "./driver";
import { dateBefore, exerciseFixtures, foodFixtures, SEED_DOCUMENTS } from "./fixtures";
import { CHECK_DOCUMENTS } from "./workflows";

const schema = buildSchema(
  readFileSync(
    new URL("../../../backend/schemas/schema.nhost.user.graphqls", import.meta.url),
    "utf8",
  ),
);

// Resolve the canonical SDL independently of the caller's working directory.

describe("frontend gallery safety and registry", () => {
  test("accepts only bare local HTTP frontend origins", () => {
    expect(captureOrigin("http://127.0.0.1:5174")).toBe("http://127.0.0.1:5174");
    expect(captureOrigin("http://localhost:5174/")).toBe("http://localhost:5174");
    for (const value of [
      "https://neogym.nhost.app",
      "http://localhost.evil.test",
      "http://user:secret@localhost:5174",
      "http://localhost:5174/path",
      "http://localhost:5174/?token=secret",
      "file:///tmp/index.html",
      "invalid",
    ]) {
      expect(() => captureOrigin(value)).toThrow();
    }
  });

  test("reads only the OTP element, not a six-digit CSS color", () => {
    const body =
      '<h1 style="color: #484848">One-time Password</h1><p style="color: #0052cd">123456</p>';
    expect(otpFromMail("Sign in", body)).toBe("123456");
    expect(otpFromMail("Sign in", body.replace("123456", "123=\r\n456"))).toBe("123456");
    expect(otpFromMail("Sign in", '<h1 style="color: #484848">No code</h1>')).toBeNull();
  });

  test("rejects stale codes when the same fictional address signs in again", () => {
    function mail(id: string, code: string) {
      return { ID: id, To: [], Content: { Headers: {}, Body: `<p>${code}</p>` } };
    }
    const previous = new Set(["old"]);
    const old = mail("old", "222222");
    expect(newOTP([old], previous)).toBeNull();
    expect(newOTP([old, mail("fresh", "333333")], previous)).toBe("333333");
  });

  test("walkthrough paths preserve the route but not freshly allocated IDs", () => {
    expect(recordedPath("/nutrition/meals/f26ac88d-4dcd-48e8-a0ae-b4248918bc1c/edit")).toBe(
      "/nutrition/meals/:fixture-id/edit",
    );
    expect(recordedPath("/nutrition/log/2025-01-15")).toBe("/nutrition/log/2025-01-15");
  });

  test("backend endpoints are fixed to the CLI's local environment", () => {
    for (const endpoint of [LOCAL_AUTH, LOCAL_GRAPHQL, LOCAL_MAIL, LOCAL_STORAGE]) {
      expect(endpoint).toStartWith("https://local.");
      expect(endpoint).toContain(".local.nhost.run");
    }
  });

  test("registers the real web section roots in navigation order and both layouts", () => {
    const paths = AREAS.flatMap((area) =>
      area.sections.length > 0 ? area.sections.map((section) => section.to) : [area.to],
    );
    expect(catalog.roots.map((root) => root.path)).toEqual(paths);
    expect(catalog.profiles.desktop.width).toBeGreaterThanOrEqual(1100);
    expect(catalog.profiles.mobile.width).toBeLessThan(768);
  });

  test("fixture dates cross month and year boundaries in UTC", () => {
    expect(dateBefore("2025-01-01", 1)).toBe("2024-12-31");
    expect(dateBefore("2024-03-01", 1)).toBe("2024-02-29");
  });

  test("exercises are private nested strength inserts, with no discriminator override", () => {
    for (const exercise of exerciseFixtures()) {
      expect(exercise.category).toBe("strength");
      expect(exercise.strength.data.mechanic).toBe("compound");
      expect(exercise).not.toHaveProperty("kind");
      expect(exercise).not.toHaveProperty("isPublic");
      expect(exercise).not.toHaveProperty("userId");
    }
    for (const food of foodFixtures()) {
      expect(food).not.toHaveProperty("isPublic");
      expect(food.sugarPer100g).toBeGreaterThanOrEqual(0);
    }
  });

  test("upserts preserve frame/workflow order rather than appending duplicates", () => {
    const records: WorkflowRecord[] = [
      { id: "first", title: "Old", status: "failed", steps: [], checks: [] },
      { id: "second", title: "Second", status: "passed", steps: [], checks: [] },
    ];
    upsert(records, { id: "first", title: "New", status: "passed", steps: [], checks: [] });
    expect(records.map((record) => record.id)).toEqual(["first", "second"]);
    expect(records[0]?.title).toBe("New");
  });
});

for (const [name, document] of [
  ...Object.entries(SEED_DOCUMENTS),
  ...Object.entries(CHECK_DOCUMENTS),
]) {
  test(`gallery ${name} document is valid against the canonical user-role SDL`, () => {
    expect(validate(schema, parse(document)).map((error) => error.message)).toEqual([]);
  });
}

test("shared gallery and iOS renderer tooling checks", () => {
  const root = new URL("../../..", import.meta.url).pathname;
  const result = Bun.spawnSync(
    ["python3", "-m", "unittest", "discover", "-s", "tools", "-p", "test_web_gallery.py", "-q"],
    { cwd: root, stdout: "pipe", stderr: "pipe", timeout: 30_000 },
  );
  expect({ exitCode: result.exitCode, stderr: result.stderr.toString() }).toEqual({
    exitCode: 0,
    stderr: expect.stringContaining("OK"),
  });
}, 40_000);
