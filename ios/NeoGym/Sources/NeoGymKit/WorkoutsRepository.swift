import Foundation

public protocol WorkoutsRepositoryProtocol: Sendable {
    func listWorkouts() async throws -> WorkoutIndexPayload
    func workoutListUpdates() -> AsyncThrowingStream<WorkoutIndexPayload, Error>
    func workoutDetail(id: String) async throws -> WorkoutDetailModel?
    func editWorkout(id: String) async throws -> WorkoutEditPayload
    func labels() async throws -> [WorkoutLabel]
    func createWorkout(_ values: WorkoutFormValues) async throws -> String
    func saveWorkout(id: String, initialValues: WorkoutFormValues, values: WorkoutFormValues) async throws
    func deleteWorkout(id: String) async throws
    func startSession(from workout: WorkoutDetailModel, startedAt: Date) async throws -> String
}

public extension WorkoutsRepositoryProtocol {
    func workoutListUpdates() -> AsyncThrowingStream<WorkoutIndexPayload, Error> {
        singleValueUpdates { try await listWorkouts() }
    }
}

public struct WorkoutsRepository: WorkoutsRepositoryProtocol {
    private let graphQL: any GraphQLServicing

    public init(graphQL: any GraphQLServicing) {
        self.graphQL = graphQL
    }

    public func listWorkouts() async throws -> WorkoutIndexPayload {
        let data: WorkoutsIndexData = try await graphQL.execute(
            query: Self.workoutsIndexQuery,
            operationName: "WorkoutsIndex"
        )
        return Self.indexPayload(from: data)
    }

    public func workoutListUpdates() -> AsyncThrowingStream<WorkoutIndexPayload, Error> {
        graphQL.cachedValues(
            WorkoutsIndexData.self,
            query: Self.workoutsIndexQuery,
            operationName: "WorkoutsIndex",
            namespace: "workouts",
            tags: ["workouts"],
            transform: Self.indexPayload
        )
    }

    private static func indexPayload(from data: WorkoutsIndexData) -> WorkoutIndexPayload {
        WorkoutIndexPayload(workouts: data.workouts, labels: data.labels)
    }

    public func workoutDetail(id: String) async throws -> WorkoutDetailModel? {
        let data: WorkoutDetailData = try await graphQL.execute(
            query: Self.workoutDetailQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "WorkoutDetail"
        )
        return data.workout
    }

    public func editWorkout(id: String) async throws -> WorkoutEditPayload {
        let data: EditWorkoutData = try await graphQL.execute(
            query: Self.editWorkoutQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "EditWorkout"
        )
        return WorkoutEditPayload(workout: data.workout, labels: data.labels)
    }

    public func labels() async throws -> [WorkoutLabel] {
        let data: WorkoutLabelsData = try await graphQL.execute(
            query: Self.newWorkoutLabelsQuery,
            operationName: "NewWorkoutLabels"
        )
        return data.labels
    }

    public func createWorkout(_ values: WorkoutFormValues) async throws -> String {
        let data: CreateWorkoutData = try await graphQL.execute(
            query: Self.createWorkoutMutation,
            variables: ["obj": Self.createWorkoutObject(values)],
            operationName: "CreateWorkout"
        )
        guard let id = data.insertWorkout?.id else {
            throw GraphQLDomainError.missingData(operationName: "CreateWorkout")
        }
        return id
    }

    public func saveWorkout(id: String, initialValues: WorkoutFormValues, values: WorkoutFormValues) async throws {
        let variables = Self.saveWorkoutVariables(id: id, initialValues: initialValues, values: values)
        let _: SaveWorkoutData = try await graphQL.execute(
            query: Self.saveWorkoutMutation,
            variables: variables,
            operationName: "SaveWorkout"
        )
    }

    public func deleteWorkout(id: String) async throws {
        let _: DeleteWorkoutData = try await graphQL.execute(
            query: Self.deleteWorkoutMutation,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "DeleteWorkout"
        )
    }

    public func startSession(from workout: WorkoutDetailModel, startedAt: Date) async throws -> String {
        let object: JSONValue = .object([
            "workoutId": GraphQLScalars.uuid(workout.id),
            "startedAt": GraphQLScalars.timestamptz(startedAt),
            "workoutSessionExercises": .object([
                "data": .array(workout.workoutExercises.map { row in
                    .object([
                        "exerciseId": GraphQLScalars.uuid(row.exercise.id),
                        "position": .number(Double(row.position))
                    ])
                })
            ])
        ])
        let data: StartWorkoutSessionData = try await graphQL.execute(
            query: Self.startSessionMutation,
            variables: ["obj": object],
            operationName: "StartSession"
        )
        guard let id = data.insertWorkoutSession?.id else {
            throw GraphQLDomainError.missingData(operationName: "StartSession")
        }
        return id
    }
}

