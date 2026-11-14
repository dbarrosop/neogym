import Foundation

public extension DemoNutritionRepository {
    func logFood(_ values: LogFoodValues) async throws -> String {
        try await store.change { state in
            try state.logFood(
                dayId: values.dayId, foodId: values.foodId, grams: .demoNumber(values.grams),
                slotTime: values.slotTime, position: values.position, planFoodId: values.nutritionPlanFoodId
            )
        }
    }

    func logAdHocFood(_ values: LogAdHocFoodValues) async throws -> String {
        try await store.change { state in
            _ = try state.row(.days, values.dayId)
            var record = try Self.adHocRecord(values.draft)
            record["nutritionDayId"] = .string(values.dayId)
            record["position"] = .number(Double(values.position))
            return state.insert(.logEntries, record)
        }
    }

    func logMeal(_ values: LogMealValues) async throws -> String {
        try await store.change { state in
            let entries = values.meal.mealIngredients.map {
                PlanLogEntryInsertValues(dayId: values.dayId, foodId: $0.foodId, grams: $0.grams, position: $0.position, slotTime: values.slotTime)
            }
            return try state.logMeal(
                dayId: values.dayId, mealId: values.meal.id, name: values.name, time: values.slotTime,
                position: values.position, planMealId: values.planSlot?.id, entries: entries
            )
        }
    }

    func logSelectedPlan(_ materialization: PlanLogMaterialization) async throws -> PlanLogMutationResult {
        try await store.change { state in
            for meal in materialization.mealObjects {
                _ = try state.logMeal(
                    dayId: meal.dayId, mealId: meal.mealId, name: meal.name, time: meal.slotTime,
                    position: meal.position, planMealId: meal.nutritionPlanMealId, entries: meal.entries
                )
            }
            for food in materialization.entryObjects {
                _ = try state.logFood(
                    dayId: food.dayId, foodId: food.foodId, grams: food.grams, slotTime: food.slotTime,
                    position: food.position, planFoodId: food.nutritionPlanFoodId
                )
            }
            return PlanLogMutationResult(mealRows: materialization.mealObjects.count, entryRows: materialization.entryObjects.count)
        }
    }

    func updateLogEntry(id: String, values: LogEntryUpdateValues) async throws {
        try await store.change { state in
            let existing = try state.row(.logEntries, id)
            var changes: DemoRecord = [:]
            if let grams = values.grams {
                let value = JSONValue.demoNumber(grams)
                guard NutritionMath.normalizeNumeric(value) > 0 else { throw DemoError.invalidEntry }
                changes["grams"] = value
            }
            if let position = values.position { changes["position"] = .number(Double(position)) }
            if let time = values.slotTime, existing.text("nutritionLogMealId").isEmpty { changes["slotTime"] = .string(time) }
            if let draft = values.adHocDraft {
                guard existing.text("source") == "ad_hoc" else { throw DemoError.invalidEntry }
                changes.merge(try Self.adHocRecord(draft)) { _, new in new }
            }
            try state.update(.logEntries, id, changes)
        }
    }

    func updateLogMeal(id: String, values: LogMealUpdateValues) async throws {
        try await store.change { state in
            var changes: DemoRecord = [:]
            if let name = values.name { changes["name"] = .string(name) }
            if let time = values.slotTime { changes["slotTime"] = .string(time) }
            if let position = values.position { changes["position"] = .number(Double(position)) }
            try state.update(.logMeals, id, changes)
        }
    }

    func deleteLogEntry(id: String) async throws {
        try await store.change { state in
            _ = try state.row(.logEntries, id)
            state.remove(.logEntries, id)
        }
    }

    func deleteLogMeal(id: String) async throws {
        try await store.change { state in
            _ = try state.row(.logMeals, id)
            state.removeLogMeal(id)
        }
    }

    private static func adHocRecord(_ draft: AdHocFoodDraftValues) throws -> DemoRecord {
        let macros = draft.macros
        let fields = [macros.kcalPer100g, macros.grams.fatPer100g, macros.grams.carbsPer100g,
                      macros.grams.proteinPer100g, macros.grams.fiberPer100g, macros.grams.sugarPer100g]
        guard !draft.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let grams = Double(draft.grams), grams.isFinite, grams > 0,
              fields.allSatisfy({ Double($0).map { $0.isFinite && $0 >= 0 } ?? false }) else { throw DemoError.invalidEntry }
        var record: DemoRecord = [
            "source": .string("ad_hoc"), "snapshotFoodName": .string(draft.name), "grams": .number(grams),
            "slotTime": .string(draft.slotTime), "foodId": .null, "nutritionLogMealId": .null, "nutritionPlanFoodId": .null
        ]
        for (index, nutrient) in DemoSeed.nutrients.enumerated() { record["snapshot\(nutrient)Per100g"] = .demoNumber(fields[index]) }
        return record
    }
}

extension DemoState {
    mutating func logFood(dayId: String, foodId: String, grams: JSONValue, slotTime: String,
                          position: Int, planFoodId: String? = nil, groupId: String? = nil) throws -> String {
        _ = try row(.days, dayId)
        let food = try row(.foods, foodId)
        let amount = NutritionMath.normalizeNumeric(grams)
        guard amount.isFinite, amount > 0 else { throw DemoError.invalidEntry }
        if let planFoodId {
            let slot = try row(.planFoods, planFoodId)
            guard groupId == nil, slot.text("foodId") == foodId else { throw DemoError.invalidEntry }
        }
        if let groupId {
            guard try row(.logMeals, groupId).text("nutritionDayId") == dayId else { throw DemoError.invalidEntry }
        }
        var entry = DemoSeed.foodSnapshot(food)
        entry.merge([
            "source": .string("food"), "nutritionDayId": .string(dayId), "foodId": .string(foodId), "grams": grams,
            "slotTime": .string(slotTime), "position": .number(Double(position)),
            "nutritionPlanFoodId": .demoOptional(planFoodId), "nutritionLogMealId": .demoOptional(groupId)
        ]) { _, new in new }
        return insert(.logEntries, entry)
    }

    mutating func logMeal(dayId: String, mealId: String, name: String, time: String, position: Int,
                          planMealId: String?, entries: [PlanLogEntryInsertValues]) throws -> String {
        _ = try row(.days, dayId)
        _ = try row(.meals, mealId)
        guard !entries.isEmpty else { throw DemoError.invalidEntry }
        if let planMealId {
            guard try row(.planMeals, planMealId).text("mealId") == mealId else { throw DemoError.invalidEntry }
        }
        let id = insert(.logMeals, [
            "nutritionDayId": .string(dayId), "mealId": .string(mealId), "name": .string(name),
            "slotTime": .string(time), "position": .number(Double(position)), "nutritionPlanMealId": .demoOptional(planMealId)
        ])
        for entry in entries {
            guard entry.dayId == dayId else { throw DemoError.invalidEntry }
            _ = try logFood(dayId: dayId, foodId: entry.foodId, grams: entry.grams, slotTime: time, position: entry.position, groupId: id)
        }
        return id
    }
}
