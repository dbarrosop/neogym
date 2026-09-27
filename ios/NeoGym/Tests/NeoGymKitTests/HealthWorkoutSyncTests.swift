import Foundation
import Nhost
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

private actor SuspendedWorkoutStore: HealthWorkoutStoring {
    private var continuation: CheckedContinuation<Void, Never>?
    private let didStart: XCTestExpectation
    private var savedIds: [String] = []

    init(didStart: XCTestExpectation) { self.didStart = didStart }

    func upsert(_ snapshots: [HealthWorkoutSnapshot]) async throws {
        await withCheckedContinuation { continuation in
            self.continuation = continuation
            didStart.fulfill()
        }
        savedIds += snapshots.map(\.healthkitUuid)
    }

    func delete(healthkitIds: [String]) async throws {}
    func finishWrite() { continuation?.resume(); continuation = nil }
    func saved() -> [String] { savedIds }
}

private actor WorkoutRequestRecorder {
    private var requests: [NhostRequest] = []
    func record(_ request: NhostRequest) { requests.append(request) }
    func recorded() -> [NhostRequest] { requests }
}

private func workoutSession(userId: String, expiry: Date) throws -> StoredSession {
    let claims = try JSONSerialization.data(withJSONObject: ["exp": Int(expiry.timeIntervalSince1970)])
    let payload = claims.base64EncodedString().replacingOccurrences(of: "+", with: "-")
        .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    return try StoredSession(
        accessToken: "header.\(payload).signature",
        accessTokenExpiresIn: 900,
        refreshTokenId: "test-refresh-id",
        refreshToken: "test-refresh-token",
        user: AuthUser(
            avatarUrl: "", createdAt: Date(timeIntervalSince1970: 1_700_000_000),
            defaultRole: "user", displayName: "Test Athlete", email: "athlete@example.test",
            emailVerified: true, id: userId, isAnonymous: false, locale: "en",
            metadata: [:], phoneNumberVerified: false, roles: ["user"]
        )
    )
}

@MainActor
final class HealthWorkoutSyncTests: XCTestCase {
    func testExpiredBootstrapSessionRefreshesBeforeBothWrites() async throws {
        let recorder = WorkoutRequestRecorder()
        let expired = try workoutSession(userId: "alice", expiry: Date().addingTimeInterval(-3_600))
        let fresh = try workoutSession(userId: "alice", expiry: Date().addingTimeInterval(3_600))
        let client = createClient(NhostClientOptions(
            sessionManagement: .processLocal(storage: MemorySessionStorageBackend(session: expired)),
            transport: StubTransport { request in
                await recorder.record(request)
                if request.url.path.hasSuffix("/token") {
                    return NhostRawResponse(status: 200, body: try NhostJSON.restEncoder.encode(fresh.authSession))
                }
                let body = request.body.flatMap { String(data: $0, encoding: .utf8) } ?? ""
                let reply = body.contains("UpsertHealthWorkouts")
                    ? #"{"data":{"insertHealthWorkouts":{"affectedRows":1}}}"#
                    : #"{"data":{"deleteHealthWorkouts":{"affectedRows":1}}}"#
                return NhostRawResponse(status: 200, body: Data(reply.utf8))
            }
        ))
        let repository = HealthWorkoutRepository(client: client, ownerUserId: "alice")
        try await repository.delete(healthkitIds: [UUID().uuidString])
        try await repository.upsert([HealthWorkoutSnapshot(healthkitUuid: UUID().uuidString, raw: .object([:]))])

        let requests = await recorder.recorded()
        XCTAssertEqual(requests.filter { $0.url.path.hasSuffix("/token") }.count, 1)
        let writes = requests.filter { !$0.url.path.hasSuffix("/token") }
        XCTAssertEqual(writes.count, 2)
        XCTAssertTrue(writes.allSatisfy { request in
            request.headers.first { $0.key.lowercased() == "authorization" }?.value
                == "Bearer \(fresh.accessToken)"
        })
        XCTAssertNotEqual(expired.accessToken, fresh.accessToken)
    }