private struct WorkoutsIndexData: Decodable, Sendable {
    let workouts: [WorkoutListItem]
    let labels: [WorkoutLabel]
}

private struct WorkoutDetailData: Decodable, Sendable {
    let workout: WorkoutDetailModel?
}

private struct EditWorkoutData: Decodable, Sendable {
    let workout: WorkoutDetailModel?
    let labels: [WorkoutLabel]
}

private struct WorkoutLabelsData: Decodable, Sendable {
    let labels: [WorkoutLabel]
}

private struct CreateWorkoutData: Decodable, Sendable {
    let insertWorkout: MutationIdPayload?
}

private struct SaveWorkoutData: Decodable, Sendable {
    let updateWorkout: MutationIdPayload?
}

private struct DeleteWorkoutData: Decodable, Sendable {
    let deleteWorkout: MutationIdPayload?
}

private struct StartWorkoutSessionData: Decodable, Sendable {
    let insertWorkoutSession: MutationIdPayload?
}

private struct MutationIdPayload: Decodable, Sendable {
    let id: String
}

public extension WorkoutsRepository {
    static let workoutsIndexQuery = """
    query WorkoutsIndex {
      workouts(order_by: [{ isPublic: asc }, { name: asc }]) {
        id
        name
        description
        isPublic
        workoutExercises_aggregate { aggregate { count } }
        workoutLabels {
          labelId
          label { id name }
        }
      }
      labels(order_by: { name: asc }) {
        id
        name
      }
    }
    """

    static let workoutDetailQuery = """
    query WorkoutDetail($id: uuid!) {
      workout(id: $id) {
        id
        name
        description
        isPublic
        userId
        workoutExercises(order_by: { position: asc }) {
          id
          position
          exercise {
            id
            name
            strength { doubleWeight }
            primaryMuscleGroup
            image1FileId
            image2FileId
          }
        }
        workoutLabels {
          labelId
          label { id name }
        }
      }
    }
    """

    static let editWorkoutQuery = """
    query EditWorkout($id: uuid!) {
      workout(id: $id) {
        id
        name
        description
        isPublic
        userId
        workoutExercises(order_by: { position: asc }) {
          id
          position
          exercise {
            id
            name
            primaryMuscleGroup
            strength { doubleWeight }
          }
        }
        workoutLabels {
          labelId
          label { id name }
        }
      }
      labels(order_by: { name: asc }) {
        id
        name
      }
    }
    """

    static let newWorkoutLabelsQuery = """
    query NewWorkoutLabels {
      labels(order_by: { name: asc }) {
        id
        name
      }
    }
    """

    static let createWorkoutMutation = """
    mutation CreateWorkout($obj: workouts_insert_input!) {
      insertWorkout(object: $obj) {
        id
      }
    }
    """

    static let saveWorkoutMutation = """
    mutation SaveWorkout(
      $id: uuid!
      $set: workouts_set_input!
      $deleteRowIds: [uuid!]!
      $hasDeleteRows: Boolean!
      $insertRows: [workoutExercises_insert_input!]!
      $hasInsertRows: Boolean!
      $positionUpdates: [workoutExercises_updates!]!
      $hasPositionUpdates: Boolean!
      $deleteLabelIds: [uuid!]!
      $hasDeleteLabels: Boolean!
      $insertLabels: [workoutLabels_insert_input!]!
      $hasInsertLabels: Boolean!
    ) {
      updateWorkout(pk_columns: { id: $id }, _set: $set) { id }
      deleteWorkoutExercises(where: { id: { _in: $deleteRowIds } }) @include(if: $hasDeleteRows) { affected_rows }
      insertWorkoutExercises(objects: $insertRows) @include(if: $hasInsertRows) { affected_rows }
      update_workoutExercises_many(updates: $positionUpdates) @include(if: $hasPositionUpdates) { affected_rows }
      deleteWorkoutLabels(
        where: { workoutId: { _eq: $id }, labelId: { _in: $deleteLabelIds } }
      ) @include(if: $hasDeleteLabels) { affected_rows }
      insertWorkoutLabels(
        objects: $insertLabels
        on_conflict: { constraint: workout_labels_pkey, update_columns: [] }
      ) @include(if: $hasInsertLabels) { affected_rows }
    }
    """

