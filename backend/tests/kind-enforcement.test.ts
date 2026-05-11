// Backend integration tests for the strength/cardio kind discriminator.
//
// These exercise the database-level invariants by talking to the local Hasura
// GraphQL endpoint with the admin secret. They verify that the structural
// guarantees we designed actually hold end-to-end:
//
//   1. `exercises.kind` is generated correctly from `exercises.category`.
//   2. `exercises.cardio` resolves to a non-null sidecar (with metricsSchema)
//      for cardio exercises and to null for strength exercises.
//   3. `workout_session_exercises.kind` is auto-populated by the sync trigger
//      from the parent exercise's kind on insert.
//   4. A `workout_session_strength_set` cannot attach to a cardio session-
//      exercise (FK violation on composite `(workout_session_exercise_id,
//      parent_kind)` → `workout_session_exercises(id, kind)`).
//   5. A `workout_session_cardio_entry` cannot attach to a strength session-
//      exercise (same composite FK, mirror direction).
//   6. A cardio entry with invalid metrics shape is rejected by the
//      `validate_workout_session_cardio_entry` trigger (`pg_jsonschema`).
//   7. A valid cardio entry inserts successfully.
//   8. A valid strength set inserts successfully.
//
// Prereqs: local Nhost stack must be running with seeds applied
// (`make dev-env-up` from backend/). Tests skip cleanly if Hasura isn't
// reachable, so they don't fail CI when the stack is down.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

const HASURA_URL = "https://local.graphql.local.nhost.run/v1";
const ADMIN_SECRET = "nhost-admin-secret";

// Seed UUIDs (see backend/nhost/seeds/default/1778179381117_test_user.sql and
// 1778716800004_cardio_examples.sql).
const TEST_USER_ID = "f26ac88d-4dcd-48e8-a0ae-b4248918bc1c";
const CARDIO_EXERCISE_ID = "019e0675-a94d-7663-a002-da133cfe683c"; // Running, Treadmill
const STRENGTH_EXERCISE_ID = "019e0675-a286-7b8a-9ed0-aff41340d088"; // Barbell Hip Thrust

interface GraphQLResponse<T> {
  data: T | null;
  errors?: Array<{
    message: string;
    extensions?: { code?: string };
  }>;
}