    func testChangedSessionOwnerSendsNoWritesAndCommitsNoCursor() async throws {
        let recorder = WorkoutRequestRecorder()
        let current = try workoutSession(userId: "bob", expiry: Date().addingTimeInterval(3_600))
        let client = createClient(NhostClientOptions(
            sessionManagement: .processLocal(storage: MemorySessionStorageBackend(session: current)),
            transport: StubTransport { request in
                await recorder.record(request)
                return NhostRawResponse(status: 200, body: Data())
            }
        ))
        let defaults = try XCTUnwrap(UserDefaults(suiteName: UUID().uuidString))
        let model = HealthWorkoutSyncModel(defaults: defaults)
        let batch = HealthWorkoutChangeBatch(
            added: [HealthWorkoutSnapshot(healthkitUuid: UUID().uuidString, raw: .object([:]))],
            deletedIds: [], nextAnchor: Data([1]), hasMore: false
        )
        await model.sync(
            userId: "alice", importer: FakeWorkoutImporter([batch]),
            repository: HealthWorkoutRepository(client: client, ownerUserId: "alice")
        )
        let requests = await recorder.recorded()
        XCTAssertTrue(requests.isEmpty)
        XCTAssertNil(defaults.data(forKey: "health-workouts.anchor.alice"))
    }

    func testAccountSwitchAfterDeleteDoesNotUpsertOrAdvanceOldCursor() async throws {
        let recorder = WorkoutRequestRecorder()
        let original = try workoutSession(userId: "alice", expiry: Date().addingTimeInterval(3_600))
        let storage = MemorySessionStorageBackend(session: original)
        let switched = try workoutSession(userId: "bob", expiry: Date().addingTimeInterval(3_600))
        let client = createClient(NhostClientOptions(
            sessionManagement: .processLocal(storage: storage),
            transport: StubTransport { request in
                await recorder.record(request)
                try await storage.set(switched)
                return NhostRawResponse(
                    status: 200,
                    body: Data(#"{"data":{"deleteHealthWorkouts":{"affectedRows":1}}}"#.utf8)
                )
            }
        ))
        let defaults = try XCTUnwrap(UserDefaults(suiteName: UUID().uuidString))
        let model = HealthWorkoutSyncModel(defaults: defaults)
        let batch = HealthWorkoutChangeBatch(
            added: [HealthWorkoutSnapshot(healthkitUuid: UUID().uuidString, raw: .object([:]))],
            deletedIds: [UUID().uuidString], nextAnchor: Data([1]), hasMore: false
        )
        await model.sync(
            userId: "alice", importer: FakeWorkoutImporter([batch]),
            repository: HealthWorkoutRepository(client: client, ownerUserId: "alice")
        )
        let requests = await recorder.recorded()
        XCTAssertEqual(requests.count, 1)
        let authorization = requests.first?.headers.first { $0.key.lowercased() == "authorization" }?.value
        XCTAssertEqual(authorization, "Bearer \(original.accessToken)")
        XCTAssertNil(defaults.data(forKey: "health-workouts.anchor.alice"))
    }

    func testUserSwitchWhileOldWriteIsInFlightStartsNewImportWithoutCommittingOldCursor() async throws {
        let defaults = try XCTUnwrap(UserDefaults(suiteName: UUID().uuidString))
        let started = expectation(description: "Old account write started")
        let oldStore = SuspendedWorkoutStore(didStart: started)
        let oldModel = HealthWorkoutSyncModel(defaults: defaults)
        let oldBatch = HealthWorkoutChangeBatch(
            added: [HealthWorkoutSnapshot(healthkitUuid: "a", raw: .object([:]))],
            deletedIds: [], nextAnchor: Data([1]), hasMore: false
        )
        let oldTask = Task {
            await oldModel.sync(userId: "alice", importer: FakeWorkoutImporter([oldBatch]), repository: oldStore)
        }
        await fulfillment(of: [started], timeout: 5)

        // Replacing the account-bound shell cancels A and mounts a fresh model
        // for B, even when the selected area remains Workouts.
        oldTask.cancel()
        let newModel = HealthWorkoutSyncModel(defaults: defaults)
        let newStore = FakeWorkoutStore()
        let newImporter = FakeWorkoutImporter([HealthWorkoutChangeBatch(
            added: [HealthWorkoutSnapshot(healthkitUuid: "b", raw: .object([:]))],
            deletedIds: [], nextAnchor: Data([2]), hasMore: false
        )])
        await newModel.sync(userId: "bob", importer: newImporter, repository: newStore)
        await oldStore.finishWrite()
        await oldTask.value

        XCTAssertNil(defaults.data(forKey: "health-workouts.anchor.alice"))
        XCTAssertEqual(defaults.data(forKey: "health-workouts.anchor.bob"), Data([2]))
        let oldSaved = await oldStore.saved()
        let leakedToBob = await newStore.saved("a")
        let bobSaved = await newStore.saved("b")
        XCTAssertEqual(oldSaved, ["a"])
        XCTAssertNil(leakedToBob)
        XCTAssertNotNil(bobSaved)
        XCTAssertEqual(newModel.state.value, HealthWorkoutSyncSummary(importedOrUpdated: 1, deleted: 0))
    }

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
