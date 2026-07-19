import Foundation

public protocol NutritionFoodMealRepositoryProtocol: Sendable {
    func listFoods() async throws -> [Food]
    func foodListUpdates() -> AsyncThrowingStream<[Food], Error>
    func foodUpdates(id: String) -> AsyncThrowingStream<Food?, Error>
    func food(id: String) async throws -> Food?
    func editFood(id: String) async throws -> Food?
    func createFood(_ values: FoodFormValues) async throws -> String
    func updateFood(id: String, values: FoodFormValues) async throws
    func deleteFood(id: String) async throws

    func listMeals() async throws -> [Meal]
    func mealListUpdates() -> AsyncThrowingStream<[Meal], Error>
    func mealUpdates(id: String) -> AsyncThrowingStream<Meal?, Error>
    func meal(id: String) async throws -> Meal?
    func editMeal(id: String) async throws -> MealEditPayload
    func foodsForMealForm() async throws -> [Food]
    func createMeal(_ values: MealFormValues) async throws -> String
    func saveMeal(id: String, initialValues: MealFormValues, values: MealFormValues) async throws
    func deleteMeal(id: String) async throws

    func listPlans() async throws -> [NutritionPlan]
    func nutritionPlanListUpdates() -> AsyncThrowingStream<[NutritionPlan], Error>
    func nutritionPlanUpdates(id: String) -> AsyncThrowingStream<NutritionPlan?, Error>
    func plan(id: String) async throws -> NutritionPlan?
    func editPlan(id: String) async throws -> NutritionPlanEditPayload
    func mealsForPlanForm() async throws -> [Meal]
    func createPlan(_ values: NutritionPlanFormValues) async throws -> String
    func savePlan(id: String, initialValues: NutritionPlanFormValues, values: NutritionPlanFormValues) async throws
    func deletePlan(id: String) async throws

    func listNutritionDays() async throws -> [NutritionDay]
    func nutritionOverview() async throws -> NutritionOverviewPayload
    func nutritionOverviewEmissions() -> AsyncThrowingStream<GraphQLQueryEmission<NutritionOverviewPayload>, Error>
    func nutritionOverviewUpdates() -> AsyncThrowingStream<NutritionOverviewPayload, Error>
    func openDailyIntake(date: String) async throws -> DailyIntakePayload
    func createNutritionDay(date: String, nutritionPlanId: String?) async throws -> String
    func updateNutritionDayPlan(dayId: String, nutritionPlanId: String?) async throws
    func deleteNutritionDay(id: String) async throws
    func logFood(_ values: LogFoodValues) async throws -> String
    func logAdHocFood(_ values: LogAdHocFoodValues) async throws -> String
    func logMeal(_ values: LogMealValues) async throws -> String
    func logSelectedPlan(_ materialization: PlanLogMaterialization) async throws -> PlanLogMutationResult
    func updateLogEntry(id: String, values: LogEntryUpdateValues) async throws
    func updateLogMeal(id: String, values: LogMealUpdateValues) async throws
    func deleteLogEntry(id: String) async throws
    func deleteLogMeal(id: String) async throws
}

public extension NutritionFoodMealRepositoryProtocol {
    func foodListUpdates() -> AsyncThrowingStream<[Food], Error> {
        singleValueUpdates { try await listFoods() }
    }

    func foodUpdates(id: String) -> AsyncThrowingStream<Food?, Error> {
        singleValueUpdates { try await food(id: id) }
    }

    func mealListUpdates() -> AsyncThrowingStream<[Meal], Error> {
        singleValueUpdates { try await listMeals() }
    }

    func mealUpdates(id: String) -> AsyncThrowingStream<Meal?, Error> {
        singleValueUpdates { try await meal(id: id) }
    }

    func nutritionPlanListUpdates() -> AsyncThrowingStream<[NutritionPlan], Error> {
        singleValueUpdates { try await listPlans() }
    }

    func nutritionPlanUpdates(id: String) -> AsyncThrowingStream<NutritionPlan?, Error> {
        singleValueUpdates { try await plan(id: id) }
    }

    func nutritionOverview() async throws -> NutritionOverviewPayload {
        NutritionOverviewPayload(days: try await listNutritionDays(), dailyEnergyEntries: [])
    }