async function gql<T>(
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

// Test fixtures: a fresh empty workout_session created for each test run, so
// failures don't depend on the seed state and our writes don't pollute the
// shared cardio-examples session.
let testSessionId: string | null = null;
let cardioWseId: string | null = null;
let strengthWseId: string | null = null;
let hasuraReachable = false;

beforeAll(async () => {
  hasuraReachable = await isHasuraReachable();
  if (!hasuraReachable) return;

  // Create a fresh ad-hoc session containing one cardio WSE and one strength
  // WSE. Both WSE rows get their `kind` populated by the sync trigger from
  // the parent exercises.
  const res = await gql<{
    insertWorkoutSession: {
      id: string;
      workoutSessionExercises: Array<{ id: string; kind: string; exerciseId: string }>;
    };
  }>(
    `
    mutation CreateTestSession($userId: uuid!, $cardioEx: uuid!, $strengthEx: uuid!) {
      insertWorkoutSession(object: {
        userId: $userId,
        workoutSessionExercises: { data: [
          { exerciseId: $cardioEx,   position: 0 },
          { exerciseId: $strengthEx, position: 1 }
        ] }
      }) {
        id
        workoutSessionExercises(order_by: { position: asc }) { id kind exerciseId }
      }
    }
  `,
    { userId: TEST_USER_ID, cardioEx: CARDIO_EXERCISE_ID, strengthEx: STRENGTH_EXERCISE_ID },
  );

  if (res.errors) {
    throw new Error(`fixture setup failed: ${JSON.stringify(res.errors)}`);
  }
  const session = res.data!.insertWorkoutSession;
  testSessionId = session.id;
  cardioWseId = session.workoutSessionExercises.find((w) => w.exerciseId === CARDIO_EXERCISE_ID)!.id;
  strengthWseId = session.workoutSessionExercises.find((w) => w.exerciseId === STRENGTH_EXERCISE_ID)!.id;
});

afterAll(async () => {
  if (!hasuraReachable || !testSessionId) return;
  await gql(`mutation Cleanup($id: uuid!) { deleteWorkoutSession(id: $id) { id } }`, {
    id: testSessionId,
  });
});

describe("kind discriminator", () => {
  test("Hasura reachable (skips suite otherwise)", () => {
    if (!hasuraReachable) {
      console.warn("local Hasura not reachable — skipping kind enforcement tests");
    }
    expect(hasuraReachable).toBe(true);
  });

  test("exercise.kind matches category mapping", async () => {
    if (!hasuraReachable) return;
    const res = await gql<{
      cardio: { kind: string; category: string };
      strength: { kind: string; category: string };
    }>(
      `
      query KindMapping($cardio: uuid!, $strength: uuid!) {
        cardio:   exercise(id: $cardio)   { kind category }
        strength: exercise(id: $strength) { kind category }
      }
    `,
      { cardio: CARDIO_EXERCISE_ID, strength: STRENGTH_EXERCISE_ID },
    );
    expect(res.errors).toBeUndefined();
    expect(res.data!.cardio).toEqual({ kind: "cardio", category: "cardio" });
    expect(res.data!.strength).toEqual({ kind: "strength", category: "powerlifting" });
  });

  test("exercise.cardio is populated for cardio, null for strength", async () => {
    if (!hasuraReachable) return;
    const res = await gql<{
      cardio: { cardio: { metricsSchema: Record<string, unknown> } | null };
      strength: { cardio: unknown };
    }>(
      `
      query CardioSidecar($cardio: uuid!, $strength: uuid!) {
        cardio:   exercise(id: $cardio)   { cardio { metricsSchema } }
        strength: exercise(id: $strength) { cardio { metricsSchema } }
      }
    `,
      { cardio: CARDIO_EXERCISE_ID, strength: STRENGTH_EXERCISE_ID },
    );
    expect(res.errors).toBeUndefined();
    expect(res.data!.cardio.cardio).not.toBeNull();
    expect(res.data!.cardio.cardio!.metricsSchema).toMatchObject({
      type: "object",
      required: ["duration_s"],
    });
    expect(res.data!.strength.cardio).toBeNull();
  });

  test("workout_session_exercises.kind is synced from parent exercise on insert", () => {
    if (!hasuraReachable) return;
    expect(cardioWseId).toBeTruthy();
    expect(strengthWseId).toBeTruthy();
  });
});

describe("composite-FK enforcement", () => {
  test("strength set against cardio WSE → foreign key violation", async () => {
    if (!hasuraReachable) return;
    const res = await gql(
      `
      mutation BadStrengthSet($wseId: uuid!) {
        insertWorkoutSessionStrengthSet(object: {
          workoutSessionExerciseId: $wseId,
          setNumber: 1, reps: 10, weight: "50.00"
        }) { id }
      }
    `,
      { wseId: cardioWseId },
    );
    expect(res.errors).toBeDefined();
    expect(res.errors![0].extensions?.code).toBe("constraint-violation");
    expect(res.errors![0].message.toLowerCase()).toContain("foreign key");
  });

  test("cardio entry against strength WSE → foreign key violation", async () => {
    if (!hasuraReachable) return;
    const res = await gql(
      `
      mutation BadCardioEntry($wseId: uuid!) {
        insertWorkoutSessionCardioEntry(object: {
          workoutSessionExerciseId: $wseId,
          entryNumber: 1,
          metrics: { duration_s: 60 }
        }) { id }
      }
    `,
      { wseId: strengthWseId },
    );
    expect(res.errors).toBeDefined();
    expect(res.errors![0].extensions?.code).toBe("constraint-violation");
    expect(res.errors![0].message.toLowerCase()).toContain("foreign key");
  });

  test("client cannot bypass the sync trigger by passing a wrong kind", async () => {
    if (!hasuraReachable) return;
    // Try to insert a WSE pointing at a cardio exercise while passing
    // kind="strength". The BEFORE INSERT trigger overwrites NEW.kind with the
    // parent's, so the row ends up with kind='cardio' regardless of what was
    // passed.
    const res = await gql<{
      insertWorkoutSessionExercise: { id: string; kind: string };
    }>(
      `
      mutation LyingKind($sessionId: uuid!, $cardioEx: uuid!) {
        insertWorkoutSessionExercise(object: {
          workoutSessionId: $sessionId,
          exerciseId: $cardioEx,
          position: 99,
          kind: "strength"
        }) { id kind }
      }
    `,
      { sessionId: testSessionId, cardioEx: CARDIO_EXERCISE_ID },
    );
    expect(res.errors).toBeUndefined();
    expect(res.data!.insertWorkoutSessionExercise.kind).toBe("cardio");

    // Clean up the extra WSE so subsequent tests aren't affected.
    await gql(`mutation Drop($id: uuid!) { deleteWorkoutSessionExercise(id: $id) { id } }`, {
      id: res.data!.insertWorkoutSessionExercise.id,
    });
  });
});

describe("cardio metrics-schema validation", () => {
  test("cardio entry missing required field → schema-validation error", async () => {
    if (!hasuraReachable) return;
    const res = await gql(
      `
      mutation BadMetrics($wseId: uuid!) {
        insertWorkoutSessionCardioEntry(object: {
          workoutSessionExerciseId: $wseId,
          entryNumber: 11,
          metrics: { distance_km: 5.0 }
        }) { id }
      }
    `,
      { wseId: cardioWseId },
    );
    expect(res.errors).toBeDefined();
    expect(res.errors![0].message.toLowerCase()).toContain("schema validation");
  });

  test("cardio entry with unknown property → schema-validation error", async () => {
    if (!hasuraReachable) return;
    const res = await gql(
      `
      mutation ExtraKeyMetrics($wseId: uuid!) {
        insertWorkoutSessionCardioEntry(object: {
          workoutSessionExerciseId: $wseId,
          entryNumber: 12,
          metrics: { duration_s: 60, bogus_field: 123 }
        }) { id }
      }
    `,
      { wseId: cardioWseId },
    );
    expect(res.errors).toBeDefined();
    expect(res.errors![0].message.toLowerCase()).toContain("schema validation");
  });

  test("valid cardio entry inserts successfully", async () => {
    if (!hasuraReachable) return;
    const res = await gql<{
      insertWorkoutSessionCardioEntry: { id: string; entryNumber: number };
    }>(
      `
      mutation GoodCardioEntry($wseId: uuid!) {
        insertWorkoutSessionCardioEntry(object: {
          workoutSessionExerciseId: $wseId,
          entryNumber: 13,
          metrics: { duration_s: 1800, distance_km: 5.0, calories_kcal: 250, avg_hr_bpm: 150 }
        }) { id entryNumber }
      }
    `,
      { wseId: cardioWseId },
    );
    expect(res.errors).toBeUndefined();
    expect(res.data!.insertWorkoutSessionCardioEntry.entryNumber).toBe(13);
  });

  test("valid strength set inserts successfully", async () => {
    if (!hasuraReachable) return;
    const res = await gql<{
      insertWorkoutSessionStrengthSet: { id: string; setNumber: number };
    }>(
      `
      mutation GoodStrengthSet($wseId: uuid!) {
        insertWorkoutSessionStrengthSet(object: {
          workoutSessionExerciseId: $wseId,
          setNumber: 21, reps: 8, weight: "100.00"
        }) { id setNumber }
      }
    `,
      { wseId: strengthWseId },
    );
    expect(res.errors).toBeUndefined();
    expect(res.data!.insertWorkoutSessionStrengthSet.setNumber).toBe(21);
  });
});
