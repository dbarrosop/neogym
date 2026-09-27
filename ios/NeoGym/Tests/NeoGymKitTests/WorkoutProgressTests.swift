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

        let entries = try await repository.strengthProgressEntries()

        XCTAssertEqual(entries.first?.exercise.name, "Row")
        XCTAssertEqual(entries.first?.workoutSessionStrengthSets.first?.weight, 25)
        let requests = await fake.requestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.operationName, "WorkoutStrengthProgress")
        XCTAssertTrue(request.query.contains("workoutSessionStrengthSets: {}"))
        XCTAssertTrue(request.query.contains("kind: { _eq: \"strength\" }"))
    }

    func testProgressUpdatesUseSessionCache() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object(["workoutSessionExercises": .array([])]))])
        let repository = SessionsRepository(graphQL: fake)

        var emissions: [[WorkoutProgressEntry]] = []
        for try await entries in repository.strengthProgressUpdates() {
            emissions.append(entries)
        }

        XCTAssertEqual(emissions, [[]])
        let requests = await fake.cachedRequestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.request.operationName, "WorkoutStrengthProgress")
        XCTAssertEqual(request.namespace, "sessions")
        XCTAssertEqual(request.tags, ["sessions"])
        XCTAssertEqual(requests.count, 1)
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
