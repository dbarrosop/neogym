import Foundation
import XCTest
@testable import NeoGymKit

final class ExercisePickerTests: XCTestCase {
    private let catalog = [
        ExerciseListItem(id: "bench", name: "Bench press", primaryMuscleGroup: "chest", category: "strength", isPublic: true),
        ExerciseListItem(id: "rdl", name: "Romanian deadlift", primaryMuscleGroup: "hamstrings", category: "strength", isPublic: true),
        ExerciseListItem(id: "pulldown", name: "Lat pulldown", primaryMuscleGroup: "lats", category: "strength", isPublic: true),
        ExerciseListItem(id: "face", name: "Face pull", primaryMuscleGroup: "rear_delts", category: "strength", isPublic: true),
        ExerciseListItem(id: "row", name: "Rowing machine", primaryMuscleGroup: "quadriceps", category: "cardio", isPublic: true)
    ]

    func testRecentComeFirstDedupedAndLimitedThenTheRest() {
        let sections = ExercisePickerSections(
            exercises: catalog,
            excluding: [],
            recentIds: ["pulldown", "rdl", "pulldown", "missing", "face"],
            filter: .all,
            query: "",
            recentLimit: 2
        )

        XCTAssertEqual(sections.recent.map(\.id), ["pulldown", "rdl"])
        XCTAssertEqual(sections.all.map(\.id), ["bench", "face", "row"])
    }

    func testAlreadySelectedSearchAndChipsNarrowBothLists() {
        let legs = ExercisePickerSections(
            exercises: catalog, excluding: ["bench"], recentIds: ["rdl"], filter: .legs, query: ""
        )
        XCTAssertEqual(legs.recent.map(\.id), ["rdl"])
        XCTAssertEqual(legs.all.map(\.id), ["row"])

        let search = ExercisePickerSections(
            exercises: catalog, excluding: ["bench"], recentIds: [], filter: .all, query: " PULL "
        )
        XCTAssertEqual(search.all.map(\.id), ["pulldown", "face"])
        XCTAssertTrue(ExercisePickerSections(
            exercises: catalog, excluding: [], recentIds: [], filter: .arms, query: ""
        ).isEmpty)
    }

    func testCardioChipFollowsCategoryAndShouldersIncludeDelts() {
        XCTAssertTrue(ExercisePickerFilter.cardio.matches(catalog[4]))
        XCTAssertFalse(ExercisePickerFilter.cardio.matches(catalog[1]))
        XCTAssertTrue(ExercisePickerFilter.shoulders.matches(catalog[3]))
        XCTAssertTrue(ExercisePickerFilter.back.matches(catalog[2]))
    }

    func testRecentQueryCountsOnlyLoggedRowsNewestFirst() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "workoutSessionExercises": .array([
                .object(["exerciseId": .string("pulldown")]),
                .object(["exerciseId": .string("rdl")])
            ])
        ]))])
        let ids = try await ExercisesRepository(graphQL: fake).recentlyLoggedExerciseIds()

        XCTAssertEqual(ids, ["pulldown", "rdl"])
        let requests = await fake.requestsSnapshot()
        let query = try XCTUnwrap(requests.first?.query)
        XCTAssertTrue(query.contains("order_by: [{ workoutSession: { startedAt: desc } }, { position: asc }]"))
        XCTAssertTrue(query.contains("_or: [{ workoutSessionStrengthSets: {} }, { workoutSessionCardioEntries: {} }]"))
    }
}
