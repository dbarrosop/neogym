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

    func testDetailedHealthKitFailureExportsAsAFileWithoutRawErrorText() throws {
        let raw = NSError(domain: "HKErrorDomain", code: 3, userInfo: [
            NSLocalizedDescriptionKey: "token=secret user@example.test URL=https://private.example.test"
        ])
        let failure = WatchHealthSyncFailure(stage: .activeHealthQuery, cause: raw)
        XCTAssertEqual(failure.underlyingCode, 3)
        XCTAssertEqual(failure.underlyingDomain, "HKErrorDomain")
        let event = WatchEvent(action: .healthSync, outcome: .failed,
                               trigger: .healthObserver, errorCode: failure.underlyingCode,
                               errorSource: .healthKit, stage: failure.stage,
                               occurredAt: Date(timeIntervalSince1970: 0))
        let suite = "WatchEventLogTests.\(UUID().uuidString)"
        let store = WatchEventStore(suite: suite)
        store.record(event)
        let restored = try XCTUnwrap(store.load().first)
        XCTAssertEqual(restored.failureDetails,
                       "Active energy HealthKit query · HealthKit · code 3 · Invalid HealthKit argument")
        let backendCodeThree = WatchEvent(action: .healthSync, outcome: .failed,
                                          errorCode: 3, errorSource: .backend, stage: .backendRead)
        XCTAssertEqual(backendCodeThree.failureDetails, "Backend read · Backend · code 3")

        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory); store.clear() }
        let url = try WatchEventExport.write(events: store.load(), to: directory,
                                             generatedAt: Date(timeIntervalSince1970: 0))
        let contents = try String(contentsOf: url, encoding: .utf8)
        XCTAssertEqual(url.pathExtension, "txt")
        XCTAssertTrue(contents.contains("Active energy HealthKit query · HealthKit · code 3"))
        XCTAssertTrue(contents.contains("Health event"))
        XCTAssertFalse(contents.contains("secret"))
        XCTAssertFalse(contents.contains("user@example.test"))
        XCTAssertFalse(contents.contains("https://private.example.test"))
    }

    func testOldNumericOnlyEventsStillDecode() throws {
        let legacy = Data(#"{"id":"00000000-0000-0000-0000-000000000001","occurredAt":0,"action":"healthSync","outcome":"failed","trigger":"healthObserver","errorCode":3}"#.utf8)
        let event = try JSONDecoder().decode(WatchEvent.self, from: legacy)
        XCTAssertNil(event.errorSource)
        XCTAssertNil(event.stage)
        XCTAssertEqual(event.failureDetails, "code 3")
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
