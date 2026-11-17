import Foundation
import XCTest
@testable import NeoGymKit

final class WatchEndOfDayEstimateTests: XCTestCase {
    private let now = ISO8601DateFormatter().date(from: "2026-06-25T12:00:00Z")!
    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar
    }

    func testAbsentAndPriorDaySnapshotsDoNotBlameRestingHistory() throws {
        XCTAssertEqual(message(nil), "No numbers yet today.")
        XCTAssertEqual(message(try snapshot(localDate: "2026-06-24")), "No numbers yet today.")
    }

    func testCurrentDayUsesTheSuppliedLocalCalendar() throws {
        let snapshot = try snapshot()
        let midnightUTC = ISO8601DateFormatter().date(from: "2026-06-26T00:30:00Z")!
        var pacific = calendar
        pacific.timeZone = try XCTUnwrap(TimeZone(identifier: "America/Los_Angeles"))
        XCTAssertNil(WatchEndOfDayEstimate.unavailableMessage(snapshot: snapshot, at: midnightUTC, calendar: pacific))
        XCTAssertEqual(WatchEndOfDayEstimate.unavailableMessage(snapshot: snapshot, at: midnightUTC, calendar: calendar),
                       "No numbers yet today.")
    }

    func testNoEnergyTodayTakesPrecedenceEvenWithNoBaseline() throws {
        for hasBaseline in [true, false] {
            let snapshot = try snapshot(burned: nil, hasBaseline: hasBaseline)
            XCTAssertNil(snapshot.projection)
            XCTAssertEqual(message(snapshot), "Needs today's energy.")
        }
    }

    func testOnlyMissingHistoryWithTodaysEnergyAsksForRestingHistory() throws {
        let snapshot = try snapshot(hasBaseline: false)
        XCTAssertNil(snapshot.projection)
        XCTAssertEqual(message(snapshot), "Needs resting energy from recent days.")
    }

    func testAvailableAndProvisionalEstimatesHaveNoUnavailableMessage() throws {
        for pending in [true, false] {
            let snapshot = try snapshot(pending: pending)
            XCTAssertNotNil(snapshot.projection)
            XCTAssertNil(message(snapshot))
        }
    }

    func testZeroEnergyRowIsPresentNotMissing() throws {
        let snapshot = try snapshot(burned: 0, active: 0)
        XCTAssertNotNil(snapshot.projection)
        XCTAssertNil(message(snapshot))
    }

    func testInvalidProjectionDoesNotBlameAnExistingBaseline() throws {
        let snapshot = try snapshot(active: -1)
        XCTAssertNil(snapshot.projection)
        XCTAssertEqual(message(snapshot), "Estimate unavailable.")
    }

    func testPageUsesTheReasonModelWithItsDisplayClock() throws {
        let packageRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let source = try String(contentsOf: packageRoot.appendingPathComponent("Watch/WatchTodayPages.swift"), encoding: .utf8)
        XCTAssertTrue(source.contains("""
            WatchEndOfDayEstimate.unavailableMessage(
                                    snapshot: runtime.snapshot, at: runtime.displayDate
                                )
            """))
        XCTAssertFalse(source.contains("Text(\"Needs resting energy from recent days.\")"))
    }

    private func message(_ snapshot: WatchEnergySnapshot?) -> String? {
        WatchEndOfDayEstimate.unavailableMessage(snapshot: snapshot, at: now, calendar: calendar)
    }

    private func snapshot(
        localDate: String = "2026-06-25", burned: Double? = 100, active: Double = 100,
        hasBaseline: Bool = true, pending: Bool = false
    ) throws -> WatchEnergySnapshot {
        let baseline = try JSONDecoder().decode(
            DailyRestingEnergyBaseline.self, from: Data(#"{"kcal":1800,"dayCount":7}"#.utf8)
        )
        return WatchEnergySnapshot(
            userID: "fictional-user", localDate: localDate, consumedKcal: 500, burnedKcal: burned,
            activeKcal: active, updatedAt: now, pendingBackend: pending,
            restingBaseline: hasBaseline ? baseline : nil
        )
    }
}
