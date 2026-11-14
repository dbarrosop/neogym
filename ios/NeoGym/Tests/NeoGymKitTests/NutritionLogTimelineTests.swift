import Foundation
import XCTest
@testable import NeoGymKit

final class NutritionLogTimelineTests: XCTestCase {
    private func food(_ id: String, kcal: Double) -> Food {
        Food(
            id: id, name: id, isPublic: false,
            kcalPer100g: .number(kcal), fatPer100g: .number(0), carbsPer100g: .number(0),
            proteinPer100g: .number(0), fiberPer100g: .number(0), sugarPer100g: .number(0)
        )
    }

    private func entry(_ id: String, time: String?, mealId: String? = nil, position: Int = 0) -> NutritionLogEntry {
        NutritionLogEntry(
            id: id, nutritionLogMealId: mealId, grams: .number(100), position: position, slotTime: time,
            snapshotFoodName: id, snapshotKcalPer100g: .number(100), snapshotFatPer100g: .number(0),
            snapshotCarbsPer100g: .number(0), snapshotProteinPer100g: .number(0),
            snapshotFiberPer100g: .number(0), snapshotSugarPer100g: .number(0)
        )
    }

    private var plan: NutritionPlan {
        NutritionPlan(id: "p", name: "Cut", nutritionPlanFoods: [
            NutritionPlanFoodSlot(id: "a", foodId: "oats", grams: .number(80), slotTime: "07:15:00", position: 0, food: food("oats", kcal: 380)),
            NutritionPlanFoodSlot(id: "b", foodId: "rice", grams: .number(200), slotTime: "13:00:00", position: 1, food: food("rice", kcal: 130)),
            NutritionPlanFoodSlot(id: "c", foodId: "skyr", grams: .number(170), slotTime: "21:30:00", position: 2, food: food("skyr", kcal: 60))
        ])
    }

    func testTimelineMergesLoggedAndUnloggedPlannedSlotsByTime() {
        let day = NutritionDay(
            id: "d", logDate: "2026-11-12", nutritionPlanId: "p",
            nutritionLogMeals: [
                NutritionLogMeal(id: "g", name: "Lunch", slotTime: "13:00:00", position: 0,
                                 nutritionLogEntries: [entry("chicken", time: nil, mealId: "g")])
            ],
            nutritionLogEntries: [entry("banana", time: "05:45:00"), entry("whey", time: "05:45:00")]
        )
        let items = NutritionTimeline.items(day: day, selectedPlan: plan, locale: Locale(identifier: "en_GB"))
        XCTAssertEqual(items.map(\.id), ["logged-05:45", "planned-07:15", "logged-13:00", "planned-21:30"])
        XCTAssertEqual(NutritionTimeline.defaultExpandedIds(items), ["logged-13:00", "planned-07:15"])

        if case let .logged(breakfast) = items[0] {
            XCTAssertEqual(NutritionTimeline.loggedCountLabel(breakfast), "2 foods")
            XCTAssertEqual(items[0].kcal, 200, accuracy: 0.001)
        } else {
            XCTFail("Expected a logged slot first")
        }
        if case let .logged(lunch) = items[2] {
            XCTAssertEqual(NutritionTimeline.loggedCountLabel(lunch), "1 meal")
        }
        XCTAssertEqual(items[3].kcal, 102, accuracy: 0.001)
    }

