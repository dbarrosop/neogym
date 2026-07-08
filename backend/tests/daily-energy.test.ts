/// <reference path="./bun-test.d.ts" />

// Backend integration tests for daily energy permissions and constraints.
// Prereqs: the NeoGym local Nhost stack must be running with seeds applied
// (`make dev-env-up` from backend/). The reachability smoke test fails when
// Hasura is unavailable so missing/wrong local environments do not pass.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

const HASURA_URL = "https://local.hasura.local.nhost.run/v1/graphql";
const ADMIN_SECRET = "nhost-admin-secret";

const TEST_USER_ID = "f26ac88d-4dcd-48e8-a0ae-b4248918bc1c";
const OTHER_USER_ID = "11111111-1111-4111-8111-111111111111";
const RUN_ID = `${Date.now()}`;
const RUN_DAY_OFFSET = Number(RUN_ID) % 100_000;
const createdDailyEnergyIds = new Set<string>();

function runDate(offset: number): string {
	const date = new Date(Date.UTC(2035, 0, 1 + RUN_DAY_OFFSET + offset));
	return date.toISOString().slice(0, 10);
}

interface GraphQLResponse<T> {
	data: T | null;
	errors?: Array<{
		message: string;
		extensions?: {
			code?: string;
			internal?: {
				error?: { message?: string; status_code?: string; hint?: string };
			};
		};
	}>;
}

function errorText(errors: GraphQLResponse<unknown>["errors"]): string {
	const e = errors?.[0];
	return e?.extensions?.internal?.error?.message ?? e?.message ?? "";
}

function errorStatus(errors: GraphQLResponse<unknown>["errors"]): string {
	return errors?.[0]?.extensions?.internal?.error?.status_code ?? "";
}

function expectPostgresError(
	errors: GraphQLResponse<unknown>["errors"],
	statusCode: string,
	constraintName: string,
): void {
	expect(errors).toBeDefined();
	expect(["constraint-violation", "permission-error"]).toContain(
		errors![0].extensions?.code,
	);
	// Hasura includes SQLSTATE for some Postgres errors but maps others to a
	// shorter message without `extensions.internal`; in both cases the named
	// constraint is part of the public failure contract we need to preserve.
	if (errorStatus(errors)) expect(errorStatus(errors)).toBe(statusCode);
	expect(errorText(errors)).toContain(constraintName);
}

async function gqlAdmin<T>(
	query: string,
	variables: Record<string, unknown> = {},
): Promise<GraphQLResponse<T>> {
	const res = await fetch(HASURA_URL, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-hasura-admin-secret": ADMIN_SECRET,
		},
		body: JSON.stringify({ query, variables }),
	});
	return res.json() as Promise<GraphQLResponse<T>>;
}

async function gqlAsUser<T>(
	query: string,
	variables: Record<string, unknown>,
	userId: string,
): Promise<GraphQLResponse<T>> {
	const res = await fetch(HASURA_URL, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-hasura-admin-secret": ADMIN_SECRET,
			"x-hasura-role": "user",
			"x-hasura-user-id": userId,
		},
		body: JSON.stringify({ query, variables }),
	});
	return res.json() as Promise<GraphQLResponse<T>>;
}

async function isHasuraReachable(): Promise<boolean> {
	try {
		const res = await fetch(HASURA_URL, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-hasura-admin-secret": ADMIN_SECRET,
			},
			body: JSON.stringify({ query: "{ __typename }" }),
			signal: AbortSignal.timeout(2000),
		});
		return res.ok;
	} catch {
		return false;
	}
}

let hasuraReachable = false;

beforeAll(async () => {
	hasuraReachable = await isHasuraReachable();
});

afterAll(async () => {
	if (!hasuraReachable || createdDailyEnergyIds.size === 0) return;

	const res = await gqlAdmin<{
		deleteDailyEnergyEntries: { affected_rows: number };
	}>(
		`mutation CleanupDailyEnergy($ids: [uuid!]!) {
			deleteDailyEnergyEntries(where: { id: { _in: $ids } }) { affected_rows }
		}`,
		{ ids: [...createdDailyEnergyIds] },
	);
	expect(res.errors).toBeUndefined();
});

