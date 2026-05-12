# Exercises

An **exercise** is class-table-inherited across three Postgres tables:

```
exercises                  ← base catalog row, columns shared by every kind
  ├─ exercises_strength    ← strength-only catalog metadata (double_weight, force, mechanic)
  └─ exercises_cardio      ← cardio-only catalog metadata (metrics_schema JSON Schema)
```

Every exercise has a row in `exercises` plus exactly one matching sidecar row, determined by `kind`. Each row is either a public/built-in entry (`is_public = true, user_id IS NULL`) or a user-owned custom entry (`is_public = false, user_id = <uuid>`). The `exercises_visibility_check` constraint enforces this dichotomy — there is no third state.

This document covers the catalog shape, the strength/cardio `kind` discriminator that drives logging behavior, and the cardio metrics-schema mechanism. If something here disagrees with the schema, the schema wins.

## Where to look

- Base table: `backend/nhost/migrations/default/1746230400000_init/up.sql` (`CREATE TABLE public.exercises`).
- `kind` discriminator + composite FK pattern + sync trigger: `1790000415000_exercises_kind_composite/up.sql`.
- `exercises_cardio` sidecar (per-exercise JSON Schema): `1790000410000_exercise_metrics_schema/up.sql`.
- `exercises_strength` sidecar (double_weight, force, mechanic): `1790000440000_exercises_strength_sidecar/up.sql`.
- Cardio-entries table + shape-validation trigger: `1790000420000_workout_session_cardio_entries/up.sql`.
- Strength-sets composite FK (mirror of cardio): `1790000425000_workout_session_sets_parent_kind/up.sql`.
- Strength-sets rename: `1790000450000_rename_workout_session_strength_sets/up.sql`.
- `pg_jsonschema` extension: `1790000400000_pg_jsonschema_extension/up.sql`.
- Hasura metadata: `backend/nhost/metadata/databases/default/tables/public_exercises.yaml`, `public_exercises_strength.yaml`, `public_exercises_cardio.yaml`.
- Frontend schema/format library: `frontend/src/lib/cardio-schema.ts` (with `cardio-schema.test.ts`).

## The `category` and `kind` fields

`exercises.category` is a text column referencing `public.exercise_categories(value)`. It carries the rich taxonomy: `cardio`, `strength`, `stretching`, `powerlifting`, `plyometrics`, `olympic_weightlifting`, `strongman`. It's catalog metadata — used by the UI for badges/filters and as the input to the kind discriminator below.

`exercises.kind` is the **binary discriminator** that routes logging behavior. It's a `GENERATED ALWAYS … STORED` column with a closed value set of `'strength' | 'cardio'`:

```sql
kind text GENERATED ALWAYS AS (CASE category WHEN 'cardio' THEN 'cardio' ELSE 'strength' END) STORED
```

The split: `kind = 'cardio'` exercises log into `workout_session_cardio_entries` (jsonb metrics validated against a per-exercise JSON Schema). Everything else — `kind = 'strength'` — logs into `workout_session_strength_sets` (reps + weight). The frontend branches on `exercise.kind === 'cardio'`, **not** `category`.

This kind is what participates in the composite-FK enforcement of the strength/cardio split (see "How the split is enforced structurally" below). `category` cannot serve that role directly because seven non-cardio categories would all need to map to one FK target — `kind` collapses them into one binary discriminator.

## Strength exercises (the default, six of the seven categories)

A strength exercise has `kind = 'strength'` and a matching row in the `exercises_strength` sidecar carrying:

- `double_weight` — per-exercise hint (e.g., dumbbell rows where the displayed weight is per-hand vs total). Pure UI metadata, multiplies session volume by 2 when set.
- `force` (push/pull/static) — catalog metadata, FK to `exercise_forces`.
- `mechanic` (compound/isolation) — catalog metadata, FK to `exercise_mechanics`.

When used in a session, entries are stored in `workout_session_strength_sets`: `(set_number, reps, weight)`, with `reps >= 0` and `weight >= 0`. There are no database-level constraints linking the catalog metadata (level, force, mechanic, etc.) to the data logged in a session — those columns are catalog-only.

