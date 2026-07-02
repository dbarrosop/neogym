/// <reference path="./bun-test.d.ts" />

// Backend integration tests for nutrition permissions, snapshots, and cascades.
// Prereqs: the NeoGym local Nhost stack must be running with seeds applied
// (`make dev-env-up` from backend/). The reachability smoke test fails when
// Hasura is unavailable so missing/wrong local environments do not pass.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

const HASURA_URL = "https://local.hasura.local.nhost.run/v1/graphql";
const ADMIN_SECRET = "nhost-admin-secret";

const TEST_USER_ID = "f26ac88d-4dcd-48e8-a0ae-b4248918bc1c";
const OTHER_USER_ID = "11111111-1111-4111-8111-111111111111";
const PUBLIC_BANANA_ID = "019e1000-0000-7000-8000-000000000001";
const RUN_ID = `${Date.now()}`;
const RUN_DAY_OFFSET = Number(RUN_ID) % 100_000;
const createdNutritionDayIds = new Set<string>();

function runDate(offset: number): string {
	const date = new Date(Date.UTC(2030, 0, 1 + RUN_DAY_OFFSET + offset));
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

function expectGraphQLError(errors: GraphQLResponse<unknown>["errors"]): void {
	expect(errorText(errors)).not.toBe("");
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
	variables: Record<string, unknown> = {},
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
	if (!hasuraReachable || createdNutritionDayIds.size === 0) return;

	const res = await gqlAdmin<{
		deleteNutritionDays: { affected_rows: number };
	}>(
		`mutation CleanupNutritionDays($ids: [uuid!]!) {
      deleteNutritionDays(where: { id: { _in: $ids } }) { affected_rows }
    }`,
		{ ids: [...createdNutritionDayIds] },
	);
	expect(res.errors).toBeUndefined();
});

async function createFood(userId: string, name: string) {
	const res = await gqlAsUser<{
		insertFood: { id: string; name: string; userId: string; isPublic: boolean };
	}>(
		`mutation CreateFood($name: String!) {
      insertFood(object: {
        name: $name,
        kcalPer100g: "123.00",
        fatPer100g: "4.00",
        carbsPer100g: "20.00",
        proteinPer100g: "7.00",
        fiberPer100g: "2.00",
        sugarPer100g: "3.00"
      }) { id name userId isPublic }
    }`,
		{ name },
		userId,
	);
	expect(res.errors).toBeUndefined();
	return res.data!.insertFood;
}

async function createMeal(userId: string, name: string) {
	const res = await gqlAsUser<{ insertMeal: { id: string } }>(
		`mutation CreateMeal($name: String!) { insertMeal(object: { name: $name }) { id } }`,
		{ name },
		userId,
	);
	expect(res.errors).toBeUndefined();
	return res.data!.insertMeal.id;
}

async function createPlan(userId: string, name: string) {
	const res = await gqlAsUser<{ insertNutritionPlan: { id: string } }>(
		`mutation CreatePlan($name: String!) { insertNutritionPlan(object: { name: $name }) { id } }`,
		{ name },
		userId,
	);
	expect(res.errors).toBeUndefined();
	return res.data!.insertNutritionPlan.id;
}

async function createPlanFood(
	userId: string,
	nutritionPlanId: string,
	foodId: string,
	position = 0,
) {
	const res = await gqlAsUser<{ insertNutritionPlanFood: { id: string } }>(
		`mutation CreatePlanFood($planId: uuid!, $foodId: uuid!, $position: Int!) {
      insertNutritionPlanFood(object: {
        nutritionPlanId: $planId,
        foodId: $foodId,
        grams: "100",
        slotTime: "08:00:00",
        label: "Direct food",
        position: $position
      }) { id }
    }`,
		{ planId: nutritionPlanId, foodId, position },
		userId,
	);
	expect(res.errors).toBeUndefined();
	return res.data!.insertNutritionPlanFood.id;
}

async function createDay(
	userId: string,
	logDate: string,
	nutritionPlanId: string | null = null,
) {
	const res = await gqlAsUser<{
		insertNutritionDay: { id: string; nutritionPlanId: string | null };
	}>(
		`mutation CreateDay($logDate: date!, $planId: uuid) {
      insertNutritionDay(object: { logDate: $logDate, nutritionPlanId: $planId }) { id nutritionPlanId }
    }`,
		{ logDate, planId: nutritionPlanId },
		userId,
	);
	expect(res.errors).toBeUndefined();
	createdNutritionDayIds.add(res.data!.insertNutritionDay.id);
	return res.data!.insertNutritionDay;
}

describe("nutrition food visibility", () => {
	test("Hasura reachable (skips suite otherwise)", () => {
		if (!hasuraReachable)
			console.warn("local Hasura not reachable — skipping nutrition tests");
		expect(hasuraReachable).toBe(true);
	});

	test("user sees public and own private foods but not another user's private food", async () => {
		if (!hasuraReachable) return;
		const own = await createFood(TEST_USER_ID, `Own nutrition food ${RUN_ID}`);
		const foreign = await createFood(
			OTHER_USER_ID,
			`Foreign nutrition food ${RUN_ID}`,
		);

		const res = await gqlAsUser<{ foods: Array<{ id: string; name: string }> }>(
			`query Foods($ids: [uuid!]!) { foods(where: { id: { _in: $ids } }, order_by: { name: asc }) { id name } }`,
			{ ids: [PUBLIC_BANANA_ID, own.id, foreign.id] },
			TEST_USER_ID,
		);

		expect(res.errors).toBeUndefined();
		expect(res.data!.foods.map((food) => food.id).sort()).toEqual(
			[PUBLIC_BANANA_ID, own.id].sort(),
		);
	});

	test("user cannot create public foods or mutate public/foreign foods", async () => {
		if (!hasuraReachable) return;
		const foreign = await createFood(
			OTHER_USER_ID,
			`Foreign locked food ${RUN_ID}`,
		);

		const createPublic = await gqlAsUser<unknown>(
			`mutation CreatePublic {
        insertFood(object: {
          name: "User public attempt ${RUN_ID}", isPublic: true,
          kcalPer100g: "1", fatPer100g: "0", carbsPer100g: "0", proteinPer100g: "0", fiberPer100g: "0", sugarPer100g: "0"
        }) { id }
      }`,
			{},
			TEST_USER_ID,
		);
		expect(errorText(createPublic.errors)).toContain("isPublic");

		const updatePublic = await gqlAsUser<{ updateFood: { id: string } | null }>(
			`mutation UpdatePublic($id: uuid!) { updateFood(pk_columns: { id: $id }, _set: { name: "Bad" }) { id } }`,
			{ id: PUBLIC_BANANA_ID },
			TEST_USER_ID,
		);
		expect(updatePublic.errors).toBeUndefined();
		expect(updatePublic.data!.updateFood).toBeNull();

		const deleteForeign = await gqlAsUser<{
			deleteFood: { id: string } | null;
		}>(
			`mutation DeleteForeign($id: uuid!) { deleteFood(id: $id) { id } }`,
			{ id: foreign.id },
			TEST_USER_ID,
		);
		expect(deleteForeign.errors).toBeUndefined();
		expect(deleteForeign.data!.deleteFood).toBeNull();
	});
});

