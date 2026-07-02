import Foundation

public protocol NutritionFoodMealRepositoryProtocol: Sendable {
    func listFoods() async throws -> [Food]
    func food(id: String) async throws -> Food?
    func editFood(id: String) async throws -> Food?
    func createFood(_ values: FoodFormValues) async throws -> String
    func updateFood(id: String, values: FoodFormValues) async throws
    func deleteFood(id: String) async throws

    func listMeals() async throws -> [Meal]
    func meal(id: String) async throws -> Meal?
    func editMeal(id: String) async throws -> MealEditPayload
    func foodsForMealForm() async throws -> [Food]
    func createMeal(_ values: MealFormValues) async throws -> String
    func saveMeal(id: String, initialValues: MealFormValues, values: MealFormValues) async throws
    func deleteMeal(id: String) async throws

    func listPlans() async throws -> [NutritionPlan]
    func plan(id: String) async throws -> NutritionPlan?
    func editPlan(id: String) async throws -> NutritionPlanEditPayload
    func mealsForPlanForm() async throws -> [Meal]
    func createPlan(_ values: NutritionPlanFormValues) async throws -> String
    func savePlan(id: String, initialValues: NutritionPlanFormValues, values: NutritionPlanFormValues) async throws
    func deletePlan(id: String) async throws

    func listNutritionDays() async throws -> [NutritionDay]
    func openDailyIntake(date: String) async throws -> DailyIntakePayload
    func createNutritionDay(date: String, nutritionPlanId: String?) async throws -> String
    func updateNutritionDayPlan(dayId: String, nutritionPlanId: String?) async throws
    func deleteNutritionDay(id: String) async throws
    func logFood(_ values: LogFoodValues) async throws -> String
    func logAdHocFood(_ values: LogAdHocFoodValues) async throws -> String
    func logMeal(_ values: LogMealValues) async throws -> String
    func updateLogEntry(id: String, values: LogEntryUpdateValues) async throws
    func updateLogMeal(id: String, values: LogMealUpdateValues) async throws
    func deleteLogEntry(id: String) async throws
    func deleteLogMeal(id: String) async throws
}

public struct NutritionFoodMealRepository: NutritionFoodMealRepositoryProtocol {
    private let graphQL: any GraphQLServicing

    public init(graphQL: any GraphQLServicing) {
        self.graphQL = graphQL
    }

    public func listFoods() async throws -> [Food] {
        let data: FoodsIndexData = try await graphQL.execute(
            query: Self.foodsIndexQuery,
            operationName: "FoodsIndex"
        )
        return data.foods
    }

    public func food(id: String) async throws -> Food? {
        let data: FoodDetailData = try await graphQL.execute(
            query: Self.foodDetailQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "FoodDetail"
        )
        return data.food
    }

    public func editFood(id: String) async throws -> Food? {
        let data: EditFoodData = try await graphQL.execute(
            query: Self.editFoodQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "EditFood"
        )
        return data.food
    }

    public func createFood(_ values: FoodFormValues) async throws -> String {
        let data: InsertFoodData = try await graphQL.execute(
            query: Self.createFoodMutation,
            variables: ["object": Self.foodObject(values)],
            operationName: "CreateFood"
        )
        guard let id = data.insertFood?.id else {
            throw GraphQLDomainError.missingData(operationName: "CreateFood")
        }
        return id
    }

    public func updateFood(id: String, values: FoodFormValues) async throws {
        let _: SaveFoodData = try await graphQL.execute(
            query: Self.saveFoodMutation,
            variables: ["id": GraphQLScalars.uuid(id), "set": Self.foodObject(values)],
            operationName: "SaveFood"
        )
    }

    public func deleteFood(id: String) async throws {
        let _: DeleteFoodData = try await graphQL.execute(
            query: Self.deleteFoodMutation,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "DeleteFood"
        )
    }

    public func listMeals() async throws -> [Meal] {
        let data: MealsIndexData = try await graphQL.execute(
            query: Self.mealsIndexQuery,
            operationName: "MealsIndex"
        )
        return data.meals
    }

    public func meal(id: String) async throws -> Meal? {
        let data: MealDetailData = try await graphQL.execute(
            query: Self.mealDetailQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "MealDetail"
        )
        return data.meal
    }

