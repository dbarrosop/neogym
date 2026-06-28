import Foundation
import XCTest
@testable import NeoGymKit

final class NutritionDayRepositoryTests: XCTestCase {
    func testDecodesNutritionDayFixturesAndUsesSnapshotTotals() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "nutritionDays": .array([nutritionDayFixture])
        ]))])
        let repository = NutritionFoodMealRepository(graphQL: fake)

        let days = try await repository.listNutritionDays()

        XCTAssertEqual(days.count, 1)
        XCTAssertEqual(days[0].logDate, "2026-06-27")
        XCTAssertEqual(days[0].nutritionPlan?.name, "Training day")
        XCTAssertEqual(days[0].allLogEntries.count, 2)
        XCTAssertEqual(days[0].loggedTotals.kcal, 250, accuracy: 0.001)
        XCTAssertEqual(days[0].loggedTotals.protein, 12.5, accuracy: 0.001)
        XCTAssertNotEqual(days[0].nutritionPlan?.macroTotals.kcal, days[0].loggedTotals.kcal)
        let requests = await fake.requestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.operationName, "NutritionDaysIndex")
        XCTAssertTrue(request.query.contains("nutritionLogMeals {"))
        for requiredField in ["nutritionDayId", "mealId", "nutritionPlanMealId", "name", "slotTime", "position"] {
            XCTAssertTrue(request.query.contains(requiredField), "NutritionDaysIndex should select \(requiredField)")
        }
        XCTAssertTrue(request.query.contains("nutritionLogEntries(where: { nutritionLogMealId: { _is_null: true } })"))
    }

    func testOpenDailyIntakeDecodesPlansMealsFoodsAndSelectedPlan() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "nutritionDays": .array([nutritionDayFixture]),
            "nutritionPlans": .array([planFixture]),
            "meals": .array([mealFixture]),
            "foods": .array([snapshotFoodFixture])
        ]))])
        let repository = NutritionFoodMealRepository(graphQL: fake)

        let payload = try await repository.openDailyIntake(date: "2026-06-27")

        XCTAssertEqual(payload.day?.id, "day-1")
        XCTAssertEqual(payload.selectedPlan?.id, "plan-1")
        XCTAssertEqual(payload.meals.map(\.name), ["Breakfast bowl"])
        XCTAssertEqual(payload.foods.map(\.name), ["Greek yogurt"])
        let requests = await fake.requestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.operationName, "DailyIntakeLog")
        XCTAssertEqual(request.variables?["date"], .string("2026-06-27"))
    }

    func testLogFoodVariablesOmitOwnershipAndSnapshotWrites() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "insertNutritionLogEntry": .object(["id": .string("entry-new")])
        ]))])
        let repository = NutritionFoodMealRepository(graphQL: fake)

        let id = try await repository.logFood(LogFoodValues(
            dayId: "day-1",
            foodId: "food-1",
            grams: "125.5",
            slotTime: "09:45",
            position: 3
        ))

        XCTAssertEqual(id, "entry-new")
        let requests = await fake.requestsSnapshot()
        let object = try XCTUnwrap(requests.first?.variables?["object"])
        XCTAssertEqual(object["nutritionDayId"], .string("day-1"))
        XCTAssertEqual(object["foodId"], .string("food-1"))
        XCTAssertEqual(object["grams"], .string("125.5"))
        XCTAssertEqual(object["slotTime"], .string("09:45"))
        XCTAssertEqual(object["position"], .number(3))
        XCTAssertFalse(object.recursivelyContainsKey("userId"))
        XCTAssertFalse(object.recursivelyContainsKey("snapshotFoodName"))
        XCTAssertFalse(object.recursivelyContainsKey("snapshotKcalPer100g"))
        XCTAssertFalse(object.recursivelyContainsKey("isPublic"))
    }

    func testLogMealVariablesUseNestedInsertSameDayIdAndNoSnapshotWrites() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "insertNutritionLogMeal": .object(["id": .string("group-new")])
        ]))])
        let repository = NutritionFoodMealRepository(graphQL: fake)
        let planSlot = NutritionPlanMealSlot(
            id: "slot-1",
            mealId: "meal-1",
            slotTime: "08:00:00",
            label: "Breakfast",
            position: 0,
            meal: mealFixtureModel
        )

        let id = try await repository.logMeal(LogMealValues(
            dayId: "day-1",
            meal: mealFixtureModel,
            planSlot: planSlot,
            name: "Breakfast",
            slotTime: "10:10",
            position: 4
        ))

        XCTAssertEqual(id, "group-new")
        let requests = await fake.requestsSnapshot()
        let object = try XCTUnwrap(requests.first?.variables?["object"])
        XCTAssertEqual(object["nutritionDayId"], .string("day-1"))
        XCTAssertEqual(object["mealId"], .string("meal-1"))
        XCTAssertEqual(object["nutritionPlanMealId"], .string("slot-1"))
        XCTAssertEqual(object["name"], .string("Breakfast"))
        XCTAssertEqual(object["slotTime"], .string("10:10"))
        XCTAssertNotEqual(object["slotTime"], .string(planSlot.slotTime))
        let entries = try XCTUnwrap(object["nutritionLogEntries"]?["data"]?.arrayValue)
        XCTAssertEqual(entries.count, 2)
        XCTAssertEqual(entries.map { $0["nutritionDayId"] }, [.string("day-1"), .string("day-1")])
        XCTAssertEqual(entries.map { $0["foodId"] }, [.string("food-1"), .string("food-2")])
        XCTAssertEqual(entries.map { $0["slotTime"] }, [.string("10:10"), .string("10:10")])
        XCTAssertFalse(object.recursivelyContainsKey("userId"))
        XCTAssertFalse(object.recursivelyContainsKey("snapshotFoodName"))
        XCTAssertFalse(object.recursivelyContainsKey("snapshotProteinPer100g"))
    }

    func testUpdateVariablesSupportGramsPositionsAndTimesOnly() async throws {
        let fake = FakeGraphQLService(replies: [
            .json(.object(["updateNutritionLogEntry": .object(["id": .string("entry-1")])])),
            .json(.object(["updateNutritionLogMeal": .object(["id": .string("group-1")])]))
        ])
        let repository = NutritionFoodMealRepository(graphQL: fake)

        try await repository.updateLogEntry(
            id: "entry-1",
            values: LogEntryUpdateValues(grams: "150", position: 2, slotTime: "11:30")
        )
        try await repository.updateLogMeal(
            id: "group-1",
            values: LogMealUpdateValues(name: "Brunch", position: 1, slotTime: "11:15")
        )

        let requests = await fake.requestsSnapshot()
        let entrySet = try XCTUnwrap(requests[0].variables?["set"])
        XCTAssertEqual(entrySet["grams"], .string("150"))
        XCTAssertEqual(entrySet["position"], .number(2))
        XCTAssertEqual(entrySet["slotTime"], .string("11:30"))
        XCTAssertFalse(entrySet.recursivelyContainsKey("foodId"))
        XCTAssertFalse(entrySet.recursivelyContainsKey("nutritionDayId"))
        XCTAssertFalse(entrySet.recursivelyContainsKey("snapshotFoodName"))

        let groupSet = try XCTUnwrap(requests[1].variables?["set"])
        XCTAssertEqual(groupSet["name"], .string("Brunch"))
        XCTAssertEqual(groupSet["position"], .number(1))
        XCTAssertEqual(groupSet["slotTime"], .string("11:15"))
        XCTAssertFalse(groupSet.recursivelyContainsKey("mealId"))
        XCTAssertFalse(groupSet.recursivelyContainsKey("nutritionPlanMealId"))
    }

    func testDayPlanAndDeleteVariablesOmitOwnership() async throws {
        let fake = FakeGraphQLService(replies: [
            .json(.object(["insertNutritionDay": .object(["id": .string("day-2")])])),
            .json(.object(["updateNutritionDay": .object(["id": .string("day-2")])])),
            .json(.object(["deleteNutritionDay": .object(["id": .string("day-2")])]))
        ])
        let repository = NutritionFoodMealRepository(graphQL: fake)

        _ = try await repository.createNutritionDay(date: "2026-06-28", nutritionPlanId: "plan-1")
        try await repository.updateNutritionDayPlan(dayId: "day-2", nutritionPlanId: nil)
        try await repository.deleteNutritionDay(id: "day-2")

        let requests = await fake.requestsSnapshot()
        let createObject = try XCTUnwrap(requests[0].variables?["object"])
        XCTAssertEqual(createObject["logDate"], .string("2026-06-28"))
        XCTAssertEqual(createObject["nutritionPlanId"], .string("plan-1"))
        XCTAssertFalse(createObject.recursivelyContainsKey("userId"))
        XCTAssertEqual(requests[1].variables?["nutritionPlanId"], .null)
        XCTAssertEqual(requests[2].variables, ["id": .string("day-2")])
    }
}

