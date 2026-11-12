import Nhost
import XCTest
@testable import NeoGymKit

final class EnergyBalanceWidgetTimelineTests: XCTestCase {
    func testLateNightLiveTimelineExpiresEstimatesWithoutAnotherFetch() async throws {
        try await assertLateNightTimelines(live: true)
    }

    func testLateNightCachedTimelineExpiresEstimatesWithoutAnotherFetch() async throws {
        try await assertLateNightTimelines(live: false)
    }

    func testDSTDaysScheduleTheNextLocalMidnightNotTwentyFourHoursLater() async throws {
        let calendar = Self.calendar
        for (day, nextDay, hours) in [("2026-03-08", "2026-03-09", 23), ("2026-11-01", "2026-11-02", 25)] {
            let start = try XCTUnwrap(DateOnly.parse(day, calendar: calendar))
            let midnight = try XCTUnwrap(DateOnly.parse(nextDay, calendar: calendar))
            for live in [true, false] {
                let timeline = await Self.orchestrator(date: start, live: live).timeline(
                    date: start, calendar: calendar, locale: Self.locale
                )
                let expiry = try XCTUnwrap(timeline.entries.last)

                XCTAssertEqual(timeline.entries.count, 2)
                XCTAssertEqual(expiry.date, midnight)
                XCTAssertEqual(expiry.date.timeIntervalSince(start), Double(hours * 60 * 60))
                XCTAssertNotNil(timeline.entries.first?.estimatedBurnedValue)
                XCTAssertNil(expiry.estimatedBurnedValue)
                XCTAssertNil(expiry.estimatedNetValue)
                XCTAssertEqual(expiry.snapshot, timeline.entries.first?.snapshot)
            }
        }
    }

    func testNewTimelineWithYesterdaysCacheRetainsRecordedFallbackWithoutEstimates() async throws {
        let yesterday = try Self.date("2026-11-11", hour: 23, minute: 55)
        let today = try Self.date("2026-11-12", hour: 0, minute: 5)
        let cached = Self.snapshot(date: yesterday)
        let timeline = await Self.orchestrator(date: yesterday, live: false).timeline(
            date: today, calendar: Self.calendar, locale: Self.locale
        )
        let entry = try XCTUnwrap(timeline.entries.first)

        XCTAssertEqual(timeline.refreshDecision, .cachedFallback)
        XCTAssertEqual(timeline.entries.count, 1)
        XCTAssertEqual(entry.snapshot, cached)
        XCTAssertNotNil(cached.estimatedBurnedValue)
        XCTAssertNotNil(cached.estimatedNetValue)
        XCTAssertNil(entry.estimatedBurnedValue)
        XCTAssertNil(entry.estimatedNetValue)
    }

    func testNewDayLiveReadRequiresThatDaysEnergyToShowEstimates() async throws {
        let yesterday = try Self.date("2026-11-11", hour: 23, minute: 55)
        let today = try Self.date("2026-11-12", hour: 0, minute: 5)
        // The backend still has only yesterday's energy, even though the live read succeeds.
        let timeline = await Self.orchestrator(date: yesterday, live: true).timeline(
            date: today, calendar: Self.calendar, locale: Self.locale
        )
        let entry = try XCTUnwrap(timeline.entries.first)

        XCTAssertEqual(timeline.refreshDecision, .liveSnapshot)
        XCTAssertEqual(entry.snapshot?.localDate, "2026-11-12")
        XCTAssertEqual(entry.snapshot?.burnedValue, "No energy")
        XCTAssertEqual(timeline.entries.count, 1)
        XCTAssertNil(entry.estimatedBurnedValue)
        XCTAssertNil(entry.estimatedNetValue)
    }

    func testLegacyCachedSnapshotWithoutEstimateFieldsStillRendersRecordedValues() async throws {
        let now = try Self.date("2026-11-11", hour: 23, minute: 55)
        let snapshot = Self.snapshot(date: now)
        let data = try JSONEncoder().encode(snapshot)
        var object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        object.removeValue(forKey: "estimatedBurnedValue")
        object.removeValue(forKey: "estimatedNetValue")
        let legacy = try JSONDecoder().decode(
            EnergyBalanceWidgetSnapshot.self, from: JSONSerialization.data(withJSONObject: object)
        )
        let orchestrator = EnergyBalanceWidgetLiveRefreshOrchestrator(
            cachedSnapshotProvider: { legacy },
            liveRefreshClientFactory: { throw EnergyBalanceWidgetLiveRefreshError.noSession },
            snapshotWriter: { _ in XCTFail("A fallback must not write a live snapshot") }
        )

        let timeline = await orchestrator.timeline(date: now, calendar: Self.calendar)
        let entry = try XCTUnwrap(timeline.entries.first)

        XCTAssertEqual(timeline.refreshDecision, .cachedFallback)
        XCTAssertEqual(timeline.entries.count, 1)
        XCTAssertEqual(entry.snapshot?.burnedValue, snapshot.burnedValue)
        XCTAssertEqual(entry.snapshot?.netValue, snapshot.netValue)
        XCTAssertNil(entry.estimatedBurnedValue)
        XCTAssertNil(entry.estimatedNetValue)
    }