    func nutritionOverviewEmissions() -> AsyncThrowingStream<GraphQLQueryEmission<NutritionOverviewPayload>, Error> {
        singleValueUpdates { .fresh(try await nutritionOverview()) }
    }

    func nutritionOverviewUpdates() -> AsyncThrowingStream<NutritionOverviewPayload, Error> {
        let emissions = nutritionOverviewEmissions()
        return AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    for try await emission in emissions {
                        continuation.yield(emission.value)
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { @Sendable _ in task.cancel() }
        }
    }
}

public struct NutritionFoodMealRepository: NutritionFoodMealRepositoryProtocol {
    private let graphQL: any GraphQLServicing

    public init(graphQL: any GraphQLServicing) {
        self.graphQL = graphQL
    }
}

public extension NutritionFoodMealRepository {
    func listFoods() async throws -> [Food] {
        let data: FoodsIndexData = try await graphQL.execute(
            query: Self.foodsIndexQuery,
            operationName: "FoodsIndex"
        )
        return data.foods
    }

    func foodListUpdates() -> AsyncThrowingStream<[Food], Error> {
        graphQL.cachedValues(
            FoodsIndexData.self,
            query: Self.foodsIndexQuery,
            operationName: "FoodsIndex",
            namespace: "foods",
            tags: ["foods"],
            transform: \FoodsIndexData.foods
        )
    }

    func foodUpdates(id: String) -> AsyncThrowingStream<Food?, Error> {
        graphQL.cachedValues(
            FoodDetailData.self,
            query: Self.foodDetailQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "FoodDetail",
            namespace: "foods",
            tags: ["foods"],
            transform: \FoodDetailData.food
        )
    }

    func food(id: String) async throws -> Food? {
        let data: FoodDetailData = try await graphQL.execute(
            query: Self.foodDetailQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "FoodDetail"
        )
        return data.food
    }

    func editFood(id: String) async throws -> Food? {
        let data: EditFoodData = try await graphQL.execute(
            query: Self.editFoodQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "EditFood"
        )
        return data.food
    }

    func createFood(_ values: FoodFormValues) async throws -> String {
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

    func updateFood(id: String, values: FoodFormValues) async throws {
        let _: SaveFoodData = try await graphQL.execute(
            query: Self.saveFoodMutation,
            variables: ["id": GraphQLScalars.uuid(id), "set": Self.foodObject(values)],
            operationName: "SaveFood"
        )
    }

    func deleteFood(id: String) async throws {
        let _: DeleteFoodData = try await graphQL.execute(
            query: Self.deleteFoodMutation,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "DeleteFood"
        )
    }
}

public extension NutritionFoodMealRepository {
    func listMeals() async throws -> [Meal] {
        let data: MealsIndexData = try await graphQL.execute(
            query: Self.mealsIndexQuery,
            operationName: "MealsIndex"
        )
        return data.meals
    }

    func mealListUpdates() -> AsyncThrowingStream<[Meal], Error> {
        graphQL.cachedValues(
            MealsIndexData.self,
            query: Self.mealsIndexQuery,
            operationName: "MealsIndex",
            namespace: "meals",
            tags: ["meals"],
            transform: \MealsIndexData.meals
        )
    }

    func mealUpdates(id: String) -> AsyncThrowingStream<Meal?, Error> {
        graphQL.cachedValues(
            MealDetailData.self,
            query: Self.mealDetailQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "MealDetail",
            namespace: "meals",
            tags: ["meals"],
            transform: \MealDetailData.meal
        )
    }

    func meal(id: String) async throws -> Meal? {
        let data: MealDetailData = try await graphQL.execute(
            query: Self.mealDetailQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "MealDetail"
        )
        return data.meal
    }

    func editMeal(id: String) async throws -> MealEditPayload {
        let data: EditMealData = try await graphQL.execute(
            query: Self.editMealQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "EditMeal"
        )
        let foods = try await foodsForMealForm()
        return MealEditPayload(meal: data.meal, foods: foods)
    }

    func foodsForMealForm() async throws -> [Food] {
        let data: MealFormFoodsData = try await graphQL.execute(
            query: Self.mealFormFoodsQuery,
            operationName: "MealFormFoods"
        )
        return data.foods
    }

