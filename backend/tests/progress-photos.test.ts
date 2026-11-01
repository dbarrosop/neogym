/// <reference path="./bun-test.d.ts" />

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import {
	data,
	expectConstraint,
	gql,
	HASURA_URL,
	JPEG,
	NHOST_GRAPHQL_URL,
	PhotoFixtures,
	rollbackProbe,
	STORAGE_URL,
} from "./progress-photos-helpers";

// Model/FK serialization plus the current owner-only Storage permission boundary.
// No reachability skips: unavailable/wrong local services fail the suite.
const fixtures = new PhotoFixtures();
const fields = "id userId takenOn labelId fileId revision createdAt updatedAt";
const insert = `mutation ($object: progressPhotos_insert_input!) {
	insertProgressPhoto(object: $object) { ${fields} }
}`;
const update = `mutation ($where: progressPhotos_bool_exp!, $set: progressPhotos_set_input!) {
	updateProgressPhotos(where: $where, _set: $set) { affected_rows returning { ${fields} } }
}`;
const read = `query ($id: uuid!) { progressPhoto(id: $id) { ${fields} label { id name isActive } } }`;
interface Photo {
	id: string;
	userId: string;
	takenOn: string;
	labelId: string;
	fileId: string;
	revision: number;
	createdAt: string;
	updatedAt: string;
	label?: { id: string; name: string; isActive: boolean };
}
let dayNumber = 0;
function day(): string {
	return new Date(Date.UTC(2040, 0, ++dayNumber)).toISOString().slice(0, 10);
}
async function create(
	fileId: string,
	takenOn = day(),
	labelId = "front_1",
	userId = fixtures.ownerId,
): Promise<Photo> {
	return data(
		await gql<{ insertProgressPhoto: Photo }>(
			insert,
			{ object: { fileId, takenOn, labelId } },
			userId,
		),
	).insertProgressPhoto;
}
async function get(
	id: string,
	userId = fixtures.ownerId,
	endpoint = HASURA_URL,
): Promise<Photo | null> {
	return data(
		await gql<{ progressPhoto: Photo | null }>(read, { id }, userId, endpoint),
	).progressPhoto;
}
async function edit(
	photo: Photo,
	set: Record<string, unknown>,
	userId = fixtures.ownerId,
	revision = photo.revision,
) {
	return gql<{
		updateProgressPhotos: { affected_rows: number; returning: Photo[] };
	}>(
		update,
		{
			where: {
				id: { _eq: photo.id },
				revision: { _eq: revision },
				fileId: { _eq: photo.fileId },
			},
			set,
		},
		userId,
	);
}

beforeAll(async () => {
	data(await gql("{ __typename }"));
	const response = await fetch(`${STORAGE_URL}/version`, {
		signal: AbortSignal.timeout(2000),
	});
	expect(response.status).toBe(200);
	expect(
		((await response.json()) as { buildVersion: string }).buildVersion,
	).toBe("0.15.1");
	await fixtures.initialize();
});
afterAll(async () => {
	await fixtures.cleanup();
});

