import Combine
import Foundation

public struct MealIngredient: Decodable, Identifiable, Sendable, Equatable {
    public let id: String
    public let mealId: String?
    public let foodId: String
    public let grams: JSONValue
    public let position: Int
    public let food: Food?

    public init(id: String, mealId: String? = nil, foodId: String, grams: JSONValue, position: Int, food: Food? = nil) {
        self.id = id
        self.mealId = mealId
        self.foodId = foodId
        self.grams = grams
        self.position = position
        self.food = food
    }
}

public struct Meal: Decodable, Identifiable, Sendable, Equatable {
    public let id: String
    public let name: String
    public let description: String?
    public let createdAt: String?
    public let updatedAt: String?
    public let mealIngredients: [MealIngredient]

    public init(
        id: String,
        name: String,
        description: String? = nil,
        createdAt: String? = nil,
        updatedAt: String? = nil,
        mealIngredients: [MealIngredient] = []
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.mealIngredients = mealIngredients
    }

    public var macroTotals: MacroTotals {
        NutritionMath.mealMacroTotals(mealIngredients.map { ingredient in
            MealTotalIngredient(grams: ingredient.grams, food: ingredient.food?.macroFields)
        })
    }
}

public struct MealIndexPayload: Sendable, Equatable {
    public let meals: [Meal]

    public init(meals: [Meal]) {
        self.meals = meals
    }
}

public struct MealEditPayload: Sendable, Equatable {
    public let meal: Meal?
    public let foods: [Food]

    public init(meal: Meal?, foods: [Food]) {
        self.meal = meal
        self.foods = foods
    }
}

public struct MealIngredientFormValues: Identifiable, Sendable, Equatable {
    public let id: String?
    public let clientId: String
    public let foodId: String
    public let grams: String
    public let position: Int

    public var stableId: String { id ?? clientId }

    public init(id: String? = nil, clientId: String = UUID().uuidString, foodId: String, grams: String, position: Int) {
        self.id = id
        self.clientId = clientId
        self.foodId = foodId
        self.grams = grams
        self.position = position
    }

    public static func == (lhs: MealIngredientFormValues, rhs: MealIngredientFormValues) -> Bool {
        lhs.id == rhs.id
            && lhs.foodId == rhs.foodId
            && lhs.grams == rhs.grams
            && lhs.position == rhs.position
    }
}

public struct MealFormValues: Sendable, Equatable {
    public let name: String
    public let description: String
    public let ingredients: [MealIngredientFormValues]

    public init(name: String, description: String, ingredients: [MealIngredientFormValues]) {
        self.name = name
        self.description = description
        self.ingredients = ingredients
    }

    public static let empty = MealFormValues(name: "", description: "", ingredients: [])
}

public enum MealFormValidationResult: Sendable, Equatable {
    case success(MealFormValues)
    case failure(String)
}

public enum MealFormValidation {
    public static func validate(_ values: MealFormValues, availableFoods: [Food]) -> MealFormValidationResult {
        let name = values.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return .failure("Name is required.") }
        guard name.count <= 160 else { return .failure("Name must be 160 characters or less.") }
        let description = values.description.trimmingCharacters(in: .whitespacesAndNewlines)
        guard description.count <= 1_000 else { return .failure("Description must be 1000 characters or less.") }
        guard !values.ingredients.isEmpty else { return .failure("Add at least one food to this meal.") }

        let foodIds = Set(availableFoods.map(\.id))
        var normalizedIngredients: [MealIngredientFormValues] = []
        for (index, ingredient) in values.ingredients.enumerated() {
            guard !ingredient.foodId.isEmpty, foodIds.contains(ingredient.foodId) else {
                return .failure("Every ingredient needs a selected food.")
            }
            let grams = FoodFormValidation.normalizeDecimalInput(ingredient.grams)
            guard let parsed = NutritionMath.parseMacroInput(grams), parsed > 0 else {
                return .failure("Ingredient grams must be greater than zero.")
            }
            normalizedIngredients.append(MealIngredientFormValues(
                id: ingredient.id,
                clientId: ingredient.clientId,
                foodId: ingredient.foodId,
                grams: grams,
                position: index
            ))
        }

