/// <reference path="./bun-test.d.ts" />

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	data,
	expectConstraint,
	gql,
	HASURA_URL,
	JPEG,
	NHOST_GRAPHQL_URL,
	STORAGE_URL,
} from "./progress-photos-helpers";
import {
	adminFile,
	expectJPEG,
	expectPrivate,
	gqlJWT,
	StorageFixtures,
	storageJWT,
} from "./progress-photos-storage-helpers";

// No reachability/optional skips: this suite must run against the approved local
// stack after the permission migration. All tested requests use real JWTs and
// omit admin-secret headers; only fixture setup/cleanup/state proof uses admin.
const fixtures = new StorageFixtures();
const endpoints = [HASURA_URL, NHOST_GRAPHQL_URL];
const fileQuery = `query ($id: uuid!) { file(id: $id) { id bucketId uploadedByUserId isUploaded mimeType etag } }`;
const photoQuery = `query ($id: uuid!) { progressPhoto(id: $id) { id fileId revision takenOn } }`;
interface Photo {
	id: string;
	fileId: string;
	revision: number;
	takenOn: string;
}
let dayNumber = 0;
async function attach(fileId: string): Promise<Photo> {
	const takenOn = new Date(Date.UTC(2050, 0, ++dayNumber))
		.toISOString()
		.slice(0, 10);
	return data(
		await gqlJWT<{ insertProgressPhoto: Photo }>(
			fixtures.ownerToken,
			`mutation ($file: uuid!, $day: date!) { insertProgressPhoto(object: {fileId: $file, takenOn: $day, labelId: "front_1"}) { id fileId revision takenOn } }`,
			{ file: fileId, day: takenOn },
		),
	).insertProgressPhoto;
}
async function photo(id: string): Promise<Photo | null> {
	return data(await gql<{ progressPhoto: Photo | null }>(photoQuery, { id }))
		.progressPhoto;
}
async function replaceReference(current: Photo, fileId: string) {
	return data(
		await gqlJWT<{ updateProgressPhotos: { affected_rows: number } }>(
			fixtures.ownerToken,
			`mutation ($id: uuid!, $old: uuid!, $revision: Int!, $file: uuid!) {
			updateProgressPhotos(where: {id: {_eq: $id}, fileId: {_eq: $old}, revision: {_eq: $revision}}, _set: {fileId: $file}) { affected_rows }
		}`,
			{
				id: current.id,
				old: current.fileId,
				revision: current.revision,
				file: fileId,
			},
		),
	).updateProgressPhotos.affected_rows;
}

beforeAll(async () => {
	const version = await fetch(`${STORAGE_URL}/version`, {
		signal: AbortSignal.timeout(2000),
	});
	expect(version.status).toBe(200);
	expect(
		((await version.json()) as { buildVersion: string }).buildVersion,
	).toBe("0.15.1");
	await fixtures.initialize();
});
afterAll(async () => {
	await fixtures.cleanup();
});

