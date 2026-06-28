import { describe, expect, test } from "bun:test";

declare const Bun: {
  file(path: URL): {
    text(): Promise<string>;
  };
};

const NATIVE_VERIFY_REDIRECT = "neogym://verify";
const WEB_LOCAL_CLIENT_URL = "http://localhost:5173";
const WEB_PRODUCTION_CLIENT_URL = "https://neogym.nhost.app";

function authRedirectionsSection(toml: string): string {
  const match = toml.match(/\[auth\.redirections\]\n(?<body>[\s\S]*?)(?=\n\[[^\n]+\]|$)/);
  if (!match?.groups?.body) {
    throw new Error("[auth.redirections] section not found");
  }
  return match.groups.body;
}

function sectionLine(section: string, key: string): string | null {
  return section
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith(`${key} =`)) ?? null;
}

function quotedValue(section: string, key: string): string | null {
  return sectionLine(section, key)?.match(/'([^']+)'/)?.[1] ?? null;
}

function quotedArrayValues(section: string, key: string): string[] {
  const line = sectionLine(section, key);
  if (!line) {
    return [];
  }
  return Array.from(line.matchAll(/'([^']+)'/g), ([, value]) => value);
}

describe("auth redirect configuration", () => {
  test("local Nhost config preserves web client URL and allows native verify redirect", async () => {
    const toml = await Bun.file(new URL("../nhost/nhost.toml", import.meta.url)).text();
    const redirections = authRedirectionsSection(toml);

    expect(quotedValue(redirections, "clientUrl")).toBe(WEB_LOCAL_CLIENT_URL);
    expect(quotedArrayValues(redirections, "allowedUrls")).toContain(NATIVE_VERIFY_REDIRECT);
  });

  test("production overlay preserves web client URL and allows native verify redirect", async () => {
    const overlay = JSON.parse(
      await Bun.file(new URL("../nhost/overlays/spmqtxqkdoxvtrkrfnnl.json", import.meta.url)).text(),
    );

    expect(
      overlay.some(
        (patch: { op?: string; path?: string; value?: unknown }) =>
          patch.op === "replace" &&
          patch.path === "/auth/redirections/clientUrl" &&
          patch.value === WEB_PRODUCTION_CLIENT_URL,
      ),
    ).toBe(true);

    const allowedUrlsPatch = overlay.find(
      (patch: { path?: string }) => patch.path === "/auth/redirections/allowedUrls",
    );
    expect(allowedUrlsPatch).toBeTruthy();
    expect(["add", "replace"]).toContain(allowedUrlsPatch.op);
    expect(allowedUrlsPatch.value).toContain(NATIVE_VERIFY_REDIRECT);
  });
});
