import Foundation
import XCTest
@testable import NeoGymKit

final class WatchWidgetProviderReceiptTests: XCTestCase {
    private let start = Date(timeIntervalSince1970: 1_800_000_000)

    func testProviderReceiptsPersistAcrossStoreInstancesWithoutPrivateValues() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let writer = WatchWidgetProviderReceiptStore(directory: directory)
        XCTAssertTrue(writer.isAvailable)
        let first = WatchWidgetProviderReceipt(
            requestedAt: start, request: .timeline, localDate: "2026-09-30", snapshotUpdatedAt: nil
        )
        XCTAssertTrue(writer.append(first))
        let reader = WatchWidgetProviderReceiptStore(directory: directory)
        XCTAssertEqual(reader.load(), [first])
        for index in 1...80 {
            XCTAssertTrue(writer.append(.init(
                requestedAt: start.addingTimeInterval(Double(index)), request: .snapshot,
                localDate: "2026-09-30", snapshotUpdatedAt: start
            )))
        }
        let receipts = reader.load()
        XCTAssertEqual(receipts.count, WatchWidgetProviderReceiptStore.capacity)
        XCTAssertEqual(receipts.last?.request, .snapshot)
        XCTAssertEqual(receipts.last?.snapshotUpdatedAt, start)
        let file = try XCTUnwrap(FileManager.default.contentsOfDirectory(at: directory,
                                                                          includingPropertiesForKeys: nil).first)
        let serialized = try String(contentsOf: file, encoding: .utf8)
        XCTAssertFalse(serialized.contains("userID"))
        XCTAssertFalse(serialized.contains("kcal"))
        XCTAssertFalse(serialized.contains("Authorization"))
    }

    func testBackgroundReloadGateCoalescesBurstsButForegroundOrUrgentBypasses() {
        var gate = WatchWidgetReloadGate()
        XCTAssertTrue(gate.shouldRequest(at: start, foregroundOrUrgent: false))
        XCTAssertFalse(gate.shouldRequest(at: start.addingTimeInterval(60), foregroundOrUrgent: false))
        XCTAssertEqual(gate.lastRequestedAt, start)
        XCTAssertTrue(gate.shouldRequest(at: start.addingTimeInterval(900), foregroundOrUrgent: false))
        XCTAssertFalse(gate.shouldRequest(at: start.addingTimeInterval(910), foregroundOrUrgent: false))
        XCTAssertTrue(gate.shouldRequest(at: start.addingTimeInterval(911), foregroundOrUrgent: true))
        XCTAssertFalse(gate.shouldRequest(at: start.addingTimeInterval(912), foregroundOrUrgent: false))
        // A wall-clock correction must not suppress every future request.
        XCTAssertTrue(gate.shouldRequest(at: start.addingTimeInterval(-30), foregroundOrUrgent: false))
        var resumed = WatchWidgetReloadGate(lastRequestedAt: gate.lastRequestedAt)
        XCTAssertTrue(resumed.shouldRequest(at: start, foregroundOrUrgent: true))
    }

    func testExportIncludesProviderTimelineAndStillWritesTextFile() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let receipt = WatchWidgetProviderReceipt(
            requestedAt: start, request: .timeline, localDate: "2026-09-30",
            snapshotUpdatedAt: start.addingTimeInterval(-120)
        )
        let url = try WatchEventExport.write(events: [], widgetReceipts: [receipt],
                                             to: directory, generatedAt: start)
        XCTAssertEqual(url.pathExtension, "txt")
        let text = try String(contentsOf: url, encoding: .utf8)
        XCTAssertTrue(text.contains("Widget provider receipts: 1"))
        XCTAssertTrue(text.contains("Widget timeline"))
        XCTAssertTrue(text.contains("snapshot 2027"))
        XCTAssertFalse(text.contains("Bearer"))
    }
}