    func createMeal(_ values: MealFormValues) async throws -> String {
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

    func saveMeal(id: String, initialValues: MealFormValues, values: MealFormValues) async throws {
        let _: SaveMealData = try await graphQL.execute(
            query: Self.saveMealMutation,
            variables: Self.saveMealVariables(id: id, initialValues: initialValues, values: values),
            operationName: "SaveMeal"
        )
    }

    func deleteMeal(id: String) async throws {
        let _: DeleteMealData = try await graphQL.execute(
            query: Self.deleteMealMutation,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "DeleteMeal"
        )
    }
}

public extension NutritionFoodMealRepository {
    func listPlans() async throws -> [NutritionPlan] {
        let data: PlansIndexData = try await graphQL.execute(
            query: Self.plansIndexQuery,
            operationName: "PlansIndex"
        )
        return data.nutritionPlans
    }

    func nutritionPlanListUpdates() -> AsyncThrowingStream<[NutritionPlan], Error> {
        graphQL.cachedValues(
            PlansIndexData.self,
            query: Self.plansIndexQuery,
            operationName: "PlansIndex",
            namespace: "nutrition-plans",
            tags: ["nutrition-plans"],
            transform: \PlansIndexData.nutritionPlans
        )
    }

    func nutritionPlanUpdates(id: String) -> AsyncThrowingStream<NutritionPlan?, Error> {
        graphQL.cachedValues(
            NutritionPlanDetailData.self,
            query: Self.nutritionPlanDetailQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "NutritionPlanDetail",
            namespace: "nutrition-plans",
            tags: ["nutrition-plans"],
            transform: \NutritionPlanDetailData.nutritionPlan
        )
    }

    func plan(id: String) async throws -> NutritionPlan? {
        let data: NutritionPlanDetailData = try await graphQL.execute(
            query: Self.nutritionPlanDetailQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "NutritionPlanDetail"
        )
        return data.nutritionPlan
    }

    func editPlan(id: String) async throws -> NutritionPlanEditPayload {
        let data: EditNutritionPlanData = try await graphQL.execute(
            query: Self.editNutritionPlanQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "EditNutritionPlan"
        )
        let meals = try await mealsForPlanForm()
        let foods = try await foodsForMealForm()
        return NutritionPlanEditPayload(plan: data.nutritionPlan, meals: meals, foods: foods)
    }

    func mealsForPlanForm() async throws -> [Meal] {
        let data: NutritionPlanFormMealsData = try await graphQL.execute(
            query: Self.nutritionPlanFormMealsQuery,
            operationName: "NutritionPlanFormMeals"
        )
        return data.meals
    }

