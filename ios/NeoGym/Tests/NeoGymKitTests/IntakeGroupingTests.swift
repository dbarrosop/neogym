import Foundation
import XCTest
@testable import NeoGymKit

final class IntakeGroupingTests: XCTestCase {
    func testGroupsLoggedIntakeByNormalizedTimeSlotsAndSourceMetadata() throws {
        let groupedChild = loggedEntry(
            id: "grouped-child",
            nutritionLogMealId: "logged-meal",
            slotTime: "23:30:00",
            snapshotFoodName: "Grouped child"
        )
        let standalone = loggedEntry(id: "standalone", slotTime: "10:15:00", snapshotFoodName: "Standalone food")

        let slots = IntakeGrouping.groupIntakeByTimeSlot(
            mealGroups: [
                loggedMeal(id: "logged-meal", name: "Breakfast", slotTime: "08:00:00", nutritionLogEntries: [groupedChild])
            ],
            standaloneEntries: [standalone],
            locale: Locale(identifier: "en_US_POSIX")
        )

        XCTAssertEqual(slots.map(\.key), ["08:00", "10:15"])
        XCTAssertEqual(slots[0].entries.map { $0.entry.id }, ["grouped-child"])
        XCTAssertEqual(slots[0].entries[0].mealId, "logged-meal")
        XCTAssertEqual(slots[0].entries[0].mealName, "Breakfast")
        XCTAssertEqual(slots[1].entries.map { $0.entry.id }, ["standalone"])
        XCTAssertNil(slots[1].entries[0].mealId)
        XCTAssertNil(slots[1].entries[0].mealName)
    }

    func testSortsNoTimeIntakeLastWhilePreservingChildlessLoggedMealGroups() {
        let slots = IntakeGrouping.groupIntakeByTimeSlot(
            mealGroups: [
                loggedMeal(id: "childless", name: "Empty meal", slotTime: nil),
                loggedMeal(id: "timed", name: "Timed meal", slotTime: "07:00:00")
            ],
            standaloneEntries: [loggedEntry(id: "timed-entry", slotTime: "12:00:00")],
            locale: Locale(identifier: "en_US_POSIX")
        )

        XCTAssertEqual(slots.map(\.key), ["07:00", "12:00", "no-time"])
        XCTAssertEqual(slots[2].label, "No time")
        XCTAssertEqual(
            slots[2].mealGroups,
            [
                IntakeSlotMealGroup(
                    id: "childless",
                    mealId: nil,
                    nutritionPlanMealId: nil,
                    name: "Empty meal",
                    slotTime: nil,
                    position: 0,
                    entryCount: 0
                )
            ]
        )
        XCTAssertTrue(slots[2].entries.isEmpty)
    }

    func testTotalsEachTimeSlotFromFlatLoggedSnapshotEntries() throws {
        let groupedChild = loggedEntry(
            id: "grouped-child",
            grams: .number(100),
            snapshotKcalPer100g: .number(80),
            snapshotFatPer100g: .number(1),
            snapshotCarbsPer100g: .number(2),
            snapshotProteinPer100g: .number(3),
            snapshotFiberPer100g: .number(4),
            snapshotSugarPer100g: .number(5)
        )
        let standalone = loggedEntry(
            id: "standalone",
            grams: .number(50),
            slotTime: "08:00:00",
            snapshotKcalPer100g: .number(120),
            snapshotFatPer100g: .number(2),
            snapshotCarbsPer100g: .number(4),
            snapshotProteinPer100g: .number(6),
            snapshotFiberPer100g: .number(8),
            snapshotSugarPer100g: .number(10)
        )

        let slot = try XCTUnwrap(
            IntakeGrouping.groupIntakeByTimeSlot(
                mealGroups: [loggedMeal(id: "meal", slotTime: "08:00:00", nutritionLogEntries: [groupedChild])],
                standaloneEntries: [standalone]
            ).first
        )

        XCTAssertEqual(slot.totals, NutritionMath.loggedMacroTotals([groupedChild.loggedSnapshot, standalone.loggedSnapshot]))
    }

