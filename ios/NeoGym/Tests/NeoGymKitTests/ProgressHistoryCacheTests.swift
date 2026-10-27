import Foundation
import XCTest
@testable import NeoGymKit

/// Shared loading contract used by both Progress panes; repository/SDK identity is
/// exercised separately with the real pane models in their integration tests.
final class ProgressHistoryCacheTests: XCTestCase {
    @MainActor
    func testExactKeyWinsWithoutSearchingOlderKeysOrStartingNetworkDuringProbe() async throws {
        let fixture = ProgressCacheFixture(snapshots: ["2026-07-07": [7], "2026-07-06": [6]], hold: .cache)
        let model = try makeModel(fixture)
        let load = Task { await model.load() }
        await fixture.waitUntilBlocked()
        let beforeRelease = await fixture.calls()
        XCTAssertEqual(beforeRelease.cache.count, 1)
        XCTAssertTrue(beforeRelease.live.isEmpty)
        XCTAssertNil(model.rows)
        await fixture.releaseBlocked()
        await load.value
        XCTAssertEqual(model.rows, [7])
        XCTAssertNil(model.cachedThrough)
        let calls = await fixture.calls()
        XCTAssertEqual(calls.cache.map(\.through), ["2026-07-07"])
        XCTAssertEqual(calls.live.map(\.through), ["2026-07-07"])
    }

    @MainActor
    func testNearestEligibleSnapshotRendersBeforeRevalidationAndSurvivesFailure() async throws {
        let fixture = ProgressCacheFixture(snapshots: ["2026-07-05": [5], "2026-07-04": [4]], hold: .live)
        let model = try makeModel(fixture)
        let load = Task { await model.load() }
        await fixture.waitUntilBlocked()
        XCTAssertEqual(model.rows, [5])
        XCTAssertEqual(model.cachedThrough, "2026-07-05")
        let calls = await fixture.calls()
        XCTAssertEqual(calls.cache.map(\.through), ["2026-07-07", "2026-07-06", "2026-07-05"])
        XCTAssertEqual(calls.cache.map(\.from), ["2026-01-09", "2026-01-08", "2026-01-07"])
        XCTAssertTrue(calls.cache.allSatisfy { $0.zone == "America/New_York" })
        XCTAssertEqual(calls.live, [.init(from: "2026-01-09", through: "2026-07-07", zone: "America/New_York")])
        await fixture.releaseBlocked()
        await load.value
        XCTAssertEqual(model.rows, [5])
        XCTAssertEqual(model.cachedThrough, "2026-07-05")
        XCTAssertNotNil(model.state.errorMessage)
        // Jan 8 widens today's request, but the Jan 5 hit already starts Jan 7.
        // Do not mislabel that actual displayed range as too short.
        await model.extendHistory(to: try date("2026-01-08T12:00:00Z"))
        XCTAssertFalse(model.isShowingPartialHistory)
        await model.extendHistory(to: try date("2026-01-06T12:00:00Z"))
        XCTAssertTrue(model.isShowingPartialHistory)
        XCTAssertEqual(model.cachedThrough, "2026-07-05")
        let afterExtension = await fixture.calls()
        XCTAssertEqual(afterExtension.cache, calls.cache)
    }

    @MainActor
    func testCurrentEmissionClearsPriorRangeAndPartialLabels() async throws {
        let fixture = ProgressCacheFixture(snapshots: ["2026-07-06": [6]], hold: .live, fresh: [7])
        let model = try makeModel(fixture)
        let load = Task { await model.load() }
        await fixture.waitUntilBlocked()
        XCTAssertEqual(model.rows, [6])
        XCTAssertEqual(model.cachedThrough, "2026-07-06")
        await fixture.releaseBlocked()
        await load.value
        XCTAssertEqual(model.rows, [7])
        XCTAssertNil(model.cachedThrough)
        XCTAssertFalse(model.isShowingPartialHistory)
        XCTAssertNil(model.state.errorMessage)
    }

