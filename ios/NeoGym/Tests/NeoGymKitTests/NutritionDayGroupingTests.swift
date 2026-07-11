import Foundation
import XCTest
@testable import NeoGymKit

final class NutritionDayGroupingTests: XCTestCase {
    func testLatestLoggedSlotTimeUsesMealGroupsAndStandaloneEntriesOnly() {
        let groupedChildWithLaterTime = groupingLogEntry(
            id: "grouped-child",
            nutritionLogMealId: "meal-1",
            slotTime: "23:50:00"
        )
        let meal = NutritionLogMeal(
            id: "meal-1",
            name: "Dinner",
            slotTime: "21:05:00",
            position: 0,
            nutritionLogEntries: [groupedChildWithLaterTime]
        )
        let standalone = groupingLogEntry(id: "standalone", slotTime: "10:15:00")
        let malformed = groupingLogEntry(id: "malformed", slotTime: "99:99")

        let day = NutritionDay(
            id: "day-latest",
            logDate: "2026-07-11",
            nutritionLogMeals: [meal],
            nutritionLogEntries: [standalone, malformed]
        )

        XCTAssertEqual(day.latestLoggedSlotTime, "21:05")
    }

    func testLatestLoggedSlotTimeReturnsNilWhenNoValidMealOrStandaloneTimesExist() {
        let day = NutritionDay(
            id: "day-no-times",
            logDate: "2026-07-11",
            nutritionLogMeals: [NutritionLogMeal(id: "meal-1", name: "Dinner", slotTime: nil, position: 0)],
            nutritionLogEntries: [
                groupingLogEntry(id: "missing", slotTime: nil),
                groupingLogEntry(id: "malformed", slotTime: "noon"),
                groupingLogEntry(id: "grouped", nutritionLogMealId: "meal-1", slotTime: "22:30")
            ]
        )

        XCTAssertNil(day.latestLoggedSlotTime)
    }

    func testEnergyBalanceOverviewSummaryFormatsRequestedCaptions() {
        let payload = NutritionOverviewPayload(
            days: [groupingNutritionDayFixture],
            dailyEnergyEntries: [groupingDailyEnergyFixture]
        )

        let summary = EnergyBalanceOverviewSummary(
            payload: payload,
            today: "2026-06-27",
            locale: Locale(identifier: "en_US")
        )

        XCTAssertEqual(summary.consumedValue, "250 kcal")
        XCTAssertTrue(summary.consumedCaption.hasPrefix("As of 10:15"))
        XCTAssertEqual(summary.burnedValue, "2,000 kcal")
        XCTAssertEqual(summary.burnedCaption, "450 + 1550 kcal")
        XCTAssertEqual(summary.netTodayValue, "−1,750 kcal")
        XCTAssertEqual(summary.netTodayCaption, "Deficit")
        XCTAssertEqual(summary.sevenDayAverageValue, "−1,750 kcal")
        XCTAssertEqual(summary.sevenDayAverageCaption, "Deficit")
    }

    func testEnergyBalanceOverviewSummaryExposesRawValuesForWidgetSnapshotMapping() {
        let payload = NutritionOverviewPayload(
            days: [groupingNutritionDayFixture],
            dailyEnergyEntries: [groupingDailyEnergyFixture]
        )

        let summary = EnergyBalanceOverviewSummary(
            payload: payload,
            today: "2026-06-27",
            locale: Locale(identifier: "en_US")
        )

        XCTAssertEqual(summary.date, "2026-06-27")
        XCTAssertEqual(summary.caloriesIn, 250, accuracy: 0.001)
        XCTAssertEqual(summary.activeKcal, 450)
        XCTAssertEqual(summary.restingKcal, 1550)
        XCTAssertEqual(summary.caloriesOut, 2000)
        XCTAssertEqual(summary.net, -1750)
        XCTAssertEqual(summary.netState, .deficit)
        XCTAssertEqual(summary.sevenDayAverageNet, -1750)
        XCTAssertEqual(summary.sevenDayAverageState, .deficit)
        XCTAssertEqual(summary.latestLoggedSlotTime, "10:15")
    }