    func testOrdersSlotEntriesDeterministicallyBySourceAndChildPositions() throws {
        let mealB = loggedMeal(
            id: "meal-b",
            slotTime: "09:00:00",
            position: 1,
            nutritionLogEntries: [loggedEntry(id: "meal-b-child-2", position: 2), loggedEntry(id: "meal-b-child-1", position: 1)]
        )
        let mealA = loggedMeal(
            id: "meal-a",
            slotTime: "09:00:00",
            position: 1,
            nutritionLogEntries: [loggedEntry(id: "meal-a-child", position: 1)]
        )
        let standalone = loggedEntry(id: "standalone", position: 1, slotTime: "09:00:00")

        let slot = try XCTUnwrap(IntakeGrouping.groupIntakeByTimeSlot(mealGroups: [mealB, mealA], standaloneEntries: [standalone]).first)

        XCTAssertEqual(slot.entries.map { $0.entry.id }, ["meal-a-child", "meal-b-child-1", "meal-b-child-2", "standalone"])
        XCTAssertEqual(slot.mealGroups.map { $0.id }, ["meal-a", "meal-b"])
    }

    func testNormalizesAndFormatsDatabaseTimeValuesForInputs() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let date = calendar.date(from: DateComponents(year: 2026, month: 1, day: 5, hour: 9, minute: 7))!

        XCTAssertEqual(IntakeGrouping.currentTimeInputValue(date, calendar: calendar), "09:07")
        XCTAssertEqual(IntakeGrouping.timeToInputValue("07:30:00"), "07:30")
        XCTAssertEqual(IntakeGrouping.timeToInputValue("19:05:12.345"), "19:05")
        XCTAssertEqual(IntakeGrouping.timeToInputValue("24:00:00"), "")
        XCTAssertTrue(IntakeGrouping.formatTimeOfDay("07:30:00", locale: Locale(identifier: "en_US_POSIX")).contains("7:30"))
        XCTAssertEqual(IntakeGrouping.formatTimeOfDay(nil), "—")
    }

    func testFormatsAndValidatesLocalCalendarDatesWithoutUTCConversion() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/Los_Angeles")!
        let date = calendar.date(from: DateComponents(year: 2026, month: 1, day: 5, hour: 23, minute: 30))!

        XCTAssertEqual(IntakeGrouping.formatLocalDate(date, calendar: calendar), "2026-01-05")
        XCTAssertTrue(IntakeGrouping.isValidLocalDate("2026-02-28"))
        XCTAssertFalse(IntakeGrouping.isValidLocalDate("2026-02-29"))
        XCTAssertFalse(IntakeGrouping.isValidLocalDate("2026-13-01"))
        XCTAssertEqual(IntakeGrouping.addLocalDateDays("2026-01-31", days: 1, calendar: calendar), "2026-02-01")
        XCTAssertEqual(IntakeGrouping.formatLocalDateLabel("not-a-date"), "not-a-date")
    }
}

private func loggedEntry(
    id: String,
    nutritionLogMealId: String? = nil,
    grams: JSONValue? = .number(100),
    position: Double = 0,
    slotTime: String? = nil,
    snapshotFoodName: String? = nil,
    snapshotKcalPer100g: JSONValue? = .number(100),
    snapshotFatPer100g: JSONValue? = .number(1),
    snapshotCarbsPer100g: JSONValue? = .number(2),
    snapshotProteinPer100g: JSONValue? = .number(3),
    snapshotFiberPer100g: JSONValue? = .number(4),
    snapshotSugarPer100g: JSONValue? = .number(5)
) -> IntakeEntry {
    IntakeEntry(
        id: id,
        nutritionLogMealId: nutritionLogMealId,
        grams: grams,
        position: position,
        slotTime: slotTime,
        snapshotFoodName: snapshotFoodName ?? id,
        snapshotKcalPer100g: snapshotKcalPer100g,
        snapshotFatPer100g: snapshotFatPer100g,
        snapshotCarbsPer100g: snapshotCarbsPer100g,
        snapshotProteinPer100g: snapshotProteinPer100g,
        snapshotFiberPer100g: snapshotFiberPer100g,
        snapshotSugarPer100g: snapshotSugarPer100g
    )
}

private func loggedMeal(
    id: String,
    mealId: String? = nil,
    nutritionPlanMealId: String? = nil,
    name: String? = nil,
    slotTime: String? = nil,
    position: Double = 0,
    nutritionLogEntries: [IntakeEntry] = []
) -> IntakeLoggedMealGroup {
    IntakeLoggedMealGroup(
        id: id,
        mealId: mealId,
        nutritionPlanMealId: nutritionPlanMealId,
        name: name ?? id,
        slotTime: slotTime,
        position: position,
        nutritionLogEntries: nutritionLogEntries
    )
}
