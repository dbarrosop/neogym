import Foundation
import XCTest
@testable import NeoGymKit

final class MuscleSetProgressTests: XCTestCase {
    func testRepositoryReadsServerTotalsAndCachesSessionQuery() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "muscleSetProgress": .array([.object([
                "day": .string("2026-07-07"), "muscleGroup": .string("side_delts"),
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
        XCTAssertEqual(emissions.first?.first?.rollingDirectSets, 3)
        XCTAssertEqual(emissions.first?.first?.rollingIndirectSets, 1)
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
        let fields = Set(request.request.query.components(separatedBy: .whitespacesAndNewlines))
        XCTAssertTrue(fields.isSuperset(of: [
            "day", "muscleGroup", "rollingDirectSets", "rollingIndirectSets", "rollingWeightedSets"
        ]))
        XCTAssertTrue(fields.isDisjoint(with: ["directSets", "indirectSets", "weightedSets"]))
    }

    @MainActor
    func testExactCurrentKeyCachedEmissionSurvivesFailedRevalidation() async throws {
        let fake = FakeGraphQLService(
            replies: [.failure(GraphQLDomainError.transport("offline"))],
            cachedOnlyReplies: [.json(Self.progressReply(day: "2026-07-07", sets: 3.5))]
        )
        let model = try makeModel(graphQL: ProgressStreamGraphQL(fake: fake))
        await model.load()

        XCTAssertEqual(model.rows?.first?.rollingWeightedSets, 3.5)
        XCTAssertNil(model.cachedThrough)
        XCTAssertNotNil(model.state.errorMessage)
        let reads = await fake.cachedOnlyRequestsSnapshot()
        XCTAssertEqual(reads.count, 1)
        XCTAssertEqual(reads.first?.request.variables?["from"], .string("2026-01-09"))
        XCTAssertEqual(reads.first?.request.variables?["through"], .string("2026-07-07"))
        XCTAssertEqual(reads.first?.request.variables?["timeZone"], .string("America/New_York"))
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.count, 1)
        XCTAssertEqual(requests.first?.variables?["through"], .string("2026-07-07"))
    }

    @MainActor
    func testColdNewDayKeyDoesNotSearchYesterdayOnFailure() async throws {
        let fake = FakeGraphQLService(
            replies: [.failure(GraphQLDomainError.transport("offline"))],
            cachedOnlyReplies: [.missingData, .json(Self.progressReply(day: "2026-07-06", sets: 3.5))]
        )
        let model = try makeModel(graphQL: ProgressStreamGraphQL(fake: fake))
        await model.load()

        XCTAssertNil(model.rows)
        XCTAssertNil(model.cachedThrough)
        XCTAssertNotNil(model.state.errorMessage)
        let reads = await fake.cachedOnlyRequestsSnapshot()
        XCTAssertEqual(reads.map { $0.request.variables?["through"] }, [.string("2026-07-07")])
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.count, 1)
    }

    @MainActor
    func testExtendedHistoryUsesOnlyItsExactKeyRatherThanAShorterDefaultWindow() async throws {
        let fake = FakeGraphQLService(replies: [
            .json(Self.progressReply(day: "2026-07-07", sets: 2)),
            .failure(GraphQLDomainError.transport("offline"))
        ])
        let model = try makeModel(graphQL: fake)
        await model.load()
        let extendedStart = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2025-12-01T12:00:00Z"))
        await model.extendHistory(to: extendedStart)

        XCTAssertEqual(model.rows?.first?.rollingWeightedSets, 2)
        XCTAssertTrue(model.isShowingPartialHistory)
        XCTAssertNotNil(model.state.errorMessage)
        // No second cache-only API is called; the SDK stream owns exact-key caching.
        let cacheReads = await fake.cachedOnlyRequestsSnapshot()
        XCTAssertTrue(cacheReads.isEmpty)
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.last?.variables?["from"], .string("2025-12-01"))
    }