describe("progress photo model", () => {
	test("migration seeds the ordered dynamic label catalog and private bucket without changing exercise images", async () => {
		const result = data(
			await gql<{
				progressPhotoLabels: Array<{
					id: string;
					name: string;
					position: number;
					isActive: boolean;
				}>;
				bucket: {
					cacheControl: string;
					minUploadFileSize: number;
					maxUploadFileSize: number;
					presignedUrlsEnabled: boolean;
				};
				exercise: {
					cacheControl: string;
					minUploadFileSize: number;
					maxUploadFileSize: number;
					presignedUrlsEnabled: boolean;
				};
			}>(`{
			progressPhotoLabels(where: {id: {_in: ["front_1", "front_2", "back_1", "back_2"]}}, order_by: {position: asc}) { id name position isActive }
			bucket(id: "progress_photos") { cacheControl minUploadFileSize maxUploadFileSize presignedUrlsEnabled }
			exercise: bucket(id: "exercise_images") { cacheControl minUploadFileSize maxUploadFileSize presignedUrlsEnabled }
		}`),
		);
		expect(result.progressPhotoLabels).toEqual([
			{ id: "front_1", name: "Front 1", position: 0, isActive: true },
			{ id: "front_2", name: "Front 2", position: 1, isActive: true },
			{ id: "back_1", name: "Back 1", position: 2, isActive: true },
			{ id: "back_2", name: "Back 2", position: 3, isActive: true },
		]);
		expect(result.bucket).toEqual({
			cacheControl: "private, no-store",
			minUploadFileSize: 1,
			maxUploadFileSize: 5242880,
			presignedUrlsEnabled: false,
		});
		expect(result.exercise).toEqual({
			cacheControl: "public, max-age=31536000",
			minUploadFileSize: 1,
			maxUploadFileSize: 5242880,
			presignedUrlsEnabled: true,
		});
	});

	for (const endpoint of [HASURA_URL, NHOST_GRAPHQL_URL]) {
		test(`owner preset, private reads/aggregates and foreign write denial via ${new URL(endpoint).hostname}`, async () => {
			const fileId = await fixtures.upload();
			const photo = data(
				await gql<{ insertProgressPhoto: Photo }>(
					insert,
					{ object: { fileId, takenOn: day(), labelId: "front_1" } },
					fixtures.ownerId,
					endpoint,
				),
			).insertProgressPhoto;
			expect(photo.userId).toBe(fixtures.ownerId);
			expect(photo.revision).toBe(1);
			expect((await get(photo.id, fixtures.ownerId, endpoint))?.fileId).toBe(
				fileId,
			);
			expect(await get(photo.id, fixtures.otherId, endpoint)).toBeNull();
			const foreign = data(
				await gql<{
					progressPhotos: Photo[];
					progressPhotosAggregate: { aggregate: { count: number } };
				}>(
					`query ($id: uuid!) {
					progressPhotos(where: {id: {_eq: $id}}) { id }
					progressPhotosAggregate(where: {id: {_eq: $id}}) { aggregate { count } }
				}`,
					{ id: photo.id },
					fixtures.otherId,
					endpoint,
				),
			);
			expect(foreign.progressPhotos).toEqual([]);
			expect(foreign.progressPhotosAggregate.aggregate.count).toBe(0);
			const denied = data(
				await gql<{ updateProgressPhotos: { affected_rows: number } }>(
					update,
					{ where: { id: { _eq: photo.id } }, set: { takenOn: day() } },
					fixtures.otherId,
					endpoint,
				),
			);
			expect(denied.updateProgressPhotos.affected_rows).toBe(0);
			const foreignInsert = await gql<{ insertProgressPhoto: Photo }>(
				insert,
				{ object: { fileId, takenOn: day(), labelId: "front_2" } },
				fixtures.otherId,
				endpoint,
			);
			if (endpoint === HASURA_URL) {
				expectConstraint(foreignInsert, "progress_photos_file_check");
			} else {
				// Constellation masks database errors; pair its exact response
				// contract with the Hasura CHECK assertion and persisted-state proof.
				expect(foreignInsert.data?.insertProgressPhoto).toBeUndefined();
				expect(foreignInsert.errors).toHaveLength(1);
				expect(foreignInsert.errors?.[0].extensions).toBeUndefined();
				expect(foreignInsert.errors?.[0].message).toMatch(
					/^internal server error \(trace id: [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\)$/,
				);
			}
			const persisted = data(
				await gql<{ progressPhotos: Array<{ id: string; userId: string }> }>(
					`query ($file: uuid!) { progressPhotos(where: {fileId: {_eq: $file}}) { id userId } }`,
					{ file: fileId },
				),
			).progressPhotos;
			expect(persisted).toEqual([{ id: photo.id, userId: fixtures.ownerId }]);
			expect((await get(photo.id))?.takenOn).toBe(photo.takenOn);
		});
	}

	test("photo identity is immutable in SQL and user inputs exclude identity, timestamps and revision", async () => {
		const photo = await create(await fixtures.upload());
		for (const set of [
			{ userId: fixtures.otherId },
			{ id: crypto.randomUUID() },
		]) {
			expectConstraint(
				await gql(
					`mutation ($id: uuid!, $set: progressPhotos_set_input!) {
				updateProgressPhoto(pk_columns: {id: $id}, _set: $set) { id }
			}`,
					{ id: photo.id, set },
				),
				"progress_photos_identity_check",
			);
		}
		for (const field of [
			"id",
			"userId",
			"createdAt",
			"updatedAt",
			"revision",
		]) {
			const result = data(
				await gql<{ __type: { inputFields: Array<{ name: string }> } }>(
					`query ($name: String!) { __type(name: $name) { inputFields { name } } }`,
					{ name: "progressPhotos_insert_input" },
					fixtures.ownerId,
				),
			);
			expect(
				result.__type.inputFields.map((entry) => entry.name),
			).not.toContain(field);
			const updateType = data(
				await gql<{ __type: { inputFields: Array<{ name: string }> } }>(
					`query { __type(name: "progressPhotos_set_input") { inputFields { name } } }`,
					{},
					fixtures.ownerId,
				),
			);
			expect(
				updateType.__type.inputFields.map((entry) => entry.name),
			).not.toContain(field);
		}
		expect((await get(photo.id))?.userId).toBe(fixtures.ownerId);
	});

	for (const takenOn of ["0001-01-01", "9999-12-31", "2024-02-29"]) {
		test(`ordinary Gregorian boundary ${takenOn} is allowed`, async () => {
			expect((await create(await fixtures.upload(), takenOn)).takenOn).toBe(
				takenOn,
			);
		});
	}
	for (const takenOn of [
		"infinity",
		"-infinity",
		"0001-01-01 BC",
		"10000-01-01",
	]) {
		test(`nonordinary date ${takenOn} is rejected`, async () => {
			expectConstraint(
				await gql(
					insert,
					{
						object: {
							fileId: await fixtures.upload(),
							takenOn,
							labelId: "front_1",
						},
					},
					fixtures.ownerId,
				),
				"progress_photos_taken_on_check",
			);
		});
	}
	for (const takenOn of ["2023-02-29", "2024-04-31", "0000-01-01"]) {
		test(`invalid calendar date ${takenOn} is rejected`, async () => {
			const result = await gql(
				insert,
				{
					object: {
						fileId: await fixtures.upload(),
						takenOn,
						labelId: "front_1",
					},
				},
				fixtures.ownerId,
			);
			expect(result.errors).toBeDefined();
			expect(["data-exception", "validation-failed"]).toContain(
				result.errors?.[0].extensions?.code,
			);
		});
	}

	test("unknown and retired assignments fail; current retired label remains readable/retainable and displays renames", async () => {
		const labelId = await fixtures.label();
		const photo = await create(await fixtures.upload(), day(), labelId);
		data(
			await gql(
				`mutation ($id: String!) {
			updateProgressPhotoLabel(pk_columns: {id: $id}, _set: {isActive: false, name: "Renamed retired label"}) { id }
		}`,
				{ id: labelId },
			),
		);
		const retained = data(await edit(photo, { labelId, takenOn: day() }))
			.updateProgressPhotos.returning[0];
		expect(retained.revision).toBe(2);
		const replacement = data(
			await edit(retained, { fileId: await fixtures.upload(), labelId }),
		).updateProgressPhotos;
		expect(replacement.affected_rows).toBe(1);
		expect(replacement.returning[0].revision).toBe(3);
		expect((await get(photo.id))?.label).toEqual({
			id: labelId,
			name: "Renamed retired label",
			isActive: false,
		});
		const newFile = await fixtures.upload();
		expectConstraint(
			await gql(
				insert,
				{ object: { fileId: newFile, takenOn: day(), labelId } },
				fixtures.ownerId,
			),
			"progress_photos_active_label_check",
		);
		const other = await create(newFile);
		expectConstraint(
			await edit(other, { labelId }),
			"progress_photos_active_label_check",
		);
		expectConstraint(
			await gql(
				insert,
				{
					object: {
						fileId: await fixtures.upload(),
						takenOn: day(),
						labelId: `missing_${crypto.randomUUID()}`,
					},
				},
				fixtures.ownerId,
			),
			"progress_photos_label_id_fkey",
		);
		expectConstraint(
			await gql(
				`mutation ($id: String!) {
			deleteProgressPhotoLabel(id: $id) { id }
		}`,
				{ id: labelId },
			),
			"progress_photos_label_id_fkey",
		);
		expectConstraint(
			await gql(
				`mutation ($id: String!, $new: String!) {
			updateProgressPhotoLabel(pk_columns: {id: $id}, _set: {id: $new}) { id }
		}`,
				{ id: labelId, new: `changed_${labelId}` },
			),
			"progress_photo_labels_identity_check",
		);
	});

	for (const [invalid, makeFile] of Object.entries({
		foreign: () => fixtures.upload(fixtures.otherId),
		"wrong-bucket": () => fixtures.upload(fixtures.ownerId, "exercise_images"),
		"no-uploader": () => fixtures.upload(null),
		incomplete: () => fixtures.incompleteFile(),
		missing: () => Promise.resolve(crypto.randomUUID()),
	})) {
		test(`${invalid} file cannot be attached or used as a replacement`, async () => {
			const fileId = await makeFile();
			expectConstraint(
				await gql(
					insert,
					{ object: { fileId, takenOn: day(), labelId: "front_1" } },
					fixtures.ownerId,
				),
				"progress_photos_file_check",
			);
			const photo = await create(await fixtures.upload());
			expectConstraint(
				await edit(photo, { fileId }),
				"progress_photos_file_check",
			);
			expect((await get(photo.id))?.fileId).toBe(photo.fileId);
			expect((await get(photo.id))?.revision).toBe(1);
		});
	}

	test("required fields and invalid date corrections fail without changing the photo", async () => {
		const photo = await create(await fixtures.upload());
		expectConstraint(
			await edit(photo, { takenOn: "infinity" }),
			"progress_photos_taken_on_check",
		);
		for (const field of ["takenOn", "labelId", "fileId"]) {
			const result = await edit(photo, { [field]: null });
			expect(result.errors).toBeDefined();
		}
		expect((await get(photo.id))?.revision).toBe(1);
		expect((await get(photo.id))?.takenOn).toBe(photo.takenOn);
	});

	test("duplicate creates/edits and reuse of an attached file never overwrite existing data", async () => {
		const first = await create(await fixtures.upload());
		const secondFile = await fixtures.upload();
		expectConstraint(
			await gql(
				insert,
				{
					object: {
						fileId: secondFile,
						takenOn: first.takenOn,
						labelId: first.labelId,
					},
				},
				fixtures.ownerId,
			),
			"progress_photos_user_date_label_key",
		);
		expectConstraint(
			await gql(
				insert,
				{ object: { fileId: first.fileId, takenOn: day(), labelId: "back_1" } },
				fixtures.ownerId,
			),
			"progress_photos_file_key",
		);
		const second = await create(secondFile);
		expectConstraint(
			await edit(second, { takenOn: first.takenOn, labelId: first.labelId }),
			"progress_photos_user_date_label_key",
		);
		expectConstraint(
			await edit(second, { fileId: first.fileId }),
			"progress_photos_file_key",
		);
		expect((await get(first.id))?.fileId).toBe(first.fileId);
		expect((await get(second.id))?.revision).toBe(1);
		// Same date/label for a different owner is a different slot.
		expect(
			(
				await create(
					await fixtures.upload(fixtures.otherId),
					first.takenOn,
					first.labelId,
					fixtures.otherId,
				)
			).userId,
		).toBe(fixtures.otherId);
	});

	test("CAS atomically changes date/label/file and server increments revision; stale updates affect zero rows", async () => {
		const photo = await create(await fixtures.upload());
		const fileId = await fixtures.upload();
		const changed = data(
			await edit(photo, { fileId, labelId: "back_2", takenOn: day() }),
		).updateProgressPhotos;
		expect(changed.affected_rows).toBe(1);
		expect(changed.returning[0].revision).toBe(2);
		expect(changed.returning[0].fileId).toBe(fileId);
		expect(changed.returning[0].labelId).toBe("back_2");
		expect(
			data(await edit(photo, { takenOn: day() })).updateProgressPhotos
				.affected_rows,
		).toBe(0);
		const current = changed.returning[0];
		const admin = data(
			await gql<{ updateProgressPhoto: Photo }>(
				`mutation ($id: uuid!) {
			updateProgressPhoto(pk_columns: {id: $id}, _set: {revision: 999, createdAt: "2000-01-01T00:00:00Z"}) { ${fields} }
		}`,
				{ id: photo.id },
			),
		).updateProgressPhoto;
		expect(admin.revision).toBe(3);
		expect(admin.createdAt).toBe(photo.createdAt);
		expect(admin.fileId).toBe(current.fileId);
	});

	test("concurrent slot creates have one winner and a named uniqueness failure", async () => {
		const files = await Promise.all([fixtures.upload(), fixtures.upload()]);
		const takenOn = day();
		const results = await Promise.all(
			files.map((fileId) =>
				gql<{ insertProgressPhoto: Photo }>(
					insert,
					{ object: { fileId, takenOn, labelId: "front_2" } },
					fixtures.ownerId,
				),
			),
		);
		expect(results.filter((result) => !result.errors)).toHaveLength(1);
		const failed = results.find((result) => result.errors);
		expect(failed).toBeDefined();
		if (!failed) throw new Error("slot race unexpectedly had no failure");
		expectConstraint(failed, "progress_photos_user_date_label_key");
	});

	test("concurrent revision updates have one winner without losing either staged file", async () => {
		const photo = await create(await fixtures.upload());
		const files = await Promise.all([fixtures.upload(), fixtures.upload()]);
		const results = await Promise.all(
			files.map((fileId) => edit(photo, { fileId })),
		);
		expect(
			results
				.map((result) => data(result).updateProgressPhotos.affected_rows)
				.sort(),
		).toEqual([0, 1]);
		expect((await get(photo.id))?.revision).toBe(2);
		for (const fileId of files)
			expect((await fixtures.getFile(fileId)).status).toBe(200);
	});
});

describe("progress photo file cascade and rollback safety", () => {
	test("admin Storage REST deletion removes file metadata and its photo via the FK", async () => {
		const photo = await create(await fixtures.upload());
		const before = await fixtures.getFile(photo.fileId);
		expect(before.status).toBe(200);
		expect(Buffer.from(await before.arrayBuffer())).toEqual(JPEG);
		expect(await fixtures.deleteFile(photo.fileId)).toBe(204);
		expect(await get(photo.id)).toBeNull();
		const result = data(
			await gql<{ file: { id: string } | null; progressPhoto: Photo | null }>(
				`query ($file: uuid!, $id: uuid!) { file(id: $file) { id } progressPhoto(id: $id) { id } }`,
				{ file: photo.fileId, id: photo.id },
			),
		);
		expect(result.file).toBeNull();
		expect(result.progressPhoto).toBeNull();
		expect((await fixtures.getFile(photo.fileId)).status).toBe(404);
	});

	test("SQL metadata deletion cascades atomically; account deletion leaves file metadata (rollback-only)", async () => {
		const photo = await create(await fixtures.upload());
		await rollbackProbe(`BEGIN;
			DELETE FROM storage.files WHERE id = '${photo.fileId}'::uuid;
			DO $probe$ BEGIN
				IF EXISTS (SELECT 1 FROM public.progress_photos WHERE id = '${photo.id}'::uuid) THEN
					RAISE EXCEPTION 'file FK did not cascade';
				END IF;
			END; $probe$;
			ROLLBACK;`);
		expect((await get(photo.id))?.fileId).toBe(photo.fileId);
		await rollbackProbe(`BEGIN;
			DELETE FROM auth.users WHERE id = '${fixtures.ownerId}'::uuid;
			DO $probe$ BEGIN
				IF EXISTS (SELECT 1 FROM public.progress_photos WHERE id = '${photo.id}'::uuid) THEN
					RAISE EXCEPTION 'user FK did not cascade';
				END IF;
				IF NOT EXISTS (SELECT 1 FROM storage.files WHERE id = '${photo.fileId}'::uuid) THEN
					RAISE EXCEPTION 'account deletion unexpectedly removed file metadata';
				END IF;
			END; $probe$;
			ROLLBACK;`);
		expect((await get(photo.id))?.fileId).toBe(photo.fileId);
		expect((await fixtures.getFile(photo.fileId)).status).toBe(200);
	});

	test("deleting a detached old file cannot delete the replacement photo", async () => {
		const photo = await create(await fixtures.upload());
		const replacement = await fixtures.upload();
		expect(
			data(await edit(photo, { fileId: replacement })).updateProgressPhotos
				.affected_rows,
		).toBe(1);
		expect(await fixtures.deleteFile(photo.fileId)).toBe(204);
		expect((await get(photo.id))?.fileId).toBe(replacement);
	});

	test("concurrent attachment and REST deletion leave neither dangling photo nor metadata", async () => {
		for (let attempt = 0; attempt < 3; attempt++) {
			const fileId = await fixtures.upload();
			const [attached, status] = await Promise.all([
				gql<{ insertProgressPhoto: Photo }>(
					insert,
					{ object: { fileId, takenOn: day(), labelId: "back_1" } },
					fixtures.ownerId,
				),
				fixtures.deleteFile(fileId),
			]);
			expect(status).toBe(204);
			if (attached.errors) {
				const message =
					attached.errors[0].extensions?.internal?.error?.message ??
					attached.errors[0].message;
				expect(message).toMatch(/progress_photos_file_(check|id_fkey)/);
			} else {
				expect(await get(data(attached).insertProgressPhoto.id)).toBeNull();
			}
			const rows = data(
				await gql<{ progressPhotos: Photo[]; file: unknown }>(
					`query ($id: uuid!) { progressPhotos(where: {fileId: {_eq: $id}}) { id } file(id: $id) { id } }`,
					{ id: fileId },
				),
			);
			expect(rows.progressPhotos).toEqual([]);
			expect(rows.file).toBeNull();
		}
	});

	test("populated-bucket down guard refuses rollback before DDL (rollback-only probe)", async () => {
		const photo = await create(await fixtures.upload());
		const down = await readFile(
			new URL(
				"../nhost/migrations/default/1793528798662_progress_photos/down.sql",
				import.meta.url,
			),
			"utf8",
		);
		const split = down.indexOf("\nDROP TABLE");
		expect(split > 0).toBe(true);
		const guardOnly = down.slice(0, split);
		await rollbackProbe(`BEGIN;
			DO $probe$ BEGIN
				BEGIN
					EXECUTE $guard_sql$${guardOnly}$guard_sql$;
					RAISE EXCEPTION 'rollback guard unexpectedly allowed a populated bucket';
				EXCEPTION WHEN SQLSTATE '55000' THEN
					IF SQLERRM <> 'progress_photos_bucket_not_empty: refusing rollback' THEN RAISE; END IF;
				END;
			END; $probe$;
			ROLLBACK;`);
		// Never execute the destructive remainder, even in a rollback probe.
		expect((await get(photo.id))?.fileId).toBe(photo.fileId);
	});
});

describe("progress photo permission boundary", () => {
	test("admin roots exist before asserting omitted user/public mutations", async () => {
		const introspect = `{ __schema { mutationType { fields { name } } queryType { fields { name } } } }`;
		type Schema = {
			__schema: {
				mutationType: { fields: Array<{ name: string }> } | null;
				queryType: { fields: Array<{ name: string }> };
			};
		};
		const admin = data(await gql<Schema>(introspect)).__schema;
		const omitted = [
			"deleteProgressPhoto",
			"deleteProgressPhotos",
			"insertProgressPhotoLabel",
			"updateProgressPhotoLabel",
			"deleteProgressPhotoLabel",
			"updateFile",
			"updateFiles",
			"insertBucket",
			"updateBucket",
			"deleteBucket",
		];
		const ownerFileRoots = [
			"insertFile",
			"insertFiles",
			"deleteFile",
			"deleteFiles",
		];
		const adminMutations =
			admin.mutationType?.fields.map((entry) => entry.name) ?? [];
		for (const name of [...omitted, ...ownerFileRoots])
			expect(adminMutations).toContain(name);
		for (const endpoint of [HASURA_URL, NHOST_GRAPHQL_URL]) {
			const user = data(
				await gql<Schema>(introspect, {}, fixtures.ownerId, endpoint),
			).__schema;
			const mutations =
				user.mutationType?.fields.map((entry) => entry.name) ?? [];
			for (const name of omitted) expect(mutations).not.toContain(name);
			for (const name of ownerFileRoots) expect(mutations).toContain(name);
			// Validate an actual denied mutation only after proving its exact
			// root exists for admin (a typo must not pass as authorization).
			const denied = await gql(
				`mutation ($id: uuid!) { deleteProgressPhoto(id: $id) { id } }`,
				{ id: crypto.randomUUID() },
				fixtures.ownerId,
				endpoint,
			);
			expect(denied.errors).toBeDefined();
			expect(denied.errors?.[0].message).toContain("deleteProgressPhoto");
			const response = await fetch(endpoint, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ query: introspect }),
				signal: AbortSignal.timeout(5000),
			});
			const anonymous = data(
				(await response.json()) as { data: Schema },
			).__schema;
			const anonymousQueries = anonymous.queryType.fields.map(
				(entry) => entry.name,
			);
			expect(anonymousQueries).not.toContain("progressPhotos");
			expect(anonymousQueries).not.toContain("progressPhotoLabels");
			for (const name of [...omitted, ...ownerFileRoots])
				expect(
					anonymous.mutationType?.fields.map((entry) => entry.name) ?? [],
				).not.toContain(name);
		}
	});

	test("anonymous and authenticated exercise-image bytes remain readable", async () => {
		const id = await fixtures.upload(fixtures.ownerId, "exercise_images");
		const response = await fetch(`${STORAGE_URL}/files/${id}`, {
			signal: AbortSignal.timeout(5000),
		});
		expect(response.status).toBe(200);
		expect(Buffer.from(await response.arrayBuffer())).toEqual(JPEG);
		const user = data(
			await gql<{ file: { id: string } | null }>(
				`query ($id: uuid!) { file(id: $id) { id } }`,
				{ id },
				fixtures.otherId,
			),
		);
		expect(user.file?.id).toBe(id);
		const privateId = await fixtures.upload();
		const privateRead = await fetch(`${STORAGE_URL}/files/${privateId}`, {
			signal: AbortSignal.timeout(5000),
		});
		expect([403, 404]).toContain(privateRead.status);
		// Phase 2 opens progress metadata only to the uploader.
		expect(
			data(
				await gql<{ file: unknown }>(
					`query ($id: uuid!) { file(id: $id) { id } }`,
					{ id: privateId },
					fixtures.ownerId,
				),
			).file,
		).toEqual({ id: privateId });
		expect(
			data(
				await gql<{ file: unknown }>(
					`query ($id: uuid!) { file(id: $id) { id } }`,
					{ id: privateId },
					fixtures.otherId,
				),
			).file,
		).toBeNull();
	});
});
