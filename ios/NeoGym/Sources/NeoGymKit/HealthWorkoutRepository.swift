import Foundation
import Nhost

/// Network-only. Each write refreshes the managed session, verifies the cursor
/// owner and pins that fresh token so an account switch cannot redirect a batch.
public struct HealthWorkoutRepository: HealthWorkoutStoring {
    private let client: NhostClient
    private let ownerUserId: String

    public init(client: NhostClient, ownerUserId: String) {
        self.client = client
        self.ownerUserId = ownerUserId
    }

    private func execute<Response: Decodable & Sendable>(
        _ type: Response.Type, query: String, variables: [String: JSONValue], operationName: String
    ) async throws -> Response {
        do {
            try Task.checkCancellation()
            guard !ownerUserId.isEmpty,
                  let session = try await client.refreshSession(marginSeconds: 60),
                  session.user?.id == ownerUserId else {
                throw CancellationError()
            }
            try Task.checkCancellation()
            let response = try await client.graphql.request(
                type,
                query: query,
                variables: variables,
                operationName: operationName,
                headers: ["Authorization": "Bearer \(session.accessToken)"]
            )
            return try GraphQLResponseMapper.unwrap(response.body, operationName: operationName)
        } catch let error as CancellationError {
            throw error
        } catch {
            throw GraphQLDomainError.map(error)
        }
    }

    public func upsert(_ snapshots: [HealthWorkoutSnapshot]) async throws {
        guard !snapshots.isEmpty else { return }
        let objects: JSONValue = .array(snapshots.map { snapshot in
            .object([
                "healthkitUuid": GraphQLScalars.uuid(snapshot.healthkitUuid),
                "raw": GraphQLScalars.jsonb(snapshot.raw)
            ])
        })
        let response: UpsertHealthWorkoutsData = try await execute(
            UpsertHealthWorkoutsData.self,
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
        let response: DeleteHealthWorkoutsData = try await execute(
            DeleteHealthWorkoutsData.self,
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
