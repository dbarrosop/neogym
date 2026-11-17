import Foundation
import NeoGymKit
import XCTest

final class NutritionEntryPreviewTests: XCTestCase {
    private let enUS = Locale(identifier: "en_US")

    func testUnchangedEntryHasNoSavedLine() {
        let preview = preview(grams: "150")

        XCTAssertNil(preview.changedFrom)
        XCTAssertEqual(preview.totals.kcal, 109.8, accuracy: 0.000001)
        XCTAssertEqual(preview.per100gCaption, "73 kcal · P 9 · C 4 · F 2 per 100 g, as logged")
    }

    func testSubRoundingAmountChangeHasNoSavedLine() {
        let unchanged = preview(grams: "150")
        let adjusted = preview(grams: "150.01")

        XCTAssertNotEqual(adjusted.totals, unchanged.totals)
        XCTAssertNil(adjusted.changedFrom)
        XCTAssertEqual(
            NutritionEntryPreview.summary(adjusted.totals, locale: enUS),
            NutritionEntryPreview.summary(unchanged.totals, locale: enUS)
        )
    }

    func testAdjustedAmountShowsSavedTotalsAndAmount() throws {
        let adjusted = preview(grams: "175")
        let saved = try XCTUnwrap(adjusted.changedFrom)

        XCTAssertEqual(adjusted.totals.kcal, 128.1, accuracy: 0.000001)
        XCTAssertEqual(adjusted.totals.protein, 16.275, accuracy: 0.000001)
        XCTAssertEqual(adjusted.totals.carbs, 7)
        XCTAssertEqual(adjusted.totals.fat, 3.5)
        XCTAssertEqual(adjusted.totals.fiber, 1.75)
        XCTAssertEqual(adjusted.totals.sugar, 5.25)
        XCTAssertEqual(saved.totals, NutritionMath.loggedEntryMacroTotals(entry().loggedSnapshot))
        XCTAssertEqual(saved.amount, "150 g")
        XCTAssertEqual(NutritionEntryPreview.summary(saved.totals, locale: enUS), "110 kcal · P 14 · C 6 · F 3")
    }

    func testFoodBackedEntryIgnoresCatalogAndEditableNutrients() {
        let changedFood = Food(
            id: "food", name: "Changed food", isPublic: false,
            kcalPer100g: .integer(500), fatPer100g: .integer(10), carbsPer100g: .integer(20),
            proteinPer100g: .integer(30), fiberPer100g: .integer(40), sugarPer100g: .integer(50)
        )
        let logged = entry(foodId: changedFood.id)
        // The API takes no catalog lookup. Even if the editable inputs contain
        // the new catalog values, source=food must select the saved snapshot.
        let preview = NutritionEntryPreview(
            entry: logged, grams: "175", adHocPer100g: changedFood.macroFields, locale: enUS
        )

        XCTAssertEqual(preview.totals, NutritionMath.macrosForGrams(input: snapshotInputs, grams: .string("175")))
        XCTAssertNotEqual(preview.totals, NutritionMath.macrosForGrams(input: changedFood.macroFields, grams: .string("175")))
        XCTAssertEqual(preview.per100gCaption, "73 kcal · P 9 · C 4 · F 2 per 100 g, as logged")
    }

    func testDeletedFoodStillUsesItsSnapshot() {
        let preview = NutritionEntryPreview(
            entry: entry(foodId: nil), grams: "150", adHocPer100g: MacroFields(), locale: enUS
        )

        XCTAssertEqual(preview.totals, NutritionMath.loggedEntryMacroTotals(entry().loggedSnapshot))
        XCTAssertNil(preview.changedFrom)
    }

    func testAdHocEntryUsesTypedNutrients() {
        let edited = MacroFields(
            kcalPer100g: .string("100"), fatPer100g: .string("5"), carbsPer100g: .string("10"),
            proteinPer100g: .string("15"), fiberPer100g: .string("2"), sugarPer100g: .string("4")
        )
        let preview = NutritionEntryPreview(
            entry: entry(source: .adHoc, foodId: nil), grams: "175", adHocPer100g: edited, locale: enUS
        )

        XCTAssertEqual(preview.totals, MacroTotals(kcal: 175, fat: 8.75, carbs: 17.5, protein: 26.25, fiber: 3.5, sugar: 7))
        XCTAssertNotNil(preview.changedFrom)
        XCTAssertEqual(preview.changedFrom?.amount, "150 g")
    }