describe("nutrition template ownership", () => {
	test("meal ingredients can use own/public foods but not another user's private food", async () => {
		if (!hasuraReachable) return;
		const mealId = await createMeal(
			TEST_USER_ID,
			`Ingredient boundary ${RUN_ID}`,
		);
		const foreignFood = await createFood(
			OTHER_USER_ID,
			`Foreign ingredient ${RUN_ID}`,
		);

		const publicInsert = await gqlAsUser<{
			insertMealIngredient: { id: string };
		}>(
			`mutation AddPublic($mealId: uuid!, $foodId: uuid!) {
        insertMealIngredient(object: { mealId: $mealId, foodId: $foodId, grams: "100", position: 0 }) { id }
      }`,
			{ mealId, foodId: PUBLIC_BANANA_ID },
			TEST_USER_ID,
		);
		expect(publicInsert.errors).toBeUndefined();

		const foreignInsert = await gqlAsUser<unknown>(
			`mutation AddForeign($mealId: uuid!, $foodId: uuid!) {
        insertMealIngredient(object: { mealId: $mealId, foodId: $foodId, grams: "100", position: 1 }) { id }
      }`,
			{ mealId, foodId: foreignFood.id },
			TEST_USER_ID,
		);
		expectGraphQLError(foreignInsert.errors);
	});

	test("plan slots can use only the owner's meals", async () => {
		if (!hasuraReachable) return;
		const planId = await createPlan(TEST_USER_ID, `Plan boundary ${RUN_ID}`);
		const ownMealId = await createMeal(TEST_USER_ID, `Own plan meal ${RUN_ID}`);
		const foreignMealId = await createMeal(
			OTHER_USER_ID,
			`Foreign plan meal ${RUN_ID}`,
		);

		const ownSlot = await gqlAsUser<{
			insertNutritionPlanMeal: { id: string };
		}>(
			`mutation AddOwn($planId: uuid!, $mealId: uuid!) {
        insertNutritionPlanMeal(object: { nutritionPlanId: $planId, mealId: $mealId, slotTime: "08:00:00", position: 0 }) { id }
      }`,
			{ planId, mealId: ownMealId },
			TEST_USER_ID,
		);
		expect(ownSlot.errors).toBeUndefined();

		const foreignSlot = await gqlAsUser<unknown>(
			`mutation AddForeign($planId: uuid!, $mealId: uuid!) {
        insertNutritionPlanMeal(object: { nutritionPlanId: $planId, mealId: $mealId, slotTime: "12:00:00", position: 1 }) { id }
      }`,
			{ planId, mealId: foreignMealId },
			TEST_USER_ID,
		);
		expectGraphQLError(foreignSlot.errors);
	});

	test("foreign plans cannot be linked to a user's day", async () => {
		if (!hasuraReachable) return;
		const foreignPlanId = await createPlan(
			OTHER_USER_ID,
			`Foreign day plan ${RUN_ID}`,
		);
		const res = await gqlAsUser<unknown>(
			`mutation ForeignPlan($planId: uuid!, $logDate: date!) {
        insertNutritionDay(object: { logDate: $logDate, nutritionPlanId: $planId }) { id }
      }`,
			{ planId: foreignPlanId, logDate: runDate(0) },
			TEST_USER_ID,
		);
		expectGraphQLError(res.errors);
	});
});

describe("nutrition direct plan foods", () => {
	test("plan food slots can use own/public foods but not foreign foods or plans", async () => {
		if (!hasuraReachable) return;
		const planId = await createPlan(TEST_USER_ID, `Food plan ${RUN_ID}`);
		const ownFood = await createFood(TEST_USER_ID, `Own plan food ${RUN_ID}`);
		const foreignFood = await createFood(
			OTHER_USER_ID,
			`Foreign plan food ${RUN_ID}`,
		);
		const foreignPlanId = await createPlan(
			OTHER_USER_ID,
			`Foreign direct food plan ${RUN_ID}`,
		);

		const ownSlot = await gqlAsUser<{
			insertNutritionPlanFood: { id: string; foodId: string; label: string };
		}>(
			`mutation AddOwnFood($planId: uuid!, $foodId: uuid!) {
        insertNutritionPlanFood(object: { nutritionPlanId: $planId, foodId: $foodId, grams: "125", slotTime: "07:30:00", label: "Pre-workout", position: 0 }) { id foodId label }
      }`,
			{ planId, foodId: ownFood.id },
			TEST_USER_ID,
		);
		expect(ownSlot.errors).toBeUndefined();
		expect(ownSlot.data!.insertNutritionPlanFood.foodId).toBe(ownFood.id);

		const publicSlot = await gqlAsUser<{
			insertNutritionPlanFood: { id: string };
		}>(
			`mutation AddPublicFood($planId: uuid!) {
        insertNutritionPlanFood(object: { nutritionPlanId: $planId, foodId: "${PUBLIC_BANANA_ID}", grams: "80", slotTime: "10:00:00", position: 1 }) { id }
      }`,
			{ planId },
			TEST_USER_ID,
		);
		expect(publicSlot.errors).toBeUndefined();

		const foreignFoodSlot = await gqlAsUser<unknown>(
			`mutation AddForeignFood($planId: uuid!, $foodId: uuid!) {
        insertNutritionPlanFood(object: { nutritionPlanId: $planId, foodId: $foodId, grams: "100", slotTime: "12:00:00", position: 2 }) { id }
      }`,
			{ planId, foodId: foreignFood.id },
			TEST_USER_ID,
		);
		expectGraphQLError(foreignFoodSlot.errors);

		const foreignPlanSlot = await gqlAsUser<unknown>(
			`mutation AddToForeignPlan($planId: uuid!) {
        insertNutritionPlanFood(object: { nutritionPlanId: $planId, foodId: "${PUBLIC_BANANA_ID}", grams: "100", slotTime: "12:00:00", position: 3 }) { id }
      }`,
			{ planId: foreignPlanId },
			TEST_USER_ID,
		);
		expectGraphQLError(foreignPlanSlot.errors);
	});

	test("plan food source FKs are immutable while presentation fields are editable", async () => {
		if (!hasuraReachable) return;
		const planId = await createPlan(
			TEST_USER_ID,
			`Immutable food plan ${RUN_ID}`,
		);
		const food = await createFood(
			TEST_USER_ID,
			`Immutable plan food ${RUN_ID}`,
		);
		const planFoodId = await createPlanFood(TEST_USER_ID, planId, food.id);
		const otherPlanId = await createPlan(
			TEST_USER_ID,
			`Other immutable food plan ${RUN_ID}`,
		);

		const updateMutable = await gqlAsUser<{
			updateNutritionPlanFood: {
				grams: string;
				slotTime: string;
				label: string;
				position: number;
			} | null;
		}>(
			`mutation UpdatePlanFood($id: uuid!) {
        updateNutritionPlanFood(pk_columns: { id: $id }, _set: { grams: "150", slotTime: "09:30:00", label: "Moved", position: 4 }) {
          grams slotTime label position
        }
      }`,
			{ id: planFoodId },
			TEST_USER_ID,
		);
		expect(updateMutable.errors).toBeUndefined();
		expect(updateMutable.data!.updateNutritionPlanFood).toEqual({
			grams: 150,
			slotTime: "09:30:00",
			label: "Moved",
			position: 4,
		});

		const updateFoodSource = await gqlAsUser<unknown>(
			`mutation UpdatePlanFoodSource($id: uuid!) {
        updateNutritionPlanFood(pk_columns: { id: $id }, _set: { foodId: "${PUBLIC_BANANA_ID}" }) { id }
      }`,
			{ id: planFoodId },
			TEST_USER_ID,
		);
		expect(errorText(updateFoodSource.errors)).toContain("foodId");

		const updatePlanSource = await gqlAsUser<unknown>(
			`mutation UpdatePlanFoodParent($id: uuid!, $planId: uuid!) {
        updateNutritionPlanFood(pk_columns: { id: $id }, _set: { nutritionPlanId: $planId }) { id }
      }`,
			{ id: planFoodId, planId: otherPlanId },
			TEST_USER_ID,
		);
		expect(errorText(updatePlanSource.errors)).toContain("nutritionPlanId");
	});
});

