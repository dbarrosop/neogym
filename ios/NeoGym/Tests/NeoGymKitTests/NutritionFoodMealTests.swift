import Foundation
import XCTest
@testable import NeoGymKit

final class NutritionFoodMealRepositoryTests: XCTestCase {
    func testDecodesFoodFixturesAndUsesFoodsIndexOperation() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object(["foods": .array([foodFixture])]))])
        let repository = NutritionFoodMealRepository(graphQL: fake)

        let foods = try await repository.listFoods()

        XCTAssertEqual(foods.count, 1)
        XCTAssertEqual(foods[0].name, "Greek yogurt")
        XCTAssertEqual(foods[0].userId, "user-1")
        XCTAssertFalse(foods[0].isPublic)
        XCTAssertEqual(NutritionMath.normalizeMacros(foods[0].macroFields).proteinPer100g, 12)
        let requests = await fake.requestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.operationName, "FoodsIndex")
        XCTAssertTrue(request.query.contains("order_by: [{ isPublic: asc }, { name: asc }]"))
    }

    func testDecodesMealFixturesAndComputesLiveTotals() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object(["meals": .array([mealFixture])]))])
        let repository = NutritionFoodMealRepository(graphQL: fake)

        let meals = try await repository.listMeals()

        XCTAssertEqual(meals.count, 1)
        XCTAssertEqual(meals[0].name, "Breakfast bowl")
        XCTAssertEqual(meals[0].mealIngredients.map(\.foodId), ["food-1", "food-2"])
        XCTAssertEqual(meals[0].macroTotals.kcal, 285.6, accuracy: 0.001)
        XCTAssertEqual(meals[0].macroTotals.protein, 24.56, accuracy: 0.001)
        let requests = await fake.requestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.operationName, "MealsIndex")
        XCTAssertTrue(request.query.contains("mealIngredients(order_by: [{ position: asc }, { id: asc }])"))
    }

    func testFoodCrudVariablesOmitOwnershipAndPublicFields() async throws {
        let fake = FakeGraphQLService(replies: [
            .json(.object(["insertFood": .object(["id": .string("food-new")])])),
            .json(.object(["updateFood": .object(["id": .string("food-new")])])),
            .json(.object(["deleteFood": .object(["id": .string("food-new")])]))
        ])
        let repository = NutritionFoodMealRepository(graphQL: fake)
        let values = FoodFormValues(
            name: "Private oats",
            kcalPer100g: "380",
            fatPer100g: "7.2",
            carbsPer100g: "67",
            proteinPer100g: "13",
            fiberPer100g: "10",
            sugarPer100g: "1"
        )

        let id = try await repository.createFood(values)
        try await repository.updateFood(id: id, values: values)
        try await repository.deleteFood(id: id)

        let requests = await fake.requestsSnapshot()
        let createObject = try XCTUnwrap(requests[0].variables?["object"])
        XCTAssertFalse(createObject.recursivelyContainsKey("userId"))
        XCTAssertFalse(createObject.recursivelyContainsKey("isPublic"))
        XCTAssertEqual(createObject["name"], .string("Private oats"))
        XCTAssertEqual(createObject["kcalPer100g"], .string("380"))

        let updateSet = try XCTUnwrap(requests[1].variables?["set"])
        XCTAssertFalse(updateSet.recursivelyContainsKey("userId"))
        XCTAssertFalse(updateSet.recursivelyContainsKey("isPublic"))
        XCTAssertEqual(updateSet["proteinPer100g"], .string("13"))
        XCTAssertEqual(requests[2].variables, ["id": .string("food-new")])
    }

    func testCreateMealVariablesUseNestedIngredientsAndOmitOwnershipFields() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "insertMeal": .object(["id": .string("meal-new")])
        ]))])
        let repository = NutritionFoodMealRepository(graphQL: fake)
        let values = MealFormValues(
            name: "Breakfast bowl",
            description: "Prep notes",
            ingredients: [
                MealIngredientFormValues(foodId: "food-1", grams: "200", position: 0),
                MealIngredientFormValues(foodId: "food-2", grams: "80", position: 1)
            ]
        )

        let id = try await repository.createMeal(values)

        XCTAssertEqual(id, "meal-new")
        let requests = await fake.requestsSnapshot()
        let object = try XCTUnwrap(requests.first?.variables?["object"])
        XCTAssertFalse(object.recursivelyContainsKey("userId"))
        XCTAssertFalse(object.recursivelyContainsKey("isPublic"))
        XCTAssertFalse(object.recursivelyContainsKey("kind"))
        XCTAssertFalse(object.recursivelyContainsKey("parentKind"))
        XCTAssertEqual(object["name"], .string("Breakfast bowl"))
        let ingredientRows = try XCTUnwrap(object["mealIngredients"]?["data"]?.arrayValue)
        XCTAssertEqual(ingredientRows[0]["foodId"], .string("food-1"))
        XCTAssertEqual(ingredientRows[0]["grams"], .string("200"))
        XCTAssertEqual(ingredientRows[0]["position"], .number(0))
    }

    func testSaveMealVariablesDeleteAndInsertWhenFoodChangesAndNeverUpdateFoodId() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "updateMeal": .object(["id": .string("meal-1")]),
            "deleteMealIngredients": .object(["affected_rows": .number(1)]),
            "insertMealIngredients": .object(["affected_rows": .number(1)]),
            "update_mealIngredients_many": .array([.object(["affected_rows": .number(1)])])
        ]))])
        let repository = NutritionFoodMealRepository(graphQL: fake)
        let initial = MealFormValues(
            name: "Old",
            description: "Old notes",
            ingredients: [
                MealIngredientFormValues(id: "ingredient-keep", foodId: "food-1", grams: "100", position: 0),
                MealIngredientFormValues(id: "ingredient-change", foodId: "food-2", grams: "50", position: 1),
                MealIngredientFormValues(id: "ingredient-drop", foodId: "food-3", grams: "25", position: 2)
            ]
        )
        let next = MealFormValues(
            name: "Updated",
            description: "",
            ingredients: [
                MealIngredientFormValues(id: "ingredient-keep", foodId: "food-1", grams: "125", position: 0),
                MealIngredientFormValues(id: "ingredient-change", foodId: "food-4", grams: "75", position: 1),
                MealIngredientFormValues(foodId: "food-5", grams: "30", position: 2)
            ]
        )

        try await repository.saveMeal(id: "meal-1", initialValues: initial, values: next)

        let requests = await fake.requestsSnapshot()
        let variables = try XCTUnwrap(requests.first?.variables)
        XCTAssertFalse(JSONValue.object(variables).recursivelyContainsKey("userId"))
        XCTAssertFalse(JSONValue.object(variables).recursivelyContainsKey("isPublic"))
        XCTAssertEqual(variables["set"]?["description"], .null)
        XCTAssertEqual(
            variables["deleteIngredientIds"]?.arrayValue,
            [.string("ingredient-change"), .string("ingredient-drop")]
        )
        XCTAssertEqual(variables["hasDeleteIngredients"], .bool(true))

        let insertRows = try XCTUnwrap(variables["insertIngredients"]?.arrayValue)
        XCTAssertEqual(insertRows.map { $0["foodId"] }, [.string("food-4"), .string("food-5")])
        XCTAssertEqual(insertRows.map { $0["mealId"] }, [.string("meal-1"), .string("meal-1")])

        let updates = try XCTUnwrap(variables["ingredientUpdates"]?.arrayValue)
        XCTAssertEqual(updates.count, 1)
        XCTAssertEqual(updates[0]["where"]?["id"]?["_eq"], .string("ingredient-keep"))
        XCTAssertEqual(updates[0]["_set"]?["grams"], .string("125"))
        XCTAssertFalse(updates[0].recursivelyContainsKey("foodId"))
    }

    func testEditMealLoadsMealAndFoodPickerPayloads() async throws {
        let fake = FakeGraphQLService(replies: [
            .json(.object(["meal": mealFixtureWithoutFoodObjects])),
            .json(.object(["foods": .array([foodFixture])]))
        ])
        let repository = NutritionFoodMealRepository(graphQL: fake)

        let payload = try await repository.editMeal(id: "meal-1")

        XCTAssertEqual(payload.meal?.id, "meal-1")
        XCTAssertEqual(payload.foods.map(\.name), ["Greek yogurt"])
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.map(\.operationName), ["EditMeal", "MealFormFoods"])
    }
}

