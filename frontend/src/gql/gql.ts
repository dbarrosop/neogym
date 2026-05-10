/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  query BreadcrumbWorkout($id: uuid!) {\n    workout(id: $id) {\n      id\n      name\n    }\n  }\n": typeof types.BreadcrumbWorkoutDocument,
    "\n  query BreadcrumbExercise($id: uuid!) {\n    exercise(id: $id) {\n      id\n      name\n    }\n  }\n": typeof types.BreadcrumbExerciseDocument,
    "\n  query BreadcrumbSession($id: uuid!) {\n    workoutSession(id: $id) {\n      id\n      startedAt\n      workout {\n        id\n        name\n      }\n    }\n  }\n": typeof types.BreadcrumbSessionDocument,
    "\n  query BreadcrumbBodyMeasurement($id: uuid!) {\n    bodyMeasurement(id: $id) {\n      id\n      measuredOn\n    }\n  }\n": typeof types.BreadcrumbBodyMeasurementDocument,
    "\n  query BreadcrumbJournalEntry($id: uuid!) {\n    journalEntry(id: $id) {\n      id\n      entryDate\n      title\n    }\n  }\n": typeof types.BreadcrumbJournalEntryDocument,
    "\n  query ExerciseDetail($id: uuid!) {\n    exercise(id: $id) {\n      id\n      name\n      instructions\n      image1FileId\n      image2FileId\n      doubleWeight\n      level\n      category\n      equipment\n      force\n      mechanic\n      primaryMuscleGroup\n      secondaryMuscleGroups {\n        muscleGroup\n      }\n      workoutSessionExercises {\n        id\n        workoutSession {\n          id\n          startedAt\n          workout {\n            id\n            name\n          }\n        }\n        workoutSessionSets(order_by: { setNumber: asc }) {\n          id\n          setNumber\n          reps\n          weight\n        }\n      }\n    }\n  }\n": typeof types.ExerciseDetailDocument,
    "\n  query ExercisePickerExercises {\n    exercises(order_by: { name: asc }) {\n      id\n      name\n      primaryMuscleGroup\n      doubleWeight\n    }\n  }\n": typeof types.ExercisePickerExercisesDocument,
    "\n  query BodyMeasurementById($id: uuid!) {\n    bodyMeasurement(id: $id) {\n      id\n      measuredOn\n      weightKg\n      bodyFatPct\n      notes\n      updatedAt\n    }\n  }\n": typeof types.BodyMeasurementByIdDocument,
    "\n  query EditBodyMeasurement($id: uuid!) {\n    bodyMeasurement(id: $id) {\n      id\n      measuredOn\n      weightKg\n      bodyFatPct\n      notes\n    }\n  }\n": typeof types.EditBodyMeasurementDocument,
    "\n  mutation UpdateBodyMeasurement($id: uuid!, $set: bodyMeasurements_set_input!) {\n    updateBodyMeasurement(pk_columns: { id: $id }, _set: $set) {\n      id\n    }\n  }\n": typeof types.UpdateBodyMeasurementDocument,
    "\n  mutation DeleteBodyMeasurement($id: uuid!) {\n    deleteBodyMeasurement(id: $id) {\n      id\n    }\n  }\n": typeof types.DeleteBodyMeasurementDocument,
    "\n  query BodyMeasurements {\n    bodyMeasurements(order_by: { measuredOn: desc }) {\n      id\n      measuredOn\n      weightKg\n      bodyFatPct\n      notes\n    }\n  }\n": typeof types.BodyMeasurementsDocument,
    "\n  mutation InsertBodyMeasurement($obj: bodyMeasurements_insert_input!) {\n    insertBodyMeasurement(object: $obj) {\n      id\n    }\n  }\n": typeof types.InsertBodyMeasurementDocument,
    "\n  query ExercisesIndex {\n    exercises(order_by: { name: asc }) {\n      id\n      name\n      doubleWeight\n      primaryMuscleGroup\n      category\n      equipment\n      level\n      isPublic\n      secondaryMuscleGroups {\n        muscleGroup\n      }\n    }\n  }\n": typeof types.ExercisesIndexDocument,
    "\n  query JournalEntryById($id: uuid!) {\n    journalEntry(id: $id) {\n      id\n      entryDate\n      title\n      body\n      journalEntryLabels {\n        labelId\n        label {\n          id\n          name\n        }\n      }\n    }\n  }\n": typeof types.JournalEntryByIdDocument,
    "\n  query EditJournalEntry($id: uuid!) {\n    journalEntry(id: $id) {\n      id\n      entryDate\n      title\n      body\n      journalEntryLabels {\n        labelId\n        label {\n          id\n          name\n        }\n      }\n    }\n    journalLabels(order_by: { name: asc }) {\n      id\n      name\n    }\n  }\n": typeof types.EditJournalEntryDocument,
    "\n  mutation SaveJournalEntry(\n    $id: uuid!\n    $set: journalEntries_set_input!\n    $deleteLabelIds: [uuid!]!\n    $insertLabels: [journalEntryLabels_insert_input!]!\n  ) {\n    updateJournalEntry(pk_columns: { id: $id }, _set: $set) {\n      id\n    }\n    deleteJournalEntryLabels(\n      where: { journalEntryId: { _eq: $id }, labelId: { _in: $deleteLabelIds } }\n    ) {\n      affected_rows\n    }\n    insertJournalEntryLabels(\n      objects: $insertLabels\n      on_conflict: { constraint: journal_entry_labels_pkey, update_columns: [] }\n    ) {\n      affected_rows\n    }\n  }\n": typeof types.SaveJournalEntryDocument,
    "\n  mutation DeleteJournalEntry($id: uuid!) {\n    deleteJournalEntry(id: $id) {\n      id\n    }\n  }\n": typeof types.DeleteJournalEntryDocument,
    "\n  query JournalEntries($limit: Int!, $offset: Int!, $where: journalEntries_bool_exp) {\n    journalEntries(\n      where: $where\n      order_by: [{ entryDate: desc }, { createdAt: desc }]\n      limit: $limit\n      offset: $offset\n    ) {\n      id\n      entryDate\n      title\n      body\n      journalEntryLabels {\n        labelId\n        label {\n          id\n          name\n        }\n      }\n    }\n  }\n": typeof types.JournalEntriesDocument,
    "\n  query JournalLabelsFilter {\n    journalLabels(order_by: { name: asc }) {\n      id\n      name\n    }\n  }\n": typeof types.JournalLabelsFilterDocument,
    "\n  query JournalLabelsForForm {\n    journalLabels(order_by: { name: asc }) {\n      id\n      name\n    }\n  }\n": typeof types.JournalLabelsForFormDocument,
    "\n  mutation InsertJournalEntry($obj: journalEntries_insert_input!) {\n    insertJournalEntry(object: $obj) {\n      id\n    }\n  }\n": typeof types.InsertJournalEntryDocument,
    "\n  query SessionDetail($id: uuid!) {\n    workoutSession(id: $id) {\n      id\n      startedAt\n      workout {\n        id\n        name\n      }\n      workoutSessionExercises(order_by: { position: asc }) {\n        id\n        position\n        exercise {\n          id\n          name\n          doubleWeight\n          primaryMuscleGroup\n          image1FileId\n          image2FileId\n        }\n        workoutSessionSets(order_by: { setNumber: asc }) {\n          id\n          setNumber\n          reps\n          weight\n        }\n      }\n    }\n  }\n": typeof types.SessionDetailDocument,
    "\n  query PriorSessionsPerExercise($exerciseIds: [uuid!]!, $excludeSessionId: uuid!) {\n    exercises(where: { id: { _in: $exerciseIds } }) {\n      id\n      workoutSessionExercises(\n        limit: 3\n        order_by: { workoutSession: { startedAt: desc } }\n        where: { workoutSessionId: { _neq: $excludeSessionId } }\n      ) {\n        id\n        workoutSession {\n          id\n          startedAt\n        }\n        workoutSessionSets(order_by: { setNumber: asc }) {\n          id\n          setNumber\n          reps\n          weight\n        }\n      }\n    }\n  }\n": typeof types.PriorSessionsPerExerciseDocument,
    "\n  mutation InsertWorkoutSessionSet($obj: workoutSessionSets_insert_input!) {\n    insertWorkoutSessionSet(object: $obj) {\n      id\n    }\n  }\n": typeof types.InsertWorkoutSessionSetDocument,
    "\n  mutation UpdateWorkoutSessionSet(\n    $id: uuid!\n    $set: workoutSessionSets_set_input!\n  ) {\n    updateWorkoutSessionSet(pk_columns: { id: $id }, _set: $set) {\n      id\n    }\n  }\n": typeof types.UpdateWorkoutSessionSetDocument,
    "\n  mutation DeleteWorkoutSessionSet($id: uuid!) {\n    deleteWorkoutSessionSet(id: $id) {\n      id\n    }\n  }\n": typeof types.DeleteWorkoutSessionSetDocument,
    "\n  mutation UpdateSessionStartedAt($id: uuid!, $startedAt: timestamptz!) {\n    updateWorkoutSession(pk_columns: { id: $id }, _set: { startedAt: $startedAt }) {\n      id\n    }\n  }\n": typeof types.UpdateSessionStartedAtDocument,
    "\n  mutation DeleteWorkoutSession($id: uuid!) {\n    deleteWorkoutSession(id: $id) {\n      id\n    }\n  }\n": typeof types.DeleteWorkoutSessionDocument,
    "\n  mutation InsertWorkoutSessionExercises(\n    $objs: [workoutSessionExercises_insert_input!]!\n  ) {\n    insertWorkoutSessionExercises(objects: $objs) {\n      affected_rows\n    }\n  }\n": typeof types.InsertWorkoutSessionExercisesDocument,
    "\n  mutation DeleteWorkoutSessionExercise($id: uuid!) {\n    deleteWorkoutSessionExercise(id: $id) {\n      id\n    }\n  }\n": typeof types.DeleteWorkoutSessionExerciseDocument,
    "\n  query SessionsIndex($limit: Int!, $offset: Int!) {\n    workoutSessions(order_by: { startedAt: desc }, limit: $limit, offset: $offset) {\n      id\n      startedAt\n      workout {\n        id\n        name\n      }\n      workoutSessionExercises_aggregate {\n        aggregate {\n          count\n        }\n      }\n      workoutSessionExercises {\n        workoutSessionSets_aggregate {\n          aggregate {\n            count\n            sum {\n              reps\n            }\n          }\n        }\n      }\n    }\n  }\n": typeof types.SessionsIndexDocument,
    "\n  query NewSessionWorkouts {\n    workouts(order_by: [{ isPublic: asc }, { name: asc }]) {\n      id\n      name\n      description\n      isPublic\n      workoutExercises(order_by: { position: asc }) {\n        id\n        position\n        exercise {\n          id\n        }\n      }\n    }\n  }\n": typeof types.NewSessionWorkoutsDocument,
    "\n  mutation StartSession($obj: workoutSessions_insert_input!) {\n    insertWorkoutSession(object: $obj) {\n      id\n    }\n  }\n": typeof types.StartSessionDocument,
    "\n  query WorkoutDetail($id: uuid!) {\n    workout(id: $id) {\n      id\n      name\n      description\n      isPublic\n      userId\n      workoutExercises(order_by: { position: asc }) {\n        id\n        position\n        exercise {\n          id\n          name\n          doubleWeight\n          primaryMuscleGroup\n          image1FileId\n          image2FileId\n        }\n      }\n      workoutLabels {\n        labelId\n        label {\n          id\n          name\n        }\n      }\n    }\n  }\n": typeof types.WorkoutDetailDocument,
    "\n  query EditWorkout($id: uuid!) {\n    workout(id: $id) {\n      id\n      name\n      description\n      isPublic\n      userId\n      workoutExercises(order_by: { position: asc }) {\n        id\n        position\n        exercise {\n          id\n          name\n          primaryMuscleGroup\n          doubleWeight\n        }\n      }\n      workoutLabels {\n        labelId\n        label {\n          id\n          name\n        }\n      }\n    }\n    labels(order_by: { name: asc }) {\n      id\n      name\n    }\n  }\n": typeof types.EditWorkoutDocument,
    "\n  mutation SaveWorkout(\n    $id: uuid!\n    $set: workouts_set_input!\n    $deleteRowIds: [uuid!]!\n    $insertRows: [workoutExercises_insert_input!]!\n    $positionUpdates: [workoutExercises_updates!]!\n    $deleteLabelIds: [uuid!]!\n    $insertLabels: [workoutLabels_insert_input!]!\n  ) {\n    updateWorkout(pk_columns: { id: $id }, _set: $set) {\n      id\n    }\n    deleteWorkoutExercises(where: { id: { _in: $deleteRowIds } }) {\n      affected_rows\n    }\n    insertWorkoutExercises(objects: $insertRows) {\n      affected_rows\n    }\n    update_workoutExercises_many(updates: $positionUpdates) {\n      affected_rows\n    }\n    deleteWorkoutLabels(\n      where: { workoutId: { _eq: $id }, labelId: { _in: $deleteLabelIds } }\n    ) {\n      affected_rows\n    }\n    insertWorkoutLabels(\n      objects: $insertLabels\n      on_conflict: { constraint: workout_labels_pkey, update_columns: [] }\n    ) {\n      affected_rows\n    }\n  }\n": typeof types.SaveWorkoutDocument,
    "\n  mutation DeleteWorkout($id: uuid!) {\n    deleteWorkout(id: $id) {\n      id\n    }\n  }\n": typeof types.DeleteWorkoutDocument,
    "\n  query WorkoutsIndex {\n    workouts(order_by: [{ isPublic: asc }, { name: asc }]) {\n      id\n      name\n      description\n      isPublic\n      workoutExercises_aggregate {\n        aggregate {\n          count\n        }\n      }\n      workoutLabels {\n        labelId\n        label {\n          id\n          name\n        }\n      }\n    }\n    labels(order_by: { name: asc }) {\n      id\n      name\n    }\n  }\n": typeof types.WorkoutsIndexDocument,
    "\n  query NewWorkoutLabels {\n    labels(order_by: { name: asc }) {\n      id\n      name\n    }\n  }\n": typeof types.NewWorkoutLabelsDocument,
    "\n  mutation CreateWorkout($obj: workouts_insert_input!) {\n    insertWorkout(object: $obj) {\n      id\n    }\n  }\n": typeof types.CreateWorkoutDocument,
};
const documents: Documents = {
    "\n  query BreadcrumbWorkout($id: uuid!) {\n    workout(id: $id) {\n      id\n      name\n    }\n  }\n": types.BreadcrumbWorkoutDocument,
    "\n  query BreadcrumbExercise($id: uuid!) {\n    exercise(id: $id) {\n      id\n      name\n    }\n  }\n": types.BreadcrumbExerciseDocument,
    "\n  query BreadcrumbSession($id: uuid!) {\n    workoutSession(id: $id) {\n      id\n      startedAt\n      workout {\n        id\n        name\n      }\n    }\n  }\n": types.BreadcrumbSessionDocument,
    "\n  query BreadcrumbBodyMeasurement($id: uuid!) {\n    bodyMeasurement(id: $id) {\n      id\n      measuredOn\n    }\n  }\n": types.BreadcrumbBodyMeasurementDocument,
    "\n  query BreadcrumbJournalEntry($id: uuid!) {\n    journalEntry(id: $id) {\n      id\n      entryDate\n      title\n    }\n  }\n": types.BreadcrumbJournalEntryDocument,
    "\n  query ExerciseDetail($id: uuid!) {\n    exercise(id: $id) {\n      id\n      name\n      instructions\n      image1FileId\n      image2FileId\n      doubleWeight\n      level\n      category\n      equipment\n      force\n      mechanic\n      primaryMuscleGroup\n      secondaryMuscleGroups {\n        muscleGroup\n      }\n      workoutSessionExercises {\n        id\n        workoutSession {\n          id\n          startedAt\n          workout {\n            id\n            name\n          }\n        }\n        workoutSessionSets(order_by: { setNumber: asc }) {\n          id\n          setNumber\n          reps\n          weight\n        }\n      }\n    }\n  }\n": types.ExerciseDetailDocument,
    "\n  query ExercisePickerExercises {\n    exercises(order_by: { name: asc }) {\n      id\n      name\n      primaryMuscleGroup\n      doubleWeight\n    }\n  }\n": types.ExercisePickerExercisesDocument,
    "\n  query BodyMeasurementById($id: uuid!) {\n    bodyMeasurement(id: $id) {\n      id\n      measuredOn\n      weightKg\n      bodyFatPct\n      notes\n      updatedAt\n    }\n  }\n": types.BodyMeasurementByIdDocument,
    "\n  query EditBodyMeasurement($id: uuid!) {\n    bodyMeasurement(id: $id) {\n      id\n      measuredOn\n      weightKg\n      bodyFatPct\n      notes\n    }\n  }\n": types.EditBodyMeasurementDocument,
    "\n  mutation UpdateBodyMeasurement($id: uuid!, $set: bodyMeasurements_set_input!) {\n    updateBodyMeasurement(pk_columns: { id: $id }, _set: $set) {\n      id\n    }\n  }\n": types.UpdateBodyMeasurementDocument,
    "\n  mutation DeleteBodyMeasurement($id: uuid!) {\n    deleteBodyMeasurement(id: $id) {\n      id\n    }\n  }\n": types.DeleteBodyMeasurementDocument,
    "\n  query BodyMeasurements {\n    bodyMeasurements(order_by: { measuredOn: desc }) {\n      id\n      measuredOn\n      weightKg\n      bodyFatPct\n      notes\n    }\n  }\n": types.BodyMeasurementsDocument,
    "\n  mutation InsertBodyMeasurement($obj: bodyMeasurements_insert_input!) {\n    insertBodyMeasurement(object: $obj) {\n      id\n    }\n  }\n": types.InsertBodyMeasurementDocument,
    "\n  query ExercisesIndex {\n    exercises(order_by: { name: asc }) {\n      id\n      name\n      doubleWeight\n      primaryMuscleGroup\n      category\n      equipment\n      level\n      isPublic\n      secondaryMuscleGroups {\n        muscleGroup\n      }\n    }\n  }\n": types.ExercisesIndexDocument,
    "\n  query JournalEntryById($id: uuid!) {\n    journalEntry(id: $id) {\n      id\n      entryDate\n      title\n      body\n      journalEntryLabels {\n        labelId\n        label {\n          id\n          name\n        }\n      }\n    }\n  }\n": types.JournalEntryByIdDocument,
    "\n  query EditJournalEntry($id: uuid!) {\n    journalEntry(id: $id) {\n      id\n      entryDate\n      title\n      body\n      journalEntryLabels {\n        labelId\n        label {\n          id\n          name\n        }\n      }\n    }\n    journalLabels(order_by: { name: asc }) {\n      id\n      name\n    }\n  }\n": types.EditJournalEntryDocument,
    "\n  mutation SaveJournalEntry(\n    $id: uuid!\n    $set: journalEntries_set_input!\n    $deleteLabelIds: [uuid!]!\n    $insertLabels: [journalEntryLabels_insert_input!]!\n  ) {\n    updateJournalEntry(pk_columns: { id: $id }, _set: $set) {\n      id\n    }\n    deleteJournalEntryLabels(\n      where: { journalEntryId: { _eq: $id }, labelId: { _in: $deleteLabelIds } }\n    ) {\n      affected_rows\n    }\n    insertJournalEntryLabels(\n      objects: $insertLabels\n      on_conflict: { constraint: journal_entry_labels_pkey, update_columns: [] }\n    ) {\n      affected_rows\n    }\n  }\n": types.SaveJournalEntryDocument,
    "\n  mutation DeleteJournalEntry($id: uuid!) {\n    deleteJournalEntry(id: $id) {\n      id\n    }\n  }\n": types.DeleteJournalEntryDocument,
    "\n  query JournalEntries($limit: Int!, $offset: Int!, $where: journalEntries_bool_exp) {\n    journalEntries(\n      where: $where\n      order_by: [{ entryDate: desc }, { createdAt: desc }]\n      limit: $limit\n      offset: $offset\n    ) {\n      id\n      entryDate\n      title\n      body\n      journalEntryLabels {\n        labelId\n        label {\n          id\n          name\n        }\n      }\n    }\n  }\n": types.JournalEntriesDocument,
    "\n  query JournalLabelsFilter {\n    journalLabels(order_by: { name: asc }) {\n      id\n      name\n    }\n  }\n": types.JournalLabelsFilterDocument,
    "\n  query JournalLabelsForForm {\n    journalLabels(order_by: { name: asc }) {\n      id\n      name\n    }\n  }\n": types.JournalLabelsForFormDocument,
    "\n  mutation InsertJournalEntry($obj: journalEntries_insert_input!) {\n    insertJournalEntry(object: $obj) {\n      id\n    }\n  }\n": types.InsertJournalEntryDocument,
    "\n  query SessionDetail($id: uuid!) {\n    workoutSession(id: $id) {\n      id\n      startedAt\n      workout {\n        id\n        name\n      }\n      workoutSessionExercises(order_by: { position: asc }) {\n        id\n        position\n        exercise {\n          id\n          name\n          doubleWeight\n          primaryMuscleGroup\n          image1FileId\n          image2FileId\n        }\n        workoutSessionSets(order_by: { setNumber: asc }) {\n          id\n          setNumber\n          reps\n          weight\n        }\n      }\n    }\n  }\n": types.SessionDetailDocument,
    "\n  query PriorSessionsPerExercise($exerciseIds: [uuid!]!, $excludeSessionId: uuid!) {\n    exercises(where: { id: { _in: $exerciseIds } }) {\n      id\n      workoutSessionExercises(\n        limit: 3\n        order_by: { workoutSession: { startedAt: desc } }\n        where: { workoutSessionId: { _neq: $excludeSessionId } }\n      ) {\n        id\n        workoutSession {\n          id\n          startedAt\n        }\n        workoutSessionSets(order_by: { setNumber: asc }) {\n          id\n          setNumber\n          reps\n          weight\n        }\n      }\n    }\n  }\n": types.PriorSessionsPerExerciseDocument,
    "\n  mutation InsertWorkoutSessionSet($obj: workoutSessionSets_insert_input!) {\n    insertWorkoutSessionSet(object: $obj) {\n      id\n    }\n  }\n": types.InsertWorkoutSessionSetDocument,
    "\n  mutation UpdateWorkoutSessionSet(\n    $id: uuid!\n    $set: workoutSessionSets_set_input!\n  ) {\n    updateWorkoutSessionSet(pk_columns: { id: $id }, _set: $set) {\n      id\n    }\n  }\n": types.UpdateWorkoutSessionSetDocument,
    "\n  mutation DeleteWorkoutSessionSet($id: uuid!) {\n    deleteWorkoutSessionSet(id: $id) {\n      id\n    }\n  }\n": types.DeleteWorkoutSessionSetDocument,
    "\n  mutation UpdateSessionStartedAt($id: uuid!, $startedAt: timestamptz!) {\n    updateWorkoutSession(pk_columns: { id: $id }, _set: { startedAt: $startedAt }) {\n      id\n    }\n  }\n": types.UpdateSessionStartedAtDocument,
    "\n  mutation DeleteWorkoutSession($id: uuid!) {\n    deleteWorkoutSession(id: $id) {\n      id\n    }\n  }\n": types.DeleteWorkoutSessionDocument,
    "\n  mutation InsertWorkoutSessionExercises(\n    $objs: [workoutSessionExercises_insert_input!]!\n  ) {\n    insertWorkoutSessionExercises(objects: $objs) {\n      affected_rows\n    }\n  }\n": types.InsertWorkoutSessionExercisesDocument,
    "\n  mutation DeleteWorkoutSessionExercise($id: uuid!) {\n    deleteWorkoutSessionExercise(id: $id) {\n      id\n    }\n  }\n": types.DeleteWorkoutSessionExerciseDocument,
    "\n  query SessionsIndex($limit: Int!, $offset: Int!) {\n    workoutSessions(order_by: { startedAt: desc }, limit: $limit, offset: $offset) {\n      id\n      startedAt\n      workout {\n        id\n        name\n      }\n      workoutSessionExercises_aggregate {\n        aggregate {\n          count\n        }\n      }\n      workoutSessionExercises {\n        workoutSessionSets_aggregate {\n          aggregate {\n            count\n            sum {\n              reps\n            }\n          }\n        }\n      }\n    }\n  }\n": types.SessionsIndexDocument,
    "\n  query NewSessionWorkouts {\n    workouts(order_by: [{ isPublic: asc }, { name: asc }]) {\n      id\n      name\n      description\n      isPublic\n      workoutExercises(order_by: { position: asc }) {\n        id\n        position\n        exercise {\n          id\n        }\n      }\n    }\n  }\n": types.NewSessionWorkoutsDocument,
    "\n  mutation StartSession($obj: workoutSessions_insert_input!) {\n    insertWorkoutSession(object: $obj) {\n      id\n    }\n  }\n": types.StartSessionDocument,
    "\n  query WorkoutDetail($id: uuid!) {\n    workout(id: $id) {\n      id\n      name\n      description\n      isPublic\n      userId\n      workoutExercises(order_by: { position: asc }) {\n        id\n        position\n        exercise {\n          id\n          name\n          doubleWeight\n          primaryMuscleGroup\n          image1FileId\n          image2FileId\n        }\n      }\n      workoutLabels {\n        labelId\n        label {\n          id\n          name\n        }\n      }\n    }\n  }\n": types.WorkoutDetailDocument,
    "\n  query EditWorkout($id: uuid!) {\n    workout(id: $id) {\n      id\n      name\n      description\n      isPublic\n      userId\n      workoutExercises(order_by: { position: asc }) {\n        id\n        position\n        exercise {\n          id\n          name\n          primaryMuscleGroup\n          doubleWeight\n        }\n      }\n      workoutLabels {\n        labelId\n        label {\n          id\n          name\n        }\n      }\n    }\n    labels(order_by: { name: asc }) {\n      id\n      name\n    }\n  }\n": types.EditWorkoutDocument,
    "\n  mutation SaveWorkout(\n    $id: uuid!\n    $set: workouts_set_input!\n    $deleteRowIds: [uuid!]!\n    $insertRows: [workoutExercises_insert_input!]!\n    $positionUpdates: [workoutExercises_updates!]!\n    $deleteLabelIds: [uuid!]!\n    $insertLabels: [workoutLabels_insert_input!]!\n  ) {\n    updateWorkout(pk_columns: { id: $id }, _set: $set) {\n      id\n    }\n    deleteWorkoutExercises(where: { id: { _in: $deleteRowIds } }) {\n      affected_rows\n    }\n    insertWorkoutExercises(objects: $insertRows) {\n      affected_rows\n    }\n    update_workoutExercises_many(updates: $positionUpdates) {\n      affected_rows\n    }\n    deleteWorkoutLabels(\n      where: { workoutId: { _eq: $id }, labelId: { _in: $deleteLabelIds } }\n    ) {\n      affected_rows\n    }\n    insertWorkoutLabels(\n      objects: $insertLabels\n      on_conflict: { constraint: workout_labels_pkey, update_columns: [] }\n    ) {\n      affected_rows\n    }\n  }\n": types.SaveWorkoutDocument,
    "\n  mutation DeleteWorkout($id: uuid!) {\n    deleteWorkout(id: $id) {\n      id\n    }\n  }\n": types.DeleteWorkoutDocument,
    "\n  query WorkoutsIndex {\n    workouts(order_by: [{ isPublic: asc }, { name: asc }]) {\n      id\n      name\n      description\n      isPublic\n      workoutExercises_aggregate {\n        aggregate {\n          count\n        }\n      }\n      workoutLabels {\n        labelId\n        label {\n          id\n          name\n        }\n      }\n    }\n    labels(order_by: { name: asc }) {\n      id\n      name\n    }\n  }\n": types.WorkoutsIndexDocument,
    "\n  query NewWorkoutLabels {\n    labels(order_by: { name: asc }) {\n      id\n      name\n    }\n  }\n": types.NewWorkoutLabelsDocument,
    "\n  mutation CreateWorkout($obj: workouts_insert_input!) {\n    insertWorkout(object: $obj) {\n      id\n    }\n  }\n": types.CreateWorkoutDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query BreadcrumbWorkout($id: uuid!) {\n    workout(id: $id) {\n      id\n      name\n    }\n  }\n"): (typeof documents)["\n  query BreadcrumbWorkout($id: uuid!) {\n    workout(id: $id) {\n      id\n      name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query BreadcrumbExercise($id: uuid!) {\n    exercise(id: $id) {\n      id\n      name\n    }\n  }\n"): (typeof documents)["\n  query BreadcrumbExercise($id: uuid!) {\n    exercise(id: $id) {\n      id\n      name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query BreadcrumbSession($id: uuid!) {\n    workoutSession(id: $id) {\n      id\n      startedAt\n      workout {\n        id\n        name\n      }\n    }\n  }\n"): (typeof documents)["\n  query BreadcrumbSession($id: uuid!) {\n    workoutSession(id: $id) {\n      id\n      startedAt\n      workout {\n        id\n        name\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query BreadcrumbBodyMeasurement($id: uuid!) {\n    bodyMeasurement(id: $id) {\n      id\n      measuredOn\n    }\n  }\n"): (typeof documents)["\n  query BreadcrumbBodyMeasurement($id: uuid!) {\n    bodyMeasurement(id: $id) {\n      id\n      measuredOn\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query BreadcrumbJournalEntry($id: uuid!) {\n    journalEntry(id: $id) {\n      id\n      entryDate\n      title\n    }\n  }\n"): (typeof documents)["\n  query BreadcrumbJournalEntry($id: uuid!) {\n    journalEntry(id: $id) {\n      id\n      entryDate\n      title\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ExerciseDetail($id: uuid!) {\n    exercise(id: $id) {\n      id\n      name\n      instructions\n      image1FileId\n      image2FileId\n      doubleWeight\n      level\n      category\n      equipment\n      force\n      mechanic\n      primaryMuscleGroup\n      secondaryMuscleGroups {\n        muscleGroup\n      }\n      workoutSessionExercises {\n        id\n        workoutSession {\n          id\n          startedAt\n          workout {\n            id\n            name\n          }\n        }\n        workoutSessionSets(order_by: { setNumber: asc }) {\n          id\n          setNumber\n          reps\n          weight\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query ExerciseDetail($id: uuid!) {\n    exercise(id: $id) {\n      id\n      name\n      instructions\n      image1FileId\n      image2FileId\n      doubleWeight\n      level\n      category\n      equipment\n      force\n      mechanic\n      primaryMuscleGroup\n      secondaryMuscleGroups {\n        muscleGroup\n      }\n      workoutSessionExercises {\n        id\n        workoutSession {\n          id\n          startedAt\n          workout {\n            id\n            name\n          }\n        }\n        workoutSessionSets(order_by: { setNumber: asc }) {\n          id\n          setNumber\n          reps\n          weight\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ExercisePickerExercises {\n    exercises(order_by: { name: asc }) {\n      id\n      name\n      primaryMuscleGroup\n      doubleWeight\n    }\n  }\n"): (typeof documents)["\n  query ExercisePickerExercises {\n    exercises(order_by: { name: asc }) {\n      id\n      name\n      primaryMuscleGroup\n      doubleWeight\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query BodyMeasurementById($id: uuid!) {\n    bodyMeasurement(id: $id) {\n      id\n      measuredOn\n      weightKg\n      bodyFatPct\n      notes\n      updatedAt\n    }\n  }\n"): (typeof documents)["\n  query BodyMeasurementById($id: uuid!) {\n    bodyMeasurement(id: $id) {\n      id\n      measuredOn\n      weightKg\n      bodyFatPct\n      notes\n      updatedAt\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query EditBodyMeasurement($id: uuid!) {\n    bodyMeasurement(id: $id) {\n      id\n      measuredOn\n      weightKg\n      bodyFatPct\n      notes\n    }\n  }\n"): (typeof documents)["\n  query EditBodyMeasurement($id: uuid!) {\n    bodyMeasurement(id: $id) {\n      id\n      measuredOn\n      weightKg\n      bodyFatPct\n      notes\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateBodyMeasurement($id: uuid!, $set: bodyMeasurements_set_input!) {\n    updateBodyMeasurement(pk_columns: { id: $id }, _set: $set) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateBodyMeasurement($id: uuid!, $set: bodyMeasurements_set_input!) {\n    updateBodyMeasurement(pk_columns: { id: $id }, _set: $set) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteBodyMeasurement($id: uuid!) {\n    deleteBodyMeasurement(id: $id) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation DeleteBodyMeasurement($id: uuid!) {\n    deleteBodyMeasurement(id: $id) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query BodyMeasurements {\n    bodyMeasurements(order_by: { measuredOn: desc }) {\n      id\n      measuredOn\n      weightKg\n      bodyFatPct\n      notes\n    }\n  }\n"): (typeof documents)["\n  query BodyMeasurements {\n    bodyMeasurements(order_by: { measuredOn: desc }) {\n      id\n      measuredOn\n      weightKg\n      bodyFatPct\n      notes\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation InsertBodyMeasurement($obj: bodyMeasurements_insert_input!) {\n    insertBodyMeasurement(object: $obj) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation InsertBodyMeasurement($obj: bodyMeasurements_insert_input!) {\n    insertBodyMeasurement(object: $obj) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ExercisesIndex {\n    exercises(order_by: { name: asc }) {\n      id\n      name\n      doubleWeight\n      primaryMuscleGroup\n      category\n      equipment\n      level\n      isPublic\n      secondaryMuscleGroups {\n        muscleGroup\n      }\n    }\n  }\n"): (typeof documents)["\n  query ExercisesIndex {\n    exercises(order_by: { name: asc }) {\n      id\n      name\n      doubleWeight\n      primaryMuscleGroup\n      category\n      equipment\n      level\n      isPublic\n      secondaryMuscleGroups {\n        muscleGroup\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query JournalEntryById($id: uuid!) {\n    journalEntry(id: $id) {\n      id\n      entryDate\n      title\n      body\n      journalEntryLabels {\n        labelId\n        label {\n          id\n          name\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query JournalEntryById($id: uuid!) {\n    journalEntry(id: $id) {\n      id\n      entryDate\n      title\n      body\n      journalEntryLabels {\n        labelId\n        label {\n          id\n          name\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query EditJournalEntry($id: uuid!) {\n    journalEntry(id: $id) {\n      id\n      entryDate\n      title\n      body\n      journalEntryLabels {\n        labelId\n        label {\n          id\n          name\n        }\n      }\n    }\n    journalLabels(order_by: { name: asc }) {\n      id\n      name\n    }\n  }\n"): (typeof documents)["\n  query EditJournalEntry($id: uuid!) {\n    journalEntry(id: $id) {\n      id\n      entryDate\n      title\n      body\n      journalEntryLabels {\n        labelId\n        label {\n          id\n          name\n        }\n      }\n    }\n    journalLabels(order_by: { name: asc }) {\n      id\n      name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SaveJournalEntry(\n    $id: uuid!\n    $set: journalEntries_set_input!\n    $deleteLabelIds: [uuid!]!\n    $insertLabels: [journalEntryLabels_insert_input!]!\n  ) {\n    updateJournalEntry(pk_columns: { id: $id }, _set: $set) {\n      id\n    }\n    deleteJournalEntryLabels(\n      where: { journalEntryId: { _eq: $id }, labelId: { _in: $deleteLabelIds } }\n    ) {\n      affected_rows\n    }\n    insertJournalEntryLabels(\n      objects: $insertLabels\n      on_conflict: { constraint: journal_entry_labels_pkey, update_columns: [] }\n    ) {\n      affected_rows\n    }\n  }\n"): (typeof documents)["\n  mutation SaveJournalEntry(\n    $id: uuid!\n    $set: journalEntries_set_input!\n    $deleteLabelIds: [uuid!]!\n    $insertLabels: [journalEntryLabels_insert_input!]!\n  ) {\n    updateJournalEntry(pk_columns: { id: $id }, _set: $set) {\n      id\n    }\n    deleteJournalEntryLabels(\n      where: { journalEntryId: { _eq: $id }, labelId: { _in: $deleteLabelIds } }\n    ) {\n      affected_rows\n    }\n    insertJournalEntryLabels(\n      objects: $insertLabels\n      on_conflict: { constraint: journal_entry_labels_pkey, update_columns: [] }\n    ) {\n      affected_rows\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteJournalEntry($id: uuid!) {\n    deleteJournalEntry(id: $id) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation DeleteJournalEntry($id: uuid!) {\n    deleteJournalEntry(id: $id) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query JournalEntries($limit: Int!, $offset: Int!, $where: journalEntries_bool_exp) {\n    journalEntries(\n      where: $where\n      order_by: [{ entryDate: desc }, { createdAt: desc }]\n      limit: $limit\n      offset: $offset\n    ) {\n      id\n      entryDate\n      title\n      body\n      journalEntryLabels {\n        labelId\n        label {\n          id\n          name\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query JournalEntries($limit: Int!, $offset: Int!, $where: journalEntries_bool_exp) {\n    journalEntries(\n      where: $where\n      order_by: [{ entryDate: desc }, { createdAt: desc }]\n      limit: $limit\n      offset: $offset\n    ) {\n      id\n      entryDate\n      title\n      body\n      journalEntryLabels {\n        labelId\n        label {\n          id\n          name\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query JournalLabelsFilter {\n    journalLabels(order_by: { name: asc }) {\n      id\n      name\n    }\n  }\n"): (typeof documents)["\n  query JournalLabelsFilter {\n    journalLabels(order_by: { name: asc }) {\n      id\n      name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query JournalLabelsForForm {\n    journalLabels(order_by: { name: asc }) {\n      id\n      name\n    }\n  }\n"): (typeof documents)["\n  query JournalLabelsForForm {\n    journalLabels(order_by: { name: asc }) {\n      id\n      name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation InsertJournalEntry($obj: journalEntries_insert_input!) {\n    insertJournalEntry(object: $obj) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation InsertJournalEntry($obj: journalEntries_insert_input!) {\n    insertJournalEntry(object: $obj) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query SessionDetail($id: uuid!) {\n    workoutSession(id: $id) {\n      id\n      startedAt\n      workout {\n        id\n        name\n      }\n      workoutSessionExercises(order_by: { position: asc }) {\n        id\n        position\n        exercise {\n          id\n          name\n          doubleWeight\n          primaryMuscleGroup\n          image1FileId\n          image2FileId\n        }\n        workoutSessionSets(order_by: { setNumber: asc }) {\n          id\n          setNumber\n          reps\n          weight\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query SessionDetail($id: uuid!) {\n    workoutSession(id: $id) {\n      id\n      startedAt\n      workout {\n        id\n        name\n      }\n      workoutSessionExercises(order_by: { position: asc }) {\n        id\n        position\n        exercise {\n          id\n          name\n          doubleWeight\n          primaryMuscleGroup\n          image1FileId\n          image2FileId\n        }\n        workoutSessionSets(order_by: { setNumber: asc }) {\n          id\n          setNumber\n          reps\n          weight\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query PriorSessionsPerExercise($exerciseIds: [uuid!]!, $excludeSessionId: uuid!) {\n    exercises(where: { id: { _in: $exerciseIds } }) {\n      id\n      workoutSessionExercises(\n        limit: 3\n        order_by: { workoutSession: { startedAt: desc } }\n        where: { workoutSessionId: { _neq: $excludeSessionId } }\n      ) {\n        id\n        workoutSession {\n          id\n          startedAt\n        }\n        workoutSessionSets(order_by: { setNumber: asc }) {\n          id\n          setNumber\n          reps\n          weight\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query PriorSessionsPerExercise($exerciseIds: [uuid!]!, $excludeSessionId: uuid!) {\n    exercises(where: { id: { _in: $exerciseIds } }) {\n      id\n      workoutSessionExercises(\n        limit: 3\n        order_by: { workoutSession: { startedAt: desc } }\n        where: { workoutSessionId: { _neq: $excludeSessionId } }\n      ) {\n        id\n        workoutSession {\n          id\n          startedAt\n        }\n        workoutSessionSets(order_by: { setNumber: asc }) {\n          id\n          setNumber\n          reps\n          weight\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation InsertWorkoutSessionSet($obj: workoutSessionSets_insert_input!) {\n    insertWorkoutSessionSet(object: $obj) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation InsertWorkoutSessionSet($obj: workoutSessionSets_insert_input!) {\n    insertWorkoutSessionSet(object: $obj) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateWorkoutSessionSet(\n    $id: uuid!\n    $set: workoutSessionSets_set_input!\n  ) {\n    updateWorkoutSessionSet(pk_columns: { id: $id }, _set: $set) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateWorkoutSessionSet(\n    $id: uuid!\n    $set: workoutSessionSets_set_input!\n  ) {\n    updateWorkoutSessionSet(pk_columns: { id: $id }, _set: $set) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteWorkoutSessionSet($id: uuid!) {\n    deleteWorkoutSessionSet(id: $id) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation DeleteWorkoutSessionSet($id: uuid!) {\n    deleteWorkoutSessionSet(id: $id) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation UpdateSessionStartedAt($id: uuid!, $startedAt: timestamptz!) {\n    updateWorkoutSession(pk_columns: { id: $id }, _set: { startedAt: $startedAt }) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation UpdateSessionStartedAt($id: uuid!, $startedAt: timestamptz!) {\n    updateWorkoutSession(pk_columns: { id: $id }, _set: { startedAt: $startedAt }) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteWorkoutSession($id: uuid!) {\n    deleteWorkoutSession(id: $id) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation DeleteWorkoutSession($id: uuid!) {\n    deleteWorkoutSession(id: $id) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation InsertWorkoutSessionExercises(\n    $objs: [workoutSessionExercises_insert_input!]!\n  ) {\n    insertWorkoutSessionExercises(objects: $objs) {\n      affected_rows\n    }\n  }\n"): (typeof documents)["\n  mutation InsertWorkoutSessionExercises(\n    $objs: [workoutSessionExercises_insert_input!]!\n  ) {\n    insertWorkoutSessionExercises(objects: $objs) {\n      affected_rows\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteWorkoutSessionExercise($id: uuid!) {\n    deleteWorkoutSessionExercise(id: $id) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation DeleteWorkoutSessionExercise($id: uuid!) {\n    deleteWorkoutSessionExercise(id: $id) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query SessionsIndex($limit: Int!, $offset: Int!) {\n    workoutSessions(order_by: { startedAt: desc }, limit: $limit, offset: $offset) {\n      id\n      startedAt\n      workout {\n        id\n        name\n      }\n      workoutSessionExercises_aggregate {\n        aggregate {\n          count\n        }\n      }\n      workoutSessionExercises {\n        workoutSessionSets_aggregate {\n          aggregate {\n            count\n            sum {\n              reps\n            }\n          }\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query SessionsIndex($limit: Int!, $offset: Int!) {\n    workoutSessions(order_by: { startedAt: desc }, limit: $limit, offset: $offset) {\n      id\n      startedAt\n      workout {\n        id\n        name\n      }\n      workoutSessionExercises_aggregate {\n        aggregate {\n          count\n        }\n      }\n      workoutSessionExercises {\n        workoutSessionSets_aggregate {\n          aggregate {\n            count\n            sum {\n              reps\n            }\n          }\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query NewSessionWorkouts {\n    workouts(order_by: [{ isPublic: asc }, { name: asc }]) {\n      id\n      name\n      description\n      isPublic\n      workoutExercises(order_by: { position: asc }) {\n        id\n        position\n        exercise {\n          id\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query NewSessionWorkouts {\n    workouts(order_by: [{ isPublic: asc }, { name: asc }]) {\n      id\n      name\n      description\n      isPublic\n      workoutExercises(order_by: { position: asc }) {\n        id\n        position\n        exercise {\n          id\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation StartSession($obj: workoutSessions_insert_input!) {\n    insertWorkoutSession(object: $obj) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation StartSession($obj: workoutSessions_insert_input!) {\n    insertWorkoutSession(object: $obj) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query WorkoutDetail($id: uuid!) {\n    workout(id: $id) {\n      id\n      name\n      description\n      isPublic\n      userId\n      workoutExercises(order_by: { position: asc }) {\n        id\n        position\n        exercise {\n          id\n          name\n          doubleWeight\n          primaryMuscleGroup\n          image1FileId\n          image2FileId\n        }\n      }\n      workoutLabels {\n        labelId\n        label {\n          id\n          name\n        }\n      }\n    }\n  }\n"): (typeof documents)["\n  query WorkoutDetail($id: uuid!) {\n    workout(id: $id) {\n      id\n      name\n      description\n      isPublic\n      userId\n      workoutExercises(order_by: { position: asc }) {\n        id\n        position\n        exercise {\n          id\n          name\n          doubleWeight\n          primaryMuscleGroup\n          image1FileId\n          image2FileId\n        }\n      }\n      workoutLabels {\n        labelId\n        label {\n          id\n          name\n        }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query EditWorkout($id: uuid!) {\n    workout(id: $id) {\n      id\n      name\n      description\n      isPublic\n      userId\n      workoutExercises(order_by: { position: asc }) {\n        id\n        position\n        exercise {\n          id\n          name\n          primaryMuscleGroup\n          doubleWeight\n        }\n      }\n      workoutLabels {\n        labelId\n        label {\n          id\n          name\n        }\n      }\n    }\n    labels(order_by: { name: asc }) {\n      id\n      name\n    }\n  }\n"): (typeof documents)["\n  query EditWorkout($id: uuid!) {\n    workout(id: $id) {\n      id\n      name\n      description\n      isPublic\n      userId\n      workoutExercises(order_by: { position: asc }) {\n        id\n        position\n        exercise {\n          id\n          name\n          primaryMuscleGroup\n          doubleWeight\n        }\n      }\n      workoutLabels {\n        labelId\n        label {\n          id\n          name\n        }\n      }\n    }\n    labels(order_by: { name: asc }) {\n      id\n      name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation SaveWorkout(\n    $id: uuid!\n    $set: workouts_set_input!\n    $deleteRowIds: [uuid!]!\n    $insertRows: [workoutExercises_insert_input!]!\n    $positionUpdates: [workoutExercises_updates!]!\n    $deleteLabelIds: [uuid!]!\n    $insertLabels: [workoutLabels_insert_input!]!\n  ) {\n    updateWorkout(pk_columns: { id: $id }, _set: $set) {\n      id\n    }\n    deleteWorkoutExercises(where: { id: { _in: $deleteRowIds } }) {\n      affected_rows\n    }\n    insertWorkoutExercises(objects: $insertRows) {\n      affected_rows\n    }\n    update_workoutExercises_many(updates: $positionUpdates) {\n      affected_rows\n    }\n    deleteWorkoutLabels(\n      where: { workoutId: { _eq: $id }, labelId: { _in: $deleteLabelIds } }\n    ) {\n      affected_rows\n    }\n    insertWorkoutLabels(\n      objects: $insertLabels\n      on_conflict: { constraint: workout_labels_pkey, update_columns: [] }\n    ) {\n      affected_rows\n    }\n  }\n"): (typeof documents)["\n  mutation SaveWorkout(\n    $id: uuid!\n    $set: workouts_set_input!\n    $deleteRowIds: [uuid!]!\n    $insertRows: [workoutExercises_insert_input!]!\n    $positionUpdates: [workoutExercises_updates!]!\n    $deleteLabelIds: [uuid!]!\n    $insertLabels: [workoutLabels_insert_input!]!\n  ) {\n    updateWorkout(pk_columns: { id: $id }, _set: $set) {\n      id\n    }\n    deleteWorkoutExercises(where: { id: { _in: $deleteRowIds } }) {\n      affected_rows\n    }\n    insertWorkoutExercises(objects: $insertRows) {\n      affected_rows\n    }\n    update_workoutExercises_many(updates: $positionUpdates) {\n      affected_rows\n    }\n    deleteWorkoutLabels(\n      where: { workoutId: { _eq: $id }, labelId: { _in: $deleteLabelIds } }\n    ) {\n      affected_rows\n    }\n    insertWorkoutLabels(\n      objects: $insertLabels\n      on_conflict: { constraint: workout_labels_pkey, update_columns: [] }\n    ) {\n      affected_rows\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DeleteWorkout($id: uuid!) {\n    deleteWorkout(id: $id) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation DeleteWorkout($id: uuid!) {\n    deleteWorkout(id: $id) {\n      id\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query WorkoutsIndex {\n    workouts(order_by: [{ isPublic: asc }, { name: asc }]) {\n      id\n      name\n      description\n      isPublic\n      workoutExercises_aggregate {\n        aggregate {\n          count\n        }\n      }\n      workoutLabels {\n        labelId\n        label {\n          id\n          name\n        }\n      }\n    }\n    labels(order_by: { name: asc }) {\n      id\n      name\n    }\n  }\n"): (typeof documents)["\n  query WorkoutsIndex {\n    workouts(order_by: [{ isPublic: asc }, { name: asc }]) {\n      id\n      name\n      description\n      isPublic\n      workoutExercises_aggregate {\n        aggregate {\n          count\n        }\n      }\n      workoutLabels {\n        labelId\n        label {\n          id\n          name\n        }\n      }\n    }\n    labels(order_by: { name: asc }) {\n      id\n      name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query NewWorkoutLabels {\n    labels(order_by: { name: asc }) {\n      id\n      name\n    }\n  }\n"): (typeof documents)["\n  query NewWorkoutLabels {\n    labels(order_by: { name: asc }) {\n      id\n      name\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation CreateWorkout($obj: workouts_insert_input!) {\n    insertWorkout(object: $obj) {\n      id\n    }\n  }\n"): (typeof documents)["\n  mutation CreateWorkout($obj: workouts_insert_input!) {\n    insertWorkout(object: $obj) {\n      id\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;