import Foundation
import XCTest
@testable import NeoGymKit

final class NutritionLogDateSelectionTests: XCTestCase {
    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/Los_Angeles")!
        return calendar
    }

    private func instant(_ value: String) -> Date {
        ISO8601DateFormatter().date(from: value)!
    }

    func testExplicitTodayRequestReanchorsBrowsedDateAndIsRepeatable() {
        let now = instant("2026-06-28T18:00:00Z")
        var selection = NutritionLogDateSelection(now: now, calendar: calendar)
        selection.select("2026-06-20")

        selection.showToday(now: now, calendar: calendar)
        XCTAssertEqual(selection.date, "2026-06-28")
        selection.select("2026-06-27")
        selection.showToday(now: now, calendar: calendar)
        XCTAssertEqual(selection.date, "2026-06-28")

        selection.refreshToday(now: instant("2026-06-29T18:00:00Z"), calendar: calendar)
        XCTAssertEqual(selection.date, "2026-06-29")
    }

    func testForegroundAfterMultipleDaysMovesOnlyThePreviouslyCurrentDay() {
        let before = instant("2026-06-28T06:59:00Z") // Still June 27 locally.
        let after = instant("2026-07-01T07:01:00Z")
        var selection = NutritionLogDateSelection(now: before, calendar: calendar)
        XCTAssertEqual(selection.date, "2026-06-27")

        selection.refreshToday(now: after, calendar: calendar)
        XCTAssertEqual(selection.date, "2026-07-01")
        let refreshed = selection
        selection.refreshToday(now: after, calendar: calendar)
        XCTAssertEqual(selection, refreshed)
    }

    func testBrowsedDatesSurviveRepeatedRolloversUntilTodayIsSelected() {
        let now = instant("2026-06-28T18:00:00Z")
        let nextDay = instant("2026-06-29T18:00:00Z")
        for browsedDate in ["2026-06-27", "2026-07-10"] {
            var selection = NutritionLogDateSelection(now: now, calendar: calendar)
            selection.select(browsedDate)
            selection.refreshToday(now: nextDay, calendar: calendar)
            selection.refreshToday(now: instant("2026-06-30T18:00:00Z"), calendar: calendar)
            XCTAssertEqual(selection.date, browsedDate)
            XCTAssertEqual(selection.today, "2026-06-30")

            selection.select(selection.today)
            selection.refreshToday(now: instant("2026-07-01T18:00:00Z"), calendar: calendar)
            XCTAssertEqual(selection.date, "2026-07-01")
        }
    }

    func testRolloverUsesLocalCalendarAcrossShortDSTDay() {
        var selection = NutritionLogDateSelection(now: instant("2026-03-08T08:01:00Z"), calendar: calendar)
        XCTAssertEqual(selection.date, "2026-03-08")
        selection.refreshToday(now: instant("2026-03-09T07:01:00Z"), calendar: calendar)
        XCTAssertEqual(selection.date, "2026-03-09") // Only 23 hours later.
    }

    func testTimeZoneChangeCanMoveTodayBackwardsWithoutMovingHistoricalSelection() {
        let now = instant("2026-06-28T06:00:00Z")
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(secondsFromGMT: 0)!
        var followingToday = NutritionLogDateSelection(now: now, calendar: utc)
        var browsingHistory = followingToday
        browsingHistory.select("2026-06-20")

        followingToday.refreshToday(now: now, calendar: calendar)
        browsingHistory.refreshToday(now: now, calendar: calendar)
        XCTAssertEqual(followingToday.date, "2026-06-27")
        XCTAssertEqual(browsingHistory.date, "2026-06-20")
        XCTAssertEqual(browsingHistory.today, "2026-06-27")
    }

    @MainActor
    func testReanchoredDayModelCreatesAndLogsToTodayInsteadOfLoadedHistoricalDay() async throws {
        let now = instant("2026-06-28T18:00:00Z")
        var selection = NutritionLogDateSelection(now: now, calendar: calendar)
        selection.select("2026-06-20")
        let oldPayload = payload(dayId: "historical-day", date: selection.date)
        let currentPayload = payload(dayId: "current-day", date: "2026-06-28")
        let fake = FakeGraphQLService(replies: [
            .json(oldPayload), .json(payload()),
            .json(.object(["insertNutritionDay": .object(["id": .string("current-day")])])),
            .json(currentPayload),
            .json(.object(["insertNutritionLogEntry": .object(["id": .string("new-entry")])])),
            .json(currentPayload)
        ])
        let repository = NutritionFoodMealRepository(graphQL: fake)
        let historical = DailyIntakeViewModel(date: selection.date, repository: repository)
        await historical.load()
        XCTAssertEqual(historical.day?.id, "historical-day")

        selection.showToday(now: now, calendar: calendar)
        // The app keys DailyIntakeView by this date, replacing its StateObject.
        let current = DailyIntakeViewModel(date: selection.date, repository: repository)
        XCTAssertNil(current.day)
        await current.load()
        let didLog = await current.logFood(foodId: "food-1", grams: "100", slotTime: "08:00")
        XCTAssertTrue(didLog)
        XCTAssertEqual(current.day?.logDate, "2026-06-28")

        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.map(\.operationName), [
            "DailyIntakeLog", "DailyIntakeLog", "CreateNutritionDay", "DailyIntakeLog", "LogFood", "DailyIntakeLog"
        ])
        XCTAssertEqual(requests[0].variables?["date"], .string("2026-06-20"))
        XCTAssertEqual(requests[2].variables?["object"]?["logDate"], .string("2026-06-28"))
        XCTAssertEqual(requests[4].variables?["object"]?["nutritionDayId"], .string("current-day"))
        for index in [1, 3, 5] {
            XCTAssertEqual(requests[index].variables?["date"], .string("2026-06-28"))
            XCTAssertEqual(requests[index].variables?["since"], .string("2026-06-21"))
        }
    }

    private func payload(dayId: String? = nil, date: String = "2026-06-28") -> JSONValue {
        let days: [JSONValue] = dayId.map { id in
            [.object([
                "id": .string(id), "logDate": .string(date), "nutritionPlanId": .null,
                "nutritionPlan": .null, "nutritionLogMeals": .array([]), "nutritionLogEntries": .array([])
            ])]
        } ?? []
        return .object([
            "nutritionDays": .array(days), "nutritionPlans": .array([]),
            "meals": .array([]), "foods": .array([]), "dailyEnergyEntries": .array([])
        ])
    }
}
