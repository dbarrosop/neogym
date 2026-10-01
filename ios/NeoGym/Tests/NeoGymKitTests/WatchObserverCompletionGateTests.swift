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
    func testConcurrentCallersAcknowledgeExactlyOnce() {
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

    func testStoppedRegistrationCannotRestoreAnOldOwnersPendingMarker() {
        let suite = "WatchObserverRegistrationTests.\(UUID().uuidString)"
        defer { UserDefaults(suiteName: suite)?.removePersistentDomain(forName: suite) }
        let store = WatchPendingHealthSyncStore(suite: suite)
        let registration = WatchObserverRegistrationGate()
        XCTAssertTrue(registration.runIfActive { XCTAssertTrue(store.markPending(for: "old")) })
        registration.invalidate()
        store.clearIfDifferentOwner("new")
        XCTAssertFalse(registration.runIfActive { _ = store.markPending(for: "old") })
        XCTAssertNil(store.pending(for: "old"))
        XCTAssertTrue(store.markPending(for: "new"))
        XCTAssertNotNil(store.pending(for: "new"))
    }
}
