import Combine
import Foundation
import XCTest
@testable import NeoGymKit

final class StrengthProgressTests: XCTestCase {
    func testRepositoryReadsServerPointsAndUsesSessionCache() async throws {
        let fake = FakeGraphQLService(replies: [.json(Self.reply(volume: 620))])
        let repository = SessionsRepository(graphQL: fake)
        var rows: [StrengthProgressRow] = []
        for try await update in repository.strengthProgressUpdates(
            fromDay: "2026-01-09", throughDay: "2026-07-07", timeZone: "America/New_York"
        ) { rows = update }
        XCTAssertEqual(rows.count, 1)
        XCTAssertEqual(rows.first?.volume, 620)
        XCTAssertEqual(rows.first?.estimatedOneRepMax, 60)
        XCTAssertEqual(rows.first?.exerciseName, "Press")
        let requests = await fake.cachedRequestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.namespace, "sessions")
        XCTAssertEqual(request.tags, ["sessions"])
        XCTAssertEqual(request.request.operationName, "StrengthProgress")
        XCTAssertEqual(request.request.variables?["from"], .string("2026-01-09"))
        XCTAssertEqual(request.request.variables?["through"], .string("2026-07-07"))
        XCTAssertEqual(request.request.variables?["timeZone"], .string("America/New_York"))
        XCTAssertTrue(request.request.query.contains("strengthProgress(args:"))
        XCTAssertFalse(request.request.query.contains("workoutSessionStrengthSets"))
        XCTAssertFalse(request.request.query.contains("hasura_session"))
    }

    func testWeeklyTotalsFillGapsAndRecentExercisesRetainTheirOlderHistory() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(secondsFromGMT: 0))
        calendar.firstWeekday = 2
        let now = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-07-07T12:00:00Z"))
        let rows = [
            row("archive", date: "2026-06-15T12:00:00Z", volume: 100),
            row("press", date: "2026-06-16T12:00:00Z", volume: 50),
            row("press", date: "2026-07-07T12:00:00Z", volume: 60),
            row("bodyweight", date: "2026-07-07T13:00:00Z", volume: 0, estimate: nil),
            row("future", date: "2026-07-08T12:00:00Z", volume: 999),
            row("invalid", date: "not-a-date", volume: 999),
        ]
        let result = StrengthProgressBuilder.build(rows: rows, now: now, calendar: calendar)
        XCTAssertEqual(result.weeklyVolume.map(\.volume), [150, 0, 0, 60])
        XCTAssertEqual(result.recentExercises.map(\.id), ["bodyweight", "press"])
        XCTAssertEqual(result.recentExercises.last?.points.map(\.volume), [50, 60])
        XCTAssertNil(result.recentExercises.first?.points.first?.estimatedOneRepMax)
    }

    func testTenLocalDaysUseCalendarBoundariesAcrossDST() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/New_York"))
        let now = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-03-10T16:00:00Z"))
        let result = StrengthProgressBuilder.build(rows: [
            row("too-old", date: "2026-03-01T04:59:59Z", volume: 10),
            row("first-day", date: "2026-03-01T05:00:00Z", volume: 20),
            row("last-day", date: "2026-03-11T03:59:59Z", volume: 30),
            row("tomorrow", date: "2026-03-11T04:00:00Z", volume: 999),
        ], now: now, calendar: calendar)
        XCTAssertEqual(result.recentExercises.map(\.id), ["first-day", "last-day"])
        XCTAssertEqual(result.weeklyVolume.reduce(0) { $0 + $1.volume }, 60)
    }

    @MainActor
    func testCachedCurrentRangeSurvivesOfflineRefreshAndWiderFailureIsPartial() async throws {
        let fake = FakeGraphQLService(
            replies: [.failure(GraphQLDomainError.transport("offline")), .failure(GraphQLDomainError.transport("offline"))],
            cachedOnlyReplies: [.json(Self.reply(volume: 620)), .missingData, .missingData]
        )
        let model = try makeModel(graphQL: ProgressStreamGraphQL(fake: fake))
        await model.load()
        XCTAssertEqual(model.rows?.first?.volume, 620)
        XCTAssertNil(model.cachedThrough)
        XCTAssertNotNil(model.state.errorMessage)
        await model.extendHistory(to: try XCTUnwrap(ExerciseDateParser.parseTimestamp("2025-12-01T12:00:00Z")))
        XCTAssertEqual(model.rows?.first?.volume, 620)
        XCTAssertTrue(model.isShowingPartialHistory)
        let reads = await fake.cachedOnlyRequestsSnapshot()
        XCTAssertEqual(reads.map { $0.request.variables?["from"] }, [
            .string("2026-01-09"), .string("2026-01-09"), .string("2025-12-01")
        ])
        XCTAssertTrue(reads.allSatisfy { $0.namespace == "sessions" })
    }

    @MainActor
    func testColdStrengthUsesPriorDayCacheUntilCurrentEmission() async throws {
        let fake = FakeGraphQLService(
            replies: [.json(Self.reply(volume: 200))],
            cachedOnlyReplies: [.missingData, .json(Self.reply(volume: 100))]
        )
        let gate = ProgressStreamGraphQL(fake: fake, delayFirstStream: true)
        let model = try makeModel(graphQL: gate)
        let load = Task { await model.load() }
        await gate.waitUntilBlocked()
        XCTAssertEqual(model.rows?.first?.volume, 100)
        XCTAssertEqual(model.cachedThrough, "2026-07-06")
        let beforeRevalidation = await fake.requestsSnapshot()
        XCTAssertTrue(beforeRevalidation.isEmpty)
        await gate.releaseBlocked()
        await load.value
        XCTAssertEqual(model.rows?.first?.volume, 200)
        XCTAssertNil(model.cachedThrough)
        XCTAssertFalse(model.isShowingPartialHistory)
    }

    @MainActor
    func testColdStrengthRetainsPriorDayCacheOnFailure() async throws {
        let fake = FakeGraphQLService(
            replies: [.failure(GraphQLDomainError.transport("offline"))],
            cachedOnlyReplies: [.missingData, .json(Self.reply(volume: 100))]
        )
        let model = try makeModel(graphQL: fake)
        await model.load()
        XCTAssertEqual(model.rows?.first?.volume, 100)
        XCTAssertEqual(model.cachedThrough, "2026-07-06")
        XCTAssertNotNil(model.state.errorMessage)
    }

    @MainActor
    func testPriorDayVisibleRowsAreLabelledAndOnlyOneForegroundAttemptRunsPerDay() async throws {
        let yesterday = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-07-06T16:00:00Z"))
        let today = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-07-07T16:00:00Z"))
        let clock = ProgressTestClock(yesterday)
        let fake = FakeGraphQLService(replies: [
            .json(Self.reply(volume: 620)), .failure(GraphQLDomainError.transport("offline"))
        ])
        let model = StrengthProgressViewModel(
            repository: SessionsRepository(graphQL: fake), calendar: try calendar(), clock: { clock.now() }
        )
        await model.load()
        clock.set(today)
        await model.refreshIfNewLocalDay()
        await model.refreshIfNewLocalDay()
        XCTAssertEqual(model.rows?.first?.volume, 620)
        XCTAssertEqual(model.cachedThrough, "2026-07-06")
        XCTAssertNotNil(model.state.errorMessage)
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.map { $0.variables?["through"] }, [.string("2026-07-06"), .string("2026-07-07")])
    }

    @MainActor
    func testHistoryClampsToOneYearAndFreshRowsReplaceCachedRows() async throws {
        let fake = FakeGraphQLService(
            replies: [.json(Self.reply(volume: 200)), .json(Self.reply(volume: 300))],
            cachedOnlyReplies: [.json(Self.reply(volume: 100)), .missingData]
        )
        let model = try makeModel(graphQL: ProgressStreamGraphQL(fake: fake))
        await model.load()
        XCTAssertEqual(model.rows?.first?.volume, 200)
        await model.extendHistory(to: try XCTUnwrap(ExerciseDateParser.parseTimestamp("2020-01-01T12:00:00Z")))
        XCTAssertEqual(model.rows?.first?.volume, 300)
        XCTAssertFalse(model.isShowingPartialHistory)
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.last?.variables?["from"], .string("2025-07-07"))
        XCTAssertEqual(requests.last?.variables?["through"], .string("2026-07-07"))
    }

    @MainActor
    func testColdExtendedStrengthReadsOnlyExactCustomCacheKey() async throws {
        let fake = FakeGraphQLService(
            replies: [.failure(GraphQLDomainError.transport("offline"))],
            cachedOnlyReplies: [.json(Self.reply(volume: 100))]
        )
        let model = try makeModel(graphQL: ProgressStreamGraphQL(fake: fake))
        await model.extendHistory(to: try XCTUnwrap(ExerciseDateParser.parseTimestamp("2025-12-01T12:00:00Z")))
        XCTAssertEqual(model.rows?.first?.volume, 100)
        XCTAssertNil(model.cachedThrough)
        XCTAssertFalse(model.isShowingPartialHistory)
        let reads = await fake.cachedOnlyRequestsSnapshot()
        XCTAssertEqual(reads.count, 1)
        XCTAssertEqual(reads.first?.request.variables?["from"], .string("2025-12-01"))
    }

    @MainActor
    func testConstructingBothPanesDoesNotLoadTheInactivePane() async throws {
        let fake = FakeGraphQLService(replies: [.json(Self.reply(volume: 620))])
        let repository = SessionsRepository(graphQL: fake)
        let muscles = MuscleSetProgressViewModel(repository: repository)
        let strength = try makeModel(graphQL: fake)
        let initialRequests = await fake.requestsSnapshot()
        XCTAssertTrue(initialRequests.isEmpty)
        await strength.load()
        XCTAssertNil(muscles.rows)
        XCTAssertEqual(strength.rows?.count, 1)
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.map(\.operationName), ["StrengthProgress"])
    }

    @MainActor
    func testPublishedHistoryChangesReachBothPaneObservers() async throws {
        let fake = FakeGraphQLService(replies: [
            .json(.object(["muscleSetProgress": .array([])])), .json(Self.reply(volume: 620))
        ])
        let repository = SessionsRepository(graphQL: fake)
        let muscles = MuscleSetProgressViewModel(repository: repository)
        let strength = try makeModel(graphQL: fake)
        var muscleChanges = 0
        var strengthChanges = 0
        let muscleObserver = muscles.objectWillChange.sink { muscleChanges += 1 }
        let strengthObserver = strength.objectWillChange.sink { strengthChanges += 1 }
        await muscles.load()
        await strength.load()
        XCTAssertGreaterThan(muscleChanges, 0)
        XCTAssertGreaterThan(strengthChanges, 0)
        XCTAssertEqual(muscles.rows, [])
        XCTAssertEqual(strength.rows?.first?.volume, 620)
        withExtendedLifetime([muscleObserver, strengthObserver]) {}
    }

    func testNullEstimateAndUnavailableExerciseDecodeWithoutInventingAnEstimate() throws {
        let data = Data("""
        {"sessionId":"s","exerciseId":"e","startedAt":"2026-07-07T12:00:00Z",
         "exercise":null,"volume":0,"estimatedOneRepMax":null}
        """.utf8)
        let decoded = try JSONDecoder().decode(StrengthProgressRow.self, from: data)
        XCTAssertNil(decoded.estimatedOneRepMax)
        XCTAssertEqual(decoded.exerciseName, "Unavailable exercise")
        XCTAssertEqual(decoded.volume, 0)
        let empty = StrengthProgressBuilder.build(rows: [])
        XCTAssertTrue(empty.weeklyVolume.isEmpty)
        XCTAssertTrue(empty.recentExercises.isEmpty)
    }

    private func calendar() throws -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/New_York"))
        return calendar
    }

    @MainActor
    private func makeModel(graphQL: any GraphQLServicing) throws -> StrengthProgressViewModel {
        let now = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-07-07T16:00:00Z"))
        return StrengthProgressViewModel(
            repository: SessionsRepository(graphQL: graphQL), calendar: try calendar(), clock: { now }
        )
    }

    private func row(_ id: String, date: String, volume: Double, estimate: Double? = 25) -> StrengthProgressRow {
        StrengthProgressRow(
            exerciseId: id, sessionId: date, startedAt: date, exerciseName: id,
            volume: volume, estimatedOneRepMax: estimate
        )
    }

    private static func reply(volume: Double) -> JSONValue {
        .object(["strengthProgress": .array([.object([
            "exerciseId": .string("press"), "sessionId": .string("session"),
            "startedAt": .string("2026-07-06T12:00:00Z"), "exercise": .object(["name": .string("Press")]),
            "volume": .string(String(volume)), "estimatedOneRepMax": .string("60")
        ])])])
    }
}
