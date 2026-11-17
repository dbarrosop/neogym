import Foundation

/// Macro text for the Nutrition Log timeline and plan detail, so a plan and a
/// day's log read alike: each slot shows its P · C · F grams under the header,
/// and each row shows its amount and macros under the name
/// ("45 g · P 33 · C 6.8 · F 2").
public enum NutritionMacroText {
    /// Whole kcal/grams in form previews and slot headers. Keep Foundation's
    /// default rounding shared by visible values, speech and saved comparisons.
    public static func whole(_ value: Double, locale: Locale = .current) -> String {
        value.formatted(.number.precision(.fractionLength(0)).locale(locale))
    }

    /// Grams of one macro on a row: one decimal below 10 g, whole grams from
    /// 10 g, trailing zeros dropped (`6.8`, `2`, `0`, `33`).
    public static func grams(_ value: Double, locale: Locale = .current) -> String {
        let tenths = (value * 10).rounded() / 10
        let decimals = abs(tenths) < 10 ? 1 : 0
        return tenths.formatted(
            .number.precision(.fractionLength(0 ... decimals)).rounded(rule: .toNearestOrAwayFromZero).locale(locale)
        )
    }

    /// "45 g · P 33 · C 6.8 · F 2"; `amount` is the entry's grams or, for a
    /// meal, its item count.
    public static func entryCaption(amount: String?, totals: MacroTotals, locale: Locale = .current) -> String {
        let macros = [
            "P \(grams(totals.protein, locale: locale))",
            "C \(grams(totals.carbs, locale: locale))",
            "F \(grams(totals.fat, locale: locale))"
        ]
        return ([amount].compactMap { $0 } + macros).joined(separator: " · ")
    }

    /// The spoken form of `entryCaption`: "protein 33 grams, carbs 6.8
    /// grams, fat 2 grams", after `amount` when given.
    public static func entryAccessibility(amount: String?, totals: MacroTotals, locale: Locale = .current) -> String {
        let macros = [
            "protein \(grams(totals.protein, locale: locale)) grams",
            "carbs \(grams(totals.carbs, locale: locale)) grams",
            "fat \(grams(totals.fat, locale: locale)) grams"
        ]
        return ([amount].compactMap { $0 } + macros).joined(separator: ", ")
    }

    /// Whole grams for a slot's line: "Protein 45 grams, carbs 106 grams,
    /// fat 6 grams".
    public static func slotAccessibility(_ totals: MacroTotals, locale: Locale = .current) -> String {
        "Protein \(whole(totals.protein, locale: locale)) grams, carbs \(whole(totals.carbs, locale: locale)) grams, "
            + "fat \(whole(totals.fat, locale: locale)) grams"
    }

    /// "3 items" for a logged meal or a plan meal row.
    public static func itemCount(_ count: Int) -> String {
        "\(count) item\(count == 1 ? "" : "s")"
    }
}
