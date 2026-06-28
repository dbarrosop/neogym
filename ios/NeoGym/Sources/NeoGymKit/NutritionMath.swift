import Foundation

public struct MacroFields: Sendable {
    public var kcalPer100g: JSONValue?
    public var fatPer100g: JSONValue?
    public var carbsPer100g: JSONValue?
    public var proteinPer100g: JSONValue?
    public var fiberPer100g: JSONValue?
    public var sugarPer100g: JSONValue?

    public init(
        kcalPer100g: JSONValue? = nil,
        fatPer100g: JSONValue? = nil,
        carbsPer100g: JSONValue? = nil,
        proteinPer100g: JSONValue? = nil,
        fiberPer100g: JSONValue? = nil,
        sugarPer100g: JSONValue? = nil
    ) {
        self.kcalPer100g = kcalPer100g
        self.fatPer100g = fatPer100g
        self.carbsPer100g = carbsPer100g
        self.proteinPer100g = proteinPer100g
        self.fiberPer100g = fiberPer100g
        self.sugarPer100g = sugarPer100g
    }
}

public struct NormalizedMacros: Sendable, Equatable {
    public var kcalPer100g: Double
    public var fatPer100g: Double
    public var carbsPer100g: Double
    public var proteinPer100g: Double
    public var fiberPer100g: Double
    public var sugarPer100g: Double

    public init(
        kcalPer100g: Double,
        fatPer100g: Double,
        carbsPer100g: Double,
        proteinPer100g: Double,
        fiberPer100g: Double,
        sugarPer100g: Double
    ) {
        self.kcalPer100g = kcalPer100g
        self.fatPer100g = fatPer100g
        self.carbsPer100g = carbsPer100g
        self.proteinPer100g = proteinPer100g
        self.fiberPer100g = fiberPer100g
        self.sugarPer100g = sugarPer100g
    }
}

public struct MacroTotals: Sendable, Equatable {
    public var kcal: Double
    public var fat: Double
    public var carbs: Double
    public var protein: Double
    public var fiber: Double
    public var sugar: Double

    public init(kcal: Double, fat: Double, carbs: Double, protein: Double, fiber: Double, sugar: Double) {
        self.kcal = kcal
        self.fat = fat
        self.carbs = carbs
        self.protein = protein
        self.fiber = fiber
        self.sugar = sugar
    }

    public static let empty = MacroTotals(kcal: 0, fat: 0, carbs: 0, protein: 0, fiber: 0, sugar: 0)
}

public struct MealTotalIngredient: Sendable {
    public var grams: JSONValue?
    public var food: MacroFields?

    public init(grams: JSONValue?, food: MacroFields?) {
        self.grams = grams
        self.food = food
    }
}

public struct PlanTotalSlot: Sendable {
    public var mealIngredients: [MealTotalIngredient]?

    public init(mealIngredients: [MealTotalIngredient]?) {
        self.mealIngredients = mealIngredients
    }
}

public struct LoggedSnapshotEntry: Sendable {
    public var grams: JSONValue?
    public var snapshotKcalPer100g: JSONValue?
    public var snapshotFatPer100g: JSONValue?
    public var snapshotCarbsPer100g: JSONValue?
    public var snapshotProteinPer100g: JSONValue?
    public var snapshotFiberPer100g: JSONValue?
    public var snapshotSugarPer100g: JSONValue?

    public init(
        grams: JSONValue?,
        snapshotKcalPer100g: JSONValue?,
        snapshotFatPer100g: JSONValue?,
        snapshotCarbsPer100g: JSONValue?,
        snapshotProteinPer100g: JSONValue?,
        snapshotFiberPer100g: JSONValue?,
        snapshotSugarPer100g: JSONValue?
    ) {
        self.grams = grams
        self.snapshotKcalPer100g = snapshotKcalPer100g
        self.snapshotFatPer100g = snapshotFatPer100g
        self.snapshotCarbsPer100g = snapshotCarbsPer100g
        self.snapshotProteinPer100g = snapshotProteinPer100g
        self.snapshotFiberPer100g = snapshotFiberPer100g
        self.snapshotSugarPer100g = snapshotSugarPer100g
    }
}

public enum NutritionMath {
    public static let decimalInputPattern = "[0-9]*[.,]?[0-9]*"

    public static func normalizeNumeric(_ value: JSONValue?) -> Double {
        guard let value else { return 0 }
        switch value {
        case let .number(number):
            return number.isFinite ? number : 0
        case let .string(string):
            let parsed = Double(normalizeDecimalInput(string))
            return parsed?.isFinite == true ? parsed ?? 0 : 0
        default:
            return 0
        }
    }

    public static func normalizeMacros(_ input: MacroFields) -> NormalizedMacros {
        NormalizedMacros(
            kcalPer100g: normalizeNumeric(input.kcalPer100g),
            fatPer100g: normalizeNumeric(input.fatPer100g),
            carbsPer100g: normalizeNumeric(input.carbsPer100g),
            proteinPer100g: normalizeNumeric(input.proteinPer100g),
            fiberPer100g: normalizeNumeric(input.fiberPer100g),
            sugarPer100g: normalizeNumeric(input.sugarPer100g)
        )
    }

