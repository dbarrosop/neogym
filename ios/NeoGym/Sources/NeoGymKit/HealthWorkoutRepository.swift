import Foundation

/// Network-only: sync must never mistake a cached write or read for a committed import.
public struct HealthWorkoutRepository: HealthWorkoutStoring {
    private let graphQL: any GraphQLServicing

    public init(graphQL: any GraphQLServicing) {
        self.graphQL = graphQL
    }

    public func upsert(_ snapshots: [HealthWorkoutSnapshot]) async throws {
        guard !snapshots.isEmpty else { return }
        let objects: JSONValue = .array(snapshots.map { snapshot in
            .object([
                "healthkitUuid": GraphQLScalars.uuid(snapshot.healthkitUuid),
                "raw": GraphQLScalars.jsonb(snapshot.raw)
            ])
        })
        let response: UpsertHealthWorkoutsData = try await graphQL.execute(
            query: Self.upsertMutation,
            variables: ["objects": objects],
            operationName: "UpsertHealthWorkouts"
        )
        guard response.insertHealthWorkouts?.affectedRows == snapshots.count else {
            throw GraphQLDomainError.missingData(operationName: "UpsertHealthWorkouts")
        }
    }

    public func delete(healthkitIds: [String]) async throws {
        guard !healthkitIds.isEmpty else { return }
        let response: DeleteHealthWorkoutsData = try await graphQL.execute(
            query: Self.deleteMutation,
            variables: ["ids": .array(healthkitIds.map(GraphQLScalars.uuid))],
            operationName: "DeleteHealthWorkouts"
        )
        guard response.deleteHealthWorkouts != nil else {
            throw GraphQLDomainError.missingData(operationName: "DeleteHealthWorkouts")
        }
    }

    public static let upsertMutation = """
    mutation UpsertHealthWorkouts($objects: [healthWorkout_insert_input!]!) {
      insertHealthWorkouts(
        objects: $objects,
        on_conflict: { constraint: health_workouts_user_healthkit_uuid_key, update_columns: [raw] }
      ) { affectedRows: affected_rows }
    }
    """

    public static let deleteMutation = """
    mutation DeleteHealthWorkouts($ids: [uuid!]!) {
      deleteHealthWorkouts(where: { healthkitUuid: { _in: $ids } }) { affectedRows: affected_rows }
    }
    """
}

private struct UpsertHealthWorkoutsData: Decodable, Sendable {
    let insertHealthWorkouts: HealthWorkoutMutationPayload?
}

private struct DeleteHealthWorkoutsData: Decodable, Sendable {
    let deleteHealthWorkouts: HealthWorkoutMutationPayload?
}

private struct HealthWorkoutMutationPayload: Decodable, Sendable {
    let affectedRows: Int
}