describe("real-JWT progress uploads and immutable Storage metadata", () => {
	test("server sniffs JPEG and presets uploader despite forged headers/metadata", async () => {
		const { id, response } = await fixtures.uploadJWT({
			type: "text/plain",
			extra: { "x-hasura-user-id": fixtures.otherId, "x-hasura-role": "user" },
			metadata: {
				uploadedByUserId: fixtures.otherId,
				uploaded_by_user_id: fixtures.otherId,
				isUploaded: true,
			},
		});
		expect(response.status).toBe(201);
		expect(await adminFile(id)).toMatchObject({
			id,
			bucketId: "progress_photos",
			uploadedByUserId: fixtures.ownerId,
			isUploaded: true,
			mimeType: "image/jpeg",
		});
		await expectJPEG(fixtures.ownerToken, id);
		expect((await storageJWT(fixtures.otherToken, id)).status).toBe(404);
	});

	for (const [name, options, status, message] of [
		[
			"exercise bucket",
			{ bucket: "exercise_images" },
			403,
			"you are not authorized",
		],
		[
			"missing bucket",
			{ bucket: `missing_${crypto.randomUUID()}` },
			404,
			"bucket not found",
		],
		[
			"text with JPEG content-type",
			{ bytes: Buffer.from("not an image"), type: "image/jpeg" },
			403,
			"you are not authorized",
		],
		[
			"PNG with JPEG content-type",
			{
				bytes: Buffer.from(
					"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=",
					"base64",
				),
				type: "image/jpeg",
			},
			403,
			"you are not authorized",
		],
		["empty file", { bytes: new Uint8Array(0) }, 400, "file too small"],
		[
			"actual oversized file",
			{ bytes: Buffer.concat([JPEG, Buffer.alloc(5242881 - JPEG.length)]) },
			400,
			"file too big",
		],
		["anonymous upload", { token: "" }, 403, "you are not authorized"],
		[
			"forged admin role",
			{ extra: { "x-hasura-role": "admin" } },
			403,
			"you are not authorized",
		],
	] as const) {
		test(`${name} upload is denied without creating file metadata`, async () => {
			const original = await fixtures.uploaded();
			const etag = await expectJPEG(fixtures.ownerToken, original);
			const { id, response } = await fixtures.uploadJWT(options);
			expect(response.status).toBe(status);
			const body = (await response.json()) as { error?: { message: string } };
			expect(body.error?.message).toBe(message);
			expect(await adminFile(id)).toBeNull();
			expect(await expectJPEG(fixtures.ownerToken, original)).toBe(etag);
		});
	}

	for (const endpoint of endpoints) {
		test(`direct inserts cannot forge completion/ownership; incomplete files cannot attach via ${new URL(endpoint).hostname}`, async () => {
			const id = crypto.randomUUID();
			fixtures.fileIds.add(id);
			const object = {
				id,
				bucketId: "progress_photos",
				name: "image.jpg",
				size: JPEG.length,
				mimeType: "image/jpeg",
			};
			const insert = `mutation ($object: files_insert_input!) { insertFile(object: $object) { id uploadedByUserId isUploaded } }`;
			const inserted = data(
				await gqlJWT<{
					insertFile: {
						id: string;
						uploadedByUserId: string;
						isUploaded: boolean;
					};
				}>(fixtures.ownerToken, insert, { object }, endpoint),
			);
			expect(inserted.insertFile).toEqual({
				id,
				uploadedByUserId: fixtures.ownerId,
				isUploaded: false,
			});
			expect(await adminFile(id)).toMatchObject({
				isUploaded: false,
				etag: null,
			});
			// Storage's metadata DTO dereferences nullable etag before its
			// completion guard. Direct incomplete rows therefore return 500,
			// not the intended 403. Prove failed attachment/state separately;
			// a service error by itself is not authorization evidence.
			for (const method of ["GET", "HEAD"]) {
				expect((await storageJWT(fixtures.ownerToken, id, method)).status).toBe(
					500,
				);
			}
			expectConstraint(
				await gqlJWT(
					fixtures.ownerToken,
					`mutation ($file: uuid!) { insertProgressPhoto(object: {fileId: $file, takenOn: "2051-01-01", labelId: "back_1"}) { id } }`,
					{ file: id },
				),
				"progress_photos_file_check",
			);
			expect(
				data(
					await gqlJWT<{ progressPhotos: unknown[] }>(
						fixtures.ownerToken,
						`query ($file: uuid!) { progressPhotos(where: {fileId: {_eq: $file}}) { id } }`,
						{ file: id },
						endpoint,
					),
				).progressPhotos,
			).toEqual([]);
			for (const forbidden of [
				{ isUploaded: true },
				{ uploadedByUserId: fixtures.otherId },
				{ etag: "forged" },
			]) {
				const deniedId = crypto.randomUUID();
				fixtures.fileIds.add(deniedId);
				const denied = await gqlJWT(
					fixtures.ownerToken,
					insert,
					{ object: { ...object, id: deniedId, ...forbidden } },
					endpoint,
				);
				expect(denied.errors).toBeDefined();
				if (endpoint === HASURA_URL)
					expect(denied.errors?.[0].extensions?.code).toBe("validation-failed");
				expect(await adminFile(deniedId)).toBeNull();
			}
			for (const forbidden of [
				{ bucketId: "exercise_images" },
				{ mimeType: "image/png" },
			]) {
				const deniedId = crypto.randomUUID();
				fixtures.fileIds.add(deniedId);
				const denied = await gqlJWT(
					fixtures.ownerToken,
					insert,
					{ object: { ...object, id: deniedId, ...forbidden } },
					endpoint,
				);
				expect(denied.errors).toBeDefined();
				if (endpoint === HASURA_URL)
					expect(denied.errors?.[0].extensions?.code).toBe("permission-error");
				expect(await adminFile(deniedId)).toBeNull();
			}
			expect(await adminFile(id)).toMatchObject({
				uploadedByUserId: fixtures.ownerId,
				isUploaded: false,
			});
		});
	}
});

