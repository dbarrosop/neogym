import XCTest
@testable import NeoGymKit

final class ChartSeriesVisibilityStateTests: XCTestCase {
    func testDefaultStateShowsAllCandidatesInOrder() {
        let state = ChartSeriesVisibilityState()

        XCTAssertEqual(state.visibleIDs(among: ["weight", "body-fat", "net"]), ["weight", "body-fat", "net"])
        XCTAssertTrue(state.isVisible("weight"))
    }

    func testToggleHidesAndRestoresCandidate() {
        var state = ChartSeriesVisibilityState()

        state.toggle("body-fat", among: ["weight", "body-fat", "net"])
        XCTAssertFalse(state.isVisible("body-fat"))
        XCTAssertEqual(state.visibleIDs(among: ["weight", "body-fat", "net"]), ["weight", "net"])

        state.toggle("body-fat", among: ["weight", "body-fat", "net"])
        XCTAssertTrue(state.isVisible("body-fat"))
        XCTAssertEqual(state.visibleIDs(among: ["weight", "body-fat", "net"]), ["weight", "body-fat", "net"])
    }

    func testToggleRefusesToHideLastEffectivelyVisibleCandidate() {
        var state = ChartSeriesVisibilityState()

        state.toggle("weight", among: ["weight", "body-fat"])
        state.toggle("body-fat", among: ["weight", "body-fat"])

        XCTAssertFalse(state.isVisible("weight"))
        XCTAssertTrue(state.isVisible("body-fat"))
        XCTAssertEqual(state.visibleIDs(among: ["weight", "body-fat"]), ["body-fat"])
    }

    func testVisibleIDsFallsBackToAllCandidatesWhenRawStateWouldHideEveryCandidate() {
        let state = ChartSeriesVisibilityState(hiddenIDs: ["weight", "body-fat"])

        XCTAssertFalse(state.isVisible("weight"))
        XCTAssertFalse(state.isVisible("body-fat"))
        XCTAssertEqual(state.visibleIDs(among: ["weight", "body-fat"]), ["weight", "body-fat"])
    }

    func testVisibleIDsPreservesCandidateOrder() {
        let state = ChartSeriesVisibilityState(hiddenIDs: ["weight"])

        XCTAssertEqual(
            state.visibleIDs(among: ["net", "weight", "rolling-net", "body-fat"]),
            ["net", "rolling-net", "body-fat"]
        )
    }

    func testCandidateSetChangesKeepHiddenIDsButUseEffectiveFallback() {
        var state = ChartSeriesVisibilityState()

        state.toggle("weight", among: ["weight", "body-fat"])

        XCTAssertEqual(state.visibleIDs(among: ["weight"]), ["weight"])
        XCTAssertFalse(state.isVisible("weight"))
        XCTAssertEqual(state.visibleIDs(among: ["weight", "body-fat", "net"]), ["body-fat", "net"])
    }

    func testToggleIgnoresIDsOutsideCandidateSet() {
        var state = ChartSeriesVisibilityState()

        state.toggle("missing", among: ["weight", "body-fat"])

        XCTAssertEqual(state.visibleIDs(among: ["weight", "body-fat"]), ["weight", "body-fat"])
        XCTAssertTrue(state.hiddenIDs.isEmpty)
    }
}
