import { beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const URL = "https://local.hasura.local.nhost.run/v1/graphql";
const ADMIN_SECRET = "nhost-admin-secret";
const USER = "f26ac88d-4dcd-48e8-a0ae-b4248918bc1c";
const OTHER = "11111111-1111-4111-8111-111111111111";

async function gql(query: string, variables: Record<string, unknown> = {}, user?: string) {
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hasura-admin-secret": ADMIN_SECRET,
      ...(user ? { "x-hasura-role": "user", "x-hasura-user-id": user } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  return res.json() as Promise<{
    data?: Record<string, any>;
    errors?: Array<{ message: string; extensions?: { code?: string } }>;
  }>;
}

let reachable = false;
beforeAll(async () => {
  try {
    const response = await fetch(URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-hasura-admin-secret": ADMIN_SECRET },
      body: JSON.stringify({ query: "{ __typename }" }),
      signal: AbortSignal.timeout(2000),
    });
    reachable = response.ok;
  } catch { reachable = false; }
});

describe("server-calculated muscle sets", () => {
  test("local Hasura must be reachable", () => expect(reachable).toBe(true));

  const guardQuery = `query($from: date, $through: date, $zone: String) {
    muscleSetProgress(args: {from_day: $from, through_day: $through, time_zone: $zone}) { day }
  }`;
  const validRange = { from: "2025-10-01", through: "2026-10-01", zone: "UTC" };

  test("accepts a 365-day difference (366 inclusive dates)", async () => {
    if (!reachable) return;
    const result = await gql(guardQuery, validRange, USER);
    expect(result.errors).toBeUndefined();
    expect(Array.isArray(result.data?.muscleSetProgress)).toBe(true);
  });

  for (const { label, variables } of [
    { label: "366-day difference", variables: { ...validRange, from: "2025-09-30" } },
    { label: "reversed range", variables: { ...validRange, from: "2026-10-02" } },
    { label: "null start day", variables: { ...validRange, from: null } },
    { label: "null end day", variables: { ...validRange, through: null } },
    { label: "POSIX time zone", variables: { ...validRange, zone: "UTC+3" } },
    { label: "unknown time zone", variables: { ...validRange, zone: "Mars/Base" } },
  ]) {
    test(`rejects ${label} with the progress guard error`, async () => {
      if (!reachable) return;
      const result = await gql(guardQuery, variables, USER);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0]).toMatchObject({
        message: "Invalid progress range or time zone",
        extensions: { code: "data-exception" },
      });
      expect(result.data?.muscleSetProgress).toBeUndefined();
    });
  }

  test("rejects an injected session without a user ID", async () => {
    if (!reachable) return;
    // Admin requests still inject hasura_session, but omit x-hasura-user-id.
    // This reaches the SQL guard without user-role header validation masking it.
    const result = await gql(guardQuery, validRange);
    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0]).toMatchObject({
      message: "Invalid progress range or time zone",
      extensions: { code: "data-exception" },
    });
    expect(result.data?.muscleSetProgress).toBeUndefined();
  });

  test("return-shape table stays empty and has no user insert mutation", async () => {
    if (!reachable) return;
    const empty = await gql("{ muscleSetProgressRows { day } }", {}, USER);
    expect(empty.errors).toBeUndefined();
    expect(empty.data?.muscleSetProgressRows).toEqual([]);
    // Verify the real admin root so a misspelling cannot pass as a permission denial.
    const adminSchema = await gql("{ __schema { mutationType { fields { name } } } }");
    expect(adminSchema.errors).toBeUndefined();
    const adminRoots = adminSchema.data?.__schema.mutationType.fields.map((field: { name: string }) => field.name);
    expect(adminRoots).toContain("insert_muscleSetProgressRows");
    const inserted = await gql(`mutation {
      insert_muscleSetProgressRows(objects: []) { affected_rows }
    }`, {}, USER);
    expect(inserted.errors?.[0]?.message).toContain("field 'insert_muscleSetProgressRows' not found");
  });

  test("recent local seed supplies 180 days of strength work with zero-rep sets", async () => {
    if (!reachable) return;
    const fixture = "c1d50000-0000-4000-8000-000000000001";
    const result = await gql(`query($fixture: uuid!) {
      sessions: workoutSessionsAggregate(where: {workoutId: {_eq: $fixture}}) {
        aggregate { count min { startedAt } max { startedAt } }
      }
      exercises: workoutSessionExercisesAggregate(where: {workoutSession: {workoutId: {_eq: $fixture}}}) {
        aggregate { count }
      }
      sets: workoutSessionStrengthSetsAggregate(where: {workoutSessionExercise: {workoutSession: {workoutId: {_eq: $fixture}}}}) {
        aggregate { count }
      }
      zeroReps: workoutSessionStrengthSetsAggregate(where: {reps: {_eq: 0}, workoutSessionExercise: {workoutSession: {workoutId: {_eq: $fixture}}}}) {
        aggregate { count }
      }
    }`, { fixture }, USER);
    expect(result.errors).toBeUndefined();
    expect(result.data?.sessions.aggregate.count).toBe(91);
    expect(result.data?.exercises.aggregate.count).toBe(91 * 5);
    expect(result.data?.sets.aggregate.count).toBe(91 * 21);
    expect(result.data?.zeroReps.aggregate.count).toBe(91);
    const first = Date.parse(result.data!.sessions.aggregate.min.startedAt);
    const last = Date.parse(result.data!.sessions.aggregate.max.startedAt);
    expect((last - first) / 86_400_000).toBe(180);
    expect(new Date(last).toISOString().slice(11)).toBe("12:00:00.000Z");
  });

  test("recent seed credits, zero days, warm-up window and user isolation", async () => {
    if (!reachable) return;
    const fixture = "c1d50000-0000-4000-8000-000000000001";
    const latest = await gql(`query($fixture: uuid!) {
      workoutSessionsAggregate(where: {workoutId: {_eq: $fixture}}) {
        aggregate { max { startedAt } }
      }
    }`, { fixture });
    expect(latest.errors).toBeUndefined();
    const today = latest.data!.workoutSessionsAggregate.aggregate.max.startedAt.slice(0, 10);
    const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    const vars = { from: yesterday, through: today, zone: "UTC" };
    const query = `query($from: date!, $through: date!, $zone: String!) {
      muscleSetProgress(args: {from_day: $from, through_day: $through, time_zone: $zone}) {
        day muscleGroup directSets indirectSets weightedSets
        rollingDirectSets rollingIndirectSets rollingWeightedSets
      }
    }`;
    const own = await gql(query, vars, USER);
    expect(own.errors).toBeUndefined();
    const rows = own.data!.muscleSetProgress as Array<Record<string, string | number>>;
    const row = (day: string, muscle: string) => rows.find(
      (entry) => entry.day === day && entry.muscleGroup === muscle,
    );
    expect(row(today, "side_delts")).toMatchObject({ directSets: 4, indirectSets: 0, rollingDirectSets: 16 });
    expect(row(today, "chest")).toMatchObject({ directSets: 4, indirectSets: 0, rollingDirectSets: 16 });
    expect(row(today, "front_delts")).toMatchObject({ directSets: 4, indirectSets: 4, rollingDirectSets: 16, rollingIndirectSets: 16 });
    expect(Number(row(today, "front_delts")?.weightedSets)).toBe(6);
    expect(Number(row(today, "front_delts")?.rollingWeightedSets)).toBe(24);
    expect(row(today, "rear_delts")).toMatchObject({ directSets: 0, indirectSets: 4 });
    expect(Number(row(today, "rear_delts")?.weightedSets)).toBe(2);
    // Yesterday's seven-day window contains three sessions (-2, -4, -6).
    expect(row(yesterday, "side_delts")).toMatchObject({ directSets: 0, indirectSets: 0, rollingDirectSets: 12 });
    expect((await gql(query, vars, OTHER)).data?.muscleSetProgress).toEqual([]);
  });

  test("public shoulder mappings retain ambiguous shoulders", async () => {
    if (!reachable) return;
    const result = await gql(`query {
      side: exercises(where: {slug: {_eq: "Side_Lateral_Raise"}}) { primaryMuscleGroup }
      rear: exercises(where: {slug: {_eq: "Cable_Rear_Delt_Fly"}}) { primaryMuscleGroup }
      press: exercises(where: {slug: {_eq: "Barbell_Bench_Press_-_Medium_Grip"}}) {
        secondaryMuscleGroups { muscleGroup }
      }
      mixed: exercises(where: {slug: {_eq: "Alternating_Deltoid_Raise"}}) { primaryMuscleGroup }
      mixedLaterals: exercises(where: {slug: {_eq: "Side_Laterals_to_Front_Raise"}}) { primaryMuscleGroup }
    }`, {}, USER);
    expect(result.errors).toBeUndefined();
    expect(result.data?.side[0].primaryMuscleGroup).toBe("side_delts");
    expect(result.data?.rear[0].primaryMuscleGroup).toBe("rear_delts");
    expect(result.data?.press[0].secondaryMuscleGroups.map((row: { muscleGroup: string }) => row.muscleGroup)).toContain("front_delts");
    expect(result.data?.mixed[0].primaryMuscleGroup).toBe("shoulders");
    expect(result.data?.mixedLaterals[0].primaryMuscleGroup).toBe("shoulders");
  });

  test("private dev catalog fixtures retain their legacy shoulder targets", async () => {
    if (!reachable) return;
    const fixtures = [
      { slug: "Landmine_Press", primary: "shoulders", secondary: [] },
      { slug: "Front_Plate_Raise_to_Overhead_Press", primary: "shoulders", secondary: [] },
      { slug: "Wide_Grip_Seated_Cable_Rows", primary: "middle_back", secondary: ["biceps", "lats", "shoulders"] },
    ];
    const result = await gql(`query($slugs: [String!]!) {
      exercises(where: {slug: {_in: $slugs}}) {
        slug isPublic userId primaryMuscleGroup secondaryMuscleGroups { muscleGroup }
      }
    }`, { slugs: fixtures.map(({ slug }) => slug) }, USER);
    expect(result.errors).toBeUndefined();
    expect(result.data?.exercises).toHaveLength(fixtures.length);
    for (const fixture of fixtures) {
      const exercise = result.data!.exercises.find((row: { slug: string }) => row.slug === fixture.slug);
      expect(exercise).toMatchObject({
        isPublic: false, userId: USER, primaryMuscleGroup: fixture.primary,
      });
      expect(exercise.secondaryMuscleGroups.map((row: { muscleGroup: string }) => row.muscleGroup).sort())
        .toEqual(fixture.secondary);
    }
  });

  const reviewedSecondaryTargets = [
    { id: "019e0675-a2a1-77d0-9cee-39cfad6a62e9", slug: "Barbell_Shoulder_Press", primary: "front_delts", secondary: ["chest", "side_delts", "triceps"] },
    { id: "019e0675-a9b4-771c-b3c8-a6219f99df89", slug: "Seated_Dumbbell_Press", primary: "front_delts", secondary: ["side_delts", "triceps"] },
    { id: "019e0675-a597-7724-bd17-40c101d5773f", slug: "Hammer_Curls", primary: "biceps", secondary: ["forearms"] },
    { id: "019e0675-ac8f-76d4-b224-5fba7c7a8b69", slug: "Wide-Grip_Lat_Pulldown", primary: "lats", secondary: ["biceps", "middle_back", "rear_delts"] },
    { id: "019e0675-a934-7a87-8e7b-7c3f41c7af5b", slug: "Romanian_Deadlift", primary: "hamstrings", secondary: ["glutes", "lower_back"] },
    { id: "019e0675-a552-72ed-9b8e-bb9f36750092", slug: "Front_Barbell_Squat", primary: "quadriceps", secondary: ["glutes", "hamstrings"] },
    { id: "019e0675-a2b6-7a74-b5c9-709e056b5c36", slug: "Barbell_Walking_Lunge", primary: "quadriceps", secondary: ["glutes", "hamstrings"] },
    { id: "019e0675-a2e0-7405-a6ef-9c2822bef44d", slug: "Bent_Over_Barbell_Row", primary: "middle_back", secondary: ["biceps", "lats", "lower_back", "rear_delts"] },
    { id: "019e0675-a26c-7db4-8037-cfdc635707a7", slug: "Barbell_Ab_Rollout", primary: "abdominals", secondary: ["lats", "lower_back", "shoulders"] },
  ];

  test("reviewed public secondary targets preserve primary and unrelated muscles", async () => {
    if (!reachable) return;
    const result = await gql(`query($ids: [uuid!]!) {
      exercises(where: {id: {_in: $ids}}) {
        id slug isPublic primaryMuscleGroup secondaryMuscleGroups { muscleGroup }
      }
    }`, { ids: reviewedSecondaryTargets.map(({ id }) => id) }, USER);
    expect(result.errors).toBeUndefined();
    expect(result.data?.exercises).toHaveLength(reviewedSecondaryTargets.length);
    for (const fixture of reviewedSecondaryTargets) {
      const exercise = result.data!.exercises.find((row: { id: string }) => row.id === fixture.id);
      expect(exercise).toMatchObject({ slug: fixture.slug, isPublic: true, primaryMuscleGroup: fixture.primary });
      expect(exercise.secondaryMuscleGroups.map((row: { muscleGroup: string }) => row.muscleGroup).sort())
        .toEqual(fixture.secondary);
    }
  });

  test("reviewed secondary targets change daily and rolling credits without incidental calf credit", async () => {
    if (!reachable) return;
    const sessionId = crypto.randomUUID();
    const query = `query {
      muscleSetProgress(args: {from_day: "2050-04-10", through_day: "2050-04-10", time_zone: "UTC"}) {
        muscleGroup directSets indirectSets weightedSets rollingDirectSets rollingIndirectSets rollingWeightedSets
      }
    }`;
    type CreditRow = Record<string, string | number>;
    const byMuscle = (rows: CreditRow[]) => new Map(rows.map((row) => [row.muscleGroup, row]));
    const before = await gql(query, {}, USER);
    expect(before.errors).toBeUndefined();
    const previous = byMuscle(before.data!.muscleSetProgress);
    try {
      const created = await gql(`mutation($object: workoutSessions_insert_input!) {
        insertWorkoutSession(object: $object) { id }
      }`, { object: {
        id: sessionId, userId: USER, startedAt: "2050-04-10T12:00:00Z",
        workoutSessionExercises: { data: reviewedSecondaryTargets.map(({ id }, position) => ({
          exerciseId: id, position,
          workoutSessionStrengthSets: { data: [{ setNumber: 1, reps: 8, weight: 20 }] },
        })) },
      } });
      expect(created.errors).toBeUndefined();
      const result = await gql(query, {}, USER);
      expect(result.errors).toBeUndefined();
      const current = byMuscle(result.data!.muscleSetProgress);
      for (const [muscle, direct, indirect] of [
        ["front_delts", 2, 0], ["side_delts", 0, 2], ["chest", 0, 1], ["triceps", 0, 2],
        ["biceps", 1, 2], ["forearms", 0, 1], ["lats", 1, 2], ["middle_back", 1, 1],
        ["rear_delts", 0, 2], ["hamstrings", 1, 2], ["glutes", 0, 3], ["lower_back", 0, 3],
        ["quadriceps", 2, 0], ["abdominals", 1, 0], ["shoulders", 0, 1],
      ] as const) {
        const prior = previous.get(muscle);
        const row = current.get(muscle);
        expect(row).toMatchObject({
          directSets: Number(prior?.directSets ?? 0) + direct,
          indirectSets: Number(prior?.indirectSets ?? 0) + indirect,
          rollingDirectSets: Number(prior?.rollingDirectSets ?? 0) + direct,
          rollingIndirectSets: Number(prior?.rollingIndirectSets ?? 0) + indirect,
        });
        expect(Number(row?.weightedSets)).toBe(Number(prior?.weightedSets ?? 0) + direct + indirect * 0.5);
        expect(Number(row?.rollingWeightedSets)).toBe(Number(prior?.rollingWeightedSets ?? 0) + direct + indirect * 0.5);
      }
      expect(current.get("calves")).toEqual(previous.get("calves"));
    } finally {
      const removed = await gql(`mutation($id: uuid!) { deleteWorkoutSession(id: $id) { id } }`, { id: sessionId });
      expect(removed.errors).toBeUndefined();
    }
  });

  test("reviewed secondary migration rolls back, reapplies idempotently, and skips private targets", async () => {
    if (!reachable) return;
    const migration = new globalThis.URL("../nhost/migrations/default/1792997064993_reviewed_secondary_targets/", import.meta.url);
    const up = readFileSync(new globalThis.URL("up.sql", migration), "utf8");
    const down = readFileSync(new globalThis.URL("down.sql", migration), "utf8");
    // Only fixed test-fixture UUIDs enter this SQL; no user input is interpolated.
    const ids = reviewedSecondaryTargets.map(({ id }) => `'${id}'::uuid`).join(", ");
    const snapshot = `SELECT jsonb_agg(jsonb_build_array(e.id, e.primary_muscle_group,
      ARRAY(SELECT sm.muscle_group FROM public.exercise_secondary_muscle_groups sm
            WHERE sm.exercise_id = e.id ORDER BY sm.muscle_group)) ORDER BY e.id)`;
    const sql = `BEGIN;
      DO $migration_test$
      DECLARE before_targets jsonb; after_targets jsonb;
      BEGIN
        ${snapshot} INTO before_targets FROM public.exercises e WHERE e.id IN (${ids});
        ${down}
        IF EXISTS (
          SELECT 1 FROM public.exercise_secondary_muscle_groups sm
          WHERE (sm.exercise_id, sm.muscle_group) IN (
            ('019e0675-a2a1-77d0-9cee-39cfad6a62e9'::uuid, 'side_delts'),
            ('019e0675-a9b4-771c-b3c8-a6219f99df89'::uuid, 'side_delts'),
            ('019e0675-a597-7724-bd17-40c101d5773f'::uuid, 'forearms'),
            ('019e0675-a2e0-7405-a6ef-9c2822bef44d'::uuid, 'lower_back'),
            ('019e0675-a26c-7db4-8037-cfdc635707a7'::uuid, 'lats'),
            ('019e0675-ac8f-76d4-b224-5fba7c7a8b69'::uuid, 'rear_delts')
          )
        ) OR NOT EXISTS (
          SELECT 1 FROM public.exercise_secondary_muscle_groups
          WHERE exercise_id = '019e0675-ac8f-76d4-b224-5fba7c7a8b69'::uuid AND muscle_group = 'shoulders'
        ) OR 3 <> (
          SELECT count(*) FROM public.exercise_secondary_muscle_groups
          WHERE muscle_group = 'calves' AND exercise_id IN (
            '019e0675-a934-7a87-8e7b-7c3f41c7af5b'::uuid,
            '019e0675-a552-72ed-9b8e-bb9f36750092'::uuid,
            '019e0675-a2b6-7a74-b5c9-709e056b5c36'::uuid
          )
        ) THEN RAISE EXCEPTION 'Secondary-target rollback did not restore the catalog baseline'; END IF;
        ${up}
        ${snapshot} INTO after_targets FROM public.exercises e WHERE e.id IN (${ids});
        IF after_targets IS DISTINCT FROM before_targets THEN
          RAISE EXCEPTION 'Secondary-target migration roundtrip did not restore reviewed target rows';
        END IF;
        ${up}
        ${snapshot} INTO after_targets FROM public.exercises e WHERE e.id IN (${ids});
        IF after_targets IS DISTINCT FROM before_targets THEN
          RAISE EXCEPTION 'Secondary-target migration is not idempotent';
        END IF;
        -- Make the same stable IDs private inside this rolled-back transaction.
        -- Both migration directions must leave their associations untouched.
        UPDATE public.exercises SET is_public = false, user_id = '${USER}'::uuid WHERE id IN (${ids});
        ${down}
        ${up}
        ${snapshot} INTO after_targets FROM public.exercises e WHERE e.id IN (${ids});
        IF after_targets IS DISTINCT FROM before_targets THEN
          RAISE EXCEPTION 'Secondary-target migration changed private associations';
        END IF;
      END $migration_test$;
      ROLLBACK;`;
    const response = await fetch("https://local.hasura.local.nhost.run/v2/query", {
      method: "POST",
      headers: { "content-type": "application/json", "x-hasura-admin-secret": ADMIN_SECRET },
      body: JSON.stringify({ type: "run_sql", args: { source: "default", sql, read_only: false } }),
    });
    const result = await response.json() as { result_type?: string; error?: string };
    expect(result.error).toBeUndefined();
    expect(response.ok).toBe(true);
    expect(result.result_type).toBe("CommandOk");
  });

  test("matching public movement variants credit the same delt head", async () => {
    if (!reachable) return;
    const primary = [
      ["Upright_Barbell_Row", "side_delts"],
      ["Dumbbell_Raise", "side_delts"],
      ["Side_Lateral_Raise", "side_delts"],
      ["Power_Partials", "side_delts"],
      ["Standing_Low-Pulley_Deltoid_Raise", "side_delts"],
      ["Machine_Shoulder_Military_Press", "front_delts"],
      ["Kettlebell_Seated_Press", "front_delts"],
      ["Alternating_Kettlebell_Press", "front_delts"],
      ["Kettlebell_Seesaw_Press", "front_delts"],
      ["Front_Plate_Raise", "front_delts"],
      ["Single_Dumbbell_Raise", "front_delts"],
      ["Cable_Rope_Rear-Delt_Rows", "rear_delts"],
    ] as const;
    const secondary = [
      ["Standing_Dumbbell_Upright_Row", "side_delts"],
      ["Upright_Cable_Row", "side_delts"],
      ["Smith_Machine_Upright_Row", "side_delts"],
      ["Upright_Row_-_With_Bands", "side_delts"],
      ["Neck_Press", "front_delts"],
      ["Barbell_Guillotine_Bench_Press", "front_delts"],
      ["Incline_Dumbbell_Press", "front_delts"],
      ["Incline_Dumbbell_Bench_With_Palms_Facing_In", "front_delts"],
      ["Close-Grip_Dumbbell_Press", "front_delts"],
      ["Close-Grip_EZ-Bar_Press", "front_delts"],
      ["Decline_Smith_Press", "front_delts"],
      ["Smith_Machine_Decline_Press", "front_delts"],
      ["Bent_Over_Barbell_Row", "rear_delts"],
      ["Bent_Over_Two-Dumbbell_Row", "rear_delts"],
      ["One-Arm_Dumbbell_Row", "rear_delts"],
      ["Dumbbell_Incline_Row", "rear_delts"],
    ] as const;
    const slugs = [...primary, ...secondary].map(([slug]) => slug);
    const result = await gql(`query($slugs: [String!]!) {
      exercises(where: {slug: {_in: $slugs}}) {
        slug primaryMuscleGroup secondaryMuscleGroups { muscleGroup }
      }
    }`, { slugs }, USER);
    expect(result.errors).toBeUndefined();
    expect(result.data?.exercises).toHaveLength(slugs.length);
    type MappedExercise = {
      slug: string;
      primaryMuscleGroup: string;
      secondaryMuscleGroups: Array<{ muscleGroup: string }>;
    };
    const exercises = new Map<string, MappedExercise>(result.data!.exercises.map(
      (exercise: MappedExercise) => [exercise.slug, exercise],
    ));
    for (const [slug, target] of primary) {
      expect(exercises.get(slug)?.primaryMuscleGroup).toBe(target);
    }
    for (const [slug, target] of secondary) {
      const muscles = exercises.get(slug)?.secondaryMuscleGroups.map((row: { muscleGroup: string }) => row.muscleGroup);
      expect(muscles).toContain(target);
      expect(muscles).not.toContain("shoulders");
    }
  });

  for (const category of ["stretching", "strength", "powerlifting", "plyometrics", "olympic_weightlifting", "strongman"]) {
    test(`${category} ${category === "stretching" ? "earns no" : "retains"} muscle set credit`, async () => {
      if (!reachable) return;
      const sessionId = crypto.randomUUID();
      const exerciseId = crypto.randomUUID();
      const name = `progress-category-${exerciseId}`;
      try {
        const created = await gql(`mutation($session: uuid!, $exercise: uuid!, $name: String!, $user: uuid!, $category: exerciseCategories_enum!) {
          insertWorkoutSession(object: {id: $session, userId: $user, startedAt: "2040-03-10T12:00:00Z",
            workoutSessionExercises: {data: [{position: 0,
              exercise: {data: {id: $exercise, slug: $name, name: $name, userId: $user, isPublic: false,
                category: $category, primaryMuscleGroup: biceps, strength: {data: {}},
                secondaryMuscleGroups: {data: [{muscleGroup: triceps}]}}},
              workoutSessionStrengthSets: {data: [
                {setNumber: 1, reps: 1, weight: 0}, {setNumber: 2, reps: 10, weight: 20},
                {setNumber: 3, reps: 0, weight: 20}
              ]}
            }]}}) { id }
        }`, { session: sessionId, exercise: exerciseId, name, user: USER, category });
        expect(created.errors).toBeUndefined();
        const result = await gql(`query($session: uuid!) {
          sets: workoutSessionStrengthSetsAggregate(where: {workoutSessionExercise: {workoutSessionId: {_eq: $session}}}) {
            aggregate { count }
          }
          muscleSetProgress(args: {from_day: "2040-03-10", through_day: "2040-03-17", time_zone: "UTC"}) {
            day muscleGroup directSets indirectSets weightedSets
            rollingDirectSets rollingIndirectSets rollingWeightedSets
          }
        }`, { session: sessionId }, USER);
        expect(result.errors).toBeUndefined();
        // Even stretching remains loggable; only the report's qualification changes.
        expect(result.data?.sets.aggregate.count).toBe(3);
        const rows = result.data!.muscleSetProgress as Array<Record<string, string | number>>;
        if (category === "stretching") {
          expect(rows).toEqual([]);
        } else {
          expect(rows).toHaveLength(16);
          for (const [index, day] of [10, 11, 12, 13, 14, 15, 16, 17].entries()) {
            for (const muscle of ["biceps", "triceps"]) {
              const row = rows.find((entry) => entry.day === `2040-03-${day}` && entry.muscleGroup === muscle);
              const direct = muscle === "biceps" ? 2 : 0;
              const indirect = muscle === "triceps" ? 2 : 0;
              expect(row).toMatchObject({
                directSets: index === 0 ? direct : 0,
                indirectSets: index === 0 ? indirect : 0,
                rollingDirectSets: index < 7 ? direct : 0,
                rollingIndirectSets: index < 7 ? indirect : 0,
              });
              expect(Number(row?.weightedSets)).toBe(index === 0 ? direct + indirect * 0.5 : 0);
              expect(Number(row?.rollingWeightedSets)).toBe(index < 7 ? direct + indirect * 0.5 : 0);
            }
          }
        }
      } finally {
        const removed = await gql(`mutation($session: uuid!, $exercise: uuid!) {
          deleteWorkoutSession(id: $session) { id }
          deleteExercise(id: $exercise) { id }
        }`, { session: sessionId, exercise: exerciseId });
        expect(removed.errors).toBeUndefined();
      }
    });
  }

  test("counts direct once and secondary half, with a seven-local-day window and user isolation", async () => {
    if (!reachable) return;
    const found = await gql(`query {
      exercises(where: {slug: {_in: ["Side_Lateral_Raise", "Barbell_Bench_Press_-_Medium_Grip", "Clean_and_Press"]}}) {
        id slug
      }
    }`);
    expect(found.errors).toBeUndefined();
    const ids = Object.fromEntries(found.data!.exercises.map((e: {id: string; slug: string}) => [e.slug, e.id]));
    const query = `query($from: date!, $through: date!, $zone: String!) {
      muscleSetProgress(args: {from_day: $from, through_day: $through, time_zone: $zone}) {
        day muscleGroup directSets indirectSets weightedSets rollingDirectSets
        rollingIndirectSets rollingWeightedSets
      }
    }`;
    // 03:30Z is still July 7 in New York. The next local day has zero new sets.
    const vars = { from: "2026-07-07", through: "2026-07-14", zone: "America/New_York" };
    const foreignBefore = await gql(query, vars, USER);
    expect(foreignBefore.errors).toBeUndefined();
    const created = await gql(`mutation($user: uuid!, $side: uuid!, $press: uuid!, $mixed: uuid!) {
      insertWorkoutSession(object: {userId: $user, startedAt: "2026-07-08T03:30:00Z",
        workoutSessionExercises: {data: [
          {exerciseId: $side, position: 0}, {exerciseId: $press, position: 1},
          {exerciseId: $mixed, position: 2}
        ]}}) { id workoutSessionExercises { id exerciseId } }
    }`, { user: OTHER, side: ids.Side_Lateral_Raise, press: ids["Barbell_Bench_Press_-_Medium_Grip"], mixed: ids.Clean_and_Press });
    expect(created.errors).toBeUndefined();
    const sessionId = created.data!.insertWorkoutSession.id;
    try {
      // Read children independently; Hasura can return an incomplete nested insert response.
      const children = await gql(`query($id: uuid!) {
        workoutSessionExercises(where: {workoutSessionId: {_eq: $id}}) { id exerciseId }
      }`, { id: sessionId });
      const childIds = Object.fromEntries(children.data!.workoutSessionExercises.map(
        (e: {id: string; exerciseId: string}) => [e.exerciseId, e.id],
      ));
      const sets = await gql(`mutation($side: uuid!, $press: uuid!, $mixed: uuid!) {
        insertWorkoutSessionStrengthSets(objects: [
          {workoutSessionExerciseId: $side, setNumber: 1, reps: 12, weight: 0},
          {workoutSessionExerciseId: $press, setNumber: 1, reps: 8, weight: 50},
          {workoutSessionExerciseId: $press, setNumber: 2, reps: 0, weight: 50},
          {workoutSessionExerciseId: $mixed, setNumber: 1, reps: 1, weight: 20}
        ]) { affected_rows }
      }`, { side: childIds[ids.Side_Lateral_Raise], press: childIds[ids["Barbell_Bench_Press_-_Medium_Grip"]], mixed: childIds[ids.Clean_and_Press] });
      expect(sets.errors).toBeUndefined();
      const own = await gql(query, vars, OTHER);
      expect(own.errors).toBeUndefined();
      const side = own.data!.muscleSetProgress.filter((r: {muscleGroup: string}) => r.muscleGroup === "side_delts");
      expect(side[0]).toMatchObject({ day: "2026-07-07", directSets: 1, indirectSets: 0, rollingDirectSets: 1 });
      expect(Number(side[0].weightedSets)).toBe(1);
      expect(Number(side[6].rollingWeightedSets)).toBe(1);
      expect(Number(side[7].rollingWeightedSets)).toBe(0);
      const front = own.data!.muscleSetProgress.find((r: {muscleGroup: string}) => r.muscleGroup === "front_delts");
      expect(front).toMatchObject({ day: "2026-07-07", directSets: 0, indirectSets: 1 });
      expect(Number(front.weightedSets)).toBe(0.5);
      const unspecified = own.data!.muscleSetProgress.find((r: {muscleGroup: string}) => r.muscleGroup === "shoulders");
      // The original catalog lists Clean and Press as both primary and secondary shoulders.
      expect(unspecified).toMatchObject({ day: "2026-07-07", directSets: 1, indirectSets: 0 });
      const foreign = await gql(query, vars, USER);
      expect(foreign.errors).toBeUndefined();
      expect(foreign.data!.muscleSetProgress).toEqual(foreignBefore.data!.muscleSetProgress);
    } finally {
      const removed = await gql(`mutation($id: uuid!) { deleteWorkoutSession(id: $id) { id } }`, { id: sessionId });
      expect(removed.errors).toBeUndefined();
    }
  });
});
