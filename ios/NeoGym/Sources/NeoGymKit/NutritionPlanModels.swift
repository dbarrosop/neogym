import Combine
import Foundation

public struct NutritionPlanMealSlot: Decodable, Identifiable, Sendable, Equatable {
    public let id: String
    public let nutritionPlanId: String?
    public let mealId: String
    public let slotTime: String
    public let label: String?
    public let position: Int
    public let meal: Meal?

    public init(
        id: String,
        nutritionPlanId: String? = nil,
        mealId: String,
        slotTime: String,
        label: String? = nil,
        position: Int,
        meal: Meal? = nil
    ) {
        self.id = id
        self.nutritionPlanId = nutritionPlanId
        self.mealId = mealId
        self.slotTime = slotTime
        self.label = label
        self.position = position
        self.meal = meal
    }

    public var displayLabel: String {
        guard let label = label?.trimmingCharacters(in: .whitespacesAndNewlines), !label.isEmpty else {
            return meal?.name ?? "Meal"
        }
        return label
    }

    public var macroTotals: MacroTotals {
        meal?.macroTotals ?? .empty
    }
}

public struct NutritionPlan: Decodable, Identifiable, Sendable, Equatable {
    public let id: String
    public let userId: String?
    public let name: String
    public let description: String?
    public let createdAt: String?
    public let updatedAt: String?
    public let nutritionPlanMeals: [NutritionPlanMealSlot]

    public init(
        id: String,
        userId: String? = nil,
        name: String,
        description: String? = nil,
        createdAt: String? = nil,
        updatedAt: String? = nil,
        nutritionPlanMeals: [NutritionPlanMealSlot] = []
    ) {
        self.id = id
        self.userId = userId
        self.name = name
        self.description = description
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.nutritionPlanMeals = nutritionPlanMeals
    }

    public var sortedSlots: [NutritionPlanMealSlot] {
        nutritionPlanMeals.sorted { left, right in
            let leftTime = IntakeGrouping.timeToInputValue(left.slotTime)
            let rightTime = IntakeGrouping.timeToInputValue(right.slotTime)
            if leftTime != rightTime { return leftTime < rightTime }
            if left.position != right.position { return left.position < right.position }
            return left.id < right.id
        }
    }

    public var macroTotals: MacroTotals {
        NutritionMath.planMacroTotals(nutritionPlanMeals.map { slot in
            PlanTotalSlot(mealIngredients: slot.meal?.mealIngredients.map { ingredient in
                MealTotalIngredient(grams: ingredient.grams, food: ingredient.food?.macroFields)
            })
        })
    }
}

public struct NutritionPlanEditPayload: Sendable, Equatable {
    public let plan: NutritionPlan?
    public let meals: [Meal]

    public init(plan: NutritionPlan?, meals: [Meal]) {
        self.plan = plan
        self.meals = meals
    }
}

public struct NutritionPlanSlotFormValues: Identifiable, Sendable, Equatable {
    public let id: String?
    public let clientId: String
    public let mealId: String
    public let slotTime: String
    public let label: String
    public let position: Int

    public var stableId: String { id ?? clientId }

    public init(
        id: String? = nil,
        clientId: String = UUID().uuidString,
        mealId: String,
        slotTime: String,
        label: String,
        position: Int
    ) {
        self.id = id
        self.clientId = clientId
        self.mealId = mealId
        self.slotTime = slotTime
        self.label = label
        self.position = position
    }

    public static func == (lhs: NutritionPlanSlotFormValues, rhs: NutritionPlanSlotFormValues) -> Bool {
        lhs.id == rhs.id
            && lhs.mealId == rhs.mealId
            && lhs.slotTime == rhs.slotTime
            && lhs.label == rhs.label
            && lhs.position == rhs.position
    }
}

public struct NutritionPlanFormValues: Sendable, Equatable {
    public let name: String
    public let description: String
    public let slots: [NutritionPlanSlotFormValues]

    public init(name: String, description: String, slots: [NutritionPlanSlotFormValues]) {
        self.name = name
        self.description = description
        self.slots = slots
    }

    public static let empty = NutritionPlanFormValues(name: "", description: "", slots: [])
}

public enum NutritionPlanFormValidationResult: Sendable, Equatable {
    case success(NutritionPlanFormValues)
    case failure(String)
}

public enum NutritionPlanFormValidation {
    public static func validate(
        _ values: NutritionPlanFormValues,
        availableMeals: [Meal]
    ) -> NutritionPlanFormValidationResult {
        let name = values.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return .failure("Name is required.") }
        guard name.count <= 160 else { return .failure("Name must be 160 characters or less.") }
        let description = values.description.trimmingCharacters(in: .whitespacesAndNewlines)
        guard description.count <= 1_000 else { return .failure("Description must be 1000 characters or less.") }
        guard !values.slots.isEmpty else { return .failure("Add at least one meal slot to this plan.") }