@MainActor
final class NutritionFoodMealFormTests: XCTestCase {
    func testFoodFormValidationTrimsAndNormalizesCommaDecimals() {
        let model = FoodFormModel(initialValues: FoodFormValues(
            name: "  Yogurt  ",
            kcalPer100g: "120,5",
            fatPer100g: "3,2",
            carbsPer100g: "5",
            proteinPer100g: "12",
            fiberPer100g: "0",
            sugarPer100g: "4"
        ))

        XCTAssertEqual(model.valuesForSubmit(), FoodFormValues(
            name: "Yogurt",
            kcalPer100g: "120.5",
            fatPer100g: "3.2",
            carbsPer100g: "5",
            proteinPer100g: "12",
            fiberPer100g: "0",
            sugarPer100g: "4"
        ))
    }

    func testMealFormValidationRequiresFoodAndPositiveGrams() {
        let foods = [foodFixtureModel]
        let model = MealFormModel(initialValues: MealFormValues(
            name: " Bowl ",
            description: " notes ",
            ingredients: [MealIngredientFormValues(foodId: "food-1", grams: "0", position: 0)]
        ))

        XCTAssertNil(model.valuesForSubmit(availableFoods: foods))
        XCTAssertEqual(model.errorMessage, "Ingredient grams must be greater than zero.")

        model.updateIngredient(stableId: model.ingredients[0].stableId, grams: "150,5")
        XCTAssertEqual(model.valuesForSubmit(availableFoods: foods), MealFormValues(
            name: "Bowl",
            description: "notes",
            ingredients: [MealIngredientFormValues(foodId: "food-1", grams: "150.5", position: 0)]
        ))
    }

