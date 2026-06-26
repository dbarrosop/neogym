import Foundation

public protocol SessionsRepositoryProtocol: Sendable {
    func listSessions(limit: Int, offset: Int) async throws -> [SessionListItem]
    func sessionDetail(id: String) async throws -> SessionDetailModel?
    func updateStartedAt(sessionId: String, startedAt: Date) async throws
    func deleteSession(id: String) async throws
    func addSessionExercises(sessionId: String, exercises: [ExerciseListItem], basePosition: Int) async throws
    func removeSessionExercise(id: String) async throws
    func addStrengthSet(
        workoutSessionExerciseId: String,
        setNumber: Int,
        reps: Int,
        weight: Double
    ) async throws -> String
    func updateStrengthSet(id: String, reps: Int, weight: Double) async throws
    func deleteStrengthSet(id: String) async throws
}

public struct SessionsRepository: SessionsRepositoryProtocol {
    private let graphQL: any GraphQLServicing

    public init(graphQL: any GraphQLServicing) {
        self.graphQL = graphQL
    }

    public func listSessions(limit: Int = 25, offset: Int = 0) async throws -> [SessionListItem] {
        let data: SessionsIndexData = try await graphQL.execute(
            query: Self.sessionsIndexQuery,
            variables: ["limit": .number(Double(limit)), "offset": .number(Double(offset))],
            operationName: "SessionsIndex"
        )
        return data.workoutSessions
    }

    public func sessionDetail(id: String) async throws -> SessionDetailModel? {
        let data: SessionDetailData = try await graphQL.execute(
            query: Self.sessionDetailQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "SessionDetail"
        )
        return data.workoutSession
    }

    public func updateStartedAt(sessionId: String, startedAt: Date) async throws {
        let _: UpdateSessionData = try await graphQL.execute(
            query: Self.updateSessionStartedAtMutation,
            variables: ["id": GraphQLScalars.uuid(sessionId), "startedAt": GraphQLScalars.timestamptz(startedAt)],
            operationName: "UpdateSessionStartedAt"
        )
    }

    public func deleteSession(id: String) async throws {
        let _: DeleteSessionData = try await graphQL.execute(
            query: Self.deleteSessionMutation,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "DeleteWorkoutSession"
        )
    }

    public func addSessionExercises(sessionId: String, exercises: [ExerciseListItem], basePosition: Int) async throws {
        let objects = exercises.enumerated().map { index, exercise in
            JSONValue.object([
                "workoutSessionId": GraphQLScalars.uuid(sessionId),
                "exerciseId": GraphQLScalars.uuid(exercise.id),
                "position": .number(Double(basePosition + index + 1))
            ])
        }
        let _: InsertSessionExercisesData = try await graphQL.execute(
            query: Self.insertSessionExercisesMutation,
            variables: ["objs": .array(objects)],
            operationName: "InsertWorkoutSessionExercises"
        )
    }

    public func removeSessionExercise(id: String) async throws {
        let _: DeleteSessionExerciseData = try await graphQL.execute(
            query: Self.deleteSessionExerciseMutation,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "DeleteWorkoutSessionExercise"
        )
    }

    public func addStrengthSet(
        workoutSessionExerciseId: String,
        setNumber: Int,
        reps: Int,
        weight: Double
    ) async throws -> String {
        let object = Self.strengthSetObject(
            workoutSessionExerciseId: workoutSessionExerciseId,
            setNumber: setNumber,
            reps: reps,
            weight: weight
        )
        let data: InsertStrengthSetData = try await graphQL.execute(
            query: Self.insertStrengthSetMutation,
            variables: ["obj": object],
            operationName: "InsertWorkoutSessionStrengthSet"
        )
        guard let id = data.insertWorkoutSessionStrengthSet?.id else {
            throw GraphQLDomainError.missingData(operationName: "InsertWorkoutSessionStrengthSet")
        }
        return id
    }

    public func updateStrengthSet(id: String, reps: Int, weight: Double) async throws {
        let _: UpdateStrengthSetData = try await graphQL.execute(
            query: Self.updateStrengthSetMutation,
            variables: [
                "id": GraphQLScalars.uuid(id),
                "set": .object(["reps": .number(Double(reps)), "weight": GraphQLScalars.numeric(weight)])
            ],
            operationName: "UpdateWorkoutSessionStrengthSet"
        )
    }

    public func deleteStrengthSet(id: String) async throws {
        let _: DeleteStrengthSetData = try await graphQL.execute(
            query: Self.deleteStrengthSetMutation,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "DeleteWorkoutSessionStrengthSet"
        )
    }
}