describe("nutrition logging snapshots", () => {
	test("snapshot columns are trigger-populated, stable after food changes, and slot time is user-updatable", async () => {
		if (!hasuraReachable) return;
		const food = await createFood(TEST_USER_ID, `Snapshot source ${RUN_ID}`);
		const day = await createDay(TEST_USER_ID, runDate(1));

		const forgedSnapshot = await gqlAsUser<{
			insertNutritionLogEntry: {
				source: string;
				snapshotFoodName: string;
				snapshotKcalPer100g: string;
			};
		}>(
			`mutation ForgedSnapshot($dayId: uuid!, $foodId: uuid!) {
        insertNutritionLogEntry(object: {
          nutritionDayId: $dayId, foodId: $foodId, grams: "100", position: 0,
          snapshotFoodName: "forged", snapshotKcalPer100g: "999",
          snapshotFatPer100g: "999", snapshotCarbsPer100g: "999",
          snapshotProteinPer100g: "999", snapshotFiberPer100g: "999",
          snapshotSugarPer100g: "999"
        }) { source snapshotFoodName snapshotKcalPer100g }
      }`,
			{ dayId: day.id, foodId: food.id },
			TEST_USER_ID,
		);
		expect(forgedSnapshot.errors).toBeUndefined();
		expect(forgedSnapshot.data!.insertNutritionLogEntry).toEqual({
			source: "food",
			snapshotFoodName: food.name,
			snapshotKcalPer100g: 123,
		});

		const inserted = await gqlAsUser<{
			insertNutritionLogEntry: {
				id: string;
				grams: string;
				slotTime: string;
				source: string;
				snapshotFoodName: string;
				snapshotKcalPer100g: string;
			};
		}>(
			`mutation Log($dayId: uuid!, $foodId: uuid!) {
        insertNutritionLogEntry(object: { nutritionDayId: $dayId, foodId: $foodId, grams: "100", position: 0, slotTime: "09:15:00" }) {
          id grams slotTime source snapshotFoodName snapshotKcalPer100g
        }
      }`,
			{ dayId: day.id, foodId: food.id },
			TEST_USER_ID,
		);
		expect(inserted.errors).toBeUndefined();
		expect(inserted.data!.insertNutritionLogEntry.snapshotFoodName).toBe(
			food.name,
		);
		expect(inserted.data!.insertNutritionLogEntry.slotTime).toBe("09:15:00");
		expect(inserted.data!.insertNutritionLogEntry.source).toBe("food");
		expect(
			String(inserted.data!.insertNutritionLogEntry.snapshotKcalPer100g),
		).toBe("123");

		const updateFood = await gqlAsUser<{ updateFood: { id: string } | null }>(
			`mutation UpdateFood($id: uuid!) { updateFood(pk_columns: { id: $id }, _set: { name: "Changed snapshot food ${RUN_ID}", kcalPer100g: "999" }) { id } }`,
			{ id: food.id },
			TEST_USER_ID,
		);
		expect(updateFood.errors).toBeUndefined();

		const updateEntry = await gqlAsUser<{
			updateNutritionLogEntry: {
				grams: string;
				position: number;
				slotTime: string;
				snapshotFoodName: string;
				snapshotKcalPer100g: string;
			} | null;
		}>(
			`mutation UpdateEntry($id: uuid!) { updateNutritionLogEntry(pk_columns: { id: $id }, _set: { grams: "50", position: 2 }) { grams position slotTime snapshotFoodName snapshotKcalPer100g } }`,
			{ id: inserted.data!.insertNutritionLogEntry.id },
			TEST_USER_ID,
		);
		expect(updateEntry.errors).toBeUndefined();
		expect(updateEntry.data!.updateNutritionLogEntry).toEqual({
			grams: 50,
			position: 2,
			slotTime: "09:15:00",
			snapshotFoodName: food.name,
			snapshotKcalPer100g: 123,
		});

		const updateSlotTime = await gqlAsUser<{
			updateNutritionLogEntry: { slotTime: string } | null;
		}>(
			`mutation UpdateSlotTime($id: uuid!) { updateNutritionLogEntry(pk_columns: { id: $id }, _set: { slotTime: "10:30:00" }) { slotTime } }`,
			{ id: inserted.data!.insertNutritionLogEntry.id },
			TEST_USER_ID,
		);
		expect(updateSlotTime.errors).toBeUndefined();
		expect(updateSlotTime.data!.updateNutritionLogEntry).toEqual({
			slotTime: "10:30:00",
		});

		const mutateFoodSnapshot = await gqlAsUser<unknown>(
			`mutation MutateFoodSnapshot($id: uuid!) {
        updateNutritionLogEntry(pk_columns: { id: $id }, _set: { snapshotFoodName: "mutated" }) { id }
      }`,
			{ id: inserted.data!.insertNutritionLogEntry.id },
			TEST_USER_ID,
		);
		expect(errorText(mutateFoodSnapshot.errors)).toContain("immutable");
	});

	test("food-backed log entries require food_id and reject foreign private foods", async () => {
		if (!hasuraReachable) return;
		const foreignFood = await createFood(
			OTHER_USER_ID,
			`Foreign log food ${RUN_ID}`,
		);
		const day = await createDay(TEST_USER_ID, runDate(2));

		const nullFood = await gqlAsUser<unknown>(
			`mutation NullFood($dayId: uuid!) {
        insertNutritionLogEntry(object: { nutritionDayId: $dayId, grams: "10", position: 0 }) { id }
      }`,
			{ dayId: day.id },
			TEST_USER_ID,
		);
		expect(errorText(nullFood.errors)).toContain("food_id is required");

		const foreignFoodLog = await gqlAsUser<unknown>(
			`mutation ForeignFood($dayId: uuid!, $foodId: uuid!) {
        insertNutritionLogEntry(object: { nutritionDayId: $dayId, foodId: $foodId, grams: "10", position: 1 }) { id }
      }`,
			{ dayId: day.id, foodId: foreignFood.id },
			TEST_USER_ID,
		);
		expectGraphQLError(foreignFoodLog.errors);
	});

	test("ad-hoc entries are standalone editable snapshots scoped to the user's day", async () => {
		if (!hasuraReachable) return;
		const ownDay = await createDay(TEST_USER_ID, runDate(12));
		const foreignDay = await createDay(OTHER_USER_ID, runDate(13));

		const inserted = await gqlAsUser<{
			insertNutritionLogEntry: {
				id: string;
				source: string;
				foodId: string | null;
				nutritionPlanFoodId: string | null;
				nutritionLogMealId: string | null;
				grams: string;
				slotTime: string;
				snapshotFoodName: string;
				snapshotKcalPer100g: string;
				snapshotFatPer100g: string;
			};
		}>(
			`mutation InsertAdHoc($dayId: uuid!) {
        insertNutritionLogEntry(object: {
          nutritionDayId: $dayId,
          source: "ad_hoc",
          grams: "180",
          position: 0,
          slotTime: "19:20:00",
          snapshotFoodName: "Restaurant curry",
          snapshotKcalPer100g: "210.50",
          snapshotFatPer100g: "8.25",
          snapshotCarbsPer100g: "24.00",
          snapshotProteinPer100g: "9.50",
          snapshotFiberPer100g: "3.00",
          snapshotSugarPer100g: "4.25"
        }) {
          id source foodId nutritionPlanFoodId nutritionLogMealId grams slotTime
          snapshotFoodName snapshotKcalPer100g snapshotFatPer100g
        }
      }`,
			{ dayId: ownDay.id },
			TEST_USER_ID,
		);
		expect(inserted.errors).toBeUndefined();
		expect(inserted.data!.insertNutritionLogEntry).toEqual({
			id: inserted.data!.insertNutritionLogEntry.id,
			source: "ad_hoc",
			foodId: null,
			nutritionPlanFoodId: null,
			nutritionLogMealId: null,
			grams: 180,
			slotTime: "19:20:00",
			snapshotFoodName: "Restaurant curry",
			snapshotKcalPer100g: 210.5,
			snapshotFatPer100g: 8.25,
		});

		const updated = await gqlAsUser<{
			updateNutritionLogEntry: {
				grams: string;
				slotTime: string;
				snapshotFoodName: string;
				snapshotKcalPer100g: string;
			} | null;
		}>(
			`mutation UpdateAdHoc($id: uuid!) {
        updateNutritionLogEntry(pk_columns: { id: $id }, _set: {
          grams: "200",
          slotTime: "20:05:00",
          snapshotFoodName: "Updated curry",
          snapshotKcalPer100g: "199.25"
        }) { grams slotTime snapshotFoodName snapshotKcalPer100g }
      }`,
			{ id: inserted.data!.insertNutritionLogEntry.id },
			TEST_USER_ID,
		);
		expect(updated.errors).toBeUndefined();
		expect(updated.data!.updateNutritionLogEntry).toEqual({
			grams: 200,
			slotTime: "20:05:00",
			snapshotFoodName: "Updated curry",
			snapshotKcalPer100g: 199.25,
		});

		const foreignDayInsert = await gqlAsUser<unknown>(
			`mutation ForeignDayAdHoc($dayId: uuid!) {
        insertNutritionLogEntry(object: {
          nutritionDayId: $dayId,
          source: "ad_hoc",
          grams: "100",
          position: 0,
          snapshotFoodName: "Foreign day",
          snapshotKcalPer100g: "1",
          snapshotFatPer100g: "0",
          snapshotCarbsPer100g: "0",
          snapshotProteinPer100g: "0",
          snapshotFiberPer100g: "0",
          snapshotSugarPer100g: "0"
        }) { id }
      }`,
			{ dayId: foreignDay.id },
			TEST_USER_ID,
		);
		expectGraphQLError(foreignDayInsert.errors);
	});

	test("ad-hoc entries reject incomplete snapshots, food, groups, and plan-food provenance", async () => {
		if (!hasuraReachable) return;
		const day = await createDay(TEST_USER_ID, runDate(14));
		const group = await gqlAsUser<{ insertNutritionLogMeal: { id: string } }>(
			`mutation Group($dayId: uuid!) { insertNutritionLogMeal(object: { nutritionDayId: $dayId, name: "No ad-hoc group", position: 0 }) { id } }`,
			{ dayId: day.id },
			TEST_USER_ID,
		);
		expect(group.errors).toBeUndefined();
		const planId = await createPlan(TEST_USER_ID, `No ad-hoc plan ${RUN_ID}`);
		const planFoodId = await createPlanFood(
			TEST_USER_ID,
			planId,
			PUBLIC_BANANA_ID,
		);

		const missingSnapshot = await gqlAsUser<unknown>(
			`mutation MissingSnapshot($dayId: uuid!) {
        insertNutritionLogEntry(object: { nutritionDayId: $dayId, source: "ad_hoc", grams: "10", position: 0 }) { id }
      }`,
			{ dayId: day.id },
			TEST_USER_ID,
		);
		expectGraphQLError(missingSnapshot.errors);

		const blankName = await gqlAsUser<unknown>(
			`mutation BlankAdHocName($dayId: uuid!) {
        insertNutritionLogEntry(object: {
          nutritionDayId: $dayId,
          source: "ad_hoc",
          grams: "10",
          position: 1,
          snapshotFoodName: "   ",
          snapshotKcalPer100g: "1",
          snapshotFatPer100g: "0",
          snapshotCarbsPer100g: "0",
          snapshotProteinPer100g: "0",
          snapshotFiberPer100g: "0",
          snapshotSugarPer100g: "0"
        }) { id }
      }`,
			{ dayId: day.id },
			TEST_USER_ID,
		);
		expectGraphQLError(blankName.errors);

		const foodBackedAdHoc = await gqlAsUser<unknown>(
			`mutation FoodBackedAdHoc($dayId: uuid!) {
        insertNutritionLogEntry(object: {
          nutritionDayId: $dayId,
          foodId: "${PUBLIC_BANANA_ID}",
          source: "ad_hoc",
          grams: "10",
          position: 2,
          snapshotFoodName: "Food-backed ad-hoc",
          snapshotKcalPer100g: "1",
          snapshotFatPer100g: "0",
          snapshotCarbsPer100g: "0",
          snapshotProteinPer100g: "0",
          snapshotFiberPer100g: "0",
          snapshotSugarPer100g: "0"
        }) { id }
      }`,
			{ dayId: day.id },
			TEST_USER_ID,
		);
		expect(errorText(foodBackedAdHoc.errors)).toContain("ad_hoc_shape_check");

		const groupedAdHoc = await gqlAsUser<unknown>(
			`mutation GroupedAdHoc($dayId: uuid!, $groupId: uuid!) {
        insertNutritionLogEntry(object: {
          nutritionDayId: $dayId,
          nutritionLogMealId: $groupId,
          source: "ad_hoc",
          grams: "10",
          position: 3,
          snapshotFoodName: "Grouped ad-hoc",
          snapshotKcalPer100g: "1",
          snapshotFatPer100g: "0",
          snapshotCarbsPer100g: "0",
          snapshotProteinPer100g: "0",
          snapshotFiberPer100g: "0",
          snapshotSugarPer100g: "0"
        }) { id }
      }`,
			{ dayId: day.id, groupId: group.data!.insertNutritionLogMeal.id },
			TEST_USER_ID,
		);
		expectGraphQLError(groupedAdHoc.errors);

		const planFoodAdHoc = await gqlAsUser<unknown>(
			`mutation PlanFoodAdHoc($dayId: uuid!, $planFoodId: uuid!) {
        insertNutritionLogEntry(object: {
          nutritionDayId: $dayId,
          nutritionPlanFoodId: $planFoodId,
          source: "ad_hoc",
          grams: "10",
          position: 4,
          snapshotFoodName: "Plan food ad-hoc",
          snapshotKcalPer100g: "1",
          snapshotFatPer100g: "0",
          snapshotCarbsPer100g: "0",
          snapshotProteinPer100g: "0",
          snapshotFiberPer100g: "0",
          snapshotSugarPer100g: "0"
        }) { id }
      }`,
			{ dayId: day.id, planFoodId },
			TEST_USER_ID,
		);
		expectGraphQLError(planFoodAdHoc.errors);
	});

	test("direct plan food logs are standalone, food-consistent, and snapshot-backed", async () => {
		if (!hasuraReachable) return;
		const food = await createFood(
			TEST_USER_ID,
			`Plan food log source ${RUN_ID}`,
		);
		const planId = await createPlan(
			TEST_USER_ID,
			`Plan food log plan ${RUN_ID}`,
		);
		const planFoodId = await createPlanFood(TEST_USER_ID, planId, food.id);
		const foreignPlanId = await createPlan(
			OTHER_USER_ID,
			`Foreign plan food log plan ${RUN_ID}`,
		);
		const foreignPlanFoodId = await createPlanFood(
			OTHER_USER_ID,
			foreignPlanId,
			PUBLIC_BANANA_ID,
		);
		const day = await createDay(TEST_USER_ID, runDate(10));

		const logged = await gqlAsUser<{
			insertNutritionLogEntry: {
				id: string;
				nutritionPlanFoodId: string | null;
				nutritionLogMealId: string | null;
				slotTime: string;
				snapshotFoodName: string;
			};
		}>(
			`mutation LogPlanFood($dayId: uuid!, $foodId: uuid!, $planFoodId: uuid!) {
        insertNutritionLogEntry(object: {
          nutritionDayId: $dayId,
          foodId: $foodId,
          nutritionPlanFoodId: $planFoodId,
          grams: "90",
          position: 0,
          slotTime: "18:15:00"
        }) { id nutritionPlanFoodId nutritionLogMealId slotTime snapshotFoodName }
      }`,
			{ dayId: day.id, foodId: food.id, planFoodId },
			TEST_USER_ID,
		);
		expect(logged.errors).toBeUndefined();
		expect(logged.data!.insertNutritionLogEntry).toEqual({
			id: logged.data!.insertNutritionLogEntry.id,
			nutritionPlanFoodId: planFoodId,
			nutritionLogMealId: null,
			slotTime: "18:15:00",
			snapshotFoodName: food.name,
		});

		const mismatch = await gqlAsUser<unknown>(
			`mutation MismatchPlanFood($dayId: uuid!, $planFoodId: uuid!) {
        insertNutritionLogEntry(object: {
          nutritionDayId: $dayId,
          foodId: "${PUBLIC_BANANA_ID}",
          nutritionPlanFoodId: $planFoodId,
          grams: "90",
          position: 1
        }) { id }
      }`,
			{ dayId: day.id, planFoodId },
			TEST_USER_ID,
		);
		expect(errorText(mismatch.errors)).toContain("must match");

		const group = await gqlAsUser<{ insertNutritionLogMeal: { id: string } }>(
			`mutation Group($dayId: uuid!) { insertNutritionLogMeal(object: { nutritionDayId: $dayId, name: "Grouped direct food", position: 1 }) { id } }`,
			{ dayId: day.id },
			TEST_USER_ID,
		);
		expect(group.errors).toBeUndefined();
		const grouped = await gqlAsUser<unknown>(
			`mutation GroupedPlanFood($dayId: uuid!, $groupId: uuid!, $foodId: uuid!, $planFoodId: uuid!) {
        insertNutritionLogEntry(object: {
          nutritionDayId: $dayId,
          nutritionLogMealId: $groupId,
          foodId: $foodId,
          nutritionPlanFoodId: $planFoodId,
          grams: "90",
          position: 2
        }) { id }
      }`,
			{
				dayId: day.id,
				groupId: group.data!.insertNutritionLogMeal.id,
				foodId: food.id,
				planFoodId,
			},
			TEST_USER_ID,
		);
		expect(errorText(grouped.errors)).toContain("standalone");

		const foreignPlanFood = await gqlAsUser<unknown>(
			`mutation ForeignPlanFood($dayId: uuid!, $planFoodId: uuid!) {
        insertNutritionLogEntry(object: {
          nutritionDayId: $dayId,
          foodId: "${PUBLIC_BANANA_ID}",
          nutritionPlanFoodId: $planFoodId,
          grams: "90",
          position: 3
        }) { id }
      }`,
			{ dayId: day.id, planFoodId: foreignPlanFoodId },
			TEST_USER_ID,
		);
		expectGraphQLError(foreignPlanFood.errors);
	});

	test("nested meal logging shape is permission-safe when every child carries the same day id", async () => {
		if (!hasuraReachable) return;
		const mealId = await createMeal(TEST_USER_ID, `Nested meal ${RUN_ID}`);
		const day = await createDay(TEST_USER_ID, runDate(3));

		const res = await gqlAsUser<{
			insertNutritionLogMeal: {
				id: string;
				slotTime: string;
				nutritionLogEntries: Array<{
					id: string;
					slotTime: string;
					snapshotFoodName: string;
				}>;
			};
		}>(
			`mutation NestedLog($dayId: uuid!, $mealId: uuid!, $foodId: uuid!) {
        insertNutritionLogMeal(object: {
          nutritionDayId: $dayId,
          mealId: $mealId,
          name: "Nested meal snapshot",
          slotTime: "13:45:00",
          position: 0,
          nutritionLogEntries: { data: [
            { nutritionDayId: $dayId, foodId: $foodId, grams: "100", position: 0, slotTime: "13:45:00" }
          ] }
        }) { id slotTime nutritionLogEntries { id slotTime snapshotFoodName } }
      }`,
			{ dayId: day.id, mealId, foodId: PUBLIC_BANANA_ID },
			TEST_USER_ID,
		);

		expect(res.errors).toBeUndefined();
		expect(res.data!.insertNutritionLogMeal.slotTime).toBe("13:45:00");
		expect(res.data!.insertNutritionLogMeal.nutritionLogEntries).toHaveLength(
			1,
		);
		expect(
			res.data!.insertNutritionLogMeal.nutritionLogEntries[0].slotTime,
		).toBe("13:45:00");
		expect(
			res.data!.insertNutritionLogMeal.nutritionLogEntries[0].snapshotFoodName,
		).toBe("Banana");
	});
});