    func testEnergyBalanceOverviewSummaryDistinguishesMissingEnergyFromMissingComponents() {
        let day = NutritionDay(
            id: "day-1",
            logDate: "2026-07-11",
            nutritionLogEntries: [groupingLogEntry(slotTime: "09:30")]
        )
        let missingEnergy = EnergyBalanceOverviewSummary(
            payload: NutritionOverviewPayload(days: [day]),
            today: "2026-07-11",
            locale: Locale(identifier: "en_US")
        )

        XCTAssertEqual(missingEnergy.burnedValue, "No energy")
        XCTAssertEqual(missingEnergy.burnedCaption, "Log active/resting energy")
        XCTAssertEqual(missingEnergy.netTodayValue, "No energy")
        XCTAssertEqual(missingEnergy.netTodayCaption, "Needs energy")
        XCTAssertEqual(missingEnergy.sevenDayAverageValue, "No data")
        XCTAssertEqual(missingEnergy.sevenDayAverageCaption, "Log intake and energy to calculate")

        let zeroComponentEnergy = EnergyBalanceOverviewSummary(
            payload: NutritionOverviewPayload(
                days: [day],
                dailyEnergyEntries: [DailyEnergy(id: "energy-1", energyOn: "2026-07-11")]
            ),
            today: "2026-07-11",
            locale: Locale(identifier: "en_US")
        )

        XCTAssertEqual(zeroComponentEnergy.burnedValue, "0 kcal")
        XCTAssertEqual(zeroComponentEnergy.burnedCaption, "0 + 0 kcal")
        XCTAssertEqual(zeroComponentEnergy.netTodayValue, "+100 kcal")
        XCTAssertEqual(zeroComponentEnergy.netTodayCaption, "Surplus")
        XCTAssertEqual(zeroComponentEnergy.sevenDayAverageCaption, "Surplus")
    }

    func testDailyIntakeCalorieBalanceNullSemantics() {
        let intakeDay = NutritionDay(
            id: "day-balance",
            logDate: "2026-07-08",
            nutritionLogEntries: [groupingStandaloneEntry]
        )

        let nutritionOnly = DailyIntakePayload(day: intakeDay, nutritionPlans: [], meals: [], foods: [])
        XCTAssertEqual(nutritionOnly.caloriesIn, 100)
        XCTAssertNil(nutritionOnly.caloriesOut)
        XCTAssertNil(nutritionOnly.netCalories)
        XCTAssertEqual(nutritionOnly.calorieBalance.state, .intakeOnly)

        let energyOnly = DailyIntakePayload(
            day: nil,
            dailyEnergy: DailyEnergy(id: "energy-rest", energyOn: "2026-07-08", restingKcal: 1800),
            nutritionPlans: [],
            meals: [],
            foods: []
        )
        XCTAssertEqual(energyOnly.caloriesIn, 0)
        XCTAssertEqual(energyOnly.caloriesOut, 1800)
        XCTAssertEqual(energyOnly.netCalories, -1800)
        XCTAssertEqual(energyOnly.calorieBalance.state, .deficit)

        let activeOnly = DailyIntakePayload(
            day: intakeDay,
            dailyEnergy: DailyEnergy(id: "energy-active", energyOn: "2026-07-08", activeKcal: 250),
            nutritionPlans: [],
            meals: [],
            foods: []
        )
        XCTAssertEqual(activeOnly.caloriesOut, 250)
        XCTAssertEqual(activeOnly.netCalories, -150)
        XCTAssertEqual(activeOnly.calorieBalance.state, .deficit)

        let both = DailyIntakePayload(
            day: intakeDay,
            dailyEnergy: DailyEnergy(id: "energy-both", energyOn: "2026-07-08", activeKcal: 40, restingKcal: 60),
            nutritionPlans: [],
            meals: [],
            foods: []
        )
        XCTAssertEqual(both.caloriesOut, 100)
        XCTAssertEqual(both.netCalories, 0)
        XCTAssertEqual(both.calorieBalance.state, .balanced)

        let neither = DailyIntakePayload(day: nil, nutritionPlans: [], meals: [], foods: [])
        XCTAssertEqual(neither.caloriesIn, 0)
        XCTAssertNil(neither.caloriesOut)
        XCTAssertNil(neither.netCalories)
        XCTAssertEqual(neither.calorieBalance.state, .intakeOnly)
    }

    func testNutritionLogEntrySourceDecodesAndMissingSourceDefaultsToFood() throws {
        let encodedAdHoc = try JSONEncoder().encode(groupingStandaloneEntryJSON)
        let adHocEntry = try JSONDecoder().decode(NutritionLogEntry.self, from: encodedAdHoc)
        XCTAssertEqual(adHocEntry.source, .adHoc)
        XCTAssertTrue(adHocEntry.isAdHoc)

        var object = try XCTUnwrap(groupingStandaloneEntryJSON.objectValue)
        object.removeValue(forKey: "source")
        let encodedMissingSource = try JSONEncoder().encode(JSONValue.object(object))
        let missingSourceEntry = try JSONDecoder().decode(NutritionLogEntry.self, from: encodedMissingSource)
        XCTAssertEqual(missingSourceEntry.source, .food)
        XCTAssertFalse(missingSourceEntry.isAdHoc)
    }

