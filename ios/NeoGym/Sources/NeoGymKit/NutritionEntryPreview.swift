import Foundation

/// Nutrition shown while editing a logged entry. Food-backed entries always
/// use their immutable snapshot; only ad-hoc entries use the typed nutrients.
public struct NutritionEntryPreview: Sendable {
    public struct Saved: Sendable, Equatable {
        public let totals: MacroTotals
        /// The saved amount, such as "150 g".
        public let amount: String
    }

    public let totals: MacroTotals
    /// Saved totals only when the displayed whole kcal/protein/carbs/fat differ.
    /// Fiber/sugar and sub-rounding amount changes do not show a "Was" line.
    public let changedFrom: Saved?
    public let per100gCaption: String

    public init(
        entry: IntakeEntry,
        grams: String,
        adHocPer100g: MacroFields,
        locale: Locale = .current
    ) {
        let per100g = entry.isAdHoc ? adHocPer100g : MacroFields(
            kcalPer100g: entry.snapshotKcalPer100g,
            fatPer100g: entry.snapshotFatPer100g,
            carbsPer100g: entry.snapshotCarbsPer100g,
            proteinPer100g: entry.snapshotProteinPer100g,
            fiberPer100g: entry.snapshotFiberPer100g,
            sugarPer100g: entry.snapshotSugarPer100g
        )
        totals = NutritionMath.macrosForGrams(input: per100g, grams: .string(grams))
        let savedTotals = NutritionMath.loggedEntryMacroTotals(entry.loggedSnapshot)
        changedFrom = Self.summary(savedTotals, locale: locale) == Self.summary(totals, locale: locale)
            ? nil
            : Saved(totals: savedTotals, amount: "\(NutritionMath.formatEditableDecimal(entry.grams)) g")
        let per100 = NutritionMath.macrosForGrams(input: per100g, grams: .number(100))
        per100gCaption = "\(Self.summary(per100, locale: locale)) per 100 g, as logged"
    }

    /// The whole-number summary used for both saved totals and their comparison.
    public static func summary(_ totals: MacroTotals, locale: Locale = .current) -> String {
        "\(NutritionMacroText.whole(totals.kcal, locale: locale)) kcal"
            + " · P \(NutritionMacroText.whole(totals.protein, locale: locale))"
            + " · C \(NutritionMacroText.whole(totals.carbs, locale: locale))"
            + " · F \(NutritionMacroText.whole(totals.fat, locale: locale))"
    }
}