@MainActor
final class DailyIntakeViewModelTests: XCTestCase {
    func testViewModelLogsFoodWithDefaultNextPositionAndRefreshes() async throws {
        let fake = FakeGraphQLService(replies: [
            .json(.object([
                "nutritionDays": .array([nutritionDayFixture]),
                "nutritionPlans": .array([planFixture]),
                "meals": .array([mealFixture]),
                "foods": .array([snapshotFoodFixture])
            ])),
            .json(.object(["insertNutritionLogEntry": .object(["id": .string("entry-new")])])),
            .json(.object([
                "nutritionDays": .array([nutritionDayFixture]),
                "nutritionPlans": .array([planFixture]),
                "meals": .array([mealFixture]),
                "foods": .array([snapshotFoodFixture])
            ]))
        ])
        let repository = NutritionFoodMealRepository(graphQL: fake)
        let viewModel = DailyIntakeViewModel(date: "2026-06-27", repository: repository)

        await viewModel.load()
        let didLog = await viewModel.logFood(foodId: "food-1", grams: "100", slotTime: "14:05")

        XCTAssertTrue(didLog)
        let requests = await fake.requestsSnapshot()
        let object = try XCTUnwrap(requests[1].variables?["object"])
        XCTAssertEqual(object["position"], .number(2))
    }
}

