import Foundation
import XCTest
@testable import NeoGymKit

private final class ExpiryCount: @unchecked Sendable {
    private let lock = NSLock()
    private var value = 0

    func increment() { lock.withLock { value += 1 } }
    var count: Int { lock.withLock { value } }
}

final class WatchActivityLeaseTests: XCTestCase {
    func testDeadlineOnlyEndsAssertionAndDoesNotCancelOperation() {
        let count = ExpiryCount()
        let lease = WatchActivityLease(onSystemExpiry: { count.increment() })
        lease.waitUntilEnded(limit: .milliseconds(1))
        lease.systemExpired() // Late system callback cannot cancel completed assertion.
        XCTAssertEqual(count.count, 0)
    }

    @MainActor
    func testQueuedExpiryCannotCancelReplacementActivity() {
        let gate = WatchActivityExpiryGate()
        let old = UUID()
        let replacement = UUID()
        var cancelled: [String] = []

        gate.register("read", id: old) { cancelled.append("old") }
        gate.register("read", id: replacement) { cancelled.append("replacement") }
        XCTAssertFalse(gate.expire("read", id: old))
        XCTAssertTrue(gate.matches("read", id: replacement))
        XCTAssertTrue(cancelled.isEmpty)
        XCTAssertTrue(gate.expire("read", id: replacement))
        XCTAssertEqual(cancelled, ["replacement"])
        XCTAssertFalse(gate.expire("read", id: replacement))

        let ended = UUID()
        gate.register("read", id: ended) { cancelled.append("ended") }
        gate.remove("read")
        XCTAssertFalse(gate.expire("read", id: ended))
        XCTAssertEqual(cancelled, ["replacement"])
    }

    func testSystemExpirySignalsOnceEvenWhenEndRacesIt() {
        let count = ExpiryCount()
        let lease = WatchActivityLease(onSystemExpiry: { count.increment() })
        DispatchQueue.concurrentPerform(iterations: 50) { index in
            if index.isMultiple(of: 2) { lease.end() }
            else { lease.systemExpired() }
        }
        lease.waitUntilEnded(limit: .milliseconds(1))
        XCTAssertLessThanOrEqual(count.count, 1)

        let before = count.count
        let expired = WatchActivityLease(onSystemExpiry: { count.increment() })
        expired.systemExpired()
        expired.end()
        expired.systemExpired()
        XCTAssertEqual(count.count, before + 1)
    }
}
