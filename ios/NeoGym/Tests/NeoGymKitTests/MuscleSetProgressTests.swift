import Combine
import Foundation
import XCTest
@testable import NeoGymKit

final class MuscleSetProgressTests: XCTestCase {
    func testRepositoryReadsServerTotalsAndCachesSessionQuery() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "muscleSetProgress": .array([.object([
                "day": .string("2026-07-07"), "muscleGroup": .string("side_delts"),
                "directSets": .number(1), "indirectSets": .number(1), "weightedSets": .string("1.5"),
                "rollingDirectSets": .number(3), "rollingIndirectSets": .number(1),
                "rollingWeightedSets": .string("3.5")
            ])])
        ]))])
        let repository = SessionsRepository(graphQL: fake)
        var emissions: [[MuscleSetProgressRow]] = []
        for try await rows in repository.muscleSetProgressUpdates(
            fromDay: "2026-07-01", throughDay: "2026-07-07", timeZone: "America/New_York"
        ) {
            emissions.append(rows)
        }
        XCTAssertEqual(emissions.count, 1)
        XCTAssertEqual(emissions.first?.first?.rollingWeightedSets, 3.5)
        XCTAssertEqual(emissions.first?.first?.muscleName, "Side Delts")
        let requests = await fake.cachedRequestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.request.operationName, "MuscleSetProgress")
        XCTAssertEqual(request.request.variables?["from"], .string("2026-07-01"))
        XCTAssertEqual(request.request.variables?["through"], .string("2026-07-07"))
        XCTAssertEqual(request.request.variables?["timeZone"], .string("America/New_York"))
        XCTAssertEqual(request.namespace, "sessions")
        XCTAssertEqual(request.tags, ["sessions"])
        XCTAssertTrue(request.request.query.contains("muscleSetProgress(args:"))
        XCTAssertFalse(request.request.query.contains("workoutSessionStrengthSets"))
    }

    @MainActor
    func testPreviousDayCacheSurvivesFailedCurrentKeyRefresh() async throws {
        let fake = FakeGraphQLService(
            replies: [.failure(GraphQLDomainError.transport("offline"))],
            cachedOnlyReplies: [.missingData, .json(Self.progressReply(day: "2026-07-06", sets: 3.5))]
        )
        let model = try makeModel(fake: fake)
        await model.load()

        XCTAssertEqual(model.rows?.first?.rollingWeightedSets, 3.5)
        XCTAssertEqual(model.cachedThrough, "2026-07-06")
        XCTAssertNotNil(model.state.errorMessage)
        let reads = await fake.cachedOnlyRequestsSnapshot()
        XCTAssertEqual(reads.count, 2)
        XCTAssertEqual(reads.map { $0.request.variables?["from"] }, [.string("2026-01-09"), .string("2026-01-08")])
        XCTAssertEqual(reads.map { $0.request.variables?["through"] }, [.string("2026-07-07"), .string("2026-07-06")])
        XCTAssertTrue(reads.allSatisfy {
            $0.request.query == SessionsRepository.muscleSetProgressQuery &&
            $0.request.operationName == "MuscleSetProgress" &&
            $0.request.variables?["timeZone"] == .string("America/New_York") &&
            $0.namespace == "sessions" && $0.tags == ["sessions"]
        })
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.count, 1)
        XCTAssertEqual(requests.first?.variables?["through"], .string("2026-07-07"))
    }

    @MainActor
    func testFreshCurrentKeyEmissionClearsPreviousDayNotice() async throws {
        let fake = FakeGraphQLService(
            replies: [.json(Self.progressReply(day: "2026-07-07", sets: 5))],
            cachedOnlyReplies: [.missingData, .json(Self.progressReply(day: "2026-07-06", sets: 3.5))]
        )
        let model = try makeModel(fake: fake)
        var observedDates: [String] = []
        let observation = model.$cachedThrough.compactMap { $0 }.sink { observedDates.append($0) }
        defer { observation.cancel() }
        await model.load()

        XCTAssertEqual(observedDates, ["2026-07-06"])
        XCTAssertNil(model.cachedThrough)
        XCTAssertEqual(model.rows?.first?.day, "2026-07-07")
        XCTAssertNil(model.state.errorMessage)
    }

    @MainActor
    func testWarmCurrentKeyDoesNotProbeOlderKeys() async throws {
        let fake = FakeGraphQLService(
            replies: [.failure(GraphQLDomainError.transport("offline"))],
            cachedOnlyReplies: [.json(Self.progressReply(day: "2026-07-07", sets: 2))]
        )
        let model = try makeModel(fake: fake)
        await model.load()

        XCTAssertEqual(model.rows?.first?.rollingWeightedSets, 2)
        XCTAssertNil(model.cachedThrough)
        XCTAssertNotNil(model.state.errorMessage)
        let reads = await fake.cachedOnlyRequestsSnapshot()
        XCTAssertEqual(reads.count, 1)
        XCTAssertEqual(reads.first?.request.variables?["through"], .string("2026-07-07"))
    }

    @MainActor
    func testExpiredOrMissingEntriesDoNotBecomeFallbackAndSearchStopsAtSevenDays() async throws {
        // Fake cache misses represent entries rejected by the SDK's age/scope policy.
        let fake = FakeGraphQLService(replies: [.failure(GraphQLDomainError.transport("offline"))])
        let model = try makeModel(fake: fake)
        await model.load()

        XCTAssertNil(model.rows)
        XCTAssertNil(model.cachedThrough)
        XCTAssertNotNil(model.state.errorMessage)
        let reads = await fake.cachedOnlyRequestsSnapshot()
        XCTAssertEqual(reads.count, 8)
        XCTAssertEqual(reads.last?.request.variables?["through"], .string("2026-06-30"))
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.count, 1)
    }

    @MainActor
    func testExtendedHistoryUsesOnlyItsExactKeyRatherThanAShorterDefaultWindow() async throws {
        let fake = FakeGraphQLService(replies: [
            .json(Self.progressReply(day: "2026-07-07", sets: 2)),
            .failure(GraphQLDomainError.transport("offline"))
        ])
        let model = try makeModel(fake: fake)
        await model.load()
        let extendedStart = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2025-12-01T12:00:00Z"))
        await model.extendHistory(to: extendedStart)

        XCTAssertEqual(model.rows?.first?.rollingWeightedSets, 2)
        XCTAssertTrue(model.isShowingPartialHistory)
        XCTAssertNotNil(model.state.errorMessage)
        let reads = await fake.cachedOnlyRequestsSnapshot()
        // The original cold default tries eight keys; extending already visible
        // rows retains them and does not substitute another default-range key.
        XCTAssertEqual(reads.count, 8)
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.last?.variables?["from"], .string("2025-12-01"))
    }

    @MainActor
    func testKeepWarmModelAdvancesDefaultWindowAndLabelsYesterdayOnOfflineRollover() async throws {
        let yesterday = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-07-06T16:00:00Z"))
        let today = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-07-07T16:00:00Z"))
        let clock = ProgressTestClock(yesterday)
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/New_York"))
        let fake = FakeGraphQLService(replies: [
            .json(Self.progressReply(day: "2026-07-06", sets: 2)),
            .failure(GraphQLDomainError.transport("offline"))
        ])
        let model = MuscleSetProgressViewModel(
            repository: SessionsRepository(graphQL: fake), calendar: calendar, clock: { clock.now() }
        )
        await model.load()
        clock.set(today)
        await model.load()

        XCTAssertEqual(model.cachedThrough, "2026-07-06")
        XCTAssertEqual(model.rows?.first?.day, "2026-07-06")
        XCTAssertNotNil(model.state.errorMessage)
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.map { $0.variables?["from"] }, [.string("2026-01-08"), .string("2026-01-09")])
        XCTAssertEqual(requests.map { $0.variables?["through"] }, [.string("2026-07-06"), .string("2026-07-07")])
        let cacheReads = await fake.cachedOnlyRequestsSnapshot()
        XCTAssertEqual(cacheReads.last?.request.variables?["through"], .string("2026-07-07"))
    }

    @MainActor
    func testExtendedHistoryStaysWithinServerLimitAfterLocalMidnightAndOnRepeatedReload() async throws {
        let beforeMidnight = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-07-08T03:59:00Z"))
        let afterMidnight = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-07-08T04:01:00Z"))
        let olderStart = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2024-01-01T12:00:00Z"))
        let clock = ProgressTestClock(beforeMidnight)
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/New_York"))
        let fake = FakeGraphQLService(replies: [
            .json(Self.progressReply(day: "2026-07-07", sets: 1)),
            .json(Self.progressReply(day: "2026-07-08", sets: 2)),
            .json(Self.progressReply(day: "2026-07-08", sets: 3))
        ])
        let model = MuscleSetProgressViewModel(
            repository: SessionsRepository(graphQL: fake), calendar: calendar, clock: { clock.now() }
        )

        await model.extendHistory(to: olderStart)
        clock.set(afterMidnight)
        await model.load()
        await model.load()

        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.map { $0.variables?["from"] }, [
            .string("2025-07-07"), .string("2025-07-08"), .string("2025-07-08")
        ])
        XCTAssertEqual(requests.map { $0.variables?["through"] }, [
            .string("2026-07-07"), .string("2026-07-08"), .string("2026-07-08")
        ])
        XCTAssertTrue(requests.allSatisfy { $0.variables?["timeZone"] == .string("America/New_York") })
        let firstDay = try XCTUnwrap(calendar.date(from: DateComponents(year: 2025, month: 7, day: 7)))
        let nextDay = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 7, day: 7)))
        XCTAssertEqual(calendar.dateComponents([.day], from: firstDay, to: nextDay).day, 365)
        XCTAssertEqual(model.rows?.first?.rollingWeightedSets, 3)
        XCTAssertNil(model.state.errorMessage)
        XCTAssertNil(model.cachedThrough)
        XCTAssertFalse(model.isShowingPartialHistory)
        let cacheReads = await fake.cachedOnlyRequestsSnapshot()
        XCTAssertEqual(cacheReads.map { $0.request.variables?["from"] }, [
            .string("2025-07-07"), .string("2025-07-08")
        ])
    }

    @MainActor
    func testColdExtendedHistoryProbesOnlyExactCustomKey() async throws {
        let fake = FakeGraphQLService(
            replies: [.failure(GraphQLDomainError.transport("offline"))],
            cachedOnlyReplies: [.json(Self.progressReply(day: "2026-07-07", sets: 1))]
        )
        let model = try makeModel(fake: fake)
        let extendedStart = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2025-12-01T12:00:00Z"))
        await model.extendHistory(to: extendedStart)
        let reads = await fake.cachedOnlyRequestsSnapshot()
        XCTAssertEqual(reads.count, 1)
        XCTAssertEqual(reads.first?.request.variables?["from"], .string("2025-12-01"))
        XCTAssertNil(model.cachedThrough)
        XCTAssertFalse(model.isShowingPartialHistory)
    }

    private static func progressReply(day: String, sets: Double) -> JSONValue {
        .object(["muscleSetProgress": .array([.object([
            "day": .string(day), "muscleGroup": .string("chest"),
            "directSets": .number(1), "indirectSets": .number(0), "weightedSets": .number(sets),
            "rollingDirectSets": .number(1), "rollingIndirectSets": .number(0),
            "rollingWeightedSets": .number(sets)
        ])])])
    }

    @MainActor
    private func makeModel(fake: FakeGraphQLService) throws -> MuscleSetProgressViewModel {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/New_York"))
        let now = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-07-07T16:00:00Z"))
        return MuscleSetProgressViewModel(repository: SessionsRepository(graphQL: fake), calendar: calendar, clock: { now })
    }

    @MainActor
    func testSupersededCacheReadCannotReplaceNewerEmissionOrStartOldNetworkStream() async throws {
        let fake = FakeGraphQLService(
            replies: [.json(Self.progressReply(day: "2026-07-07", sets: 5))],
            cachedOnlyReplies: [
                .json(Self.progressReply(day: "2026-07-07", sets: 4)),
                .json(Self.progressReply(day: "2026-07-06", sets: 2))
            ]
        )
        let gate = DelayedProgressCacheGraphQL(fake: fake)
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let now = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-07-07T12:00:00Z"))
        let model = MuscleSetProgressViewModel(
            repository: SessionsRepository(graphQL: gate), calendar: calendar, clock: { now }
        )
        let first = Task { await model.load() }
        await gate.waitUntilBlocked()
        await model.load()
        XCTAssertEqual(model.rows?.first?.rollingWeightedSets, 5)
        await gate.releaseBlocked()
        await first.value
        XCTAssertEqual(model.rows?.first?.rollingWeightedSets, 5)
        XCTAssertNil(model.cachedThrough)
        let network = await fake.requestsSnapshot()
        XCTAssertEqual(network.count, 1)
    }

    @MainActor
    func testCancelledCacheReadDoesNotStartNetworkOrPublishRows() async throws {
        let fake = FakeGraphQLService(cachedOnlyReplies: [.json(Self.progressReply(day: "2026-07-07", sets: 2))])
        let gate = DelayedProgressCacheGraphQL(fake: fake)
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let now = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-07-07T12:00:00Z"))
        let model = MuscleSetProgressViewModel(
            repository: SessionsRepository(graphQL: gate), calendar: calendar, clock: { now }
        )
        let load = Task { await model.load() }
        await gate.waitUntilBlocked()
        load.cancel()
        await gate.releaseBlocked()
        await load.value
        XCTAssertNil(model.rows)
        let network = await fake.requestsSnapshot()
        XCTAssertTrue(network.isEmpty)
    }

    func testUnspecifiedShouldersAndMidnightDSTAreDisplayedSafely() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/Santiago"))
        let row = MuscleSetProgressRow(
            day: "2023-09-03", muscleGroup: "shoulders", directSets: 1, indirectSets: 0,
            weightedSets: 1, rollingDirectSets: 1, rollingIndirectSets: 0, rollingWeightedSets: 1
        )
        XCTAssertEqual(row.muscleName, "Shoulders (unspecified)")
        let date = try XCTUnwrap(row.date(in: calendar))
        XCTAssertEqual(calendar.component(.day, from: date), 3)
        XCTAssertEqual(calendar.component(.hour, from: date), 12)
    }
}

