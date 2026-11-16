import Foundation
@testable import NeoGymKit
import XCTest

final class DemoCaptureClockTests: XCTestCase {
    override func tearDown() {
        AppClock.useDemoCapture(nil)
        super.tearDown()
    }

    private func profile() throws -> DemoCaptureProfile {
        try XCTUnwrap(DemoCaptureProfile.requested(environment: ["NEOGYM_DEMO_CAPTURE": "1"]))
    }

    func testCaptureRequiresExplicitOptIn() throws {
        XCTAssertNil(try DemoCaptureProfile.requested(environment: [:]))
        XCTAssertNil(try DemoCaptureProfile.requested(environment: ["NEOGYM_DEMO_CAPTURE": "0"]))
        let capture = try profile()
        XCTAssertEqual(capture.version, 1)
        XCTAssertEqual(ISO8601DateFormatter().string(from: capture.now), "2025-01-15T09:41:00Z")
        XCTAssertEqual(capture.timeZone.secondsFromGMT(), 0)
        XCTAssertEqual(capture.locale.identifier, "en_US")
    }

    func testUnknownOrMalformedProfilesAreRejected() throws {
        for fields in [
            ["version": 2, "now": "2025-01-15T09:41:00Z", "timeZone": "UTC", "locale": "en_US"],
            ["version": 1, "now": "invalid", "timeZone": "UTC", "locale": "en_US"],
            ["version": 1, "now": "2025-01-15T09:41:00Z", "timeZone": "invalid", "locale": "en_US"]
        ] as [[String: Any]] {
            XCTAssertThrowsError(try DemoCaptureProfile(data: JSONSerialization.data(withJSONObject: fields)))
        }
    }

    func testDomainDatesFormsRangesAndTimersUseFixedTimeOnlyWhileActive() throws {
        let capture = try profile()
        AppClock.useDemoCapture(capture)
        XCTAssertEqual(AppClock.now(), capture.now)
        XCTAssertEqual(AppClock.resolve(Date.distantFuture), capture.now)
        XCTAssertEqual(DateOnly.todayLocalISO(), "2025-01-15")
        XCTAssertEqual(IntakeGrouping.currentTimeInputValue(), "09:41")
        XCTAssertEqual(NutritionLogDateSelection().date, "2025-01-15")
        XCTAssertEqual(ChartHistoryRange.recentDays(30).through, "2025-01-15")
        XCTAssertEqual(RestTimerSchedule.start(seconds: 90).remainingSeconds(), 90)
        let range = TodayTrainingWindow()
        XCTAssertEqual(range.dayStart, capture.calendar.startOfDay(for: capture.now))
        // Clearing at Exit restores the real clock, not another fixed reference.
        AppClock.useDemoCapture(nil)
        let before = Date()
        let current = AppClock.now()
        XCTAssertGreaterThanOrEqual(current, before)
        XCTAssertLessThanOrEqual(current, Date())
        XCTAssertEqual(AppClock.resolve(Date.distantFuture), Date.distantFuture)
    }

    func testCaptureFixtureAndCreatedIdsRepeatAndSurvivePersistence() throws {
        let capture = try profile()
        AppClock.useDemoCapture(capture)
        var first = DemoSeed.make(now: AppClock.now(), calendar: AppClock.calendar)
        var second = DemoSeed.make(now: AppClock.now(), calendar: AppClock.calendar)
        XCTAssertEqual(first.preparedThrough, "2025-01-15")
        XCTAssertEqual(first.tables, second.tables)
        let firstId = first.insert(.journal, ["title": .string("Capture")])
        XCTAssertEqual(firstId, second.insert(.journal, ["title": .string("Capture")]))
        first.remove(.journal, firstId)
        let nextId = first.insert(.journal, [:])
        XCTAssertNotEqual(firstId, nextId)
        var restored = try JSONDecoder().decode(DemoState.self, from: JSONEncoder().encode(first))
        XCTAssertNotEqual(restored.insert(.journal, [:]), nextId)
        XCTAssertEqual(restored.captureSequence, 3)
    }

    func testLegacyStateAndOrdinaryDemoStillUseUniqueIds() throws {
        let data = Data(#"{"version":1,"preparedThrough":"2025-01-15","tables":{}}"#.utf8)
        var legacy = try JSONDecoder().decode(DemoState.self, from: data)
        XCTAssertNil(legacy.captureSequence)
        AppClock.useDemoCapture(nil)
        let first = legacy.insert(.journal, [:])
        let second = legacy.insert(.journal, [:])
        XCTAssertNotEqual(first, second)
        XCTAssertNotNil(UUID(uuidString: first))
        XCTAssertNil(legacy.captureSequence)
    }
}