    public func editMeal(id: String) async throws -> MealEditPayload {
        let data: EditMealData = try await graphQL.execute(
            query: Self.editMealQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "EditMeal"
        )
        let foods = try await foodsForMealForm()
        return MealEditPayload(meal: data.meal, foods: foods)
    }

    public func foodsForMealForm() async throws -> [Food] {
        let data: MealFormFoodsData = try await graphQL.execute(
            query: Self.mealFormFoodsQuery,
            operationName: "MealFormFoods"
        )
        return data.foods
    }

    public func createMeal(_ values: MealFormValues) async throws -> String {
        let data: InsertMealData = try await graphQL.execute(
            query: Self.createMealMutation,
            variables: ["object": Self.mealObject(values)],
            operationName: "CreateMeal"
        )
        guard let id = data.insertMeal?.id else {
            throw GraphQLDomainError.missingData(operationName: "CreateMeal")
        }
        return id
    }

    public func saveMeal(id: String, initialValues: MealFormValues, values: MealFormValues) async throws {
        let _: SaveMealData = try await graphQL.execute(
            query: Self.saveMealMutation,
            variables: Self.saveMealVariables(id: id, initialValues: initialValues, values: values),
            operationName: "SaveMeal"
        )
    }

    public func deleteMeal(id: String) async throws {
        let _: DeleteMealData = try await graphQL.execute(
            query: Self.deleteMealMutation,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "DeleteMeal"
        )
    }

    public func listPlans() async throws -> [NutritionPlan] {
        let data: PlansIndexData = try await graphQL.execute(
            query: Self.plansIndexQuery,
            operationName: "PlansIndex"
        )
        return data.nutritionPlans
    }

    public func plan(id: String) async throws -> NutritionPlan? {
        let data: NutritionPlanDetailData = try await graphQL.execute(
            query: Self.nutritionPlanDetailQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "NutritionPlanDetail"
        )
        return data.nutritionPlan
    }

    public func editPlan(id: String) async throws -> NutritionPlanEditPayload {
        let data: EditNutritionPlanData = try await graphQL.execute(
            query: Self.editNutritionPlanQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "EditNutritionPlan"
        )
        let meals = try await mealsForPlanForm()
        let foods = try await foodsForMealForm()
        return NutritionPlanEditPayload(plan: data.nutritionPlan, meals: meals, foods: foods)
    }

    public func mealsForPlanForm() async throws -> [Meal] {
        let data: NutritionPlanFormMealsData = try await graphQL.execute(
            query: Self.nutritionPlanFormMealsQuery,
            operationName: "NutritionPlanFormMeals"
        )
        return data.meals
    }

    public func createPlan(_ values: NutritionPlanFormValues) async throws -> String {
        let data: InsertNutritionPlanData = try await graphQL.execute(
            query: Self.createNutritionPlanMutation,
            variables: ["object": Self.nutritionPlanObject(values)],
            operationName: "CreateNutritionPlan"
        )
        guard let id = data.insertNutritionPlan?.id else {
            throw GraphQLDomainError.missingData(operationName: "CreateNutritionPlan")
        }
        return id
    }

    public func savePlan(
        id: String,
        initialValues: NutritionPlanFormValues,
        values: NutritionPlanFormValues
    ) async throws {
        let _: SaveNutritionPlanData = try await graphQL.execute(
            query: Self.saveNutritionPlanMutation,
            variables: Self.saveNutritionPlanVariables(id: id, initialValues: initialValues, values: values),
            operationName: "SaveNutritionPlan"
        )
    }

    public func deletePlan(id: String) async throws {
        let _: DeleteNutritionPlanData = try await graphQL.execute(
            query: Self.deleteNutritionPlanMutation,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "DeleteNutritionPlan"
        )
    }

    public func listNutritionDays() async throws -> [NutritionDay] {
        let data: NutritionDaysIndexData = try await graphQL.execute(
            query: Self.nutritionDaysIndexQuery,
            operationName: "NutritionDaysIndex"
        )
        return data.nutritionDays
    }

    public func openDailyIntake(date: String) async throws -> DailyIntakePayload {
        let data: DailyIntakeLogData = try await graphQL.execute(
            query: Self.dailyIntakeLogQuery,
            variables: ["date": GraphQLScalars.date(date)],
            operationName: "DailyIntakeLog"
        )
        return DailyIntakePayload(
            day: data.nutritionDays.first,
            nutritionPlans: data.nutritionPlans,
            meals: data.meals,
            foods: data.foods
        )
    }