`exercises_strength.kind` is pinned to `'strength'` via `DEFAULT + CHECK` and composite-FK'd to `exercises(id, kind)`, mirroring `exercises_cardio` (see below). This is what makes the "exactly one matching sidecar, determined by kind" invariant structural rather than aspirational — see "How the strength/cardio split is enforced structurally" further down.

Hasura exposes the sidecar as an `object_relationship` on `exercises` named `strength`, so the frontend reads as `exercise.strength?.doubleWeight`. For a cardio exercise the relationship resolves to `null`.

## Cardio exercises

A cardio exercise is one where `category = 'cardio'` (and therefore `kind = 'cardio'` by the generated-column rule). Cardio uses a **schema-driven** logging model: each cardio exercise carries a JSON Schema in the `exercises_cardio` sidecar table, and a database trigger validates each inserted entry's metrics against that schema.

### The `exercises_cardio` sidecar

```sql
CREATE TABLE exercises_cardio (
  exercise_id    uuid PRIMARY KEY,
  kind           text NOT NULL DEFAULT 'cardio' CHECK (kind = 'cardio'),
  metrics_schema jsonb NOT NULL CHECK (jsonschema_is_valid(metrics_schema::json)),
  ...
  FOREIGN KEY (exercise_id, kind) REFERENCES exercises(id, kind)
    ON UPDATE CASCADE ON DELETE CASCADE
);
```

PK = `exercise_id`, 1:1 with `exercises`. A row in `exercises_cardio` is what makes an exercise "configured for cardio logging" — without it the per-entry trigger raises `22023`. Class-table-inheritance pattern: `exercises` is the base, `exercises_cardio` is the cardio-only subtype.

`exercises_strength` mirrors this exactly: `kind` pinned to `'strength'` via `DEFAULT + CHECK`, composite-FK to `exercises(id, kind)` `ON UPDATE CASCADE ON DELETE CASCADE`. So the same pinned-kind trick that protects the WSE entry tables (see "How the strength/cardio split is enforced structurally" below) also protects the sidecars: if anyone flips `exercises.category` on an exercise that already has a sidecar, the cascade recomputes `exercises.kind`, propagates to the sidecar's `kind`, and the CHECK rejects — rolling back the whole transaction rather than leaving a wrong-kind sidecar attached.

### Sidecar lifecycle is atomic with the parent

Adding an exercise and its sidecar must happen together, and removing them must happen together — neither half can occur on its own, for admins or users alike. The invariant is enforced by **`DEFERRABLE INITIALLY DEFERRED` constraint triggers** that fire at transaction commit:

- **`AFTER INSERT` on `exercises` → `exercise_must_have_sidecar`** checks that a matching sidecar row exists for this exercise's kind. Fires at commit.
- **`AFTER DELETE` on each sidecar → `sidecar_delete_requires_parent_delete`** checks that the parent exercise no longer exists (because it was also deleted in this transaction, via CASCADE). Fires at commit.

"Deferred" matters: the check fires at commit, so clients can INSERT the exercise and the matching sidecar **in either order within the same transaction**. The natural shapes are:

