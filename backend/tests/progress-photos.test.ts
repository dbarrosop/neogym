/// <reference path="./bun-test.d.ts" />

import { afterAll, beforeAll, expect, test } from "bun:test";
import { strict as assert } from "node:assert";
import { sign } from "node:crypto";
import { fileURLToPath } from "node:url";

const HASURA = "https://local.hasura.local.nhost.run/v1/graphql";
const CONSTELLATION = "https://local.graphql.local.nhost.run/v1";
const STORAGE = "https://local.storage.local.nhost.run/v1/files";
const METADATA = "https://local.hasura.local.nhost.run/v1/metadata";
const SWEEP =
	"https://local.functions.local.nhost.run/v1/progress-photos/sweep";
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
const emails = new Set<string>();
let admin: Record<string, string>;
let minio: string;
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
	id = crypto.randomUUID(),
	name = FILENAME,
	mime = "application/octet-stream",
	metadata?: Record<string, unknown>,
) {
	files.add(id);
	const form = new FormData();
	form.append("bucket-id", bucket);
	form.append(
		"metadata[]",
		new Blob([JSON.stringify({ id, metadata })], { type: "application/json" }),
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

async function uploadedFixture(
	bucket = BUCKET,
	headers: Record<string, string> = bearer(owner),
) {
	const { id, response } = await upload(bucket, JPEG, headers);
	expect(response.status).toBe(201);
	const body = (await response.json()) as {
		processedFiles: Array<{
			id: string;
			mimeType: string;
			isUploaded: boolean;
			size: number;
			metadata: unknown;
		}>;
	};
	expect(body.processedFiles).toHaveLength(1);
	expect(body.processedFiles[0]).toMatchObject({
		id,
		mimeType: "image/jpeg",
		isUploaded: true,
		size: JPEG.length,
		metadata: null,
	});
	expect(objectExists(id)).toBe(true);
	return id;
}

async function setFile(id: string, fields: Record<string, unknown>) {
	return adminGql(
		`mutation Set($id: uuid!, $set: files_set_input!) {
		updateFile(pk_columns: { id: $id }, _set: $set) { id }
	}`,
		{ id, set: fields },
	);
}

const INSERT = `mutation Link($object: progressPhoto_insert_input!) {
	insertProgressPhoto(object: $object) { id userId label takenOn }
}`;
const PHOTO = `query Read($id: uuid!) { progressPhoto(id: $id) { id userId label takenOn angle { name } file { id } } }`;
const FILE = `query Read($id: uuid!) { file(id: $id) { id isUploaded } }`;
const ROOTS = `query Roots { __schema { mutationType { fields { name } } } }`;
const DATE = "2024-02-29";

async function deleteAccount(id: string) {
	await adminGql(`mutation Remove($id: uuid!) { deleteUser(id: $id) { id } }`, {
		id,
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

beforeAll(async () => {
	minio = localContainer("minio");
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

afterAll(async () => {
	const cleanup = await Promise.allSettled([
		...[...files].map((id) => deleteFixture(id)),
		...[...emails].map(async (email) => {
			await adminGql(
				`mutation Remove($email: citext!) { deleteUsers(where: { email: { _eq: $email } }) { affected_rows } }`,
				{ email },
			);
		}),
	]);
	for (const result of cleanup)
		if (result.status === "rejected") throw result.reason;
});

test("both GraphQL endpoints expose only scoped file and photo writes", async () => {
	for (const url of [HASURA, CONSTELLATION]) {
		type Roots = {
			__schema: { mutationType: { fields: Array<{ name: string }> } | null };
		};
		const rootNames = (result: GraphQL<Roots>) =>
			result.data?.__schema?.mutationType?.fields.map(({ name }) => name) ?? [];
		const allowed = await gql<Roots>(url, ROOTS, {}, admin);
		const denied = await gql<Roots>(url, ROOTS, {}, bearer(owner));
		expect(allowed.errors).toBeUndefined();
		expect(denied.errors).toBeUndefined();
		for (const name of [
			"insertProgressPhoto",
			"updateProgressPhoto",
			"insertFile",
			"deleteFile",
		]) {
			expect(rootNames(allowed)).toContain(name);
			expect(rootNames(denied)).toContain(name);
		}
		for (const name of [
			"insertProgressPhotoLabel",
			"deleteProgressPhoto",
			"updateFile",
			"claimProgressPhotoSweep",
		]) {
			expect(rootNames(allowed)).toContain(name);
			expect(rootNames(denied)).not.toContain(name);
		}
		const labels = await gql<{
			progressPhotoLabels: Array<{ value: string; name: string }>;
		}>(
			url,
			`{ progressPhotoLabels(order_by: { position: asc }) { value name } }`,
			{},
			bearer(owner),
		);
		expect(labels.data?.progressPhotoLabels).toEqual([
			{ value: "front", name: "Front" },
			{ value: "back", name: "Back" },
		]);
		expect(
			(await gql(url, `{ progressPhotoLabels { value } }`)).errors,
		).toBeDefined();
	}
});

test("owner-only photo and byte reads; deleting the file removes the row and the object", async () => {
	const id = await uploadedFixture();
	const input = { id, label: "front", takenOn: DATE };
	const object = { ...input, userId: owner.id };
	const linked = await gql<{ insertProgressPhoto: Photo }>(
		HASURA,
		INSERT,
		{ object: input },
		bearer(owner),
	);
	expect(linked.errors).toBeUndefined();
	expect(linked.data?.insertProgressPhoto).toEqual(object);
	for (const url of [HASURA, CONSTELLATION]) {
		const own = await gql<{ progressPhoto: Photo }>(
			url,
			PHOTO,
			{ id },
			bearer(owner),
		);
		expect(own.errors).toBeUndefined();
		expect(own.data?.progressPhoto).toMatchObject({
			...object,
			angle: { name: "Front" },
			file: { id },
		});
		const foreign = await gql<{ progressPhoto: Photo | null }>(
			url,
			PHOTO,
			{ id },
			bearer(other),
		);
		expect(foreign.errors).toBeUndefined();
		expect(foreign.data?.progressPhoto).toBeNull();
		expect((await gql(url, PHOTO, { id })).errors).toBeDefined();
		for (const headers of [bearer(other), {}]) {
			const unreadable = await gql<{ file: null }>(url, FILE, { id }, headers);
			expect(unreadable.errors).toBeUndefined();
			expect(unreadable.data?.file).toBeNull();
		}
	}
	for (const [method, suffix, mime] of [
		["GET", "", "image/jpeg"],
		["HEAD", "", "image/jpeg"],
		["GET", "?w=2&f=webp", "image/webp"],
	]) {
		const response = await fetchLocal(`${STORAGE}/${id}${suffix}`, {
			method,
			headers: bearer(owner),
		});
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(response.headers.get("content-type")).toBe(mime);
		if (method === "GET" && !suffix)
			expect(new Uint8Array(await response.arrayBuffer())).toEqual(JPEG);
		else await response.body?.cancel();
		for (const headers of [bearer(other), {}]) {
			const denied = await fetchLocal(`${STORAGE}/${id}${suffix}`, {
				method,
				headers,
			});
			expect(denied.status).toBe(404);
			await denied.body?.cancel();
		}
	}
	expect(
		(
			await fetchLocal(`${STORAGE}/${id}/presignedurl`, {
				headers: bearer(owner),
			})
		).status,
	).toBe(403);
	const replacement = new FormData();
	replacement.append("file", new File(["Not a JPEG"], FILENAME));
	expect(
		(
			await fetchLocal(`${STORAGE}/${id}`, {
				method: "PUT",
				headers: bearer(owner),
				body: replacement,
			})
		).ok,
	).toBe(false);
	for (const headers of [{}, bearer(other)]) {
		const denied = await fetchLocal(`${STORAGE}/${id}`, {
			method: "DELETE",
			headers,
		});
		expect(denied.ok).toBe(false);
	}
	expect(objectExists(id)).toBe(true);
	await deleteFixture(id, bearer(owner));
	const after = await adminGql<{ progressPhoto: null }>(PHOTO, { id });
	expect(after.progressPhoto).toBeNull();
});

test("date and angle can be corrected without reassigning the file or owner", async () => {
	const id = await uploadedFixture();
	const input = { id, label: "front", takenOn: DATE };
	for (const url of [HASURA, CONSTELLATION]) {
		expect(
			(await gql(url, INSERT, { object: input }, bearer(other))).errors,
		).toBeDefined();
		expect(
			(
				await gql(
					url,
					INSERT,
					{ object: { ...input, userId: other.id } },
					bearer(owner),
				)
			).errors,
		).toBeDefined();
	}
	const linked = await gql<{ insertProgressPhoto: Photo }>(
		CONSTELLATION,
		INSERT,
		{ object: input },
		bearer(owner),
	);
	expect(linked.errors).toBeUndefined();
	expect(linked.data?.insertProgressPhoto).toEqual({
		...input,
		userId: owner.id,
	});
	const update = `mutation Correct($id: uuid!, $set: progressPhoto_set_input!) {
		updateProgressPhoto(pk_columns: { id: $id }, _set: $set) { id userId label takenOn }
	}`;
	expect(
		(await gql(HASURA, update, { id, set: { userId: other.id } }, admin))
			.errors,
	).toBeDefined();
	for (const url of [HASURA, CONSTELLATION]) {
		const foreign = await gql<{ updateProgressPhoto: null }>(
			url,
			update,
			{ id, set: { label: "back" } },
			bearer(other),
		);
		expect(foreign.errors).toBeUndefined();
		expect(foreign.data?.updateProgressPhoto).toBeNull();
		for (const set of [
			{ userId: other.id },
			{ id: crypto.randomUUID() },
			{ createdAt: new Date().toISOString() },
		]) {
			expect(
				(await gql(url, update, { id, set }, bearer(owner))).errors,
			).toBeDefined();
		}
	}
	const result = await gql<{ updateProgressPhoto: Photo }>(
		CONSTELLATION,
		update,
		{ id, set: { label: "back", takenOn: "2024-02-28" } },
		bearer(owner),
	);
	expect(result.errors).toBeUndefined();
	expect(result.data?.updateProgressPhoto).toEqual({
		id,
		userId: owner.id,
		label: "back",
		takenOn: "2024-02-28",
	});
	await deleteFixture(id);
});

test("link invariant rejects invalid file state, owner, dates, and labels", async () => {
	const id = await uploadedFixture();
	const object = { id, userId: owner.id, label: "front", takenOn: DATE };
	const link = (input: Record<string, unknown>) =>
		gql(HASURA, INSERT, { object: input }, admin);
	for (const invalid of [
		{ userId: other.id },
		{ takenOn: "infinity" },
		{ takenOn: "10000-01-01" },
		{ label: "unseeded" },
		{ id: crypto.randomUUID() },
	]) {
		expect((await link({ ...object, ...invalid })).errors).toBeDefined();
	}
	for (const [invalid, restore] of [
		[{ isUploaded: false }, { isUploaded: true }],
		[{ metadata: { test: true } }, { metadata: null }],
		[{ name: "other.jpg" }, { name: FILENAME }],
		[{ mimeType: "image/png" }, { mimeType: "image/jpeg" }],
		[{ size: 0 }, { size: JPEG.length }],
		[{ size: MAX_BYTES + 1 }, { size: JPEG.length }],
		[{ createdAt: "2024-01-01T00:00Z" }, null],
	] as const) {
		await setFile(id, invalid);
		expect((await link(object)).errors).toBeDefined();
		if (restore) await setFile(id, restore);
	}
	const publicId = await uploadedFixture("exercise_images", admin);
	await setFile(publicId, { uploadedByUserId: owner.id });
	expect((await link({ ...object, id: publicId })).errors).toBeDefined();
	const publicRead = await fetchLocal(`${STORAGE}/${publicId}`);
	expect(publicRead.status).toBe(200);
	expect(new Uint8Array(await publicRead.arrayBuffer())).toEqual(JPEG);
	const oversize = new Uint8Array(MAX_BYTES + 1);
	oversize.set(JPEG);
	const result = await upload(BUCKET, oversize, bearer(owner));
	expect(result.response.status).toBe(400);
	expect(objectExists(result.id)).toBe(false);
});

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

const INSERT_FILE = `mutation Init($object: files_insert_input!) {
	insertFile(object: $object) { id isUploaded uploadedByUserId }
}`;
const DELETE_FILE = `mutation Remove($id: uuid!) { deleteFile(id: $id) { id } }`;
const fileInput = (id: string, bucketId = BUCKET) => ({
	id,
	bucketId,
	name: FILENAME,
	size: JPEG.length,
	mimeType: "image/jpeg",
});
const photoInput = (id: string) => ({ id, label: "back", takenOn: DATE });

async function link(id: string, headers = bearer(owner), url = HASURA) {
	return gql<{ insertProgressPhoto: Photo }>(
		url,
		INSERT,
		{ object: photoInput(id) },
		headers,
	);
}

test("Storage rejects noncanonical content, filenames, bucket, unsigned and expired requests", async () => {
	const signed = bearer(owner);
	const expired = expiredBearer(owner);
	const fixtures = [
		await upload(BUCKET, JPEG, {}),
		await upload(BUCKET, JPEG, expired),
		await upload("exercise_images", JPEG, signed),
		await upload(BUCKET, new Uint8Array(), signed),
		await upload(BUCKET, JPEG, signed, undefined, "other.jpg"),
		await upload(
			BUCKET,
			new TextEncoder().encode("not a JPEG"),
			signed,
			undefined,
			FILENAME,
			"image/jpeg",
		),
	];
	for (const { id, response } of fixtures) {
		expect(response.ok).toBe(false);
		expect(objectExists(id)).toBe(false);
	}
	// Invalid content was rejected before initialization; the untouched ID remains usable.
	const { id } = fixtures[fixtures.length - 1];
	expect((await upload(BUCKET, JPEG, signed, id)).response.status).toBe(201);
	for (const url of [HASURA, CONSTELLATION]) {
		const response = await post(
			url,
			{ query: INSERT, variables: { object: photoInput(id) } },
			expired,
		);
		const rejected = (await response.json()) as GraphQL<{
			insertProgressPhoto: Photo;
		}>;
		assert(
			[400, 401, 403].includes(response.status) || rejected.errors?.length,
			`expired link was not rejected (${url === HASURA ? "Hasura" : "Constellation"}, HTTP ${response.status})`,
		);
		expect(rejected.data?.insertProgressPhoto).toBeUndefined();
	}
	for (const method of ["GET", "DELETE"]) {
		expect(
			(await fetchLocal(`${STORAGE}/${id}`, { method, headers: expired })).ok,
		).toBe(false);
	}
	await deleteFixture(id, signed);
});

test("generic file inserts are scoped and pending IDs cannot be linked or reused", async () => {
	for (const url of [HASURA, CONSTELLATION]) {
		const id = crypto.randomUUID();
		files.add(id);
		const object = fileInput(id);
		for (const invalid of [
			{ uploadedByUserId: other.id },
			{ isUploaded: true },
			{ metadata: {} },
			{ etag: "fake" },
			{ bucketId: "exercise_images" },
			{ mimeType: "image/png" },
			{ name: "other.jpg" },
			{ size: 0 },
		]) {
			expect(
				(
					await gql(
						url,
						INSERT_FILE,
						{ object: { ...object, ...invalid } },
						bearer(owner),
					)
				).errors,
			).toBeDefined();
		}
		const pending = await gql(url, INSERT_FILE, { object }, bearer(owner));
		expect(pending.errors).toBeUndefined();
		expect(pending.data).toEqual({
			insertFile: { id, isUploaded: false, uploadedByUserId: owner.id },
		});
		expect((await link(id, bearer(owner), url)).errors).toBeDefined();
		const foreign = await gql(url, DELETE_FILE, { id }, bearer(other));
		expect(foreign.errors).toBeUndefined();
		expect(foreign.data).toEqual({ deleteFile: null });
		expect((await gql(url, DELETE_FILE, { id }, bearer(owner))).data).toEqual({
			deleteFile: { id },
		});
		expect(
			(await gql(url, INSERT_FILE, { object }, bearer(owner))).errors,
		).toBeDefined();
		expect((await upload(BUCKET, JPEG, bearer(owner), id)).response.ok).toBe(
			false,
		);
		expect(objectExists(id)).toBe(false);
	}
});

test("same day and angle submissions sort by creation then ID; retry never adds or revives rows", async () => {
	const older = await uploadedFixture();
	const newer = await uploadedFixture();
	for (const id of [older, newer]) {
		const result = await link(id);
		expect(result.errors).toBeUndefined();
		expect((await link(id)).errors).toBeDefined();
	}
	const list = `query List($date: date!, $label: String!) {
		progressPhotos(where: {takenOn: {_eq: $date}, label: {_eq: $label}},
			order_by: [{takenOn: desc}, {createdAt: desc}, {id: desc}], limit: 2) { id }
	}`;
	for (const url of [HASURA, CONSTELLATION]) {
		const result = await gql(
			url,
			list,
			{ date: DATE, label: "back" },
			bearer(owner),
		);
		expect(result.errors).toBeUndefined();
		expect(result.data).toEqual({
			progressPhotos: [{ id: newer }, { id: older }],
		});
	}
	await adminGql(
		`mutation Tie($ids: [uuid!]!, $at: timestamptz!) {
		updateProgressPhotos(where: {id: {_in: $ids}}, _set: {createdAt: $at}) { affected_rows }
	}`,
		{ ids: [older, newer], at: "2024-03-01T00:00:00Z" },
	);
	const expected = [older, newer]
		.sort()
		.reverse()
		.map((id) => ({ id }));
	for (const url of [HASURA, CONSTELLATION]) {
		const result = await gql(
			url,
			list,
			{ date: DATE, label: "back" },
			bearer(owner),
		);
		expect(result.errors).toBeUndefined();
		expect(result.data).toEqual({ progressPhotos: expected });
	}
	await deleteFixture(older, bearer(owner));
	const retired = await adminGql<{ filesToDelete: { id: string }[] }>(
		`query Retired($id: uuid!) { filesToDelete(where: {id: {_eq: $id}}) { id } }`,
		{ id: older },
	);
	expect(retired.filesToDelete).toEqual([]); // Ordinary REST deletion has acknowledged its queue entry.
	expect((await upload(BUCKET, JPEG, bearer(owner), older)).response.ok).toBe(
		false,
	);
	expect((await link(older)).errors).toBeDefined();
	expect(objectExists(older)).toBe(false);
	await deleteFixture(newer, bearer(owner));
});

test("custom REST metadata cannot be linked and the public exercise bucket is not writable", async () => {
	const { id, response } = await upload(
		BUCKET,
		JPEG,
		bearer(owner),
		undefined,
		FILENAME,
		undefined,
		{ note: true },
	);
	expect(response.status).toBe(201);
	expect((await link(id)).errors).toBeDefined();
	await deleteFixture(id, bearer(owner));

	const exercise = await uploadedFixture("exercise_images", admin);
	await setFile(exercise, { uploadedByUserId: owner.id });
	expect(
		(
			await fetchLocal(`${STORAGE}/${exercise}`, {
				method: "DELETE",
				headers: bearer(owner),
			})
		).ok,
	).toBe(false);
	expect(
		(await gql(HASURA, DELETE_FILE, { id: exercise }, bearer(owner))).data,
	).toEqual({ deleteFile: null });
	expect(objectExists(exercise)).toBe(true);
	await deleteFixture(exercise);
});

async function metadata<T>(
	type: string,
	args: Record<string, unknown>,
): Promise<T> {
	const response = await post(METADATA, { type, args }, admin);
	assert(response.ok, `${type} fixture operation failed: ${response.status}`);
	return response.json() as Promise<T>;
}

async function scheduleSweep(payload: Record<string, unknown>) {
	type Trigger = {
		name: string;
		webhook: string;
		headers: { name: string; value_from_env: string }[];
		retry_conf: { timeout_seconds: number };
	};
	const { cron_triggers: triggers } = await metadata<{
		cron_triggers: Trigger[];
	}>("get_cron_triggers", {});
	const trigger = triggers.find(({ name }) => name === "progress_photo_sweep");
	assert(trigger, "progress-photo sweep cron must be installed");
	expect(trigger.webhook).toBe("{{NHOST_FUNCTIONS_URL}}/progress-photos/sweep");
	expect(trigger.headers).toEqual([
		{ name: "nhost-webhook-secret", value_from_env: "NHOST_WEBHOOK_SECRET" },
	]);
	const { event_id: eventId } = await metadata<{ event_id: string }>(
		"create_scheduled_event",
		{
			webhook: trigger.webhook,
			headers: trigger.headers,
			retry_conf: trigger.retry_conf,
			schedule_at: new Date(Date.now() + 1000).toISOString(),
			payload,
		},
	);
	assert(/^[a-f0-9-]{36}$/.test(eventId), "expected a local schedule ID");
	return eventId;
}

async function scheduledStatus(eventId: string) {
	const postgres = localContainer("postgres");
	// Select only HTTP status: Hasura's full invocation log can contain the webhook header.
	for (let attempt = 0; attempt < 25; attempt++) {
		const query = `SELECT status FROM hdb_catalog.hdb_scheduled_event_invocation_logs WHERE event_id = '${eventId}'`;
		const result = Bun.spawnSync([
			"docker",
			"exec",
			"-e",
			"PGOPTIONS=-c default_transaction_read_only=on",
			postgres,
			"psql",
			"-X",
			"-U",
			"postgres",
			"-d",
			"local",
			"-v",
			"ON_ERROR_STOP=1",
			"-Atc",
			query,
		]);
		assert(result.exitCode === 0, "local scheduled invocation read failed");
		const status = result.stdout.toString().trim();
		if (status) return Number(status);
		await Bun.sleep(500);
	}
	throw new Error(
		"scheduler did not record a local delivery within its test budget",
	);
}

async function checkDeletedOwner(
	account: Account,
	id: string,
	unlinked: string,
) {
	const headers = bearer(account);
	await deleteAccount(account.id);
	for (const url of [HASURA, CONSTELLATION]) {
		const denied = await gql<{ file: null }>(url, FILE, { id }, headers);
		expect(denied.errors).toBeUndefined();
		expect(denied.data?.file).toBeNull();
		expect((await link(unlinked, headers, url)).errors).toBeDefined();
	}
	expect(
		(await adminGql<{ progressPhoto: null }>(PHOTO, { id })).progressPhoto,
	).toBeNull();
	for (const method of ["GET", "DELETE"]) {
		expect(
			(await fetchLocal(`${STORAGE}/${id}`, { method, headers })).status,
		).toBe(404);
	}
	const denied = await upload(BUCKET, JPEG, headers);
	expect(denied.response.ok).toBe(false);
	expect(objectExists(denied.id)).toBe(false);
	expect(objectExists(id)).toBe(true);
}

async function holdAttachment(id: string) {
	assert(files.has(id), "attachment transaction must target a suite fixture");
	const config = Bun.spawnSync([
		"docker",
		"exec",
		localContainer("graphql"),
		"printenv",
		"HASURA_GRAPHQL_DATABASE_URL",
	]);
	const mapped = Bun.spawnSync([
		"docker",
		"port",
		localContainer("postgres"),
		"5432/tcp",
	]);
	const port = /^0\.0\.0\.0:(\d+)$/m.exec(mapped.stdout.toString())?.[1];
	assert(
		config.exitCode === 0 && mapped.exitCode === 0 && port,
		"local fixture database is unavailable",
	);
	const url = new URL(config.stdout.toString().trim());
	url.hostname = "127.0.0.1";
	url.port = port;
	const sql = new Bun.SQL({ url: url.href, max: 1, connectionTimeout: 5 });
	const ready = Promise.withResolvers<void>();
	const release = Promise.withResolvers<boolean>();
	const rollback = new Error("fixture rollback requested");
	const result = sql
		.begin(async (tx) => {
			await tx`SET LOCAL idle_in_transaction_session_timeout = '25s'`;
			// Other transactions still see a stale unlinked file until this commits.
			// Make it recent just for the real link trigger, then age it again.
			await tx`UPDATE storage.files SET created_at = now() WHERE id = ${id}`;
			await tx`INSERT INTO public.progress_photos (id, user_id, label, taken_on)
			VALUES (${id}, ${owner.id}, 'back', ${DATE})`;
			await tx`UPDATE storage.files SET created_at = now() - interval '61 minutes' WHERE id = ${id}`;
			ready.resolve();
			if (!(await release.promise)) throw rollback;
		})
		.then(
			() => true,
			(error: unknown) => {
				ready.reject(
					new Error("fixture attachment transaction could not open"),
				);
				return error === rollback;
			},
		);
	try {
		await ready.promise;
	} catch (error) {
		await sql.close({ timeout: 2 });
		throw error;
	}
	return async (commit: boolean) => {
		release.resolve(commit);
		try {
			assert(
				await result,
				"fixture attachment transaction did not close cleanly",
			);
		} finally {
			await sql.close({ timeout: 2 });
		}
	};
}

test("authenticated Node sweep deletes only stale unlinked fixtures and ignores the scheduler payload", async () => {
	const unauthorized: Record<string, string>[] = [
		{},
		bearer(owner),
		{ "nhost-webhook-secret": "not-the-scheduler" },
	];
	for (const headers of unauthorized) {
		expect((await post(SWEEP, {}, headers)).status).toBe(401);
	}
	const account = await fixtureAccount();
	const linked = await uploadedFixture();
	const recent = await uploadedFixture();
	const contended = await uploadedFixture();
	const gap = await uploadedFixture();
	const deletedOwner = await uploadedFixture(BUCKET, bearer(account));
	const deletedOwnerUnlinked = await uploadedFixture(BUCKET, bearer(account));
	const expired = await uploadedFixture();
	const incomplete = crypto.randomUUID();
	files.add(incomplete);
	expect(
		(
			await gql(
				HASURA,
				INSERT_FILE,
				{ object: fileInput(incomplete) },
				bearer(owner),
			)
		).errors,
	).toBeUndefined();
	const exercise = await uploadedFixture("exercise_images", admin);
	expect((await link(linked)).errors).toBeUndefined();
	expect((await link(deletedOwner, bearer(account))).errors).toBeUndefined();
	await checkDeletedOwner(account, deletedOwner, deletedOwnerUnlinked);
	// Never ask the test scheduler to sweep unrelated development records.
	const scope = await adminGql<{ files: { id: string }[] }>(
		`{ files(where: {bucketId: {_eq: "progress_photos"}}) { id } }`,
	);
	assert(
		scope.files.every(({ id }) => files.has(id)),
		"sweep test requires a fixture-only progress bucket",
	);
	const stale = new Date(Date.now() - 61 * 60 * 1000).toISOString();
	for (const id of [
		linked,
		contended,
		deletedOwner,
		deletedOwnerUnlinked,
		expired,
		incomplete,
		exercise,
	])
		await setFile(id, { createdAt: stale });
	await setFile(gap, {
		createdAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
	});
	expect((await link(gap)).errors).toBeDefined();
	const expiredLink = link(expired);
	const closeAttachment = await holdAttachment(contended);
	let eventId: string | undefined;
	let commit = false;
	try {
		eventId = await scheduleSweep({
			id: exercise,
			bucket: "exercise_images",
			cutoff: "9999-01-01",
		});
		const [status, rejected] = await Promise.all([
			scheduledStatus(eventId),
			expiredLink,
		]);
		expect(status).toBe(200);
		expect(rejected.errors).toBeDefined();
		for (const id of [
			deletedOwner,
			deletedOwnerUnlinked,
			expired,
			incomplete,
		]) {
			expect((await adminGql<{ file: null }>(FILE, { id })).file).toBeNull();
			expect(objectExists(id)).toBe(false);
			files.delete(id);
		}
		commit = true;
	} finally {
		try {
			await closeAttachment(commit);
		} finally {
			if (eventId)
				await metadata("delete_scheduled_event", {
					type: "one_off",
					event_id: eventId,
				});
		}
	}
	expect(
		(
			await gql<{ progressPhoto: Photo }>(
				HASURA,
				PHOTO,
				{ id: contended },
				bearer(owner),
			)
		).data?.progressPhoto?.id,
	).toBe(contended);
	for (const id of [linked, recent, gap, contended, exercise]) {
		expect(objectExists(id)).toBe(true);
		await deleteFixture(id);
	}
}, 30000);