    public func createNutritionDay(date: String, nutritionPlanId: String? = nil) async throws -> String {
        let data: InsertNutritionDayData = try await graphQL.execute(
            query: Self.createNutritionDayMutation,
            variables: ["object": Self.nutritionDayObject(date: date, nutritionPlanId: nutritionPlanId)],
            operationName: "CreateNutritionDay"
        )
        guard let id = data.insertNutritionDay?.id else {
            throw GraphQLDomainError.missingData(operationName: "CreateNutritionDay")
        }
        return id
    }

    public func updateNutritionDayPlan(dayId: String, nutritionPlanId: String?) async throws {
        let _: UpdateNutritionDayData = try await graphQL.execute(
            query: Self.updateNutritionDayPlanMutation,
            variables: [
                "id": GraphQLScalars.uuid(dayId),
                "nutritionPlanId": nutritionPlanId.map(GraphQLScalars.uuid) ?? .null
            ],
            operationName: "UpdateNutritionDayPlan"
        )
    }

    public func deleteNutritionDay(id: String) async throws {
        let _: DeleteNutritionDayData = try await graphQL.execute(
            query: Self.deleteNutritionDayMutation,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "DeleteNutritionDay"
        )
    }

    public func logFood(_ values: LogFoodValues) async throws -> String {
        let data: InsertNutritionLogEntryData = try await graphQL.execute(
            query: Self.logFoodMutation,
            variables: ["object": Self.logFoodObject(values)],
            operationName: "LogFood"
        )
        guard let id = data.insertNutritionLogEntry?.id else {
            throw GraphQLDomainError.missingData(operationName: "LogFood")
        }
        return id
    }

    public func logAdHocFood(_ values: LogAdHocFoodValues) async throws -> String {
        let data: InsertNutritionLogEntryData = try await graphQL.execute(
            query: Self.logFoodMutation,
            variables: ["object": Self.logAdHocFoodObject(values)],
            operationName: "LogFood"
        )
        guard let id = data.insertNutritionLogEntry?.id else {
            throw GraphQLDomainError.missingData(operationName: "LogFood")
        }
        return id
    }

    public func logMeal(_ values: LogMealValues) async throws -> String {
        let data: InsertNutritionLogMealData = try await graphQL.execute(
            query: Self.logMealMutation,
            variables: ["object": Self.logMealObject(values)],
            operationName: "LogMeal"
        )
        guard let id = data.insertNutritionLogMeal?.id else {
            throw GraphQLDomainError.missingData(operationName: "LogMeal")
        }
        return id
    }

    public func updateLogEntry(id: String, values: LogEntryUpdateValues) async throws {
        let _: UpdateNutritionLogEntryData = try await graphQL.execute(
            query: Self.updateNutritionLogEntryMutation,
            variables: ["id": GraphQLScalars.uuid(id), "set": Self.logEntryUpdateSet(values)],
            operationName: "UpdateNutritionLogEntry"
        )
    }

    public func updateLogMeal(id: String, values: LogMealUpdateValues) async throws {
        let _: UpdateNutritionLogMealData = try await graphQL.execute(
            query: Self.updateNutritionLogMealMutation,
            variables: ["id": GraphQLScalars.uuid(id), "set": Self.logMealUpdateSet(values)],
            operationName: "UpdateNutritionLogMeal"
        )
    }

    public func deleteLogEntry(id: String) async throws {
        let _: DeleteNutritionLogEntryData = try await graphQL.execute(
            query: Self.deleteNutritionLogEntryMutation,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "DeleteNutritionLogEntry"
        )
    }

    public func deleteLogMeal(id: String) async throws {
        let _: DeleteNutritionLogMealData = try await graphQL.execute(
            query: Self.deleteNutritionLogMealMutation,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "DeleteNutritionLogMeal"
        )
    }
}