async function createDailyEnergy(
	userId: string,
	energyOn: string,
	fields: { activeKcal?: string | null; restingKcal?: string | null; notes?: string } = {},
) {
	const res = await gqlAsUser<{
		insertDailyEnergyEntry: {
			id: string;
			userId: string;
			energyOn: string;
			activeKcal: string | number | null;
			restingKcal: string | number | null;
			notes: string | null;
		};
	}>(
		`mutation CreateDailyEnergy($object: dailyEnergy_insert_input!) {
			insertDailyEnergyEntry(object: $object) {
				id
				userId
				energyOn
				activeKcal
				restingKcal
				notes
			}
		}`,
		{
			object: {
				energyOn,
				...fields,
			},
		},
		userId,
	);
	expect(res.errors).toBeUndefined();
	createdDailyEnergyIds.add(res.data!.insertDailyEnergyEntry.id);
	return res.data!.insertDailyEnergyEntry;
}

describe("daily energy table", () => {
	test("Hasura reachable (skips suite otherwise)", () => {
		if (!hasuraReachable)
			console.warn("local Hasura not reachable — skipping daily energy tests");
		expect(hasuraReachable).toBe(true);
	});

	test("user can insert and select active-only, resting-only, and combined rows", async () => {
		if (!hasuraReachable) return;

		const activeOnly = await createDailyEnergy(TEST_USER_ID, runDate(1), {
			activeKcal: "450.50",
			notes: `Active only ${RUN_ID}`,
		});
		const restingOnly = await createDailyEnergy(TEST_USER_ID, runDate(2), {
			restingKcal: "1800.00",
		});
		const combined = await createDailyEnergy(TEST_USER_ID, runDate(3), {
			activeKcal: "525.25",
			restingKcal: "1700.75",
		});

		const res = await gqlAsUser<{
			dailyEnergyEntries: Array<{
				id: string;
				energyOn: string;
				activeKcal: string | number | null;
				restingKcal: string | number | null;
				notes: string | null;
			}>;
		}>(
			`query DailyEnergyRows($ids: [uuid!]!) {
				dailyEnergyEntries(where: { id: { _in: $ids } }, order_by: { energyOn: asc }) {
					id
					energyOn
					activeKcal
					restingKcal
					notes
				}
			}`,
			{ ids: [activeOnly.id, restingOnly.id, combined.id] },
			TEST_USER_ID,
		);

		expect(res.errors).toBeUndefined();
		expect(res.data!.dailyEnergyEntries).toEqual([
			{
				id: activeOnly.id,
				energyOn: runDate(1),
				activeKcal: 450.5,
				restingKcal: null,
				notes: `Active only ${RUN_ID}`,
			},
			{
				id: restingOnly.id,
				energyOn: runDate(2),
				activeKcal: null,
				restingKcal: 1800,
				notes: null,
			},
			{
				id: combined.id,
				energyOn: runDate(3),
				activeKcal: 525.25,
				restingKcal: 1700.75,
				notes: null,
			},
		]);
	});

	test("at least one kcal value is required on insert and update", async () => {
		if (!hasuraReachable) return;

		const insert = await gqlAsUser<unknown>(
			`mutation MissingValue($day: date!) {
				insertDailyEnergyEntry(object: { energyOn: $day }) { id }
			}`,
			{ day: runDate(10) },
			TEST_USER_ID,
		);
		expectPostgresError(
			insert.errors,
			"23514",
			"daily_energy_at_least_one_value_check",
		);

		const row = await createDailyEnergy(TEST_USER_ID, runDate(11), {
			activeKcal: "100.00",
		});
		const update = await gqlAsUser<unknown>(
			`mutation ClearValues($id: uuid!) {
				updateDailyEnergyEntry(pk_columns: { id: $id }, _set: { activeKcal: null, restingKcal: null }) { id }
			}`,
			{ id: row.id },
			TEST_USER_ID,
		);
		expectPostgresError(
			update.errors,
			"23514",
			"daily_energy_at_least_one_value_check",
		);
	});

	test("kcal range checks reject invalid inserts and updates while accepting boundaries", async () => {
		if (!hasuraReachable) return;

		const invalidInserts = [
			{
				day: runDate(20),
				object: { energyOn: runDate(20), activeKcal: "-0.01" },
				constraint: "daily_energy_active_kcal_range_check",
			},
			{
				day: runDate(21),
				object: { energyOn: runDate(21), restingKcal: "-0.01" },
				constraint: "daily_energy_resting_kcal_range_check",
			},
			{
				day: runDate(22),
				object: { energyOn: runDate(22), activeKcal: "30000.00" },
				constraint: "daily_energy_active_kcal_range_check",
			},
			{
				day: runDate(23),
				object: { energyOn: runDate(23), restingKcal: "30000.00" },
				constraint: "daily_energy_resting_kcal_range_check",
			},
		];

		for (const invalid of invalidInserts) {
			const res = await gqlAsUser<unknown>(
				`mutation InvalidDailyEnergy($object: dailyEnergy_insert_input!) {
					insertDailyEnergyEntry(object: $object) { id }
				}`,
				{ object: invalid.object },
				TEST_USER_ID,
			);
			expectPostgresError(res.errors, "23514", invalid.constraint);
		}

		const activeZero = await createDailyEnergy(TEST_USER_ID, runDate(24), {
			activeKcal: "0.00",
		});
		const nearUpper = await createDailyEnergy(TEST_USER_ID, runDate(25), {
			activeKcal: "29999.99",
			restingKcal: "29999.99",
		});
		expect(activeZero.activeKcal).toBe(0);
		expect(nearUpper.activeKcal).toBe(29999.99);
		expect(nearUpper.restingKcal).toBe(29999.99);

		const row = await createDailyEnergy(TEST_USER_ID, runDate(26), {
			activeKcal: "100.00",
			restingKcal: "1000.00",
		});
		const invalidActiveUpdate = await gqlAsUser<unknown>(
			`mutation InvalidActiveUpdate($id: uuid!) {
				updateDailyEnergyEntry(pk_columns: { id: $id }, _set: { activeKcal: "-1.00" }) { id }
			}`,
			{ id: row.id },
			TEST_USER_ID,
		);
		expectPostgresError(
			invalidActiveUpdate.errors,
			"23514",
			"daily_energy_active_kcal_range_check",
		);

		const invalidRestingUpdate = await gqlAsUser<unknown>(
			`mutation InvalidRestingUpdate($id: uuid!) {
				updateDailyEnergyEntry(pk_columns: { id: $id }, _set: { restingKcal: "30000.00" }) { id }
			}`,
			{ id: row.id },
			TEST_USER_ID,
		);
		expectPostgresError(
			invalidRestingUpdate.errors,
			"23514",
			"daily_energy_resting_kcal_range_check",
		);
	});

	test("one row per user per date is enforced on insert and update", async () => {
		if (!hasuraReachable) return;

		const existing = await createDailyEnergy(TEST_USER_ID, runDate(30), {
			activeKcal: "250.00",
		});
		const duplicateInsert = await gqlAsUser<unknown>(
			`mutation DuplicateDate($day: date!) {
				insertDailyEnergyEntry(object: { energyOn: $day, restingKcal: "1500.00" }) { id }
			}`,
			{ day: existing.energyOn },
			TEST_USER_ID,
		);
		expectPostgresError(
			duplicateInsert.errors,
			"23505",
			"daily_energy_user_date_key",
		);

		const second = await createDailyEnergy(TEST_USER_ID, runDate(31), {
			activeKcal: "300.00",
		});
		const duplicateUpdate = await gqlAsUser<unknown>(
			`mutation DuplicateDateUpdate($id: uuid!, $day: date!) {
				updateDailyEnergyEntry(pk_columns: { id: $id }, _set: { energyOn: $day }) { id }
			}`,
			{ id: second.id, day: existing.energyOn },
			TEST_USER_ID,
		);
		expectPostgresError(
			duplicateUpdate.errors,
			"23505",
			"daily_energy_user_date_key",
		);
	});

	test("user role cannot read, update, or delete another user's row", async () => {
		if (!hasuraReachable) return;

		const row = await createDailyEnergy(TEST_USER_ID, runDate(40), {
			activeKcal: "350.00",
		});

		const select = await gqlAsUser<{
			dailyEnergyEntries: Array<{ id: string }>;
		}>(
			`query ForeignDailyEnergy($id: uuid!) {
				dailyEnergyEntries(where: { id: { _eq: $id } }) { id }
			}`,
			{ id: row.id },
			OTHER_USER_ID,
		);
		expect(select.errors).toBeUndefined();
		expect(select.data!.dailyEnergyEntries).toEqual([]);

		const update = await gqlAsUser<{
			updateDailyEnergyEntry: { id: string } | null;
		}>(
			`mutation ForeignUpdate($id: uuid!) {
				updateDailyEnergyEntry(pk_columns: { id: $id }, _set: { notes: "bad" }) { id }
			}`,
			{ id: row.id },
			OTHER_USER_ID,
		);
		expect(update.errors).toBeUndefined();
		expect(update.data!.updateDailyEnergyEntry).toBeNull();

		const deleteAttempt = await gqlAsUser<{
			deleteDailyEnergyEntry: { id: string } | null;
		}>(
			`mutation ForeignDelete($id: uuid!) {
				deleteDailyEnergyEntry(id: $id) { id }
			}`,
			{ id: row.id },
			OTHER_USER_ID,
		);
		expect(deleteAttempt.errors).toBeUndefined();
		expect(deleteAttempt.data!.deleteDailyEnergyEntry).toBeNull();

		const stillThere = await gqlAdmin<{
			dailyEnergyEntry: { id: string; notes: string | null } | null;
		}>(
			`query DailyEnergyByPk($id: uuid!) {
				dailyEnergyEntry(id: $id) { id notes }
			}`,
			{ id: row.id },
		);
		expect(stillThere.errors).toBeUndefined();
		expect(stillThere.data!.dailyEnergyEntry).toEqual({ id: row.id, notes: null });
	});

	test("ownership is pinned by insert permissions and userId is not client-settable", async () => {
		if (!hasuraReachable) return;

		const row = await createDailyEnergy(TEST_USER_ID, runDate(50), {
			activeKcal: "225.00",
		});
		expect(row.userId).toBe(TEST_USER_ID);

		const insertUserId = await gqlAsUser<unknown>(
			`mutation UserIdInsert($day: date!, $otherUserId: uuid!) {
				insertDailyEnergyEntry(object: { energyOn: $day, activeKcal: "100.00", userId: $otherUserId }) { id }
			}`,
			{ day: runDate(51), otherUserId: OTHER_USER_ID },
			TEST_USER_ID,
		);
		expect(insertUserId.errors![0].extensions?.code).toBe("validation-failed");
		expect(errorText(insertUserId.errors)).toContain("userId");

		const insertSnakeUserId = await gqlAsUser<unknown>(
			`mutation SnakeUserIdInsert($day: date!, $otherUserId: uuid!) {
				insertDailyEnergyEntry(object: { energyOn: $day, activeKcal: "100.00", user_id: $otherUserId }) { id }
			}`,
			{ day: runDate(52), otherUserId: OTHER_USER_ID },
			TEST_USER_ID,
		);
		expect(insertSnakeUserId.errors![0].extensions?.code).toBe(
			"validation-failed",
		);
		expect(errorText(insertSnakeUserId.errors)).toContain("user_id");

		const updateUserId = await gqlAsUser<unknown>(
			`mutation UserIdUpdate($id: uuid!, $otherUserId: uuid!) {
				updateDailyEnergyEntry(pk_columns: { id: $id }, _set: { userId: $otherUserId }) { id }
			}`,
			{ id: row.id, otherUserId: OTHER_USER_ID },
			TEST_USER_ID,
		);
		expect(updateUserId.errors![0].extensions?.code).toBe("validation-failed");
		expect(errorText(updateUserId.errors)).toContain("userId");
	});

	test("custom root fields expose single-row insert and countable entry queries", async () => {
		if (!hasuraReachable) return;

		const row = await createDailyEnergy(TEST_USER_ID, runDate(60), {
			activeKcal: "123.00",
			restingKcal: "1456.00",
		});

		const res = await gqlAsUser<{
			dailyEnergyEntry: { id: string; energyOn: string } | null;
			dailyEnergyEntries: Array<{ id: string }>;
		}>(
			`query DailyEnergyRootSmoke($id: uuid!) {
				dailyEnergyEntry(id: $id) { id energyOn }
				dailyEnergyEntries(where: { id: { _eq: $id } }) { id }
			}`,
			{ id: row.id },
			TEST_USER_ID,
		);

		expect(res.errors).toBeUndefined();
		expect(res.data!.dailyEnergyEntry).toEqual({
			id: row.id,
			energyOn: row.energyOn,
		});
		expect(res.data!.dailyEnergyEntries).toEqual([{ id: row.id }]);
	});
});
