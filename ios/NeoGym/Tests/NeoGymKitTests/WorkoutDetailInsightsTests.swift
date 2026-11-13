import Foundation
import XCTest
@testable import NeoGymKit

final class WorkoutDetailInsightsTests: XCTestCase {
    private func set(_ reps: Int, _ weight: Double) -> SessionStrengthSet {
        SessionStrengthSet(id: "\(reps)-\(weight)", setNumber: 1, reps: reps, weight: weight)
    }

    func testTopSetIsHeaviestThenMostReps() {
        XCTAssertEqual(WorkoutDetailInsights.topSetLabel([set(8, 135), set(7, 140), set(5, 140)]), "140 × 7")
        XCTAssertEqual(WorkoutDetailInsights.topSetLabel([set(20, 0), set(18, 0)]), "BW × 20")
        let posix = Locale(identifier: "en_US_POSIX")
        XCTAssertEqual(WorkoutDetailInsights.topSetLabel([set(9, 22.5)], locale: posix), "22.5 × 9")
        XCTAssertNil(WorkoutDetailInsights.topSetLabel([]))
    }

    func testReportWindowIsTheLast366LocalDays() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "Europe/Stockholm"))
        let today = try XCTUnwrap(calendar.date(from: DateComponents(year: 2026, month: 11, day: 12, hour: 23)))

        let days = WorkoutDetailInsights.reportDays(today: today, calendar: calendar)

        XCTAssertEqual(days.from, "2025-11-12")
        XCTAssertEqual(days.through, "2026-11-12")
    }

    func testQueryReadsReportRootAndLatestLoggedSetsOldestBarFirst() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "workoutStrengthReport": .array([
                .object(["sessionId": .string("s2"), "startedAt": .string("2026-11-12T06:00:00Z"), "volume": .string("12435")]),
                .object(["sessionId": .string("s1"), "startedAt": .string("2026-10-28T06:00:00Z"), "volume": .number(13268)])
            ]),
            "exercises": .array([
                .object(["id": .string("rdl"), "workoutSessionExercises": .array([.object([
                    "workoutSessionStrengthSets": .array([
                        .object(["id": .string("a"), "setNumber": .number(1), "reps": .number(7), "weight": .number(140)])
                    ])
                ])])]),
                .object(["id": .string("new"), "workoutSessionExercises": .array([])])
            ])
        ]))])
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/New_York"))

        let insights = try await WorkoutsRepository(graphQL: fake).workoutDetailInsights(
            workoutId: "w", exerciseIds: ["rdl", "new"], today: Date(timeIntervalSince1970: 1_794_500_000), calendar: calendar
        )

        XCTAssertEqual(insights.volumeBars.map(\.id), ["s1", "s2"])
        XCTAssertEqual(insights.volumeBars.map(\.volume), [13268, 12435])
        XCTAssertEqual(insights.lastTopSetByExercise, ["rdl": "140 × 7"])
        let requests = await fake.requestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.variables?["timeZone"], JSONValue.string("America/New_York"))
        XCTAssertTrue(request.query.contains("where: { volume: { _gt: 0 } }"))
        XCTAssertTrue(request.query.contains("where: { workoutSessionStrengthSets: {} }"))
    }
}