final class NutritionDayGroupingTests: XCTestCase {
    func testDayIntakeSlotsGroupBySupportedTimesAndUseSnapshotTotals() {
        let day = NutritionDay(
            id: "day-1",
            logDate: "2026-06-27",
            nutritionLogMeals: [loggedMealFixture],
            nutritionLogEntries: [standaloneEntryFixture]
        )

        let slots = day.intakeSlots

        XCTAssertEqual(slots.map(\.key), ["08:30", "10:15"])
        XCTAssertEqual(slots[0].mealGroups.map(\.name), ["Breakfast"])
        XCTAssertEqual(slots[0].entries.map(\.mealName), ["Breakfast"])
        XCTAssertEqual(slots[0].totals.kcal, 150)
        XCTAssertEqual(slots[1].entries.map(\.entry.snapshotFoodName), ["Blueberries snapshot"])
        XCTAssertEqual(day.loggedTotals.kcal, 250)
    }
}

private let snapshotFoodFixture: JSONValue = .object([
    "id": .string("food-1"),
    "name": .string("Greek yogurt"),
    "userId": .string("user-1"),
    "isPublic": .bool(false),
    "kcalPer100g": .string("999"),
    "fatPer100g": .string("99"),
    "carbsPer100g": .string("99"),
    "proteinPer100g": .string("99"),
    "fiberPer100g": .string("99"),
    "sugarPer100g": .string("99")
])

private let secondFoodFixture: JSONValue = .object([
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
    "mealIngredients": .array([
        .object(["id": .string("ingredient-1"), "foodId": .string("food-1"), "grams": .string("100"), "position": .number(0), "food": snapshotFoodFixture]),
        .object(["id": .string("ingredient-2"), "foodId": .string("food-2"), "grams": .string("50"), "position": .number(1), "food": secondFoodFixture])
    ])
])

private let planFixture: JSONValue = .object([
    "id": .string("plan-1"),
    "name": .string("Training day"),
    "description": .string("Plan with live template values."),
    "nutritionPlanMeals": .array([
        .object([
            "id": .string("slot-1"),
            "mealId": .string("meal-1"),
            "slotTime": .string("08:00:00"),
            "label": .string("Breakfast"),
            "position": .number(0),
            "meal": mealFixture
        ])
    ])
])

private let groupedEntryFixture: JSONValue = .object([
    "id": .string("entry-1"),
    "nutritionDayId": .string("day-1"),
    "nutritionLogMealId": .string("log-meal-1"),
    "foodId": .string("food-1"),
    "grams": .string("150"),
    "position": .number(0),
    "slotTime": .string("08:30:00"),
    "snapshotFoodName": .string("Greek yogurt snapshot"),
    "snapshotKcalPer100g": .string("100"),
    "snapshotFatPer100g": .string("2"),
    "snapshotCarbsPer100g": .string("10"),
    "snapshotProteinPer100g": .string("5"),
    "snapshotFiberPer100g": .string("1"),
    "snapshotSugarPer100g": .string("3")
])

