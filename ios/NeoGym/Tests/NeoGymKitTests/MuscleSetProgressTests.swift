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