    func testMealFormTotalsUseLiveFoodValuesForTemplates() {
        let foods = [foodFixtureModel]
        let model = MealFormModel(initialValues: MealFormValues(
            name: "Bowl",
            description: "",
            ingredients: [MealIngredientFormValues(foodId: "food-1", grams: "200", position: 0)]
        ))

        let totals = model.macroTotals(availableFoods: foods)

        XCTAssertEqual(totals.kcal, 240)
        XCTAssertEqual(totals.protein, 24)
    }
}

final class NutritionFoodMealErrorMapperTests: XCTestCase {
    func testMapsFoodRestrictConstraintToFriendlyCopy() {
        let error = GraphQLDomainError.graphQLErrors([
            GraphQLErrorDetail(
                message: "update or delete on table foods violates foreign key constraint",
                code: "constraint-violation",
                constraintName: "meal_ingredients_food_id_fkey"
            )
        ])

        XCTAssertEqual(
            NutritionFoodMealErrorMapper.foodMessage(for: error),
            "This food is used by a meal template. Remove it from meals before deleting it."
        )
    }

    func testMapsMealPlanRestrictConstraintToFriendlyCopy() {
        let error = GraphQLDomainError.graphQLErrors([
            GraphQLErrorDetail(
                message: "delete blocked",
                code: "constraint-violation",
                constraintName: "nutrition_plan_meals_meal_id_fkey"
            )
        ])

        XCTAssertEqual(
            NutritionFoodMealErrorMapper.mealMessage(for: error),
            "This meal is used by a nutrition plan. Remove it from plan slots before deleting it. "
                + "Logged days do not block deletion."
        )
    }
}

private let foodFixture: JSONValue = .object([
    "id": .string("food-1"),
    "name": .string("Greek yogurt"),
    "userId": .string("user-1"),
    "isPublic": .bool(false),
    "kcalPer100g": .string("120"),
    "fatPer100g": .string("3.5"),
    "carbsPer100g": .string("5"),
    "proteinPer100g": .string("12"),
    "fiberPer100g": .string("0"),
    "sugarPer100g": .string("4")
])

private let publicFoodFixture: JSONValue = .object([
    "id": .string("food-2"),
    "name": .string("Blueberries"),
    "userId": .null,
    "isPublic": .bool(true),
    "kcalPer100g": .string("57"),
    "fatPer100g": .string("0.3"),
    "carbsPer100g": .string("14"),
    "proteinPer100g": .string("0.7"),
    "fiberPer100g": .string("2.4"),
    "sugarPer100g": .string("10")
])

private let mealFixture: JSONValue = .object([
    "id": .string("meal-1"),
    "name": .string("Breakfast bowl"),
    "description": .string("Yogurt with berries."),
    "updatedAt": .string("2026-06-26T10:00:00.000Z"),
    "mealIngredients": .array([
        .object([
            "id": .string("ingredient-1"),
            "foodId": .string("food-1"),
            "grams": .string("200"),
            "position": .number(0),
            "food": foodFixture
        ]),
        .object([
            "id": .string("ingredient-2"),
            "foodId": .string("food-2"),
            "grams": .string("80"),
            "position": .number(1),
            "food": publicFoodFixture
        ])
    ])
])

private let mealFixtureWithoutFoodObjects: JSONValue = .object([
    "id": .string("meal-1"),
    "name": .string("Breakfast bowl"),
    "description": .string("Yogurt with berries."),
    "mealIngredients": .array([
        .object([
            "id": .string("ingredient-1"),
            "foodId": .string("food-1"),
            "grams": .string("200"),
            "position": .number(0)
        ])
    ])
])

private let foodFixtureModel = Food(
    id: "food-1",
    name: "Greek yogurt",
    userId: "user-1",
    isPublic: false,
    kcalPer100g: .string("120"),
    fatPer100g: .string("3.5"),
    carbsPer100g: .string("5"),
    proteinPer100g: .string("12"),
    fiberPer100g: .string("0"),
    sugarPer100g: .string("4")
)

private extension JSONValue {
    subscript(key: String) -> JSONValue? {
        guard case let .object(object) = self else { return nil }
        return object[key]
    }

    func recursivelyContainsKey(_ key: String) -> Bool {
        switch self {
        case let .object(object):
            object.keys.contains(key) || object.values.contains { $0.recursivelyContainsKey(key) }
        case let .array(values):
            values.contains { $0.recursivelyContainsKey(key) }
        case .null, .bool, .number, .string:
            false
        }
    }
}