private final class ProgressTestClock: @unchecked Sendable {
    private let lock = NSLock()
    private var date: Date

    init(_ date: Date) { self.date = date }

    func now() -> Date {
        lock.lock()
        defer { lock.unlock() }
        return date
    }

    func set(_ date: Date) {
        lock.lock()
        defer { lock.unlock() }
        self.date = date
    }
}

/// Holds only the first cache-only read, so a newer load can finish first.
private actor DelayedProgressCacheGraphQL: GraphQLServicing {
    private let fake: FakeGraphQLService
    private var hasBlocked = false
    private var blockWaiters: [CheckedContinuation<Void, Never>] = []
    private var release: CheckedContinuation<Void, Never>?

    init(fake: FakeGraphQLService) { self.fake = fake }

    func waitUntilBlocked() async {
        if hasBlocked { return }
        await withCheckedContinuation { blockWaiters.append($0) }
    }

    func releaseBlocked() {
        release?.resume()
        release = nil
    }

    func cachedSnapshot<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type, query: String, variables: [String: JSONValue]?,
        operationName: String?, namespace: String, tags: Set<String>
    ) async throws -> ResponseData? {
        if !hasBlocked {
            hasBlocked = true
            blockWaiters.forEach { $0.resume() }
            blockWaiters.removeAll()
            await withCheckedContinuation { release = $0 }
        }
        return try await fake.cachedSnapshot(
            responseType, query: query, variables: variables, operationName: operationName,
            namespace: namespace, tags: tags
        )
    }

    nonisolated func cachedQuery<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type, query: String, variables: [String: JSONValue]?,
        operationName: String?, namespace: String, tags: Set<String>
    ) -> AsyncThrowingStream<GraphQLQueryEmission<ResponseData>, Error> {
        fake.cachedQuery(responseType, query: query, variables: variables,
                         operationName: operationName, namespace: namespace, tags: tags)
    }

    func execute<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type, query: String, variables: [String: JSONValue]?, operationName: String?
    ) async throws -> ResponseData {
        try await fake.execute(responseType, query: query, variables: variables, operationName: operationName)
    }
}