private struct SessionsIndexData: Decodable, Sendable {
    let workoutSessions: [SessionListItem]
}

private struct SessionDetailData: Decodable, Sendable {
    let workoutSession: SessionDetailModel?
}

private struct UpdateSessionData: Decodable, Sendable {
    let updateWorkoutSession: MutationIdPayload?
}

private struct DeleteSessionData: Decodable, Sendable {
    let deleteWorkoutSession: MutationIdPayload?
}

private struct InsertSessionExercisesData: Decodable, Sendable {
    let insertWorkoutSessionExercises: AffectedRowsPayload?
}

private struct DeleteSessionExerciseData: Decodable, Sendable {
    let deleteWorkoutSessionExercise: MutationIdPayload?
}

private struct InsertStrengthSetData: Decodable, Sendable {
    let insertWorkoutSessionStrengthSet: MutationIdPayload?
}

private struct UpdateStrengthSetData: Decodable, Sendable {
    let updateWorkoutSessionStrengthSet: MutationIdPayload?
}

private struct DeleteStrengthSetData: Decodable, Sendable {
    let deleteWorkoutSessionStrengthSet: MutationIdPayload?
}

private struct MutationIdPayload: Decodable, Sendable {
    let id: String
}

private struct AffectedRowsPayload: Decodable, Sendable {
    let affectedRows: Int?

    private enum CodingKeys: String, CodingKey {
        case affectedRows = "affected_rows"
    }
}

public extension SessionsRepository {
    static let sessionsIndexQuery = """
    query SessionsIndex($limit: Int!, $offset: Int!) {
      workoutSessions(order_by: { startedAt: desc }, limit: $limit, offset: $offset) {
        id
        startedAt
        workout { id name }
        workoutSessionExercises_aggregate { aggregate { count } }
        workoutSessionExercises(order_by: { position: asc }) {
          exercise { id name }
          workoutSessionStrengthSets_aggregate { aggregate { count sum { reps } } }
          workoutSessionCardioEntries_aggregate { aggregate { count } }
        }
      }
    }
    """

    static let sessionDetailQuery = """
    query SessionDetail($id: uuid!) {
      workoutSession(id: $id) {
        id
        startedAt
        workout { id name }
        workoutSessionExercises(order_by: { position: asc }) {
          id
          position
          exercise {
            id
            name
            kind
            primaryMuscleGroup
            image1FileId
            image2FileId
            strength { doubleWeight }
            cardio { metricsSchema }
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

    static let updateSessionStartedAtMutation = """
    mutation UpdateSessionStartedAt($id: uuid!, $startedAt: timestamptz!) {
      updateWorkoutSession(pk_columns: { id: $id }, _set: { startedAt: $startedAt }) {
        id
      }
    }
    """

    static let deleteSessionMutation = """
    mutation DeleteWorkoutSession($id: uuid!) {
      deleteWorkoutSession(id: $id) {
        id
      }
    }
    """

    static let insertSessionExercisesMutation = """
    mutation InsertWorkoutSessionExercises($objs: [workoutSessionExercises_insert_input!]!) {
      insertWorkoutSessionExercises(objects: $objs) {
        affected_rows
      }
    }
    """

    static let deleteSessionExerciseMutation = """
    mutation DeleteWorkoutSessionExercise($id: uuid!) {
      deleteWorkoutSessionExercise(id: $id) {
        id
      }
    }
    """

    static let insertStrengthSetMutation = """
    mutation InsertWorkoutSessionStrengthSet($obj: workoutSessionStrengthSets_insert_input!) {
      insertWorkoutSessionStrengthSet(object: $obj) {
        id
      }
    }
    """

    static let updateStrengthSetMutation = """
    mutation UpdateWorkoutSessionStrengthSet($id: uuid!, $set: workoutSessionStrengthSets_set_input!) {
      updateWorkoutSessionStrengthSet(pk_columns: { id: $id }, _set: $set) {
        id
      }
    }
    """

    static let deleteStrengthSetMutation = """
    mutation DeleteWorkoutSessionStrengthSet($id: uuid!) {
      deleteWorkoutSessionStrengthSet(id: $id) {
        id
      }
    }
    """

    static func strengthSetObject(
        workoutSessionExerciseId: String,
        setNumber: Int,
        reps: Int,
        weight: Double
    ) -> JSONValue {
        .object([
            "workoutSessionExerciseId": GraphQLScalars.uuid(workoutSessionExerciseId),
            "setNumber": .number(Double(setNumber)),
            "reps": .number(Double(reps)),
            "weight": GraphQLScalars.numeric(weight)
        ])
    }
}
