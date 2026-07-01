import Combine
import Foundation

public enum NutritionPlanEntryKind: String, Sendable, Equatable {
    case food
    case meal
}

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

public struct NutritionPlanFoodSlot: Decodable, Identifiable, Sendable, Equatable {
    public let id: String
    public let nutritionPlanId: String?
    public let foodId: String
    public let grams: JSONValue
    public let slotTime: String
    public let label: String?
    public let position: Int
    public let food: Food?

    public init(
        id: String,
        nutritionPlanId: String? = nil,
        foodId: String,
        grams: JSONValue,
        slotTime: String,
        label: String? = nil,
        position: Int,
        food: Food? = nil
    ) {
        self.id = id
        self.nutritionPlanId = nutritionPlanId
        self.foodId = foodId
        self.grams = grams
        self.slotTime = slotTime
        self.label = label
        self.position = position
        self.food = food
    }

    public var displayLabel: String {
        guard let label = label?.trimmingCharacters(in: .whitespacesAndNewlines), !label.isEmpty else {
            return food?.name ?? "Food"
        }
        return label
    }

    public var macroTotals: MacroTotals {
        guard let food else { return .empty }
        return NutritionMath.macrosForGrams(input: food.macroFields, grams: grams)
    }
}

public enum NutritionPlanEntry: Identifiable, Sendable, Equatable {
    case food(NutritionPlanFoodSlot)
    case meal(NutritionPlanMealSlot)

    public var id: String {
        switch self {
        case let .food(slot): slot.id
        case let .meal(slot): slot.id
        }
    }

    public var kind: NutritionPlanEntryKind {
        switch self {
        case .food: .food
        case .meal: .meal
        }
    }

    public var slotTime: String {
        switch self {
        case let .food(slot): slot.slotTime
        case let .meal(slot): slot.slotTime
        }
    }

    public var label: String? {
        switch self {
        case let .food(slot): slot.label
        case let .meal(slot): slot.label
        }
    }

    public var position: Int {
        switch self {
        case let .food(slot): slot.position
        case let .meal(slot): slot.position
        }
    }

    public var displayLabel: String {
        switch self {
        case let .food(slot): slot.displayLabel
        case let .meal(slot): slot.displayLabel
        }
    }

    public var macroTotals: MacroTotals {
        switch self {
        case let .food(slot): slot.macroTotals
        case let .meal(slot): slot.macroTotals
        }
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
    public let nutritionPlanFoods: [NutritionPlanFoodSlot]

    public init(
        id: String,
        userId: String? = nil,
        name: String,
        description: String? = nil,
        createdAt: String? = nil,
        updatedAt: String? = nil,
        nutritionPlanMeals: [NutritionPlanMealSlot] = [],
        nutritionPlanFoods: [NutritionPlanFoodSlot] = []
    ) {
        self.id = id
        self.userId = userId
        self.name = name
        self.description = description
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.nutritionPlanMeals = nutritionPlanMeals
        self.nutritionPlanFoods = nutritionPlanFoods
    }

    public var sortedSlots: [NutritionPlanMealSlot] {
        nutritionPlanMeals.sorted { left, right in
            NutritionMath.mixedPlanEntrySortsBefore(
                leftSlotTime: left.slotTime,
                leftPosition: left.position,
                leftKind: NutritionPlanEntryKind.meal.rawValue,
                leftId: left.id,
                rightSlotTime: right.slotTime,
                rightPosition: right.position,
                rightKind: NutritionPlanEntryKind.meal.rawValue,
                rightId: right.id
            )
        }
    }

    public var sortedFoodSlots: [NutritionPlanFoodSlot] {
        nutritionPlanFoods.sorted { left, right in
            NutritionMath.mixedPlanEntrySortsBefore(
                leftSlotTime: left.slotTime,
                leftPosition: left.position,
                leftKind: NutritionPlanEntryKind.food.rawValue,
                leftId: left.id,
                rightSlotTime: right.slotTime,
                rightPosition: right.position,
                rightKind: NutritionPlanEntryKind.food.rawValue,
                rightId: right.id
            )
        }
    }

    public var sortedEntries: [NutritionPlanEntry] {
        (nutritionPlanFoods.map(NutritionPlanEntry.food) + nutritionPlanMeals.map(NutritionPlanEntry.meal)).sorted { left, right in
            NutritionMath.mixedPlanEntrySortsBefore(
                leftSlotTime: left.slotTime,
                leftPosition: left.position,
                leftKind: left.kind.rawValue,
                leftId: left.id,
                rightSlotTime: right.slotTime,
                rightPosition: right.position,
                rightKind: right.kind.rawValue,
                rightId: right.id
            )
        }
    }

    public var macroTotals: MacroTotals {
        NutritionMath.mixedPlanMacroTotals(
            mealSlots: nutritionPlanMeals.map { slot in
                PlanTotalSlot(mealIngredients: slot.meal?.mealIngredients.map { ingredient in
                    MealTotalIngredient(grams: ingredient.grams, food: ingredient.food?.macroFields)
                })
            },
            foodSlots: nutritionPlanFoods.map { slot in
                PlanFoodTotalSlot(grams: slot.grams, food: slot.food?.macroFields)
            }
        )
    }
}

public struct NutritionPlanEditPayload: Sendable, Equatable {
    public let plan: NutritionPlan?
    public let meals: [Meal]
    public let foods: [Food]