    @MainActor
    func testSeventhPriorDayAndEmptyCachedDatasetAreEligible() async throws {
        let fixture = ProgressCacheFixture(snapshots: ["2026-06-30": []])
        let model = try makeModel(fixture)
        await model.load()
        XCTAssertEqual(model.rows, [])
        XCTAssertEqual(model.cachedThrough, "2026-06-30")
        XCTAssertNotNil(model.state.errorMessage)
        let calls = await fixture.calls()
        XCTAssertEqual(calls.cache.count, 8)
        XCTAssertEqual(calls.cache.last?.from, "2026-01-02")
        XCTAssertEqual(calls.cache.last?.through, "2026-06-30")
    }

    @MainActor
    func testNoEligibleHitStopsAfterSevenPriorDaysAndRetainsNormalFailure() async throws {
        let fixture = ProgressCacheFixture(snapshots: ["2026-06-29": [99]])
        let model = try makeModel(fixture)
        await model.load()
        XCTAssertNil(model.rows)
        XCTAssertNil(model.cachedThrough)
        XCTAssertNotNil(model.state.errorMessage)
        let calls = await fixture.calls()
        XCTAssertEqual(calls.cache.map(\.through), [
            "2026-07-07", "2026-07-06", "2026-07-05", "2026-07-04",
            "2026-07-03", "2026-07-02", "2026-07-01", "2026-06-30"
        ])
        XCTAssertEqual(calls.live.count, 1)
    }

    @MainActor
    func testColdCustomWindowNeverProbesDefaultKeys() async throws {
        let fixture = ProgressCacheFixture(snapshots: ["2026-07-07": [7]])
        let model = try makeModel(fixture)
        await model.extendHistory(to: try date("2025-12-01T12:00:00Z"))
        XCTAssertNil(model.rows)
        let calls = await fixture.calls()
        XCTAssertTrue(calls.cache.isEmpty)
        XCTAssertEqual(calls.live.map(\.from), ["2025-12-01"])
    }

    @MainActor
    func testCancelledCacheProbeCannotPublishOrStartStream() async throws {
        let fixture = ProgressCacheFixture(snapshots: ["2026-07-07": [7]], hold: .cache)
        let model = try makeModel(fixture)
        let load = Task { await model.load() }
        await fixture.waitUntilBlocked()
        load.cancel()
        await fixture.releaseBlocked()
        await load.value
        XCTAssertNil(model.rows)
        let calls = await fixture.calls()
        XCTAssertEqual(calls.cache.count, 1)
        XCTAssertTrue(calls.live.isEmpty)
    }

    @MainActor
    func testSupersededCacheProbeCannotReplaceNewerLoadOrStartStream() async throws {
        let fixture = ProgressCacheFixture(snapshots: ["2026-07-07": [7]], hold: .cache, fresh: [99])
        let model = try makeModel(fixture)
        let first = Task { await model.load() }
        await fixture.waitUntilBlocked()
        await model.load()
        XCTAssertEqual(model.rows, [99])
        await fixture.releaseBlocked()
        await first.value
        XCTAssertEqual(model.rows, [99])
        XCTAssertNil(model.cachedThrough)
        let calls = await fixture.calls()
        XCTAssertEqual(calls.cache.count, 2)
        XCTAssertEqual(calls.live.count, 1)
    }

    @MainActor
    func testExtensionSupersedesPendingDefaultProbeWithoutPublishingShorterData() async throws {
        let fixture = ProgressCacheFixture(snapshots: ["2026-07-06": [6]], hold: .cache, fresh: [99])
        let model = try makeModel(fixture)
        let first = Task { await model.load() }
        await fixture.waitUntilBlocked()
        await model.extendHistory(to: try date("2025-12-01T12:00:00Z"))
        await fixture.releaseBlocked()
        await first.value
        XCTAssertEqual(model.rows, [99])
        XCTAssertNil(model.cachedThrough)
        XCTAssertFalse(model.isShowingPartialHistory)
        let calls = await fixture.calls()
        XCTAssertEqual(calls.cache.count, 1)
        XCTAssertEqual(calls.live.map(\.from), ["2025-12-01"])
    }