    func createPlan(_ values: NutritionPlanFormValues) async throws -> String {
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

    func savePlan(
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

    func deletePlan(id: String) async throws {
        let _: DeleteNutritionPlanData = try await graphQL.execute(
            query: Self.deleteNutritionPlanMutation,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "DeleteNutritionPlan"
        )
    }
}

public extension NutritionFoodMealRepository {
    func listNutritionDays() async throws -> [NutritionDay] {
        try await nutritionOverview().days
    }

    func nutritionOverview() async throws -> NutritionOverviewPayload {
        let data: NutritionDaysIndexData = try await graphQL.execute(
            query: Self.nutritionDaysIndexQuery,
            operationName: "NutritionDaysIndex"
        )
        return Self.overviewPayload(from: data)
    }

    func nutritionOverviewEmissions() -> AsyncThrowingStream<GraphQLQueryEmission<NutritionOverviewPayload>, Error> {
        graphQL.cachedEmissions(
            NutritionDaysIndexData.self,
            query: Self.nutritionDaysIndexQuery,
            operationName: "NutritionDaysIndex",
            namespace: "nutrition-overview",
            tags: ["nutrition-days", "daily-energy"],
            transform: Self.overviewPayload
        )
    }

    private static func overviewPayload(from data: NutritionDaysIndexData) -> NutritionOverviewPayload {
        NutritionOverviewPayload(
            days: data.nutritionDays,
            dailyEnergyEntries: data.dailyEnergyEntries ?? []
        )
    }

    func openDailyIntake(date: String) async throws -> DailyIntakePayload {
        let data: DailyIntakeLogData = try await graphQL.execute(
            query: Self.dailyIntakeLogQuery,
            variables: ["date": GraphQLScalars.date(date)],
            operationName: "DailyIntakeLog"
        )
        return DailyIntakePayload(
            day: data.nutritionDays.first,
            dailyEnergy: data.dailyEnergyEntries.first,
            nutritionPlans: data.nutritionPlans,
            meals: data.meals,
            foods: data.foods
        )
    }

    func createNutritionDay(date: String, nutritionPlanId: String? = nil) async throws -> String {
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

    func updateNutritionDayPlan(dayId: String, nutritionPlanId: String?) async throws {
        let _: UpdateNutritionDayData = try await graphQL.execute(
            query: Self.updateNutritionDayPlanMutation,
            variables: [
                "id": GraphQLScalars.uuid(dayId),
                "nutritionPlanId": nutritionPlanId.map(GraphQLScalars.uuid) ?? .null
            ],
            operationName: "UpdateNutritionDayPlan"
        )
    }

    func deleteNutritionDay(id: String) async throws {
        let _: DeleteNutritionDayData = try await graphQL.execute(
            query: Self.deleteNutritionDayMutation,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "DeleteNutritionDay"
        )
    }

    func logFood(_ values: LogFoodValues) async throws -> String {
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

    func logAdHocFood(_ values: LogAdHocFoodValues) async throws -> String {
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

    func logMeal(_ values: LogMealValues) async throws -> String {
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

    func logSelectedPlan(_ materialization: PlanLogMaterialization) async throws -> PlanLogMutationResult {
        let data: InsertSelectedPlanLogData = try await graphQL.execute(
            query: Self.logSelectedPlanMutation,
            variables: [
                "mealObjects": Self.planLogMealObjects(materialization.mealObjects),
                "entryObjects": Self.planLogEntryObjects(materialization.entryObjects),
                "hasMealObjects": .bool(!materialization.mealObjects.isEmpty),
                "hasEntryObjects": .bool(!materialization.entryObjects.isEmpty)
            ],
            operationName: "LogSelectedPlan"
        )
        return PlanLogMutationResult(
            mealRows: data.insertNutritionLogMeals?.affectedRows ?? 0,
            entryRows: data.insertNutritionLogEntries?.affectedRows ?? 0
        )
    }

    func updateLogEntry(id: String, values: LogEntryUpdateValues) async throws {
        let _: UpdateNutritionLogEntryData = try await graphQL.execute(
            query: Self.updateNutritionLogEntryMutation,
            variables: ["id": GraphQLScalars.uuid(id), "set": Self.logEntryUpdateSet(values)],
            operationName: "UpdateNutritionLogEntry"
        )
    }

    func updateLogMeal(id: String, values: LogMealUpdateValues) async throws {
        let _: UpdateNutritionLogMealData = try await graphQL.execute(
            query: Self.updateNutritionLogMealMutation,
            variables: ["id": GraphQLScalars.uuid(id), "set": Self.logMealUpdateSet(values)],
            operationName: "UpdateNutritionLogMeal"
        )
    }

    func deleteLogEntry(id: String) async throws {
        let _: DeleteNutritionLogEntryData = try await graphQL.execute(
            query: Self.deleteNutritionLogEntryMutation,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "DeleteNutritionLogEntry"
        )
    }

    func deleteLogMeal(id: String) async throws {
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
private struct NutritionDaysIndexData: Decodable, Sendable {
    let nutritionDays: [NutritionDay]
    let dailyEnergyEntries: [DailyEnergy]?
}
private struct DailyIntakeLogData: Decodable, Sendable {
    let nutritionDays: [NutritionDay]
    let dailyEnergyEntries: [DailyEnergy]
    let nutritionPlans: [NutritionPlan]
    let meals: [Meal]
    let foods: [Food]
}
private struct InsertNutritionDayData: Decodable, Sendable { let insertNutritionDay: MutationIdPayload? }
private struct UpdateNutritionDayData: Decodable, Sendable { let updateNutritionDay: MutationIdPayload? }
private struct DeleteNutritionDayData: Decodable, Sendable { let deleteNutritionDay: MutationIdPayload? }
private struct InsertNutritionLogEntryData: Decodable, Sendable { let insertNutritionLogEntry: MutationIdPayload? }
private struct InsertNutritionLogMealData: Decodable, Sendable { let insertNutritionLogMeal: MutationIdPayload? }
private struct InsertSelectedPlanLogData: Decodable, Sendable {
    let insertNutritionLogMeals: AffectedRowsPayload?
    let insertNutritionLogEntries: AffectedRowsPayload?
}
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
