# Exercises

An **exercise** (`public.exercises`) is the catalog row that backs everything in a session. Each row is either a public/built-in entry (`is_public = true, user_id IS NULL`) or a user-owned custom entry (`is_public = false, user_id = <uuid>`). The `exercises_visibility_check` constraint enforces this dichotomy — there is no third state.

This document covers the exercise model and the cardio metrics-schema mechanism. If something here disagrees with the schema, the schema wins.

## Where to look

- Table: `backend/nhost/migrations/default/1746230400000_init/up.sql` (lines around `CREATE TABLE public.exercises`).
- `metrics_schema` column + cardio CHECK: `1790000410000_exercise_metrics_schema/up.sql`.
- Cardio entries table + validation trigger: `1790000420000_workout_session_cardio_entries/up.sql`.
- `pg_jsonschema` extension: `1790000400000_pg_jsonschema_extension/up.sql`.
- Hasura metadata: `backend/nhost/metadata/databases/default/tables/public_exercises.yaml`.
- Frontend schema/format library: `frontend/src/lib/cardio-schema.ts` (with `cardio-schema.test.ts`).

## The `category` field

`exercises.category` is a text column referencing `public.exercise_categories(value)`. It drives nothing on its own except UI branching and the cardio CHECK. The values come from the `exercise_categories` enum table seeded in the init migration.

**The only category with special behavior is `'cardio'`.** Everything else (strength, stretching, plyometrics, etc.) is treated identically by the schema: it just stores `workout_session_sets` (reps + weight) when logged.

## Strength exercises (the default)

A strength exercise has:

- `metrics_schema = NULL` (enforced by `exercises_metrics_schema_check` — see below).
- When used in a session, entries are stored in `workout_session_sets`: `(set_number, reps, weight)`, with `reps >= 0` and `weight >= 0`.
- `exercises.double_weight` is a per-exercise hint (e.g., dumbbell rows where the displayed weight is per-hand vs total) — pure UI metadata.

There are no database-level constraints linking the exercise's metadata (level, force, mechanic, etc.) to the data logged in a session. Those columns are catalog-only.

## Cardio exercises

A cardio exercise is one where `category = 'cardio'`. Cardio uses a **schema-driven** logging model: each cardio exercise carries a JSON Schema (`metrics_schema jsonb`) that describes the shape of one cardio entry's payload, and a database trigger validates inserted entries against that schema.

### The `metrics_schema` column

A JSON Schema describing one entry's `metrics` jsonb. The schema is standard JSON Schema 2020 with a few custom annotation keys used by the frontend. **All custom keys are optional** — `iterateMetrics()` in `cardio-schema.ts` falls back to sensible defaults when they're absent, so a property like `{ "type": "integer", "minimum": 0 }` renders correctly without any `x-*` keys.

| Custom key   | Type        | Fallback when absent                                                                 |
| ------------ | ----------- | ------------------------------------------------------------------------------------ |
| `x-label`    | string      | The property key itself (e.g., `"distance_km"`).                                     |
| `x-unit`     | string      | No suffix.                                                                           |
| `x-format`   | enum        | Inferred from `type`: `"integer"` → `"integer"`, everything else → `"decimal"`. `"duration_seconds"` and `"average"` cannot be inferred — set them explicitly when wanted. |
| `x-order`    | integer     | `0` (specs with the same order are kept in object insertion order).                  |

The `x-format` value controls:

- Input mode in `cardio-metrics-form.tsx` (`integer`/`numeric` keyboard vs `decimal` keyboard with comma/dot acceptance; `duration_seconds` renders a 3-field h/m/s input; `average` uses the same numeric keyboard as `integer`).
- Display formatting in `formatMetricValue()` — `integer` and `average` render without decimals with the unit suffix, `decimal` allows up to two fractional digits, `duration_seconds` renders as `m:ss` / `h:mm:ss` with no unit.
- Aggregation across entries on `/exercises/$id` (the per-session trend chart). `integer`, `decimal`, and `duration_seconds` are **summed** within a session (4×400m intervals total 1.6 km of `distance_km`); `average` is **averaged** (avg HR across the four intervals, not their sum, which would be meaningless). The caption under the headline number flips between "total across entries" and "average across entries" accordingly. See `aggregationForFormat()` in `cardio-schema.ts`.

