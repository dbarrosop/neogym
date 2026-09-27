import Combine
import Foundation

/// A snapshot of one HKWorkout. The ID is HealthKit's stable UUID, not a NeoGym session ID.
public struct HealthWorkoutSnapshot: Sendable, Equatable {
    public let healthkitUuid: String
    public let raw: JSONValue

    public init(healthkitUuid: String, raw: JSONValue) {
        self.healthkitUuid = healthkitUuid
        self.raw = raw
    }
}

public struct HealthWorkoutChangeBatch: Sendable {
    public let added: [HealthWorkoutSnapshot]
    public let deletedIds: [String]
    public let nextAnchor: Data
    public let hasMore: Bool

    public init(added: [HealthWorkoutSnapshot], deletedIds: [String], nextAnchor: Data, hasMore: Bool) {
        self.added = added
        self.deletedIds = deletedIds
        self.nextAnchor = nextAnchor
        self.hasMore = hasMore
    }
}

public protocol HealthWorkoutImporting: Sendable {
    func changes(since anchor: Data?) async throws -> HealthWorkoutChangeBatch
}

public protocol HealthWorkoutStoring: Sendable {
    func upsert(_ snapshots: [HealthWorkoutSnapshot]) async throws
    func delete(healthkitIds: [String]) async throws
}

public struct HealthWorkoutSyncSummary: Sendable, Equatable {
    public let importedOrUpdated: Int
    public let deleted: Int

    public init(importedOrUpdated: Int, deleted: Int) {
        self.importedOrUpdated = importedOrUpdated
        self.deleted = deleted
    }
}

@MainActor
public final class HealthWorkoutSyncModel: ObservableObject {
    @Published public private(set) var state: Loadable<HealthWorkoutSyncSummary> = .idle
    private let defaults: UserDefaults
    private var isSyncing = false

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    public func sync(userId: String, importer: any HealthWorkoutImporting, repository: any HealthWorkoutStoring) async {
        guard !userId.isEmpty, !isSyncing else { return }
        isSyncing = true
        state = .loading(previous: state.value)
        defer { isSyncing = false }
        let key = "health-workouts.anchor.\(userId)"
        var anchor = defaults.data(forKey: key)
        var importedOrUpdated = 0
        var deleted = 0
        do {
            repeat {
                try Task.checkCancellation()
                let batch = try await importer.changes(since: anchor)
                try Task.checkCancellation()
                // A replacement can appear with the same UUID in both collections.
                // Delete first, then upsert so the replacement wins.
                if !batch.deletedIds.isEmpty {
                    try await repository.delete(healthkitIds: batch.deletedIds)
                }
                try Task.checkCancellation()
                if !batch.added.isEmpty {
                    try await repository.upsert(batch.added)
                }
                try Task.checkCancellation()
                // Do not commit an empty cursor: HealthKit does not disclose
                // whether read access was denied, so a nil-anchor empty read must
                // retry the full history after the user grants permission later.
                // Retrying a failed page is safe: both writes are idempotent.
                if !batch.added.isEmpty || !batch.deletedIds.isEmpty {
                    defaults.set(batch.nextAnchor, forKey: key)
                    anchor = batch.nextAnchor
                }
                importedOrUpdated += batch.added.count
                deleted += batch.deletedIds.count
                if !batch.hasMore { break }
            } while true
            state = .loaded(HealthWorkoutSyncSummary(importedOrUpdated: importedOrUpdated, deleted: deleted))
        } catch where GraphQLDomainError.isCancellation(error) || error is CancellationError {
            state = state.cancellationFallback
        } catch {
            state = .failed(message: "Apple Health workout sync failed: \(error.localizedDescription)", previous: state.value)
        }
    }
}