    public init(plan: NutritionPlan?, meals: [Meal], foods: [Food] = []) {
        self.plan = plan
        self.meals = meals
        self.foods = foods
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

public struct NutritionPlanFoodSlotFormValues: Identifiable, Sendable, Equatable {
    public let id: String?
    public let clientId: String
    public let foodId: String
    public let grams: String
    public let slotTime: String
    public let label: String
    public let position: Int

    public var stableId: String { id ?? clientId }

    public init(
        id: String? = nil,
        clientId: String = UUID().uuidString,
        foodId: String,
        grams: String,
        slotTime: String,
        label: String,
        position: Int
    ) {
        self.id = id
        self.clientId = clientId
        self.foodId = foodId
        self.grams = grams
        self.slotTime = slotTime
        self.label = label
        self.position = position
    }

    public static func == (lhs: NutritionPlanFoodSlotFormValues, rhs: NutritionPlanFoodSlotFormValues) -> Bool {
        lhs.id == rhs.id
            && lhs.foodId == rhs.foodId
            && lhs.grams == rhs.grams
            && lhs.slotTime == rhs.slotTime
            && lhs.label == rhs.label
            && lhs.position == rhs.position
    }
}

public enum NutritionPlanDraftEntry: Identifiable, Sendable, Equatable {
    case meal(NutritionPlanSlotFormValues)
    case food(NutritionPlanFoodSlotFormValues)

    public var id: String { stableId }

    public var stableId: String {
        switch self {
        case let .meal(slot): slot.stableId
        case let .food(slot): slot.stableId
        }
    }

    public var kind: NutritionPlanEntryKind {
        switch self {
        case .meal: .meal
        case .food: .food
        }
    }

    public var slotTime: String {
        switch self {
        case let .meal(slot): slot.slotTime
        case let .food(slot): slot.slotTime
        }
    }

    public var position: Int {
        switch self {
        case let .meal(slot): slot.position
        case let .food(slot): slot.position
        }
    }
}

public struct NutritionPlanFormValues: Sendable, Equatable {
    public let name: String
    public let description: String
    public let slots: [NutritionPlanSlotFormValues]
    public let foodSlots: [NutritionPlanFoodSlotFormValues]

    public init(
        name: String,
        description: String,
        slots: [NutritionPlanSlotFormValues],
        foodSlots: [NutritionPlanFoodSlotFormValues] = []
    ) {
        self.name = name
        self.description = description
        self.slots = slots
        self.foodSlots = foodSlots
    }

    public static let empty = NutritionPlanFormValues(name: "", description: "", slots: [], foodSlots: [])
}

public enum NutritionPlanFormValidationResult: Sendable, Equatable {
    case success(NutritionPlanFormValues)
    case failure(String)
}

public enum NutritionPlanFormValidation {
    public static func validate(
        _ values: NutritionPlanFormValues,
        availableMeals: [Meal],
        availableFoods: [Food] = []
    ) -> NutritionPlanFormValidationResult {
        let name = values.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return .failure("Name is required.") }
        guard name.count <= 160 else { return .failure("Name must be 160 characters or less.") }
        let description = values.description.trimmingCharacters(in: .whitespacesAndNewlines)
        guard description.count <= 1_000 else { return .failure("Description must be 1000 characters or less.") }
        guard !values.slots.isEmpty || !values.foodSlots.isEmpty else {
            return .failure("Add at least one meal or food slot to this plan.")
        }

        let mealIds = Set(availableMeals.map(\.id))
        var normalizedSlots: [NutritionPlanSlotFormValues] = []
        for slot in values.slots {
            guard !slot.mealId.isEmpty, mealIds.contains(slot.mealId) else {
                return .failure("Every meal slot needs a selected meal.")
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

        let foodIds = Set(availableFoods.map(\.id))
        var normalizedFoodSlots: [NutritionPlanFoodSlotFormValues] = []
        for slot in values.foodSlots {
            guard !slot.foodId.isEmpty, foodIds.contains(slot.foodId) else {
                return .failure("Every food slot needs a selected food.")
            }
            let grams = normalizeDecimalInput(slot.grams)
            guard let parsedGrams = NutritionMath.parseMacroInput(grams), parsedGrams > 0 else {
                return .failure("Food slot grams must be greater than zero.")
            }
            let slotTime = IntakeGrouping.timeToInputValue(slot.slotTime)
            guard !slotTime.isEmpty else { return .failure("Every slot needs a time of day.") }
            let label = slot.label.trimmingCharacters(in: .whitespacesAndNewlines)
            guard label.count <= 160 else { return .failure("Slot labels must be 160 characters or less.") }
            normalizedFoodSlots.append(NutritionPlanFoodSlotFormValues(
                id: slot.id,
                clientId: slot.clientId,
                foodId: slot.foodId,
                grams: grams,
                slotTime: slotTime,
                label: label,
                position: slot.position
            ))
        }

        let renumbered = renumberMixedSlots(mealSlots: normalizedSlots, foodSlots: normalizedFoodSlots)
        return .success(NutritionPlanFormValues(
            name: name,
            description: description,
            slots: renumbered.mealSlots,
            foodSlots: renumbered.foodSlots
        ))
    }

    fileprivate static func normalizeDecimalInput(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ",", with: ".")
    }
}

@MainActor
public final class NutritionPlanFormModel: ObservableObject {
    @Published public var name: String
    @Published public var planDescription: String
    @Published public var slots: [NutritionPlanSlotFormValues]
    @Published public var foodSlots: [NutritionPlanFoodSlotFormValues]
    @Published public private(set) var errorMessage: String?

    public init(initialValues: NutritionPlanFormValues) {
        name = initialValues.name
        planDescription = initialValues.description
        slots = initialValues.slots
        foodSlots = initialValues.foodSlots
        renumber()
    }

    public var canSubmit: Bool {
        !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && (!slots.isEmpty || !foodSlots.isEmpty)
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

    public func addFoodSlot(foodId: String = "", grams: String = "100", slotTime: String = "12:00", label: String = "") {
        foodSlots.append(NutritionPlanFoodSlotFormValues(
            foodId: foodId,
            grams: grams,
            slotTime: slotTime,
            label: label,
            position: foodSlots.count
        ))
        renumber()
    }

    public func removeSlot(stableId: String) {
        slots.removeAll { $0.stableId == stableId }
        renumber()
    }

    public func removeFoodSlot(stableId: String) {
        foodSlots.removeAll { $0.stableId == stableId }
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

    public func updateFoodSlot(
        stableId: String,
        foodId: String? = nil,
        grams: String? = nil,
        slotTime: String? = nil,
        label: String? = nil
    ) {
        foodSlots = foodSlots.map { slot in
            guard slot.stableId == stableId else { return slot }
            return NutritionPlanFoodSlotFormValues(
                id: slot.id,
                clientId: slot.clientId,
                foodId: foodId ?? slot.foodId,
                grams: grams ?? slot.grams,
                slotTime: slotTime ?? slot.slotTime,
                label: label ?? slot.label,
                position: slot.position
            )
        }
        renumber()
    }

    public func moveSlot(stableId: String, direction: Int) {
        moveEntry(kind: .meal, stableId: stableId, direction: direction)
    }

    public func moveFoodSlot(stableId: String, direction: Int) {
        moveEntry(kind: .food, stableId: stableId, direction: direction)
    }

    public func sortedDraftEntries() -> [NutritionPlanDraftEntry] {
        sortDraftEntries(mealSlots: slots, foodSlots: foodSlots)
    }

    public func moveEntry(kind: NutritionPlanEntryKind, stableId: String, direction: Int) {
        var entries = sortedDraftEntries()
        guard let index = entries.firstIndex(where: { $0.kind == kind && $0.stableId == stableId }) else { return }
        let target = index + direction
        guard target >= 0, target < entries.count else { return }
        entries.swapAt(index, target)
        apply(entries: entries)
    }

    public func valuesForSubmit(availableMeals: [Meal], availableFoods: [Food] = []) -> NutritionPlanFormValues? {
        switch NutritionPlanFormValidation.validate(
            NutritionPlanFormValues(name: name, description: planDescription, slots: slots, foodSlots: foodSlots),
            availableMeals: availableMeals,
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

    public func macroTotals(availableMeals: [Meal], availableFoods: [Food] = []) -> MacroTotals {
        let mealsById = Dictionary(uniqueKeysWithValues: availableMeals.map { ($0.id, $0) })
        let foodsById = Dictionary(uniqueKeysWithValues: availableFoods.map { ($0.id, $0) })
        return NutritionMath.mixedPlanMacroTotals(
            mealSlots: slots.map { slot in
                PlanTotalSlot(mealIngredients: mealsById[slot.mealId]?.mealIngredients.map { ingredient in
                    MealTotalIngredient(grams: ingredient.grams, food: ingredient.food?.macroFields)
                })
            },
            foodSlots: foodSlots.map { slot in
                PlanFoodTotalSlot(grams: .string(slot.grams), food: foodsById[slot.foodId]?.macroFields)
            }
        )
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
            },
            foodSlots: plan.sortedFoodSlots.map { slot in
                NutritionPlanFoodSlotFormValues(
                    id: slot.id,
                    foodId: slot.foodId,
                    grams: NutritionMath.formatEditableDecimal(slot.grams),
                    slotTime: IntakeGrouping.timeToInputValue(slot.slotTime),
                    label: slot.label ?? "",
                    position: slot.position
                )
            }
        )
    }

    private func renumber() {
        let renumbered = renumberMixedSlots(mealSlots: slots, foodSlots: foodSlots)
        slots = renumbered.mealSlots
        foodSlots = renumbered.foodSlots
    }

    private func apply(entries: [NutritionPlanDraftEntry]) {
        var nextPositionByTime: [String: Int] = [:]
        var nextMeals: [NutritionPlanSlotFormValues] = []
        var nextFoods: [NutritionPlanFoodSlotFormValues] = []

        for entry in entries {
            let normalizedTime = IntakeGrouping.timeToInputValue(entry.slotTime)
            let position = nextPositionByTime[normalizedTime, default: 0]
            nextPositionByTime[normalizedTime] = position + 1
            switch entry {
            case let .meal(slot):
                nextMeals.append(NutritionPlanSlotFormValues(
                    id: slot.id,
                    clientId: slot.clientId,
                    mealId: slot.mealId,
                    slotTime: slot.slotTime,
                    label: slot.label,
                    position: position
                ))
            case let .food(slot):
                nextFoods.append(NutritionPlanFoodSlotFormValues(
                    id: slot.id,
                    clientId: slot.clientId,
                    foodId: slot.foodId,
                    grams: slot.grams,
                    slotTime: slot.slotTime,
                    label: slot.label,
                    position: position
                ))
            }
        }

        slots = nextMeals
        foodSlots = nextFoods
    }
}

private enum NutritionPlanFormEntryReference {
    case meal(NutritionPlanSlotFormValues)
    case food(NutritionPlanFoodSlotFormValues)

    var slotTime: String {
        switch self {
        case let .meal(slot): slot.slotTime
        case let .food(slot): slot.slotTime
        }
    }

    var position: Int {
        switch self {
        case let .meal(slot): slot.position
        case let .food(slot): slot.position
        }
    }

    var kind: NutritionPlanEntryKind {
        switch self {
        case .meal: .meal
        case .food: .food
        }
    }

    var stableId: String {
        switch self {
        case let .meal(slot): slot.stableId
        case let .food(slot): slot.stableId
        }
    }
}

private func sortDraftEntries(
    mealSlots: [NutritionPlanSlotFormValues],
    foodSlots: [NutritionPlanFoodSlotFormValues]
) -> [NutritionPlanDraftEntry] {
    (mealSlots.map(NutritionPlanDraftEntry.meal) + foodSlots.map(NutritionPlanDraftEntry.food))
        .sorted { left, right in
            NutritionMath.mixedPlanEntrySortsBefore(
                leftSlotTime: left.slotTime,
                leftPosition: left.position,
                leftKind: left.kind.rawValue,
                leftId: left.stableId,
                rightSlotTime: right.slotTime,
                rightPosition: right.position,
                rightKind: right.kind.rawValue,
                rightId: right.stableId
            )
        }
}

private func renumberMixedSlots(
    mealSlots: [NutritionPlanSlotFormValues],
    foodSlots: [NutritionPlanFoodSlotFormValues]
) -> (mealSlots: [NutritionPlanSlotFormValues], foodSlots: [NutritionPlanFoodSlotFormValues]) {
    let entries = (mealSlots.map(NutritionPlanFormEntryReference.meal) + foodSlots.map(NutritionPlanFormEntryReference.food))
        .sorted { left, right in
            NutritionMath.mixedPlanEntrySortsBefore(
                leftSlotTime: left.slotTime,
                leftPosition: left.position,
                leftKind: left.kind.rawValue,
                leftId: left.stableId,
                rightSlotTime: right.slotTime,
                rightPosition: right.position,
                rightKind: right.kind.rawValue,
                rightId: right.stableId
            )
        }

    var nextPositionByTime: [String: Int] = [:]
    var renumberedMeals: [NutritionPlanSlotFormValues] = []
    var renumberedFoods: [NutritionPlanFoodSlotFormValues] = []

    for entry in entries {
        let normalizedTime = IntakeGrouping.timeToInputValue(entry.slotTime)
        let position = nextPositionByTime[normalizedTime, default: 0]
        nextPositionByTime[normalizedTime] = position + 1
        switch entry {
        case let .meal(slot):
            renumberedMeals.append(NutritionPlanSlotFormValues(
                id: slot.id,
                clientId: slot.clientId,
                mealId: slot.mealId,
                slotTime: slot.slotTime,
                label: slot.label,
                position: position
            ))
        case let .food(slot):
            renumberedFoods.append(NutritionPlanFoodSlotFormValues(
                id: slot.id,
                clientId: slot.clientId,
                foodId: slot.foodId,
                grams: slot.grams,
                slotTime: slot.slotTime,
                label: slot.label,
                position: position
            ))
        }
    }

    return (renumberedMeals, renumberedFoods)
}
