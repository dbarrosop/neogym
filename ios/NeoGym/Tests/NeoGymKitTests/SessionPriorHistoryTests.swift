import Foundation
import XCTest
@testable import NeoGymKit

/// "Last time" history must come from occurrences strictly before the current
/// session that logged something, limited afterwards, preferring the same
/// workout (root CLAUDE.md, "Session logging").
final class SessionPriorHistoryTests: XCTestCase {
    func testQueryBoundsHistoryBeforeTheSessionAndSkipsEmptyOccurrences() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object(["exercises": .array([])]))])
        let repository = SessionsRepository(graphQL: fake)

        _ = try await repository.priorSessionsPerExercise(
            exerciseIds: ["bench"], before: Date(timeIntervalSince1970: 1_800_000_000),
            workoutId: "workout-1", excludeSessionId: "session-current"
        )

        let requests = await fake.requestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.variables?["workoutId"], JSONValue.string("workout-1"))
        XCTAssertEqual(request.variables?["hasWorkout"], JSONValue.bool(true))
        XCTAssertEqual(request.variables?["before"], GraphQLScalars.timestamptz(Date(timeIntervalSince1970: 1_800_000_000)))
        XCTAssertTrue(request.query.contains("startedAt: { _lt: $before }"))
        XCTAssertTrue(request.query.contains(
            "_or: [{ workoutSessionStrengthSets: {} }, { workoutSessionCardioEntries: {} }]"
        ))
        XCTAssertTrue(request.query.contains("sameWorkoutSessions: workoutSessionExercises("))
        XCTAssertTrue(request.query.contains("@include(if: $hasWorkout)"))
    }

    func testAdHocSessionSkipsSameWorkoutHistory() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object(["exercises": .array([])]))])
        let repository = SessionsRepository(graphQL: fake)

        _ = try await repository.priorSessionsPerExercise(
            exerciseIds: ["bench"], before: Date(), workoutId: nil, excludeSessionId: "session-current"
        )

        let requests = await fake.requestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.variables?["workoutId"], JSONValue.null)
        XCTAssertEqual(request.variables?["hasWorkout"], JSONValue.bool(false))
    }

    func testSameWorkoutHistoryWinsOverNewerOtherWorkoutHistory() throws {
        let json = """
        {"exercises": [{
          "id": "bench",
          "workoutSessionExercises": [
            {"id": "other-new", "workoutSession": {"id": "s3", "startedAt": "2026-11-10T06:00:00Z"},
             "workoutSessionStrengthSets": [{"id": "a", "setNumber": 1, "reps": 5, "weight": 100}],
             "workoutSessionCardioEntries": []}
          ],
          "sameWorkoutSessions": [
            {"id": "same-old", "workoutSession": {"id": "s1", "startedAt": "2026-10-01T06:00:00Z"},
             "workoutSessionStrengthSets": [{"id": "b", "setNumber": 1, "reps": 8, "weight": 90}],
             "workoutSessionCardioEntries": []}
          ]
        }, {
          "id": "row",
          "workoutSessionExercises": [
            {"id": "row-new", "workoutSession": {"id": "s3", "startedAt": "2026-11-10T06:00:00Z"},
             "workoutSessionStrengthSets": [{"id": "c", "setNumber": 1, "reps": 10, "weight": 60}],
             "workoutSessionCardioEntries": []}
          ]
        }]}
        """
        let decoded = try JSONDecoder().decode(PriorHistoryEnvelope.self, from: Data(json.utf8))
        let history = SessionPriorHistory(exercises: decoded.exercises)

        XCTAssertEqual(history.strengthByExercise["bench"]?.map(\.id), ["same-old"])
        // No same-workout occurrence (or an ad-hoc session): all history applies.
        XCTAssertEqual(history.strengthByExercise["row"]?.map(\.id), ["row-new"])
        let lastTime = SessionLogging.lastTime(
            exerciseId: "bench", priorWorkoutSessions: [],
            exerciseHistory: history.strengthByExercise["bench"] ?? []
        )
        XCTAssertEqual(lastTime?.id, "same-old")
    }
}

private struct PriorHistoryEnvelope: Decodable {
    let exercises: [SessionPriorExerciseHistory]
}