describe("nutrition FK and cascade behavior", () => {
	test("wrong-day grouped entry insertion fails via composite FK", async () => {
		if (!hasuraReachable) return;
		const dayOne = await createDay(TEST_USER_ID, runDate(4));
		const dayTwo = await createDay(TEST_USER_ID, runDate(5));
		const group = await gqlAsUser<{ insertNutritionLogMeal: { id: string } }>(
			`mutation Group($dayId: uuid!) { insertNutritionLogMeal(object: { nutritionDayId: $dayId, name: "Wrong-day group", position: 0 }) { id } }`,
			{ dayId: dayOne.id },
			TEST_USER_ID,
		);
		expect(group.errors).toBeUndefined();

		const wrongDay = await gqlAsUser<unknown>(
			`mutation WrongDay($dayId: uuid!, $groupId: uuid!) {
        insertNutritionLogEntry(object: { nutritionDayId: $dayId, nutritionLogMealId: $groupId, foodId: "${PUBLIC_BANANA_ID}", grams: "100", position: 0 }) { id }
      }`,
			{ dayId: dayTwo.id, groupId: group.data!.insertNutritionLogMeal.id },
			TEST_USER_ID,
		);
		expectGraphQLError(wrongDay.errors);
	});

	test("food deletion is blocked by templates but not historical log snapshots", async () => {
		if (!hasuraReachable) return;
		const food = await createFood(
			TEST_USER_ID,
			`Delete semantics food ${RUN_ID}`,
		);
		const mealId = await createMeal(
			TEST_USER_ID,
			`Delete semantics meal ${RUN_ID}`,
		);
		const ingredient = await gqlAsUser<{
			insertMealIngredient: { id: string };
		}>(
			`mutation Ingredient($mealId: uuid!, $foodId: uuid!) { insertMealIngredient(object: { mealId: $mealId, foodId: $foodId, grams: "100", position: 0 }) { id } }`,
			{ mealId, foodId: food.id },
			TEST_USER_ID,
		);
		expect(ingredient.errors).toBeUndefined();

		const blocked = await gqlAsUser<unknown>(
			`mutation DeleteFood($id: uuid!) { deleteFood(id: $id) { id } }`,
			{ id: food.id },
			TEST_USER_ID,
		);
		expectGraphQLError(blocked.errors);

		await gqlAsUser(
			`mutation DeleteIngredient($id: uuid!) { deleteMealIngredient(id: $id) { id } }`,
			{ id: ingredient.data!.insertMealIngredient.id },
			TEST_USER_ID,
		);
		const day = await createDay(TEST_USER_ID, runDate(6));
		const entry = await gqlAsUser<{ insertNutritionLogEntry: { id: string } }>(
			`mutation Entry($dayId: uuid!, $foodId: uuid!) { insertNutritionLogEntry(object: { nutritionDayId: $dayId, foodId: $foodId, grams: "100", position: 0 }) { id } }`,
			{ dayId: day.id, foodId: food.id },
			TEST_USER_ID,
		);
		expect(entry.errors).toBeUndefined();

		const deleted = await gqlAsUser<{ deleteFood: { id: string } | null }>(
			`mutation DeleteFood($id: uuid!) { deleteFood(id: $id) { id } }`,
			{ id: food.id },
			TEST_USER_ID,
		);
		expect(deleted.errors).toBeUndefined();
		expect(deleted.data!.deleteFood?.id).toBe(food.id);

		const retained = await gqlAsUser<{
			nutritionLogEntry: {
				source: string;
				foodId: string | null;
				snapshotFoodName: string;
			} | null;
		}>(
			`query Entry($id: uuid!) { nutritionLogEntry(id: $id) { source foodId snapshotFoodName } }`,
			{ id: entry.data!.insertNutritionLogEntry.id },
			TEST_USER_ID,
		);
		expect(retained.errors).toBeUndefined();
		expect(retained.data!.nutritionLogEntry).toEqual({
			source: "food",
			foodId: null,
			snapshotFoodName: food.name,
		});

		const mutateOrphanedSnapshot = await gqlAsUser<unknown>(
			`mutation MutateOrphanedSnapshot($id: uuid!) {
        updateNutritionLogEntry(pk_columns: { id: $id }, _set: { snapshotFoodName: "orphan changed" }) { id }
      }`,
			{ id: entry.data!.insertNutritionLogEntry.id },
			TEST_USER_ID,
		);
		expect(errorText(mutateOrphanedSnapshot.errors)).toContain("immutable");
	});

	test("direct plan foods restrict source food deletion but provenance is nulled on template delete", async () => {
		if (!hasuraReachable) return;
		const food = await createFood(
			TEST_USER_ID,
			`Direct plan food delete semantics ${RUN_ID}`,
		);
		const planId = await createPlan(
			TEST_USER_ID,
			`Direct plan food delete plan ${RUN_ID}`,
		);
		const planFoodId = await createPlanFood(TEST_USER_ID, planId, food.id);

		const blocked = await gqlAsUser<unknown>(
			`mutation DeleteFood($id: uuid!) { deleteFood(id: $id) { id } }`,
			{ id: food.id },
			TEST_USER_ID,
		);
		expectGraphQLError(blocked.errors);

		const day = await createDay(TEST_USER_ID, runDate(11));
		const entry = await gqlAsUser<{
			insertNutritionLogEntry: {
				id: string;
				nutritionPlanFoodId: string | null;
				snapshotFoodName: string;
			};
		}>(
			`mutation LogPlanFood($dayId: uuid!, $foodId: uuid!, $planFoodId: uuid!) {
        insertNutritionLogEntry(object: { nutritionDayId: $dayId, foodId: $foodId, nutritionPlanFoodId: $planFoodId, grams: "75", position: 0 }) {
          id nutritionPlanFoodId snapshotFoodName
        }
      }`,
			{ dayId: day.id, foodId: food.id, planFoodId },
			TEST_USER_ID,
		);
		expect(entry.errors).toBeUndefined();
		expect(entry.data!.insertNutritionLogEntry.nutritionPlanFoodId).toBe(
			planFoodId,
		);

		const deletePlan = await gqlAsUser<{
			deleteNutritionPlan: { id: string } | null;
		}>(
			`mutation DeletePlan($id: uuid!) { deleteNutritionPlan(id: $id) { id } }`,
			{ id: planId },
			TEST_USER_ID,
		);
		expect(deletePlan.errors).toBeUndefined();

		const retained = await gqlAsUser<{
			nutritionLogEntry: {
				nutritionPlanFoodId: string | null;
				foodId: string | null;
				snapshotFoodName: string;
			} | null;
		}>(
			`query Entry($id: uuid!) { nutritionLogEntry(id: $id) { nutritionPlanFoodId foodId snapshotFoodName } }`,
			{ id: entry.data!.insertNutritionLogEntry.id },
			TEST_USER_ID,
		);
		expect(retained.errors).toBeUndefined();
		expect(retained.data!.nutritionLogEntry).toEqual({
			nutritionPlanFoodId: null,
			foodId: food.id,
			snapshotFoodName: food.name,
		});

		const deleteFood = await gqlAsUser<{ deleteFood: { id: string } | null }>(
			`mutation DeleteFood($id: uuid!) { deleteFood(id: $id) { id } }`,
			{ id: food.id },
			TEST_USER_ID,
		);
		expect(deleteFood.errors).toBeUndefined();
		expect(deleteFood.data!.deleteFood?.id).toBe(food.id);

		const afterFoodDelete = await gqlAsUser<{
			nutritionLogEntry: {
				foodId: string | null;
				snapshotFoodName: string;
			} | null;
		}>(
			`query Entry($id: uuid!) { nutritionLogEntry(id: $id) { foodId snapshotFoodName } }`,
			{ id: entry.data!.insertNutritionLogEntry.id },
			TEST_USER_ID,
		);
		expect(afterFoodDelete.errors).toBeUndefined();
		expect(afterFoodDelete.data!.nutritionLogEntry).toEqual({
			foodId: null,
			snapshotFoodName: food.name,
		});
	});

	test("meal deletion is blocked by plan slots but not historical log provenance", async () => {
		if (!hasuraReachable) return;
		const mealId = await createMeal(
			TEST_USER_ID,
			`Meal delete semantics ${RUN_ID}`,
		);
		const planId = await createPlan(TEST_USER_ID, `Plan blocks meal ${RUN_ID}`);
		const slot = await gqlAsUser<{ insertNutritionPlanMeal: { id: string } }>(
			`mutation Slot($planId: uuid!, $mealId: uuid!) { insertNutritionPlanMeal(object: { nutritionPlanId: $planId, mealId: $mealId, slotTime: "09:00:00", position: 0 }) { id } }`,
			{ planId, mealId },
			TEST_USER_ID,
		);
		expect(slot.errors).toBeUndefined();

		const blocked = await gqlAsUser<unknown>(
			`mutation DeleteMeal($id: uuid!) { deleteMeal(id: $id) { id } }`,
			{ id: mealId },
			TEST_USER_ID,
		);
		expectGraphQLError(blocked.errors);

		await gqlAsUser(
			`mutation DeleteSlot($id: uuid!) { deleteNutritionPlanMeal(id: $id) { id } }`,
			{ id: slot.data!.insertNutritionPlanMeal.id },
			TEST_USER_ID,
		);
		const day = await createDay(TEST_USER_ID, runDate(7));
		const group = await gqlAsUser<{ insertNutritionLogMeal: { id: string } }>(
			`mutation Group($dayId: uuid!, $mealId: uuid!) { insertNutritionLogMeal(object: { nutritionDayId: $dayId, mealId: $mealId, name: "Historical meal", position: 0 }) { id } }`,
			{ dayId: day.id, mealId },
			TEST_USER_ID,
		);
		expect(group.errors).toBeUndefined();

		const deleted = await gqlAsUser<{ deleteMeal: { id: string } | null }>(
			`mutation DeleteMeal($id: uuid!) { deleteMeal(id: $id) { id } }`,
			{ id: mealId },
			TEST_USER_ID,
		);
		expect(deleted.errors).toBeUndefined();

		const retained = await gqlAsUser<{
			nutritionLogMeal: { mealId: string | null } | null;
		}>(
			`query Group($id: uuid!) { nutritionLogMeal(id: $id) { mealId } }`,
			{ id: group.data!.insertNutritionLogMeal.id },
			TEST_USER_ID,
		);
		expect(retained.errors).toBeUndefined();
		expect(retained.data!.nutritionLogMeal?.mealId).toBeNull();
	});

	test("plan deletion detaches days, group deletion cascades entries, and day deletion cascades logs", async () => {
		if (!hasuraReachable) return;
		const planId = await createPlan(TEST_USER_ID, `Detach plan ${RUN_ID}`);
		const day = await createDay(TEST_USER_ID, runDate(8), planId);

		const deletePlan = await gqlAsUser<{
			deleteNutritionPlan: { id: string } | null;
		}>(
			`mutation DeletePlan($id: uuid!) { deleteNutritionPlan(id: $id) { id } }`,
			{ id: planId },
			TEST_USER_ID,
		);
		expect(deletePlan.errors).toBeUndefined();
		const detached = await gqlAsUser<{
			nutritionDay: { nutritionPlanId: string | null } | null;
		}>(
			`query Day($id: uuid!) { nutritionDay(id: $id) { nutritionPlanId } }`,
			{ id: day.id },
			TEST_USER_ID,
		);
		expect(detached.data!.nutritionDay?.nutritionPlanId).toBeNull();

		const group = await gqlAsUser<{
			insertNutritionLogMeal: {
				id: string;
				nutritionLogEntries: Array<{ id: string }>;
			};
		}>(
			`mutation Group($dayId: uuid!) {
        insertNutritionLogMeal(object: {
          nutritionDayId: $dayId, name: "Cascade group", position: 0,
          nutritionLogEntries: { data: [{ nutritionDayId: $dayId, foodId: "${PUBLIC_BANANA_ID}", grams: "100", position: 0 }] }
        }) { id nutritionLogEntries { id } }
      }`,
			{ dayId: day.id },
			TEST_USER_ID,
		);
		expect(group.errors).toBeUndefined();
		const groupedEntryId =
			group.data!.insertNutritionLogMeal.nutritionLogEntries[0].id;

		const deleteGroup = await gqlAsUser<{
			deleteNutritionLogMeal: { id: string } | null;
		}>(
			`mutation DeleteGroup($id: uuid!) { deleteNutritionLogMeal(id: $id) { id } }`,
			{ id: group.data!.insertNutritionLogMeal.id },
			TEST_USER_ID,
		);
		expect(deleteGroup.errors).toBeUndefined();
		const goneEntry = await gqlAsUser<{
			nutritionLogEntry: { id: string } | null;
		}>(
			`query Entry($id: uuid!) { nutritionLogEntry(id: $id) { id } }`,
			{ id: groupedEntryId },
			TEST_USER_ID,
		);
		expect(goneEntry.data!.nutritionLogEntry).toBeNull();

		const standalone = await gqlAsUser<{
			insertNutritionLogEntry: { id: string };
		}>(
			`mutation Standalone($dayId: uuid!) { insertNutritionLogEntry(object: { nutritionDayId: $dayId, foodId: "${PUBLIC_BANANA_ID}", grams: "50", position: 1 }) { id } }`,
			{ dayId: day.id },
			TEST_USER_ID,
		);
		expect(standalone.errors).toBeUndefined();

		const deleteStandalone = await gqlAsUser<{
			deleteNutritionLogEntry: { id: string } | null;
		}>(
			`mutation DeleteStandalone($id: uuid!) { deleteNutritionLogEntry(id: $id) { id } }`,
			{ id: standalone.data!.insertNutritionLogEntry.id },
			TEST_USER_ID,
		);
		expect(deleteStandalone.errors).toBeUndefined();

		const anotherGroup = await gqlAsUser<{
			insertNutritionLogMeal: {
				id: string;
				nutritionLogEntries: Array<{ id: string }>;
			};
		}>(
			`mutation AnotherGroup($dayId: uuid!) {
        insertNutritionLogMeal(object: {
          nutritionDayId: $dayId, name: "Day cascade group", position: 2,
          nutritionLogEntries: { data: [{ nutritionDayId: $dayId, foodId: "${PUBLIC_BANANA_ID}", grams: "25", position: 0 }] }
        }) { id nutritionLogEntries { id } }
      }`,
			{ dayId: day.id },
			TEST_USER_ID,
		);
		expect(anotherGroup.errors).toBeUndefined();

		const deleteDay = await gqlAsUser<{
			deleteNutritionDay: { id: string } | null;
		}>(
			`mutation DeleteDay($id: uuid!) { deleteNutritionDay(id: $id) { id } }`,
			{ id: day.id },
			TEST_USER_ID,
		);
		expect(deleteDay.errors).toBeUndefined();
		const groupAfterDayDelete = await gqlAsUser<{
			nutritionLogMeal: { id: string } | null;
		}>(
			`query Group($id: uuid!) { nutritionLogMeal(id: $id) { id } }`,
			{ id: anotherGroup.data!.insertNutritionLogMeal.id },
			TEST_USER_ID,
		);
		expect(groupAfterDayDelete.data!.nutritionLogMeal).toBeNull();
	});
});

