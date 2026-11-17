import Foundation
@testable import NeoGymKit
import XCTest

final class NutritionMacroTextTests: XCTestCase {
    private let enUS = Locale(identifier: "en_US")

    private func totals(protein: Double, carbs: Double, fat: Double) -> MacroTotals {
        MacroTotals(kcal: 0, fat: fat, carbs: carbs, protein: protein, fiber: 0, sugar: 0)
    }

    func testGramsKeepOneDecimalBelowTen() {
        XCTAssertEqual(NutritionMacroText.grams(6.82, locale: enUS), "6.8")
        XCTAssertEqual(NutritionMacroText.grams(0.5, locale: enUS), "0.5")
        XCTAssertEqual(NutritionMacroText.grams(2, locale: enUS), "2")
        XCTAssertEqual(NutritionMacroText.grams(0.04, locale: enUS), "0")
        XCTAssertEqual(NutritionMacroText.grams(9.9, locale: enUS), "9.9")
    }

    func testGramsAreWholeFromTen() {
        XCTAssertEqual(NutritionMacroText.grams(33.4, locale: enUS), "33")
        XCTAssertEqual(NutritionMacroText.grams(36.6, locale: enUS), "37")
        XCTAssertEqual(NutritionMacroText.grams(9.96, locale: enUS), "10")
    }

    func testEntryCaptionMatchesTheDesign() {
        let whey = totals(protein: 33.3, carbs: 6.78, fat: 1.98)
        XCTAssertEqual(
            NutritionMacroText.entryCaption(amount: "45 g", totals: whey, locale: enUS),
            "45 g · P 33 · C 6.8 · F 2"
        )
        XCTAssertEqual(
            NutritionMacroText.entryCaption(amount: nil, totals: whey, locale: enUS),
            "P 33 · C 6.8 · F 2"
        )
    }

    func testAccessibilityTextSpellsOutMacros() {
        let banana = totals(protein: 1.8, carbs: 36.5, fat: 0.5)
        XCTAssertEqual(
            NutritionMacroText.entryAccessibility(amount: "160 grams", totals: banana, locale: enUS),
            "160 grams, protein 1.8 grams, carbs 37 grams, fat 0.5 grams"
        )
        XCTAssertEqual(
            NutritionMacroText.slotAccessibility(totals(protein: 45.2, carbs: 105.6, fat: 6.4), locale: enUS),
            "Protein 45 grams, carbs 106 grams, fat 6 grams"
        )
    }

    func testHalfGramPreviewAndSpeechMatchAtLoggedAmount() {
        let macros = NutritionMath.macrosForGrams(
            input: MacroFields(
                kcalPer100g: .integer(100), fatPer100g: .integer(5),
                carbsPer100g: .integer(5), proteinPer100g: .integer(9)
            ),
            grams: .integer(50)
        )

        XCTAssertEqual(macros.protein, 4.5)
        XCTAssertEqual(macros.carbs, 2.5)
        XCTAssertEqual(macros.fat, 2.5)
        XCTAssertEqual(NutritionEntryPreview.summary(macros, locale: enUS), "50 kcal · P 4 · C 2 · F 2")
        XCTAssertEqual(
            NutritionMacroText.slotAccessibility(macros, locale: enUS),
            "Protein 4 grams, carbs 2 grams, fat 2 grams"
        )
    }

    func testSlotSpeechUsesVisibleWholeGramRoundingAcrossLocales() {
        for locale in [enUS, Locale(identifier: "de_DE")] {
            for value in [0.5, 1.5, 2.5, 3.5, 4.5, 14.5, 1234.5] {
                let macros = totals(protein: value, carbs: value, fat: value)
                let visible = NutritionMacroText.whole(value, locale: locale)
                XCTAssertEqual(
                    NutritionMacroText.slotAccessibility(macros, locale: locale),
                    "Protein \(visible) grams, carbs \(visible) grams, fat \(visible) grams"
                )
            }
        }
    }

    func testItemCount() {
        XCTAssertEqual(NutritionMacroText.itemCount(1), "1 item")
        XCTAssertEqual(NutritionMacroText.itemCount(3), "3 items")
    }
}
