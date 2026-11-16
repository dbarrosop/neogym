import Foundation

public extension DemoNutritionRepository {
    func listPlans() async throws -> [NutritionPlan] {
        try await store.read { state in
            try state.decode([NutritionPlan].self, .array(state.rows(.plans).map { try state.plan($0.text("id")) })).sorted { $0.name < $1.name }
        }
    }

    func plan(id: String) async throws -> NutritionPlan? {
        try await store.read { state in
            guard state.tables[DemoTable.plans.rawValue]?[id] != nil else { return nil }
            return try state.decode(NutritionPlan.self, state.plan(id))
        }
    }

    func editPlan(id: String) async throws -> NutritionPlanEditPayload {
        NutritionPlanEditPayload(plan: try await plan(id: id), meals: try await listMeals(), foods: try await listFoods())
    }

    func mealsForPlanForm() async throws -> [Meal] { try await listMeals() }

    func createPlan(_ values: NutritionPlanFormValues) async throws -> String {
        try await store.change { state in
            let id = state.insert(.plans, [:])
            try state.savePlan(id: id, values: values)
            return id
        }
    }

    func savePlan(id: String, initialValues: NutritionPlanFormValues, values: NutritionPlanFormValues) async throws {
        try await store.change { try $0.savePlan(id: id, values: values) }
    }

    func deletePlan(id: String) async throws {
        try await store.change { state in
            _ = try state.row(.plans, id)
            for slot in state.related(.planMeals, "nutritionPlanId", id) { try state.removePlanSlot(.planMeals, slot.text("id")) }
            for slot in state.related(.planFoods, "nutritionPlanId", id) { try state.removePlanSlot(.planFoods, slot.text("id")) }
            for day in state.related(.days, "nutritionPlanId", id) { try state.update(.days, day.text("id"), ["nutritionPlanId": .null]) }
            state.remove(.plans, id)
        }
    }
}

extension DemoState {
    mutating func savePlan(id: String, values: NutritionPlanFormValues) throws {
        let meals = try decode([Meal].self, .array(rows(.meals).map { try meal($0.text("id")) }))
        let foods = try records(Food.self, table: .foods)
        guard case let .success(values) = NutritionPlanFormValidation.validate(values, availableMeals: meals, availableFoods: foods) else {
            throw DemoError.invalidEntry
        }
        try update(.plans, id, ["name": .string(values.name), "description": .string(values.description)])
        let oldMeals = related(.planMeals, "nutritionPlanId", id)
        let oldFoods = related(.planFoods, "nutritionPlanId", id)
        var keptMeals = Set<String>()
        var keptFoods = Set<String>()
        for slot in values.slots {
            let existing = oldMeals.first { $0.text("id") == slot.id && $0.text("mealId") == slot.mealId }
            let slotId = insert(.planMeals, [
                "nutritionPlanId": .string(id), "mealId": .string(slot.mealId), "slotTime": .string(slot.slotTime),
                "label": .string(slot.label), "position": .number(Double(slot.position))
            ], id: existing?.text("id") ?? UUID().uuidString)
            keptMeals.insert(slotId)
        }
        for slot in values.foodSlots {
            let existing = oldFoods.first { $0.text("id") == slot.id && $0.text("foodId") == slot.foodId }
            let slotId = insert(.planFoods, [
                "nutritionPlanId": .string(id), "foodId": .string(slot.foodId), "slotTime": .string(slot.slotTime),
                "grams": .demoNumber(slot.grams), "position": .number(Double(slot.position))
            ], id: existing?.text("id") ?? UUID().uuidString)
            keptFoods.insert(slotId)
        }
        for slot in oldMeals where !keptMeals.contains(slot.text("id")) { try removePlanSlot(.planMeals, slot.text("id")) }
        for slot in oldFoods where !keptFoods.contains(slot.text("id")) { try removePlanSlot(.planFoods, slot.text("id")) }
    }

    mutating func removePlanSlot(_ table: DemoTable, _ id: String) throws {
        let logTable: DemoTable = table == .planMeals ? .logMeals : .logEntries
        let key = table == .planMeals ? "nutritionPlanMealId" : "nutritionPlanFoodId"
        for log in related(logTable, key, id) { try update(logTable, log.text("id"), [key: .null]) }
        remove(table, id)
    }
}