The schema also controls `required` (top-level JSON Schema), `minimum`, `maximum`, and `exclusiveMaximum`, all enforced both on the client (zod via `buildZodSchemaFromMetricsSchema`) and on the server (via the `pg_jsonschema` trigger).

### Three seeded templates

The migration backfills three templates onto the public cardio exercises. They're the only shapes used today:

- **running** (Bicycling, Treadmill, Elliptical, Rowing, Walking, Skating, ...): `distance_km` (decimal, optional), `duration_s` (duration, required), `calories_kcal` (integer, optional), `avg_hr_bpm` (average, optional — averaged, not summed, across entries in a session).
- **stairs** (Stairmaster, Step_Mill): `duration_s` (required), `floors`, `steps`, `calories_kcal`.
- **interval** (Rope_Jumping, Prowler_Sprint): `duration_s` (required), `rounds`, `calories_kcal`.

### Public cardio workout templates

Seed `backend/nhost/seeds/default/1778716800004_public_workouts.sql` ships four public workouts built from these cardio exercises (Indoor Triathlon, Duathlon, Cardio Pentathlon, Brick Workout). The same seed file also defines the strength/fat-loss/functional 3-day programs — they're all `user_id IS NULL, is_public = true`, with `workout_exercises` inserted via a `JOIN` on `exercises.slug` so a missing catalog row leaves the workout empty rather than failing the FK.

### Who can author schemas

The `metrics_schema` column is in the user role's `insert_permissions.columns` and `update_permissions.columns` on `public_exercises.yaml`. Combined with the existing visibility filter (`user_id = X-Hasura-User-Id AND is_public = false`), this means **users can create or edit `metrics_schema` on their own private cardio exercises** via the standard `insertExercise` / `updateExercise` mutations. The CHECK constraint is what keeps them honest: any cardio insert without a structurally valid schema is rejected by Postgres, and the resulting Hasura error surfaces as a constraint violation.

Public/built-in cardio exercises are admin-managed via SQL migrations (see the seeded running/stairs/interval templates below).

### The `exercises_metrics_schema_check` CHECK

```sql
CASE
  WHEN category = 'cardio'
    THEN metrics_schema IS NOT NULL
         AND jsonschema_is_valid(metrics_schema::json)
  ELSE metrics_schema IS NULL
END
```

This makes `(category, metrics_schema)` a closed pair:

- `category = 'cardio'` → `metrics_schema` MUST be present and MUST be a structurally valid JSON Schema.
- Any other category (or NULL) → `metrics_schema` MUST be NULL.

Two consequences worth knowing:

1. **You cannot flip a non-cardio exercise to cardio in one statement** — you have to set both `category = 'cardio'` and `metrics_schema = <schema>` in the same UPDATE, or do it in a transaction. Otherwise the CHECK fails on the intermediate state.
2. **`jsonschema_is_valid` validates JSON Schema structure, not the `x-*` annotations.** That's intentional: the `x-*` keys are all optional and the frontend infers defaults when they're missing (see the fallback table above). The CHECK only guarantees that *some* valid JSON Schema is present; it's up to the schema author to add `x-label`/`x-format`/etc. when they want non-default rendering.

### Per-entry validation trigger

A `BEFORE INSERT OR UPDATE OF metrics, workout_session_exercise_id` trigger on `workout_session_cardio_entries` runs `validate_workout_session_cardio_entry()`:

1. Looks up the parent exercise's `category` and `metrics_schema` via the join `cardio_entry → workout_session_exercise → exercise`.
2. If the exercise is not cardio or has no schema → raises `22023` (`'cannot log cardio entry for non-cardio exercise...'`).
3. If the entry's `metrics` jsonb does not satisfy the schema → raises `23514` with the list of validation errors from `jsonschema_validation_errors(...)`.

A CHECK constraint cannot do this because it can't sub-select another row; the trigger is the workaround. It implements the cardio side of the strength/cardio invariant — non-cardio exercises silently allow `workout_session_sets` because there's no equivalent trigger on that table, but cardio exercises actively reject malformed entries.

The trigger fires only when `metrics` or `workout_session_exercise_id` is touched. Updating only `entry_number` skips validation, which is correct (the payload and its parent schema didn't change).

It also does **not** fire when a parent `workout_session_exercises.exercise_id` is re-pointed to a different exercise — the children aren't touched, so the trigger is blind to that path. The Hasura metadata closes that loophole instead: the user role's `update_permissions.columns` on `workout_session_exercises` is restricted to `position` (see `sessions.md` → "Why `workout_session_exercises.exercise_id` is immutable for the user role"). Changing which exercise a `workout_session_exercises` row points at requires delete + insert, which cascades to the children.

### The `pg_jsonschema` extension

Validation depends on the `pg_jsonschema` extension (`CREATE EXTENSION IF NOT EXISTS pg_jsonschema`, installed as the `postgres` role in migration `1790000400000_...`).

- `jsonschema_is_valid(schema json) -> bool` — used by the exercises CHECK.
- `jsonb_matches_schema(schema json, instance jsonb) -> bool` — used by the trigger.
- `jsonschema_validation_errors(schema json, instance json) -> text[]` — used to build a readable error message when validation fails.

### Cardio entries table

```
workout_session_cardio_entries (
  id                          uuid PK,
  workout_session_exercise_id uuid → workout_session_exercises,
  entry_number                integer (>= 1),
  metrics                     jsonb,
  ...
  UNIQUE (workout_session_exercise_id, entry_number)
)
```

The `entry_number` is per-parent (one cardio session can have entries 1..N), determined client-side as `last_seen_entry_number + 1`. This is racy across devices but the UNIQUE constraint makes the second writer fail loudly; in `CardioExerciseLog` (`frontend/src/routes/_authed/sessions/$sessionId.tsx`) the failed mutation surfaces as a `toast.error("Failed: …")` and the user reopens the add-entry dialog to retry — `nextEntryNumber` is recomputed from the (now-invalidated) session query, so the second attempt picks up the winning row's number and succeeds. There is no automatic conflict detection; if cross-device collisions ever become common, the fix is to catch Hasura's `constraint-violation` extension on the insert and re-mutate after invalidating.

Multiple entries per session are a real use case — see the seeded "4×400m intervals" session, which logs the same `workout_session_exercise` four times.

## Adding a new metric format or template

To add a new `x-format` (e.g., `"pace_min_per_km"`):

1. Pick a new value and use it consistently in `metrics_schema` documents.
2. Add the discriminator to `MetricFormat` in `frontend/src/lib/cardio-schema.ts`. Decide whether it's summable or sample-style (e.g. pace is a sample) and extend `aggregationForFormat()` if needed.
3. Handle it in `formatMetricValue()`, `parseField()` / the input renderer in `cardio-metrics-form.tsx`, and `buildZodSchemaFromMetricsSchema()`.
4. Add tests in `cardio-schema.test.ts`.
5. Author/backfill the schemas via SQL migration. No DB-side change is needed — `x-format` is a custom annotation, transparent to `pg_jsonschema`.

To add a new cardio template, write a fourth schema and `UPDATE public.exercises SET metrics_schema = ... WHERE slug IN (...)` in a new migration. The CHECK passes as soon as the schema is structurally valid; the trigger picks it up on the next insert. No metadata or codegen change is required because `metrics_schema` is already exposed as `jsonb` to the user role.