    func testEmptyTimelineRetainsShorterRetryAndNoSnapshot() async throws {
        let now = try Self.date("2026-11-11", hour: 23, minute: 55)
        let orchestrator = EnergyBalanceWidgetLiveRefreshOrchestrator(
            cachedSnapshotProvider: { nil },
            liveRefreshClientFactory: { throw EnergyBalanceWidgetLiveRefreshError.noSession },
            snapshotWriter: { _ in XCTFail("A fallback must not write a live snapshot") }
        )

        let timeline = await orchestrator.timeline(date: now, calendar: Self.calendar)

        XCTAssertEqual(timeline.refreshDecision, .emptyState)
        XCTAssertEqual(timeline.reloadAfter, now.addingTimeInterval(15 * 60))
        XCTAssertEqual(timeline.entries.count, 1)
        XCTAssertNil(timeline.entries.first?.snapshot)
    }

    private func assertLateNightTimelines(live: Bool) async throws {
        for (day, nextDay) in [
            ("2026-11-11", "2026-11-12"),
            ("2026-03-08", "2026-03-09"),
            ("2026-11-01", "2026-11-02")
        ] {
            let now = try Self.date(day, hour: 23, minute: 55)
            let midnight = try XCTUnwrap(DateOnly.parse(nextDay, calendar: Self.calendar))
            let timeline = await Self.orchestrator(date: now, live: live).timeline(
                date: now, calendar: Self.calendar, locale: Self.locale
            )
            let first = try XCTUnwrap(timeline.entries.first)
            let expiry = try XCTUnwrap(timeline.entries.last)

            XCTAssertEqual(timeline.refreshDecision, live ? .liveSnapshot : .cachedFallback)
            XCTAssertEqual(timeline.reloadAfter, now.addingTimeInterval(30 * 60))
            XCTAssertEqual(timeline.entries.count, 2)
            XCTAssertEqual(first.date, now)
            XCTAssertEqual(first.snapshot?.localDate, day)
            XCTAssertEqual(first.estimatedBurnedValue, "≈2100 kcal")
            XCTAssertEqual(first.estimatedNetValue, "≈−2100 kcal")
            XCTAssertEqual(expiry.date, midnight)
            XCTAssertNil(expiry.estimatedBurnedValue)
            XCTAssertNil(expiry.estimatedNetValue)
            XCTAssertEqual(expiry.snapshot, first.snapshot)
            XCTAssertEqual(expiry.snapshot?.burnedValue, "900 kcal")
            XCTAssertEqual(expiry.snapshot?.netValue, "−900 kcal")
            XCTAssertEqual(expiry.snapshot?.sevenDayValue, first.snapshot?.sevenDayValue)
            XCTAssertEqual(expiry.snapshot?.lastSyncedText, first.snapshot?.lastSyncedText)
        }
    }

    private static var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/New_York")!
        return calendar
    }

    private static let locale = Locale(identifier: "en_US_POSIX")

    private static func date(_ day: String, hour: Int, minute: Int) throws -> Date {
        let start = try XCTUnwrap(DateOnly.parse(day, calendar: calendar))
        return try XCTUnwrap(calendar.date(bySettingHour: hour, minute: minute, second: 0, of: start))
    }

    private static func payload(date: Date) -> NutritionOverviewPayload {
        let day = DateOnly.formatLocalISO(date, calendar: calendar)
        let yesterday = IntakeGrouping.addLocalDateDays(day, days: -1, calendar: calendar)
        return NutritionOverviewPayload(days: [], dailyEnergyEntries: [
            DailyEnergy(id: "today", energyOn: day, activeKcal: 300, restingKcal: 600),
            DailyEnergy(id: "yesterday", energyOn: yesterday, restingKcal: 1_800)
        ])
    }

    private static func snapshot(date: Date) -> EnergyBalanceWidgetSnapshot {
        EnergyBalanceWidgetSnapshot(
            summary: EnergyBalanceOverviewSummary(
                payload: payload(date: date), todayDate: date, calendar: calendar, locale: locale
            ),
            userMarker: "widget-test-user", generatedAt: date, locale: locale
        )
    }

    private static func orchestrator(date: Date, live: Bool) -> EnergyBalanceWidgetLiveRefreshOrchestrator {
        let cached = snapshot(date: date)
        let payload = payload(date: date)
        return EnergyBalanceWidgetLiveRefreshOrchestrator(
            cachedSnapshotProvider: { cached },
            liveRefreshClientFactory: {
                guard live else { throw EnergyBalanceWidgetLiveRefreshError.noSession }
                return EnergyBalanceWidgetLiveRefreshClient(
                    sessionProvider: { try Self.session() },
                    overviewProvider: { payload }
                )
            },
            snapshotWriter: { _ in XCTAssertTrue(live, "A fallback must not write a live snapshot") }
        )
    }

    private static func session() throws -> StoredSession {
        try StoredSession(
            accessToken: "test.header.signature",
            accessTokenExpiresIn: 900,
            refreshTokenId: "test-refresh-id",
            refreshToken: "test-refresh",
            user: nil,
            decodedToken: DecodedToken(claims: [:])
        )
    }
}
