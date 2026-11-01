// Local-only fixtures for the progress-photo integration suites. Never print
// request headers, response bodies from Auth, or credentials. No global cleanup.
import { expect } from "bun:test";

export const HASURA_URL = "https://local.hasura.local.nhost.run/v1/graphql";
export const NHOST_GRAPHQL_URL =
	"https://local.graphql.local.nhost.run/v1/graphql";
export const STORAGE_URL = "https://local.storage.local.nhost.run/v1";
const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET ?? "nhost-admin-secret";
const adminHeaders = { "x-hasura-admin-secret": ADMIN_SECRET };

export interface GraphQLResponse<T> {
	data?: T | null;
	errors?: Array<{
		message: string;
		extensions?: {
			code?: string;
			internal?: { error?: { message?: string; status_code?: string } };
		};
	}>;
}

export async function gql<T>(
	query: string,
	variables: Record<string, unknown> = {},
	userId?: string,
	endpoint = HASURA_URL,
): Promise<GraphQLResponse<T>> {
	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			...adminHeaders,
			...(userId
				? { "x-hasura-role": "user", "x-hasura-user-id": userId }
				: {}),
		},
		body: JSON.stringify({ query, variables }),
		signal: AbortSignal.timeout(10_000),
	});
	expect(response.status).toBe(200);
	return response.json() as Promise<GraphQLResponse<T>>;
}

export function data<T>(response: GraphQLResponse<T>): T {
	expect(response.errors).toBeUndefined();
	expect(response.data).toBeDefined();
	return response.data as T;
}

export function expectConstraint(
	response: GraphQLResponse<unknown>,
	name: string,
): void {
	expect(response.errors).toBeDefined();
	const error = response.errors?.[0];
	expect([
		"constraint-violation",
		"permission-error",
		"postgres-error",
	]).toContain(error?.extensions?.code);
	expect(
		error?.extensions?.internal?.error?.message ?? error?.message,
	).toContain(name);
}

// A single-frame 1px JPEG; byte comparison tests do not rely on MIME alone.
export const JPEG = Buffer.from(
	"/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKgA/9k=",
	"base64",
);

export class PhotoFixtures {
	readonly ownerId = crypto.randomUUID();
	readonly otherId = crypto.randomUUID();
	readonly fileIds = new Set<string>();
	readonly labelIds = new Set<string>();

	async initialize(): Promise<void> {
		// Real rows rather than seed-user assumptions. No Auth login needed for
		// phase 1 role-impersonation tests; phase 2 must use actual issued JWTs.
		data(
			await gql(
				`mutation ($objects: [users_insert_input!]!) {
			insertUsers(objects: $objects) { affected_rows }
		}`,
				{
					objects: [this.ownerId, this.otherId].map((id) => ({
						id,
						displayName: "Progress photo test",
						locale: "en",
						defaultRole: "user",
					})),
				},
			),
		);
	}

	async upload(
		ownerId: string | null = this.ownerId,
		bucket = "progress_photos",
	): Promise<string> {
		const id = crypto.randomUUID();
		this.fileIds.add(id);
		const form = new FormData();
		form.set("bucket-id", bucket);
		form.append(
			"file[]",
			new Blob([JPEG], { type: "image/jpeg" }),
			"image.jpg",
		);
		form.append("metadata[]", JSON.stringify({ id, name: "image.jpg" }));
		const response = await fetch(`${STORAGE_URL}/files`, {
			method: "POST",
			headers: adminHeaders,
			body: form,
			signal: AbortSignal.timeout(10_000),
		});
		expect(response.status).toBe(201);
		if (ownerId === null) return id; // Deliberate missing-uploader negative fixture.
		// Admin REST initialization has no user preset. Set the real uploader
		// explicitly; never weaken the domain guard to accommodate fixtures.
		const updated = data(
			await gql<{
				updateFile: { id: string; isUploaded: boolean; mimeType: string };
			}>(
				`mutation ($id: uuid!, $owner: uuid!) {
				updateFile(pk_columns: {id: $id}, _set: {uploadedByUserId: $owner}) { id isUploaded mimeType }
			}`,
				{ id, owner: ownerId },
			),
		);
		expect(updated.updateFile.id).toBe(id);
		expect(updated.updateFile.isUploaded).toBe(true);
		expect(updated.updateFile.mimeType).toBe("image/jpeg");
		return id;
	}

	async incompleteFile(): Promise<string> {
		const id = crypto.randomUUID();
		this.fileIds.add(id);
		data(
			await gql(
				`mutation ($object: files_insert_input!) {
			insertFile(object: $object) { id }
		}`,
				{
					object: {
						id,
						bucketId: "progress_photos",
						isUploaded: false,
						uploadedByUserId: this.ownerId,
						name: "image.jpg",
						mimeType: "image/jpeg",
						size: JPEG.length,
					},
				},
			),
		);
		return id;
	}

	async label(isActive = true): Promise<string> {
		const id = `test_${crypto.randomUUID().replaceAll("-", "")}`;
		this.labelIds.add(id);
		data(
			await gql(
				`mutation ($object: progressPhotoLabels_insert_input!) {
			insertProgressPhotoLabel(object: $object) { id }
		}`,
				{ object: { id, name: "Test label", position: 100, isActive } },
			),
		);
		return id;
	}

	async deleteFile(id: string): Promise<number> {
		const response = await fetch(`${STORAGE_URL}/files/${id}`, {
			method: "DELETE",
			headers: adminHeaders,
			signal: AbortSignal.timeout(10_000),
		});
		return response.status;
	}

	async getFile(id: string): Promise<Response> {
		return fetch(`${STORAGE_URL}/files/${id}`, {
			headers: adminHeaders,
			signal: AbortSignal.timeout(10_000),
		});
	}

	async cleanup(): Promise<void> {
		// Only IDs created by this suite. REST is required even after a photo
		// was detached; GraphQL metadata deletion alone leaves object bytes.
		const ids = [...this.fileIds];
		for (let offset = 0; offset < ids.length; offset += 4) {
			const statuses = await Promise.all(
				ids.slice(offset, offset + 4).map((id) => this.deleteFile(id)),
			);
			for (const status of statuses) expect([204, 404]).toContain(status);
		}
		data(
			await gql(
				`mutation ($ids: [uuid!]!) {
			deleteUsers(where: {id: {_in: $ids}}) { affected_rows }
		}`,
				{ ids: [this.ownerId, this.otherId] },
			),
		);
		if (this.labelIds.size > 0) {
			data(
				await gql(
					`mutation ($ids: [String!]!) {
				deleteProgressPhotoLabels(where: {id: {_in: $ids}}) { affected_rows }
			}`,
					{ ids: [...this.labelIds] },
				),
			);
		}
	}
}

export async function rollbackProbe(sql: string): Promise<void> {
	// DML/rollback-only probe, never a schema application path.
	const response = await fetch(
		"https://local.hasura.local.nhost.run/v2/query",
		{
			method: "POST",
			headers: { "content-type": "application/json", ...adminHeaders },
			body: JSON.stringify({
				type: "run_sql",
				args: { source: "default", sql, cascade: false, read_only: false },
			}),
			signal: AbortSignal.timeout(10_000),
		},
	);
	expect(response.status).toBe(200);
	const result = (await response.json()) as {
		error?: string;
		result_type?: string;
	};
	expect(result.error).toBeUndefined();
	expect(result.result_type).toBe("CommandOk");
}
