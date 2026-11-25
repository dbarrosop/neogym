/// <reference path="./bun-test.d.ts" />

import { afterAll, beforeAll, expect, test } from "bun:test";
import { strict as assert } from "node:assert";
import { sign } from "node:crypto";
import { fileURLToPath } from "node:url";

const HASURA = "https://local.hasura.local.nhost.run/v1/graphql";
const CONSTELLATION = "https://local.graphql.local.nhost.run/v1";
const STORAGE = "https://local.storage.local.nhost.run/v1/files";
const AUTH = "https://local.auth.local.nhost.run/v1";
const BUCKET = "progress_photos";
const FILENAME = "progress-photo.jpg";
const MAX_BYTES = 5 * 1024 * 1024;
// A generated 8 × 8 solid-colour JPEG, not an image of a person.
const JPEG = Uint8Array.from(
	atob(
		"/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKAC" +
			"AAQAAAABAAAACKADAAQAAAABAAAACAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZ" +
			"jwCyBOmACZjs+EJ+/8AAEQgACAAIAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIB" +
			"AwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNE" +
			"RUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfI" +
			"ycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIB" +
			"AgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpD" +
			"REVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXG" +
			"x8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgK" +
			"CgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ" +
			"EBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQAAf/aAAwDAQACEQMRAD8A+Y6KKK/rQ/l8/9k=",
	),
	(char) => char.charCodeAt(0),
);

interface Account {
	id: string;
	accessToken: string;
}
interface GraphQL<T> {
	data?: T;
	errors?: Array<{ extensions?: { code?: string } }>;
}
interface Photo {
	id: string;
	label: string;
	takenOn: string;
	userId: string;
}

const files = new Set<string>();
const reservations = new Set<string>();
const emails = new Set<string>();
let admin: Record<string, string>;
let minio: string;
let postgres: string;
let owner: Account;
let other: Account;

function localContainer(service: string): string {
	const projectDir = fileURLToPath(new URL("..", import.meta.url)).replace(
		/\/$/,
		"",
	);
	const result = Bun.spawnSync([
		"docker",
		"ps",
		"--filter",
		`label=com.docker.compose.project.working_dir=${projectDir}`,
		"--filter",
		`label=com.docker.compose.service=${service}`,
		"--format",
		"{{.Names}}",
	]);
	const names = result.stdout.toString().trim().split("\n");
	assert(
		result.exitCode === 0 && names.length === 1 && names[0],
		`expected one ${service} container for this checkout`,
	);
	return names[0];
}

function fetchLocal(url: string, init: RequestInit = {}): Promise<Response> {
	return fetch(url, {
		...init,
		redirect: "error",
		signal: AbortSignal.timeout(5000),
	});
}

