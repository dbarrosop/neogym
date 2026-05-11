# Database schema

A visual map of NeoGym's Postgres schema. The diagrams below are Mermaid ER diagrams — GitHub renders them natively, and most IDEs (VS Code with the Markdown Preview Mermaid Support extension, JetBrains with Mermaid plugin) do too.

If you only want quick reference for the **strength/cardio split** and **per-exercise metrics-schema**, see [`exercises.md`](exercises.md) and [`sessions.md`](sessions.md) — they cover the invariants in prose. This document focuses on the shape: what tables exist, how they connect, and which keys do the load-bearing work.

For the authoritative definitions, always read the migrations under `backend/nhost/migrations/default/`. The diagram lags reality — if there's a conflict, the migration wins.

## Core domain — workouts, sessions, exercises

This is the heart of the app. Strength sets and cardio entries are the two child tables; everything above them is shared.

```mermaid
erDiagram
    USERS["auth.users"]

    EXERCISES {
        uuid id PK
        text slug UK
        text name
        text category FK "exercise_categories"
        text kind "GENERATED: cardio iff category=cardio, else strength"
        text primary_muscle_group FK "muscle_groups"
        boolean is_public
        uuid user_id FK "auth.users; NULL iff is_public"
        text level FK "exercise_levels (nullable)"
        text equipment FK "exercise_equipments (nullable)"
        uuid image_1_file_id FK "storage.files (nullable)"
        uuid image_2_file_id FK "storage.files (nullable)"
    }

    EXERCISES_STRENGTH {
        uuid exercise_id PK "FK exercises CASCADE; 1:1, present iff kind=strength"
        boolean double_weight
        text force FK "exercise_forces (nullable)"
        text mechanic FK "exercise_mechanics (nullable)"
    }

    EXERCISES_CARDIO {
        uuid exercise_id PK "FK exercises CASCADE; 1:1, present iff kind=cardio"
        jsonb metrics_schema "CHECK jsonschema_is_valid"
    }

    WORKOUTS {
        uuid id PK
        text name
        text description
        boolean is_public
        uuid user_id FK "auth.users; NULL iff is_public"
    }

    WORKOUT_EXERCISES {
        uuid id PK
        uuid workout_id FK "workouts CASCADE"
        uuid exercise_id FK "composite FK with kind"
        text kind FK "composite FK; trigger-synced from exercises.kind"
        integer position "UNIQUE(workout_id, position) DEFERRABLE"
    }

    WORKOUT_SESSIONS {
        uuid id PK
        uuid workout_id FK "workouts CASCADE; NULLABLE for ad-hoc"
        uuid user_id FK "auth.users CASCADE"
        timestamptz started_at
    }

    WORKOUT_SESSION_EXERCISES {
        uuid id PK
        uuid workout_session_id FK "workout_sessions CASCADE"
        uuid exercise_id FK "composite FK with kind"
        text kind FK "composite FK; trigger-synced from exercises.kind"
        integer position "UNIQUE(workout_session_id, position) DEFERRABLE"
    }

    WORKOUT_SESSION_STRENGTH_SETS {
        uuid id PK
        uuid workout_session_exercise_id FK "composite FK with parent_kind"
        text parent_kind "DEFAULT strength CHECK = strength"
        integer set_number "UNIQUE per parent"
        integer reps "CHECK reps >= 0"
        numeric weight "CHECK weight >= 0"
    }

    WORKOUT_SESSION_CARDIO_ENTRIES {
        uuid id PK
        uuid workout_session_exercise_id FK "composite FK with parent_kind"
        text parent_kind "DEFAULT cardio CHECK = cardio"
        integer entry_number "UNIQUE per parent"
        jsonb metrics "validated by trigger vs exercises_cardio.metrics_schema"
    }

    USERS ||--o{ EXERCISES                       : "owns (private)"
    USERS ||--o{ WORKOUTS                        : "owns (private)"
    USERS ||--o{ WORKOUT_SESSIONS                : "owns"

    EXERCISES ||--o| EXERCISES_STRENGTH          : "strength sidecar (1:1, PK=FK)"
    EXERCISES ||--o| EXERCISES_CARDIO            : "cardio sidecar (1:1, PK=FK)"
    EXERCISES ||--o{ WORKOUT_EXERCISES           : "composite FK (id, kind)"
    EXERCISES ||--o{ WORKOUT_SESSION_EXERCISES   : "composite FK (id, kind)"

    WORKOUTS  ||--o{ WORKOUT_EXERCISES           : "ordered list"
    WORKOUTS  ||--o{ WORKOUT_SESSIONS            : "template link (nullable; CASCADE)"

    WORKOUT_SESSIONS          ||--o{ WORKOUT_SESSION_EXERCISES        : "ordered list"
    WORKOUT_SESSION_EXERCISES ||--o{ WORKOUT_SESSION_STRENGTH_SETS    : "composite FK; parent_kind='strength'"
    WORKOUT_SESSION_EXERCISES ||--o{ WORKOUT_SESSION_CARDIO_ENTRIES   : "composite FK; parent_kind='cardio'"
```