private struct FoodsIndexData: Decodable, Sendable { let foods: [Food] }
private struct FoodDetailData: Decodable, Sendable { let food: Food? }
private struct EditFoodData: Decodable, Sendable { let food: Food? }
private struct InsertFoodData: Decodable, Sendable { let insertFood: MutationIdPayload? }
private struct SaveFoodData: Decodable, Sendable { let updateFood: MutationIdPayload? }
private struct DeleteFoodData: Decodable, Sendable { let deleteFood: MutationIdPayload? }
private struct MealsIndexData: Decodable, Sendable { let meals: [Meal] }
private struct MealDetailData: Decodable, Sendable { let meal: Meal? }
private struct EditMealData: Decodable, Sendable { let meal: Meal? }
private struct MealFormFoodsData: Decodable, Sendable { let foods: [Food] }
private struct InsertMealData: Decodable, Sendable { let insertMeal: MutationIdPayload? }
private struct SaveMealData: Decodable, Sendable {
    let updateMeal: MutationIdPayload?
    let deleteMealIngredients: AffectedRowsPayload?
    let insertMealIngredients: AffectedRowsPayload?
    let updateMealIngredientsMany: [AffectedRowsPayload]?

    private enum CodingKeys: String, CodingKey {
        case updateMeal
        case deleteMealIngredients
        case insertMealIngredients
        case updateMealIngredientsMany = "update_mealIngredients_many"
    }
}
private struct DeleteMealData: Decodable, Sendable { let deleteMeal: MutationIdPayload? }
private struct PlansIndexData: Decodable, Sendable { let nutritionPlans: [NutritionPlan] }
private struct NutritionPlanDetailData: Decodable, Sendable { let nutritionPlan: NutritionPlan? }
private struct EditNutritionPlanData: Decodable, Sendable { let nutritionPlan: NutritionPlan? }
private struct NutritionPlanFormMealsData: Decodable, Sendable { let meals: [Meal] }
private struct InsertNutritionPlanData: Decodable, Sendable { let insertNutritionPlan: MutationIdPayload? }
private struct SaveNutritionPlanData: Decodable, Sendable {
    let updateNutritionPlan: MutationIdPayload?
    let deleteNutritionPlanMeals: AffectedRowsPayload?
    let insertNutritionPlanMeals: AffectedRowsPayload?
    let updateNutritionPlanMealsMany: [AffectedRowsPayload]?
    let deleteNutritionPlanFoods: AffectedRowsPayload?
    let insertNutritionPlanFoods: AffectedRowsPayload?
    let updateNutritionPlanFoodsMany: [AffectedRowsPayload]?

    private enum CodingKeys: String, CodingKey {
        case updateNutritionPlan
        case deleteNutritionPlanMeals
        case insertNutritionPlanMeals
        case updateNutritionPlanMealsMany = "update_nutritionPlanMeals_many"
        case deleteNutritionPlanFoods
        case insertNutritionPlanFoods
        case updateNutritionPlanFoodsMany = "update_nutritionPlanFoods_many"
    }
}
private struct DeleteNutritionPlanData: Decodable, Sendable { let deleteNutritionPlan: MutationIdPayload? }
private struct NutritionDaysIndexData: Decodable, Sendable { let nutritionDays: [NutritionDay] }
private struct DailyIntakeLogData: Decodable, Sendable {
    let nutritionDays: [NutritionDay]
    let nutritionPlans: [NutritionPlan]
    let meals: [Meal]
    let foods: [Food]
}
private struct InsertNutritionDayData: Decodable, Sendable { let insertNutritionDay: MutationIdPayload? }
private struct UpdateNutritionDayData: Decodable, Sendable { let updateNutritionDay: MutationIdPayload? }
private struct DeleteNutritionDayData: Decodable, Sendable { let deleteNutritionDay: MutationIdPayload? }
private struct InsertNutritionLogEntryData: Decodable, Sendable { let insertNutritionLogEntry: MutationIdPayload? }
private struct InsertNutritionLogMealData: Decodable, Sendable { let insertNutritionLogMeal: MutationIdPayload? }
private struct UpdateNutritionLogEntryData: Decodable, Sendable { let updateNutritionLogEntry: MutationIdPayload? }
private struct UpdateNutritionLogMealData: Decodable, Sendable { let updateNutritionLogMeal: MutationIdPayload? }
private struct DeleteNutritionLogEntryData: Decodable, Sendable { let deleteNutritionLogEntry: MutationIdPayload? }
private struct DeleteNutritionLogMealData: Decodable, Sendable { let deleteNutritionLogMeal: MutationIdPayload? }
private struct MutationIdPayload: Decodable, Sendable { let id: String }
private struct AffectedRowsPayload: Decodable, Sendable {
    let affectedRows: Int?

    private enum CodingKeys: String, CodingKey {
        case affectedRows = "affected_rows"
    }
}
