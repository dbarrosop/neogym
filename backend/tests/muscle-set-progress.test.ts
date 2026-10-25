import { beforeAll, describe, expect, test } from "bun:test";

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