### The strength/cardio split (the load-bearing pattern)

The split between strength and cardio logging is enforced **structurally**, not by triggers. The pattern is the textbook discriminated-FK approach to exclusive subtypes (Bill Karwin's *SQL Antipatterns*, Joe Celko's *SQL for Smarties*).

1. `exercises.kind` is a `GENERATED ALWAYS … STORED` column derived from `category`:
   ```sql
   kind text GENERATED ALWAYS AS (CASE category WHEN 'cardio' THEN 'cardio' ELSE 'strength' END) STORED
   ```
   It collapses the seven-value `category` taxonomy (`cardio`, `strength`, `stretching`, `powerlifting`, `plyometrics`, `olympic_weightlifting`, `strongman`) into the binary discriminator that matters for routing.

2. `exercises` carries `UNIQUE (id, kind)` so child tables can target the pair via composite FK.

3. `workout_exercises` and `workout_session_exercises` each have their own `kind` column populated by a `BEFORE INSERT OR UPDATE OF exercise_id` trigger that copies from `exercises.kind`. The column has no client-meaningful value — it's a pure FK slot. If a client sends a wrong `kind`, the trigger overwrites it before the FK check runs.

4. `workout_session_exercises` also has `UNIQUE (id, kind)` for the same reason.

5. `workout_session_strength_sets.parent_kind` is pinned: `DEFAULT 'strength' CHECK (parent_kind = 'strength')`. `workout_session_cardio_entries.parent_kind` is pinned to `'cardio'` the same way. Each has a composite FK on `(workout_session_exercise_id, parent_kind) → workout_session_exercises(id, kind)`.

Net effect: a strength set whose parent session-exercise is cardio is an **FK violation** (SQLSTATE `23503`). A cardio entry on a strength parent is the mirror violation. No trigger, no runtime check — declarative, in the Postgres catalog. See [`exercises.md`](exercises.md) for the full reasoning and [`backend/tests/kind-enforcement.test.ts`](../../backend/tests/kind-enforcement.test.ts) for the integration tests that prove it.

### Cardio metrics-schema validation

The composite FK enforces *which* sets/entries can attach to *which* parent. A separate `BEFORE INSERT OR UPDATE OF (metrics, workout_session_exercise_id)` trigger on `workout_session_cardio_entries` validates the *shape* of the `metrics` jsonb against the parent exercise's `exercises_cardio.metrics_schema` using `pg_jsonschema`. If the parent isn't cardio the trigger noops and lets the FK speak; if the parent is cardio but lacks a sidecar it raises `22023`; if the metrics don't match the schema it raises `23514` with the validation errors joined into the message.

There is no symmetric trigger on `workout_session_strength_sets` — strength sets have a fixed columnar shape (reps, weight), so there's nothing per-exercise to validate.

## Catalog enums and join tables

These are the small reference tables the catalog rows point at.

```mermaid
erDiagram
    EXERCISES          { uuid id PK }
    EXERCISES_STRENGTH { uuid exercise_id PK }

    EXERCISE_CATEGORIES         { text value PK }
    EXERCISE_LEVELS             { text value PK }
    EXERCISE_FORCES             { text value PK }
    EXERCISE_MECHANICS          { text value PK }
    EXERCISE_EQUIPMENTS         { text value PK }
    MUSCLE_GROUPS               { text value PK }

    EXERCISE_SECONDARY_MUSCLE_GROUPS {
        uuid exercise_id PK
        text muscle_group PK
    }

    STORAGE_FILES["storage.files"]

    EXERCISE_CATEGORIES ||--o{ EXERCISES                         : "category"
    EXERCISE_LEVELS     ||--o{ EXERCISES                         : "level"
    EXERCISE_EQUIPMENTS ||--o{ EXERCISES                         : "equipment"
    MUSCLE_GROUPS       ||--o{ EXERCISES                         : "primary_muscle_group"
    EXERCISE_FORCES     ||--o{ EXERCISES_STRENGTH                : "force"
    EXERCISE_MECHANICS  ||--o{ EXERCISES_STRENGTH                : "mechanic"
    EXERCISES           ||--o{ EXERCISE_SECONDARY_MUSCLE_GROUPS  : "association"
    MUSCLE_GROUPS       ||--o{ EXERCISE_SECONDARY_MUSCLE_GROUPS  : "association"
    STORAGE_FILES       ||--o{ EXERCISES                         : "image_1_file_id / image_2_file_id"
```

All seven enum tables are seeded in the init migration; only the value column exists. They're FKed for referential integrity, not for any computed behavior. The `exercise_categories` enum is what the `kind` GENERATED column reads when deriving cardio-vs-strength. `exercise_forces` and `exercise_mechanics` are referenced from the **`exercises_strength` sidecar** rather than the base — cardio rows don't have either.

`exercise_secondary_muscle_groups` is a pure association table (no timestamps, no id — composite PK `(exercise_id, muscle_group)`).

