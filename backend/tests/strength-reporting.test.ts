import { beforeAll, describe, expect, test } from "bun:test";

const URL = "https://local.hasura.local.nhost.run/v1/graphql";
const PROXY_URL = "https://local.graphql.local.nhost.run/v1";
const ADMIN_SECRET = "nhost-admin-secret";
const USER = "f26ac88d-4dcd-48e8-a0ae-b4248918bc1c";
const OTHER = "11111111-1111-4111-8111-111111111111";
const SAMPLE_WORKOUT = "c1d50000-0000-4000-8000-000000000001";

async function gql(query: string, variables: Record<string, unknown> = {}, roleUser?: string, endpoint = URL) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-hasura-admin-secret": ADMIN_SECRET,
      ...(roleUser ? { "x-hasura-role": "user", "x-hasura-user-id": roleUser } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  return response.json() as Promise<{
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

const historyQuery = `query($workout: uuid!, $exercise: String!, $from: timestamptz!, $before: timestamptz!) {
  workouts(where: {id: {_eq: $workout}}) {
    strengthHistory(args: {from_at: $from, before_at: $before}) {
      sessionId startedAt loggedSets completedSets reps volume workoutSession { id }
    }
  }
  exercises(where: {slug: {_eq: $exercise}}) {
    strengthHistory(args: {from_at: $from, before_at: $before}) {
      sessionId loggedSets completedSets reps volume estimatedOneRepMax
    }
  }
}`;

describe("shared strength reporting", () => {
  test("local Hasura and seeds are reachable", () => expect(reachable).toBe(true));

  test("return-shape tables stay empty", async () => {
    if (!reachable) return;
    const empty = await gql(`query {
      workoutStrengthHistoryRows { sessionId }
      exerciseStrengthHistoryRows { sessionId }
    }`, {}, USER);
    expect(empty.errors).toBeUndefined();
    expect(empty.data?.workoutStrengthHistoryRows).toEqual([]);
    expect(empty.data?.exerciseStrengthHistoryRows).toEqual([]);
  });

  for (const shape of [
    {
      table: "workout_strength_history_rows",
      insertRoot: "insert_workoutStrengthHistoryRows",
      targetColumn: "workoutId",
      targetId: SAMPLE_WORKOUT,
    },
    {
      table: "exercise_strength_history_rows",
      insertRoot: "insert_exerciseStrengthHistoryRows",
      targetColumn: "exerciseId",
      targetId: "019e0675-a26c-7b80-9fda-9075c6c51b8b",
    },
  ]) {
    test(`${shape.table} rejects user inserts and admin storage`, async () => {
      if (!reachable) return;
      // Confirm the real admin root before treating its absence for users as a permission boundary.
      const schema = await gql(`query { __schema { mutationType { fields { name } } } }`);
      expect(schema.errors).toBeUndefined();
      const adminRoots = schema.data!.__schema.mutationType.fields.map((field: { name: string }) => field.name);
      expect(adminRoots).toContain(shape.insertRoot);
      const mutation = `mutation($user: uuid!, $target: uuid!, $session: uuid!) {
        ${shape.insertRoot}(objects: [{
          userId: $user, ${shape.targetColumn}: $target, sessionId: $session,
          startedAt: "2026-10-01T00:00:00Z", loggedSets: 0, completedSets: 0,
          reps: 0, volume: 0
        }]) { affected_rows }
      }`;
      const variables = {
        user: USER,
        target: shape.targetId,
        session: "00000000-0000-4000-8000-000000000001",
      };
      const userInsert = await gql(mutation, variables, USER);
      expect(userInsert.errors?.[0]?.extensions?.code).toBe("validation-failed");
      expect(userInsert.errors?.[0]?.message).toContain(`field '${shape.insertRoot}' not found`);
      // Admin has a write root, but an actual insert must still hit the database no-storage CHECK.
      const adminInsert = await gql(mutation, variables);
      expect(adminInsert.errors?.[0]?.extensions?.code).toBe("permission-error");
      expect(adminInsert.errors?.[0]?.message).toContain("Check constraint violation");
      expect(adminInsert.errors?.[0]?.message).toContain(`"${shape.table}_no_storage"`);
    });
  }

  test("seeded workout and exercise histories agree on sets, reps, volume and Epley", async () => {
    if (!reachable) return;
    const latest = await gql(`query($id: uuid!) {
      workoutSessionsAggregate(where: {workoutId: {_eq: $id}}) { aggregate { max { startedAt } } }
    }`, { id: SAMPLE_WORKOUT }, USER);
    expect(latest.errors).toBeUndefined();
    const day = latest.data!.workoutSessionsAggregate.aggregate.max.startedAt.slice(0, 10);
    const from = new Date(Date.parse(`${day}T00:00:00Z`) - 3 * 86_400_000).toISOString();
    const before = new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString();
    const vars = { workout: SAMPLE_WORKOUT, exercise: "Barbell_Bench_Press_-_Medium_Grip", from, before };
    const owner = await gql(historyQuery, vars, USER);
    expect(owner.errors).toBeUndefined();
    const sessions = owner.data!.workouts[0].strengthHistory;
    const exercise = owner.data!.exercises[0].strengthHistory;
    expect(sessions).toHaveLength(2);
    expect(exercise).toHaveLength(2);
    for (const row of sessions) {
      expect(row).toMatchObject({ loggedSets: 21, completedSets: 20, reps: 190 });
      expect(Number(row.volume)).toBe(6840);
      expect(row.workoutSession.id).toBe(row.sessionId);
    }
    for (const row of exercise) {
      expect(row).toMatchObject({ loggedSets: 5, completedSets: 4, reps: 38 });
      expect(Number(row.volume)).toBe(1140);
      expect(Number(row.estimatedOneRepMax)).toBe(41);
    }
    const other = await gql(historyQuery, vars, OTHER);
    expect(other.errors).toBeUndefined();
    expect(other.data!.workouts).toEqual([]); // private workout
    expect(other.data!.exercises[0].strengthHistory).toEqual([]); // public exercise, private history
  });

  test("root reports work through Constellation, honor IDs and reject cross-user access", async () => {
    if (!reachable) return;
    const latest = await gql(`query($id: uuid!) {
      workoutSessionsAggregate(where: {workoutId: {_eq: $id}}) { aggregate { max { startedAt } } }
    }`, { id: SAMPLE_WORKOUT }, USER);
    expect(latest.errors).toBeUndefined();
    const day = latest.data!.workoutSessionsAggregate.aggregate.max.startedAt.slice(0, 10);
    // The seed advances on reset; its last two sessions are always two UTC days apart.
    const from = new Date(Date.parse(`${day}T00:00:00Z`) - 2 * 86_400_000).toISOString().slice(0, 10);
    const vars = {
      workout: SAMPLE_WORKOUT,
      exercise: "019e0675-a26c-7b80-9fda-9075c6c51b8b",
      from,
      through: day,
      zone: "UTC",
    };
    const query = `query($workout: uuid!, $exercise: uuid!, $from: date!, $through: date!, $zone: String!) {
      workoutStrengthReport(args: {workout_id: $workout, from_day: $from, through_day: $through, time_zone: $zone}) {
        sessionId loggedSets completedSets reps volume workoutSession { id }
      }
      exerciseStrengthReport(args: {exercise_id: $exercise, from_day: $from, through_day: $through, time_zone: $zone}) {
        exerciseId sessionId loggedSets completedSets reps volume estimatedOneRepMax
      }
    }`;
    const owner = await gql(query, vars, USER, PROXY_URL);
    expect(owner.errors).toBeUndefined();
    expect(owner.data!.workoutStrengthReport).toHaveLength(2);
    expect(owner.data!.exerciseStrengthReport).toHaveLength(2);
    for (const row of owner.data!.exerciseStrengthReport) {
      expect(row.exerciseId).toBe(vars.exercise);
      expect(row).toMatchObject({ loggedSets: 5, completedSets: 4, reps: 38 });
      expect(Number(row.volume)).toBe(1140);
      expect(Number(row.estimatedOneRepMax)).toBe(41);
    }
    const wrong = await gql(query, {
      ...vars, workout: "00000000-0000-4000-8000-000000000001",
      exercise: "00000000-0000-4000-8000-000000000002",
    }, USER, PROXY_URL);
    expect(wrong.errors).toBeUndefined();
    expect(wrong.data!.workoutStrengthReport).toEqual([]);
    expect(wrong.data!.exerciseStrengthReport).toEqual([]);
    const foreign = await gql(query, vars, OTHER, PROXY_URL);
    expect(foreign.errors).toBeUndefined();
    expect(foreign.data!.workoutStrengthReport).toEqual([]);
    expect(foreign.data!.exerciseStrengthReport).toEqual([]);
    const badZone = await gql(query, { ...vars, zone: "Not/A_Zone" }, USER, PROXY_URL);
    expect((badZone.errors?.length ?? 0) > 0).toBe(true);
  });

  test("all-exercise Progress reuses report totals through Hasura and Constellation without leaking owners", async () => {
    if (!reachable) return;
    const latest = await gql(`query($id: uuid!) {
      workoutSessionsAggregate(where: {workoutId: {_eq: $id}}) { aggregate { max { startedAt } } }
    }`, { id: SAMPLE_WORKOUT }, USER);
    expect(latest.errors).toBeUndefined();
    const through = latest.data!.workoutSessionsAggregate.aggregate.max.startedAt.slice(0, 10);
    const from = new Date(Date.parse(`${through}T00:00:00Z`) - 2 * 86_400_000).toISOString().slice(0, 10);
    const query = `query($from: date!, $through: date!, $workout: uuid!) {
      strengthProgress(args: {from_day: $from, through_day: $through, time_zone: "UTC"},
        where: {workoutId: {_eq: $workout}}) {
        sessionId exerciseId loggedSets completedSets reps volume estimatedOneRepMax exercise { name }
      }
    }`;
    for (const endpoint of [URL, PROXY_URL]) {
      const owner = await gql(query, { from, through, workout: SAMPLE_WORKOUT }, USER, endpoint);
      expect(owner.errors).toBeUndefined();
      const rows = owner.data!.strengthProgress;
      expect(rows).toHaveLength(10);
      expect(rows.reduce((sum: number, row: {volume: number}) => sum + Number(row.volume), 0)).toBe(13680);
      const bench = rows.filter((row: {exerciseId: string}) => row.exerciseId === "019e0675-a26c-7b80-9fda-9075c6c51b8b");
      expect(bench).toHaveLength(2);
      expect(bench[0].exercise.name).toBe("Barbell Bench Press - Medium Grip");
      expect(Number(bench[0].estimatedOneRepMax)).toBe(41);
      const other = await gql(query, { from, through, workout: SAMPLE_WORKOUT }, OTHER, endpoint);
      expect(other.errors).toBeUndefined();
      expect(other.data!.strengthProgress).toEqual([]);
    }
    // Bypass Hasura's return-row filter to prove the SQL owner guard independently.
    const sql = `SELECT count(*) FROM public.strength_progress('${from}', '${through}', 'UTC',
      '{"x-hasura-user-id":"${OTHER}"}'::json) WHERE user_id <> '${OTHER}'::uuid`;
    const response = await fetch("https://local.hasura.local.nhost.run/v2/query", {
      method: "POST", headers: {"content-type": "application/json", "x-hasura-admin-secret": ADMIN_SECRET},
      body: JSON.stringify({type: "run_sql", args: {source: "default", sql, read_only: true}}),
    });
    expect(response.ok).toBe(true);
    const result = await response.json() as { result: string[][] };
    expect(result.result[1][0]).toBe("0");
  });

  test("all-exercise Progress validates date bounds and exposes neither owner input nor owner output", async () => {
    if (!reachable) return;
    const query = `query($from: date, $through: date, $zone: String) {
      strengthProgress(args: {from_day: $from, through_day: $through, time_zone: $zone}) { sessionId }
    }`;
    const valid = await gql(query, {from: "2025-01-01", through: "2026-01-01", zone: "UTC"}, USER);
    expect(valid.errors).toBeUndefined(); // The full 366-date boundary is valid.
    for (const variables of [
      {from: null, through: "2026-10-01", zone: "UTC"},
      {from: "2026-10-01", through: null, zone: "UTC"},
      {from: "2026-10-02", through: "2026-10-01", zone: "UTC"},
      {from: "2025-01-01", through: "2026-01-02", zone: "UTC"},
      {from: "2026-10-01", through: "2026-10-01", zone: "Not/A_Zone"},
      {from: "2026-10-01", through: "2026-10-01", zone: null},
    ]) {
      const invalid = await gql(query, variables, USER);
      expect((invalid.errors?.length ?? 0) > 0).toBe(true);
    }
    const schema = await gql(`query {
      args: __type(name: "strengthProgress_args") { inputFields { name } }
      rows: __type(name: "exerciseStrengthHistoryRows") { fields { name } }
    }`, {}, USER);
    expect(schema.errors).toBeUndefined();
    expect(schema.data!.args.inputFields.map((field: {name: string}) => field.name).sort())
      .toEqual(["from_day", "through_day", "time_zone"]);
    expect(schema.data!.rows.fields.map((field: {name: string}) => field.name)).not.toContain("userId");
  });

  test("measured single reps, per-side volume, empty sessions and edits recompute on read", async () => {
    if (!reachable) return;
    const from = "2026-12-12T00:00:00Z";
    const before = "2026-12-14T00:00:00Z";
    const exercise = await gql(`mutation($slug: String!, $user: uuid!) {
      insertExercise(object: {slug: $slug, name: "Report fixture", primaryMuscleGroup: abdominals,
        instructions: ["test"], level: beginner, category: strength, equipment: body_only,
        isPublic: false, userId: $user, strength: {data: {doubleWeight: true}}}) { id }
    }`, { slug: `report_fixture_${crypto.randomUUID()}`, user: OTHER });
    expect(exercise.errors).toBeUndefined();
    const exerciseId = exercise.data!.insertExercise.id;
    let workoutId: string | undefined;
    let sessionId: string | undefined;
    let emptySessionId: string | undefined;
    try {
      const workout = await gql(`mutation {
        insertWorkout(object: {name: "Report fixture", isPublic: true}) { id }
      }`);
      expect(workout.errors).toBeUndefined();
      workoutId = workout.data!.insertWorkout.id;
      const session = await gql(`mutation($workout: uuid!, $user: uuid!, $exercise: uuid!) {
        insertWorkoutSession(object: {workoutId: $workout, userId: $user, startedAt: "2026-12-12T12:00:00Z",
          workoutSessionExercises: {data: [{exerciseId: $exercise, position: 0}]}}) { id }
      }`, { workout: workoutId, user: OTHER, exercise: exerciseId });
      expect(session.errors).toBeUndefined();
      sessionId = session.data!.insertWorkoutSession.id;
      const children = await gql(`query($id: uuid!) {
        workoutSessionExercises(where: {workoutSessionId: {_eq: $id}}) { id }
      }`, { id: sessionId });
      expect(children.errors).toBeUndefined();
      const child = children.data!.workoutSessionExercises[0].id;
      const sets = await gql(`mutation($child: uuid!) {
        insertWorkoutSessionStrengthSets(objects: [
          {workoutSessionExerciseId: $child, setNumber: 1, reps: 1, weight: 60},
          {workoutSessionExerciseId: $child, setNumber: 2, reps: 5, weight: 50},
          {workoutSessionExerciseId: $child, setNumber: 3, reps: 0, weight: 100},
          {workoutSessionExerciseId: $child, setNumber: 4, reps: 10, weight: 0}
        ]) { affected_rows }
      }`, { child });
      expect(sets.errors).toBeUndefined();
      const empty = await gql(`mutation($workout: uuid!, $user: uuid!) {
        insertWorkoutSession(object: {workoutId: $workout, userId: $user,
          startedAt: "2026-12-13T03:30:00Z"}) { id }
      }`, { workout: workoutId, user: OTHER });
      expect(empty.errors).toBeUndefined();
      emptySessionId = empty.data!.insertWorkoutSession.id;
      const query = `query($workout: uuid!, $exercise: uuid!, $from: timestamptz!, $before: timestamptz!) {
        workout(id: $workout) { strengthHistory(args: {from_at: $from, before_at: $before}) {
          sessionId loggedSets completedSets reps volume
        } }
        exercise(id: $exercise) { strengthHistory(args: {from_at: $from, before_at: $before}) {
          sessionId workoutId loggedSets completedSets reps volume estimatedOneRepMax
        } }
      }`;
      const vars = { workout: workoutId, exercise: exerciseId, from, before };
      const first = await gql(query, vars, OTHER);
      expect(first.errors).toBeUndefined();
      expect(first.data!.workout.strengthHistory).toHaveLength(2);
      expect(first.data!.workout.strengthHistory.find((row: {sessionId: string}) => row.sessionId === emptySessionId))
        .toMatchObject({ loggedSets: 0, completedSets: 0, reps: 0, volume: 0 });
      const rootQuery = `query($workout: uuid!, $from: date!, $through: date!, $zone: String!) {
        workoutStrengthReport(args: {workout_id: $workout, from_day: $from, through_day: $through, time_zone: $zone}) {
          sessionId loggedSets
        }
      }`;
      const rootVars = { workout: workoutId, from: "2026-12-12", through: "2026-12-12", zone: "America/New_York" };
      const localDay = await gql(rootQuery, rootVars, OTHER, PROXY_URL);
      expect(localDay.errors).toBeUndefined();
      expect(localDay.data!.workoutStrengthReport).toHaveLength(2); // 03:30Z is still Dec 12 in New York
      const utcDay = await gql(rootQuery, { ...rootVars, zone: "UTC" }, OTHER, PROXY_URL);
      expect(utcDay.errors).toBeUndefined();
      expect(utcDay.data!.workoutStrengthReport).toHaveLength(1);
      const foreignRoot = await gql(rootQuery, rootVars, USER, PROXY_URL);
      expect(foreignRoot.errors).toBeUndefined();
      expect(foreignRoot.data!.workoutStrengthReport).toEqual([]); // public workout, private sessions
      const progressQuery = `query($exercise: uuid!, $through: date!, $zone: String!) {
        strengthProgress(args: {from_day: "2026-12-12", through_day: $through, time_zone: $zone},
          where: {exerciseId: {_eq: $exercise}}) {
          sessionId workoutId loggedSets completedSets reps volume estimatedOneRepMax exercise { name }
        }
      }`;
      const progressVars = { exercise: exerciseId, through: "2026-12-13", zone: "UTC" };
      const progress = await gql(progressQuery, progressVars, OTHER, PROXY_URL);
      expect(progress.errors).toBeUndefined();
      expect(progress.data!.strengthProgress).toHaveLength(1); // No sets means no old-dashboard point.
      expect(progress.data!.strengthProgress[0]).toMatchObject({ loggedSets: 4, completedSets: 3, reps: 16 });
      expect(Number(progress.data!.strengthProgress[0].volume)).toBe(620);
      expect(Number(progress.data!.strengthProgress[0].estimatedOneRepMax)).toBe(60);
      expect(progress.data!.strengthProgress[0].exercise.name).toBe("Report fixture");
      expect(first.data!.exercise.strengthHistory[0]).toMatchObject({ loggedSets: 4, completedSets: 3, reps: 16 });
      expect(Number(first.data!.exercise.strengthHistory[0].volume)).toBe(620);
      expect(Number(first.data!.exercise.strengthHistory[0].estimatedOneRepMax)).toBe(60);
      const oneRepSet = await gql(`query($child: uuid!) {
        workoutSessionStrengthSets(where: {workoutSessionExerciseId: {_eq: $child}, setNumber: {_eq: 1}}) { id }
      }`, { child });
      const changed = await gql(`mutation($id: uuid!) {
        updateWorkoutSessionStrengthSet(pk_columns: {id: $id}, _set: {weight: 20}) { id }
      }`, { id: oneRepSet.data!.workoutSessionStrengthSets[0].id });
      expect(changed.errors).toBeUndefined();
      const updated = await gql(query, vars, OTHER);
      expect(updated.errors).toBeUndefined();
      expect(Number(updated.data!.exercise.strengthHistory[0].volume)).toBe(540);
      expect(Math.abs(Number(updated.data!.exercise.strengthHistory[0].estimatedOneRepMax) - 50 * (1 + 5 / 30)) < 0.001).toBe(true);
      const detached = await gql(`mutation($id: uuid!) {
        updateWorkoutSession(pk_columns: {id: $id}, _set: {workoutId: null}) { id }
      }`, { id: sessionId });
      expect(detached.errors).toBeUndefined();
      const moved = await gql(rootQuery, { ...rootVars, zone: "UTC" }, OTHER, PROXY_URL);
      expect(moved.errors).toBeUndefined();
      expect(moved.data!.workoutStrengthReport).toEqual([]);
      const exerciseAfterDetach = await gql(query, vars, OTHER);
      expect(exerciseAfterDetach.data!.exercise.strengthHistory[0].workoutId).toBeNull();
      const relinked = await gql(`mutation($id: uuid!, $workout: uuid!) {
        updateWorkoutSession(pk_columns: {id: $id}, _set: {workoutId: $workout}) { id }
      }`, { id: sessionId, workout: workoutId });
      expect(relinked.errors).toBeUndefined();
      const foreign = await gql(query, vars, USER);
      expect(foreign.errors).toBeUndefined();
      expect(foreign.data!.workout.strengthHistory).toEqual([]); // public parent cannot leak OTHER's sessions
      expect(foreign.data!.exercise).toBeNull();
      // The same exercise logged twice still produces one session point; ad-hoc
      // sessions and local-midnight boundaries must not disappear from Progress.
      for (const [id, reps, weight] of [[sessionId, 2, 10], [emptySessionId, 4, 30]] as const) {
        const extra = await gql(`mutation($session: uuid!, $exercise: uuid!, $reps: Int!, $weight: numeric!) {
          insertWorkoutSessionExercise(object: {workoutSessionId: $session, exerciseId: $exercise, position: 1,
            workoutSessionStrengthSets: {data: [{setNumber: 1, reps: $reps, weight: $weight}]}}) { id }
        }`, { session: id, exercise: exerciseId, reps, weight });
        expect(extra.errors).toBeUndefined();
      }
      const adHoc = await gql(`mutation($id: uuid!) {
        updateWorkoutSession(pk_columns: {id: $id}, _set: {workoutId: null}) { id }
      }`, {id: sessionId});
      expect(adHoc.errors).toBeUndefined();
      const localProgress = await gql(progressQuery, {...progressVars, through: "2026-12-12", zone: "America/New_York"}, OTHER);
      expect(localProgress.errors).toBeUndefined();
      expect(localProgress.data!.strengthProgress).toHaveLength(2);
      const combined = localProgress.data!.strengthProgress.find((row: {sessionId: string}) => row.sessionId === sessionId);
      expect(combined).toMatchObject({workoutId: null, loggedSets: 5, completedSets: 4, reps: 18});
      expect(Number(combined.volume)).toBe(580);
      expect(Math.abs(Number(combined.estimatedOneRepMax) - 50 * (1 + 5 / 30)) < 0.001).toBe(true);
      const utcProgress = await gql(progressQuery, {...progressVars, through: "2026-12-12"}, OTHER);
      expect(utcProgress.errors).toBeUndefined();
      expect(utcProgress.data!.strengthProgress).toHaveLength(1);
    } finally {
      for (const id of [sessionId, emptySessionId]) {
        if (id) await gql(`mutation($id: uuid!) { deleteWorkoutSession(id: $id) { id } }`, { id });
      }
      if (workoutId) await gql(`mutation($id: uuid!) { deleteWorkout(id: $id) { id } }`, { id: workoutId });
      await gql(`mutation($id: uuid!) { deleteExercise(id: $id) { id } }`, { id: exerciseId });
    }
  });
});