describe("private read, cache headers and byte immutability", () => {
	test("only owner GET/HEAD/transforms succeed and each response is private/no-store", async () => {
		const id = await fixtures.uploaded();
		for (const query of ["", "?w=1&h=1&f=jpeg"]) {
			for (const method of ["GET", "HEAD"]) {
				const response = await storageJWT(
					fixtures.ownerToken,
					id,
					method,
					query,
				);
				expectPrivate(response);
				expect(response.headers.get("content-type")).toBe("image/jpeg");
				if (method === "GET")
					expect((await response.arrayBuffer()).byteLength > 0).toBe(true);
				for (const token of [undefined, fixtures.otherToken]) {
					expect((await storageJWT(token, id, method, query)).status).toBe(404);
				}
			}
		}
		const presigned = await storageJWT(
			fixtures.ownerToken,
			id,
			"GET",
			"/presignedurl",
		);
		expect(presigned.status).toBe(403);
		expect(
			((await presigned.json()) as { error: { message: string } }).error
				.message,
		).toBe(
			"presigned URLs are not enabled on the bucket where this file is located in",
		);
		for (const token of [undefined, fixtures.otherToken]) {
			expect((await storageJWT(token, id, "GET", "/presignedurl")).status).toBe(
				404,
			);
		}
		await expectJPEG(fixtures.ownerToken, id);
	});

	for (const endpoint of endpoints) {
		test(`JWT read isolation and ignored forged user ID via ${new URL(endpoint).hostname}`, async () => {
			const id = await fixtures.uploaded();
			const owner = data(
				await gqlJWT<{ file: { id: string; uploadedByUserId: string } }>(
					fixtures.ownerToken,
					fileQuery,
					{ id },
					endpoint,
					{ "x-hasura-user-id": fixtures.otherId },
				),
			);
			expect(owner.file.id).toBe(id);
			expect(owner.file.uploadedByUserId).toBe(fixtures.ownerId);
			for (const token of [fixtures.otherToken, undefined]) {
				expect(
					data(
						await gqlJWT<{ file: unknown }>(
							token,
							fileQuery,
							{ id },
							endpoint,
							{ "x-hasura-user-id": fixtures.ownerId },
						),
					).file,
				).toBeNull();
				const list = data(
					await gqlJWT<{ files: unknown[] }>(
						token,
						`query ($id: uuid!) { files(where: {id: {_eq: $id}}) { id } }`,
						{ id },
						endpoint,
					),
				);
				expect(list.files).toEqual([]);
			}
			await expectJPEG(fixtures.ownerToken, id);
		});
	}

	test("denied PUT and forged owner reads/deletes preserve original bytes, metadata and etag", async () => {
		const id = await fixtures.uploaded();
		const current = await attach(id);
		const etag = await expectJPEG(fixtures.ownerToken, id);
		const metadata = await adminFile(id);
		for (const [token, status] of [
			[fixtures.ownerToken, 403],
			[fixtures.otherToken, 404],
			[undefined, 404],
		] as const) {
			expect((await fixtures.replaceJWT(token, id)).status).toBe(status);
			expect(await expectJPEG(fixtures.ownerToken, id)).toBe(etag);
			expect(await adminFile(id)).toEqual(metadata);
		}
		for (const method of ["GET", "HEAD", "DELETE"]) {
			expect(
				(
					await storageJWT(fixtures.otherToken, id, method, "", {
						"x-hasura-user-id": fixtures.ownerId,
					})
				).status,
			).toBe(404);
		}
		expect(await photo(current.id)).toEqual(current);
		expect(await expectJPEG(fixtures.ownerToken, id)).toBe(etag);
		expect(await adminFile(id)).toEqual(metadata);
	});
});

