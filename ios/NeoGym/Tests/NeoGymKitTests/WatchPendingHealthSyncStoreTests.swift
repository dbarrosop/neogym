import Foundation
import XCTest
@testable import NeoGymKit

final class WatchPendingHealthSyncStoreTests: XCTestCase {
    func testPersistsAcrossStoreInstancesAndMeasuresWallClockAge() throws {
        let suite = "WatchPendingHealthSyncStoreTests.\(UUID().uuidString)"
        defer { UserDefaults(suiteName: suite)?.removePersistentDomain(forName: suite) }
        let store = WatchPendingHealthSyncStore(suite: suite)
        let first = Date(timeIntervalSince1970: 1_000)
        XCTAssertTrue(store.markPending(for: "owner", at: first))
        let restored = WatchPendingHealthSyncStore(suite: suite)
        let pending = try XCTUnwrap(restored.pending(for: "owner"))
        XCTAssertEqual(pending.firstObservedAt, first)
        XCTAssertNil(restored.pending(for: "different owner"))
        XCTAssertEqual(Int(Date(timeIntervalSince1970: 4_300).timeIntervalSince(pending.firstObservedAt)), 3_300)
    }

    func testNewDeliveryIsNotClearedByAnOlderInFlightSync() throws {
        let suite = "WatchPendingHealthSyncStoreTests.\(UUID().uuidString)"
        defer { UserDefaults(suiteName: suite)?.removePersistentDomain(forName: suite) }
        let store = WatchPendingHealthSyncStore(suite: suite)
        XCTAssertTrue(store.markPending(for: "owner", at: Date(timeIntervalSince1970: 1)))
        let inFlight = try XCTUnwrap(store.pending(for: "owner"))
        XCTAssertTrue(store.markPending(for: "owner", at: Date(timeIntervalSince1970: 2)))
        let newer = try XCTUnwrap(store.pending(for: "owner"))
        XCTAssertEqual(newer.firstObservedAt, inFlight.firstObservedAt)
        XCTAssertNotEqual(newer.generation, inFlight.generation)
        XCTAssertFalse(store.clearIfUnchanged(inFlight))
        XCTAssertEqual(store.pending(for: "owner"), newer)
        XCTAssertTrue(store.clearIfUnchanged(newer))
        XCTAssertNil(store.pending(for: "owner"))
    }

    func testDifferentOwnerCannotInheritPreviousOwnersPendingImport() {
        let suite = "WatchPendingHealthSyncStoreTests.\(UUID().uuidString)"
        defer { UserDefaults(suiteName: suite)?.removePersistentDomain(forName: suite) }
        let store = WatchPendingHealthSyncStore(suite: suite)
        XCTAssertFalse(store.markPending(for: ""))
        XCTAssertTrue(store.markPending(for: "old"))
        store.clearIfDifferentOwner("new")
        XCTAssertNil(store.pending(for: "old"))
        XCTAssertTrue(store.markPending(for: "new"))
        store.clearIfDifferentOwner("new")
        XCTAssertNotNil(store.pending(for: "new"))
        store.clear()
        XCTAssertNil(store.pending(for: "new"))
    }
}
