import Foundation
import XCTest
@testable import NeoGymKit

private actor FakeWorkoutImporter: HealthWorkoutImporting {
    var batches: [HealthWorkoutChangeBatch]
    var seenAnchors: [Data?] = []

    init(_ batches: [HealthWorkoutChangeBatch]) { self.batches = batches }

    func changes(since anchor: Data?) async throws -> HealthWorkoutChangeBatch {
        seenAnchors.append(anchor)
        return batches.removeFirst()
    }

    func anchors() -> [Data?] { seenAnchors }
}

private enum WorkoutStoreFailure: Error { case unavailable }

private actor FakeWorkoutStore: HealthWorkoutStoring {
    var snapshots: [String: JSONValue] = [:]
    var deleted: [String] = []
    var failUpsert = false

    func upsert(_ values: [HealthWorkoutSnapshot]) async throws {
        if failUpsert { throw WorkoutStoreFailure.unavailable }
        for value in values { snapshots[value.healthkitUuid] = value.raw }
    }

    func delete(healthkitIds: [String]) async throws {
        deleted += healthkitIds
        for id in healthkitIds { snapshots.removeValue(forKey: id) }
    }

    func setFailUpsert(_ fail: Bool) { failUpsert = fail }
    func saved(_ id: String) -> JSONValue? { snapshots[id] }
    func deletedIds() -> [String] { deleted }
}

@MainActor
final class HealthWorkoutSyncTests: XCTestCase {
    func testPagedUpsertDeletionAndPerUserAnchor() async throws {
        let defaults = try XCTUnwrap(UserDefaults(suiteName: UUID().uuidString))
        let first = HealthWorkoutChangeBatch(
            added: [HealthWorkoutSnapshot(healthkitUuid: "one", raw: .object(["calories": .number(210)]))],
            deletedIds: [], nextAnchor: Data([1]), hasMore: true
        )
        let second = HealthWorkoutChangeBatch(
            added: [HealthWorkoutSnapshot(healthkitUuid: "one", raw: .object(["calories": .number(220)]))],
            deletedIds: ["one"], nextAnchor: Data([2]), hasMore: false
        )
        let importer = FakeWorkoutImporter([first, second])
        let repository = FakeWorkoutStore()
        let model = HealthWorkoutSyncModel(defaults: defaults)
        await model.sync(userId: "alice", importer: importer, repository: repository)
        let anchors = await importer.anchors()
        XCTAssertEqual(anchors.count, 2)
        XCTAssertNil(anchors[0])
        XCTAssertEqual(anchors[1], Data([1]))
        XCTAssertEqual(defaults.data(forKey: "health-workouts.anchor.alice"), Data([2]))
        XCTAssertNil(defaults.data(forKey: "health-workouts.anchor.bob"))
        let saved = await repository.saved("one")
        XCTAssertEqual(saved, .object(["calories": .number(220)]))
        let deletedIds = await repository.deletedIds()
        XCTAssertEqual(deletedIds, ["one"])
        XCTAssertEqual(model.state.value, HealthWorkoutSyncSummary(importedOrUpdated: 2, deleted: 1))
    }

    func testEmptyFirstReadKeepsCursorUnsetForFutureAuthorization() async throws {
        let defaults = try XCTUnwrap(UserDefaults(suiteName: UUID().uuidString))
        let model = HealthWorkoutSyncModel(defaults: defaults)
        let empty = HealthWorkoutChangeBatch(added: [], deletedIds: [], nextAnchor: Data([9]), hasMore: false)
        await model.sync(userId: "alice", importer: FakeWorkoutImporter([empty]), repository: FakeWorkoutStore())
        XCTAssertNil(defaults.data(forKey: "health-workouts.anchor.alice"))
    }

    func testFailedWriteDoesNotAdvanceAnchorAndRetryIsIdempotent() async throws {
        let defaults = try XCTUnwrap(UserDefaults(suiteName: UUID().uuidString))
        let batch = HealthWorkoutChangeBatch(
            added: [HealthWorkoutSnapshot(healthkitUuid: "one", raw: .object(["type": .string("run")]))],
            deletedIds: ["stale"], nextAnchor: Data([3]), hasMore: false
        )
        let repository = FakeWorkoutStore()
        let model = HealthWorkoutSyncModel(defaults: defaults)
        await repository.setFailUpsert(true)
        await model.sync(userId: "alice", importer: FakeWorkoutImporter([batch]), repository: repository)
        XCTAssertNil(defaults.data(forKey: "health-workouts.anchor.alice"))
        guard case .failed = model.state else { return XCTFail("Expected write error") }
        await repository.setFailUpsert(false)
        await model.sync(userId: "alice", importer: FakeWorkoutImporter([batch]), repository: repository)
        XCTAssertEqual(defaults.data(forKey: "health-workouts.anchor.alice"), Data([3]))
        let saved = await repository.saved("one")
        XCTAssertEqual(saved, .object(["type": .string("run")]))
    }
}
