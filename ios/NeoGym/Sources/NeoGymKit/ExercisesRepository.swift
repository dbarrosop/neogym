import Foundation

public protocol ExercisesRepositoryProtocol: Sendable {
    func listExercises() async throws -> [ExerciseListItem]
    func exerciseListUpdates() -> AsyncThrowingStream<[ExerciseListItem], Error>
    func exerciseDetailUpdates(id: String) -> AsyncThrowingStream<ExerciseDetailModel?, Error>
    func exerciseDetail(id: String) async throws -> ExerciseDetailModel?
    func exercisePickerExercises() async throws -> [ExerciseListItem]
    func priorSessionsPerExercise(exerciseIds: [String]) async throws -> [ExercisePriorSessions]
    func startAdHocSession(exerciseId: String, startedAt: Date) async throws -> String
}

public extension ExercisesRepositoryProtocol {
    func exerciseListUpdates() -> AsyncThrowingStream<[ExerciseListItem], Error> {
        singleValueUpdates { try await listExercises() }
    }

    func exerciseDetailUpdates(id: String) -> AsyncThrowingStream<ExerciseDetailModel?, Error> {
        singleValueUpdates { try await exerciseDetail(id: id) }
    }
}

public struct ExercisesRepository: ExercisesRepositoryProtocol {
    private let graphQL: any GraphQLServicing

    public init(graphQL: any GraphQLServicing) {
        self.graphQL = graphQL
    }

    public func listExercises() async throws -> [ExerciseListItem] {
        let data: ExercisesIndexData = try await graphQL.execute(
            query: Self.exercisesIndexQuery,
            operationName: "ExercisesIndex"
        )
        return data.exercises
    }

    public func exerciseListUpdates() -> AsyncThrowingStream<[ExerciseListItem], Error> {
        graphQL.cachedValues(
            ExercisesIndexData.self,
            query: Self.exercisesIndexQuery,
            operationName: "ExercisesIndex",
            namespace: "exercises",
            tags: ["exercises"],
            transform: \ExercisesIndexData.exercises
        )
    }

    public func exerciseDetailUpdates(id: String) -> AsyncThrowingStream<ExerciseDetailModel?, Error> {
        graphQL.cachedValues(
            ExerciseDetailData.self,
            query: Self.exerciseDetailQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "ExerciseDetail",
            namespace: "exercises",
            tags: ["exercises"],
            transform: \ExerciseDetailData.exercise
        )
    }

    public func exerciseDetail(id: String) async throws -> ExerciseDetailModel? {
        let data: ExerciseDetailData = try await graphQL.execute(
            query: Self.exerciseDetailQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "ExerciseDetail"
        )
        return data.exercise
    }

    public func exercisePickerExercises() async throws -> [ExerciseListItem] {
        let data: ExercisePickerExercisesData = try await graphQL.execute(
            query: Self.exercisePickerExercisesQuery,
            operationName: "ExercisePickerExercises"
        )
        return data.exercises
    }

    public func priorSessionsPerExercise(exerciseIds: [String]) async throws -> [ExercisePriorSessions] {
        let data: PriorSessionsPerExerciseData = try await graphQL.execute(
            query: Self.priorSessionsPerExerciseQuery,
            variables: ["exerciseIds": .array(exerciseIds.map(GraphQLScalars.uuid))],
            operationName: "PriorSessionsPerExercise"
        )
        return data.exercises
    }

    public func startAdHocSession(exerciseId: String, startedAt: Date) async throws -> String {
        let object: JSONValue = .object([
            "workoutId": .null,
            "startedAt": GraphQLScalars.timestamptz(startedAt),
            "workoutSessionExercises": .object([
                "data": .array([
                    .object([
                        "exerciseId": GraphQLScalars.uuid(exerciseId),
                        "position": .number(0)
                    ])
                ])
            ])
        ])
        let data: StartSessionData = try await graphQL.execute(
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

public struct ExercisePriorSessions: Decodable, Identifiable, Sendable, Equatable {
    public let id: String
    public let workoutSessionExercises: [ExerciseHistoryEntry]

    public init(id: String, workoutSessionExercises: [ExerciseHistoryEntry]) {
        self.id = id
        self.workoutSessionExercises = workoutSessionExercises
    }
}

private struct ExercisesIndexData: Decodable, Sendable {
    let exercises: [ExerciseListItem]
}

private struct ExerciseDetailData: Decodable, Sendable {
    let exercise: ExerciseDetailModel?
}

private struct ExercisePickerExercisesData: Decodable, Sendable {
    let exercises: [ExerciseListItem]
}

private struct PriorSessionsPerExerciseData: Decodable, Sendable {
    let exercises: [ExercisePriorSessions]
}

private struct StartSessionData: Decodable, Sendable {
    let insertWorkoutSession: InsertWorkoutSessionPayload?
}

private struct InsertWorkoutSessionPayload: Decodable, Sendable {
    let id: String
}

public extension ExercisesRepository {
    static let exercisesIndexQuery = """
    query ExercisesIndex {
      exercises(order_by: { name: asc }) {
        id
        name
        strength { doubleWeight }
        primaryMuscleGroup
        category
        equipment
        level
        isPublic
        secondaryMuscleGroups { muscleGroup }
      }
    }
    """

    static let exerciseDetailQuery = """
    query ExerciseDetail($id: uuid!) {
      exercise(id: $id) {
        id
        name
        instructions
        image1FileId
        image2FileId
        level
        category
        kind
        equipment
        primaryMuscleGroup
        isPublic
        strength {
          doubleWeight
          force
          mechanic
        }
        cardio { metricsSchema }
        secondaryMuscleGroups { muscleGroup }
        workoutSessionExercises {
          id
          workoutSession {
            id
            startedAt
            workout { id name }
          }
          workoutSessionStrengthSets(order_by: { setNumber: asc }) {
            id
            setNumber
            reps
            weight
          }
          workoutSessionCardioEntries(order_by: { entryNumber: asc }) {
            id
            entryNumber
            metrics
          }
        }
      }
    }
    """

    static let exercisePickerExercisesQuery = """
    query ExercisePickerExercises {
      exercises(order_by: { name: asc }) {
        id
        name
        strength { doubleWeight }
        primaryMuscleGroup
        category
        equipment
        level
        isPublic
        secondaryMuscleGroups { muscleGroup }
      }
    }
    """

    static let priorSessionsPerExerciseQuery = """
    query PriorSessionsPerExercise($exerciseIds: [uuid!]!) {
      exercises(where: { id: { _in: $exerciseIds } }, order_by: { name: asc }) {
        id
        workoutSessionExercises(order_by: { workoutSession: { startedAt: desc } }) {
          id
          workoutSession {
            id
            startedAt
            workout { id name }
          }
          workoutSessionStrengthSets(order_by: { setNumber: asc }) {
            id
            setNumber
            reps
            weight
          }
          workoutSessionCardioEntries(order_by: { entryNumber: asc }) {
            id
            entryNumber
            metrics
          }
        }
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
}
