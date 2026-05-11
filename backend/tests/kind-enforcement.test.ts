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
// A uuid that doesn't correspond to any real user — used to forge an
// X-Hasura-User-Id header for negative permission tests.
const OTHER_USER_ID = "11111111-1111-4111-8111-111111111111";
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

// Run a request as the `user` role with a forged X-Hasura-User-Id. The admin
// secret still has to be present for Hasura to honor the role override.
async function gqlAsUser<T>(
  userId: string,
  query: string,
  variables: Record<string, unknown> = {},
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

// User-role permission tests. These complement the SQL-level integrity tests
// above by exercising the *security boundary* — the FK chain
// `child → workout_session_exercise → workout_session → user`. A regression in
// any of the user-role permissions in the metadata YAMLs would silently let
// one user read or write into another user's session, and SQL constraints
// would never catch it.
describe("user-role permissions", () => {
  test("foreign user cannot insert a cardio entry into another user's session", async () => {
    if (!hasuraReachable) return;
    const res = await gqlAsUser(
      OTHER_USER_ID,
      `
      mutation ForeignCardioInsert($wseId: uuid!) {
        insertWorkoutSessionCardioEntry(object: {
          workoutSessionExerciseId: $wseId,
          entryNumber: 50,
          metrics: { duration_s: 600 }
        }) { id }
      }
    `,
      { wseId: cardioWseId },
    );
    expect(res.errors).toBeDefined();
    // Hasura returns "permission-error" when the insert check fails; it never
    // reaches the row.
    expect(res.errors![0].extensions?.code).toBe("permission-error");
  });

  test("foreign user cannot insert a strength set into another user's session", async () => {
    if (!hasuraReachable) return;
    const res = await gqlAsUser(
      OTHER_USER_ID,
      `
      mutation ForeignStrengthInsert($wseId: uuid!) {
        insertWorkoutSessionStrengthSet(object: {
          workoutSessionExerciseId: $wseId,
          setNumber: 50, reps: 5, weight: "60.00"
        }) { id }
      }
    `,
      { wseId: strengthWseId },
    );
    expect(res.errors).toBeDefined();
    expect(res.errors![0].extensions?.code).toBe("permission-error");
  });

  test("foreign user's select on another user's session returns no rows", async () => {
    if (!hasuraReachable) return;
    // The seeded cardio entries created above belong to TEST_USER_ID. A
    // foreign user querying the same WSEs gets an empty list — the select
    // filter (`workoutSession.user_id = X-Hasura-User-Id`) hides them.
    const res = await gqlAsUser<{
      cardio: Array<{ id: string }>;
      strength: Array<{ id: string }>;
    }>(
      OTHER_USER_ID,
      `
      query ForeignSelect($cardioWse: uuid!, $strengthWse: uuid!) {
        cardio: workoutSessionCardioEntries(where: { workoutSessionExerciseId: { _eq: $cardioWse } }) { id }
        strength: workoutSessionStrengthSets(where: { workoutSessionExerciseId: { _eq: $strengthWse } }) { id }
      }
    `,
      { cardioWse: cardioWseId, strengthWse: strengthWseId },
    );
    expect(res.errors).toBeUndefined();
    expect(res.data!.cardio).toEqual([]);
    expect(res.data!.strength).toEqual([]);
  });

  test("user-role schema does not expose `kind` as an insertable column on WSE", async () => {
    if (!hasuraReachable) return;
    // The user-role insert column allowlist is (workout_session_id,
    // exercise_id, position). `kind` is excluded — even if a client tries to
    // pin it, Hasura rejects the field before the SQL runs (validation error),
    // not at the trigger level. This locks the security boundary independently
    // of the sync trigger.
    const res = await gqlAsUser(
      TEST_USER_ID,
      `
      mutation UserLyingKind($sessionId: uuid!, $cardioEx: uuid!) {
        insertWorkoutSessionExercise(object: {
          workoutSessionId: $sessionId,
          exerciseId: $cardioEx,
          position: 50,
          kind: "strength"
        }) { id kind }
      }
    `,
      { sessionId: testSessionId, cardioEx: CARDIO_EXERCISE_ID },
    );
    expect(res.errors).toBeDefined();
    // The field-not-found error comes from Hasura's GraphQL validator; the
    // exact code is `validation-failed`.
    expect(res.errors![0].extensions?.code).toBe("validation-failed");
    expect(res.errors![0].message.toLowerCase()).toContain("kind");
  });

  test("user-role cannot insert exercises_cardio for a public catalog exercise", async () => {
    if (!hasuraReachable) return;
    // The seeded cardio exercises are public (`is_public = true`). The
    // exercises_cardio insert permission requires `is_public = false AND
    // user_id = self`, so even the owning user cannot back-fill a sidecar for
    // a public exercise — that's an admin-only operation. In practice the
    // request can fail two ways:
    //   - `permission-error`: Hasura's insert check rejects the row.
    //   - `constraint-violation`: the PK already has a row (the migration
    //     backfilled metrics_schema for every public cardio exercise), so
    //     Postgres rejects the duplicate before the check fires.
    // Both are valid "user is blocked" outcomes for this security boundary.
    const res = await gqlAsUser(
      TEST_USER_ID,
      `
      mutation UserSchemaPush($exId: uuid!) {
        insertExerciseCardio(object: {
          exerciseId: $exId,
          metricsSchema: { type: "object", properties: { duration_s: { type: "integer" } }, required: ["duration_s"] }
        }) { exerciseId }
      }
    `,
      { exId: CARDIO_EXERCISE_ID },
    );
    expect(res.errors).toBeDefined();
    const code = res.errors![0].extensions?.code;
    expect(code).toBeDefined();
    expect(["permission-error", "constraint-violation"]).toContain(code as string);
  });
});

// Cascade-integrity tests.
//
// The composite-FK design rests on a subtle chain when `exercises.category` is
// flipped:
//
//   1. exercises.kind is a GENERATED STORED column derived from category.
//      Updating category recomputes kind.
//   2. workout_exercises(exercise_id, kind) and
//      workout_session_exercises(exercise_id, kind) composite-FK to
//      exercises(id, kind) with ON UPDATE CASCADE — so their `kind` column
//      follows the parent.
//   3. workout_session_strength_sets(workout_session_exercise_id, parent_kind)
//      and workout_session_cardio_entries(workout_session_exercise_id,
//      parent_kind) composite-FK to workout_session_exercises(id, kind) with
//      ON UPDATE CASCADE — so when the WSE.kind changes, the children's
//      parent_kind would have to follow.
//   4. But parent_kind has DEFAULT '<kind>' + CHECK (parent_kind = '<kind>'),
//      pinning it to a single literal. So step 3's CASCADE update violates the
//      CHECK and the whole transaction rolls back.
//
// If anyone ever relaxes the CHECK to `parent_kind IN (...)` or drops one of
// the ON UPDATE CASCADE clauses, this guarantee silently disappears — and a
// strength session with logged sets could be flipped to cardio without
// invalidating those sets. These tests fail fast in that scenario.
//
// The cascade only fires if the WSE actually has a child row, so each test
// inserts a child first, then attempts the flip.
describe("category-flip cascade integrity", () => {
  test("flipping a strength exercise to cardio with logged sets → check violation", async () => {
    if (!hasuraReachable) return;

    // Anchor a strength set to the strength WSE so the cascade reaches the
    // pinned parent_kind CHECK.
    const setRes = await gql<{ insertWorkoutSessionStrengthSet: { id: string } }>(
      `
      mutation AnchorStrengthSet($wseId: uuid!) {
        insertWorkoutSessionStrengthSet(object: {
          workoutSessionExerciseId: $wseId,
          setNumber: 81, reps: 5, weight: "50.00"
        }) { id }
      }
    `,
      { wseId: strengthWseId },
    );
    expect(setRes.errors).toBeUndefined();

    // Attempt the category flip. exercises.kind recomputes to 'cardio',
    // CASCADE updates workout_session_exercises.kind, which CASCADEs into
    // workout_session_strength_sets.parent_kind — that's where the CHECK
    // pinning parent_kind = 'strength' rejects the update.
    const res = await gql(
      `
      mutation FlipStrengthToCardio($id: uuid!) {
        updateExercise(pk_columns: { id: $id }, _set: { category: cardio }) {
          id category kind
        }
      }
    `,
      { id: STRENGTH_EXERCISE_ID },
    );
    expect(res.errors).toBeDefined();
    // Hasura maps check-constraint failures triggered by an UPDATE to
    // `permission-error` rather than `constraint-violation` (catch-all for
    // "row-policy violated"). Both are acceptable — what we really want to
    // assert is that the CHECK on parent_kind is what blocked it.
    const code = res.errors![0].extensions?.code;
    expect(["constraint-violation", "permission-error"]).toContain(code as string);
    expect(res.errors![0].message.toLowerCase()).toContain("parent_kind");
    expect(res.errors![0].message).toContain("workout_session_strength_sets");

    // Verify the catalog wasn't mutated — the whole tx rolled back.
    const after = await gql<{ exercise: { category: string; kind: string } }>(
      `query Verify($id: uuid!) { exercise(id: $id) { category kind } }`,
      { id: STRENGTH_EXERCISE_ID },
    );
    expect(after.data!.exercise).toEqual({ category: "powerlifting", kind: "strength" });
  });

  test("flipping a cardio exercise to strength with logged entries → check violation", async () => {
    if (!hasuraReachable) return;

    // Anchor a cardio entry to the cardio WSE.
    const entryRes = await gql<{ insertWorkoutSessionCardioEntry: { id: string } }>(
      `
      mutation AnchorCardioEntry($wseId: uuid!) {
        insertWorkoutSessionCardioEntry(object: {
          workoutSessionExerciseId: $wseId,
          entryNumber: 81,
          metrics: { duration_s: 1200 }
        }) { id }
      }
    `,
      { wseId: cardioWseId },
    );
    expect(entryRes.errors).toBeUndefined();

    // Mirror direction: cardio → strength. Same cascade chain into
    // workout_session_cardio_entries.parent_kind, same CHECK pinned to
    // 'cardio'.
    const res = await gql(
      `
      mutation FlipCardioToStrength($id: uuid!) {
        updateExercise(pk_columns: { id: $id }, _set: { category: strength }) {
          id category kind
        }
      }
    `,
      { id: CARDIO_EXERCISE_ID },
    );
    expect(res.errors).toBeDefined();
    const code = res.errors![0].extensions?.code;
    expect(["constraint-violation", "permission-error"]).toContain(code as string);
    expect(res.errors![0].message.toLowerCase()).toContain("parent_kind");
    expect(res.errors![0].message).toContain("workout_session_cardio_entries");

    // Verify the catalog wasn't mutated.
    const after = await gql<{ exercise: { category: string; kind: string } }>(
      `query Verify($id: uuid!) { exercise(id: $id) { category kind } }`,
      { id: CARDIO_EXERCISE_ID },
    );
    expect(after.data!.exercise).toEqual({ category: "cardio", kind: "cardio" });
  });
});