    func testDayIntakeSlotsGroupBySupportedTimesAndUseSnapshotTotals() {
        let day = NutritionDay(
            id: "day-1",
            logDate: "2026-06-27",
            nutritionLogMeals: [groupingLoggedMeal],
            nutritionLogEntries: [groupingStandaloneEntry]
        )

        let slots = day.intakeSlots

        XCTAssertEqual(slots.map(\.key), ["08:30", "10:15"])
        XCTAssertEqual(slots[0].mealGroups.map(\.name), ["Breakfast"])
        XCTAssertEqual(slots[0].entries.map(\.mealName), ["Breakfast"])
        XCTAssertEqual(slots[0].totals.kcal, 150)
        XCTAssertEqual(slots[1].entries.map(\.entry.snapshotFoodName), ["Blueberries snapshot"])
        XCTAssertEqual(day.loggedTotals.kcal, 250)
    }
}

final class PlanLogMaterializerTests: XCTestCase {
    func testMaterializesMixedPlanWithOverridesAndAppendedPositions() throws {
        let materialization = try PlanLogMaterializer.build(
            selectedPlan: materializerPlan(mealPosition: 0, foodPosition: 1),
            dayId: "day-1",
            existingMealGroups: [NutritionLogMeal(id: "existing-meal", name: "Lunch", slotTime: "12:00:00", position: 4)],
            existingStandaloneEntries: [groupingLogEntry(id: "existing-food", slotTime: "12:00:00").withPosition(7)],
            slotTimeByKey: ["08:00": "12:00"]
        )

        XCTAssertEqual(materialization.mealObjects.map(\.position), [8])
        XCTAssertEqual(materialization.entryObjects.map(\.position), [9])
        XCTAssertEqual(materialization.mealObjects.first?.slotTime, "12:00")
        XCTAssertEqual(materialization.entryObjects.first?.slotTime, "12:00")
        XCTAssertEqual(materialization.mealObjects.first?.nutritionPlanMealId, "slot-1")
        XCTAssertEqual(materialization.entryObjects.first?.nutritionPlanFoodId, "plan-food-1")
        XCTAssertEqual(materialization.mealObjects.first?.entries.map(\.dayId), ["day-1", "day-1"])
        XCTAssertEqual(materialization.mealObjects.first?.entries.map(\.position), [0, 1])
    }

    func testMaterializesFoodsOnlyAndMealsOnlyWithEmptyCounterpartArrays() throws {
        let foodOnly = try PlanLogMaterializer.build(
            selectedPlan: NutritionPlan(
                id: "plan-food-only",
                name: "Food only",
                nutritionPlanFoods: [materializerFoodSlot(position: 0)]
            ),
            dayId: "day-1",
            existingMealGroups: [],
            existingStandaloneEntries: [],
            slotTimeByKey: ["08:00": "08:30"]
        )
        XCTAssertEqual(foodOnly.mealObjects, [])
        XCTAssertEqual(foodOnly.entryObjects.count, 1)

        let mealOnly = try PlanLogMaterializer.build(
            selectedPlan: NutritionPlan(
                id: "plan-meal-only",
                name: "Meal only",
                nutritionPlanMeals: [materializerMealSlot(position: 0)]
            ),
            dayId: "day-1",
            existingMealGroups: [],
            existingStandaloneEntries: [],
            slotTimeByKey: ["08:00": "08:30"]
        )
        XCTAssertEqual(mealOnly.mealObjects.count, 1)
        XCTAssertEqual(mealOnly.entryObjects, [])
    }

    func testMaterializerAssignsDistinctPositionsForSameTimeOrder() throws {
        let foodBeforeMeal = try PlanLogMaterializer.build(
            selectedPlan: materializerPlan(mealPosition: 1, foodPosition: 0),
            dayId: "day-1",
            existingMealGroups: [],
            existingStandaloneEntries: [],
            slotTimeByKey: ["08:00": "08:45"]
        )
        XCTAssertEqual(foodBeforeMeal.entryObjects.first?.position, 0)
        XCTAssertEqual(foodBeforeMeal.mealObjects.first?.position, 1)

        let mealBeforeFood = try PlanLogMaterializer.build(
            selectedPlan: materializerPlan(mealPosition: 0, foodPosition: 1),
            dayId: "day-1",
            existingMealGroups: [],
            existingStandaloneEntries: [],
            slotTimeByKey: ["08:00": "08:45"]
        )
        XCTAssertEqual(mealBeforeFood.mealObjects.first?.position, 0)
        XCTAssertEqual(mealBeforeFood.entryObjects.first?.position, 1)
    }

