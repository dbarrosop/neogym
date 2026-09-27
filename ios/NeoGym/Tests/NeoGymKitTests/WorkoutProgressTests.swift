import Combine
import Foundation
import XCTest
@testable import NeoGymKit

final class WorkoutProgressTests: XCTestCase {
    func testWeeklyVolumeAndRecentExerciseEligibility() throws {
        var calendar = Calendar(identifier: .iso8601)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let now = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-07-03T12:00:00Z"))
        let entries = [
            entry("old-bench", "bench", "Bench", "2026-06-10T12:00:00Z", 100, 5),
            entry("recent-bench", "bench", "Bench", "2026-06-24T00:00:00Z", 120, 5),
            entry("recent-row", "row", "Row", "2026-06-26T10:00:00Z", 20, 10, doubleWeight: true),
            entry("old-squat", "squat", "Squat", "2026-06-23T12:00:00Z", 80, 10),
            entry("empty", "empty", "Empty", "2026-07-03T10:00:00Z", 50, 5, sets: []),
            entry("future", "future", "Future", "2026-07-04T10:00:00Z", 50, 5)
        ]

        let result = WorkoutProgressBuilder.build(entries: entries, now: now, calendar: calendar)

        XCTAssertEqual(result.recentExercises.map(\.id), ["bench", "row"])
        XCTAssertEqual(result.recentExercises[0].points.map(\.volume), [500, 600])
        XCTAssertEqual(result.recentExercises[0].points.last?.oneRepMax ?? 0, 140, accuracy: 0.001)
        XCTAssertEqual(result.recentExercises[1].points.last?.oneRepMax ?? 0, 26.666, accuracy: 0.001)
        XCTAssertEqual(result.weeklyVolume.map(\.weekStart), try [
            "2026-06-08T00:00:00Z", "2026-06-15T00:00:00Z",
            "2026-06-22T00:00:00Z", "2026-06-29T00:00:00Z"
        ].map { try XCTUnwrap(ExerciseDateParser.parseTimestamp($0)) })
        XCTAssertEqual(result.weeklyVolume.map(\.volume), [500, 0, 1_800, 0])
    }

    func testTodayDatedSetIsRecentAndInCurrentWeek() throws {
        var calendar = Calendar(identifier: .iso8601)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let now = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-07-03T12:00:00Z"))
        let result = WorkoutProgressBuilder.build(
            entries: [entry("today-row", "row", "Row", "2026-07-03T10:00:00Z", 20, 10, doubleWeight: true)],
            now: now,
            calendar: calendar
        )

        XCTAssertEqual(result.recentExercises.map(\.id), ["row"])
        XCTAssertEqual(result.recentExercises.first?.points.map(\.volume), [400])
        XCTAssertEqual(result.weeklyVolume.map(\.weekStart), [calendar.dateInterval(of: .weekOfYear, for: now)?.start])
        XCTAssertEqual(result.weeklyVolume.map(\.volume), [400])
    }

    func testWeeklyVolumeKeepsTrainedWeekAfterMidnightDSTStart() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/Santiago"))
        calendar.firstWeekday = 1
        calendar.minimumDaysInFirstWeek = 1
        let now = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2023-09-17T12:00:00Z"))
        let entries = [
            entry("before-dst", "bench", "Bench", "2023-08-28T12:00:00Z", 100, 5),
            entry("after-dst", "bench", "Bench", "2023-09-11T12:00:00Z", 80, 10)
        ]

        let result = WorkoutProgressBuilder.build(entries: entries, now: now, calendar: calendar)

