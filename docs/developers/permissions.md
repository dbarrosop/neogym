# Permissions

This document describes every Hasura permission configured in `backend/nhost/metadata/databases/default/tables/*.yaml`. Permissions are the security boundary between the GraphQL API and the database — they decide *which rows each role can read, insert, update, or delete*, and *which columns each role can touch*. Everything in this doc reflects what's in the YAML files; if a claim here disagrees with the metadata, the metadata is the source of truth and this doc needs an update (see the doc-sync rule in CLAUDE.md).

## Roles

Three roles appear in this project:

| Role | Who | How it's identified |
|---|---|---|
| `admin` | Backend code, migrations, integration tests, the Hasura console | `X-Hasura-Admin-Secret` header. Bypasses every permission check. |
| `user` | A signed-in app user | JWT issued by Nhost Auth; resolves to a uuid in `X-Hasura-User-Id`. Most of the rules below filter or check against this id. |
| `public` | Unauthenticated visitors | Default for any request without an admin secret or valid JWT. Only used by `storage.files` so an unauthenticated browser can fetch exercise-image binaries by URL. |

## How Hasura permission rules work (in 30 seconds)

Each table can declare four permission blocks per role. They each do something slightly different:

| Block | Used for | Has a "filter"? | Has a "check"? | Has a "columns" list? |
|---|---|---|---|---|
| `select_permissions` | Reads (`select`, `select_by_pk`, `select_aggregate`) | Yes — restricts visible rows | — | Yes — columns the user can read |
| `insert_permissions` | Writes (`insert`, `insert_one`) | — | Yes — must hold for the resulting row | Yes — columns the user is allowed to set |
| `update_permissions` | Writes (`update`, `update_by_pk`) | Yes — which rows can be targeted | Yes — must hold for the row *after* the update | Yes — columns the user is allowed to set |
| `delete_permissions` | Writes (`delete`, `delete_by_pk`) | Yes — which rows can be targeted | — | — |

Both `filter` and `check` are boolean expressions that can walk relationships. `X-Hasura-User-Id` is substituted with the caller's uuid at request time. An empty `{}` filter means "every row".

`insert_permissions.set` is a separate concept: it forces certain columns to a fixed value at insert time, regardless of what the client sent. We use it to pin `user_id` to `X-Hasura-User-Id` so clients can't forge ownership.

## Repeated patterns

Three patterns cover almost every table in this project. The table sections below refer back to these by name.

### A. Private per-user

The user can see, write, update, and delete only their own rows.

