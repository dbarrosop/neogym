// Real-JWT local integration fixtures. No admin header can enter the request
// helpers below; administrative setup/cleanup stays in gql/PhotoFixtures.
import { expect } from "bun:test";
import {
	data,
	type GraphQLResponse,
	gql,
	HASURA_URL,
	JPEG,
	PhotoFixtures,
	STORAGE_URL,
} from "./progress-photos-helpers";

const AUTH_URL = "https://local.auth.local.nhost.run/v1";

export function jwtHeaders(
	token?: string,
	extra: Record<string, string> = {},
): Headers {
	const headers = new Headers(extra);
	if (headers.has("x-hasura-admin-secret")) {
		throw new Error("admin headers forbidden in JWT requests");
	}
	if (token) headers.set("authorization", `Bearer ${token}`);
	return headers;
}

export async function gqlJWT<T>(
	token: string | undefined,
	query: string,
	variables: Record<string, unknown> = {},
	endpoint = HASURA_URL,
	extra: Record<string, string> = {},
): Promise<GraphQLResponse<T>> {
	const response = await fetch(endpoint, {
		method: "POST",
		headers: jwtHeaders(token, {
			"content-type": "application/json",
			...extra,
		}),
		body: JSON.stringify({ query, variables }),
		signal: AbortSignal.timeout(10_000),
	});
	expect(response.status).toBe(200);
	return response.json() as Promise<GraphQLResponse<T>>;
}

export async function storageJWT(
	token: string | undefined,
	id: string,
	method = "GET",
	query = "",
	extra: Record<string, string> = {},
): Promise<Response> {
	return fetch(`${STORAGE_URL}/files/${id}${query}`, {
		method,
		headers: jwtHeaders(token, extra),
		signal: AbortSignal.timeout(10_000),
	});
}

export class StorageFixtures extends PhotoFixtures {
	ownerToken = "";
	otherToken = "";

	override async initialize(): Promise<void> {
		// Admin-created, verified local users with actual Auth-issued sessions.
		// Password sign-in is only a fixture bootstrap, not an app auth change.
		const password = crypto.randomUUID();
		const passwordHash = await Bun.password.hash(password, {
			algorithm: "bcrypt",
			cost: 4,
		});
		for (const id of [this.ownerId, this.otherId]) {
			const email = `progress-photo-${id}@example.com`;
			data(
				await gql(
					`mutation ($object: users_insert_input!) { insertUser(object: $object) { id } }`,
					{
						object: {
							id,
							email,
							emailVerified: true,
							passwordHash,
							displayName: "Storage test",
							locale: "en",
							defaultRole: "user",
							roles: { data: [{ role: "user" }] },
						},
					},
				),
			);
			const response = await fetch(`${AUTH_URL}/signin/email-password`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ email, password }),
				signal: AbortSignal.timeout(10_000),
			});
			expect(response.status).toBe(200);
			const body = (await response.json()) as {
				session?: { accessToken?: string; user: { id: string } };
			};
			// Never include Auth bodies/tokens in assertion output or errors.
			if (!body.session?.accessToken) throw new Error("Auth session missing");
			expect(body.session.user.id).toBe(id);
			if (id === this.ownerId) this.ownerToken = body.session.accessToken;
			else this.otherToken = body.session.accessToken;
		}
	}

	async uploadJWT({
		token = this.ownerToken,
		bucket = "progress_photos",
		bytes = JPEG,
		type = "image/jpeg",
		extra = {},
		metadata = {},
	}: {
		token?: string;
		bucket?: string;
		bytes?: Uint8Array<ArrayBuffer>;
		type?: string;
		extra?: Record<string, string>;
		metadata?: Record<string, unknown>;
	} = {}): Promise<{ id: string; response: Response }> {
		const id = crypto.randomUUID();
		this.fileIds.add(id);
		const form = new FormData();
		form.set("bucket-id", bucket);
		form.append("file[]", new Blob([bytes], { type }), "image.jpg");
		form.append(
			"metadata[]",
			JSON.stringify({ ...metadata, id, name: "image.jpg" }),
		);
		const response = await fetch(`${STORAGE_URL}/files`, {
			method: "POST",
			headers: jwtHeaders(token || undefined, extra),
			body: form,
			signal: AbortSignal.timeout(10_000),
		});
		return { id, response };
	}

	async uploaded(): Promise<string> {
		const { id, response } = await this.uploadJWT();
		expect(response.status).toBe(201);
		return id;
	}

	async replaceJWT(token: string | undefined, id: string): Promise<Response> {
		const form = new FormData();
		// Valid but distinct bytes make an accidental PUT observable by etag
		// and byte comparison, even when a metadata update later fails.
		form.set(
			"file",
			new Blob([Buffer.concat([JPEG, Buffer.from("changed")])], {
				type: "image/jpeg",
			}),
			"changed.jpg",
		);
		return fetch(`${STORAGE_URL}/files/${id}`, {
			method: "PUT",
			headers: jwtHeaders(token),
			body: form,
			signal: AbortSignal.timeout(10_000),
		});
	}
}

export async function adminFile(id: string) {
	return data(
		await gql<{
			file: {
				id: string;
				bucketId: string;
				uploadedByUserId: string;
				isUploaded: boolean;
				mimeType: string;
				etag: string | null;
			} | null;
		}>(
			`query ($id: uuid!) { file(id: $id) { id bucketId uploadedByUserId isUploaded mimeType etag } }`,
			{ id },
		),
	).file;
}

export async function expectJPEG(
	token: string | undefined,
	id: string,
): Promise<string | null> {
	const response = await storageJWT(token, id);
	expect(response.status).toBe(200);
	expect(Buffer.from(await response.arrayBuffer())).toEqual(JPEG);
	return response.headers.get("etag");
}

export function expectPrivate(response: Response): void {
	expect(response.status).toBe(200);
	expect(response.headers.get("cache-control")).toBe("private, no-store");
	expect(response.headers.get("surrogate-control")).toBe("private, no-store");
}
