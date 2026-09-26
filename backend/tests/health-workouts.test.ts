/// <reference path="./bun-test.d.ts" />

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

const HASURA_URL = "https://local.hasura.local.nhost.run/v1/graphql";
const ADMIN_SECRET = "nhost-admin-secret";
const USER = "f26ac88d-4dcd-48e8-a0ae-b4248918bc1c";
const OTHER = "11111111-1111-4111-8111-111111111111";
const workoutUuid = crypto.randomUUID();
const ids = new Set<string>();
let reachable = false;

type Response<T> = { data: T | null; errors?: Array<{ message: string; extensions?: { code?: string } }> };

async function gql<T>(userId: string, query: string, variables: Record<string, unknown> = {}): Promise<Response<T>> {
	const response = await fetch(HASURA_URL, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-hasura-admin-secret": ADMIN_SECRET,
			"x-hasura-role": "user",
			"x-hasura-user-id": userId,
		},
		body: JSON.stringify({ query, variables }),
	});
	return response.json() as Promise<Response<T>>;
}

beforeAll(async () => {
	try {
		const response = await gql<unknown>(USER, "query { __typename }");
		reachable = !response.errors;
	} catch {
		reachable = false;
	}
});

afterAll(async () => {
	if (!reachable || !ids.size) return;
	await gql(USER, `mutation Cleanup($ids: [uuid!]!) {
		deleteHealthWorkouts(where: { id: { _in: $ids } }) { affectedRows: affected_rows }
	}`, { ids: [...ids] });
});

describe("HealthKit workout snapshots", () => {
	test("local Hasura reachable", () => {
		if (!reachable) console.warn("local Hasura not reachable — skipping health workout tests");
		expect(reachable).toBe(true);
	});

	test("upserts by owner and HealthKit UUID, stores raw JSON, and deletes on sync", async () => {
		if (!reachable) return;
		const mutation = `mutation Upsert($objects: [healthWorkout_insert_input!]!) {
			insertHealthWorkouts(objects: $objects, on_conflict: {
				constraint: health_workouts_user_healthkit_uuid_key, update_columns: [raw]
			}) { affectedRows: affected_rows returning { id raw healthkitUuid userId } }
		}`;
		const first = await gql<{ insertHealthWorkouts: { returning: Array<{ id: string; raw: unknown; userId: string }> } }>(
			USER, mutation, { objects: [{ healthkitUuid: workoutUuid, raw: { workoutActivityType: 37, activeEnergyBurnedKcal: 450 } }] },
		);
		expect(first.errors).toBeUndefined();
		const row = first.data!.insertHealthWorkouts.returning[0];
		ids.add(row.id);
		expect(row.userId).toBe(USER);
		expect(row.raw).toEqual({ workoutActivityType: 37, activeEnergyBurnedKcal: 450 });
		const second = await gql<{ insertHealthWorkouts: { returning: Array<{ id: string; raw: unknown }> } }>(
			USER, mutation, { objects: [{ healthkitUuid: workoutUuid, raw: { workoutActivityType: 37, activeEnergyBurnedKcal: 475 } }] },
		);
		expect(second.errors).toBeUndefined();
		expect(second.data!.insertHealthWorkouts.returning[0].id).toBe(row.id);
		expect(second.data!.insertHealthWorkouts.returning[0].raw).toEqual({
			workoutActivityType: 37, activeEnergyBurnedKcal: 475,
		});
		const deleted = await gql<{ deleteHealthWorkouts: { affectedRows: number } }>(USER,
			`mutation Delete($ids: [uuid!]!) {
				deleteHealthWorkouts(where: { healthkitUuid: { _in: $ids } }) { affectedRows: affected_rows }
			}`, { ids: [workoutUuid] });
		expect(deleted.errors).toBeUndefined();
		expect(deleted.data!.deleteHealthWorkouts.affectedRows).toBe(1);
		ids.delete(row.id);
	});

	test("foreign users cannot read, update, or delete another user's raw workout", async () => {
		if (!reachable) return;
		const uuid = crypto.randomUUID();
		const created = await gql<{ insertHealthWorkout: { id: string } }>(USER,
			`mutation Create($uuid: uuid!) {
				insertHealthWorkout(object: { healthkitUuid: $uuid, raw: { test: true } }) { id }
			}`, { uuid });
		expect(created.errors).toBeUndefined();
		const id = created.data!.insertHealthWorkout.id;
		ids.add(id);
		const read = await gql<{ healthWorkouts: unknown[] }>(OTHER,
			`query Foreign($id: uuid!) { healthWorkouts(where: { id: { _eq: $id } }) { id raw } }`, { id });
		expect(read.errors).toBeUndefined();
		expect(read.data!.healthWorkouts).toEqual([]);
		const update = await gql<{ updateHealthWorkout: null }>(OTHER,
			`mutation ForeignUpdate($id: uuid!) {
				updateHealthWorkout(pk_columns: { id: $id }, _set: { raw: { test: false } }) { id }
			}`, { id });
		expect(update.errors).toBeUndefined();
		expect(update.data!.updateHealthWorkout).toBeNull();
		const deleted = await gql<{ deleteHealthWorkouts: { affectedRows: number } }>(OTHER,
			`mutation ForeignDelete($id: uuid!) {
				deleteHealthWorkouts(where: { id: { _eq: $id } }) { affectedRows: affected_rows }
			}`, { id });
		expect(deleted.errors).toBeUndefined();
		expect(deleted.data!.deleteHealthWorkouts.affectedRows).toBe(0);
	});

	test("user cannot forge owner or rewrite HealthKit UUID; raw must be an object", async () => {
		if (!reachable) return;
		const uuid = crypto.randomUUID();
		const forged = await gql<unknown>(USER,
			`mutation Forge($uuid: uuid!, $owner: uuid!) {
				insertHealthWorkout(object: { healthkitUuid: $uuid, userId: $owner, raw: {} }) { id }
			}`, { uuid, owner: OTHER });
		expect(forged.errors?.[0]?.extensions?.code).toBe("validation-failed");
		const invalid = await gql<unknown>(USER,
			`mutation Invalid($uuid: uuid!) {
				insertHealthWorkout(object: { healthkitUuid: $uuid, raw: [] }) { id }
			}`, { uuid });
		expect(invalid.errors?.[0]?.message).toContain("health_workouts_raw_check");
		const immutable = await gql<unknown>(USER,
			`mutation Immutable($uuid: uuid!) {
				updateHealthWorkouts(where: { healthkitUuid: { _eq: $uuid } }, _set: { healthkitUuid: $uuid }) { affectedRows: affected_rows }
			}`, { uuid });
		expect(immutable.errors?.[0]?.extensions?.code).toBe("validation-failed");
	});
});