    public static func parseMacroInput(_ value: String) -> Double? {
        let normalized = normalizeDecimalInput(value)
        guard !normalized.isEmpty, let parsed = Double(normalized), parsed.isFinite, parsed >= 0 else {
            return nil
        }
        return parsed
    }

    public static func formatMacro(_ value: JSONValue?, unit: String, locale: Locale = .current) -> String {
        formatMacro(normalizeNumeric(value), unit: unit, locale: locale)
    }

    public static func formatMacro(_ value: Double, unit: String, locale: Locale = .current) -> String {
        let formatter = NumberFormatter()
        formatter.locale = locale
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = value.rounded() == value ? 0 : 1
        formatter.minimumFractionDigits = 0
        formatter.roundingMode = .halfUp
        let formatted = formatter.string(from: NSNumber(value: value)) ?? String(value)
        return "\(formatted) \(unit)"
    }

    public static func macrosForGrams(input: MacroFields, grams: JSONValue?) -> MacroTotals {
        let macros = normalizeMacros(input)
        let multiplier = normalizeNumeric(grams) / 100
        return MacroTotals(
            kcal: macros.kcalPer100g * multiplier,
            fat: macros.fatPer100g * multiplier,
            carbs: macros.carbsPer100g * multiplier,
            protein: macros.proteinPer100g * multiplier,
            fiber: macros.fiberPer100g * multiplier,
            sugar: macros.sugarPer100g * multiplier
        )
    }

    public static func addMacroTotals(_ left: MacroTotals, _ right: MacroTotals) -> MacroTotals {
        MacroTotals(
            kcal: left.kcal + right.kcal,
            fat: left.fat + right.fat,
            carbs: left.carbs + right.carbs,
            protein: left.protein + right.protein,
            fiber: left.fiber + right.fiber,
            sugar: left.sugar + right.sugar
        )
    }

    public static func mealMacroTotals(_ ingredients: [MealTotalIngredient]) -> MacroTotals {
        ingredients.reduce(.empty) { total, ingredient in
            guard let food = ingredient.food else { return total }
            return addMacroTotals(total, macrosForGrams(input: food, grams: ingredient.grams))
        }
    }

    public static func planMacroTotals(_ slots: [PlanTotalSlot]) -> MacroTotals {
        slots.reduce(.empty) { total, slot in
            guard let ingredients = slot.mealIngredients else { return total }
            return addMacroTotals(total, mealMacroTotals(ingredients))
        }
    }

    public static func loggedEntryMacroTotals(_ entry: LoggedSnapshotEntry) -> MacroTotals {
        macrosForGrams(
            input: MacroFields(
                kcalPer100g: entry.snapshotKcalPer100g,
                fatPer100g: entry.snapshotFatPer100g,
                carbsPer100g: entry.snapshotCarbsPer100g,
                proteinPer100g: entry.snapshotProteinPer100g,
                fiberPer100g: entry.snapshotFiberPer100g,
                sugarPer100g: entry.snapshotSugarPer100g
            ),
            grams: entry.grams
        )
    }

    public static func loggedMacroTotals(_ entries: [LoggedSnapshotEntry]) -> MacroTotals {
        entries.reduce(.empty) { total, entry in
            addMacroTotals(total, loggedEntryMacroTotals(entry))
        }
    }

    public static func macroTotalsSummary(_ totals: MacroTotals, locale: Locale = .current) -> String {
        [
            formatMacro(totals.kcal, unit: "kcal", locale: locale),
            "\(formatMacro(totals.fat, unit: "g", locale: locale)) fat",
            "\(formatMacro(totals.carbs, unit: "g", locale: locale)) carbs",
            "\(formatMacro(totals.protein, unit: "g", locale: locale)) protein",
            "\(formatMacro(totals.fiber, unit: "g", locale: locale)) fiber",
            "\(formatMacro(totals.sugar, unit: "g", locale: locale)) sugar"
        ].joined(separator: " · ")
    }

    public static func macroSummary(_ input: MacroFields, locale: Locale = .current) -> String {
        let macros = normalizeMacros(input)
        return [
            formatMacro(macros.kcalPer100g, unit: "kcal", locale: locale),
            "\(formatMacro(macros.fatPer100g, unit: "g", locale: locale)) fat",
            "\(formatMacro(macros.carbsPer100g, unit: "g", locale: locale)) carbs",
            "\(formatMacro(macros.proteinPer100g, unit: "g", locale: locale)) protein",
            "\(formatMacro(macros.fiberPer100g, unit: "g", locale: locale)) fiber",
            "\(formatMacro(macros.sugarPer100g, unit: "g", locale: locale)) sugar"
        ].joined(separator: " · ")
    }

    public static func isFoodInUseError(_ errorMessage: String) -> Bool {
        let message = errorMessage.lowercased()
        return message.contains("foreign key")
            || message.contains("meal_ingredients")
            || message.contains("nutrition_log_entries")
            || message.contains("violates constraint")
    }

    public static func isMealInUseByPlanError(_ errorMessage: String) -> Bool {
        let message = errorMessage.lowercased()
        return message.contains("foreign key")
            || message.contains("nutrition_plan_meals")
            || message.contains("violates constraint")
    }

    private static func normalizeDecimalInput(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ",", with: ".")
    }
}