describe("owner file deletion, cascade and replacement races", () => {
	test("foreign/anonymous DELETE preserves the photo; owner REST DELETE cascades metadata", async () => {
		const id = await fixtures.uploaded();
		const current = await attach(id);
		for (const token of [fixtures.otherToken, undefined]) {
			// Foreign JWT has the delete root but no matching row (404);
			// public has no delete root at all (403).
			expect((await storageJWT(token, id, "DELETE")).status).toBe(
				token ? 404 : 403,
			);
			expect(await photo(current.id)).toEqual(current);
			await expectJPEG(fixtures.ownerToken, id);
		}
		expect((await storageJWT(fixtures.ownerToken, id, "DELETE")).status).toBe(
			204,
		);
		expect(await adminFile(id)).toBeNull();
		expect(await photo(current.id)).toBeNull();
		for (const token of [fixtures.ownerToken, fixtures.otherToken, undefined]) {
			for (const query of ["", "?w=1&h=1&f=jpeg"]) {
				for (const method of ["GET", "HEAD"])
					expect((await storageJWT(token, id, method, query)).status).toBe(404);
			}
		}
		// API 404 is not physical-byte evidence. The mandatory independent
		// owner-byte-probe uses a scoped, read-only exact MinIO path check.
	});

	for (const endpoint of endpoints) {
		test(`GraphQL metadata deletion is owner/bucket scoped via ${new URL(endpoint).hostname}`, async () => {
			// Incomplete metadata deliberately has no bytes: test the exposed
			// GraphQL delete surface without abandoning an S3 object.
			const id = crypto.randomUUID();
			fixtures.fileIds.add(id);
			data(
				await gqlJWT(
					fixtures.ownerToken,
					`mutation ($id: uuid!) { insertFile(object: {id: $id, bucketId: "progress_photos", mimeType: "image/jpeg", name: "image.jpg", size: 1}) { id } }`,
					{ id },
					endpoint,
				),
			);
			const exercise = await fixtures.upload(
				fixtures.ownerId,
				"exercise_images",
			);
			const remove = `mutation ($id: uuid!) { deleteFile(id: $id) { id } }`;
			const bulk = `mutation ($id: uuid!) { deleteFiles(where: {id: {_eq: $id}}) { affected_rows } }`;
			expect(
				data(
					await gqlJWT<{ deleteFile: unknown }>(
						fixtures.otherToken,
						remove,
						{ id },
						endpoint,
						{ "x-hasura-user-id": fixtures.ownerId },
					),
				).deleteFile,
			).toBeNull();
			expect(
				data(
					await gqlJWT<{ deleteFiles: { affected_rows: number } }>(
						fixtures.otherToken,
						bulk,
						{ id },
						endpoint,
					),
				).deleteFiles.affected_rows,
			).toBe(0);
			expect(
				data(
					await gqlJWT<{ deleteFile: unknown }>(
						fixtures.ownerToken,
						remove,
						{ id: exercise },
						endpoint,
					),
				).deleteFile,
			).toBeNull();
			expect(await adminFile(id)).toMatchObject({ id, isUploaded: false });
			await expectJPEG(undefined, exercise);
			expect(
				data(
					await gqlJWT<{ deleteFile: { id: string } }>(
						fixtures.ownerToken,
						remove,
						{ id },
						endpoint,
					),
				).deleteFile.id,
			).toBe(id);
			expect(await adminFile(id)).toBeNull();
		});
	}

	test("deleting a confirmed old file after replacement leaves the new photo/bytes intact", async () => {
		const current = await attach(await fixtures.uploaded());
		const replacement = await fixtures.uploaded();
		expect(await replaceReference(current, replacement)).toBe(1);
		expect(
			(await storageJWT(fixtures.ownerToken, current.fileId, "DELETE")).status,
		).toBe(204);
		expect(await photo(current.id)).toMatchObject({
			fileId: replacement,
			revision: 2,
		});
		await expectJPEG(fixtures.ownerToken, replacement);
	});

	test("concurrent CAS replacement vs exact old-file delete never retargets the replacement", async () => {
		for (let attempt = 0; attempt < 3; attempt++) {
			const current = await attach(await fixtures.uploaded());
			const replacement = await fixtures.uploaded();
			const [affected, removed] = await Promise.all([
				replaceReference(current, replacement),
				storageJWT(fixtures.ownerToken, current.fileId, "DELETE"),
			]);
			expect(removed.status).toBe(204);
			expect(await adminFile(current.fileId)).toBeNull();
			const remaining = await photo(current.id);
			if (affected === 1)
				expect(remaining).toMatchObject({ fileId: replacement, revision: 2 });
			else {
				expect(affected).toBe(0);
				expect(remaining).toBeNull();
			}
			await expectJPEG(fixtures.ownerToken, replacement);
		}
	});

	test("a date-only edit racing deletion of the same file is delete-wins", async () => {
		const current = await attach(await fixtures.uploaded());
		const [edited, removed] = await Promise.all([
			gqlJWT<{ updateProgressPhotos: { affected_rows: number } }>(
				fixtures.ownerToken,
				`mutation ($id: uuid!, $revision: Int!) { updateProgressPhotos(where: {id: {_eq: $id}, revision: {_eq: $revision}}, _set: {takenOn: "2052-01-01"}) { affected_rows } }`,
				{ id: current.id, revision: current.revision },
			),
			storageJWT(fixtures.ownerToken, current.fileId, "DELETE"),
		]);
		expect([0, 1]).toContain(data(edited).updateProgressPhotos.affected_rows);
		expect(removed.status).toBe(204);
		expect(await photo(current.id)).toBeNull();
	});
});

describe("exercise image compatibility", () => {
	test("exercise reads stay public while uploads/replacement/deletion stay denied", async () => {
		const id = await fixtures.upload(fixtures.ownerId, "exercise_images");
		const etag = await expectJPEG(undefined, id);
		for (const token of [undefined, fixtures.ownerToken, fixtures.otherToken]) {
			await expectJPEG(token, id);
			for (const endpoint of endpoints)
				expect(
					data(
						await gqlJWT<{ file: { id: string } }>(
							token,
							fileQuery,
							{ id },
							endpoint,
						),
					).file.id,
				).toBe(id);
			expect((await fixtures.replaceJWT(token, id)).status).toBe(403);
			expect((await storageJWT(token, id, "DELETE")).status).toBe(
				token ? 404 : 403,
			);
			expect(await expectJPEG(undefined, id)).toBe(etag);
		}
	});
});
