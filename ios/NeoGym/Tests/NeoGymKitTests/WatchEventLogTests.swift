import Foundation
import XCTest
@testable import NeoGymKit

final class WatchEventLogTests: XCTestCase {
    func testRecentEventsPersistNewestFirstAndStayBounded() {
        let suite = "WatchEventLogTests.\(UUID().uuidString)"
        let store = WatchEventStore(suite: suite, maximumCount: 3)
        for index in 0..<5 {
            _ = store.record(WatchEvent(
                action: .backgroundScheduling,
                outcome: index == 4 ? .failed : .accepted,
                errorCode: index == 4 ? 42 : nil,
                occurredAt: Date(timeIntervalSince1970: Double(index))
            ))
        }
        let events = WatchEventStore(suite: suite, maximumCount: 3).load()
        XCTAssertEqual(events.map(\.occurredAt), [4, 3, 2].map { Date(timeIntervalSince1970: Double($0)) })
        XCTAssertEqual(events.first?.outcome, .failed)
        XCTAssertEqual(events.first?.errorCode, 42)
        store.clear()
        XCTAssertTrue(WatchEventStore(suite: suite).load().isEmpty)
    }

    func testInvalidStorageIsIgnoredAndOnlyTypedEventsArePersisted() {
        let suite = "WatchEventLogTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)
        defaults?.set(Data("invalid".utf8), forKey: "watchEvents.v1")
        let store = WatchEventStore(suite: suite, maximumCount: 0)
        XCTAssertTrue(store.load().isEmpty)
        let event = WatchEvent(action: .energyRefresh, outcome: .succeeded, trigger: .background)
        XCTAssertEqual(store.record(event), [event])
        XCTAssertEqual(store.record(WatchEvent(action: .complicationReload, outcome: .requested)).count, 1)
        XCTAssertEqual(store.load().first?.action, .complicationReload)
        XCTAssertEqual(event.action.title, "Energy refresh")
        XCTAssertEqual(event.trigger?.title, "background")
        XCTAssertEqual(WatchEventOutcome.accepted.title, "Accepted by watchOS")
        store.clear()
    }
}