        let mealIds = Set(availableMeals.map(\.id))
        var normalizedSlots: [NutritionPlanSlotFormValues] = []
        for slot in values.slots {
            guard !slot.mealId.isEmpty, mealIds.contains(slot.mealId) else {
                return .failure("Every slot needs a selected meal.")
            }
            let slotTime = IntakeGrouping.timeToInputValue(slot.slotTime)
            guard !slotTime.isEmpty else { return .failure("Every slot needs a time of day.") }
            let label = slot.label.trimmingCharacters(in: .whitespacesAndNewlines)
            guard label.count <= 160 else { return .failure("Slot labels must be 160 characters or less.") }
            normalizedSlots.append(NutritionPlanSlotFormValues(
                id: slot.id,
                clientId: slot.clientId,
                mealId: slot.mealId,
                slotTime: slotTime,
                label: label,
                position: slot.position
            ))
        }

        let sortedSlots = normalizedSlots.enumerated()
            .map { index, slot in
                NutritionPlanSlotFormValues(
                    id: slot.id,
                    clientId: slot.clientId,
                    mealId: slot.mealId,
                    slotTime: slot.slotTime,
                    label: slot.label,
                    position: index
                )
            }
            .sorted { left, right in
                if left.slotTime != right.slotTime { return left.slotTime < right.slotTime }
                if left.position != right.position { return left.position < right.position }
                return left.stableId < right.stableId
            }
            .enumerated()
            .map { index, slot in
                NutritionPlanSlotFormValues(
                    id: slot.id,
                    clientId: slot.clientId,
                    mealId: slot.mealId,
                    slotTime: slot.slotTime,
                    label: slot.label,
                    position: index
                )
            }

        return .success(NutritionPlanFormValues(name: name, description: description, slots: sortedSlots))
    }
}

@MainActor
public final class NutritionPlanFormModel: ObservableObject {
    @Published public var name: String
    @Published public var planDescription: String
    @Published public var slots: [NutritionPlanSlotFormValues]
    @Published public private(set) var errorMessage: String?

    public init(initialValues: NutritionPlanFormValues) {
        name = initialValues.name
        planDescription = initialValues.description
        slots = initialValues.slots.sorted { left, right in
            let leftTime = IntakeGrouping.timeToInputValue(left.slotTime)
            let rightTime = IntakeGrouping.timeToInputValue(right.slotTime)
            if leftTime != rightTime { return leftTime < rightTime }
            if left.position != right.position { return left.position < right.position }
            return left.stableId < right.stableId
        }
        renumber()
    }

    public var canSubmit: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !slots.isEmpty
    }

    public func addSlot(mealId: String = "", slotTime: String = "12:00", label: String = "") {
        slots.append(NutritionPlanSlotFormValues(
            mealId: mealId,
            slotTime: slotTime,
            label: label,
            position: slots.count
        ))
        renumber()
    }

    public func removeSlot(stableId: String) {
        slots.removeAll { $0.stableId == stableId }
        renumber()
    }

    public func updateSlot(stableId: String, mealId: String? = nil, slotTime: String? = nil, label: String? = nil) {
        slots = slots.map { slot in
            guard slot.stableId == stableId else { return slot }
            return NutritionPlanSlotFormValues(
                id: slot.id,
                clientId: slot.clientId,
                mealId: mealId ?? slot.mealId,
                slotTime: slotTime ?? slot.slotTime,
                label: label ?? slot.label,
                position: slot.position
            )
        }
        renumber()
    }

    public func moveSlot(stableId: String, direction: Int) {
        guard let index = slots.firstIndex(where: { $0.stableId == stableId }) else { return }
        let target = index + direction
        guard target >= 0, target < slots.count else { return }
        let item = slots.remove(at: index)
        slots.insert(item, at: target)
        renumber()
    }

    public func valuesForSubmit(availableMeals: [Meal]) -> NutritionPlanFormValues? {
        switch NutritionPlanFormValidation.validate(
            NutritionPlanFormValues(name: name, description: planDescription, slots: slots),
            availableMeals: availableMeals
        ) {
        case let .success(values):
            errorMessage = nil
            return values
        case let .failure(message):
            errorMessage = message
            return nil
        }
    }

    public func macroTotals(availableMeals: [Meal]) -> MacroTotals {
        let byId = Dictionary(uniqueKeysWithValues: availableMeals.map { ($0.id, $0) })
        return NutritionMath.planMacroTotals(slots.map { slot in
            PlanTotalSlot(mealIngredients: byId[slot.mealId]?.mealIngredients.map { ingredient in
                MealTotalIngredient(grams: ingredient.grams, food: ingredient.food?.macroFields)
            })
        })
    }

    public static func values(from plan: NutritionPlan) -> NutritionPlanFormValues {
        NutritionPlanFormValues(
            name: plan.name,
            description: plan.description ?? "",
            slots: plan.sortedSlots.map { slot in
                NutritionPlanSlotFormValues(
                    id: slot.id,
                    mealId: slot.mealId,
                    slotTime: IntakeGrouping.timeToInputValue(slot.slotTime),
                    label: slot.label ?? "",
                    position: slot.position
                )
            }
        )
    }

    private func renumber() {
        slots = slots.enumerated().map { index, slot in
            NutritionPlanSlotFormValues(
                id: slot.id,
                clientId: slot.clientId,
                mealId: slot.mealId,
                slotTime: slot.slotTime,
                label: slot.label,
                position: index
            )
        }
    }
}
