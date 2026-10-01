import Foundation
import XCTest
@testable import NeoGymKit

@MainActor
final class WatchBackgroundUploadFollowUpsTests: XCTestCase {
    func testWakeWaitsForDeliveredFollowUp() async {
        let followUps = WatchBackgroundUploadFollowUps()
        let started = expectation(description: "result follow-up started")
        var release: CheckedContinuation<Void, Never>?
        var completed = 0
        let gate = WatchCompletionGate { completed += 1 }
        followUps.submit {
            await withCheckedContinuation { continuation in
                release = continuation
                started.fulfill()
            }
        }
        await fulfillment(of: [started], timeout: 5)
        let finishing = Task { await followUps.finishEvents(completion: gate) }
        await Task.yield()
        XCTAssertEqual(completed, 0)
        release?.resume()
        await finishing.value
        XCTAssertEqual(completed, 1)
    }

    func testExpirationRacingFollowUpCompletesWakeOnce() async {
        let followUps = WatchBackgroundUploadFollowUps()
        let started = expectation(description: "result follow-up started")
        var release: CheckedContinuation<Void, Never>?
        var completed = 0
        let gate = WatchCompletionGate { completed += 1 }
        followUps.submit {
            await withCheckedContinuation { continuation in
                release = continuation
                started.fulfill()
            }
        }
        await fulfillment(of: [started], timeout: 5)
        let finishing = Task { await followUps.finishEvents(completion: gate) }
        await Task.yield()
        followUps.cancelPending()
        XCTAssertTrue(gate.complete())
        XCTAssertEqual(completed, 1)
        release?.resume()
        await finishing.value
        XCTAssertEqual(completed, 1)
    }
}