function post(
	url: string,
	body: unknown,
	headers: Record<string, string> = {},
) {
	return fetchLocal(url, {
		method: "POST",
		headers: { ...headers, "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}

function bearer(account: Account) {
	return { authorization: `Bearer ${account.accessToken}` };
}

async function gql<T>(
	url: string,
	query: string,
	variables: Record<string, unknown> = {},
	headers: Record<string, string> = {},
): Promise<GraphQL<T>> {
	return (await post(url, { query, variables }, headers)).json() as Promise<
		GraphQL<T>
	>;
}

async function adminGql<T>(
	query: string,
	variables: Record<string, unknown> = {},
): Promise<T> {
	const result = await gql<T>(HASURA, query, variables, admin);
	assert(
		result.data && !result.errors,
		`admin fixture operation failed: ${result.errors?.[0]?.extensions?.code ?? "missing data"}`,
	);
	return result.data;
}

async function fixtureAccount(): Promise<Account> {
	// Use real Auth-issued user tokens without consuming the stack's shared OTP mail budget.
	const email = `progress-photo-${crypto.randomUUID()}@example.com`;
	const password = crypto.randomUUID();
	const passwordHash = await Bun.password.hash(password, {
		algorithm: "bcrypt",
		cost: 10,
	});
	emails.add(email);
	await adminGql(
		`mutation Fixture($object: users_insert_input!) { insertUser(object: $object) { id } }`,
		{
			object: {
				email,
				passwordHash,
				emailVerified: true,
				defaultRole: "user",
				displayName: "Progress test",
				locale: "en",
				roles: { data: [{ role: "user" }] },
			},
		},
	);
	const signedIn = await post(`${AUTH}/signin/email-password`, {
		email,
		password,
	});
	assert(signedIn.ok, `local Auth fixture sign-in failed: ${signedIn.status}`);
	const { session } = (await signedIn.json()) as {
		session?: { user: { id: string }; accessToken: string };
	};
	assert(session?.user.id && session.accessToken, "missing local Auth session");
	return { id: session.user.id, accessToken: session.accessToken };
}

function objectExists(id: string): boolean {
	const result = Bun.spawnSync([
		"docker",
		"exec",
		minio,
		"sh",
		"-c",
		'export MC_HOST_local="http://$MINIO_ROOT_USER:$MINIO_ROOT_PASSWORD@127.0.0.1:9000"; mc stat --json local/nhost/"$1"',
		"--",
		id,
	]);
	const report = JSON.parse(result.stdout.toString());
	if (result.exitCode === 0) {
		assert(
			report.status === "success" && report.size > 0,
			"expected a nonempty synthetic object in MinIO",
		);
		return true;
	}
	assert(
		report.error?.cause?.message === "Object does not exist",
		"MinIO did not return an explicit missing-object result",
	);
	return false;
}

async function upload(
	bucket = BUCKET,
	bytes = JPEG,
	headers = admin,
	id: string = crypto.randomUUID(),
	name = FILENAME,
	mime = "application/octet-stream",
) {
	files.add(id);
	const form = new FormData();
	form.append("bucket-id", bucket);
	form.append(
		"metadata[]",
		new Blob([JSON.stringify({ id })], { type: "application/json" }),
		"",
	);
	form.append("file[]", new File([bytes], name, { type: mime }));
	return {
		id,
		response: await fetchLocal(STORAGE, {
			method: "POST",
			body: form,
			headers,
		}),
	};
}

function expiredBearer(account: Account) {
	// Keep the genuine session's claims, but create a signed, already-expired
	// fixture with the disposable local stack's key. Do not log the key or JWT.
	const inspected = Bun.spawnSync([
		"docker",
		"inspect",
		"--format",
		"{{json .Config.Env}}",
		localContainer("auth"),
	]);
	assert(inspected.exitCode === 0, "could not inspect the local Auth signer");
	const env = JSON.parse(inspected.stdout.toString()) as string[];
	const prefix = "HASURA_GRAPHQL_JWT_SECRET=";
	const config = env.find((value) => value.startsWith(prefix));
	assert(config, "local JWT configuration is unavailable");
	const { type, signing_key } = JSON.parse(config.slice(prefix.length)) as {
		type: string;
		signing_key?: string;
	};
	assert(
		type === "RS256" && signing_key,
		"expected the local RS256 fixture signer",
	);
	const [header, payload] = account.accessToken.split(".");
	const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
	const expired = Math.floor(Date.now() / 1000) - 120;
	const body = Buffer.from(
		JSON.stringify({ ...claims, iat: expired - 900, exp: expired }),
	).toString("base64url");
	const input = `${header}.${body}`;
	const signature = sign(
		"RSA-SHA256",
		Buffer.from(input),
		signing_key,
	).toString("base64url");
	return { authorization: `Bearer ${input}.${signature}` };
}

beforeAll(async () => {
	minio = localContainer("minio");
	postgres = localContainer("postgres");
	const graphql = localContainer("graphql");
	const result = Bun.spawnSync([
		"docker",
		"exec",
		graphql,
		"printenv",
		"HASURA_GRAPHQL_ADMIN_SECRET",
	]);
	const secret = result.stdout.toString().trim();
	assert(
		result.exitCode === 0 && secret,
		"local Hasura admin credential unavailable",
	);
	admin = { "x-hasura-admin-secret": secret };
	owner = await fixtureAccount();
	other = await fixtureAccount();
});

const DATE = "2024-02-29";
const INSERT = `mutation Reserve($object: progressPhoto_insert_input!) {
	insertProgressPhoto(object: $object) { id userId label takenOn }
}`;
const PHOTO = `query Photo($id: uuid!) {
	progressPhoto(id: $id) { id userId label takenOn angle { name } file { id isUploaded progressPhoto { id } } }
}`;
const FILE = `query File($id: uuid!) { file(id: $id) { id isUploaded } }`;
const INSERT_FILE = `mutation Init($object: files_insert_input!) {
	insertFile(object: $object) { id isUploaded uploadedByUserId }
}`;
const DELETE_FILE = `mutation Remove($id: uuid!) { deleteFile(id: $id) { id } }`;
const EDIT = `mutation Edit($id: uuid!, $set: progressPhoto_set_input!) {
	updateProgressPhoto(pk_columns: { id: $id }, _set: $set) { id userId label takenOn }
}`;
const ROOTS = `query Roots { __schema { mutationType { fields { name } } } }`;
const fileInput = (id: string) => ({
	id,
	bucketId: BUCKET,
	name: FILENAME,
	size: JPEG.length,
	mimeType: "image/jpeg",
});
const photoInput = (label = "front") => ({ label, takenOn: DATE });

type PhotoAndFile = Photo & {
	file: {
		id: string;
		isUploaded: boolean;
		progressPhoto: { id: string };
	} | null;
};

async function reserve(account = owner, url = HASURA, label = "front") {
	const response = await gql<{ insertProgressPhoto: Photo }>(
		url,
		INSERT,
		{ object: photoInput(label) },
		bearer(account),
	);
	assert(
		response.data?.insertProgressPhoto && !response.errors,
		`reservation failed: ${response.errors?.[0]?.extensions?.code}`,
	);
	const photo = response.data.insertProgressPhoto;
	assert(/^[a-f0-9-]{36}$/.test(photo.id));
	reservations.add(photo.id);
	expect(photo).toMatchObject({ userId: account.id, ...photoInput(label) });
	return photo.id;
}

async function photo(
	id: string,
	headers: Record<string, string> = bearer(owner),
	url = HASURA,
) {
	return gql<{ progressPhoto: PhotoAndFile | null }>(
		url,
		PHOTO,
		{ id },
		headers,
	);
}

async function uploadedFixture(id: string, account = owner) {
	const { response } = await upload(BUCKET, JPEG, bearer(account), id);
	expect(response.status).toBe(201);
	const body = (await response.json()) as { processedFiles: unknown[] };
	expect(body.processedFiles).toMatchObject([
		{
			id,
			mimeType: "image/jpeg",
			isUploaded: true,
			size: JPEG.length,
			metadata: null,
		},
	]);
	expect(objectExists(id)).toBe(true);
}

async function initializeFixture(id: string, account = owner) {
	files.add(id);
	const result = await gql<{
		insertFile: { id: string; isUploaded: boolean; uploadedByUserId: string };
	}>(HASURA, INSERT_FILE, { object: fileInput(id) }, bearer(account));
	expect(result.errors).toBeUndefined();
	expect(result.data?.insertFile).toEqual({
		id,
		isUploaded: false,
		uploadedByUserId: account.id,
	});
}

async function deleteFixture(id: string, headers = admin) {
	const response = await fetchLocal(`${STORAGE}/${id}`, {
		method: "DELETE",
		headers,
	});
	assert(
		response.status === 204 || (headers === admin && response.status === 404),
		`synthetic fixture cleanup failed: ${response.status}`,
	);
	assert(!objectExists(id), "fixture cleanup did not remove the object");
	files.delete(id);
}

function sql(statements: string): string {
	const result = Bun.spawnSync([
		"docker",
		"exec",
		postgres,
		"psql",
		"-XqAt",
		"-v",
		"ON_ERROR_STOP=1",
		"-U",
		"postgres",
		"-d",
		"local",
		"-c",
		statements,
	]);
	assert(result.exitCode === 0, "local pg_cron fixture SQL failed");
	return result.stdout.toString().trim();
}

function uuid(id: string): string {
	assert(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id));
	return `'${id}'::uuid`;
}

function backdate(
	table: "public.progress_photos" | "storage.files",
	id: string,
) {
	sql(
		`UPDATE ${table} SET created_at = now() - interval '2 hours' WHERE id = ${uuid(id)}`,
	);
}

afterAll(async () => {
	const cleanup = await Promise.allSettled(
		[...files].map((id) => deleteFixture(id)),
	);
	if (reservations.size) {
		await adminGql(
			`mutation Cleanup($ids: [uuid!]!) { deleteProgressPhotos(where: { id: { _in: $ids } }) { affected_rows } }`,
			{ ids: [...reservations] },
		);
	}
	for (const email of emails) {
		await adminGql(
			`mutation Remove($email: citext!) { deleteUsers(where: { email: { _eq: $email } }) { affected_rows } }`,
			{ email },
		);
	}
	for (const result of cleanup)
		if (result.status === "rejected") throw result.reason;
});

test("signed-in users reserve with a date and a catalog label, never choose the owner or file ID", async () => {
	for (const url of [HASURA, CONSTELLATION]) {
		type Schema = {
			__schema: { mutationType: { fields: Array<{ name: string }> } };
		};
		const roots = async (headers: Record<string, string>) => {
			const result = await gql<Schema>(url, ROOTS, {}, headers);
			expect(result.errors).toBeUndefined();
			return result.data?.__schema.mutationType.fields.map(({ name }) => name);
		};
		const adminRoots = await roots(admin);
		const userRoots = await roots(bearer(owner));
		for (const name of [
			"insertProgressPhoto",
			"updateProgressPhoto",
			"insertFile",
			"deleteFile",
		])
			expect(userRoots).toContain(name);
		for (const name of [
			"insertProgressPhotoLabel",
			"deleteProgressPhoto",
			"updateFile",
		]) {
			expect(adminRoots).toContain(name);
			expect(userRoots).not.toContain(name);
		}
		const labels = await gql<{ progressPhotoLabels: unknown[] }>(
			url,
			`{ progressPhotoLabels(order_by: { position: asc }) { value name } }`,
			{},
			bearer(owner),
		);
		expect(labels.data?.progressPhotoLabels).toEqual([
			{ value: "front", name: "Front" },
			{ value: "back", name: "Back" },
		]);
		for (const object of [
			{ ...photoInput(), id: crypto.randomUUID() },
			{ ...photoInput(), userId: other.id },
			{ ...photoInput(), fileId: crypto.randomUUID() },
			photoInput("not-a-label"),
			{ ...photoInput(), takenOn: "2025-02-29" },
			{ ...photoInput(), takenOn: "infinity" },
		])
			expect(
				(await gql(url, INSERT, { object }, bearer(owner))).errors,
			).toBeDefined();
		expect(
			(await gql(url, INSERT, { object: photoInput() })).errors,
		).toBeDefined();
		const id = await reserve(owner, url);
		expect(
			(await photo(id, bearer(owner), url)).data?.progressPhoto,
		).toMatchObject({ id, file: null });
		expect(
			(await photo(id, bearer(other), url)).data?.progressPhoto,
		).toBeNull();
	}
});

test("Storage and direct file initialization require a matching, live reservation", async () => {
	const id = await reserve();
	const expired = await reserve();
	backdate("public.progress_photos", expired);
	const absent = crypto.randomUUID();
	for (const [fileId, headers] of [
		[absent, bearer(owner)],
		[id, bearer(other)],
		[expired, bearer(owner)],
		[id, {}],
		[id, expiredBearer(owner)],
	] as const) {
		expect((await upload(BUCKET, JPEG, headers, fileId)).response.ok).toBe(
			false,
		);
		expect(objectExists(fileId)).toBe(false);
	}
	for (const url of [HASURA, CONSTELLATION]) {
		for (const [fileId, headers] of [
			[absent, bearer(owner)],
			[id, bearer(other)],
			[expired, bearer(owner)],
		] as const) {
			expect(
				(await gql(url, INSERT_FILE, { object: fileInput(fileId) }, headers))
					.errors,
			).toBeDefined();
		}
		for (const extra of [
			{ uploadedByUserId: other.id },
			{ isUploaded: true },
			{ metadata: {} },
			{ etag: "fake" },
		]) {
			expect(
				(
					await gql(
						url,
						INSERT_FILE,
						{ object: { ...fileInput(id), ...extra } },
						bearer(owner),
					)
				).errors,
			).toBeDefined();
		}
	}
	// The database guard also applies to the server's own admin-role inserts.
	for (const fileId of [absent, expired]) {
		const result = await gql(
			HASURA,
			INSERT_FILE,
			{ object: { ...fileInput(fileId), uploadedByUserId: owner.id } },
			admin,
		);
		expect(result.errors?.[0]?.extensions?.code).toBe("permission-error");
	}
	await initializeFixture(id);
	expect((await photo(id)).data?.progressPhoto?.file).toMatchObject({
		id,
		isUploaded: false,
	});
	expect((await upload(BUCKET, JPEG, bearer(owner), id)).response.ok).toBe(
		false,
	);
	await deleteFixture(id, bearer(owner));
	expect((await photo(id)).data?.progressPhoto).toBeNull();
	expect((await upload(BUCKET, JPEG, bearer(owner), id)).response.ok).toBe(
		false,
	);
});

test("a completed upload appears through the relationship, with private bytes and no share or replace", async () => {
	const id = await reserve();
	await uploadedFixture(id);
	expect((await upload(BUCKET, JPEG, bearer(owner), id)).response.ok).toBe(
		false,
	);
	for (const set of [
		{ metadata: { custom: "not allowed" } },
		{ uploadedByUserId: other.id },
		{ bucketId: "exercise_images" },
	]) {
		const result = await gql(
			HASURA,
			`mutation Set($id: uuid!, $set: files_set_input!) {
				updateFile(pk_columns: { id: $id }, _set: $set) { id }
			}`,
			{ id, set },
			admin,
		);
		expect(result.errors?.[0]?.extensions?.code).toBe("permission-error");
	}
	for (const url of [HASURA, CONSTELLATION]) {
		expect(
			(await photo(id, bearer(owner), url)).data?.progressPhoto,
		).toMatchObject({
			id,
			...photoInput(),
			file: { id, isUploaded: true, progressPhoto: { id } },
		});
		expect(
			(await photo(id, bearer(other), url)).data?.progressPhoto,
		).toBeNull();
		expect(
			(await gql<{ file: unknown }>(url, FILE, { id }, bearer(other))).data
				?.file,
		).toBeNull();
		expect((await photo(id, {}, url)).errors).toBeDefined();
	}
	for (const suffix of ["", "?w=4&f=webp"]) {
		const path = `${STORAGE}/${id}${suffix}`;
		for (const method of ["GET", "HEAD"]) {
			const response = await fetchLocal(path, {
				method,
				headers: bearer(owner),
			});
			expect(response.status).toBe(200);
			expect(response.headers.get("cache-control")).toBe("private, no-store");
			expect(
				(await fetchLocal(path, { method, headers: bearer(other) })).status,
			).toBe(404);
			expect((await fetchLocal(path, { method })).status).toBe(404);
		}
	}
	expect(
		(
			await fetchLocal(`${STORAGE}/${id}/presignedurl`, {
				headers: bearer(owner),
			})
		).status,
	).toBe(403);
	expect(
		(
			await fetchLocal(`${STORAGE}/${id}`, {
				method: "PUT",
				headers: bearer(owner),
			})
		).ok,
	).toBe(false);
	expect(
		(
			await fetchLocal(`${STORAGE}/${id}`, {
				method: "DELETE",
				headers: bearer(other),
			})
		).ok,
	).toBe(false);
	for (const url of [HASURA, CONSTELLATION]) {
		expect(
			(
				await gql<{ deleteFile: unknown }>(
					url,
					DELETE_FILE,
					{ id },
					bearer(other),
				)
			).data?.deleteFile,
		).toBeNull();
	}
	await deleteFixture(id, bearer(owner));
	expect((await photo(id)).data?.progressPhoto).toBeNull();
});

test("same-day reservations remain distinct and only date and angle can be corrected", async () => {
	const first = await reserve();
	const second = await reserve(owner, CONSTELLATION);
	const pending = await reserve();
	await initializeFixture(pending);
	expect(first).not.toBe(second);
	await uploadedFixture(first);
	await uploadedFixture(second);
	for (const url of [HASURA, CONSTELLATION]) {
		const list = await gql<{ progressPhotos: Array<{ id: string }> }>(
			url,
			`query Ready($ids: [uuid!]!) {
			progressPhotos(where: { id: { _in: $ids }, file: { isUploaded: { _eq: true } } },
				order_by: [{ takenOn: desc }, { createdAt: desc }, { id: desc }]) { id }
		}`,
			{ ids: [first, second, pending] },
			bearer(owner),
		);
		expect(list.data?.progressPhotos).toEqual([{ id: second }, { id: first }]);
		for (const set of [
			{ userId: other.id },
			{ fileId: second },
			{ id: second },
		]) {
			expect(
				(await gql(url, EDIT, { id: first, set }, bearer(owner))).errors,
			).toBeDefined();
		}
		const set = { label: "back", takenOn: "2024-01-01" };
		expect(
			(
				await gql<{ updateProgressPhoto: unknown }>(
					url,
					EDIT,
					{ id: first, set },
					bearer(other),
				)
			).data?.updateProgressPhoto,
		).toBeNull();
		expect(
			(
				await gql<{ updateProgressPhoto: Photo }>(
					url,
					EDIT,
					{ id: first, set },
					bearer(owner),
				)
			).data?.updateProgressPhoto,
		).toMatchObject({ id: first, userId: owner.id, ...set });
		// Restore for the next endpoint's ordering assertion.
		await gql(url, EDIT, { id: first, set: photoInput() }, bearer(owner));
	}
});

test("upload format and bucket permissions are unchanged for progress and exercise images", async () => {
	const id = await reserve();
	const oversized = new Uint8Array(MAX_BYTES + 1);
	oversized.set(JPEG);
	for (const attempt of [
		await upload(BUCKET, oversized, bearer(owner), id),
		await upload(
			BUCKET,
			new TextEncoder().encode("not JPEG"),
			bearer(owner),
			id,
			FILENAME,
			"image/jpeg",
		),
		await upload(BUCKET, JPEG, bearer(owner), id, "invalid.jpg"),
		await upload("exercise_images", JPEG, bearer(owner), id),
	])
		expect(attempt.response.ok).toBe(false);
	expect(objectExists(id)).toBe(false);
	await uploadedFixture(id);
	const publicFixture = await upload("exercise_images");
	expect(publicFixture.response.status).toBe(201);
	const response = await fetchLocal(`${STORAGE}/${publicFixture.id}`);
	expect(response.status).toBe(200);
	expect(new Uint8Array(await response.arrayBuffer())).toEqual(JPEG);
});

test("pg_cron expiry removes stale reservations and queues incomplete files, not ready or recent ones", async () => {
	const stale = await reserve();
	const incomplete = await reserve();
	const ready = await reserve();
	const fresh = await reserve();
	await initializeFixture(incomplete);
	await uploadedFixture(ready);
	backdate("public.progress_photos", stale);
	backdate("public.progress_photos", incomplete);
	backdate("storage.files", incomplete);
	backdate("public.progress_photos", ready);
	backdate("storage.files", ready);
	const jobs = sql(
		`SELECT jobname FROM cron.job WHERE active AND jobname IN ('neogym-progress-photo-deleted-owners','neogym-progress-photo-expiry') ORDER BY jobname`,
	);
	expect(jobs.split("\n")).toEqual([
		"neogym-progress-photo-deleted-owners",
		"neogym-progress-photo-expiry",
	]);
	// Exercise the cron command with rollback so the test only persists changes to its own fixtures.
	const state = sql(`BEGIN;
		SELECT public.delete_expired_progress_photo_reservations();
		SELECT json_build_array(
			(SELECT count(*) FROM public.progress_photos WHERE id IN (${uuid(stale)}, ${uuid(incomplete)})),
			(SELECT count(*) FROM storage.files WHERE id = ${uuid(incomplete)}),
			(SELECT count(*) FROM storage.files_to_delete WHERE id = ${uuid(incomplete)}),
			(SELECT count(*) FROM public.progress_photos WHERE id IN (${uuid(ready)}, ${uuid(fresh)}))
		);
		ROLLBACK;`);
	expect(JSON.parse(state)).toEqual([0, 0, 1, 2]);
});

test("account deletion revokes bearer access and the second pg_cron job removes its reservations and queues files", async () => {
	const departed = await fixtureAccount();
	const bare = await reserve(departed);
	const attached = await reserve(departed);
	await initializeFixture(attached, departed);
	const retained = await reserve();
	await adminGql(`mutation Remove($id: uuid!) { deleteUser(id: $id) { id } }`, {
		id: departed.id,
	});
	for (const url of [HASURA, CONSTELLATION]) {
		expect(
			(await photo(attached, bearer(departed), url)).data?.progressPhoto,
		).toBeNull();
		expect(
			(
				await gql<{ file: unknown }>(
					url,
					FILE,
					{ id: attached },
					bearer(departed),
				)
			).data?.file,
		).toBeNull();
	}
	expect((await upload(BUCKET, JPEG, bearer(departed), bare)).response.ok).toBe(
		false,
	);
	const state = sql(`BEGIN;
		SELECT public.delete_progress_photos_without_uploader();
		SELECT json_build_array(
			(SELECT count(*) FROM public.progress_photos WHERE id IN (${uuid(bare)}, ${uuid(attached)})),
			(SELECT count(*) FROM storage.files WHERE id = ${uuid(attached)}),
			(SELECT count(*) FROM storage.files_to_delete WHERE id = ${uuid(attached)}),
			(SELECT count(*) FROM public.progress_photos WHERE id = ${uuid(retained)})
		);
		ROLLBACK;`);
	expect(JSON.parse(state)).toEqual([0, 0, 1, 1]);
});