    func testCommaDecimalsInAmountAndAllCustomNutrients() {
        let edited = MacroFields(
            kcalPer100g: .string("100,5"), fatPer100g: .string("5,5"), carbsPer100g: .string("10,5"),
            proteinPer100g: .string("15,5"), fiberPer100g: .string("2,5"), sugarPer100g: .string("4,5")
        )
        let preview = NutritionEntryPreview(
            entry: entry(source: .adHoc, foodId: nil), grams: "125,5", adHocPer100g: edited, locale: enUS
        )

        XCTAssertEqual(preview.totals.kcal, 126.1275, accuracy: 0.000001)
        XCTAssertEqual(preview.totals.fat, 6.9025, accuracy: 0.000001)
        XCTAssertEqual(preview.totals.carbs, 13.1775, accuracy: 0.000001)
        XCTAssertEqual(preview.totals.protein, 19.4525, accuracy: 0.000001)
        XCTAssertEqual(preview.totals.fiber, 3.1375, accuracy: 0.000001)
        XCTAssertEqual(preview.totals.sugar, 5.6475, accuracy: 0.000001)
    }

    func testEachDisplayedMacroCanShowTheSavedLine() {
        let fields: [WritableKeyPath<MacroFields, JSONValue?>] = [
            \.kcalPer100g, \.proteinPer100g, \.carbsPer100g, \.fatPer100g
        ]
        for field in fields {
            var edited = snapshotInputs
            edited[keyPath: field] = .string("1000")
            let preview = NutritionEntryPreview(
                entry: entry(source: .adHoc, foodId: nil), grams: "150", adHocPer100g: edited, locale: enUS
            )
            XCTAssertNotNil(preview.changedFrom, "Changing \(field) must show saved totals")
        }
    }

    func testOnlyFiberAndSugarChangesDoNotShowSavedLine() {
        var edited = snapshotInputs
        edited.fiberPer100g = .string("20")
        edited.sugarPer100g = .string("30")
        let preview = NutritionEntryPreview(
            entry: entry(source: .adHoc, foodId: nil), grams: "150", adHocPer100g: edited, locale: enUS
        )

        XCTAssertEqual(preview.totals.fiber, 30)
        XCTAssertEqual(preview.totals.sugar, 45)
        XCTAssertNil(preview.changedFrom)
    }

    func testEmptyOrMalformedDraftNumbersRetainZeroFallback() {
        for grams in ["", "not a number"] {
            XCTAssertEqual(preview(grams: grams).totals, .empty)
        }
        let preview = NutritionEntryPreview(
            entry: entry(source: .adHoc, foodId: nil), grams: "150",
            adHocPer100g: MacroFields(kcalPer100g: .string(""), proteinPer100g: .string("invalid")), locale: enUS
        )
        XCTAssertEqual(preview.totals, .empty)
    }

    func testWholeTextPreservesExistingVisibleFormattingAcrossLocalesAndTies() {
        for locale in [enUS, Locale(identifier: "de_DE")] {
            for value in [0, 0.5, 1.5, 2.5, 9.5, 109.8, 1234.5] {
                XCTAssertEqual(
                    NutritionMacroText.whole(value, locale: locale),
                    value.formatted(.number.precision(.fractionLength(0)).locale(locale))
                )
            }
        }
    }

    private func preview(grams: String) -> NutritionEntryPreview {
        NutritionEntryPreview(entry: entry(), grams: grams, adHocPer100g: snapshotInputs, locale: enUS)
    }

    private var snapshotInputs: MacroFields {
        MacroFields(
            kcalPer100g: .string("73.2"), fatPer100g: .string("2"), carbsPer100g: .string("4"),
            proteinPer100g: .string("9.3"), fiberPer100g: .string("1"), sugarPer100g: .string("3")
        )
    }

    private func entry(source: NutritionLogEntrySource = .food, foodId: String? = "food") -> IntakeEntry {
        NutritionLogEntry(
            id: "entry", foodId: foodId, source: source, grams: .string("150"), position: 0,
            snapshotFoodName: "Food as logged",
            snapshotKcalPer100g: .string("73.2"), snapshotFatPer100g: .string("2"), snapshotCarbsPer100g: .string("4"),
            snapshotProteinPer100g: .string("9.3"), snapshotFiberPer100g: .string("1"), snapshotSugarPer100g: .string("3")
        ).intakeEntry
    }
}
