import Foundation
import XCTest
@testable import NeoGymKit

final class NutritionMathTests: XCTestCase {
    func testNormalizesHasuraNumericValuesReturnedAsStringsOrNumbers() {
        XCTAssertEqual(NutritionMath.normalizeNumeric(.string("12.5")), 12.5)
        XCTAssertEqual(NutritionMath.normalizeNumeric(.string("12,5")), 12.5)
        XCTAssertEqual(NutritionMath.normalizeNumeric(.number(8)), 8)
        XCTAssertEqual(NutritionMath.normalizeNumeric(.string("not-a-number")), 0)
        XCTAssertEqual(NutritionMath.normalizeNumeric(.null), 0)
        XCTAssertEqual(NutritionMath.normalizeNumeric(nil), 0)
    }

    func testNormalizesAllMacroFieldsBeforeMathAndDisplay() {
        XCTAssertEqual(
            NutritionMath.normalizeMacros(
                MacroFields(
                    kcalPer100g: .string("250"),
                    fatPer100g: .string("12.5"),
                    carbsPer100g: .number(31),
                    proteinPer100g: .string("7.25"),
                    fiberPer100g: .null,
                    sugarPer100g: nil
                )
            ),
            NormalizedMacros(
                kcalPer100g: 250,
                fatPer100g: 12.5,
                carbsPer100g: 31,
                proteinPer100g: 7.25,
                fiberPer100g: 0,
                sugarPer100g: 0
            )
        )
    }

    func testParsesNonNegativeFormInputsAndRejectsInvalidValues() {
        XCTAssertEqual(NutritionMath.parseMacroInput(" 42.5 "), 42.5)
        XCTAssertEqual(NutritionMath.parseMacroInput("42,5"), 42.5)
        XCTAssertEqual(NutritionMath.parseMacroInput("0"), 0)
        XCTAssertNil(NutritionMath.parseMacroInput(""))
        XCTAssertNil(NutritionMath.parseMacroInput("-1"))
        XCTAssertNil(NutritionMath.parseMacroInput("abc"))
    }

    func testFormatsMacroValuesWithCompactUnits() {
        let locale = Locale(identifier: "en_US_POSIX")
        XCTAssertEqual(NutritionMath.formatMacro(.string("120"), unit: "kcal", locale: locale), "120 kcal")
        XCTAssertEqual(NutritionMath.formatMacro(.string("1.25"), unit: "g", locale: locale), "1.3 g")
    }

    func testBuildsConcisePer100gMacroSummary() {
        let locale = Locale(identifier: "en_US_POSIX")
        XCTAssertEqual(
            NutritionMath.macroSummary(
                MacroFields(
                    kcalPer100g: .string("120"),
                    fatPer100g: .string("3.5"),
                    carbsPer100g: .string("20"),
                    proteinPer100g: .string("4"),
                    fiberPer100g: .string("2.25"),
                    sugarPer100g: .string("5")
                ),
                locale: locale
            ),
            "120 kcal · 3.5 g fat · 20 g carbs · 4 g protein · 2.3 g fiber · 5 g sugar"
        )
    }

    func testScalesLiveFoodMacrosByGrams() {
        XCTAssertEqual(
            NutritionMath.macrosForGrams(
                input: MacroFields(
                    kcalPer100g: .string("200"),
                    fatPer100g: .string("10"),
                    carbsPer100g: .string("20"),
                    proteinPer100g: .string("5"),
                    fiberPer100g: .string("2"),
                    sugarPer100g: .string("8")
                ),
                grams: .string("150")
            ),
            MacroTotals(kcal: 300, fat: 15, carbs: 30, protein: 7.5, fiber: 3, sugar: 12)
        )
    }