        XCTAssertEqual(result.weeklyVolume.map(\.weekStart), try [
            "2023-08-27T04:00:00Z", "2023-09-03T04:00:00Z",
            "2023-09-10T03:00:00Z", "2023-09-17T03:00:00Z"
        ].map { try XCTUnwrap(ExerciseDateParser.parseTimestamp($0)) })
        XCTAssertEqual(result.weeklyVolume.map(\.volume), [500, 0, 800, 0])
    }

    func testNoStrengthHistoryHasNoWeeklyVolume() throws {
        let now = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-07-03T12:00:00Z"))
        let result = WorkoutProgressBuilder.build(entries: [], now: now)

        XCTAssertTrue(result.weeklyVolume.isEmpty)
    }

    func testPriorWorkoutQueryLimitsSameWorkoutAndDecodesTotals() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "workoutSessions": .array([.object([
                "id": .string("prior"),
                "startedAt": .string("2026-06-20T12:00:00Z"),
                "workoutSessionExercises": .array([.object([
                    "id": .string("wse"),
                    "position": .number(0),
                    "exercise": .object([
                        "id": .string("bench"), "name": .string("Bench"),
                        "kind": .string("strength"), "primaryMuscleGroup": .string("chest"),
                        "strength": .object(["doubleWeight": .bool(true)])
                    ]),
                    "workoutSessionStrengthSets": .array([.object([
                        "id": .string("set"), "setNumber": .number(1),
                        "reps": .number(10), "weight": .string("20")
                    ])]),
                    "workoutSessionCardioEntries": .array([])
                ])])
            ])])
        ]))])
        let repository = SessionsRepository(graphQL: fake)
        let before = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-06-26T12:00:00Z"))

        let sessions = try await repository.priorWorkoutSessions(
            workoutId: "workout-1", before: before, excludeSessionId: "current"
        )

        XCTAssertEqual(sessions.first?.strengthTotals, SessionStrengthTotals(sets: 1, reps: 10, volume: 400, hasStrength: true))
        let requests = await fake.requestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.variables?["workoutId"], .string("workout-1"))
        XCTAssertEqual(request.variables?["excludeSessionId"], .string("current"))
        XCTAssertTrue(request.query.contains("limit: 3"))
        XCTAssertTrue(request.query.contains("_lte: $before"))
    }

    func testProgressQueryDecodesOnlyStrengthSetRows() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "workoutSessionExercises": .array([.object([
                "id": .string("wse"),
                "exercise": .object([
                    "id": .string("row"), "name": .string("Row"),
                    "strength": .object(["doubleWeight": .bool(true)])
                ]),
                "workoutSession": .object([
                    "id": .string("session"), "startedAt": .string("2026-06-26T12:00:00Z")
                ]),
                "workoutSessionStrengthSets": .array([.object([
                    "id": .string("set"), "setNumber": .number(1),
                    "reps": .number(8), "weight": .string("25")
                ])])
            ])])
        ]))])
        let repository = SessionsRepository(graphQL: fake)

        let since = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-01-05T00:00:00Z"))
        let entries = try await repository.strengthProgressEntries(since: since)

        XCTAssertEqual(entries.first?.exercise.name, "Row")
        XCTAssertEqual(entries.first?.workoutSessionStrengthSets.first?.weight, 25)
        let requests = await fake.requestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.operationName, "WorkoutStrengthProgress")
        XCTAssertEqual(request.variables?["since"], .string("2026-01-05T00:00:00.000Z"))
        XCTAssertTrue(request.query.contains("$since: timestamptz!"))
        XCTAssertTrue(request.query.contains("startedAt: { _gte: $since }"))
        XCTAssertTrue(request.query.contains("workoutSessionStrengthSets: {}"))
        XCTAssertTrue(request.query.contains("kind: { _eq: \"strength\" }"))
    }

    func testProgressUpdatesUseSessionCache() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object(["workoutSessionExercises": .array([])]))])
        let repository = SessionsRepository(graphQL: fake)

        let since = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-01-05T00:00:00Z"))
        var emissions: [[WorkoutProgressEntry]] = []
        for try await entries in repository.strengthProgressUpdates(since: since) {
            emissions.append(entries)
        }

        XCTAssertEqual(emissions, [[]])
        let requests = await fake.cachedRequestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.request.operationName, "WorkoutStrengthProgress")
        XCTAssertEqual(request.request.variables?["since"], .string("2026-01-05T00:00:00.000Z"))
        XCTAssertEqual(request.namespace, "sessions")
        XCTAssertEqual(request.tags, ["sessions"])
        XCTAssertEqual(requests.count, 1)
    }

    func testProgressPriorWeekSnapshotUsesExactStreamCacheIdentityWithoutNetwork() async throws {
        let fake = FakeGraphQLService(cachedOnlyReplies: [
            .json(.object(["workoutSessionExercises": .array([])]))
        ])
        let repository = SessionsRepository(graphQL: fake)
        let since = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-01-05T00:00:00Z"))

        let entries = try await repository.cachedStrengthProgressEntries(since: since)

        XCTAssertEqual(entries, [])
        let cacheReads = await fake.cachedOnlyRequestsSnapshot()
        let request = try XCTUnwrap(cacheReads.first)
        XCTAssertEqual(cacheReads.count, 1)
        XCTAssertEqual(request.request.query, SessionsRepository.workoutStrengthProgressQuery)
        XCTAssertEqual(request.request.variables?["since"], GraphQLScalars.timestamptz(since))
        XCTAssertEqual(request.request.operationName, "WorkoutStrengthProgress")
        XCTAssertEqual(request.namespace, "sessions")
        XCTAssertEqual(request.tags, ["sessions"])
        let networkRequests = await fake.requestsSnapshot()
        XCTAssertTrue(networkRequests.isEmpty)
    }

    @MainActor
    func testWeekRolloverKeepsPriorCacheOfflineThenReplacesItWithFreshData() async throws {
        var calendar = Calendar(identifier: .iso8601)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let now = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-07-10T12:00:00Z"))
        let previousSince = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-01-05T00:00:00Z"))
        let currentSince = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-01-12T00:00:00Z"))
        let service = ControlledProgressGraphQL(
            cachedSince: GraphQLScalars.timestamptz(previousSince), blockedRequestIndex: 1,
            failedRequestIndex: 1, recentDate: "2026-07-10T10:00:00Z"
        )
        let viewModel = WorkoutProgressViewModel(
            repository: SessionsRepository(graphQL: service), calendar: calendar, clock: { now }
        )

        let offlineLoad = Task { await viewModel.load() }
        await service.waitForRequests(1)
        XCTAssertEqual(viewModel.progress?.recentExercises.map(\.name), ["Cached"])
        XCTAssertTrue(viewModel.isShowingPriorWeekCache)
        let cacheReads = await service.cacheReadsSnapshot()
        let read = try XCTUnwrap(cacheReads.first)
        XCTAssertEqual(cacheReads.count, 2)
        XCTAssertEqual(read.request.variables?["since"], GraphQLScalars.timestamptz(currentSince))
        let priorRead = cacheReads[1]
        XCTAssertEqual(priorRead.request.query, SessionsRepository.workoutStrengthProgressQuery)
        XCTAssertEqual(priorRead.request.operationName, "WorkoutStrengthProgress")
        XCTAssertEqual(priorRead.request.variables?["since"], GraphQLScalars.timestamptz(previousSince))
        XCTAssertEqual(priorRead.namespace, "sessions")
        XCTAssertEqual(priorRead.tags, ["sessions"])
        let initialRequests = await service.requestDatesSnapshot()
        XCTAssertEqual(initialRequests, [GraphQLScalars.timestamptz(currentSince)])

        await service.releaseBlocked()
        await offlineLoad.value
        XCTAssertNotNil(viewModel.state.errorMessage)
        XCTAssertEqual(viewModel.progress?.recentExercises.map(\.name), ["Cached"])
        XCTAssertTrue(viewModel.isShowingPriorWeekCache)

        await viewModel.load()
        XCTAssertNil(viewModel.state.errorMessage)
        XCTAssertEqual(viewModel.progress?.recentExercises.map(\.name), ["Bench"])
        XCTAssertFalse(viewModel.isShowingPriorWeekCache)
        let finalRequests = await service.requestDatesSnapshot()
        XCTAssertEqual(finalRequests, [
            GraphQLScalars.timestamptz(currentSince), GraphQLScalars.timestamptz(currentSince)
        ])
        let finalReads = await service.cacheReadsSnapshot()
        XCTAssertEqual(finalReads.count, 2)
    }

    @MainActor
    func testWarmCurrentWeekCacheSkipsOlderSnapshotAndNotice() async throws {
        var calendar = Calendar(identifier: .iso8601)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let now = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-07-10T12:00:00Z"))
        let previousSince = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-01-05T00:00:00Z"))
        let currentSince = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-01-12T00:00:00Z"))
        let service = ControlledProgressGraphQL(
            cachedSince: GraphQLScalars.timestamptz(currentSince),
            otherCachedSince: GraphQLScalars.timestamptz(previousSince),
            blockedRequestIndex: 1, recentDate: "2026-07-10T10:00:00Z"
        )
        let viewModel = WorkoutProgressViewModel(
            repository: SessionsRepository(graphQL: service), calendar: calendar, clock: { now }
        )
        var showedOlderNotice = false
        let observation = viewModel.$isShowingPriorWeekCache.sink { showedOlderNotice = showedOlderNotice || $0 }
        defer { observation.cancel() }

        let load = Task { await viewModel.load() }
        await service.waitForRequests(1)
        XCTAssertEqual(viewModel.progress?.recentExercises.map(\.name), ["Cached"])
        XCTAssertFalse(viewModel.isShowingPriorWeekCache)
        let cacheReads = await service.cacheReadsSnapshot()
        XCTAssertEqual(cacheReads.map { $0.request.variables?["since"] }, [GraphQLScalars.timestamptz(currentSince)])
        let requests = await service.requestDatesSnapshot()
        XCTAssertEqual(requests, [GraphQLScalars.timestamptz(currentSince)])

        await service.releaseBlocked()
        await load.value
        XCTAssertEqual(viewModel.progress?.recentExercises.map(\.name), ["Bench"])
        XCTAssertFalse(showedOlderNotice)
    }

    @MainActor
    func testWiderRangeFetchesOnceAndRetainsPreviousWhileLoading() async throws {
        var calendar = Calendar(identifier: .iso8601)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let now = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-07-03T12:00:00Z"))
        let service = ControlledProgressGraphQL()
        let viewModel = WorkoutProgressViewModel(
            repository: SessionsRepository(graphQL: service), calendar: calendar, clock: { now }
        )

        await viewModel.load()
        let previous = try XCTUnwrap(viewModel.progress)
        XCTAssertEqual(previous.recentExercises.first?.points.count, 1)
        let initialSince = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-01-05T00:00:00Z"))
        let initialRequests = await service.requestDatesSnapshot()
        XCTAssertEqual(initialRequests, [GraphQLScalars.timestamptz(initialSince)])
        let initialCacheReads = await service.cacheReadsSnapshot()
        XCTAssertEqual(initialCacheReads.count, 2) // Cache-only misses do not make network requests.
        XCTAssertFalse(viewModel.isShowingPriorWeekCache)
        // The widest preset is already covered; only an older custom start needs a new request.
        let presetStart = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-01-05T00:00:00Z"))
        await viewModel.extendHistory(to: presetStart)
        let presetRequests = await service.requestDatesSnapshot()
        XCTAssertEqual(presetRequests, initialRequests)

        let olderStart = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2025-09-03T00:00:00Z"))
        let extendedLoad = Task { await viewModel.extendHistory(to: olderStart) }
        await service.waitForRequests(2)
        XCTAssertEqual(viewModel.progress, previous)
        XCTAssertTrue(viewModel.state.isLoading)
        await viewModel.extendHistory(to: olderStart)
        let requestCount = await service.requestDatesSnapshot().count
        XCTAssertEqual(requestCount, 2)

        await service.releaseBlocked()
        await extendedLoad.value
        XCTAssertEqual(viewModel.progress?.recentExercises.first?.points.count, 2)
        let extendedSince = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2025-09-01T00:00:00Z"))
        let finalRequests = await service.requestDatesSnapshot()
        XCTAssertEqual(finalRequests, [
            GraphQLScalars.timestamptz(initialSince), GraphQLScalars.timestamptz(extendedSince)
        ])
        let finalCacheReads = await service.cacheReadsSnapshot()
        XCTAssertEqual(finalCacheReads.count, 2) // Expanding an already visible history does not probe keys.
    }

    private func entry(
        _ id: String, _ exerciseId: String, _ name: String, _ startedAt: String,
        _ weight: Double, _ reps: Int, doubleWeight: Bool = false,
        sets: [ExerciseStrengthSet]? = nil
    ) -> WorkoutProgressEntry {
        WorkoutProgressEntry(
            id: id,
            exercise: WorkoutProgressExercise(
                id: exerciseId, name: name, strength: ExerciseStrengthSummary(doubleWeight: doubleWeight)
            ),
            workoutSession: SessionPriorWorkoutSession(id: id, startedAt: startedAt),
            workoutSessionStrengthSets: sets ?? [ExerciseStrengthSet(id: id, setNumber: 1, reps: reps, weight: weight)]
        )
    }
}