    @MainActor
    func testTodayCacheEmissionReplacesYesterdayAfterForegroundRollover() async throws {
        let yesterday = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-07-06T16:00:00Z"))
        let today = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-07-07T16:00:00Z"))
        let clock = ProgressTestClock(yesterday)
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/New_York"))
        let fake = FakeGraphQLService(
            replies: [
                .json(Self.progressReply(day: "2026-07-06", sets: 2)),
                .failure(GraphQLDomainError.transport("offline"))
            ],
            cachedOnlyReplies: [.missingData, .json(Self.progressReply(day: "2026-07-07", sets: 4))]
        )
        let model = MuscleSetProgressViewModel(
            repository: SessionsRepository(graphQL: ProgressStreamGraphQL(fake: fake)),
            calendar: calendar, clock: { clock.now() }
        )
        await model.load()
        clock.set(today)
        await model.refreshIfNewLocalDay()

        XCTAssertEqual(model.rows?.first?.day, "2026-07-07")
        XCTAssertEqual(model.rows?.first?.rollingWeightedSets, 4)
        XCTAssertNil(model.cachedThrough)
        XCTAssertNotNil(model.state.errorMessage)
        let reads = await fake.cachedOnlyRequestsSnapshot()
        XCTAssertEqual(reads.map { $0.request.variables?["through"] }, [
            .string("2026-07-06"), .string("2026-07-07")
        ])
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
        await model.refreshIfNewLocalDay()
        let sameDayRequests = await fake.requestsSnapshot()
        XCTAssertEqual(sameDayRequests.count, 1)
        clock.set(today)
        await model.refreshIfNewLocalDay()
        await model.refreshIfNewLocalDay()

        XCTAssertEqual(model.cachedThrough, "2026-07-06")
        XCTAssertEqual(model.rows?.first?.day, "2026-07-06")
        XCTAssertNotNil(model.state.errorMessage)
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.map { $0.variables?["from"] }, [.string("2026-01-08"), .string("2026-01-09")])
        XCTAssertEqual(requests.map { $0.variables?["through"] }, [.string("2026-07-06"), .string("2026-07-07")])
        let cacheReads = await fake.cachedOnlyRequestsSnapshot()
        XCTAssertTrue(cacheReads.isEmpty)
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
        XCTAssertTrue(cacheReads.isEmpty)
    }

    @MainActor
    func testColdExtendedHistoryUsesOnlyTheExactCustomKey() async throws {
        let fake = FakeGraphQLService(
            replies: [.failure(GraphQLDomainError.transport("offline"))],
            cachedOnlyReplies: [.json(Self.progressReply(day: "2026-07-07", sets: 1))]
        )
        let model = try makeModel(graphQL: ProgressStreamGraphQL(fake: fake))
        let extendedStart = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2025-12-01T12:00:00Z"))
        await model.extendHistory(to: extendedStart)

        XCTAssertEqual(model.rows?.first?.rollingWeightedSets, 1)
        let reads = await fake.cachedOnlyRequestsSnapshot()
        XCTAssertEqual(reads.count, 1)
        XCTAssertEqual(reads.first?.request.variables?["from"], .string("2025-12-01"))
        XCTAssertNil(model.cachedThrough)
        XCTAssertFalse(model.isShowingPartialHistory)
    }

    private static func progressReply(day: String, sets: Double) -> JSONValue {
        .object(["muscleSetProgress": .array([.object([
            "day": .string(day), "muscleGroup": .string("chest"),
            "rollingDirectSets": .number(1), "rollingIndirectSets": .number(0),
            "rollingWeightedSets": .number(sets)
        ])])])
    }

    @MainActor
    private func makeModel(graphQL: any GraphQLServicing) throws -> MuscleSetProgressViewModel {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/New_York"))
        let now = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-07-07T16:00:00Z"))
        return MuscleSetProgressViewModel(repository: SessionsRepository(graphQL: graphQL), calendar: calendar, clock: { now })
    }

    @MainActor
    func testSupersededStreamCannotReplaceNewerEmission() async throws {
        let fake = FakeGraphQLService(replies: [.json(Self.progressReply(day: "2026-07-07", sets: 5))])
        let gate = ProgressStreamGraphQL(fake: fake, delayFirstStream: true)
        let model = try makeModel(graphQL: gate)
        let first = Task { await model.load() }
        await gate.waitUntilBlocked()
        await model.load()
        XCTAssertEqual(model.rows?.first?.rollingWeightedSets, 5)
        await gate.releaseBlocked()
        await first.value
        XCTAssertEqual(model.rows?.first?.rollingWeightedSets, 5)
        XCTAssertNil(model.cachedThrough)
        // A superseded stream can still start a redundant request; its late result cannot replace newer rows.
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.count, 2)
    }

    @MainActor
    func testCancelledStreamDoesNotStartNetworkOrPublishRows() async throws {
        let fake = FakeGraphQLService(replies: [.json(Self.progressReply(day: "2026-07-07", sets: 2))])
        let gate = ProgressStreamGraphQL(fake: fake, delayFirstStream: true)
        let model = try makeModel(graphQL: gate)
        let load = Task { await model.load() }
        await gate.waitUntilBlocked()
        load.cancel()
        await gate.releaseBlocked()
        await load.value
        XCTAssertNil(model.rows)
        let requests = await fake.requestsSnapshot()
        XCTAssertTrue(requests.isEmpty)
    }

    func testUnspecifiedShouldersAndMidnightDSTAreDisplayedSafely() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/Santiago"))
        let row = MuscleSetProgressRow(
            day: "2023-09-03", muscleGroup: "shoulders",
            rollingDirectSets: 1, rollingIndirectSets: 0, rollingWeightedSets: 1
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

/// Simulates the SDK's exact-key cached/fresh stream; can hold the first stream
/// to verify that a superseded or cancelled load never starts its network read.
private actor ProgressStreamGraphQL: GraphQLServicing {
    private let fake: FakeGraphQLService
    private let delayFirstStream: Bool
    private var hasBlocked = false
    private var blockWaiters: [CheckedContinuation<Void, Never>] = []
    private var release: CheckedContinuation<Void, Never>?

    init(fake: FakeGraphQLService, delayFirstStream: Bool = false) {
        self.fake = fake
        self.delayFirstStream = delayFirstStream
    }

    func waitUntilBlocked() async {
        if hasBlocked { return }
        await withCheckedContinuation { blockWaiters.append($0) }
    }

    func releaseBlocked() {
        release?.resume()
        release = nil
    }

    private func beforeStream() async {
        guard delayFirstStream, !hasBlocked else { return }
        hasBlocked = true
        blockWaiters.forEach { $0.resume() }
        blockWaiters.removeAll()
        await withCheckedContinuation { release = $0 }
    }

    func cachedSnapshot<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type, query: String, variables: [String: JSONValue]?,
        operationName: String?, namespace: String, tags: Set<String>
    ) async throws -> ResponseData? {
        try await fake.cachedSnapshot(
            responseType, query: query, variables: variables, operationName: operationName,
            namespace: namespace, tags: tags
        )
    }

    nonisolated func cachedQuery<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type, query: String, variables: [String: JSONValue]?,
        operationName: String?, namespace: String, tags: Set<String>
    ) -> AsyncThrowingStream<GraphQLQueryEmission<ResponseData>, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                await beforeStream()
                guard !Task.isCancelled else { continuation.finish(); return }
                do {
                    if let cached = try await fake.cachedSnapshot(
                        responseType, query: query, variables: variables, operationName: operationName,
                        namespace: namespace, tags: tags
                    ) {
                        continuation.yield(.cached(cached))
                    }
                    for try await update in fake.cachedQuery(
                        responseType, query: query, variables: variables, operationName: operationName,
                        namespace: namespace, tags: tags
                    ) {
                        guard !Task.isCancelled else { break }
                        continuation.yield(update)
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { @Sendable _ in task.cancel() }
        }
    }

    func execute<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type, query: String, variables: [String: JSONValue]?, operationName: String?
    ) async throws -> ResponseData {
        try await fake.execute(responseType, query: query, variables: variables, operationName: operationName)
    }
}
