import Foundation

public protocol SessionsRepositoryProtocol: Sendable {
    func listSessions(limit: Int, offset: Int) async throws -> [SessionListItem]
    func sessionListUpdates(limit: Int, offset: Int) -> AsyncThrowingStream<[SessionListItem], Error>
    func sessionDetailUpdates(id: String) -> AsyncThrowingStream<SessionDetailModel?, Error>
    func sessionDetail(id: String) async throws -> SessionDetailModel?
    func priorSessionsPerExercise(exerciseIds: [String], excludeSessionId: String) async throws -> SessionPriorHistory
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
    func addCardioEntry(
        workoutSessionExerciseId: String,
        entryNumber: Int,
        metrics: CardioMetrics
    ) async throws -> String
    func updateCardioEntry(id: String, metrics: CardioMetrics) async throws
    func deleteCardioEntry(id: String) async throws
}

public extension SessionsRepositoryProtocol {
    func sessionListUpdates(limit: Int, offset: Int) -> AsyncThrowingStream<[SessionListItem], Error> {
        singleValueUpdates { try await listSessions(limit: limit, offset: offset) }
    }

    func sessionDetailUpdates(id: String) -> AsyncThrowingStream<SessionDetailModel?, Error> {
        singleValueUpdates { try await sessionDetail(id: id) }
    }
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

    public func sessionListUpdates(
        limit: Int,
        offset: Int
    ) -> AsyncThrowingStream<[SessionListItem], Error> {
        graphQL.cachedValues(
            SessionsIndexData.self,
            query: Self.sessionsIndexQuery,
            variables: ["limit": .number(Double(limit)), "offset": .number(Double(offset))],
            operationName: "SessionsIndex",
            namespace: "sessions",
            tags: ["sessions"],
            transform: \SessionsIndexData.workoutSessions
        )
    }

    public func sessionDetailUpdates(id: String) -> AsyncThrowingStream<SessionDetailModel?, Error> {
        graphQL.cachedValues(
            SessionDetailData.self,
            query: Self.sessionDetailQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "SessionDetail",
            namespace: "sessions",
            tags: ["sessions"],
            transform: \SessionDetailData.workoutSession
        )
    }

    public func sessionDetail(id: String) async throws -> SessionDetailModel? {
        let data: SessionDetailData = try await graphQL.execute(
            query: Self.sessionDetailQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "SessionDetail"
        )
        return data.workoutSession
    }

    public func priorSessionsPerExercise(exerciseIds: [String], excludeSessionId: String) async throws -> SessionPriorHistory {
        guard !exerciseIds.isEmpty else { return SessionPriorHistory() }
        let data: PriorSessionsData = try await graphQL.execute(
            query: Self.priorSessionsPerExerciseQuery,
            variables: [
                "exerciseIds": .array(exerciseIds.map(GraphQLScalars.uuid)),
                "excludeSessionId": GraphQLScalars.uuid(excludeSessionId)
            ],
            operationName: "PriorSessionsPerExercise"
        )
        return SessionPriorHistory(exercises: data.exercises)
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

    public func addCardioEntry(
        workoutSessionExerciseId: String,
        entryNumber: Int,
        metrics: CardioMetrics
    ) async throws -> String {
        let data: InsertCardioEntryData = try await graphQL.execute(
            query: Self.insertCardioEntryMutation,
            variables: [
                "obj": Self.cardioEntryObject(
                    workoutSessionExerciseId: workoutSessionExerciseId,
                    entryNumber: entryNumber,
                    metrics: metrics
                )
            ],
            operationName: "InsertWorkoutSessionCardioEntry"
        )
        guard let id = data.insertWorkoutSessionCardioEntry?.id else {
            throw GraphQLDomainError.missingData(operationName: "InsertWorkoutSessionCardioEntry")
        }
        return id
    }

    public func updateCardioEntry(id: String, metrics: CardioMetrics) async throws {
        let _: UpdateCardioEntryData = try await graphQL.execute(
            query: Self.updateCardioEntryMutation,
            variables: [
                "id": GraphQLScalars.uuid(id),
                "set": .object(["metrics": Self.metricsJSON(metrics)])
            ],
            operationName: "UpdateWorkoutSessionCardioEntry"
        )
    }

    public func deleteCardioEntry(id: String) async throws {
        let _: DeleteCardioEntryData = try await graphQL.execute(
            query: Self.deleteCardioEntryMutation,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "DeleteWorkoutSessionCardioEntry"
        )
    }
}

private struct SessionsIndexData: Decodable, Sendable {
    let workoutSessions: [SessionListItem]
}

private struct SessionDetailData: Decodable, Sendable {
    let workoutSession: SessionDetailModel?
}

private struct PriorSessionsData: Decodable, Sendable {
    let exercises: [SessionPriorExerciseHistory]
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

private struct InsertCardioEntryData: Decodable, Sendable {
    let insertWorkoutSessionCardioEntry: MutationIdPayload?
}

private struct UpdateCardioEntryData: Decodable, Sendable {
    let updateWorkoutSessionCardioEntry: MutationIdPayload?
}

private struct DeleteCardioEntryData: Decodable, Sendable {
    let deleteWorkoutSessionCardioEntry: MutationIdPayload?
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
        workout { id name description }
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

    static let priorSessionsPerExerciseQuery = """
    query PriorSessionsPerExercise($exerciseIds: [uuid!]!, $excludeSessionId: uuid!) {
      exercises(where: { id: { _in: $exerciseIds } }) {
        id
        workoutSessionExercises(
          limit: 3
          order_by: { workoutSession: { startedAt: desc } }
          where: { workoutSessionId: { _neq: $excludeSessionId } }
        ) {
          id
          workoutSession {
            id
            startedAt
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

    static let insertCardioEntryMutation = """
    mutation InsertWorkoutSessionCardioEntry($obj: workoutSessionCardioEntries_insert_input!) {
      insertWorkoutSessionCardioEntry(object: $obj) {
        id
      }
    }
    """

    static let updateCardioEntryMutation = """
    mutation UpdateWorkoutSessionCardioEntry($id: uuid!, $set: workoutSessionCardioEntries_set_input!) {
      updateWorkoutSessionCardioEntry(pk_columns: { id: $id }, _set: $set) {
        id
      }
    }
    """

    static let deleteCardioEntryMutation = """
    mutation DeleteWorkoutSessionCardioEntry($id: uuid!) {
      deleteWorkoutSessionCardioEntry(id: $id) {
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

    static func cardioEntryObject(
        workoutSessionExerciseId: String,
        entryNumber: Int,
        metrics: CardioMetrics
    ) -> JSONValue {
        .object([
            "workoutSessionExerciseId": GraphQLScalars.uuid(workoutSessionExerciseId),
            "entryNumber": .number(Double(entryNumber)),
            "metrics": metricsJSON(metrics)
        ])
    }

    static func metricsJSON(_ metrics: CardioMetrics) -> JSONValue {
        .object(Dictionary(uniqueKeysWithValues: metrics.map { key, value in
            (key, .number(value))
        }))
    }
}