    @MainActor
    func testUnreadableCacheDoesNotPreventNextProbeOrRevalidation() async throws {
        let fixture = ProgressCacheFixture(
            snapshots: ["2026-07-06": [6]], firstCacheError: GraphQLDomainError.decoding("bad cache")
        )
        let model = try makeModel(fixture)
        await model.load()
        XCTAssertEqual(model.rows, [6])
        XCTAssertEqual(model.cachedThrough, "2026-07-06")
        let calls = await fixture.calls()
        XCTAssertEqual(calls.cache.count, 2)
        XCTAssertEqual(calls.live.count, 1)
    }

    @MainActor
    func testCacheCancellationErrorStopsWithoutFurtherProbesOrNetwork() async throws {
        let fixture = ProgressCacheFixture(snapshots: [:], firstCacheError: CancellationError())
        let model = try makeModel(fixture)
        await model.load()
        XCTAssertNil(model.rows)
        XCTAssertNil(model.state.errorMessage)
        let calls = await fixture.calls()
        XCTAssertEqual(calls.cache.count, 1)
        XCTAssertTrue(calls.live.isEmpty)
    }

    @MainActor
    private func makeModel(_ fixture: ProgressCacheFixture) throws -> ProgressHistoryViewModel<Int> {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/New_York"))
        let now = try date("2026-07-07T16:00:00Z")
        return ProgressHistoryViewModel(
            cachedSnapshot: { try await fixture.cached(from: $0, through: $1, zone: $2) },
            updates: { from, through, zone in
                singleValueUpdates { try await fixture.live(from: from, through: through, zone: zone) }
            },
            calendar: calendar, clock: { now }
        )
    }

    private func date(_ value: String) throws -> Date {
        try XCTUnwrap(ExerciseDateParser.parseTimestamp(value))
    }
}

private actor ProgressCacheFixture {
    struct Call: Equatable, Sendable {
        let from: String
        let through: String
        let zone: String
    }
    enum Hold { case cache, live }
    private let snapshots: [String: [Int]]
    private let hold: Hold?
    private let fresh: [Int]?
    private let firstCacheError: (any Error)?
    private var cacheCalls: [Call] = []
    private var liveCalls: [Call] = []
    private var blocked = false
    private var waiters: [CheckedContinuation<Void, Never>] = []
    private var release: CheckedContinuation<Void, Never>?

    init(snapshots: [String: [Int]], hold: Hold? = nil, fresh: [Int]? = nil, firstCacheError: (any Error)? = nil) {
        self.snapshots = snapshots
        self.hold = hold
        self.fresh = fresh
        self.firstCacheError = firstCacheError
    }

    func calls() -> (cache: [Call], live: [Call]) { (cacheCalls, liveCalls) }

    func waitUntilBlocked() async {
        if blocked { return }
        await withCheckedContinuation { waiters.append($0) }
    }

    func releaseBlocked() {
        release?.resume()
        release = nil
    }

    func cached(from: String, through: String, zone: String) async throws -> [Int]? {
        cacheCalls.append(Call(from: from, through: through, zone: zone))
        await blockIfNeeded(.cache)
        if cacheCalls.count == 1, let firstCacheError { throw firstCacheError }
        return snapshots[through]
    }

    func live(from: String, through: String, zone: String) async throws -> [Int] {
        liveCalls.append(Call(from: from, through: through, zone: zone))
        await blockIfNeeded(.live)
        guard let fresh else { throw GraphQLDomainError.transport("offline") }
        return fresh
    }

    private func blockIfNeeded(_ operation: Hold) async {
        guard operation == hold, !blocked else { return }
        blocked = true
        waiters.forEach { $0.resume() }
        waiters.removeAll()
        await withCheckedContinuation { release = $0 }
    }
}