describe("nutrition user-role allowlists", () => {
	test("users cannot update template/log parent ids, source, or food provenance columns", async () => {
		if (!hasuraReachable) return;
		const mealId = await createMeal(TEST_USER_ID, `Allowlist meal ${RUN_ID}`);
		const day = await createDay(TEST_USER_ID, runDate(9));
		const entry = await gqlAsUser<{ insertNutritionLogEntry: { id: string } }>(
			`mutation Entry($dayId: uuid!) { insertNutritionLogEntry(object: { nutritionDayId: $dayId, foodId: "${PUBLIC_BANANA_ID}", grams: "50", position: 0 }) { id } }`,
			{ dayId: day.id },
			TEST_USER_ID,
		);
		expect(entry.errors).toBeUndefined();

		const changeIngredientFood = await gqlAsUser<unknown>(
			`mutation BadIngredientUpdate($mealId: uuid!) {
        updateMealIngredients(where: { mealId: { _eq: $mealId } }, _set: { foodId: "${PUBLIC_BANANA_ID}" }) { affected_rows }
      }`,
			{ mealId },
			TEST_USER_ID,
		);
		expect(errorText(changeIngredientFood.errors)).toContain("foodId");

		const changeEntryFood = await gqlAsUser<unknown>(
			`mutation BadEntryUpdate($id: uuid!) {
        updateNutritionLogEntry(pk_columns: { id: $id }, _set: { foodId: null }) { id }
      }`,
			{ id: entry.data!.insertNutritionLogEntry.id },
			TEST_USER_ID,
		);
		expect(errorText(changeEntryFood.errors)).toContain("foodId");

		const changeEntrySource = await gqlAsUser<unknown>(
			`mutation BadEntrySourceUpdate($id: uuid!) {
        updateNutritionLogEntry(pk_columns: { id: $id }, _set: { source: "ad_hoc" }) { id }
      }`,
			{ id: entry.data!.insertNutritionLogEntry.id },
			TEST_USER_ID,
		);
		expect(errorText(changeEntrySource.errors)).toContain("source");

		const adminChangeEntrySource = await gqlAdmin<unknown>(
			`mutation AdminBadEntrySourceUpdate($id: uuid!) {
        updateNutritionLogEntry(pk_columns: { id: $id }, _set: { source: "ad_hoc" }) { id }
      }`,
			{ id: entry.data!.insertNutritionLogEntry.id },
		);
		expect(errorText(adminChangeEntrySource.errors)).toContain("immutable");

		const changeEntryPlanFood = await gqlAsUser<unknown>(
			`mutation BadEntryPlanFoodUpdate($id: uuid!) {
        updateNutritionLogEntry(pk_columns: { id: $id }, _set: { nutritionPlanFoodId: null }) { id }
      }`,
			{ id: entry.data!.insertNutritionLogEntry.id },
			TEST_USER_ID,
		);
		expect(errorText(changeEntryPlanFood.errors)).toContain(
			"nutritionPlanFoodId",
		);
	});
});