    func testLoggedMealEntriesStayWithTheirLoggedGroupInPositionOrder() throws {
        let last = entry("last", time: "23:00", mealId: "first-log", position: 2)
        let day = NutritionDay(
            id: "d", logDate: "2026-11-12", nutritionLogMeals: [
                NutritionLogMeal(
                    id: "first-log", mealId: "same-template", name: "Bowl", slotTime: "13:00", position: 0,
                    nutritionLogEntries: [last, entry("first", time: nil, mealId: "first-log")]
                ),
                NutritionLogMeal(
                    id: "second-log", mealId: "same-template", nutritionPlanMealId: "plan-meal",
                    name: "Bowl again", slotTime: "13:00", position: 1,
                    nutritionLogEntries: [entry("other", time: nil, mealId: "second-log")]
                ),
                NutritionLogMeal(id: "empty-log", name: "Empty", slotTime: "13:00", position: 2)
            ], nutritionLogEntries: [entry("standalone", time: "13:00")]
        )
        let slot = try XCTUnwrap(day.intakeSlots.first)
        let firstGroup = try XCTUnwrap(slot.mealGroups.first)
        let children = NutritionTimeline.loggedMealEntries(firstGroup, in: slot)

        XCTAssertEqual(day.intakeSlots.map(\.key), ["13:00"], "Grouped entries inherit their meal's time")
        XCTAssertEqual(children.map(\.entry.id), ["first", "last"])
        XCTAssertEqual(children.map(\.mealName), ["Bowl", "Bowl"])
        XCTAssertEqual(children.map(\.kind), [.meal, .meal])
        XCTAssertEqual(NutritionTimeline.loggedMealEntries(slot.mealGroups[1], in: slot).map(\.entry.id), ["other"])
        XCTAssertTrue(NutritionTimeline.loggedMealEntries(slot.mealGroups[2], in: slot).isEmpty)
        XCTAssertEqual(NutritionTimeline.loggedCountLabel(slot), "3 meals, 1 food")
        XCTAssertEqual(slot.totals.kcal, 400, accuracy: 0.001)
    }

    // The host package cannot compile SwiftUI; guard the app-only sheet routing
    // alongside the public-API selection and mutation tests.
    func testLoggedSlotRendersMealChildrenThroughTheEntryEditor() throws {
        let packageRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let source = try String(
            contentsOf: packageRoot.appendingPathComponent("App/Nutrition/DailyIntakeRows.swift"), encoding: .utf8
        )
        let children = #"ForEach\(NutritionTimeline.loggedMealEntries\(group, in: slot\), id: \\\.entry\.id\) \{ slotEntry in\s*entryRow\(slotEntry\)"#
        XCTAssertNotNil(source.range(of: children, options: .regularExpression))
        XCTAssertTrue(source.contains("EditingEntrySheetItem(entry: slotEntry.entry, showTime: slotEntry.kind == .standalone)"))
    }

    func testTimelineWithoutPlanShowsOnlyLoggedSlots() {
        let day = NutritionDay(id: "d", logDate: "2026-11-12", nutritionLogEntries: [entry("x", time: "09:00")])
        XCTAssertEqual(NutritionTimeline.items(day: day, selectedPlan: nil).map(\.id), ["logged-09:00"])
        XCTAssertTrue(NutritionTimeline.items(day: nil, selectedPlan: nil).isEmpty)
        XCTAssertEqual(NutritionTimeline.items(day: nil, selectedPlan: plan).count, 3)
    }

    func testWeekStripRunsMondayToSunday() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Europe/Stockholm")!
        XCTAssertEqual(
            NutritionWeekStrip.days(containing: "2026-11-12", calendar: calendar),
            ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]
        )
        XCTAssertEqual(NutritionWeekStrip.days(containing: "2026-11-15", calendar: calendar).first, "2026-11-09")
        let range = NutritionWeekStrip.range(containing: "2026-11-09", calendar: calendar)
        XCTAssertEqual(range, ChartHistoryRange(from: "2026-11-09", through: "2026-11-15"))

        let history = NutritionCalorieHistory(
            days: [NutritionCalorieHistoryDay(logDate: "2026-11-10", nutritionLogEntries: [
                NutritionCalorieHistoryEntry(grams: .number(200), snapshotKcalPer100g: .number(150))
            ])],
            dailyEnergyEntries: [],
            calendar: calendar
        )
        XCTAssertEqual(NutritionWeekStrip.kcalByDate(history)["2026-11-10"] ?? 0, 300, accuracy: 0.001)
        XCTAssertTrue(NutritionWeekStrip.kcalByDate(nil).isEmpty)
    }
}