- **Hasura nested mutation** — Hasura inserts the parent first, then the nested child, both within one transaction:

  ```graphql
  mutation {
    insertExercise(object: {
      slug: "...", name: "...", category: strength, ...,
      strength: { data: { doubleWeight: true, force: pull } }
    }) { id }
  }
  ```

  For cardio, the nested `data` always carries an explicit `metricsSchema` (the cardio sidecar has `NOT NULL metrics_schema` with no default — there's no useful generic default, so callers always provide a real schema).

- **SQL CTE** — admins and migrations that need to do this in raw SQL:

  ```sql
  WITH e AS (
    INSERT INTO public.exercises (slug, name, category, ...) VALUES (...)
    RETURNING id
  )
  INSERT INTO public.exercises_strength (exercise_id, double_weight, force)
  SELECT id, true, 'pull' FROM e;
  ```

Net effect: "every exercise has exactly one matching sidecar" goes from "the seed promises so" to "the database enforces so". An admin running `INSERT INTO exercises` alone gets a `constraint-violation` at commit ("exercise &lt;id&gt; (kind=&lt;k&gt;) is missing its matching sidecar at commit time"); an admin `DELETE FROM exercises_strength` standalone gets "deleting exercises_strength standalone would orphan exercise &lt;id&gt;". The only escape is the deliberate `SET session_replication_role = replica` (disables all user triggers — the well-known PG "I know what I'm doing" footgun-on-purpose).

We deliberately don't auto-create the sidecar with defaults. For cardio the `metrics_schema` is genuinely per-exercise — there's no useful generic default, and silently inserting an empty schema would just shift the failure mode from "tx aborts at commit" to "every logged entry fails validation against an empty schema". An explicit "you forgot the sidecar" at commit time is the clearer failure.

Hasura exposes the cardio sidecar as an `object_relationship` on `exercises` named `cardio`, so the frontend reads the schema as `exercise.cardio?.metricsSchema`. For a strength exercise the relationship resolves to `null`.

### The metrics JSON Schema

A standard JSON Schema 2020 document describing one entry's `metrics` jsonb. The schema uses a few custom annotation keys consumed by the frontend. **All custom keys are optional** — `iterateMetrics()` in `cardio-schema.ts` falls back to sensible defaults when they're absent, so a property like `{ "type": "integer", "minimum": 0 }` renders correctly without any `x-*` keys.

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

The seed/migration backfills three templates onto the 14 public cardio exercises. They're the only shapes used today:

- **running** (Bicycling, Treadmill, Elliptical, Rowing, Walking, Skating, ...): `distance_km` (decimal, optional), `duration_s` (duration, required), `calories_kcal` (integer, optional), `avg_hr_bpm` (average, optional — averaged, not summed, across entries in a session).
- **stairs** (Stairmaster, Step_Mill): `duration_s` (required), `floors`, `steps`, `calories_kcal`.
- **interval** (Rope_Jumping, Prowler_Sprint): `duration_s` (required), `rounds`, `calories_kcal`.

### Seed vs migration

The migration `1790000410000_exercise_metrics_schema` creates the `exercises_cardio` table and runs the same `INSERT INTO exercises_cardio SELECT id, '<schema>' FROM exercises WHERE slug IN (...)` blocks. On a **fresh local dev DB** migrations run before seeds, so the migration's backfill matches zero rows — the catalog seed (`1778235894691_exercise-catalog.sql`) repeats the same inserts at the bottom and is what actually populates `exercises_cardio` locally. The migration's backfill exists for the **production-deploy** case where the catalog rows already exist when the migration first applies. Keep both in sync if you change a template.

### Who can author schemas

Users can edit `metrics_schema` on their own private cardio exercises through the `insertExerciseCardio` / `updateExerciseCardio` mutations on the `exercises_cardio` table, gated by the user-role permission `exercise.user_id = X-Hasura-User-Id AND exercise.is_public = false AND exercise.category = 'cardio'`. The catalog-level metadata (name, category, etc.) is edited via the parent `exercises` mutations; the sidecar's `metrics_schema` is a separate write.

The `exercises_cardio_schema_valid` CHECK keeps inserts honest: any insert without a structurally valid JSON Schema is rejected by Postgres, and the resulting Hasura error surfaces as a constraint violation. The CHECK validates JSON Schema structure only, not the `x-*` annotations — those are by convention and the frontend infers defaults when missing.

Public/built-in cardio exercises are admin-managed via SQL migration + seed.

### Schema evolution is forward-only

When the owner of a private cardio exercise (or an admin, for built-in exercises) edits `exercises_cardio.metrics_schema` after entries have already been logged against it, **existing entries are not re-validated.** The shape-validation trigger on `workout_session_cardio_entries` runs only at write time on that table and reads `metrics_schema` fresh from the parent on every entry write — so subsequent entries follow the new shape, but rows already in the table stay as-is.

This is a deliberate product decision, not an accident of how the trigger is wired:

- A user tweaking their own custom cardio exercise — adding a `cadence` field, raising the minimum on `duration_s`, dropping a property they no longer track — should be able to evolve the shape going forward without their history being retroactively rejected or silently mutated. Block-on-update would force them to delete their history before editing the schema; coerce-on-update would quietly corrupt the historical record.
- The frontend already has to be tolerant of an old entry's metrics not matching the current schema, because reads and catalog edits aren't coupled. `cardio-schema.ts` falls back to the property key as label and decimal format for unrecognized properties, and `formatMetricValue()` skips properties absent from the entry — so a renamed/removed field degrades gracefully instead of crashing.

The corollary for **insert/update permissions**: the Hasura user-role update permission on `exercises_cardio.metrics_schema` intentionally has no shape constraint beyond the `jsonschema_is_valid` CHECK. There is no "your old entries must still validate" gate, because that gate is the destructive UX above. Owners of private cardio exercises can change their schema freely; cleaning up old-shape entries afterwards is a manual delete in the UI.

Strength has no analogue: `workout_session_strength_sets` is `(reps, weight)` for every exercise, so there's nothing per-exercise to evolve.

## How the strength/cardio split is enforced structurally

There is **no runtime guard** for "is this exercise cardio?" at the entry-write level — it's a foreign-key violation, not a trigger raise. The pattern is the textbook discriminated-FK approach to exclusive subtypes:

```
                exercises_strength                       exercises_cardio
                (exercise_id PK,                         (exercise_id PK,
                 kind = 'strength' DEFAULT+CHECK)         kind = 'cardio' DEFAULT+CHECK)
                          ▲                                       ▲
                          │ composite FK (exercise_id, kind)      │ composite FK (exercise_id, kind)
                          │                                       │
                          └──────────────┐         ┌──────────────┘
                                         │         │
                                exercises (id PK, kind GENERATED, UNIQUE (id, kind))
                                         ▲
                                         │ composite FK (exercise_id, kind) — kind on child is trigger-synced from parent
                                         │
                          workout_session_exercises (id PK, kind, UNIQUE (id, kind))
                                  ▲                                      ▲
                                  │ composite FK                         │ composite FK
                                  │ (workout_session_exercise_id,        │ (workout_session_exercise_id,
                                  │  parent_kind = 'strength')           │  parent_kind = 'cardio')
                                  │                                      │
                          workout_session_strength_sets         workout_session_cardio_entries
```

Each child table — the WSE entry tables **and the sidecars** — pins its discriminator via `DEFAULT '<value>' CHECK (kind = '<value>')`. The discriminator column is a real, physical column whose only job is to participate in the composite FK — clients can omit it on insert (the DEFAULT fills it) and cannot bypass it (the CHECK rejects any other value, and even if they could, the composite FK would still require it to match the parent's `kind`).

On the WSE side (`workout_exercises`, `workout_session_exercises`), `kind` is auto-populated by a `BEFORE INSERT OR UPDATE OF exercise_id, kind` trigger that copies from the referenced `exercises.kind`. Clients can omit `kind` and the trigger fills it; clients that send a wrong value get it overwritten before the FK check runs, so a wrong kind can never make it past the trigger. The trigger explicitly covers direct `UPDATE OF kind` (no `exercise_id` change) too — without that, the composite FK would still reject a wrong-kind direct update, but the trigger's normalize-then-write contract would be a half-truth.

The end result: a strength set whose parent session-exercise is cardio is an **FK violation** (SQLSTATE `23503`), and vice versa. The check is declarative, in the Postgres catalog, no plpgsql in the hot path.

The same FK chain also protects the catalog itself against a stray `exercises.category` flip. When `category` changes, the GENERATED `kind` column recomputes, and `ON UPDATE CASCADE` propagates the new value into every child's discriminator column. The pinned `CHECK (kind = '<old kind>')` on the sidecars rejects the update; the pinned `CHECK (parent_kind = '<old kind>')` on the WSE entry tables does the same. Either way, the whole transaction rolls back — a kind-changing flip on an exercise that has a sidecar attached (which every exercise does) fails atomically. Same-kind flips within the strength group (e.g. `strength` → `powerlifting`) don't change `kind`, don't cascade, and succeed.

## Cardio-shape validation (the one remaining trigger)

Once the composite FK guarantees "this entry's parent is cardio," there's still one more thing to enforce: the entry's `metrics` jsonb must conform to *the specific JSON Schema for the parent exercise*. That can't be a CHECK (a CHECK can't sub-select another row), so it's a `BEFORE INSERT OR UPDATE OF metrics, workout_session_exercise_id` trigger on `workout_session_cardio_entries`:

```sql
SELECT ec.metrics_schema INTO v_schema
FROM workout_session_exercises wse
JOIN exercises_cardio ec ON ec.exercise_id = wse.exercise_id
WHERE wse.id = NEW.workout_session_exercise_id;
```

If `exercises_cardio.metrics_schema` is missing → `22023` (cardio exercise has no schema configured). If `jsonb_matches_schema` rejects the metrics → `23514` with the list of validation errors from `jsonschema_validation_errors`.

The trigger fires only when `metrics` or `workout_session_exercise_id` is touched. Updating only `entry_number` skips validation, which is correct (the payload and its parent schema didn't change). The trigger lookup uses the **current** schema; existing rows aren't re-validated when `exercises_cardio.metrics_schema` is edited — that's the deliberate forward-only semantics covered under "[Schema evolution is forward-only](#schema-evolution-is-forward-only)" above, not just an artifact of trigger timing.

There is **no symmetric trigger on `workout_session_strength_sets`** because strength sets have a fixed columnar shape (reps, weight) — there's nothing per-exercise to validate. The strength side gets its kind enforcement from the composite FK alone.

## The `pg_jsonschema` extension

Validation depends on the `pg_jsonschema` extension (`CREATE EXTENSION IF NOT EXISTS pg_jsonschema`, installed as the `postgres` role in migration `1790000400000_...`).

- `jsonschema_is_valid(schema json) -> bool` — used by the `exercises_cardio` CHECK.
- `jsonb_matches_schema(schema json, instance jsonb) -> bool` — used by the trigger.
- `jsonschema_validation_errors(schema json, instance json) -> text[]` — used to build a readable error message when validation fails.

## Cardio entries table

```
workout_session_cardio_entries (
  id                          uuid PK,
  workout_session_exercise_id uuid \
  parent_kind                 text  > composite FK → workout_session_exercises(id, kind)
                                      (parent_kind pinned to 'cardio' by CHECK + DEFAULT)
  entry_number                integer (>= 1),
  metrics                     jsonb,
  ...
  UNIQUE (workout_session_exercise_id, entry_number)
)
```

The `entry_number` is per-parent (one cardio session can have entries 1..N), determined client-side as `last_seen_entry_number + 1`. This is racy across devices but the UNIQUE constraint makes the second writer fail loudly; in `CardioExerciseLog` (`frontend/src/routes/_authed/sessions/$sessionId.tsx`) the failed mutation surfaces as a `toast.error("Failed: …")` and the user reopens the add-entry dialog to retry — `nextEntryNumber` is recomputed from the (now-invalidated) session query, so the second attempt picks up the winning row's number and succeeds. There is no automatic conflict detection; if cross-device collisions ever become common, the fix is to catch Hasura's `constraint-violation` extension on the insert and re-mutate after invalidating.

Multiple entries per session are a real use case — see the seeded "4×400m intervals" session, which logs the same `workout_session_exercise` four times.

The strength-side equivalent is `workout_session_strength_sets`, with the same composite-FK shape but `parent_kind = 'strength'` and `(set_number, reps, weight)` columns instead of jsonb metrics.

## Adding a new metric format or template

To add a new `x-format` (e.g., `"pace_min_per_km"`):

1. Pick a new value and use it consistently in `metrics_schema` documents.
2. Add the discriminator to `MetricFormat` in `frontend/src/lib/cardio-schema.ts`. Decide whether it's summable or sample-style (e.g. pace is a sample) and extend `aggregationForFormat()` if needed.
3. Handle it in `formatMetricValue()`, `parseField()` / the input renderer in `cardio-metrics-form.tsx`, and `buildZodSchemaFromMetricsSchema()`.
4. Add tests in `cardio-schema.test.ts`.
5. Author/backfill the schemas via SQL migration (and mirror in the catalog seed). No DB-side change is needed — `x-format` is a custom annotation, transparent to `pg_jsonschema`.

To add a new cardio template, write a fourth schema and `INSERT INTO exercises_cardio (exercise_id, metrics_schema) SELECT id, '<schema>' FROM exercises WHERE slug IN (...)` in a new migration, **and** append the same INSERT to `1778235894691_exercise-catalog.sql` for fresh-DB dev environments. The CHECK passes as soon as the schema is structurally valid; the trigger picks it up on the next insert. No metadata or codegen change is required because `metrics_schema` is already exposed on `exercises_cardio` to the user role.