    func testBulkSlotTimeDefaultsUsePlanTimesAndFallbackForLegacyNoTimeSlots() {
        let defaults = PlanLogSlotTimeDefaults.build(
            selectedPlan: NutritionPlan(
                id: "plan-defaults",
                name: "Defaults",
                nutritionPlanMeals: [materializerMealSlot(slotTime: "08:15:00", position: 0)],
                nutritionPlanFoods: [materializerFoodSlot(slotTime: "", position: 0)]
            ),
            fallbackTime: "14:45"
        )

        XCTAssertEqual(defaults["08:15"], "08:15")
        XCTAssertEqual(defaults["no-time"], "14:45")
    }

    func testBulkSlotTimeDefaultsReturnEmptyWithoutSelectedPlan() {
        XCTAssertEqual(PlanLogSlotTimeDefaults.build(selectedPlan: nil, fallbackTime: "14:45"), [:])
    }

    func testMaterializerValidatesPlanReferencesAndTargetTimes() {
        XCTAssertThrowsError(try PlanLogMaterializer.build(
            selectedPlan: nil,
            dayId: "day-1",
            existingMealGroups: [],
            existingStandaloneEntries: [],
            slotTimeByKey: [:]
        ))
        XCTAssertThrowsError(try PlanLogMaterializer.build(
            selectedPlan: NutritionPlan(id: "empty", name: "Empty"),
            dayId: "day-1",
            existingMealGroups: [],
            existingStandaloneEntries: [],
            slotTimeByKey: [:]
        ))
        XCTAssertThrowsError(try PlanLogMaterializer.build(
            selectedPlan: NutritionPlan(
                id: "empty-meal",
                name: "Empty meal plan",
                nutritionPlanMeals: [NutritionPlanMealSlot(
                    id: "slot-empty",
                    mealId: "meal-empty",
                    slotTime: "08:00",
                    position: 0,
                    meal: Meal(id: "meal-empty", name: "Empty meal", mealIngredients: [])
                )]
            ),
            dayId: "day-1",
            existingMealGroups: [],
            existingStandaloneEntries: [],
            slotTimeByKey: ["08:00": "08:00"]
        )) { error in
            XCTAssertEqual(error.localizedDescription, "Empty meal has no ingredients to log.")
        }
        XCTAssertThrowsError(try PlanLogMaterializer.build(
            selectedPlan: materializerPlan(),
            dayId: "day-1",
            existingMealGroups: [],
            existingStandaloneEntries: [],
            slotTimeByKey: ["08:00": ""]
        )) { error in
            XCTAssertTrue(error.localizedDescription.contains("Choose a logged time"))
        }
    }
}

private let groupingDailyEnergyFixture = DailyEnergy(
    id: "energy-1",
    energyOn: "2026-06-27",
    activeKcal: 450,
    restingKcal: 1550
)

private let groupingNutritionDayFixture = NutritionDay(
    id: "day-1",
    userId: "user-1",
    logDate: "2026-06-27",
    nutritionPlanId: "plan-1",
    nutritionLogMeals: [groupingLoggedMeal],
    nutritionLogEntries: [groupingStandaloneEntry]
)

private func groupingLogEntry(
    id: String = "entry-1",
    nutritionLogMealId: String? = nil,
    slotTime: String? = "10:15:00"
) -> NutritionLogEntry {
    NutritionLogEntry(
        id: id,
        nutritionDayId: "day-1",
        nutritionLogMealId: nutritionLogMealId,
        source: .food,
        grams: .string("100"),
        position: 0,
        slotTime: slotTime,
        snapshotFoodName: "Test food",
        snapshotKcalPer100g: .string("100"),
        snapshotFatPer100g: .string("0"),
        snapshotCarbsPer100g: .string("0"),
        snapshotProteinPer100g: .string("0"),
        snapshotFiberPer100g: .string("0"),
        snapshotSugarPer100g: .string("0")
    )
}

