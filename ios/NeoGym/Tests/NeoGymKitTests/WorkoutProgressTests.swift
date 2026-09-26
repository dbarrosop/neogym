import Foundation
import XCTest
@testable import NeoGymKit

final class WorkoutProgressTests: XCTestCase {
    func testWeeklyVolumeAndRecentExerciseEligibility() throws {
        var calendar = Calendar(identifier: .iso8601)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let now = try XCTUnwrap(ExerciseDateParser.parseTimestamp("2026-06-26T12:00:00Z"))
        let entries = [
            entry("old-bench", "bench", "Bench", "2026-06-10T12:00:00Z", 100, 5),
            entry("recent-bench", "bench", "Bench", "2026-06-17T00:00:00Z", 120, 5),
            entry("today-row", "row", "Row", "2026-06-26T10:00:00Z", 20, 10, doubleWeight: true),
            entry("old-squat", "squat", "Squat", "2026-06-16T12:00:00Z", 80, 10),
            entry("empty", "empty", "Empty", "2026-06-26T10:00:00Z", 50, 5, sets: []),
            entry("future", "future", "Future", "2026-06-27T10:00:00Z", 50, 5)
        ]

        let result = WorkoutProgressBuilder.build(entries: entries, now: now, calendar: calendar)

        XCTAssertEqual(result.recentExercises.map(\.id), ["bench", "row"])
        XCTAssertEqual(result.recentExercises[0].points.map(\.volume), [500, 600])
        XCTAssertEqual(result.recentExercises[0].points.last?.oneRepMax ?? 0, 140, accuracy: 0.001)
        XCTAssertEqual(result.recentExercises[1].points.last?.oneRepMax ?? 0, 26.666, accuracy: 0.001)
        XCTAssertEqual(result.weeklyVolume.map(\.volume), [500, 1_400, 400])
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
