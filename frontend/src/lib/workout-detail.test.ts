import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { buildSchema, execute, print } from "graphql";
import { WorkoutDetailDocument } from "@/gql/graphql";
import { workoutDetailVariables } from "./workout-detail";

const WORKOUT_ID = "00000000-0000-4000-8000-000000000001";

describe("workout detail strength history", () => {
  test.each([
    ["2026-11-12", "2025-11-12"],
    ["2024-03-01", "2023-03-02"],
    ["2024-02-29", "2023-03-01"],
    ["2026-01-01", "2025-01-01"],
  ])("requests 366 inclusive local dates through %s", (today, from) => {
    expect(workoutDetailVariables(WORKOUT_ID, today, "America/Los_Angeles")).toEqual({
      id: WORKOUT_ID,
      from,
      through: today,
      timeZone: "America/Los_Angeles",
    });
  });

  test("sends the bounded report root rather than empty computed-field arguments", async () => {
    const schema = buildSchema(
      readFileSync(
        new URL("../../../backend/schemas/schema.nhost.user.graphqls", import.meta.url),
        "utf8",
      ),
    );
    const reportRequests: unknown[] = [];
    const result = await execute({
      schema,
      document: WorkoutDetailDocument,
      variableValues: workoutDetailVariables(WORKOUT_ID, "2026-11-12", "America/Los_Angeles"),
      rootValue: {
        workout: () => null,
        workoutStrengthReport: (args: unknown) => {
          reportRequests.push(args);
          return [];
        },
      },
    });
    expect(result.errors).toBeUndefined();
    expect(reportRequests).toEqual([
      {
        args: {
          workout_id: WORKOUT_ID,
          from_day: "2025-11-12",
          through_day: "2026-11-12",
          time_zone: "America/Los_Angeles",
        },
        where: { volume: { _gt: 0 } },
        order_by: [{ startedAt: "desc" }],
        limit: 6,
      },
    ]);
    expect(print(WorkoutDetailDocument)).not.toContain("strengthHistory(");
  });

  test("shows the latest logged top set despite three newer empty occurrences, per exercise", () => {
    const result = Bun.spawnSync(["bun", "scripts/workout-last-sets.fixture.tsx"], {
      cwd: new URL("../..", import.meta.url).pathname,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 20_000,
    });
    expect(new TextDecoder().decode(result.stderr)).toBe("");
    expect(new TextDecoder().decode(result.stdout)).toContain("workout last sets fixture passed");
    expect(result.exitCode).toBe(0);
  }, 25_000);

  test("renders only volume-bearing sessions with proportional bars and preserves notes without history", () => {
    const result = Bun.spawnSync(["bun", "scripts/workout-volume.fixture.tsx"], {
      cwd: new URL("../..", import.meta.url).pathname,
      stdout: "pipe",
      stderr: "pipe",
      timeout: 20_000,
    });
    expect(new TextDecoder().decode(result.stderr)).toBe("");
    expect(new TextDecoder().decode(result.stdout)).toContain("workout volume fixture passed");
    expect(result.exitCode).toBe(0);
  }, 25_000);
});