private let standaloneEntryJSONFixture: JSONValue = .object([
    "id": .string("entry-2"),
    "nutritionDayId": .string("day-1"),
    "nutritionLogMealId": .null,
    "foodId": .string("food-2"),
    "grams": .string("50"),
    "position": .number(1),
    "slotTime": .string("10:15:00"),
    "snapshotFoodName": .string("Blueberries snapshot"),
    "snapshotKcalPer100g": .string("200"),
    "snapshotFatPer100g": .string("8"),
    "snapshotCarbsPer100g": .string("20"),
    "snapshotProteinPer100g": .string("10"),
    "snapshotFiberPer100g": .string("4"),
    "snapshotSugarPer100g": .string("6")
])

private let nutritionDayFixture: JSONValue = .object([
    "id": .string("day-1"),
    "userId": .string("user-1"),
    "logDate": .string("2026-06-27"),
    "nutritionPlanId": .string("plan-1"),
    "nutritionPlan": planFixture,
    "nutritionLogMeals": .array([
        .object([
            "id": .string("log-meal-1"),
            "nutritionDayId": .string("day-1"),
            "mealId": .string("meal-1"),
            "nutritionPlanMealId": .string("slot-1"),
            "name": .string("Breakfast"),
            "slotTime": .string("08:30:00"),
            "position": .number(0),
            "nutritionLogEntries": .array([groupedEntryFixture])
        ])
    ]),
    "nutritionLogEntries": .array([standaloneEntryJSONFixture])
])

private let mealFixtureModel = Meal(
    id: "meal-1",
    name: "Breakfast bowl",
    description: "Yogurt with berries.",
    mealIngredients: [
        MealIngredient(id: "ingredient-1", foodId: "food-1", grams: .string("200"), position: 0, food: Food(
            id: "food-1",
            name: "Greek yogurt",
            userId: "user-1",
            isPublic: false,
            kcalPer100g: .string("999"),
            fatPer100g: .string("99"),
            carbsPer100g: .string("99"),
            proteinPer100g: .string("99"),
            fiberPer100g: .string("99"),
            sugarPer100g: .string("99")
        )),
        MealIngredient(id: "ingredient-2", foodId: "food-2", grams: .string("80"), position: 1, food: Food(
            id: "food-2",
            name: "Blueberries",
            userId: nil,
            isPublic: true,
            kcalPer100g: .string("57"),
            fatPer100g: .string("0.3"),
            carbsPer100g: .string("14"),
            proteinPer100g: .string("0.7"),
            fiberPer100g: .string("2.4"),
            sugarPer100g: .string("10")
        ))
    ]
)

private let loggedMealFixture = NutritionLogMeal(
    id: "log-meal-1",
    mealId: "meal-1",
    nutritionPlanMealId: "slot-1",
    name: "Breakfast",
    slotTime: "08:30:00",
    position: 0,
    nutritionLogEntries: [NutritionLogEntry(
        id: "entry-1",
        nutritionDayId: "day-1",
        nutritionLogMealId: "log-meal-1",
        foodId: "food-1",
        grams: .string("150"),
        position: 0,
        slotTime: "08:30:00",
        snapshotFoodName: "Greek yogurt snapshot",
        snapshotKcalPer100g: .string("100"),
        snapshotFatPer100g: .string("2"),
        snapshotCarbsPer100g: .string("10"),
        snapshotProteinPer100g: .string("5"),
        snapshotFiberPer100g: .string("1"),
        snapshotSugarPer100g: .string("3")
    )]
)

private let standaloneEntryFixture = NutritionLogEntry(
    id: "entry-2",
    nutritionDayId: "day-1",
    foodId: "food-2",
    grams: .string("50"),
    position: 1,
    slotTime: "10:15:00",
    snapshotFoodName: "Blueberries snapshot",
    snapshotKcalPer100g: .string("200"),
    snapshotFatPer100g: .string("8"),
    snapshotCarbsPer100g: .string("20"),
    snapshotProteinPer100g: .string("10"),
    snapshotFiberPer100g: .string("4"),
    snapshotSugarPer100g: .string("6")
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
