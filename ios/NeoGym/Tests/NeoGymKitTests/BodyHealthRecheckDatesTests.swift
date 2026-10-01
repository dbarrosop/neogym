import Foundation
import XCTest
@testable import NeoGymKit

final class BodyHealthRecheckDatesTests: XCTestCase {
    func testDeletionOnlyRechecksRecentLocalDaysIncludingDSTBoundary() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/Los_Angeles"))
        let now = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-03-09T18:00:00Z"))

        let dates = BodyHealthRecheckDates.make(
            addedDates: [], hasDeletions: true, hasExistingAnchor: true,
            recentDays: 3, now: now, calendar: calendar
        )

        XCTAssertEqual(dates, ["2026-03-07", "2026-03-08", "2026-03-09"])
    }

    func testAddedDatesUnionWithDeletionWindowButInitialScanNeedsNoExtraQueries() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(secondsFromGMT: 0))
        let now = try XCTUnwrap(DateOnly.parse("2026-07-09", calendar: calendar))
        let addedDates: Set<String> = ["2026-07-08", "2026-06-01"]

        let combined = BodyHealthRecheckDates.make(
            addedDates: addedDates, hasDeletions: true, hasExistingAnchor: true,
            recentDays: 3, now: now, calendar: calendar
        )
        XCTAssertEqual(combined, ["2026-06-01", "2026-07-07", "2026-07-08", "2026-07-09"])
        XCTAssertEqual(BodyHealthRecheckDates.make(
            addedDates: addedDates, hasDeletions: true, hasExistingAnchor: false,
            recentDays: 3, now: now, calendar: calendar
        ), addedDates)
        XCTAssertEqual(BodyHealthRecheckDates.make(
            addedDates: addedDates, hasDeletions: false, hasExistingAnchor: true,
            recentDays: 3, now: now, calendar: calendar
        ), addedDates)
    }
}