    func testComputesMealTotalsFromIngredientFoods() {
        let totals = NutritionMath.mealMacroTotals([
            MealTotalIngredient(
                grams: .number(100),
                food: MacroFields(
                    kcalPer100g: .number(100),
                    fatPer100g: .number(1),
                    carbsPer100g: .number(10),
                    proteinPer100g: .number(5),
                    fiberPer100g: .number(2),
                    sugarPer100g: .number(3)
                )
            ),
            MealTotalIngredient(
                grams: .string("50"),
                food: MacroFields(
                    kcalPer100g: .string("80"),
                    fatPer100g: .string("2"),
                    carbsPer100g: .string("6"),
                    proteinPer100g: .string("4"),
                    fiberPer100g: .string("1"),
                    sugarPer100g: .string("2")
                )
            )
        ])

        XCTAssertEqual(totals, MacroTotals(kcal: 140, fat: 2, carbs: 13, protein: 7, fiber: 2.5, sugar: 4))
        XCTAssertEqual(
            NutritionMath.macroTotalsSummary(totals, locale: Locale(identifier: "en_US_POSIX")),
            "140 kcal · 2 g fat · 13 g carbs · 7 g protein · 2.5 g fiber · 4 g sugar"
        )
    }

    func testComputesDailyPlanTotalsFromEachSlotsLiveMealIngredients() {
        XCTAssertEqual(
            NutritionMath.planMacroTotals([
                PlanTotalSlot(
                    mealIngredients: [
                        MealTotalIngredient(
                            grams: .number(200),
                            food: MacroFields(
                                kcalPer100g: .number(50),
                                fatPer100g: .number(1),
                                carbsPer100g: .number(5),
                                proteinPer100g: .number(3),
                                fiberPer100g: .number(1),
                                sugarPer100g: .number(2)
                            )
                        )
                    ]
                ),
                PlanTotalSlot(
                    mealIngredients: [
                        MealTotalIngredient(
                            grams: .string("100"),
                            food: MacroFields(
                                kcalPer100g: .string("25"),
                                fatPer100g: .string("0.5"),
                                carbsPer100g: .string("4"),
                                proteinPer100g: .string("2"),
                                fiberPer100g: .string("1.5"),
                                sugarPer100g: .string("1")
                            )
                        )
                    ]
                )
            ]),
            MacroTotals(kcal: 125, fat: 2.5, carbs: 14, protein: 8, fiber: 3.5, sugar: 5)
        )
    }

    func testComputesLoggedTotalsFromTrustedSnapshotColumns() {
        XCTAssertEqual(
            NutritionMath.loggedMacroTotals([
                LoggedSnapshotEntry(
                    grams: .string("150"),
                    snapshotKcalPer100g: .string("100"),
                    snapshotFatPer100g: .string("2"),
                    snapshotCarbsPer100g: .string("10"),
                    snapshotProteinPer100g: .string("5"),
                    snapshotFiberPer100g: .string("1"),
                    snapshotSugarPer100g: .string("3")
                ),
                LoggedSnapshotEntry(
                    grams: .number(50),
                    snapshotKcalPer100g: .number(200),
                    snapshotFatPer100g: .number(8),
                    snapshotCarbsPer100g: .number(20),
                    snapshotProteinPer100g: .number(10),
                    snapshotFiberPer100g: .number(4),
                    snapshotSugarPer100g: .number(6)
                )
            ]),
            MacroTotals(kcal: 250, fat: 7, carbs: 25, protein: 12.5, fiber: 3.5, sugar: 7.5)
        )
    }

    func testInUseErrorRecognitionHelpers() {
        XCTAssertTrue(NutritionMath.isFoodInUseError("foreign key violation on meal_ingredients"))
        XCTAssertTrue(NutritionMath.isFoodInUseError("violates constraint nutrition_log_entries_food_id_fkey"))
        XCTAssertFalse(NutritionMath.isFoodInUseError("network timeout"))

        XCTAssertTrue(NutritionMath.isMealInUseByPlanError("foreign key violation on nutrition_plan_meals"))
        XCTAssertFalse(NutritionMath.isMealInUseByPlanError("food is in use by log entry"))
    }
}
