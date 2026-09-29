import Foundation
import XCTest
@testable import NeoGymKit

private final class CompletionCount: @unchecked Sendable {
    private let lock = NSLock()
    private var count = 0

    func increment() {
        lock.lock()
        count += 1
        lock.unlock()
    }

    var value: Int {
        lock.lock()
        defer { lock.unlock() }
        return count
    }
}

final class WatchObserverCompletionGateTests: XCTestCase {
    func testConcurrentWatchdogAndWorkCompletionAcknowledgeExactlyOnce() {
        let completions = CompletionCount()
        let claims = CompletionCount()
        let gate = WatchObserverCompletionGate { completions.increment() }
        DispatchQueue.concurrentPerform(iterations: 50) { _ in
            if gate.complete() { claims.increment() }
        }
        XCTAssertEqual(completions.value, 1)
        XCTAssertEqual(claims.value, 1)
        XCTAssertFalse(gate.complete())
    }
}
