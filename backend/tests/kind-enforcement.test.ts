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

const HASURA_URL = "https://local.hasura.local.nhost.run/v1/graphql";
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
    extensions?: {
      code?: string;
      // Set by Hasura when a DEFERRED constraint trigger raises at COMMIT —
      // the top-level `message` reads "postgres tx error" in that case, but
      // the trigger's RAISE text and SQLSTATE live here.
      internal?: { error?: { message?: string; status_code?: string; hint?: string } };
    };
  }>;
}

// Pull the most-specific error message out of a Hasura GraphQL response:
// for deferred constraint-trigger failures the top-level `message` is the
// generic "postgres tx error" wrapper, and the trigger's RAISE EXCEPTION
// text lives in `extensions.internal.error.message`. Prefer the inner one
// when present so message-based assertions stay readable.
function errorText(err: GraphQLResponse<unknown>["errors"] extends infer E ? E : never): string {
  const e = (err as NonNullable<GraphQLResponse<unknown>["errors"]>)[0];
  return e.extensions?.internal?.error?.message ?? e.message;
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

  // The Nhost GraphQL layer may return only one nested child from this insert
  // shape, so fetch the session exercises explicitly before deriving fixture ids.
  const wseRes = await gql<{
    workoutSessionExercises: Array<{ id: string; kind: string; exerciseId: string }>;
  }>(
    `query FixtureWses($sessionId: uuid!) {
      workoutSessionExercises(where: { workoutSessionId: { _eq: $sessionId } }) { id kind exerciseId }
    }`,
    { sessionId: testSessionId },
  );
  if (wseRes.errors) {
    throw new Error(`fixture WSE lookup failed: ${JSON.stringify(wseRes.errors)}`);
  }
  cardioWseId = wseRes.data!.workoutSessionExercises.find(
    (w) => w.exerciseId === CARDIO_EXERCISE_ID,
  )!.id;
  strengthWseId = wseRes.data!.workoutSessionExercises.find(
    (w) => w.exerciseId === STRENGTH_EXERCISE_ID,
  )!.id;
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

  test("admin direct UPDATE setting WSE.kind to the wrong value is overwritten", async () => {
    if (!hasuraReachable) return;
    // The user-role insert allowlist excludes `kind` (covered by the test in
    // the user-role describe block) and user-role update permissions on WSE
    // are limited to `position`, so a user simply can't reach this path. But
    // admin (and any future role with broader update access) can issue a
    // direct UPDATE of `kind` without touching `exercise_id`. The sync
    // trigger must cover that case too — otherwise the composite FK would
    // still reject the write, but the in-code claim "a wrong kind cannot
    // bypass the composite FK either" would be inaccurate. The trigger fires
    // on UPDATE OF exercise_id, kind, so direct admin UPDATE of `kind` is
    // overwritten back to the parent's value before the FK ever sees it.
    const res = await gql<{ updateWorkoutSessionExercise: { id: string; kind: string } }>(
      `
      mutation AdminLyingKindUpdate($id: uuid!) {
        updateWorkoutSessionExercise(pk_columns: { id: $id }, _set: { kind: "strength" }) {
          id kind
        }
      }
    `,
      { id: cardioWseId },
    );
    expect(res.errors).toBeUndefined();
    expect(res.data!.updateWorkoutSessionExercise.kind).toBe("cardio");
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

  test("UPDATE of metrics to a malformed shape → schema-validation error", async () => {
    if (!hasuraReachable) return;
    // The validate_workout_session_cardio_entry trigger fires on BEFORE INSERT
    // OR UPDATE OF metrics — the INSERT arm is covered above; this locks the
    // UPDATE arm. Insert a valid entry first, then attempt to mutate `metrics`
    // into a shape that drops the required `duration_s` field, then prove the
    // transaction rolled back by re-reading the row.
    const insertRes = await gql<{
      insertWorkoutSessionCardioEntry: { id: string };
    }>(
      `
      mutation GoodCardioEntry($wseId: uuid!) {
        insertWorkoutSessionCardioEntry(object: {
          workoutSessionExerciseId: $wseId,
          entryNumber: 31,
          metrics: { duration_s: 600 }
        }) { id }
      }
    `,
      { wseId: cardioWseId },
    );
    expect(insertRes.errors).toBeUndefined();
    const entryId = insertRes.data!.insertWorkoutSessionCardioEntry.id;

    try {
      const update = await gql(
        `
        mutation BadUpdate($id: uuid!) {
          updateWorkoutSessionCardioEntry(pk_columns: { id: $id }, _set: {
            metrics: { distance_km: 5.0 }
          }) { id }
        }
      `,
        { id: entryId },
      );
      expect(update.errors).toBeDefined();
      expect(update.errors![0].message.toLowerCase()).toContain("schema validation");

      // Re-read: the original metrics survived because the tx rolled back.
      const after = await gql<{
        workoutSessionCardioEntry: { metrics: Record<string, unknown> } | null;
      }>(
        `query Verify($id: uuid!) { workoutSessionCardioEntry(id: $id) { metrics } }`,
        { id: entryId },
      );
      expect(after.data!.workoutSessionCardioEntry).not.toBeNull();
      expect(after.data!.workoutSessionCardioEntry!.metrics).toEqual({ duration_s: 600 });
    } finally {
      await gql(
        `mutation Drop($id: uuid!) { deleteWorkoutSessionCardioEntry(id: $id) { id } }`,
        { id: entryId },
      );
    }
  });

  test("UPDATE of metrics adding an unknown property → schema-validation error", async () => {
    if (!hasuraReachable) return;
    // Symmetric to the INSERT-path "unknown property" test above, on the
    // UPDATE arm of the same trigger. additionalProperties: false in the
    // schema is what rejects this.
    const insertRes = await gql<{
      insertWorkoutSessionCardioEntry: { id: string };
    }>(
      `
      mutation GoodCardioEntry($wseId: uuid!) {
        insertWorkoutSessionCardioEntry(object: {
          workoutSessionExerciseId: $wseId,
          entryNumber: 32,
          metrics: { duration_s: 600 }
        }) { id }
      }
    `,
      { wseId: cardioWseId },
    );
    expect(insertRes.errors).toBeUndefined();
    const entryId = insertRes.data!.insertWorkoutSessionCardioEntry.id;

    try {
      const update = await gql(
        `
        mutation BogusUpdate($id: uuid!) {
          updateWorkoutSessionCardioEntry(pk_columns: { id: $id }, _set: {
            metrics: { duration_s: 600, bogus_field: 1 }
          }) { id }
        }
      `,
        { id: entryId },
      );
      expect(update.errors).toBeDefined();
      expect(update.errors![0].message.toLowerCase()).toContain("schema validation");

      const after = await gql<{
        workoutSessionCardioEntry: { metrics: Record<string, unknown> } | null;
      }>(
        `query Verify($id: uuid!) { workoutSessionCardioEntry(id: $id) { metrics } }`,
        { id: entryId },
      );
      expect(after.data!.workoutSessionCardioEntry!.metrics).toEqual({ duration_s: 600 });
    } finally {
      await gql(
        `mutation Drop($id: uuid!) { deleteWorkoutSessionCardioEntry(id: $id) { id } }`,
        { id: entryId },
      );
    }
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

  test("tightening metrics_schema does not retroactively invalidate existing entries", async () => {
    if (!hasuraReachable) return;
    // The validate_workout_session_cardio_entry trigger fires on writes to the
    // entry table (INSERT, UPDATE OF metrics / workout_session_exercise_id),
    // not on writes to the schema source (exercises_cardio.metrics_schema). So
    // updating the schema is deliberately a "going-forward" change: new writes
    // must match the new shape, old writes stay as-logged. This test locks
    // that contract in by:
    //   1. Creating a private cardio exercise with a permissive schema.
    //   2. Logging an entry that conforms.
    //   3. Tightening the schema so the existing entry would no longer pass.
    //   4. Asserting the historical entry is still readable and unmutated.
    //   5. Asserting a fresh entry with the old (now-invalid) shape is rejected.
    const slug = `test_schema_evolution_${Date.now()}`;
    const created = await gql<{ insertExercise: { id: string } }>(
      `
      mutation MakeExercise($slug: String!, $userId: uuid!) {
        insertExercise(object: {
          slug: $slug, name: "Schema evolution test",
          primaryMuscleGroup: abdominals, instructions: ["x"],
          level: beginner, category: cardio, equipment: body_only,
          isPublic: false, userId: $userId,
          cardio: { data: {
            metricsSchema: {
              type: "object",
              additionalProperties: false,
              properties: { duration_s: { type: "integer", minimum: 0 } },
              required: ["duration_s"]
            }
          } }
        }) { id }
      }
    `,
      { slug, userId: TEST_USER_ID },
    );
    expect(created.errors).toBeUndefined();
    const exerciseId = created.data!.insertExercise.id;

    try {
      const setup = await gql<{
        insertWorkoutSession: {
          id: string;
          workoutSessionExercises: Array<{ id: string }>;
        };
      }>(
        `
        mutation Setup($userId: uuid!, $exId: uuid!) {
          insertWorkoutSession(object: {
            userId: $userId,
            workoutSessionExercises: { data: [{ exerciseId: $exId, position: 0 }] }
          }) {
            id
            workoutSessionExercises { id }
          }
        }
      `,
        { userId: TEST_USER_ID, exId: exerciseId },
      );
      expect(setup.errors).toBeUndefined();
      const sessionId = setup.data!.insertWorkoutSession.id;
      const wseId = setup.data!.insertWorkoutSession.workoutSessionExercises[0].id;

      const inserted = await gql<{
        insertWorkoutSessionCardioEntry: { id: string };
      }>(
        `
        mutation Log($wseId: uuid!) {
          insertWorkoutSessionCardioEntry(object: {
            workoutSessionExerciseId: $wseId,
            entryNumber: 1,
            metrics: { duration_s: 600 }
          }) { id }
        }
      `,
        { wseId },
      );
      expect(inserted.errors).toBeUndefined();
      const entryId = inserted.data!.insertWorkoutSessionCardioEntry.id;

      const tighten = await gql(
        `
        mutation Tighten($exId: uuid!) {
          updateExerciseCardio(pk_columns: { exerciseId: $exId }, _set: {
            metricsSchema: {
              type: "object",
              additionalProperties: false,
              properties: {
                duration_s: { type: "integer", minimum: 0 },
                distance_km: { type: "number", minimum: 0 }
              },
              required: ["duration_s", "distance_km"]
            }
          }) { exerciseId }
        }
      `,
        { exId: exerciseId },
      );
      expect(tighten.errors).toBeUndefined();

      const after = await gql<{
        entry: { id: string; metrics: Record<string, unknown> } | null;
      }>(
        `query Read($id: uuid!) { entry: workoutSessionCardioEntry(id: $id) { id metrics } }`,
        { id: entryId },
      );
      expect(after.errors).toBeUndefined();
      expect(after.data!.entry).not.toBeNull();
      expect(after.data!.entry!.metrics).toEqual({ duration_s: 600 });

      const fresh = await gql(
        `
        mutation FreshOldShape($wseId: uuid!) {
          insertWorkoutSessionCardioEntry(object: {
            workoutSessionExerciseId: $wseId,
            entryNumber: 2,
            metrics: { duration_s: 700 }
          }) { id }
        }
      `,
        { wseId },
      );
      expect(fresh.errors).toBeDefined();
      expect(fresh.errors![0].message.toLowerCase()).toContain("schema validation");

      await gql(`mutation Drop($id: uuid!) { deleteWorkoutSession(id: $id) { id } }`, {
        id: sessionId,
      });
    } finally {
      await gql(`mutation Drop($id: uuid!) { deleteExercise(id: $id) { id } }`, {
        id: exerciseId,
      });
    }
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

  test("foreign user cannot UPDATE another user's private cardio sidecar", async () => {
    if (!hasuraReachable) return;
    // user-role UPDATE on exercises_cardio is gated by
    //   filter: { exercise: { user_id._eq: X-Hasura-User-Id, is_public: false } }
    // — a forged X-Hasura-User-Id that doesn't own the row leaves Hasura with
    // an empty filter match, so the mutation returns affected_rows=0 instead
    // of a permission-error. Either way the row must not change.
    const slug = `test_foreign_update_cardio_${Date.now()}`;
    const created = await gql<{ insertExercise: { id: string } }>(
      `mutation Make($slug: String!, $userId: uuid!) {
         insertExercise(object: {
           slug: $slug, name: "Foreign update cardio",
           primaryMuscleGroup: abdominals, instructions: ["x"],
           level: beginner, category: cardio, equipment: body_only,
           isPublic: false, userId: $userId,
           cardio: { data: {
             metricsSchema: {
               type: "object", additionalProperties: false,
               properties: { duration_s: { type: "integer", minimum: 0 } },
               required: ["duration_s"]
             }
           } }
         }) { id }
       }`,
      { slug, userId: TEST_USER_ID },
    );
    expect(created.errors).toBeUndefined();
    const exerciseId = created.data!.insertExercise.id;

    try {
      const attempt = await gqlAsUser<{
        updateExercisesCardio: { affected_rows: number };
      }>(
        OTHER_USER_ID,
        `mutation ForeignUpdate($id: uuid!) {
           updateExercisesCardio(
             where: { exerciseId: { _eq: $id } },
             _set: { metricsSchema: { type: "object", properties: {} } }
           ) { affected_rows }
         }`,
        { id: exerciseId },
      );
      expect(attempt.errors).toBeUndefined();
      expect(attempt.data!.updateExercisesCardio.affected_rows).toBe(0);

      // Re-fetch as admin and confirm the schema is unchanged.
      const after = await gql<{
        exerciseCardio: { metricsSchema: { required?: string[] } } | null;
      }>(
        `query Verify($id: uuid!) { exerciseCardio(exerciseId: $id) { metricsSchema } }`,
        { id: exerciseId },
      );
      expect(after.data!.exerciseCardio).not.toBeNull();
      expect(after.data!.exerciseCardio!.metricsSchema.required).toEqual(["duration_s"]);
    } finally {
      await gql(`mutation Drop($id: uuid!) { deleteExercise(id: $id) { id } }`, {
        id: exerciseId,
      });
    }
  });

  test("foreign user cannot UPDATE another user's private strength sidecar", async () => {
    if (!hasuraReachable) return;
    // Same shape as the cardio case above, against exercises_strength.
    const slug = `test_foreign_update_strength_${Date.now()}`;
    const created = await gql<{ insertExercise: { id: string } }>(
      `mutation Make($slug: String!, $userId: uuid!) {
         insertExercise(object: {
           slug: $slug, name: "Foreign update strength",
           primaryMuscleGroup: abdominals, instructions: ["x"],
           level: beginner, category: strength, equipment: body_only,
           isPublic: false, userId: $userId,
           strength: { data: { doubleWeight: false } }
         }) { id }
       }`,
      { slug, userId: TEST_USER_ID },
    );
    expect(created.errors).toBeUndefined();
    const exerciseId = created.data!.insertExercise.id;

    try {
      const attempt = await gqlAsUser<{
        updateExercisesStrength: { affected_rows: number };
      }>(
        OTHER_USER_ID,
        `mutation ForeignUpdate($id: uuid!) {
           updateExercisesStrength(
             where: { exerciseId: { _eq: $id } },
             _set: { doubleWeight: true }
           ) { affected_rows }
         }`,
        { id: exerciseId },
      );
      expect(attempt.errors).toBeUndefined();
      expect(attempt.data!.updateExercisesStrength.affected_rows).toBe(0);

      const after = await gql<{
        exerciseStrength: { doubleWeight: boolean } | null;
      }>(
        `query Verify($id: uuid!) { exerciseStrength(exerciseId: $id) { doubleWeight } }`,
        { id: exerciseId },
      );
      expect(after.data!.exerciseStrength).not.toBeNull();
      expect(after.data!.exerciseStrength!.doubleWeight).toBe(false);
    } finally {
      await gql(`mutation Drop($id: uuid!) { deleteExercise(id: $id) { id } }`, {
        id: exerciseId,
      });
    }
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
// The sidecars (exercises_strength, exercises_cardio) repeat the same trick at
// the catalog level: each has a `kind` column DEFAULT'd to its kind with a
// CHECK pinning it, composite-FK'd to exercises(id, kind). So even when an
// exercise has no WSE children, a category flip still cascades into the
// sidecar's `kind` and the CHECK rejects — closing the asymmetry that would
// otherwise let a private exercise end up with the wrong-kind sidecar attached
// (or with both sidecars). The "sidecar-only" describe block below covers it.
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
    // assert is that one of the pinned-kind CHECKs in the cascade chain is
    // what blocked it. PG fires the cascade actions in alphabetical order of
    // FK constraint name, so `exercises_strength` (constraint name starts
    // with "e") fires before `workout_session_strength_sets` ("w"). Accept
    // either failure path — both are correct enforcement; what matters is
    // that the whole transaction rolls back, asserted by the catalog check
    // below.
    const code = res.errors![0].extensions?.code;
    expect(["constraint-violation", "permission-error"]).toContain(code as string);
    expect(res.errors![0].message.toLowerCase()).toMatch(/parent_kind|kind/);
    expect(res.errors![0].message).toMatch(/workout_session_strength_sets|exercises_strength/);

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
    // Same alphabetical-order caveat as the strength→cardio test above:
    // `exercises_cardio` fires before `workout_session_cardio_entries`.
    expect(res.errors![0].message.toLowerCase()).toMatch(/parent_kind|kind/);
    expect(res.errors![0].message).toMatch(/workout_session_cardio_entries|exercises_cardio/);

    // Verify the catalog wasn't mutated.
    const after = await gql<{ exercise: { category: string; kind: string } }>(
      `query Verify($id: uuid!) { exercise(id: $id) { category kind } }`,
      { id: CARDIO_EXERCISE_ID },
    );
    expect(after.data!.exercise).toEqual({ category: "cardio", kind: "cardio" });
  });

  // Alternate path into the same cascade: instead of flipping the parent
  // exercise's category, re-point a workout_session_exercise to a different-
  // kind exercise. The sync trigger fires on UPDATE OF exercise_id, kind and
  // overwrites WSE.kind with the new parent's kind; from there the chain is
  // identical — ON UPDATE CASCADE on the composite FK propagates into the
  // child's parent_kind and the pinned CHECK rejects. Without this test the
  // category-flip block alone wouldn't prove the path via exercise_id is
  // blocked.
  test("re-pointing strength WSE to a cardio exercise with logged sets → check violation", async () => {
    if (!hasuraReachable) return;

    const setRes = await gql<{ insertWorkoutSessionStrengthSet: { id: string } }>(
      `
      mutation AnchorStrengthSet($wseId: uuid!) {
        insertWorkoutSessionStrengthSet(object: {
          workoutSessionExerciseId: $wseId,
          setNumber: 91, reps: 5, weight: "50.00"
        }) { id }
      }
    `,
      { wseId: strengthWseId },
    );
    expect(setRes.errors).toBeUndefined();

    const res = await gql(
      `
      mutation RepointStrengthToCardio($id: uuid!, $cardioEx: uuid!) {
        updateWorkoutSessionExercise(pk_columns: { id: $id }, _set: { exerciseId: $cardioEx }) {
          id exerciseId kind
        }
      }
    `,
      { id: strengthWseId, cardioEx: CARDIO_EXERCISE_ID },
    );
    expect(res.errors).toBeDefined();
    const code = res.errors![0].extensions?.code;
    expect(["constraint-violation", "permission-error"]).toContain(code as string);
    expect(res.errors![0].message.toLowerCase()).toMatch(/parent_kind|kind/);
    expect(res.errors![0].message).toContain("workout_session_strength_sets");

    // Verify the WSE wasn't mutated — the whole tx rolled back.
    const after = await gql<{
      workoutSessionExercise: { exerciseId: string; kind: string };
    }>(
      `query Verify($id: uuid!) { workoutSessionExercise(id: $id) { exerciseId kind } }`,
      { id: strengthWseId },
    );
    expect(after.data!.workoutSessionExercise).toEqual({
      exerciseId: STRENGTH_EXERCISE_ID,
      kind: "strength",
    });
  });

  test("re-pointing cardio WSE to a strength exercise with logged entries → check violation", async () => {
    if (!hasuraReachable) return;

    const entryRes = await gql<{ insertWorkoutSessionCardioEntry: { id: string } }>(
      `
      mutation AnchorCardioEntry($wseId: uuid!) {
        insertWorkoutSessionCardioEntry(object: {
          workoutSessionExerciseId: $wseId,
          entryNumber: 91,
          metrics: { duration_s: 600 }
        }) { id }
      }
    `,
      { wseId: cardioWseId },
    );
    expect(entryRes.errors).toBeUndefined();

    const res = await gql(
      `
      mutation RepointCardioToStrength($id: uuid!, $strengthEx: uuid!) {
        updateWorkoutSessionExercise(pk_columns: { id: $id }, _set: { exerciseId: $strengthEx }) {
          id exerciseId kind
        }
      }
    `,
      { id: cardioWseId, strengthEx: STRENGTH_EXERCISE_ID },
    );
    expect(res.errors).toBeDefined();
    const code = res.errors![0].extensions?.code;
    expect(["constraint-violation", "permission-error"]).toContain(code as string);
    expect(res.errors![0].message.toLowerCase()).toMatch(/parent_kind|kind/);
    expect(res.errors![0].message).toContain("workout_session_cardio_entries");

    const after = await gql<{
      workoutSessionExercise: { exerciseId: string; kind: string };
    }>(
      `query Verify($id: uuid!) { workoutSessionExercise(id: $id) { exerciseId kind } }`,
      { id: cardioWseId },
    );
    expect(after.data!.workoutSessionExercise).toEqual({
      exerciseId: CARDIO_EXERCISE_ID,
      kind: "cardio",
    });
  });
});

// Sidecar-only cascade integrity.
//
// The describe block above always anchors a WSE child before flipping, so the
// cascade chain hits the WSE → strength-set / cardio-entry CHECK first and the
// sidecar guard never gets a turn. The tests here isolate the sidecar guard
// itself: a fresh private exercise with a matching sidecar row and no WSE
// children. Without the sidecar's pinned-kind CHECK + composite FK (added to
// migration 1790000440000), this flip would silently succeed and leave the
// wrong-kind sidecar attached to the exercise.
describe("category-flip cascade integrity (sidecars)", () => {
  test("flipping a strength exercise to cardio with only an exercises_strength sidecar → check violation", async () => {
    if (!hasuraReachable) return;

    const slug = `test_sidecar_strength_flip_${Date.now()}`;
    // Nested insert: exercise + matching sidecar in a single tx so the
    // deferred no-orphan trigger (migration 1790000440000) passes at commit.
    const created = await gql<{ insertExercise: { id: string } }>(
      `
      mutation MakeExercise($slug: String!, $userId: uuid!) {
        insertExercise(object: {
          slug: $slug, name: "Sidecar flip strength test",
          primaryMuscleGroup: abdominals,
          instructions: ["x"],
          level: beginner,
          category: strength,
          equipment: body_only,
          isPublic: false,
          userId: $userId,
          strength: { data: {} }
        }) { id }
      }
    `,
      { slug, userId: TEST_USER_ID },
    );
    expect(created.errors).toBeUndefined();
    const exerciseId = created.data!.insertExercise.id;

    try {
      // Confirm the sidecar landed via the nested insert above.
      const sidecar = await gql<{ exerciseStrength: { kind: string } | null }>(
        `query Check($id: uuid!) { exerciseStrength(exerciseId: $id) { kind } }`,
        { id: exerciseId },
      );
      expect(sidecar.errors).toBeUndefined();
      expect(sidecar.data!.exerciseStrength?.kind).toBe("strength");

      // Flip category. exercises.kind recomputes to 'cardio', CASCADE updates
      // exercises_strength.kind, the pinned CHECK (kind = 'strength') rejects.
      const res = await gql(
        `
        mutation FlipPrivateStrengthToCardio($id: uuid!) {
          updateExercise(pk_columns: { id: $id }, _set: { category: cardio }) { id kind }
        }
      `,
        { id: exerciseId },
      );
      expect(res.errors).toBeDefined();
      const code = res.errors![0].extensions?.code;
      expect(["constraint-violation", "permission-error"]).toContain(code as string);
      expect(res.errors![0].message.toLowerCase()).toContain("kind");
      expect(res.errors![0].message).toContain("exercises_strength");

      // Verify the catalog wasn't mutated — the whole tx rolled back.
      const after = await gql<{ exercise: { category: string; kind: string } }>(
        `query Verify($id: uuid!) { exercise(id: $id) { category kind } }`,
        { id: exerciseId },
      );
      expect(after.data!.exercise).toEqual({ category: "strength", kind: "strength" });
    } finally {
      // Cleanup. Deleting the exercise cascades into the sidecar.
      await gql(`mutation Drop($id: uuid!) { deleteExercise(id: $id) { id } }`, {
        id: exerciseId,
      });
    }
  });

  test("flipping a cardio exercise to strength with only an exercises_cardio sidecar → check violation", async () => {
    if (!hasuraReachable) return;

    const slug = `test_sidecar_cardio_flip_${Date.now()}`;
    // Nested insert with an explicit metrics_schema (the cardio sidecar
    // requires it — there's no default, by design).
    const created = await gql<{ insertExercise: { id: string } }>(
      `
      mutation MakeExercise($slug: String!, $userId: uuid!) {
        insertExercise(object: {
          slug: $slug, name: "Sidecar flip cardio test",
          primaryMuscleGroup: abdominals,
          instructions: ["x"],
          level: beginner,
          category: cardio,
          equipment: body_only,
          isPublic: false,
          userId: $userId,
          cardio: { data: {
            metricsSchema: {
              type: "object",
              additionalProperties: false,
              properties: { duration_s: { type: "integer", minimum: 0 } },
              required: ["duration_s"]
            }
          } }
        }) { id }
      }
    `,
      { slug, userId: TEST_USER_ID },
    );
    expect(created.errors).toBeUndefined();
    const exerciseId = created.data!.insertExercise.id;

    try {
      const sidecar = await gql<{ exerciseCardio: { kind: string } | null }>(
        `query Check($id: uuid!) { exerciseCardio(exerciseId: $id) { kind } }`,
        { id: exerciseId },
      );
      expect(sidecar.errors).toBeUndefined();
      expect(sidecar.data!.exerciseCardio?.kind).toBe("cardio");

      // Mirror direction: cardio → strength. Same cascade into
      // exercises_cardio.kind, same CHECK pinned to 'cardio'.
      const res = await gql(
        `
        mutation FlipPrivateCardioToStrength($id: uuid!) {
          updateExercise(pk_columns: { id: $id }, _set: { category: strength }) { id kind }
        }
      `,
        { id: exerciseId },
      );
      expect(res.errors).toBeDefined();
      const code = res.errors![0].extensions?.code;
      expect(["constraint-violation", "permission-error"]).toContain(code as string);
      expect(res.errors![0].message.toLowerCase()).toContain("kind");
      expect(res.errors![0].message).toContain("exercises_cardio");

      const after = await gql<{ exercise: { category: string; kind: string } }>(
        `query Verify($id: uuid!) { exercise(id: $id) { category kind } }`,
        { id: exerciseId },
      );
      expect(after.data!.exercise).toEqual({ category: "cardio", kind: "cardio" });
    } finally {
      await gql(`mutation Drop($id: uuid!) { deleteExercise(id: $id) { id } }`, {
        id: exerciseId,
      });
    }
  });
});

// Sidecar lifecycle atomicity.
//
// The composite-FK + pinned-kind plumbing prevents an exercise from carrying
// the wrong-kind sidecar, but on its own it doesn't stop two leaky states an
// admin (or a careless seed) could reach by accident:
//
//   1. Exercise inserted without a sidecar. For cardio this immediately
//      breaks logging (22023); for strength it silently elides catalog
//      metadata.
//   2. Sidecar deleted standalone, leaving the parent in state (1).
//
// Migration 1790000440000 closes both with DEFERRABLE INITIALLY DEFERRED
// CONSTRAINT TRIGGERs that fire at transaction commit:
//   - AFTER INSERT on exercises → exercise_must_have_sidecar checks the
//     matching sidecar exists for this exercise's kind.
//   - AFTER DELETE on each sidecar → sidecar_delete_requires_parent_delete
//     checks the parent exercise was also removed in this tx (via CASCADE).
//
// "Deferred" matters: the check fires at commit, so clients can INSERT the
// exercise and the matching sidecar in either order within one transaction
// (Hasura nested mutation, SQL CTE). Mid-transaction states are allowed; we
// only block bad states that would *persist*.
//
// These tests run as admin (via `gql`) because admin is the only role that
// *could* reach the bad states in principle — user-role Hasura permissions
// also block the delete path independently (delete_permissions absent on
// sidecars). The user-role tests in the next describe block prove that
// boundary too.
describe("sidecar lifecycle is atomic", () => {
  test("inserting a strength exercise without a sidecar fails at commit", async () => {
    if (!hasuraReachable) return;
    const slug = `test_no_orphan_strength_${Date.now()}`;
    const res = await gql(
      `
      mutation MakeWithoutSidecar($slug: String!, $userId: uuid!) {
        insertExercise(object: {
          slug: $slug, name: "Strength without sidecar",
          primaryMuscleGroup: abdominals,
          instructions: ["x"],
          level: beginner,
          category: strength,
          equipment: body_only,
          isPublic: false,
          userId: $userId
        }) { id }
      }
    `,
      { slug, userId: TEST_USER_ID },
    );
    expect(res.errors).toBeDefined();
    // Hasura wraps deferred-trigger EXCEPTIONs raised at COMMIT under a
    // generic top-level `message: "postgres tx error"` with `code:
    // "postgres-error"`; the trigger's RAISE text and SQLSTATE land in
    // `extensions.internal.error.{message,status_code}`. `errorText()` reads
    // the inner one so the assertion proves the right invariant fired.
    expect(["constraint-violation", "postgres-error"]).toContain(
      res.errors![0].extensions?.code as string,
    );
    expect(errorText(res.errors).toLowerCase()).toContain("missing its matching sidecar");
    // Transaction rolled back: no exercise persisted either.
    const after = await gql<{ exercises: Array<{ id: string }> }>(
      `query Check($slug: String!) { exercises(where: { slug: { _eq: $slug } }) { id } }`,
      { slug },
    );
    expect(after.data!.exercises).toEqual([]);
  });

  test("inserting a cardio exercise without a sidecar fails at commit", async () => {
    if (!hasuraReachable) return;
    const slug = `test_no_orphan_cardio_${Date.now()}`;
    const res = await gql(
      `
      mutation MakeWithoutSidecar($slug: String!, $userId: uuid!) {
        insertExercise(object: {
          slug: $slug, name: "Cardio without sidecar",
          primaryMuscleGroup: abdominals,
          instructions: ["x"],
          level: beginner,
          category: cardio,
          equipment: body_only,
          isPublic: false,
          userId: $userId
        }) { id }
      }
    `,
      { slug, userId: TEST_USER_ID },
    );
    expect(res.errors).toBeDefined();
    expect(["constraint-violation", "postgres-error"]).toContain(
      res.errors![0].extensions?.code as string,
    );
    expect(errorText(res.errors).toLowerCase()).toContain("missing its matching sidecar");
    const after = await gql<{ exercises: Array<{ id: string }> }>(
      `query Check($slug: String!) { exercises(where: { slug: { _eq: $slug } }) { id } }`,
      { slug },
    );
    expect(after.data!.exercises).toEqual([]);
  });

  test("nested insert of exercise + strength sidecar in one mutation succeeds", async () => {
    if (!hasuraReachable) return;
    const slug = `test_nested_strength_${Date.now()}`;
    const created = await gql<{
      insertExercise: {
        id: string;
        strength: { kind: string; doubleWeight: boolean } | null;
      };
    }>(
      `
      mutation MakeNested($slug: String!, $userId: uuid!) {
        insertExercise(object: {
          slug: $slug, name: "Nested strength",
          primaryMuscleGroup: abdominals,
          instructions: ["x"],
          level: beginner, category: strength, equipment: body_only,
          isPublic: false, userId: $userId,
          strength: { data: { doubleWeight: true } }
        }) {
          id
          strength { kind doubleWeight }
        }
      }
    `,
      { slug, userId: TEST_USER_ID },
    );
    expect(created.errors).toBeUndefined();
    expect(created.data!.insertExercise.strength).not.toBeNull();
    expect(created.data!.insertExercise.strength!.kind).toBe("strength");
    expect(created.data!.insertExercise.strength!.doubleWeight).toBe(true);

    // Cleanup via parent — CASCADE removes the sidecar, deferred trigger sees
    // both gone at commit and passes.
    await gql(`mutation Drop($id: uuid!) { deleteExercise(id: $id) { id } }`, {
      id: created.data!.insertExercise.id,
    });
  });

  test("nested insert of exercise + cardio sidecar in one mutation succeeds", async () => {
    if (!hasuraReachable) return;
    const slug = `test_nested_cardio_${Date.now()}`;
    const created = await gql<{
      insertExercise: {
        id: string;
        cardio: { kind: string; metricsSchema: Record<string, unknown> } | null;
      };
    }>(
      `
      mutation MakeNested($slug: String!, $userId: uuid!) {
        insertExercise(object: {
          slug: $slug, name: "Nested cardio",
          primaryMuscleGroup: abdominals,
          instructions: ["x"],
          level: beginner, category: cardio, equipment: body_only,
          isPublic: false, userId: $userId,
          cardio: { data: {
            metricsSchema: {
              type: "object", additionalProperties: false,
              properties: { duration_s: { type: "integer", minimum: 0 } },
              required: ["duration_s"]
            }
          } }
        }) {
          id
          cardio { kind metricsSchema }
        }
      }
    `,
      { slug, userId: TEST_USER_ID },
    );
    expect(created.errors).toBeUndefined();
    expect(created.data!.insertExercise.cardio).not.toBeNull();
    expect(created.data!.insertExercise.cardio!.kind).toBe("cardio");

    await gql(`mutation Drop($id: uuid!) { deleteExercise(id: $id) { id } }`, {
      id: created.data!.insertExercise.id,
    });
  });

  test("admin cannot DELETE an exercises_strength row standalone (orphans parent)", async () => {
    if (!hasuraReachable) return;
    const slug = `test_forbid_strength_delete_${Date.now()}`;
    const created = await gql<{ insertExercise: { id: string } }>(
      `mutation Make($slug: String!, $userId: uuid!) {
         insertExercise(object: {
           slug: $slug, name: "Forbid strength delete",
           primaryMuscleGroup: abdominals, instructions: ["x"],
           level: beginner, category: strength, equipment: body_only,
           isPublic: false, userId: $userId,
           strength: { data: {} }
         }) { id }
       }`,
      { slug, userId: TEST_USER_ID },
    );
    expect(created.errors).toBeUndefined();
    const exerciseId = created.data!.insertExercise.id;

    try {
      const res = await gql(
        `mutation Drop($id: uuid!) {
           deleteExerciseStrength(exerciseId: $id) { exerciseId }
         }`,
        { id: exerciseId },
      );
      expect(res.errors).toBeDefined();
      expect(["constraint-violation", "postgres-error"]).toContain(
        res.errors![0].extensions?.code as string,
      );
      expect(errorText(res.errors).toLowerCase()).toContain("orphan");

      // Sidecar still present — the rejected delete rolled back at commit.
      const sidecar = await gql<{ exerciseStrength: { exerciseId: string } | null }>(
        `query Check($id: uuid!) { exerciseStrength(exerciseId: $id) { exerciseId } }`,
        { id: exerciseId },
      );
      expect(sidecar.data!.exerciseStrength).not.toBeNull();
    } finally {
      await gql(`mutation Drop($id: uuid!) { deleteExercise(id: $id) { id } }`, {
        id: exerciseId,
      });
    }
  });

  test("admin cannot DELETE an exercises_cardio row standalone (orphans parent)", async () => {
    if (!hasuraReachable) return;
    const slug = `test_forbid_cardio_delete_${Date.now()}`;
    const created = await gql<{ insertExercise: { id: string } }>(
      `mutation Make($slug: String!, $userId: uuid!) {
         insertExercise(object: {
           slug: $slug, name: "Forbid cardio delete",
           primaryMuscleGroup: abdominals, instructions: ["x"],
           level: beginner, category: cardio, equipment: body_only,
           isPublic: false, userId: $userId,
           cardio: { data: {
             metricsSchema: {
               type: "object", additionalProperties: false,
               properties: { duration_s: { type: "integer", minimum: 0 } },
               required: ["duration_s"]
             }
           } }
         }) { id }
       }`,
      { slug, userId: TEST_USER_ID },
    );
    expect(created.errors).toBeUndefined();
    const exerciseId = created.data!.insertExercise.id;

    try {
      const res = await gql(
        `mutation Drop($id: uuid!) {
           deleteExerciseCardio(exerciseId: $id) { exerciseId }
         }`,
        { id: exerciseId },
      );
      expect(res.errors).toBeDefined();
      expect(["constraint-violation", "postgres-error"]).toContain(
        res.errors![0].extensions?.code as string,
      );
      expect(errorText(res.errors).toLowerCase()).toContain("orphan");

      const sidecar = await gql<{ exerciseCardio: { exerciseId: string } | null }>(
        `query Check($id: uuid!) { exerciseCardio(exerciseId: $id) { exerciseId } }`,
        { id: exerciseId },
      );
      expect(sidecar.data!.exerciseCardio).not.toBeNull();
    } finally {
      await gql(`mutation Drop($id: uuid!) { deleteExercise(id: $id) { id } }`, {
        id: exerciseId,
      });
    }
  });

  test("admin cannot nested-insert a wrong-kind sidecar (composite FK rejects)", async () => {
    if (!hasuraReachable) return;
    // A strength exercise with a *cardio* nested sidecar. Hasura inserts the
    // parent first, then tries to insert exercises_cardio with the parent's
    // (id, kind='strength') back-filled. exercises_cardio.kind has DEFAULT
    // 'cardio' + CHECK (kind = 'cardio') — Hasura's back-filled 'strength'
    // value either fails the CHECK directly or the composite FK to
    // exercises(id, kind='cardio') fails. Either way → constraint-violation.
    const slug = `test_cross_kind_nested_${Date.now()}`;
    const res = await gql(
      `mutation BadNested($slug: String!, $userId: uuid!) {
         insertExercise(object: {
           slug: $slug, name: "Cross-kind nested",
           primaryMuscleGroup: abdominals, instructions: ["x"],
           level: beginner, category: strength, equipment: body_only,
           isPublic: false, userId: $userId,
           cardio: { data: {
             metricsSchema: { type: "object", additionalProperties: true, properties: {} }
           } }
         }) { id }
       }`,
      { slug, userId: TEST_USER_ID },
    );
    expect(res.errors).toBeDefined();
    // Hasura back-fills (exercise_id, kind) on the child from the parent.
    // With a strength parent the back-filled kind is 'strength', which
    // exercises_cardio's CHECK (kind = 'cardio') rejects. Hasura maps that
    // CHECK violation to `permission-error` in its error-code system
    // (counter-intuitive but consistent — see also the category-flip tests
    // above, which accept either code).
    expect(["constraint-violation", "permission-error"]).toContain(
      res.errors![0].extensions?.code as string,
    );
    expect(res.errors![0].message.toLowerCase()).toContain("check constraint");
    expect(res.errors![0].message).toContain("exercises_cardio_kind_check");
    // Confirm the tx rolled back — no exercise leaked.
    const after = await gql<{ exercises: Array<{ id: string }> }>(
      `query Check($slug: String!) { exercises(where: { slug: { _eq: $slug } }) { id } }`,
      { slug },
    );
    expect(after.data!.exercises).toEqual([]);
  });

  test("DELETE FROM exercises CASCADEs into the sidecar atomically", async () => {
    if (!hasuraReachable) return;
    const slug = `test_cascade_${Date.now()}`;
    const created = await gql<{ insertExercise: { id: string } }>(
      `mutation Make($slug: String!, $userId: uuid!) {
         insertExercise(object: {
           slug: $slug, name: "Cascade test",
           primaryMuscleGroup: abdominals, instructions: ["x"],
           level: beginner, category: strength, equipment: body_only,
           isPublic: false, userId: $userId,
           strength: { data: {} }
         }) { id }
       }`,
      { slug, userId: TEST_USER_ID },
    );
    expect(created.errors).toBeUndefined();
    const exerciseId = created.data!.insertExercise.id;

    const before = await gql<{ exerciseStrength: { exerciseId: string } | null }>(
      `query Check($id: uuid!) { exerciseStrength(exerciseId: $id) { exerciseId } }`,
      { id: exerciseId },
    );
    expect(before.data!.exerciseStrength).not.toBeNull();

    const deleted = await gql(
      `mutation Drop($id: uuid!) { deleteExercise(id: $id) { id } }`,
      { id: exerciseId },
    );
    expect(deleted.errors).toBeUndefined();

    const after = await gql<{
      exerciseStrength: { exerciseId: string } | null;
      exercise: { id: string } | null;
    }>(
      `query Check($id: uuid!) {
         exerciseStrength(exerciseId: $id) { exerciseId }
         exercise(id: $id) { id }
       }`,
      { id: exerciseId },
    );
    expect(after.data!.exercise).toBeNull();
    expect(after.data!.exerciseStrength).toBeNull();
  });
});

// User-role permission boundary on sidecar deletes.
//
// `delete_permissions` for `user` was removed from public_exercises_strength
// and public_exercises_cardio. These tests prove the path stays closed —
// even though the DB-level forbid_standalone_sidecar_delete trigger above
// would catch it, the Hasura layer rejects first with a `validation-failed`
// (the deleteExerciseStrength / deleteExerciseCardio fields aren't in the
// user-role GraphQL schema at all). If anyone re-adds delete_permissions,
// these tests catch it before the DB trigger has to.
describe("user-role can't reach sidecar delete mutations", () => {
  test("user calling deleteExerciseStrength → validation-failed", async () => {
    if (!hasuraReachable) return;
    const res = await gqlAsUser(
      TEST_USER_ID,
      `mutation { deleteExerciseStrength(exerciseId: "00000000-0000-0000-0000-000000000000") { exerciseId } }`,
    );
    expect(res.errors).toBeDefined();
    expect(res.errors![0].extensions?.code).toBe("validation-failed");
  });

  test("user calling deleteExerciseCardio → validation-failed", async () => {
    if (!hasuraReachable) return;
    const res = await gqlAsUser(
      TEST_USER_ID,
      `mutation { deleteExerciseCardio(exerciseId: "00000000-0000-0000-0000-000000000000") { exerciseId } }`,
    );
    expect(res.errors).toBeDefined();
    expect(res.errors![0].extensions?.code).toBe("validation-failed");
  });
});

// Workout-deletion semantics.
//
// `workout_sessions.workout_id` is `ON DELETE SET NULL` (migration
// 1790000460000), not CASCADE. The original init migration used CASCADE; that
// silently destroyed session history when a workout was deleted, contradicting
// the "template, not a contract" framing of the workout link
// (docs/developers/sessions.md) and the user-facing copy on the workout-delete
// confirmation dialog. SET NULL detaches sessions to ad-hoc on workout
// deletion, preserving their logged sets/entries.
//
// A future maintainer who reverts the FK action — e.g., by recreating the
// init migration or copy-pasting the original FK definition — would silently
// regress this. This test fails fast in that scenario.
describe("workout deletion detaches sessions (not cascade)", () => {
  test("deleting a workout sets its sessions' workout_id to NULL and keeps the rows", async () => {
    if (!hasuraReachable) return;

    // Create a throwaway workout + a session that references it + one strength
    // set so we have something to prove "logged history is preserved."
    const setup = await gql<{
      insertWorkout: { id: string };
    }>(
      `
      mutation MakeWorkout($userId: uuid!, $name: String!) {
        insertWorkout(object: {
          name: $name,
          isPublic: false,
          userId: $userId
        }) { id }
      }
    `,
      { userId: TEST_USER_ID, name: `Test workout for SET NULL ${Date.now()}` },
    );
    expect(setup.errors).toBeUndefined();
    const workoutId = setup.data!.insertWorkout.id;

    const sessionSetup = await gql<{
      insertWorkoutSession: {
        id: string;
        workoutSessionExercises: Array<{ id: string }>;
      };
    }>(
      `
      mutation MakeSession($userId: uuid!, $workoutId: uuid!, $strengthEx: uuid!) {
        insertWorkoutSession(object: {
          userId: $userId,
          workoutId: $workoutId,
          workoutSessionExercises: { data: [{ exerciseId: $strengthEx, position: 0 }] }
        }) {
          id
          workoutSessionExercises { id }
        }
      }
    `,
      { userId: TEST_USER_ID, workoutId, strengthEx: STRENGTH_EXERCISE_ID },
    );
    expect(sessionSetup.errors).toBeUndefined();
    const sessionId = sessionSetup.data!.insertWorkoutSession.id;
    const wseId = sessionSetup.data!.insertWorkoutSession.workoutSessionExercises[0].id;

    const setInsert = await gql<{ insertWorkoutSessionStrengthSet: { id: string } }>(
      `
      mutation MakeSet($wseId: uuid!) {
        insertWorkoutSessionStrengthSet(object: {
          workoutSessionExerciseId: $wseId,
          setNumber: 1, reps: 10, weight: "50.00"
        }) { id }
      }
    `,
      { wseId },
    );
    expect(setInsert.errors).toBeUndefined();
    const setId = setInsert.data!.insertWorkoutSessionStrengthSet.id;

    try {
      // The act: delete the workout.
      const del = await gql(`mutation Drop($id: uuid!) { deleteWorkout(id: $id) { id } }`, {
        id: workoutId,
      });
      expect(del.errors).toBeUndefined();

      // Session row still exists, with workout_id detached to NULL.
      const after = await gql<{
        workoutSession: {
          id: string;
          workoutId: string | null;
          workoutSessionExercises: Array<{
            id: string;
            workoutSessionStrengthSets: Array<{ id: string }>;
          }>;
        } | null;
      }>(
        `query Verify($id: uuid!) {
          workoutSession(id: $id) {
            id
            workoutId
            workoutSessionExercises {
              id
              workoutSessionStrengthSets { id }
            }
          }
        }`,
        { id: sessionId },
      );
      expect(after.errors).toBeUndefined();
      expect(after.data!.workoutSession).not.toBeNull();
      expect(after.data!.workoutSession!.workoutId).toBeNull();
      // The session-exercise and its strength set survived too.
      expect(after.data!.workoutSession!.workoutSessionExercises).toHaveLength(1);
      expect(after.data!.workoutSession!.workoutSessionExercises[0].id).toBe(wseId);
      expect(
        after.data!.workoutSession!.workoutSessionExercises[0].workoutSessionStrengthSets,
      ).toHaveLength(1);
      expect(
        after.data!.workoutSession!.workoutSessionExercises[0].workoutSessionStrengthSets[0].id,
      ).toBe(setId);
    } finally {
      // Cleanup: delete the now-ad-hoc session so we don't leak rows.
      await gql(`mutation Drop($id: uuid!) { deleteWorkoutSession(id: $id) { id } }`, {
        id: sessionId,
      });
    }
  });
});

// User-role permissions on workout_sessions inserts.
//
// Migration 1790000430000 made workout_sessions.workout_id nullable, and
// public_workout_sessions.yaml extends the user-role insert check to allow
// `workout_id IS NULL` (ad-hoc sessions) in addition to "workout is owned-or-
// public." The fixture beforeAll above creates the shared test session as
// *admin*, so the user-role branch of the permission has no coverage by
// default. These tests pin the new permission shape end-to-end: ad-hoc
// inserts succeed, cross-user private workouts are rejected, public workouts
// owned by another user are accepted.
describe("user-role workout_sessions insert (ad-hoc + cross-user)", () => {
  test("user can insert an ad-hoc session with workoutId NULL", async () => {
    if (!hasuraReachable) return;
    const res = await gqlAsUser<{
      insertWorkoutSession: { id: string; workoutId: string | null };
    }>(
      TEST_USER_ID,
      `mutation AdHoc { insertWorkoutSession(object: {}) { id workoutId } }`,
    );
    expect(res.errors).toBeUndefined();
    expect(res.data!.insertWorkoutSession.workoutId).toBeNull();
    // Cleanup admin-side to stay independent of user-role delete permissions.
    await gql(`mutation Drop($id: uuid!) { deleteWorkoutSession(id: $id) { id } }`, {
      id: res.data!.insertWorkoutSession.id,
    });
  });

  test("user cannot insert a session pointing at another user's private workout", async () => {
    if (!hasuraReachable) return;
    // Admin-create a private workout owned by TEST_USER_ID. The
    // _or branch (workout_id is null) is false because workoutId is set;
    // the workout branch's nested check rejects because the foreign user
    // doesn't own the workout and it's not public.
    const setup = await gql<{ insertWorkout: { id: string } }>(
      `mutation MakePrivate($userId: uuid!, $name: String!) {
         insertWorkout(object: { name: $name, isPublic: false, userId: $userId }) { id }
       }`,
      { userId: TEST_USER_ID, name: `Foreign private ${Date.now()}` },
    );
    expect(setup.errors).toBeUndefined();
    const workoutId = setup.data!.insertWorkout.id;

    try {
      const res = await gqlAsUser(
        OTHER_USER_ID,
        `mutation ForeignInsert($workoutId: uuid!) {
           insertWorkoutSession(object: { workoutId: $workoutId }) { id }
         }`,
        { workoutId },
      );
      expect(res.errors).toBeDefined();
      // Hasura maps row-level insert check violations to either
      // `permission-error` (when the pre-insert check rejects) or
      // `constraint-violation` (when the rewritten CHECK fires post-insert).
      // Both are correct "user is blocked" outcomes — same pattern as the
      // public-catalog sidecar test above.
      const code = res.errors![0].extensions?.code;
      expect(["permission-error", "constraint-violation"]).toContain(code as string);
    } finally {
      await gql(`mutation Drop($id: uuid!) { deleteWorkout(id: $id) { id } }`, {
        id: workoutId,
      });
    }
  });

  test("user can insert a session pointing at a public catalog workout", async () => {
    if (!hasuraReachable) return;
    // Validates the second arm of the workout sub-filter (`is_public: true`).
    // The workouts_visibility_check CHECK constraint requires public workouts
    // to have user_id IS NULL — public workouts are catalog rows, not owned
    // by any user — so the fixture creates one with userId omitted.
    const setup = await gql<{ insertWorkout: { id: string } }>(
      `mutation MakePublic($name: String!) {
         insertWorkout(object: { name: $name, isPublic: true }) { id }
       }`,
      { name: `Public catalog ${Date.now()}` },
    );
    expect(setup.errors).toBeUndefined();
    const workoutId = setup.data!.insertWorkout.id;

    try {
      // We use TEST_USER_ID (a real auth.users row) rather than OTHER_USER_ID
      // here because OTHER_USER_ID is a forged UUID that doesn't exist in
      // auth.users, and workout_sessions.user_id has a FK to auth.users. The
      // public-workout permission branch we want to validate is independent
      // of *which* user is acting — what matters is that the workout has
      // is_public=true. (TEST_USER_ID also doesn't own the workout — by the
      // workouts_visibility_check CHECK, public workouts have user_id=NULL,
      // so "not the owner" is automatic.)
      const res = await gqlAsUser<{
        insertWorkoutSession: { id: string; workoutId: string | null };
      }>(
        TEST_USER_ID,
        `mutation PublicInsert($workoutId: uuid!) {
           insertWorkoutSession(object: { workoutId: $workoutId }) { id workoutId }
         }`,
        { workoutId },
      );
      expect(res.errors).toBeUndefined();
      expect(res.data!.insertWorkoutSession.workoutId).toBe(workoutId);
      // Cleanup the session admin-side. The workout itself is dropped in
      // finally below.
      await gql(`mutation Drop($id: uuid!) { deleteWorkoutSession(id: $id) { id } }`, {
        id: res.data!.insertWorkoutSession.id,
      });
    } finally {
      await gql(`mutation Drop($id: uuid!) { deleteWorkout(id: $id) { id } }`, {
        id: workoutId,
      });
    }
  });
});

// The relaxed workout_sessions UPDATE check in public_workout_sessions.yaml is
// the symmetric attack surface to INSERT (covered above). A regression that
// simplifies update_permissions.check to plain user_id=X-Hasura-User-Id would
// let any user re-point an existing session at any other user's private workout
// and the INSERT-only tests would stay green. These tests pin the UPDATE check
// end-to-end.
describe("user-role workout_sessions update (ad-hoc + cross-user)", () => {
  test("user can detach their session to ad-hoc by setting workoutId to null", async () => {
    if (!hasuraReachable) return;
    const setup = await gql<{ insertWorkout: { id: string } }>(
      `mutation MakeOwn($userId: uuid!, $name: String!) {
         insertWorkout(object: { name: $name, isPublic: false, userId: $userId }) { id }
       }`,
      { userId: TEST_USER_ID, name: `Own workout to detach ${Date.now()}` },
    );
    expect(setup.errors).toBeUndefined();
    const workoutId = setup.data!.insertWorkout.id;

    const createSession = await gqlAsUser<{ insertWorkoutSession: { id: string } }>(
      TEST_USER_ID,
      `mutation Make($workoutId: uuid!) {
         insertWorkoutSession(object: { workoutId: $workoutId }) { id }
       }`,
      { workoutId },
    );
    expect(createSession.errors).toBeUndefined();
    const sessionId = createSession.data!.insertWorkoutSession.id;

    try {
      const res = await gqlAsUser<{
        updateWorkoutSession: { id: string; workoutId: string | null };
      }>(
        TEST_USER_ID,
        `mutation Detach($id: uuid!) {
           updateWorkoutSession(pk_columns: { id: $id }, _set: { workoutId: null }) {
             id workoutId
           }
         }`,
        { id: sessionId },
      );
      expect(res.errors).toBeUndefined();
      expect(res.data!.updateWorkoutSession.workoutId).toBeNull();
    } finally {
      await gql(`mutation Drop($id: uuid!) { deleteWorkoutSession(id: $id) { id } }`, {
        id: sessionId,
      });
      await gql(`mutation Drop($id: uuid!) { deleteWorkout(id: $id) { id } }`, {
        id: workoutId,
      });
    }
  });

  test("user can re-point their session to a public catalog workout", async () => {
    if (!hasuraReachable) return;
    const pub = await gql<{ insertWorkout: { id: string } }>(
      `mutation MakePublic($name: String!) {
         insertWorkout(object: { name: $name, isPublic: true }) { id }
       }`,
      { name: `Public catalog for update ${Date.now()}` },
    );
    expect(pub.errors).toBeUndefined();
    const publicWorkoutId = pub.data!.insertWorkout.id;

    const own = await gql<{ insertWorkout: { id: string } }>(
      `mutation MakeOwn($userId: uuid!, $name: String!) {
         insertWorkout(object: { name: $name, isPublic: false, userId: $userId }) { id }
       }`,
      { userId: TEST_USER_ID, name: `Own to repoint ${Date.now()}` },
    );
    expect(own.errors).toBeUndefined();
    const ownWorkoutId = own.data!.insertWorkout.id;

    const session = await gqlAsUser<{ insertWorkoutSession: { id: string } }>(
      TEST_USER_ID,
      `mutation Make($workoutId: uuid!) {
         insertWorkoutSession(object: { workoutId: $workoutId }) { id }
       }`,
      { workoutId: ownWorkoutId },
    );
    expect(session.errors).toBeUndefined();
    const sessionId = session.data!.insertWorkoutSession.id;

    try {
      const res = await gqlAsUser<{
        updateWorkoutSession: { id: string; workoutId: string | null };
      }>(
        TEST_USER_ID,
        `mutation Repoint($id: uuid!, $workoutId: uuid!) {
           updateWorkoutSession(pk_columns: { id: $id }, _set: { workoutId: $workoutId }) {
             id workoutId
           }
         }`,
        { id: sessionId, workoutId: publicWorkoutId },
      );
      expect(res.errors).toBeUndefined();
      expect(res.data!.updateWorkoutSession.workoutId).toBe(publicWorkoutId);
    } finally {
      await gql(`mutation Drop($id: uuid!) { deleteWorkoutSession(id: $id) { id } }`, {
        id: sessionId,
      });
      await gql(`mutation Drop($id: uuid!) { deleteWorkout(id: $id) { id } }`, {
        id: ownWorkoutId,
      });
      await gql(`mutation Drop($id: uuid!) { deleteWorkout(id: $id) { id } }`, {
        id: publicWorkoutId,
      });
    }
  });

  test("user cannot re-point their session at another user's private workout", async () => {
    if (!hasuraReachable) return;
    // The cross-user UPDATE check needs TWO real users: TEST_USER_ID is the
    // attacker (they own a session and try to re-point it), and a second user
    // owns the target private workout. Hasura's admin role lets us insert
    // directly into auth.users to materialise that second user — the same
    // trick isn't needed in the symmetric INSERT-negative test because the
    // INSERT permission check rejects before any user_id FK is touched.
    const foreignUserId = "33333333-3333-4333-8333-333333333333";
    const newUser = await gql<{ insertUser: { id: string } | null }>(
      `mutation MakeForeignUser($id: uuid!, $email: citext!) {
         insertUser(object: {
           id: $id, email: $email, emailVerified: true,
           displayName: "Foreign update test", locale: "en", defaultRole: "user"
         }) { id }
       }`,
      { id: foreignUserId, email: `foreign-update-${Date.now()}@test.local` },
    );
    expect(newUser.errors).toBeUndefined();

    try {
      const setup = await gql<{ insertWorkout: { id: string } }>(
        `mutation MakePrivate($userId: uuid!, $name: String!) {
           insertWorkout(object: { name: $name, isPublic: false, userId: $userId }) { id }
         }`,
        { userId: foreignUserId, name: `Foreign private update ${Date.now()}` },
      );
      expect(setup.errors).toBeUndefined();
      const foreignWorkoutId = setup.data!.insertWorkout.id;

      const session = await gqlAsUser<{ insertWorkoutSession: { id: string } }>(
        TEST_USER_ID,
        `mutation MakeAdHoc { insertWorkoutSession(object: {}) { id } }`,
      );
      expect(session.errors).toBeUndefined();
      const sessionId = session.data!.insertWorkoutSession.id;

      try {
        const res = await gqlAsUser<{
          updateWorkoutSession: { id: string; workoutId: string | null } | null;
        }>(
          TEST_USER_ID,
          `mutation BadRepoint($id: uuid!, $workoutId: uuid!) {
             updateWorkoutSession(pk_columns: { id: $id }, _set: { workoutId: $workoutId }) {
               id workoutId
             }
           }`,
          { id: sessionId, workoutId: foreignWorkoutId },
        );
        expect(res.errors).toBeDefined();
        const code = res.errors![0].extensions?.code;
        expect(["permission-error", "constraint-violation"]).toContain(code as string);

        const after = await gql<{
          workoutSession: { workoutId: string | null } | null;
        }>(
          `query Verify($id: uuid!) { workoutSession(id: $id) { workoutId } }`,
          { id: sessionId },
        );
        expect(after.data!.workoutSession!.workoutId).toBeNull();
      } finally {
        await gql(`mutation Drop($id: uuid!) { deleteWorkoutSession(id: $id) { id } }`, {
          id: sessionId,
        });
        await gql(`mutation Drop($id: uuid!) { deleteWorkout(id: $id) { id } }`, {
          id: foreignWorkoutId,
        });
      }
    } finally {
      await gql(`mutation DropUser($id: uuid!) { deleteUser(id: $id) { id } }`, {
        id: foreignUserId,
      });
    }
  });
});

// The pinned-parent_kind CHECK constraints on workout_session_strength_sets
// and workout_session_cardio_entries are exercised indirectly via the
// composite-FK rejection tests and the category-flip cascade tests above. But
// the most direct path — UPDATE parent_kind to the other value — was not
// covered. Today parent_kind isn't in any user-role write allowlist, so this
// path is only reachable as admin; the test exists to lock the CHECK against
// future regressions (e.g., someone widening the user-role update allowlist
// without realizing the CHECK is the load-bearing line).
describe("parent_kind pinned CHECK rejects direct admin UPDATE", () => {
  test("UPDATE workout_session_strength_set.parentKind = 'cardio' → rejected", async () => {
    if (!hasuraReachable) return;
    const inserted = await gql<{ insertWorkoutSessionStrengthSet: { id: string } }>(
      `mutation MakeSet($wseId: uuid!) {
         insertWorkoutSessionStrengthSet(object: {
           workoutSessionExerciseId: $wseId,
           setNumber: 191, reps: 5, weight: "60.00"
         }) { id }
       }`,
      { wseId: strengthWseId },
    );
    expect(inserted.errors).toBeUndefined();
    const setId = inserted.data!.insertWorkoutSessionStrengthSet.id;

    try {
      const res = await gql(
        `mutation Flip($id: uuid!) {
           updateWorkoutSessionStrengthSet(pk_columns: { id: $id }, _set: { parentKind: "cardio" }) {
             id parentKind
           }
         }`,
        { id: setId },
      );
      expect(res.errors).toBeDefined();
      // Hasura surfaces the pinned-kind CHECK as either constraint-violation
      // or permission-error depending on which table the mutation targets
      // (the wrapper class differs between sibling tables). Both reflect the
      // same underlying CHECK rejection — the load-bearing assertion is the
      // re-read below that proves the row is unchanged.
      const code = res.errors![0].extensions?.code;
      expect(["constraint-violation", "permission-error"]).toContain(code as string);
      expect(res.errors![0].message.toLowerCase()).toContain("parent_kind_check");

      const after = await gql<{
        workoutSessionStrengthSet: { parentKind: string } | null;
      }>(
        `query Verify($id: uuid!) { workoutSessionStrengthSet(id: $id) { parentKind } }`,
        { id: setId },
      );
      expect(after.data!.workoutSessionStrengthSet!.parentKind).toBe("strength");
    } finally {
      await gql(
        `mutation Drop($id: uuid!) { deleteWorkoutSessionStrengthSet(id: $id) { id } }`,
        { id: setId },
      );
    }
  });

  test("UPDATE workout_session_cardio_entry.parentKind = 'strength' → rejected", async () => {
    if (!hasuraReachable) return;
    const inserted = await gql<{ insertWorkoutSessionCardioEntry: { id: string } }>(
      `mutation MakeEntry($wseId: uuid!) {
         insertWorkoutSessionCardioEntry(object: {
           workoutSessionExerciseId: $wseId,
           entryNumber: 191,
           metrics: { duration_s: 300 }
         }) { id }
       }`,
      { wseId: cardioWseId },
    );
    expect(inserted.errors).toBeUndefined();
    const entryId = inserted.data!.insertWorkoutSessionCardioEntry.id;

    try {
      const res = await gql(
        `mutation Flip($id: uuid!) {
           updateWorkoutSessionCardioEntry(pk_columns: { id: $id }, _set: { parentKind: "strength" }) {
             id parentKind
           }
         }`,
        { id: entryId },
      );
      expect(res.errors).toBeDefined();
      const code = res.errors![0].extensions?.code;
      expect(["constraint-violation", "permission-error"]).toContain(code as string);
      expect(res.errors![0].message.toLowerCase()).toContain("parent_kind_check");

      const after = await gql<{
        workoutSessionCardioEntry: { parentKind: string } | null;
      }>(
        `query Verify($id: uuid!) { workoutSessionCardioEntry(id: $id) { parentKind } }`,
        { id: entryId },
      );
      expect(after.data!.workoutSessionCardioEntry!.parentKind).toBe("cardio");
    } finally {
      await gql(
        `mutation Drop($id: uuid!) { deleteWorkoutSessionCardioEntry(id: $id) { id } }`,
        { id: entryId },
      );
    }
  });
});

// Migration 1790000410000 adds CHECK exercises_cardio_schema_valid using
// pg_jsonschema.jsonschema_is_valid on metrics_schema. Hasura lets users
// insert and update metricsSchema on their own private cardio exercises, so
// this CHECK is the integrity gate on a user-writable column. The existing
// suite covers the per-entry trigger (validate_workout_session_cardio_entry)
// but not the schema-itself CHECK; without that coverage, dropping the CHECK
// in a future migration would be invisible.
describe("exercises_cardio_schema_valid CHECK on metrics_schema", () => {
  test("INSERT with malformed metrics_schema (invalid JSON Schema) → rejected", async () => {
    if (!hasuraReachable) return;
    const slug = `bad_schema_insert_${Date.now()}`;
    // Admin-level write — the CHECK fires regardless of role, and using admin
    // keeps the assertion focused on the schema-validity gate instead of the
    // user-role permission shape (which has its own tests).
    const res = await gql(
      `mutation BadSchemaInsert($slug: String!, $userId: uuid!) {
         insertExercise(object: {
           slug: $slug, name: "Bad schema cardio",
           primaryMuscleGroup: abdominals, instructions: ["x"],
           level: beginner, category: cardio, equipment: body_only,
           isPublic: false, userId: $userId,
           cardio: { data: { metricsSchema: { type: "not_a_real_json_schema_type" } } }
         }) { id }
       }`,
      { slug, userId: TEST_USER_ID },
    );
    expect(res.errors).toBeDefined();
    expect(errorText(res.errors!).toLowerCase()).toContain("exercises_cardio_schema_valid");
  });

  test("UPDATE rewriting metricsSchema to a malformed value → rejected", async () => {
    if (!hasuraReachable) return;
    const slug = `bad_schema_update_${Date.now()}`;
    const created = await gql<{ insertExercise: { id: string } }>(
      `mutation MakeExercise($slug: String!, $userId: uuid!) {
         insertExercise(object: {
           slug: $slug, name: "Schema update test",
           primaryMuscleGroup: abdominals, instructions: ["x"],
           level: beginner, category: cardio, equipment: body_only,
           isPublic: false, userId: $userId,
           cardio: { data: {
             metricsSchema: {
               type: "object", additionalProperties: false,
               properties: { duration_s: { type: "integer", minimum: 0 } },
               required: ["duration_s"]
             }
           } }
         }) { id }
       }`,
      { slug, userId: TEST_USER_ID },
    );
    expect(created.errors).toBeUndefined();
    const exerciseId = created.data!.insertExercise.id;

    try {
      const res = await gql(
        `mutation BadUpdate($exId: uuid!) {
           updateExerciseCardio(pk_columns: { exerciseId: $exId }, _set: {
             metricsSchema: { type: "not_a_real_json_schema_type" }
           }) { exerciseId }
         }`,
        { exId: exerciseId },
      );
      expect(res.errors).toBeDefined();
      expect(errorText(res.errors!).toLowerCase()).toContain("exercises_cardio_schema_valid");
    } finally {
      await gql(`mutation Drop($id: uuid!) { deleteExercise(id: $id) { id } }`, {
        id: exerciseId,
      });
    }
  });
});

// Read-side invariant check. The deferred constraint triggers guarantee at
// commit time that every newly-inserted exercise has its sidecar — but if a
// future seed or migration ever slips a partial-commit through (e.g., via
// SET session_replication_role = replica), only a read-side check would
// notice. Two cheap GraphQL queries; runs in milliseconds.
describe("data consistency", () => {
  test("every exercise has its matching sidecar (no orphans in the live DB)", async () => {
    if (!hasuraReachable) return;
    const strengthOrphans = await gql<{
      exercises: Array<{ id: string; slug: string }>;
    }>(`
      query StrengthOrphans {
        exercises(where: { kind: { _eq: "strength" }, _not: { strength: {} } }) {
          id slug
        }
      }
    `);
    expect(strengthOrphans.errors).toBeUndefined();
    expect(strengthOrphans.data!.exercises).toHaveLength(0);

    const cardioOrphans = await gql<{
      exercises: Array<{ id: string; slug: string }>;
    }>(`
      query CardioOrphans {
        exercises(where: { kind: { _eq: "cardio" }, _not: { cardio: {} } }) {
          id slug
        }
      }
    `);
    expect(cardioOrphans.errors).toBeUndefined();
    expect(cardioOrphans.data!.exercises).toHaveLength(0);
  });
});