## Workout labels

Labels are a many-to-many tag system for workouts. Same shape as journal labels below (parallel design, separate tables).

```mermaid
erDiagram
    WORKOUTS         { uuid id PK }
    LABELS {
        uuid id PK
        text name
        uuid user_id "FK auth.users; NULL iff is_public"
        boolean is_public
    }
    WORKOUT_LABELS {
        uuid workout_id PK
        uuid label_id PK
    }

    WORKOUTS ||--o{ WORKOUT_LABELS  : "tagged with"
    LABELS   ||--o{ WORKOUT_LABELS  : "applied to"
```

## Auxiliary domains — body measurements and journal

These are unrelated to the workout/session model — they're separate per-user data streams attached directly to `auth.users`.

```mermaid
erDiagram
    USERS["auth.users"]

    BODY_MEASUREMENTS {
        uuid id PK
        uuid user_id "FK auth.users CASCADE"
        date measured_on
        numeric weight_kg
        numeric body_fat_percent
    }

    JOURNAL_ENTRIES {
        uuid id PK
        uuid user_id "FK auth.users CASCADE"
        timestamptz entry_at
        text body
    }

    JOURNAL_LABELS {
        uuid id PK
        text name
        uuid user_id "FK auth.users; NULL iff is_public"
        boolean is_public
    }

    JOURNAL_ENTRY_LABELS {
        uuid journal_entry_id PK
        uuid label_id PK
    }

    USERS ||--o{ BODY_MEASUREMENTS                : "logs"
    USERS ||--o{ JOURNAL_ENTRIES                  : "writes"
    USERS ||--o{ JOURNAL_LABELS                   : "owns (private)"

    JOURNAL_ENTRIES ||--o{ JOURNAL_ENTRY_LABELS   : "tagged with"
    JOURNAL_LABELS  ||--o{ JOURNAL_ENTRY_LABELS   : "applied to"
```

`journal_labels` and `workout_labels` use the same "public-or-user-owned" visibility pattern as `exercises` and `workouts`: `is_public = true ⇔ user_id IS NULL`, enforced by a CHECK constraint.

## Public vs user-owned visibility

A pattern that recurs across `exercises`, `workouts`, `labels`, `journal_labels`:

```sql
CHECK (
  (is_public = true  AND user_id IS NULL) OR
  (is_public = false AND user_id IS NOT NULL)
)
```

Combined with `UNIQUE NULLS NOT DISTINCT (user_id, name)`, this gives "public rows can't be private, private rows can't be public, and no two rows can share `(user_id, name)` — including the public namespace, where `user_id IS NULL` collides with itself."

The Hasura `user`-role select filter is `user_id = X-Hasura-User-Id OR is_public = true`, so users see their own rows plus the public catalog. Insert/update/delete are gated to `user_id = X-Hasura-User-Id AND is_public = false` — users cannot create or mutate public rows; those are admin-only via migrations + seeds.

## Cascade behavior

Most cascades are `ON DELETE CASCADE` from a session/workout root, so deleting a session removes its session-exercises which remove their sets/entries. Two exceptions worth knowing:

| FK | Action | Why |
|---|---|---|
| `workout_exercises.exercise_id` → `exercises.id` | `ON DELETE RESTRICT` | Deleting a catalog exercise that's used in any workout/session is forbidden — the user has to remove or replace it first. |
| `workout_session_exercises.exercise_id` → `exercises.id` | `ON DELETE RESTRICT` | Same reason, for session-level rows. |
| `workout_sessions.workout_id` → `workouts.id` | `ON DELETE CASCADE` | Deleting a workout cascades to every session created from it. The column is nullable for ad-hoc sessions, but the CASCADE wasn't changed when nullability was added — see [`sessions.md`](sessions.md) → "What happens if the workout is deleted" for the sharp edge. |

## Triggers

There are a handful of meaningful triggers; the rest are stock `updated_at` setters on every `BEFORE UPDATE`.

| Table | Trigger | Fires on | What it does |
|---|---|---|---|
| `workout_exercises` | `sync_public_workout_exercises_kind` | `BEFORE INSERT OR UPDATE OF exercise_id` | Copies `kind` from the parent `exercises.kind`, overwriting any client-supplied value. |
| `workout_session_exercises` | `sync_public_workout_session_exercises_kind` | `BEFORE INSERT OR UPDATE OF exercise_id` | Same. |
| `workout_session_cardio_entries` | `validate_public_workout_session_cardio_entries_metrics` | `BEFORE INSERT OR UPDATE OF metrics, workout_session_exercise_id` | Validates `metrics` against `exercises_cardio.metrics_schema` via `pg_jsonschema`. Noops if the parent isn't cardio so the FK can give a clearer error. |

The `pg_jsonschema` extension (`CREATE EXTENSION` in migration `1790000400000`) provides the three functions used here: `jsonschema_is_valid`, `jsonb_matches_schema`, `jsonschema_validation_errors`.
