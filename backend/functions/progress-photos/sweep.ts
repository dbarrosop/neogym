import { createHash, timingSafeEqual } from "node:crypto";

interface Request {
	method: string;
	headers: Record<string, string | string[] | undefined>;
}

interface Response {
	status(code: number): Response;
	json(body: Record<string, unknown>): void;
}

const BATCH_SIZE = 20; // The SQL claim caps the batch, too.
const CONCURRENCY = 5;
const TIMEOUT_MS = 5000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CLAIM =
	"mutation ClaimProgressPhotoSweep { claimProgressPhotoSweep { id } }";

function authorized(header: string | string[] | undefined): boolean {
	const secret = process.env.NHOST_WEBHOOK_SECRET;
	if (!secret || typeof header !== "string" || !header) return false;
	const hash = (value: string) => createHash("sha256").update(value).digest();
	return timingSafeEqual(hash(header), hash(secret));
}

async function claim(hasuraUrl: string, secret: string): Promise<string[]> {
	const response = await fetch(new URL("/v1/graphql", hasuraUrl), {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-hasura-admin-secret": secret,
		},
		body: JSON.stringify({ query: CLAIM }),
		redirect: "error",
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});
	if (!response.ok) {
		await response.body?.cancel();
		throw new Error("claim unavailable");
	}
	const body = (await response.json()) as {
		data?: { claimProgressPhotoSweep?: { id: string }[] };
		errors?: unknown;
	};
	const rows = body.data?.claimProgressPhotoSweep;
	if (body.errors || !Array.isArray(rows) || rows.length > BATCH_SIZE) {
		throw new Error("invalid claim result");
	}
	const ids = rows.map(({ id }) => {
		if (typeof id !== "string" || !UUID.test(id))
			throw new Error("invalid claimed ID");
		return id;
	});
	return [...new Set(ids)];
}

async function remove(storageUrl: string, secret: string, id: string) {
	try {
		const response = await fetch(
			`${storageUrl.replace(/\/$/, "")}/files/${id}`,
			{
				method: "DELETE",
				headers: { "x-hasura-admin-secret": secret },
				redirect: "error",
				signal: AbortSignal.timeout(TIMEOUT_MS),
			},
		);
		await response.body?.cancel();
		if (response.status === 204) return "deleted";
		// A concurrent DELETE can remove metadata first; 404 does not prove byte removal.
		if (response.status === 404) return "missing";
	} catch {
		// Do not log thrown fetch errors, URLs, credentials, or response bodies.
	}
	return "failed";
}

export default async function sweep(req: Request, res: Response) {
	if (req.method !== "POST")
		return res.status(405).json({ status: "method_not_allowed" });
	if (!authorized(req.headers["nhost-webhook-secret"])) {
		return res.status(401).json({ status: "unauthorized" });
	}

	// Never use the webhook's request body, query string, account, or role for selection.
	const {
		NHOST_ADMIN_SECRET: secret,
		NHOST_HASURA_URL: hasuraUrl,
		NHOST_STORAGE_URL: storageUrl,
	} = process.env;
	const counts = { selected: 0, deleted: 0, missing: 0, failed: 0 };
	let status = "ok";
	try {
		if (!secret || !hasuraUrl || !storageUrl)
			throw new Error("missing scheduler configuration");
		const ids = await claim(hasuraUrl, secret);
		counts.selected = ids.length;
		for (let i = 0; i < ids.length; i += CONCURRENCY) {
			const results = await Promise.all(
				ids
					.slice(i, i + CONCURRENCY)
					.map((id) => remove(storageUrl, secret, id)),
			);
			for (const result of results) counts[result]++;
		}
		if (counts.failed) status = "delete_failed";
	} catch {
		status = "claim_failed";
	}
	const result = { status, ...counts };
	console.info("progress-photo-sweep", result);
	return res.status(status === "ok" ? 200 : 502).json(result);
}
