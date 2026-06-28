import Foundation
import XCTest
@testable import NeoGymKit

final class DateOnlyTests: XCTestCase {
    func testParsesValidDateIntoLocalComponents() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/Los_Angeles")!

        let date = try XCTUnwrap(DateOnly.parse("2025-09-04", calendar: calendar))
        let components = calendar.dateComponents([.year, .month, .day], from: date)

        XCTAssertEqual(components.year, 2025)
        XCTAssertEqual(components.month, 9)
        XCTAssertEqual(components.day, 4)
    }

    func testParseRejectsEmptyAndNonDateStrings() {
        XCTAssertNil(DateOnly.parse(""))
        XCTAssertNil(DateOnly.parse("not-a-date"))
        XCTAssertNil(DateOnly.parse("2025/09/04"))
        XCTAssertNil(DateOnly.parse("hello"))
    }

    func testParseRejectsMissingZeroOrNonNumericComponents() {
        XCTAssertNil(DateOnly.parse("2025-09"))
        XCTAssertNil(DateOnly.parse("2025"))
        XCTAssertNil(DateOnly.parse("0000-09-04"))
        XCTAssertNil(DateOnly.parse("2025-00-04"))
        XCTAssertNil(DateOnly.parse("2025-09-00"))
        XCTAssertNil(DateOnly.parse("2025-09-04T00:00:00"))
        XCTAssertNil(DateOnly.parse("abcd-ef-gh"))
    }

    func testFormattersReturnInputWhenParsingFails() {
        XCTAssertEqual(DateOnly.formatLong("not-a-date"), "not-a-date")
        XCTAssertEqual(DateOnly.formatLong(""), "")
        XCTAssertEqual(DateOnly.formatShort("not-a-date"), "not-a-date")
        XCTAssertEqual(DateOnly.formatShort(""), "")
    }

    func testFormattersProduceLocalizedOutputForValidDate() {
        let locale = Locale(identifier: "en_US_POSIX")
        let long = DateOnly.formatLong("2025-09-04", locale: locale)
        let short = DateOnly.formatShort("2025-09-04", locale: locale)

        XCTAssertFalse(long.isEmpty)
        XCTAssertTrue(long.contains("2025"))
        XCTAssertFalse(short.isEmpty)
    }

    func testTodayLocalISOUsesInjectedCalendarWithoutUTCShift() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/Los_Angeles")!
        let date = Date(timeIntervalSince1970: 1_700_000_000)

        XCTAssertEqual(DateOnly.todayLocalISO(calendar: calendar, now: date), "2023-11-14")
    }
}