private let groupingLoggedMeal = NutritionLogMeal(
    id: "log-meal-1",
    mealId: "meal-1",
    nutritionPlanMealId: "slot-1",
    name: "Breakfast",
    slotTime: "08:30:00",
    position: 0,
    nutritionLogEntries: [NutritionLogEntry(
        id: "entry-1",
        nutritionDayId: "day-1",
        nutritionLogMealId: "log-meal-1",
        foodId: "food-1",
        source: .food,
        grams: .string("150"),
        position: 0,
        slotTime: "08:30:00",
        snapshotFoodName: "Greek yogurt snapshot",
        snapshotKcalPer100g: .string("100"),
        snapshotFatPer100g: .string("2"),
        snapshotCarbsPer100g: .string("10"),
        snapshotProteinPer100g: .string("5"),
        snapshotFiberPer100g: .string("1"),
        snapshotSugarPer100g: .string("3")
    )]
)

private let groupingStandaloneEntry = NutritionLogEntry(
    id: "entry-2",
    nutritionDayId: "day-1",
    source: .adHoc,
    grams: .string("50"),
    position: 1,
    slotTime: "10:15:00",
    snapshotFoodName: "Blueberries snapshot",
    snapshotKcalPer100g: .string("200"),
    snapshotFatPer100g: .string("8"),
    snapshotCarbsPer100g: .string("20"),
    snapshotProteinPer100g: .string("10"),
    snapshotFiberPer100g: .string("4"),
    snapshotSugarPer100g: .string("6")
)

private let groupingStandaloneEntryJSON: JSONValue = .object([
    "id": .string("entry-2"),
    "nutritionDayId": .string("day-1"),
    "nutritionLogMealId": .null,
    "nutritionPlanFoodId": .null,
    "foodId": .null,
    "source": .string("ad_hoc"),
    "grams": .string("50"),
    "position": .number(1),
    "slotTime": .string("10:15:00"),
    "snapshotFoodName": .string("Blueberries snapshot"),
    "snapshotKcalPer100g": .string("200"),
    "snapshotFatPer100g": .string("8"),
    "snapshotCarbsPer100g": .string("20"),
    "snapshotProteinPer100g": .string("10"),
    "snapshotFiberPer100g": .string("4"),
    "snapshotSugarPer100g": .string("6")
])

private func materializerPlan(mealPosition: Int = 0, foodPosition: Int = 1) -> NutritionPlan {
    NutritionPlan(
        id: "plan-1",
        name: "Training day",
        nutritionPlanMeals: [materializerMealSlot(position: mealPosition)],
        nutritionPlanFoods: [materializerFoodSlot(position: foodPosition)]
    )
}

private func materializerMealSlot(slotTime: String = "08:00:00", position: Int) -> NutritionPlanMealSlot {
    NutritionPlanMealSlot(
        id: "slot-1",
        mealId: "meal-1",
        slotTime: slotTime,
        label: "Breakfast",
        position: position,
        meal: Meal(
            id: "meal-1",
            name: "Breakfast bowl",
            mealIngredients: [
                MealIngredient(id: "ingredient-2", foodId: "food-2", grams: .string("50"), position: 1),
                MealIngredient(id: "ingredient-1", foodId: "food-1", grams: .string("100"), position: 0)
            ]
        )
    )
}

private func materializerFoodSlot(slotTime: String = "08:00:00", position: Int) -> NutritionPlanFoodSlot {
    NutritionPlanFoodSlot(
        id: "plan-food-1",
        foodId: "food-3",
        grams: .string("80"),
        slotTime: slotTime,
        label: "Banana",
        position: position
    )
}

private extension NutritionLogEntry {
    func withPosition(_ position: Int) -> NutritionLogEntry {
        NutritionLogEntry(
            id: id,
            nutritionDayId: nutritionDayId,
            nutritionLogMealId: nutritionLogMealId,
            nutritionPlanFoodId: nutritionPlanFoodId,
            foodId: foodId,
            source: source,
            grams: grams,
            position: position,
            slotTime: slotTime,
            snapshotFoodName: snapshotFoodName,
            snapshotKcalPer100g: snapshotKcalPer100g,
            snapshotFatPer100g: snapshotFatPer100g,
            snapshotCarbsPer100g: snapshotCarbsPer100g,
            snapshotProteinPer100g: snapshotProteinPer100g,
            snapshotFiberPer100g: snapshotFiberPer100g,
            snapshotSugarPer100g: snapshotSugarPer100g,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }
}

private extension JSONValue {
    var objectValue: [String: JSONValue]? {
        guard case let .object(object) = self else { return nil }
        return object
    }
}
