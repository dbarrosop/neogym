import Foundation

public struct DemoNutritionRepository: NutritionFoodMealRepositoryProtocol {
    let store: DemoStore
    public init(store: DemoStore) { self.store = store }

    public func listFoods() async throws -> [Food] {
        try await store.read { try $0.records(Food.self, table: .foods).sorted { $0.name < $1.name } }
    }

    public func food(id: String) async throws -> Food? {
        try await store.read { state in
            try state.tables[DemoTable.foods.rawValue]?[id].map { try state.decode(Food.self, .object($0)) }
        }
    }

    public func editFood(id: String) async throws -> Food? { try await food(id: id) }
    public func foodsForMealForm() async throws -> [Food] { try await listFoods() }

    public func createFood(_ values: FoodFormValues) async throws -> String {
        try await store.change { state in
            var record = try Self.foodRecord(values)
            record["isPublic"] = .bool(false)
            record["userId"] = .string(DemoStore.userId)
            return state.insert(.foods, record)
        }
    }

    public func updateFood(id: String, values: FoodFormValues) async throws {
        try await store.change { state in
            try state.editable(.foods, id)
            try state.update(.foods, id, Self.foodRecord(values))
        }
    }

    public func deleteFood(id: String) async throws {
        try await store.change { state in
            try state.editable(.foods, id)
            guard state.related(.ingredients, "foodId", id).isEmpty, state.related(.planFoods, "foodId", id).isEmpty else {
                throw DemoError.referencedTemplate
            }
            for entry in state.related(.logEntries, "foodId", id) { try state.update(.logEntries, entry.text("id"), ["foodId": .null]) }
            state.remove(.foods, id)
        }
    }

    public func listMeals() async throws -> [Meal] {
        try await store.read { state in
            try state.decode([Meal].self, .array(state.rows(.meals).map { try state.meal($0.text("id")) })).sorted { $0.name < $1.name }
        }
    }

    public func meal(id: String) async throws -> Meal? {
        try await store.read { state in
            guard state.tables[DemoTable.meals.rawValue]?[id] != nil else { return nil }
            return try state.decode(Meal.self, state.meal(id))
        }
    }

    public func editMeal(id: String) async throws -> MealEditPayload {
        MealEditPayload(meal: try await meal(id: id), foods: try await listFoods())
    }

    public func createMeal(_ values: MealFormValues) async throws -> String {
        try await store.change { state in
            let id = state.insert(.meals, [:])
            try state.saveMeal(id: id, values: values)
            return id
        }
    }

    public func saveMeal(id: String, initialValues: MealFormValues, values: MealFormValues) async throws {
        try await store.change { try $0.saveMeal(id: id, values: values) }
    }

    public func deleteMeal(id: String) async throws {
        try await store.change { state in
            _ = try state.row(.meals, id)
            guard state.related(.planMeals, "mealId", id).isEmpty else { throw DemoError.referencedTemplate }
            for row in state.related(.ingredients, "mealId", id) { state.remove(.ingredients, row.text("id")) }
            for row in state.related(.logMeals, "mealId", id) { try state.update(.logMeals, row.text("id"), ["mealId": .null]) }
            state.remove(.meals, id)
        }
    }

    public func listNutritionDays() async throws -> [NutritionDay] {
        try await store.read { state in
            try state.decode([NutritionDay].self, .array(state.rows(.days).map { try state.day($0.text("id")) })).sorted { $0.logDate > $1.logDate }
        }
    }

    public func nutritionOverview() async throws -> NutritionOverviewPayload {
        let days = try await listNutritionDays()
        let energy = try await DemoEnergyRepository(store: store).listEntries()
        return NutritionOverviewPayload(days: days, dailyEnergyEntries: energy, balanceDays: days)
    }

    public func openDailyIntake(date: String) async throws -> DailyIntakePayload {
        let days = try await listNutritionDays()
        let energy = try await DemoEnergyRepository(store: store).listEntries()
        return DailyIntakePayload(
            day: days.first { $0.logDate == date }, dailyEnergy: energy.first { $0.energyOn == date }, energyHistory: energy,
            nutritionPlans: try await listPlans(), meals: try await listMeals(), foods: try await listFoods()
        )
    }

    public func createNutritionDay(date: String, nutritionPlanId: String?) async throws -> String {
        try await store.change { state in
            try state.uniqueDate(.days, key: "logDate", value: date)
            if let nutritionPlanId { _ = try state.row(.plans, nutritionPlanId) }
            return state.insert(.days, [
                "logDate": .string(date), "userId": .string(DemoStore.userId), "nutritionPlanId": .demoOptional(nutritionPlanId)
            ])
        }
    }

    public func updateNutritionDayPlan(dayId: String, nutritionPlanId: String?) async throws {
        try await store.change { state in
            if let nutritionPlanId { _ = try state.row(.plans, nutritionPlanId) }
            try state.update(.days, dayId, ["nutritionPlanId": .demoOptional(nutritionPlanId)])
        }
    }

    public func deleteNutritionDay(id: String) async throws {
        try await store.change { state in
            _ = try state.row(.days, id)
            for row in state.related(.logMeals, "nutritionDayId", id) { state.removeLogMeal(row.text("id")) }
            for row in state.related(.logEntries, "nutritionDayId", id) { state.remove(.logEntries, row.text("id")) }
            state.remove(.days, id)
        }
    }

    private static func foodRecord(_ values: FoodFormValues) throws -> DemoRecord {
        guard case let .success(values) = FoodFormValidation.validate(values) else { throw DemoError.invalidEntry }
        return [
            "name": .string(values.name), "kcalPer100g": .demoNumber(values.kcalPer100g), "fatPer100g": .demoNumber(values.fatPer100g),
            "carbsPer100g": .demoNumber(values.carbsPer100g), "proteinPer100g": .demoNumber(values.proteinPer100g),
            "fiberPer100g": .demoNumber(values.fiberPer100g), "sugarPer100g": .demoNumber(values.sugarPer100g)
        ]
    }
}

extension DemoState {
    mutating func saveMeal(id: String, values: MealFormValues) throws {
        let foods = try records(Food.self, table: .foods)
        guard case let .success(values) = MealFormValidation.validate(values, availableFoods: foods) else { throw DemoError.invalidEntry }
        try update(.meals, id, ["name": .string(values.name), "description": .string(values.description)])
        for ingredient in related(.ingredients, "mealId", id) { remove(.ingredients, ingredient.text("id")) }
        for ingredient in values.ingredients {
            insert(.ingredients, [
                "mealId": .string(id), "foodId": .string(ingredient.foodId), "grams": .demoNumber(ingredient.grams),
                "position": .number(Double(ingredient.position))
            ], id: ingredient.id)
        }
    }
}