    static let deleteWorkoutMutation = """
    mutation DeleteWorkout($id: uuid!) {
      deleteWorkout(id: $id) {
        id
      }
    }
    """

    static let startSessionMutation = """
    mutation StartSession($obj: workoutSessions_insert_input!) {
      insertWorkoutSession(object: $obj) {
        id
      }
    }
    """

    static func createWorkoutObject(_ values: WorkoutFormValues) -> JSONValue {
        .object([
            "name": .string(values.name),
            "description": values.description.isEmpty ? .null : .string(values.description),
            "workoutExercises": .object([
                "data": .array(values.exercises.enumerated().map { index, exercise in
                    .object([
                        "exerciseId": GraphQLScalars.uuid(exercise.exerciseId),
                        "position": .number(Double(index + 1))
                    ])
                })
            ]),
            "workoutLabels": .object([
                "data": .array(values.labels.map(labelInsertObject(workoutId: nil)))
            ])
        ])
    }

    static func saveWorkoutVariables(
        id: String,
        initialValues: WorkoutFormValues,
        values: WorkoutFormValues
    ) -> [String: JSONValue] {
        let originalRowIds = Set(initialValues.exercises.map(\.rowId))
        let nextRowIds = Set(values.exercises.map(\.rowId))
        let deleteRowIds = initialValues.exercises
            .filter { !nextRowIds.contains($0.rowId) }
            .map(\.rowId)

        var insertRows: [JSONValue] = []
        var positionUpdates: [JSONValue] = []
        for (index, exercise) in values.exercises.enumerated() {
            let position = Double(index + 1)
            if originalRowIds.contains(exercise.rowId) {
                positionUpdates.append(.object([
                    "where": .object(["id": .object(["_eq": GraphQLScalars.uuid(exercise.rowId)])]),
                    "_set": .object(["position": .number(position)])
                ]))
            } else {
                insertRows.append(.object([
                    "workoutId": GraphQLScalars.uuid(id),
                    "exerciseId": GraphQLScalars.uuid(exercise.exerciseId),
                    "position": .number(position)
                ]))
            }
        }

        let originalLabelIds = Set(initialValues.labels.compactMap(\.id))
        let nextLabelIds = Set(values.labels.compactMap(\.id))
        let deleteLabelIds = originalLabelIds.filter { !nextLabelIds.contains($0) }.sorted()
        let insertLabels = values.labels
            .filter { label in
                guard let labelId = label.id else { return true }
                return !originalLabelIds.contains(labelId)
            }
            .map(labelInsertObject(workoutId: id))

        return [
            "id": GraphQLScalars.uuid(id),
            "set": .object([
                "name": .string(values.name),
                "description": values.description.isEmpty ? .null : .string(values.description)
            ]),
            "deleteRowIds": .array(deleteRowIds.map(GraphQLScalars.uuid)),
            "hasDeleteRows": .bool(!deleteRowIds.isEmpty),
            "insertRows": .array(insertRows),
            "hasInsertRows": .bool(!insertRows.isEmpty),
            "positionUpdates": .array(positionUpdates),
            "hasPositionUpdates": .bool(!positionUpdates.isEmpty),
            "deleteLabelIds": .array(deleteLabelIds.map(GraphQLScalars.uuid)),
            "hasDeleteLabels": .bool(!deleteLabelIds.isEmpty),
            "insertLabels": .array(insertLabels),
            "hasInsertLabels": .bool(!insertLabels.isEmpty)
        ]
    }

    private static func labelInsertObject(workoutId: String?) -> (WorkoutLabelSelection) -> JSONValue {
        { label in
            var object: [String: JSONValue] = [:]
            if let workoutId {
                object["workoutId"] = GraphQLScalars.uuid(workoutId)
            }
            if let id = label.id {
                object["labelId"] = GraphQLScalars.uuid(id)
            } else {
                object["label"] = .object([
                    "data": .object(["name": .string(label.name)]),
                    "on_conflict": .object([
                        "constraint": .string("labels_user_name_key"),
                        "update_columns": .array([])
                    ])
                ])
            }
            return .object(object)
        }
    }
}
