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
private struct MutationIdPayload: Decodable, Sendable { let id: String }
private struct AffectedRowsPayload: Decodable, Sendable {
    let affectedRows: Int?

    private enum CodingKeys: String, CodingKey {
        case affectedRows = "affected_rows"
    }
}
