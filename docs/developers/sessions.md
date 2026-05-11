# Sessions

A **session** (`workout_sessions`) is the record of one workout you actually did — a timestamped container with an ordered list of exercises, and per-exercise entries (sets for strength, metric entries for cardio). Sessions belong to a user; there is no public/shared session concept.

This document is the source of truth for how the session data model behaves. If something here disagrees with the schema or the migrations, the schema wins — please open a PR to fix the doc.

## Data model

```
workouts (template, optional)
  └─ workout_exercises (ordered list, template only; kind synced from parent exercise)

workout_sessions  ◄── workout_id is NULLABLE (ad-hoc) or → workouts.id
  └─ workout_session_exercises (ordered list, owned by the session; kind synced from parent exercise)
       │
       │  composite FKs on (workout_session_exercise_id, parent_kind) enforce
       │  the strength/cardio split — see exercises.md for the full pattern.
       │
       ├─ workout_session_strength_sets   (parent_kind = 'strength' — set_number, reps, weight)
       └─ workout_session_cardio_entries  (parent_kind = 'cardio'   — entry_number, metrics jsonb)
```

Key files:
- Tables: `backend/nhost/migrations/default/1746230400000_init/up.sql` (sessions, strength sets — originally named `workout_session_sets`), `1790000420000_workout_session_cardio_entries/up.sql` (cardio entries), `1790000425000_workout_session_sets_parent_kind/up.sql` (strength-side composite FK), `1790000450000_rename_workout_session_strength_sets/up.sql` (renames `workout_session_sets` → `workout_session_strength_sets`).
- `kind` discriminator and trigger on `workout_*_exercises`: `1790000415000_exercises_kind_composite/up.sql`.
- Nullable `workout_id`: `1790000430000_workout_sessions_nullable_workout/up.sql`.
- Hasura permissions: `backend/nhost/metadata/databases/default/tables/public_workout_sessions.yaml` and `public_workout_session_*.yaml`.
- Frontend creation: `frontend/src/lib/hooks/use-start-session.ts`.
- Display name resolution: `frontend/src/lib/sessions.ts` (`sessionDisplayName`).

## The two ways to start a session

Sessions can be started in two shapes. The same `insertWorkoutSession` mutation handles both — it's just whether `workout_id` is set.

### 1. From a workout (templated)

