import XCTest
@testable import NeoGymKit

final class SessionDisplayNameTests: XCTestCase {
    func testUsesWorkoutNameWhenPresent() {
        XCTAssertEqual(
            SessionDisplayName.make(workoutName: "Push Day", exerciseNames: ["Bench press"]),
            "Push Day"
        )
    }

    func testFallsBackToUntitledWhenNoWorkoutOrExercises() {
        XCTAssertEqual(SessionDisplayName.make(workoutName: nil, exerciseNames: []), "Untitled session")
        XCTAssertEqual(SessionDisplayName.make(workoutName: "", exerciseNames: []), "Untitled session")
    }

    func testUsesFirstExerciseWhenAdHocSessionHasOneExercise() {
        XCTAssertEqual(SessionDisplayName.make(workoutName: nil, exerciseNames: ["Bench press"]), "Bench press")
    }

    func testAddsMoreSuffixForMultipleAdHocExercises() {
        XCTAssertEqual(
            SessionDisplayName.make(workoutName: nil, exerciseNames: ["Bench press", "Squat", "Row"]),
            "Bench press +2 more"
        )
    }
}
