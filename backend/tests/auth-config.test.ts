import { describe, expect, test } from "bun:test";

declare const Bun: {
	file(path: URL): {
		text(): Promise<string>;
	};
};

const NATIVE_VERIFY_REDIRECTS = ["neogym://verify", "neogym-dev://verify"];
const WEB_LOCAL_CLIENT_URL = "http://localhost:5173";
const WEB_PRODUCTION_CLIENT_URL = "https://neogym.nhost.app";

type OverlayPatch = { op?: string; path?: string; value?: unknown };

function parseOverlay(source: string): OverlayPatch[] {
	try {
		const parsed: unknown = JSON.parse(source);
		if (!Array.isArray(parsed)) {
			throw new Error("not an array");
		}
		return parsed as OverlayPatch[];
	} catch {
		throw new Error("production overlay is not a valid JSON patch array");
	}
}

function authRedirectionsSection(toml: string): string {
	const match = toml.match(
		/\[auth\.redirections\]\n(?<body>[\s\S]*?)(?=\n\[[^\n]+\]|$)/,
	);
	if (!match?.groups?.body) {
		throw new Error("[auth.redirections] section not found");
	}
	return match.groups.body;
}

function sectionLine(section: string, key: string): string | null {
	return (
		section
			.split("\n")
			.map((line) => line.trim())
			.find((line) => line.startsWith(`${key} =`)) ?? null
	);
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
	test("local Nhost config preserves web client URL and allows both native verify redirects", async () => {
		const toml = await Bun.file(
			new URL("../nhost/nhost.toml", import.meta.url),
		).text();
		const redirections = authRedirectionsSection(toml);

		expect(quotedValue(redirections, "clientUrl")).toBe(WEB_LOCAL_CLIENT_URL);
		expect(quotedArrayValues(redirections, "allowedUrls")).toEqual(
			NATIVE_VERIFY_REDIRECTS,
		);
	});

	test("production overlay preserves web client URL and allows both native verify redirects", async () => {
		const overlay = parseOverlay(
			await Bun.file(
				new URL("../nhost/overlays/spmqtxqkdoxvtrkrfnnl.json", import.meta.url),
			).text(),
		);

		expect(
			overlay.some(
				(patch: OverlayPatch) =>
					patch.op === "replace" &&
					patch.path === "/auth/redirections/clientUrl" &&
					patch.value === WEB_PRODUCTION_CLIENT_URL,
			),
		).toBe(true);

		const allowedUrlsPatch = overlay.find(
			(patch: OverlayPatch) => patch.path === "/auth/redirections/allowedUrls",
		);
		expect(allowedUrlsPatch).toBeTruthy();
		expect(["add", "replace"]).toContain(allowedUrlsPatch?.op);
		expect(allowedUrlsPatch?.value).toEqual(NATIVE_VERIFY_REDIRECTS);
	});
});
