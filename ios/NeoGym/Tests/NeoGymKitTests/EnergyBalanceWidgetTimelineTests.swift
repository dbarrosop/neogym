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
                XCTAssertNotNil(timeline.entries.first?.display?.endOfDayBurned)
                XCTAssertNil(expiry.display?.endOfDayBurned)
                XCTAssertNil(expiry.display?.endOfDayNet)
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
        XCTAssertNotNil(cached.estimatedBurnedKcal)
        XCTAssertNotNil(cached.estimatedNetKcal)
        XCTAssertNil(entry.display?.endOfDayBurned)
        XCTAssertNil(entry.display?.endOfDayNet)
        XCTAssertEqual(entry.display?.isCurrentDay, false)
        XCTAssertEqual(entry.display?.periodCaption, "Wednesday so far")
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
        XCTAssertNil(entry.snapshot?.burnedKcal)
        XCTAssertEqual(entry.display?.burned, "—")
        XCTAssertEqual(entry.display?.balance, "—")
        XCTAssertEqual(timeline.entries.count, 2, "Today's snapshot still schedules its midnight relabel")
        XCTAssertNil(entry.display?.endOfDayBurned)
        XCTAssertNil(entry.display?.endOfDayNet)
    }

    func testSnapshotWithoutEstimatesStillRendersRecordedValues() async throws {
        let now = try Self.date("2026-11-11", hour: 23, minute: 55)
        let snapshot = EnergyBalanceWidgetSnapshot(
            localDate: "2026-11-11", userMarker: "widget-test-user", generatedAt: now,
            consumedKcal: 0, burnedKcal: 900, activeKcal: 300, restingKcal: 600
        )
        let orchestrator = EnergyBalanceWidgetLiveRefreshOrchestrator(
            cachedSnapshotProvider: { snapshot },
            liveRefreshClientFactory: { throw EnergyBalanceWidgetLiveRefreshError.noSession },
            snapshotWriter: { _ in XCTFail("A fallback must not write a live snapshot") }
        )

        let timeline = await orchestrator.timeline(date: now, calendar: Self.calendar, locale: Self.locale)
        let entry = try XCTUnwrap(timeline.entries.first)

        XCTAssertEqual(timeline.refreshDecision, .cachedFallback)
        XCTAssertEqual(entry.display?.burned, "900")
        XCTAssertEqual(entry.display?.balance, "−900")
        XCTAssertNil(entry.display?.endOfDayBurned)
        XCTAssertNil(entry.display?.endOfDayNet)
    }

    func testPreRedesignStringSnapshotsAreNotDecodedAsCurrentSnapshots() throws {
        let legacy: [String: Any] = [
            "schemaVersion": 1, "localDate": "2026-11-11", "generatedAtISO8601": "2026-11-11T12:00:00Z",
            "consumedValue": "1,200 kcal", "burnedValue": "1,800 kcal", "netValue": "−600 kcal"
        ]
        let data = try JSONSerialization.data(withJSONObject: legacy)
        XCTAssertThrowsError(try JSONDecoder().decode(EnergyBalanceWidgetSnapshot.self, from: data))
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
            XCTAssertEqual(first.display?.endOfDayBurned, "≈ 2100")
            XCTAssertEqual(first.display?.endOfDayNet, "≈ −2100")
            XCTAssertEqual(first.display?.periodCaption, "today so far")
            XCTAssertEqual(expiry.date, midnight)
            XCTAssertNil(expiry.display?.endOfDayBurned)
            XCTAssertNil(expiry.display?.endOfDayNet)
            XCTAssertEqual(expiry.display?.isCurrentDay, false)
            XCTAssertEqual(expiry.snapshot, first.snapshot)
            XCTAssertEqual(expiry.display?.burned, "900")
            XCTAssertEqual(expiry.display?.balance, "−900")
            XCTAssertEqual(expiry.display?.sevenDayAverage, first.display?.sevenDayAverage)
            XCTAssertEqual(expiry.display?.updatedTime, first.display?.updatedTime)
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
            userMarker: "widget-test-user", generatedAt: date
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
