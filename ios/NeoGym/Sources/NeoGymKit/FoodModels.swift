import Combine
import Foundation

public enum FoodVisibilityFilter: String, CaseIterable, Sendable, Equatable {
    case mine
    case publicFood

    public var title: String {
        switch self {
        case .mine: "Mine"
        case .publicFood: "Public"
        }
    }
}

public struct Food: Decodable, Identifiable, Sendable, Equatable {
    public let id: String
    public let name: String
    public let userId: String?
    public let isPublic: Bool
    public let kcalPer100g: JSONValue
    public let fatPer100g: JSONValue
    public let carbsPer100g: JSONValue
    public let proteinPer100g: JSONValue
    public let fiberPer100g: JSONValue
    public let sugarPer100g: JSONValue
    public let createdAt: String?
    public let updatedAt: String?

    public init(
        id: String,
        name: String,
        userId: String? = nil,
        isPublic: Bool,
        kcalPer100g: JSONValue,
        fatPer100g: JSONValue,
        carbsPer100g: JSONValue,
        proteinPer100g: JSONValue,
        fiberPer100g: JSONValue,
        sugarPer100g: JSONValue,
        createdAt: String? = nil,
        updatedAt: String? = nil
    ) {
        self.id = id
        self.name = name
        self.userId = userId
        self.isPublic = isPublic
        self.kcalPer100g = kcalPer100g
        self.fatPer100g = fatPer100g
        self.carbsPer100g = carbsPer100g
        self.proteinPer100g = proteinPer100g
        self.fiberPer100g = fiberPer100g
        self.sugarPer100g = sugarPer100g
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    public var macroFields: MacroFields {
        MacroFields(
            kcalPer100g: kcalPer100g,
            fatPer100g: fatPer100g,
            carbsPer100g: carbsPer100g,
            proteinPer100g: proteinPer100g,
            fiberPer100g: fiberPer100g,
            sugarPer100g: sugarPer100g
        )
    }

    public func canEdit(currentUserId: String?) -> Bool {
        guard let currentUserId else { return false }
        return userId == currentUserId && !isPublic
    }
}

public struct FoodFormValues: Sendable, Equatable {
    public let name: String
    public let kcalPer100g: String
    public let fatPer100g: String
    public let carbsPer100g: String
    public let proteinPer100g: String
    public let fiberPer100g: String
    public let sugarPer100g: String

    public init(
        name: String,
        kcalPer100g: String,
        fatPer100g: String,
        carbsPer100g: String,
        proteinPer100g: String,
        fiberPer100g: String,
        sugarPer100g: String
    ) {
        self.name = name
        self.kcalPer100g = kcalPer100g
        self.fatPer100g = fatPer100g
        self.carbsPer100g = carbsPer100g
        self.proteinPer100g = proteinPer100g
        self.fiberPer100g = fiberPer100g
        self.sugarPer100g = sugarPer100g
    }

    public static let empty = FoodFormValues(
        name: "",
        kcalPer100g: "0",
        fatPer100g: "0",
        carbsPer100g: "0",
        proteinPer100g: "0",
        fiberPer100g: "0",
        sugarPer100g: "0"
    )
}

public enum FoodFormValidationResult: Sendable, Equatable {
    case success(FoodFormValues)
    case failure(String)
}

public enum FoodFormValidation {
    public static func validate(_ values: FoodFormValues) -> FoodFormValidationResult {
        let name = values.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return .failure("Name is required.") }
        guard name.count <= 160 else { return .failure("Name must be 160 characters or less.") }

        let parsed = nutrientPairs(values).map { label, value in
            (label, normalizeDecimalInput(value), NutritionMath.parseMacroInput(value))
        }
        if let invalid = parsed.first(where: { $0.2 == nil }) {
            return .failure("\(invalid.0) must be zero or greater.")
        }

        return .success(FoodFormValues(
            name: name,
            kcalPer100g: parsed[0].1,
            fatPer100g: parsed[1].1,
            carbsPer100g: parsed[2].1,
            proteinPer100g: parsed[3].1,
            fiberPer100g: parsed[4].1,
            sugarPer100g: parsed[5].1
        ))
    }

    private static func nutrientPairs(_ values: FoodFormValues) -> [(String, String)] {
        [
            ("Calories", values.kcalPer100g),
            ("Fat", values.fatPer100g),
            ("Carbs", values.carbsPer100g),
            ("Protein", values.proteinPer100g),
            ("Fiber", values.fiberPer100g),
            ("Sugar", values.sugarPer100g)
        ]
    }

    public static func normalizeDecimalInput(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ",", with: ".")
    }
}

@MainActor
public final class FoodFormModel: ObservableObject {
    @Published public var name: String
    @Published public var kcalPer100g: String
    @Published public var fatPer100g: String
    @Published public var carbsPer100g: String
    @Published public var proteinPer100g: String
    @Published public var fiberPer100g: String
    @Published public var sugarPer100g: String
    @Published public private(set) var errorMessage: String?

    public init(initialValues: FoodFormValues) {
        name = initialValues.name
        kcalPer100g = initialValues.kcalPer100g
        fatPer100g = initialValues.fatPer100g
        carbsPer100g = initialValues.carbsPer100g
        proteinPer100g = initialValues.proteinPer100g
        fiberPer100g = initialValues.fiberPer100g
        sugarPer100g = initialValues.sugarPer100g
    }

    public var canSubmit: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    public func valuesForSubmit() -> FoodFormValues? {
        switch FoodFormValidation.validate(FoodFormValues(
            name: name,
            kcalPer100g: kcalPer100g,
            fatPer100g: fatPer100g,
            carbsPer100g: carbsPer100g,
            proteinPer100g: proteinPer100g,
            fiberPer100g: fiberPer100g,
            sugarPer100g: sugarPer100g
        )) {
        case let .success(values):
            errorMessage = nil
            return values
        case let .failure(message):
            errorMessage = message
            return nil
        }
    }

    public static func values(from food: Food) -> FoodFormValues {
        let macros = NutritionMath.normalizeMacros(food.macroFields)
        return FoodFormValues(
            name: food.name,
            kcalPer100g: formatEditable(macros.kcalPer100g),
            fatPer100g: formatEditable(macros.fatPer100g),
            carbsPer100g: formatEditable(macros.carbsPer100g),
            proteinPer100g: formatEditable(macros.proteinPer100g),
            fiberPer100g: formatEditable(macros.fiberPer100g),
            sugarPer100g: formatEditable(macros.sugarPer100g)
        )
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