        return .success(MealFormValues(name: name, description: description, ingredients: normalizedIngredients))
    }
}

@MainActor
public final class MealFormModel: ObservableObject {
    @Published public var name: String
    @Published public var mealDescription: String
    @Published public var ingredients: [MealIngredientFormValues]
    @Published public private(set) var errorMessage: String?

    public init(initialValues: MealFormValues) {
        name = initialValues.name
        mealDescription = initialValues.description
        ingredients = initialValues.ingredients.sorted { left, right in
            if left.position == right.position { return left.stableId < right.stableId }
            return left.position < right.position
        }
    }

    public var canSubmit: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !ingredients.isEmpty
    }

    public func addIngredient(foodId: String = "", grams: String = "100") {
        ingredients.append(MealIngredientFormValues(foodId: foodId, grams: grams, position: ingredients.count))
        renumber()
    }

    public func removeIngredient(stableId: String) {
        ingredients.removeAll { $0.stableId == stableId }
        renumber()
    }

    public func updateIngredient(stableId: String, foodId: String? = nil, grams: String? = nil) {
        ingredients = ingredients.map { ingredient in
            guard ingredient.stableId == stableId else { return ingredient }
            return MealIngredientFormValues(
                id: ingredient.id,
                clientId: ingredient.clientId,
                foodId: foodId ?? ingredient.foodId,
                grams: grams ?? ingredient.grams,
                position: ingredient.position
            )
        }
        renumber()
    }

    public func moveIngredient(stableId: String, direction: Int) {
        guard let index = ingredients.firstIndex(where: { $0.stableId == stableId }) else { return }
        let target = index + direction
        guard target >= 0, target < ingredients.count else { return }
        let item = ingredients.remove(at: index)
        ingredients.insert(item, at: target)
        renumber()
    }

    public func valuesForSubmit(availableFoods: [Food]) -> MealFormValues? {
        switch MealFormValidation.validate(
            MealFormValues(name: name, description: mealDescription, ingredients: ingredients),
            availableFoods: availableFoods
        ) {
        case let .success(values):
            errorMessage = nil
            return values
        case let .failure(message):
            errorMessage = message
            return nil
        }
    }

    public func macroTotals(availableFoods: [Food]) -> MacroTotals {
        let byId = Dictionary(uniqueKeysWithValues: availableFoods.map { ($0.id, $0) })
        return NutritionMath.mealMacroTotals(ingredients.map { ingredient in
            MealTotalIngredient(
                grams: .string(ingredient.grams),
                food: byId[ingredient.foodId]?.macroFields
            )
        })
    }

    public static func values(from meal: Meal) -> MealFormValues {
        MealFormValues(
            name: meal.name,
            description: meal.description ?? "",
            ingredients: meal.mealIngredients.sorted { left, right in
                if left.position == right.position { return left.id < right.id }
                return left.position < right.position
            }.map { ingredient in
                MealIngredientFormValues(
                    id: ingredient.id,
                    foodId: ingredient.foodId,
                    grams: formatEditable(NutritionMath.normalizeNumeric(ingredient.grams)),
                    position: ingredient.position
                )
            }
        )
    }

    private func renumber() {
        ingredients = ingredients.enumerated().map { index, ingredient in
            MealIngredientFormValues(
                id: ingredient.id,
                clientId: ingredient.clientId,
                foodId: ingredient.foodId,
                grams: ingredient.grams,
                position: index
            )
        }
    }

    private static func formatEditable(_ value: Double) -> String {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 3
        formatter.usesGroupingSeparator = false
        return formatter.string(from: NSNumber(value: value)) ?? String(value)
    }
}