private actor ControlledProgressGraphQL: GraphQLServicing {
    private var dates: [JSONValue] = []
    private var cacheReads: [GraphQLCachedRequestRecord] = []
    private var waiters: [CheckedContinuation<Void, Never>] = []
    private var release: CheckedContinuation<Void, Never>?
    private let cachedSince: JSONValue?
    private let otherCachedSince: JSONValue?
    private let blockedRequestIndex: Int
    private let failedRequestIndex: Int?
    private let recentDate: String

    init(
        cachedSince: JSONValue? = nil, otherCachedSince: JSONValue? = nil,
        blockedRequestIndex: Int = 2, failedRequestIndex: Int? = nil,
        recentDate: String = "2026-07-03T10:00:00Z"
    ) {
        self.cachedSince = cachedSince
        self.otherCachedSince = otherCachedSince
        self.blockedRequestIndex = blockedRequestIndex
        self.failedRequestIndex = failedRequestIndex
        self.recentDate = recentDate
    }

    func requestDatesSnapshot() -> [JSONValue] { dates }
    func cacheReadsSnapshot() -> [GraphQLCachedRequestRecord] { cacheReads }

    func cachedSnapshot<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type, query: String, variables: [String: JSONValue]?,
        operationName: String?, namespace: String, tags: Set<String>
    ) async throws -> ResponseData? {
        cacheReads.append(GraphQLCachedRequestRecord(
            request: GraphQLRequestRecord(query: query, variables: variables, operationName: operationName),
            namespace: namespace, tags: tags
        ))
        guard cachedSince == variables?["since"] || otherCachedSince == variables?["since"] else { return nil }
        let isOlder = otherCachedSince == variables?["since"]
        let cached = Self.entry(
            id: "cached", exercise: isOlder ? "Prior" : "Cached", date: "2026-07-04T10:00:00Z"
        )
        return try JSONDecoder().decode(responseType, from: JSONEncoder().encode(
            JSONValue.object(["workoutSessionExercises": .array([cached])])
        ))
    }

    func waitForRequests(_ count: Int) async {
        if dates.count >= count { return }
        await withCheckedContinuation { waiters.append($0) }
    }

    func releaseBlocked() { release?.resume(); release = nil }

    func execute<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type, query: String, variables: [String: JSONValue]?, operationName: String?
    ) async throws -> ResponseData {
        throw GraphQLDomainError.missingData(operationName: operationName)
    }

    nonisolated func cachedQuery<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type, query: String, variables: [String: JSONValue]?,
        operationName: String?, namespace: String, tags: Set<String>
    ) -> AsyncThrowingStream<GraphQLQueryEmission<ResponseData>, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    let result = try await self.produce(responseType, since: variables?["since"])
                    continuation.yield(.fresh(result))
                    continuation.finish()
                } catch { continuation.finish(throwing: error) }
            }
            continuation.onTermination = { @Sendable _ in task.cancel() }
        }
    }

    private func produce<ResponseData: Decodable & Sendable>(
        _ responseType: ResponseData.Type, since: JSONValue?
    ) async throws -> ResponseData {
        dates.append(since ?? .null)
        let isExtended = dates.count > 1 && since != dates.first
        let ready = waiters
        waiters.removeAll()
        ready.forEach { $0.resume() }
        if dates.count == blockedRequestIndex { await withCheckedContinuation { release = $0 } }
        if dates.count == failedRequestIndex { throw URLError(.notConnectedToInternet) }
        let recent = Self.entry(id: "recent", exercise: "Bench", date: recentDate)
        let old: JSONValue = .object([
            "id": .string("old"),
            "exercise": .object(["id": .string("bench"), "name": .string("Bench"), "strength": .null]),
            "workoutSession": .object(["id": .string("old"), "startedAt": .string("2025-09-01T10:00:00Z")]),
            "workoutSessionStrengthSets": .array([.object([
                "id": .string("old-set"), "setNumber": .number(1), "reps": .number(5), "weight": .number(80)
            ])])
        ])
        let payload = JSONValue.object(["workoutSessionExercises": .array(isExtended ? [old, recent] : [recent])])
        return try JSONDecoder().decode(responseType, from: JSONEncoder().encode(payload))
    }

    private static func entry(id: String, exercise: String, date: String) -> JSONValue {
        .object([
            "id": .string(id),
            "exercise": .object(["id": .string(exercise.lowercased()), "name": .string(exercise), "strength": .null]),
            "workoutSession": .object(["id": .string(id), "startedAt": .string(date)]),
            "workoutSessionStrengthSets": .array([.object([
                "id": .string("\(id)-set"), "setNumber": .number(1), "reps": .number(5), "weight": .number(100)
            ])])
        ])
    }
}
