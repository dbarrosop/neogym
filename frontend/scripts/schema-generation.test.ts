import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let root = "";

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "neogym-schema-"));
  mkdirSync(join(root, "backend"));
  mkdirSync(join(root, "frontend"));
  mkdirSync(join(root, "bin"));
  copyFileSync(new URL("../../backend/gen.sh", import.meta.url), join(root, "backend/gen.sh"));
  writeFileSync(
    join(root, "bin/nhost"),
    `#!/bin/sh
set -eu
printf '<%s>' "$@" >> "$CALL_LOG"
printf '\\n' >> "$CALL_LOG"
operation="$2"
shift 2
role=""
output=""
while [ "$#" -gt 0 ]; do
    case "$1" in
        --role) role="$2" ;;
        -o) output="$2" ;;
    esac
    shift 2
done
if [ "\${FAIL_COMMAND:-}" = "$operation" ]; then
    exit 7
fi
case "$operation" in
    dump) printf 'type Query { %s: String }\\n' "$role" > "$output" ;;
    diff) printf 'Schemas are identical\\n' ;;
    *) exit 8 ;;
esac
`,
    { mode: 0o755 },
  );
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function generate(overrides: Record<string, string> = {}) {
  return Bun.spawnSync(["sh", "../backend/gen.sh"], {
    cwd: join(root, "frontend"),
    env: {
      ...process.env,
      PATH: `${join(root, "bin")}:${process.env["PATH"]}`,
      CALL_LOG: join(root, "calls"),
      NHOST_SUBDOMAIN: "local",
      NHOST_REGION: "local",
      NHOST_ADMIN_SECRET: "nhost-admin-secret",
      DST_PATH: join(root, "backend/schemas"),
      FAIL_COMMAND: "",
      ...overrides,
    },
  });
}

const roles = ["admin", "user", "public"];
const expectedFiles = roles
  .flatMap((role) => [
    `schema.hasura.${role}.graphqls`,
    `schema.nhost.${role}.graphqls`,
    `schema.${role}.diff`,
  ])
  .sort();

describe("Nhost schema generation", () => {
  test("dumps both endpoints and diffs only supported roles, independent of cwd", () => {
    // An empty override exercises the script-relative default output directory.
    expect(generate({ DST_PATH: "" }).exitCode).toBe(0);
    expect(readdirSync(join(root, "backend/schemas")).sort()).toEqual(expectedFiles);
    expect(readdirSync(join(root, "frontend"))).toEqual([]);

    const calls = readFileSync(join(root, "calls"), "utf8").trim().split("\n");
    expect(calls).toHaveLength(9);
    for (const role of roles) {
      for (const service of ["hasura", "graphql"]) {
        expect(
          calls.some(
            (call) =>
              call.startsWith(
                `<schema><dump><--role><${role}><--admin-secret><nhost-admin-secret>`,
              ) && call.includes(`<-u><https://local.${service}.local.nhost.run/v1/graphql>`),
          ),
        ).toBe(true);
      }
      expect(readFileSync(join(root, `backend/schemas/schema.${role}.diff`), "utf8")).toBe(
        "Schemas are identical\n",
      );
    }
    const diffs = calls.filter((call) => call.startsWith("<schema><diff>"));
    expect(diffs).toHaveLength(3);
    for (const role of roles) {
      expect(
        diffs.some(
          (call) =>
            call.includes(`/schema.hasura.${role}.graphqls>`) &&
            call.includes(`/schema.nhost.${role}.graphqls>`),
        ),
      ).toBe(true);
    }
  });

  test("supports explicit environment overrides and paths with spaces", () => {
    const destination = join(root, "custom schemas");
    expect(
      generate({
        DST_PATH: destination,
        NHOST_SUBDOMAIN: "example",
        NHOST_REGION: "eu-central-1",
        NHOST_ADMIN_SECRET: "test secret with spaces",
      }).exitCode,
    ).toBe(0);
    expect(readdirSync(destination).sort()).toEqual(expectedFiles);
    const calls = readFileSync(join(root, "calls"), "utf8");
    expect(calls).toContain("<--admin-secret><test secret with spaces>");
    expect(calls).toContain("<https://example.hasura.eu-central-1.nhost.run/v1/graphql>");
    expect(calls).toContain("<https://example.graphql.eu-central-1.nhost.run/v1/graphql>");
  });

  test.each(["dump", "diff"])("preserves existing snapshots when %s fails", (operation) => {
    const destination = join(root, "backend/schemas");
    mkdirSync(destination);
    const existing = [...expectedFiles, "schema.unrelated.graphqls"];
    for (const file of existing) {
      writeFileSync(join(destination, file), "previous snapshot\n");
    }

    expect(generate({ FAIL_COMMAND: operation }).exitCode).toBe(7);
    expect(readdirSync(destination).sort()).toEqual(existing.sort());
    for (const file of existing) {
      expect(readFileSync(join(destination, file), "utf8")).toBe("previous snapshot\n");
    }
  });
});