- `filter: { user_id: { _eq: X-Hasura-User-Id } }` on select/update/delete.
- `check: { user_id: { _eq: X-Hasura-User-Id } }` on insert/update.
- `set: { user_id: X-Hasura-User-Id }` on insert (so a malicious client can't write `user_id: someone-else`).

Used for: `body_measurements`, `journal_entries`, `journal_labels`, `workout_sessions`.

### B. Owner-or-public catalog

The user can see their own private rows **plus** all rows flagged `is_public = true`. They can only mutate (insert/update/delete) their own private rows — `is_public = true` rows are admin-managed (the public exercise catalog, public workouts, public labels).

- `filter` on select: `_or: [user_id eq self, is_public eq true]`.
- `filter` on update/delete: `_and: [user_id eq self, is_public eq false]`.
- `check` on insert/update: `_and: [user_id eq self, is_public eq false]`.

Used for: `exercises`, `workouts`, `labels`, `foods`.

### C. Inherited from a parent

The table itself has no `user_id` column — ownership is determined by walking a relationship to a parent that does. A regression here would silently leak data across users, so this pattern is the one to scrutinize.

- The `filter` and `check` follow a relationship path: `<relationship>.<parent>.user_id._eq: X-Hasura-User-Id` (sometimes with an `is_public` branch for read-only access to public parents).
- There's no `user_id` column to forge, so no `set` block is needed.

Used for: `workout_exercises`, `workout_session_exercises`, `workout_session_strength_sets`, `workout_session_cardio_entries`, `workout_labels`, `journal_entry_labels`, `exercises_strength`, `exercises_cardio`, `meal_ingredients`, `nutrition_plan_meals`, `nutrition_log_meals`, `nutrition_log_entries`.

## Public, user-readable catalog data

These tables expose canonical lists used as foreign keys / enums. Everything in them is admin-managed; the user role only reads them.

| Table | Role | Action | Columns | Filter | Enforces |
|---|---|---|---|---|---|
| `exercise_categories` | `user` | `select` | `value`, `comment` | `{}` (all rows) | Enum-style lookup for `exercises.category`. Read-only to the user. |
| `exercise_equipments` | `user` | `select` | `value`, `comment` | `{}` (all rows) | Lookup for `exercises.equipment`. Read-only. |
| `exercise_forces` | `user` | `select` | `value`, `comment` | `{}` (all rows) | Lookup for `exercises_strength.force`. Read-only. |
| `exercise_levels` | `user` | `select` | `value`, `comment` | `{}` (all rows) | Lookup for `exercises.level`. Read-only. |
| `exercise_mechanics` | `user` | `select` | `value`, `comment` | `{}` (all rows) | Lookup for `exercises_strength.mechanic`. Read-only. |
| `muscle_groups` | `user` | `select` | `value`, `comment` | `{}` (all rows) | Lookup for `exercises.primary_muscle_group` and `exercise_secondary_muscle_groups.muscle_group`. Read-only. |
| `exercise_secondary_muscle_groups` | `user` | `select` | `exercise_id`, `muscle_group` | `{}` (all rows) | Read-only mapping of secondary muscles per exercise. There's no user-role write path: a user-created exercise can't yet declare secondary muscle groups via the GraphQL API. |

## Exercise catalog

The exercise catalog uses class-table inheritance: `exercises` is the base, `exercises_strength` and `exercises_cardio` are 1:1 sidecars keyed off `kind`. See [`exercises.md`](exercises.md) for the structural enforcement; the permission story is described here.

### `exercises` — pattern **B (owner-or-public catalog)**

| Role | Action | Columns | Filter / Check | Enforces |
|---|---|---|---|---|
| `user` | `select` | `id`, `slug`, `name`, `primary_muscle_group`, `instructions`, `level`, `category`, `kind`, `equipment`, `image_1_file_id`, `image_2_file_id`, `user_id`, `is_public`, `created_at`, `updated_at` | filter: `_or [user_id eq self, is_public eq true]` | A user sees the global public catalog plus any private exercises they created. |
| `user` | `insert` | `name`, `primary_muscle_group`, `instructions`, `level`, `category`, `equipment`, `image_1_file_id`, `image_2_file_id` | check: `_and [user_id eq self, is_public eq false]`; `set: user_id = self` | A user can create private exercises only. `user_id` is forced to self (no spoofing). The user cannot set `is_public`, `kind` (generated), or `slug` — only admin populates those. |
| `user` | `update` | `name`, `primary_muscle_group`, `instructions`, `level`, `category`, `equipment`, `image_1_file_id`, `image_2_file_id` | filter & check: `_and [user_id eq self, is_public eq false]` | A user can only edit their own private exercises. Public catalog rows are admin-only. |
| `user` | `delete` | — | filter: `_and [user_id eq self, is_public eq false]` | Same scope as update: delete only your private exercises. |

Note: `user_id` and `is_public` are returnable in select but **not** in the user's insert/update column allowlist — the `set` block on insert is the only way they get populated, and there's no path to flip a private row public.

### `exercises_strength` — pattern **C (inherited from exercise)**

Per-kind catalog metadata for strength exercises (double_weight, force, mechanic). Permission rules walk through the `exercise` relationship.

| Role | Action | Columns | Filter / Check | Enforces |
|---|---|---|---|---|
| `user` | `select` | `exercise_id`, `kind`, `double_weight`, `force`, `mechanic`, `created_at`, `updated_at` | filter: `exercise._or [user_id eq self, is_public eq true]` | A user sees the strength sidecar for any exercise they can see (public or their own). |
| `user` | `insert` | `exercise_id`, `double_weight`, `force`, `mechanic` | check: `exercise._and [user_id eq self, is_public eq false]` | A user can only attach a strength sidecar to their own private exercise. Attaching a strength sidecar to a cardio exercise is rejected at the DB level — the composite FK on `(exercise_id, kind) → exercises(id, kind)` combined with `DEFAULT 'strength' CHECK (kind = 'strength')` makes it an FK violation, not a permission failure. |
| `user` | `update` | `double_weight`, `force`, `mechanic` | filter & check: `exercise._and [user_id eq self, is_public eq false]` | A user can only edit the strength sidecar of their own private exercise. |

### `exercises_cardio` — pattern **C (inherited from exercise)**

Per-kind catalog metadata for cardio exercises (the per-exercise JSON Schema in `metrics_schema`). Same shape as strength.

| Role | Action | Columns | Filter / Check | Enforces |
|---|---|---|---|---|
| `user` | `select` | `exercise_id`, `kind`, `metrics_schema`, `created_at`, `updated_at` | filter: `exercise._or [user_id eq self, is_public eq true]` | A user sees the cardio sidecar (and so its metrics schema) for any exercise they can see. |
| `user` | `insert` | `exercise_id`, `metrics_schema` | check: `exercise._and [user_id eq self, is_public eq false]` | A user can only attach a cardio sidecar to their own private exercise. Attaching a cardio sidecar to a strength exercise is rejected at the DB level — the composite FK on `(exercise_id, kind) → exercises(id, kind)` combined with `DEFAULT 'cardio' CHECK (kind = 'cardio')` makes it an FK violation, not a permission failure. |
| `user` | `update` | `metrics_schema` | filter & check: `exercise._and [user_id eq self, is_public eq false]` | A user can only edit the cardio sidecar of their own private exercise. |

Note: neither sidecar has a `delete_permissions` block for the `user` role. Standalone sidecar deletes would orphan the parent exercise — the `<sidecar>_no_orphan_parent` `DEFERRABLE INITIALLY DEFERRED` constraint trigger ([`database.md`](database.md), `Triggers` section) raises `23503` at commit if the parent exercise still exists. The intended lifecycle is `DELETE FROM exercises`, whose `ON DELETE CASCADE` removes parent and sidecar atomically. `backend/tests/kind-enforcement.test.ts` asserts that `deleteExerciseStrength` and `deleteExerciseCardio` return `validation-failed` for the user role.

## Workouts (templates)

Workouts are reusable exercise lists. They follow the owner-or-public catalog pattern: a user owns private workouts and can browse the public ones.

### `workouts` — pattern **B (owner-or-public catalog)**

| Role | Action | Columns | Filter / Check | Enforces |
|---|---|---|---|---|
| `user` | `select` | `id`, `name`, `description`, `user_id`, `is_public`, `created_at`, `updated_at` | filter: `_or [user_id eq self, is_public eq true]` | A user sees their own workouts plus the public template library. |
| `user` | `insert` | `name`, `description` | check: `_and [user_id eq self, is_public eq false]`; `set: user_id = self` | A user can create private workouts only. `user_id` is forced to self. The user cannot flip `is_public`. |
| `user` | `update` | `name`, `description` | filter & check: `_and [user_id eq self, is_public eq false]` | Edit only your own private workouts. |
| `user` | `delete` | — | filter: `_and [user_id eq self, is_public eq false]` | Delete only your own private workouts. |

### `workout_exercises` — pattern **C (inherited from workout)**

The ordered list of exercises within a workout. Ownership is inherited from the parent workout.

| Role | Action | Columns | Filter / Check | Enforces |
|---|---|---|---|---|
| `user` | `select` | `id`, `workout_id`, `exercise_id`, `kind`, `position`, `created_at`, `updated_at` | filter: `workout._or [user_id eq self, is_public eq true]` | A user sees the exercise list of any workout they can see (public or their own). |
| `user` | `insert` | `workout_id`, `exercise_id`, `position` | check: `workout._and [user_id eq self, is_public eq false]` | A user can add an exercise only to one of their private workouts. `kind` is not in the column allowlist — it's populated by a `BEFORE INSERT` trigger from the parent exercise. |
| `user` | `update` | `position` | filter & check: `workout._and [user_id eq self, is_public eq false]` | A user can only reorder exercises in their private workouts. Replacing `exercise_id` is intentionally not allowed (would change `kind` semantics) — delete and re-insert instead. |
| `user` | `delete` | — | filter: `workout._and [user_id eq self, is_public eq false]` | Remove exercises only from your own private workouts. |

## Sessions (logged workouts)

A workout session is one occurrence of working out — typically backed by a workout template, but can be ad-hoc (`workout_id` null). See [`sessions.md`](sessions.md) for invariants; this section covers who can do what.

### `workout_sessions` — pattern **A (private per-user)** with a parent-template check

| Role | Action | Columns | Filter / Check | Enforces |
|---|---|---|---|---|
| `user` | `select` | `id`, `workout_id`, `user_id`, `started_at`, `created_at`, `updated_at` | filter: `user_id eq self` | A user only sees their own sessions. Sessions are always private — there's no `is_public`. |
| `user` | `insert` | `workout_id`, `started_at` | check: `_and [user_id eq self, _or [workout_id is null, workout._or [user_id eq self, is_public eq true]]]`; `set: user_id = self` | A user can start a session backed by any workout they can see (their own or public), or an ad-hoc session with `workout_id` null. They cannot link to another user's private workout. `user_id` is forced to self. |
| `user` | `update` | `workout_id`, `started_at` | filter: `user_id eq self`; check: same as insert | Same templating rule applies after the fact: a user can re-link an existing session to any workout they're allowed to see, including null. They can't reassign to someone else's private workout. |
| `user` | `delete` | — | filter: `user_id eq self` | Delete only your own sessions. Cascade rules (defined at the SQL level) drop child WSEs, sets, and entries. |

### `workout_session_exercises` — pattern **C (inherited from session)**

The ordered list of exercises performed in a session.

| Role | Action | Columns | Filter / Check | Enforces |
|---|---|---|---|---|
| `user` | `select` | `id`, `workout_session_id`, `exercise_id`, `kind`, `position`, `created_at`, `updated_at` | filter: `workoutSession.user_id eq self` | A user sees only the WSEs of sessions they own. |
| `user` | `insert` | `workout_session_id`, `exercise_id`, `position` | check: `workoutSession.user_id eq self` | A user can attach an exercise only to one of their own sessions. `kind` is **deliberately excluded** — it's populated by a `BEFORE INSERT` trigger from the parent exercise's kind (a client attempt to send `kind` is rejected by GraphQL validation, see `kind-enforcement.test.ts`). |
| `user` | `update` | `position` | filter & check: `workoutSession.user_id eq self` | A user can reorder exercises in their sessions. Replacing `exercise_id` would change `kind` and is intentionally not allowed. |
| `user` | `delete` | — | filter: `workoutSession.user_id eq self` | Remove an exercise from your own session. Cascade drops the child strength sets / cardio entries. |

### `workout_session_strength_sets` — pattern **C (inherited from session via WSE)**

One row per logged set in a strength exercise. The composite FK on `(workout_session_exercise_id, parent_kind='strength')` ensures the parent WSE is a strength one; permissions ensure the WSE belongs to the calling user.

| Role | Action | Columns | Filter / Check | Enforces |
|---|---|---|---|---|
| `user` | `select` | `id`, `workout_session_exercise_id`, `set_number`, `reps`, `weight`, `created_at`, `updated_at` | filter: `workoutSessionExercise.workoutSession.user_id eq self` | A user sees only the sets in their own sessions. |
| `user` | `insert` | `workout_session_exercise_id`, `set_number`, `reps`, `weight` | check: `workoutSessionExercise.workoutSession.user_id eq self` | A user can log a strength set only against a WSE in their own session. `parent_kind` is **deliberately excluded** — the column defaults to `'strength'` and is pinned by a CHECK. Without that column in the allowlist, the composite-FK enforcement of the kind discriminator can't be bypassed at the GraphQL layer. |
| `user` | `update` | `set_number`, `reps`, `weight` | filter & check: `workoutSessionExercise.workoutSession.user_id eq self` | A user can correct a set they logged. They cannot reparent (`workout_session_exercise_id` isn't updatable). |
| `user` | `delete` | — | filter: `workoutSessionExercise.workoutSession.user_id eq self` | Delete a set from your own session. |

### `workout_session_cardio_entries` — pattern **C (inherited from session via WSE)**

One row per logged metric entry in a cardio exercise (jsonb `metrics` shape is validated by a trigger against the per-exercise schema in `exercises_cardio.metrics_schema`). Mirror of strength sets.

| Role | Action | Columns | Filter / Check | Enforces |
|---|---|---|---|---|
| `user` | `select` | `id`, `workout_session_exercise_id`, `entry_number`, `metrics`, `created_at`, `updated_at` | filter: `workoutSessionExercise.workoutSession.user_id eq self` | A user sees only their own cardio entries. |
| `user` | `insert` | `workout_session_exercise_id`, `entry_number`, `metrics` | check: `workoutSessionExercise.workoutSession.user_id eq self` | A user can log a cardio entry only against a WSE in their own session. `parent_kind` is excluded for the same reason as strength sets — the CHECK + DEFAULT pin it to `'cardio'`. The trigger validates `metrics` against the parent exercise's JSON Schema. |
| `user` | `update` | `entry_number`, `metrics` | filter & check: `workoutSessionExercise.workoutSession.user_id eq self` | A user can correct an entry they logged. |
| `user` | `delete` | — | filter: `workoutSessionExercise.workoutSession.user_id eq self` | Delete an entry from your own session. |

## Labels (workouts + journal)

### `labels` — pattern **B (owner-or-public catalog)**

Generic labels that can be attached to workouts. A user owns private labels and sees public ones.

| Role | Action | Columns | Filter / Check | Enforces |
|---|---|---|---|---|
| `user` | `select` | `id`, `name`, `user_id`, `is_public`, `created_at`, `updated_at` | filter: `_or [user_id eq self, is_public eq true]` | A user sees their own labels plus public ones. |
| `user` | `insert` | `name` | check: `_and [user_id eq self, is_public eq false]`; `set: user_id = self` | A user can create private labels only. |
| `user` | `update` | `name` | filter: `user_id eq self`; check: `null` | A user can rename their own labels (regardless of `is_public`). The asymmetry with insert (`is_public eq false`) is intentional — a user can rename a label that an admin has since promoted to public, as long as they're the original owner. The `check: null` makes the update fully governed by `filter`. |
| `user` | `delete` | — | filter: `user_id eq self` | Delete only your own labels (no `is_public` clause — same intent as update). |

### `workout_labels` — pattern **C (junction via workout + label)**

Many-to-many between workouts and labels.

| Role | Action | Columns | Filter / Check | Enforces |
|---|---|---|---|---|
| `user` | `select` | `workout_id`, `label_id`, `created_at` | filter: `workout._or [user_id eq self, is_public eq true]` | A user sees the labels of any workout they can see. The filter walks through the parent workout, not the label — a user-owned label attached to a workout they can't see is still hidden. |
| `user` | `insert` | `workout_id`, `label_id` | check: `_and [workout._and [user_id eq self, is_public eq false], label._or [user_id eq self, is_public eq true]]` | A user can attach a label to their own private workout. The label can be one they own or a public one — but it must be **a label they can see**. |
| `user` | `delete` | — | filter: `workout._and [user_id eq self, is_public eq false]` | A user can detach a label only from their own private workouts. No update permission — junction rows are immutable; remove + re-add. |

### `journal_labels` — pattern **A (private per-user)**

Personal labels that can be attached to journal entries. Unlike `labels`, journal labels are always private — there's no `is_public` column.

| Role | Action | Columns | Filter / Check | Enforces |
|---|---|---|---|---|
| `user` | `select` | `id`, `name`, `user_id`, `created_at`, `updated_at` | filter: `user_id eq self` | A user sees only their own journal labels. |
| `user` | `insert` | `name` | check: `user_id eq self`; `set: user_id = self` | A user can create journal labels only for themselves. |
| `user` | `update` | `name` | filter: `user_id eq self`; check: `null` | Rename your own labels. |
| `user` | `delete` | — | filter: `user_id eq self` | Delete your own labels. |

### `journal_entry_labels` — pattern **C (junction)**

Many-to-many between journal entries and journal labels. Both sides must belong to the calling user — there's no public side here.

| Role | Action | Columns | Filter / Check | Enforces |
|---|---|---|---|---|
| `user` | `select` | `journal_entry_id`, `label_id`, `created_at` | filter: `journalEntry.user_id eq self` | A user sees only their own attachments. |
| `user` | `insert` | `journal_entry_id`, `label_id` | check: `_and [journalEntry.user_id eq self, label.user_id eq self]` | Both the entry and the label must belong to the calling user — no cross-user attachments, ever. |
| `user` | `delete` | — | filter: `journalEntry.user_id eq self` | Detach from your own entries. No update permission. |

## Journal

### `journal_entries` — pattern **A (private per-user)**

The user's personal notes. Always private.

| Role | Action | Columns | Filter / Check | Enforces |
|---|---|---|---|---|
| `user` | `select` | `id`, `user_id`, `entry_date`, `title`, `body`, `created_at`, `updated_at` | filter: `user_id eq self` | A user sees only their own entries. |
| `user` | `insert` | `entry_date`, `title`, `body` | check: `user_id eq self`; `set: user_id = self` | A user can create entries only for themselves. `user_id` is forced to self. |
| `user` | `update` | `entry_date`, `title`, `body` | filter: `user_id eq self`; check: `null` | Edit your own entries. |
| `user` | `delete` | — | filter: `user_id eq self` | Delete your own entries. |

## Body measurements

### `body_measurements` — pattern **A (private per-user)**

Weight / body fat / notes per measurement date. Always private.

| Role | Action | Columns | Filter / Check | Enforces |
|---|---|---|---|---|
| `user` | `select` | `id`, `user_id`, `measured_on`, `weight_kg`, `body_fat_pct`, `notes`, `created_at`, `updated_at` | filter: `user_id eq self` | A user sees only their own measurements. |
| `user` | `insert` | `measured_on`, `weight_kg`, `body_fat_pct`, `notes` | check: `user_id eq self`; `set: user_id = self` | A user can log measurements only for themselves. |
| `user` | `update` | `measured_on`, `weight_kg`, `body_fat_pct`, `notes` | filter: `user_id eq self`; check: `null` | Edit your own measurements. |
| `user` | `delete` | — | filter: `user_id eq self` | Delete your own measurements. |

## Nutrition

See [`nutrition.md`](nutrition.md) for model details. These permissions expose the full backend nutrition contract while keeping all user-owned rows private.

### `foods` — pattern **B (owner-or-public catalog)**

| Role | Action | Columns | Filter / Check | Enforces |
|---|---|---|---|---|
| `user` | `select` | `id`, `name`, `user_id`, `is_public`, `kcal_per_100g`, `fat_per_100g`, `carbs_per_100g`, `protein_per_100g`, `fiber_per_100g`, `sugar_per_100g`, timestamps | filter: `_or [user_id eq self, is_public eq true]` | Users see public foods plus their private foods. |
| `user` | `insert` | `name` and nutrient columns | check: `_and [user_id eq self, is_public eq false]`; `set: user_id = self` | Users create private foods only; they cannot set `is_public`. |
| `user` | `update` | `name` and nutrient columns | filter & check: `_and [user_id eq self, is_public eq false]` | Users edit only their private foods. |
| `user` | `delete` | — | filter: `_and [user_id eq self, is_public eq false]` | Users delete only their private foods. Deletion can still be blocked by `meal_ingredients.food_id ON DELETE RESTRICT`. |

### `meals`, `nutrition_plans`, `nutrition_days` — pattern **A (private per-user)**

`meals` and `nutrition_plans` allow users to select/insert/update/delete only their rows. Insert uses `set: user_id = X-Hasura-User-Id`; update/delete filters are `user_id eq self`.

`nutrition_days` is also private per-user, with `log_date` and nullable `nutrition_plan_id` exposed for insert/update. Its check is `_and [user_id eq self, _or [nutrition_plan_id is null, nutritionPlan.user_id eq self]]`, so a day can be ad-hoc or linked only to one of the user's own plan templates. Delete is `user_id eq self` and cascades log groups/entries at the database layer.

### `meal_ingredients` — pattern **C (owned meal + visible food)**

| Action | Columns | Filter / Check | Enforces |
|---|---|---|---|
| `select` | `id`, `meal_id`, `food_id`, `grams`, `position`, timestamps | `meal.user_id eq self` | Users read ingredients only in their meals. |
| `insert` | `meal_id`, `food_id`, `grams`, `position` | `_and [meal.user_id eq self, food._or [user_id eq self, is_public eq true]]` | Ingredients can reference only an owned meal and a visible food. |
| `update` | `grams`, `position` | filter & check: `meal.user_id eq self` | Changing `food_id` is not allowed; delete+insert instead. |
| `delete` | — | `meal.user_id eq self` | Remove ingredients only from owned meals. |

### `nutrition_plan_meals` — pattern **C (owned plan + owned meal)**

Select/update/delete walk `nutritionPlan.user_id eq self`. Insert checks both `nutritionPlan.user_id eq self` and `meal.user_id eq self`. Users may update only `slot_time`, `label`, and `position`; changing the source meal is delete+insert.

### `nutrition_log_meals` — pattern **C (owned day, nullable provenance)**

Select/update/delete walk `nutritionDay.user_id eq self`. Insert checks the owned day and uses explicit nullable branches for provenance: `_or [meal_id is null, meal.user_id eq self]` and `_or [nutrition_plan_meal_id is null, nutritionPlanMeal.nutritionPlan.user_id eq self]`. Users may insert/update `name`, `slot_time`, and `position`; `slot_time` is the actual logged time-of-day chosen in the UI, not necessarily the source plan slot time. Users cannot reparent a logged group after insert.

### `nutrition_log_entries` — pattern **C (owned day + visible food + optional same-day group)**

Select/delete walk `nutritionDay.user_id eq self`. Insert checks the owned day, visible food (`food._or [user_id eq self, is_public eq true]`), and an explicit nullable group branch (`_or [nutrition_log_meal_id is null, nutritionLogMeal.nutritionDay.user_id eq self]`). The database composite FK additionally rejects a group/day mismatch. Users can insert/update `slot_time` for standalone logged-food time and can update only `grams`, `position`, and `slot_time`; `food_id` and all `snapshot_*` columns are not user-writable. Snapshot columns are selectable so clients can compute historical totals.

## Storage

### `storage.files`

Nhost stores uploaded files in S3-compatible buckets (currently just `exercise_images`). This is the only table where the `public` role appears — so an unauthenticated visitor can `GET` an exercise image by URL without signing in. Writes are admin-only (uploads happen through the Nhost Storage API, not the GraphQL API).

| Role | Action | Columns | Filter | Enforces |
|---|---|---|---|---|
| `public` | `select` | `id`, `name`, `size`, `bucket_id`, `etag`, `created_at`, `updated_at`, `is_uploaded`, `mime_type`, `uploaded_by_user_id`, `metadata` | filter: `bucket_id eq exercise_images` | Public catalog images are visible to unauthenticated visitors (so the marketing/landing flow works, and the app doesn't have to forge auth headers for image `<img src>`). Files in any other bucket are hidden from public. |
| `user` | `select` | Same as public | filter: `bucket_id eq exercise_images` | Authenticated users can also read exercise images. (There are no other buckets in use today; if a private-uploads bucket is added, a separate user-scoped row-filter goes here.) |

No insert / update / delete permissions for the user role: file lifecycle goes through Nhost Storage's REST endpoints, which apply their own bucket-scoped rules. The `auth.*` and `storage.buckets` / `storage.virus` tables have no user-role permissions at all — they're managed by Nhost.

## What `user` role is *not* allowed to touch

A few intentional omissions worth calling out — these are the columns and tables the user role cannot reach via GraphQL:

- **`exercises.is_public`, `exercises.slug`, `exercises.user_id`** — not in the user-role insert/update column allowlist. `user_id` is set by `insert.set`; the others are admin-only fields.
- **`exercises.kind`** — generated, not insertable on any role.
- **`workout_exercises.kind` and `workout_session_exercises.kind`** — not insertable to the user role. The kind-sync `BEFORE INSERT` trigger populates them from the parent exercise. If `kind` were in the user-role allowlist, the security boundary would rest on the trigger alone; excluding it makes the GraphQL validator reject the field outright (see the `validation-failed` assertion in `backend/tests/kind-enforcement.test.ts`).
- **`workout_session_strength_sets.parent_kind` and `workout_session_cardio_entries.parent_kind`** — same reasoning. Excluded from the user-role allowlist so the discriminator is structural, not client-controlled. CHECK + DEFAULT pin them server-side.
- **`workouts.is_public` and `labels.is_public`** — not in the user-role insert/update allowlist for the same reason: only admins can promote private rows to the public catalog.
- **All `auth.*` and `storage.buckets` / `storage.virus` tables** — admin-only. Managed by Nhost; do not edit those YAMLs unless you know what you're touching.

## Where to verify these claims

- `backend/tests/kind-enforcement.test.ts` has an end-to-end `user-role permissions` describe block that exercises the cross-user negative cases (cardio entry insert into another user's session → `permission-error`, foreign select → empty rows, `kind` field rejected by GraphQL validator, etc.). Add to it when you change any of the rules above.
- The Hasura console (admin-secret access) is the fastest way to inspect a single permission interactively. Open the table, switch the role dropdown, and the rule pretty-prints.
- For ad-hoc verification from the terminal, send a request through `gqlAsUser(userId, query, vars)` in the test file — that helper sets `x-hasura-admin-secret` + `x-hasura-role: user` + `x-hasura-user-id` so you can impersonate any uuid.

## Keeping this doc honest

When you edit a YAML in `backend/nhost/metadata/databases/default/tables/`, update the corresponding section here in the same commit. The CLAUDE.md doc-sync rule applies to this file too: stale claims here are worse than no claims, because future readers will rely on them.
