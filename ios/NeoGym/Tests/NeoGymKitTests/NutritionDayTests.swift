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
        XCTAssertTrue(request.query.contains("nutritionPlanFoods"))
        XCTAssertTrue(request.query.contains("nutritionPlanFoodId"))
        XCTAssertTrue(request.query.contains("source"))
        XCTAssertEqual(days[0].allLogEntries.map(\.source), [.adHoc, .food])
        XCTAssertTrue(days[0].nutritionLogEntries[0].isAdHoc)
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
        XCTAssertEqual(object["nutritionPlanFoodId"], .null)
        XCTAssertEqual(object["grams"], .string("125.5"))
        XCTAssertEqual(object["slotTime"], .string("09:45"))
        XCTAssertEqual(object["position"], .number(3))
        XCTAssertFalse(object.recursivelyContainsKey("userId"))
        XCTAssertFalse(object.recursivelyContainsKey("snapshotFoodName"))
        XCTAssertFalse(object.recursivelyContainsKey("snapshotKcalPer100g"))
        XCTAssertFalse(object.recursivelyContainsKey("isPublic"))
    }

    func testLogPlanFoodVariablesUseStandaloneProvenanceActualTimeAndNoSnapshotWrites() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "insertNutritionLogEntry": .object(["id": .string("entry-new")])
        ]))])
        let repository = NutritionFoodMealRepository(graphQL: fake)

        let id = try await repository.logFood(LogFoodValues(
            dayId: "day-1",
            foodId: "food-2",
            nutritionPlanFoodId: "plan-food-1",
            grams: "80",
            slotTime: "14:30",
            position: 5
        ))

        XCTAssertEqual(id, "entry-new")
        let requests = await fake.requestsSnapshot()
        let object = try XCTUnwrap(requests.first?.variables?["object"])
        XCTAssertEqual(object["nutritionDayId"], .string("day-1"))
        XCTAssertEqual(object["foodId"], .string("food-2"))
        XCTAssertEqual(object["nutritionPlanFoodId"], .string("plan-food-1"))
        XCTAssertEqual(object["grams"], .string("80"))
        XCTAssertEqual(object["slotTime"], .string("14:30"))
        XCTAssertNotEqual(object["slotTime"], .string("08:00:00"))
        XCTAssertFalse(object.recursivelyContainsKey("nutritionLogMealId"))
        XCTAssertFalse(object.recursivelyContainsKey("snapshotFoodName"))
        XCTAssertFalse(object.recursivelyContainsKey("snapshotKcalPer100g"))
    }

    func testLogAdHocFoodVariablesIncludeSnapshotsAndOmitFoodProvenance() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "insertNutritionLogEntry": .object(["id": .string("entry-custom")])
        ]))])
        let repository = NutritionFoodMealRepository(graphQL: fake)

        let id = try await repository.logAdHocFood(LogAdHocFoodValues(
            dayId: "day-1",
            position: 7,
            draft: adHocDraftFixture
        ))

        XCTAssertEqual(id, "entry-custom")
        let requests = await fake.requestsSnapshot()
        let object = try XCTUnwrap(requests.first?.variables?["object"])
        XCTAssertEqual(object["nutritionDayId"], .string("day-1"))
        XCTAssertEqual(object["source"], .string("ad_hoc"))
        XCTAssertEqual(object["snapshotFoodName"], .string("Restaurant bowl"))
        XCTAssertEqual(object["snapshotKcalPer100g"], .string("180"))
        XCTAssertEqual(object["snapshotFatPer100g"], .string("7"))
        XCTAssertEqual(object["snapshotCarbsPer100g"], .string("18"))
        XCTAssertEqual(object["snapshotProteinPer100g"], .string("10"))
        XCTAssertEqual(object["snapshotFiberPer100g"], .string("3"))
        XCTAssertEqual(object["snapshotSugarPer100g"], .string("4"))
        XCTAssertEqual(object["grams"], .string("80"))
        XCTAssertEqual(object["slotTime"], .string("12:45"))
        XCTAssertEqual(object["position"], .number(7))
        XCTAssertFalse(object.recursivelyContainsKey("foodId"))
        XCTAssertFalse(object.recursivelyContainsKey("nutritionPlanFoodId"))
        XCTAssertFalse(object.recursivelyContainsKey("nutritionLogMealId"))
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

    func testUpdateVariablesSupportFoodBackedAndAdHocEditableFields() async throws {
        let fake = FakeGraphQLService(replies: [
            .json(.object(["updateNutritionLogEntry": .object(["id": .string("entry-1")])])),
            .json(.object(["updateNutritionLogMeal": .object(["id": .string("group-1")])])),
            .json(.object(["updateNutritionLogEntry": .object(["id": .string("entry-adhoc")])]))
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
        try await repository.updateLogEntry(
            id: "entry-adhoc",
            values: LogEntryUpdateValues(grams: "80", position: 4, slotTime: "12:45", adHocDraft: adHocDraftFixture)
        )
        let updatedRequests = await fake.requestsSnapshot()
        let adHocSet = try XCTUnwrap(updatedRequests[2].variables?["set"])
        XCTAssertEqual(adHocSet["grams"], .string("80"))
        XCTAssertEqual(adHocSet["position"], .number(4))
        XCTAssertEqual(adHocSet["slotTime"], .string("12:45"))
        XCTAssertEqual(adHocSet["snapshotFoodName"], .string("Restaurant bowl"))
        XCTAssertEqual(adHocSet["snapshotKcalPer100g"], .string("180"))
        XCTAssertEqual(adHocSet["snapshotFatPer100g"], .string("7"))
        XCTAssertEqual(adHocSet["snapshotCarbsPer100g"], .string("18"))
        XCTAssertEqual(adHocSet["snapshotProteinPer100g"], .string("10"))
        XCTAssertEqual(adHocSet["snapshotFiberPer100g"], .string("3"))
        XCTAssertEqual(adHocSet["snapshotSugarPer100g"], .string("4"))
        XCTAssertFalse(adHocSet.recursivelyContainsKey("source"))
        XCTAssertFalse(adHocSet.recursivelyContainsKey("foodId"))
 
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
        XCTAssertNotNil(
            viewModel.selectedPlan,
            "Fixture must keep a selected plan to cover ad-hoc logging on planned days."
        )
        let requests = await fake.requestsSnapshot()
        let object = try XCTUnwrap(requests[1].variables?["object"])
        XCTAssertEqual(object["foodId"], .string("food-1"))
        XCTAssertEqual(object["nutritionPlanFoodId"], .null)
        XCTAssertEqual(object["position"], .number(2))
    }

    func testViewModelLogsAdHocMealOnPlannedDayWithoutPlanMealProvenance() async throws {
        let fake = FakeGraphQLService(replies: [
            .json(.object([
                "nutritionDays": .array([nutritionDayFixture]),
                "nutritionPlans": .array([planFixture]),
                "meals": .array([mealFixture]),
                "foods": .array([snapshotFoodFixture])
            ])),
            .json(.object(["insertNutritionLogMeal": .object(["id": .string("group-new")])])),
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
        XCTAssertNotNil(
            viewModel.selectedPlan,
            "Fixture must keep a selected plan to cover ad-hoc logging on planned days."
        )
        let didLog = await viewModel.logMeal(meal: mealFixtureModel, planSlot: nil, slotTime: "16:20")

        XCTAssertTrue(didLog)
        let requests = await fake.requestsSnapshot()
        let object = try XCTUnwrap(requests[1].variables?["object"])
        XCTAssertEqual(object["mealId"], .string("meal-1"))
        XCTAssertEqual(object["nutritionPlanMealId"], .null)
        XCTAssertEqual(object["slotTime"], .string("16:20"))
        XCTAssertFalse(object.recursivelyContainsKey("nutritionPlanFoodId"))
    }

    func testViewModelLogsAdHocFoodWithDefaultNextPositionAndRefreshes() async throws {
        let fake = FakeGraphQLService(replies: [
            .json(.object([
                "nutritionDays": .array([nutritionDayFixture]),
                "nutritionPlans": .array([planFixture]),
                "meals": .array([mealFixture]),
                "foods": .array([snapshotFoodFixture])
            ])),
            .json(.object(["insertNutritionLogEntry": .object(["id": .string("entry-custom")])])),
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
        let didLog = await viewModel.logAdHocFood(adHocDraftFixture)

        XCTAssertTrue(didLog)
        let requests = await fake.requestsSnapshot()
        let object = try XCTUnwrap(requests[1].variables?["object"])
        XCTAssertEqual(object["source"], .string("ad_hoc"))
        XCTAssertEqual(object["snapshotFoodName"], .string("Restaurant bowl"))
        XCTAssertEqual(object["position"], .number(2))
        XCTAssertFalse(object.recursivelyContainsKey("foodId"))
        XCTAssertFalse(object.recursivelyContainsKey("nutritionPlanFoodId"))
        XCTAssertFalse(object.recursivelyContainsKey("nutritionLogMealId"))
    }

    func testViewModelRejectsInvalidAdHocDraftsBeforeMutation() async throws {
        let fake = FakeGraphQLService()
        let repository = NutritionFoodMealRepository(graphQL: fake)
        let viewModel = DailyIntakeViewModel(date: "2026-06-27", repository: repository)

        let blankNameAccepted = await viewModel.logAdHocFood(adHocDraft(name: "   "))
        let zeroGramsAccepted = await viewModel.logAdHocFood(adHocDraft(grams: "0"))
        let negativeMacroAccepted = await viewModel.logAdHocFood(adHocDraft(kcal: "-1"))
        let invalidTimeAccepted = await viewModel.logAdHocFood(adHocDraft(slotTime: "25:99"))
        let requests = await fake.requestsSnapshot()

        XCTAssertFalse(blankNameAccepted)
        XCTAssertFalse(zeroGramsAccepted)
        XCTAssertFalse(negativeMacroAccepted)
        XCTAssertFalse(invalidTimeAccepted)
        XCTAssertTrue(requests.isEmpty)
    }

    func testViewModelLogsPlanFoodWithActualTimeAndPlanFoodProvenance() async throws {
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
        let slot = try XCTUnwrap(viewModel.selectedPlan?.sortedFoodSlots.first)
        let didLog = await viewModel.logPlanFood(slot, slotTime: "15:45")

        XCTAssertTrue(didLog)
        let requests = await fake.requestsSnapshot()
        let object = try XCTUnwrap(requests[1].variables?["object"])
        XCTAssertEqual(object["foodId"], .string("food-2"))
        XCTAssertEqual(object["nutritionPlanFoodId"], .string("plan-food-1"))
        XCTAssertEqual(object["grams"], .string("80"))
        XCTAssertEqual(object["slotTime"], .string("15:45"))
        XCTAssertNotEqual(object["slotTime"], .string(slot.slotTime))
    }
}

final class NutritionDayGroupingTests: XCTestCase {
    func testNutritionLogEntrySourceDecodesAndMissingSourceDefaultsToFood() throws {
        let encodedAdHoc = try JSONEncoder().encode(standaloneEntryJSONFixture)
        let adHocEntry = try JSONDecoder().decode(NutritionLogEntry.self, from: encodedAdHoc)
        XCTAssertEqual(adHocEntry.source, .adHoc)
        XCTAssertTrue(adHocEntry.isAdHoc)

        var object = try XCTUnwrap(standaloneEntryJSONFixture.objectValue)
        object.removeValue(forKey: "source")
        let encodedMissingSource = try JSONEncoder().encode(JSONValue.object(object))
        let missingSourceEntry = try JSONDecoder().decode(NutritionLogEntry.self, from: encodedMissingSource)
        XCTAssertEqual(missingSourceEntry.source, .food)
        XCTAssertFalse(missingSourceEntry.isAdHoc)
    }

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
        .object([
            "id": .string("ingredient-1"),
            "foodId": .string("food-1"),
            "grams": .string("100"),
            "position": .number(0),
            "food": snapshotFoodFixture
        ]),
        .object([
            "id": .string("ingredient-2"),
            "foodId": .string("food-2"),
            "grams": .string("50"),
            "position": .number(1),
            "food": secondFoodFixture
        ])
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
    ]),
    "nutritionPlanFoods": .array([
        .object([
            "id": .string("plan-food-1"),
            "foodId": .string("food-2"),
            "grams": .string("80"),
            "slotTime": .string("08:00:00"),
            "label": .string("Blueberries"),
            "position": .number(1),
            "food": secondFoodFixture
        ])
    ])
])

private let groupedEntryFixture: JSONValue = .object([
    "id": .string("entry-1"),
    "nutritionDayId": .string("day-1"),
    "nutritionLogMealId": .string("log-meal-1"),
    "foodId": .string("food-1"),
    "source": .string("food"),
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
    "nutritionPlanFoodId": .null,
    "foodId": .null,
    "source": .string("ad_hoc"),
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

private let adHocDraftFixture = AdHocFoodDraftValues(
    name: "Restaurant bowl",
    grams: "80",
    slotTime: "12:45",
    macros: Per100gMacroStrings(
        kcalPer100g: "180",
        grams: GramMacroStrings(
            fatPer100g: "7",
            carbsPer100g: "18",
            proteinPer100g: "10",
            fiberPer100g: "3",
            sugarPer100g: "4"
        )
    )
)

private func adHocDraft(
    name: String = "Restaurant bowl",
    grams: String = "80",
    slotTime: String = "12:45",
    kcal: String = "180"
) -> AdHocFoodDraftValues {
    AdHocFoodDraftValues(
        name: name,
        grams: grams,
        slotTime: slotTime,
        macros: Per100gMacroStrings(
            kcalPer100g: kcal,
            grams: GramMacroStrings(
                fatPer100g: "7",
                carbsPer100g: "18",
                proteinPer100g: "10",
                fiberPer100g: "3",
                sugarPer100g: "4"
            )
        )
    )
}

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
        source: .food,
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
    source: .adHoc,
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
