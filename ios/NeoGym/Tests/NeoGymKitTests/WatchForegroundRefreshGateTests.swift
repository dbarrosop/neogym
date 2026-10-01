import XCTest
@testable import NeoGymKit

final class WatchForegroundRefreshGateTests: XCTestCase {
    func testInitialForegroundAndInactiveRaiseDoNotRefresh() {
        var gate = WatchForegroundRefreshGate()
        XCTAssertFalse(gate.enteredActive())
        // Inactive is intentionally not a gate input; a wrist raise without
        // an intervening background transition must not request another read.
        XCTAssertFalse(gate.enteredActive())
    }

    func testBackgroundOnlyLaunchRefreshesOnceWhenViewFirstBecomesActive() {
        var gate = WatchForegroundRefreshGate()
        gate.enteredBackground() // Application delegate; no SwiftUI scene yet.
        XCTAssertTrue(gate.enteredActive())
        XCTAssertFalse(gate.enteredActive())
    }

    func testRepeatedBackgroundSignalsCoalesceAndLaterReturnRefreshesAgain() {
        var gate = WatchForegroundRefreshGate()
        gate.enteredBackground() // Delegate.
        gate.enteredBackground() // Scene, if it exists during the background launch.
        XCTAssertTrue(gate.enteredActive())
        gate.enteredBackground()
        XCTAssertTrue(gate.enteredActive())
    }
}