The user picks a workout on `/workouts/$workoutId` and taps **Start session**. `useStartSession` is called with `{ workoutId, exercises: [{exerciseId, position}, ...] }` (the caller copies the workout's `workout_exercises` into `workoutSessionExercises.data` via a nested insert).

```ts
startSession.mutate({
  workoutId: workout.id,
  exercises: workout.workoutExercises.map((we) => ({
    exerciseId: we.exercise.id,
    position: we.position,
  })),
});
```

The mutation inserts the `workout_sessions` row **and** seeds the session's exercise list in a single round-trip via Hasura's nested `workoutSessionExercises: { data: [...] }`. The `kind` column on each `workout_session_exercise` is auto-populated by the `sync_public_workout_session_exercises_kind` trigger — the frontend doesn't pass it.

### 2. Ad-hoc (no workout)

The user opens an exercise on `/exercises/$exerciseId` (or any cardio detail page) and taps **Start session**. `useStartSession` is called with `{ exerciseId }`:

```ts
startSession.mutate({ exerciseId: exercise.id });
```

This produces a session with `workout_id = NULL` and a single `workout_session_exercise` at `position: 0` for that exercise. The user can then add more exercises from the session detail page.

In both cases, `useStartSession` navigates to `/sessions/$sessionId` with `replace: true` so back-navigation lands on the originating workout/exercise page, not on a now-spent intermediate state.

## The workout link is a template, not a contract

**The most important invariant to internalize:** once a session exists, its `workout_id` is a *historical link*. Nothing in Postgres or Hasura enforces that the session's exercises match the workout's exercises. There is no foreign key from `workout_session_exercises` to `workout_exercises`.

Concretely:

- A session can be created from workout X, then the user can add, remove, or reorder exercises on that session without ever touching workout X.
- A session can be created from workout X, then workout X can be edited (or deleted — cascade deletes the link, see below).
- A session's `workout_id` can be `UPDATE`d after the fact (the user role has `workout_id` in the `update_permissions.columns` list).
- An ad-hoc session can later be assigned a `workout_id`, or a templated session can be detached by setting `workout_id = NULL` — both are permitted.

The workout reference is therefore best thought of as a label/seed, used by the UI to:

- Pre-fill the exercise list at session creation.
- Render the workout's name on `/sessions` and `/sessions/$sessionId` (via `sessionDisplayName()`).
- Show a "session of X" attribution in exercise history.

It is **not** used to validate the session's contents, suggest sets/reps, or constrain edits.

### What happens if the workout is deleted

`workout_sessions.workout_id` has `ON DELETE CASCADE` referencing `workouts.id`. The column is nullable, but the FK action is still `CASCADE`. **Deleting a workout deletes every session that was created from it.** This is a sharp edge — if the product ever needs to preserve session history across workout deletion, the FK action needs to become `ON DELETE SET NULL`, which is now viable since the column is nullable.

Until that changes, treat workout deletion as destructive of session history. The UI does not currently warn about this.

## Hasura permissions

`workout_sessions` (`public_workout_sessions.yaml`):

- **Insert:** `user_id = X-Hasura-User-Id` AND (`workout_id IS NULL` OR `workout.user_id = X-Hasura-User-Id` OR `workout.is_public = true`). `user_id` is auto-set via `set:`.
- **Select / Update / Delete:** scoped to `user_id = X-Hasura-User-Id`. Update additionally enforces the same `workout_id` rule on the new value, so a user cannot reassign their session to someone else's private workout.

`workout_session_exercises`, `workout_session_sets`, and `workout_session_cardio_entries`: scope all CRUD to the owning user via the `workoutSession.user_id = X-Hasura-User-Id` filter (transitively through relationships). This means the FK chain `entry → workout_session_exercise → workout_session → user` is the security boundary — there's no separate `user_id` column on the children.

The user-role insert permission columns deliberately exclude the discriminator columns (`workout_session_exercises.kind`, `workout_session_strength_sets.parent_kind`, `workout_session_cardio_entries.parent_kind`): on session-exercises a trigger populates `kind` from the parent exercise, and on children the CHECK + DEFAULT keep `parent_kind` pinned to the right value. Clients pass `exercise_id` (and `workout_session_exercise_id` for children) and the discriminator falls out structurally.

## Strength vs cardio at the session-exercise level

`workout_session_exercises.kind` is the binary discriminator (`'strength' | 'cardio'`), auto-synced from `exercises.kind` by a trigger. The UI branches on it directly:

- `exercise.kind === 'cardio'` → render the `CardioExerciseLog` row (uses `workout_session_cardio_entries`, reading the per-exercise schema from `exercise.cardio.metricsSchema`).
- Otherwise → render the strength `ExerciseLog` row (uses `workout_session_strength_sets`, reading `exercise.strength?.doubleWeight` for the per-side multiplier).

This branch is in `frontend/src/routes/_authed/sessions/$sessionId.tsx`'s `ExerciseRow` component. **The database enforces the split symmetrically** via composite FKs to `workout_session_exercises(id, kind)` — strength sets can only attach to strength session-exercises, cardio entries can only attach to cardio ones. Inserting a `workout_session_set` against a cardio session-exercise is an FK violation (`23503`), not a permission error and not a runtime check. See `exercises.md` → "How the strength/cardio split is enforced structurally" for the full pattern.

### Why `workout_session_exercises.exercise_id` is immutable for the user role

The `update_permissions.columns` list for the `user` role on `workout_session_exercises` is just `position` — `exercise_id` is **not** updatable. Inserts and deletes are allowed; reordering is allowed; re-pointing an existing row at a different exercise is not.

This closes a kind-mismatch loophole. If `exercise_id` were updatable, swapping it would change `kind` (the sync trigger fires on `UPDATE OF exercise_id`), but the children (sets/cardio entries) attached to that session-exercise would still have their old `parent_kind`. The composite FK would then fail the update — not silently bad, but a confusing error path. By keeping `exercise_id` immutable for users, the only way to switch which exercise a row points at is delete + insert, which cascades to the children. This matches the Add/Remove UX in `/sessions/$sessionId`.

## Display names

Sessions don't carry a name field. The label shown in the UI is computed by `sessionDisplayName()`:

1. If `workout.name` is set → use it.
2. Else if any exercises are attached → first exercise's name (+ `"+N more"` if more than one).
3. Else → `"Untitled session"`.

This means ad-hoc sessions get a sensible label without storing one, and templated sessions follow the workout name even if the user later renames the workout.

## Editing a session

The session detail page supports:

- Updating `started_at` (free-form datetime edit).
- Adding/removing `workout_session_exercises`.
- Adding/updating/removing `workout_session_strength_sets` (strength).
- Adding/updating/removing `workout_session_cardio_entries` (cardio).
- Deleting the entire session.

Reordering `workout_session_exercises` is not currently exposed in the UI but is permitted by the schema (`position` is updatable and the `(workout_session_id, position)` uniqueness is `DEFERRABLE INITIALLY DEFERRED`). `position` is the **only** column the user role can update on `workout_session_exercises` — `exercise_id` is immutable post-insert (see "Why `workout_session_exercises.exercise_id` is immutable for the user role" above). To change which exercise a row points at, delete it and add a new one.
