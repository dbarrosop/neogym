import Foundation
import XCTest
@testable import NeoGymKit

final class NutritionPlanRepositoryTests: XCTestCase {
    func testDecodesPlanFixturesAndComputesLiveTotals() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object(["nutritionPlans": .array([planFixture])]))])
        let repository = NutritionFoodMealRepository(graphQL: fake)

        let plans = try await repository.listPlans()

        XCTAssertEqual(plans.count, 1)
        XCTAssertEqual(plans[0].name, "Training day")
        XCTAssertEqual(plans[0].sortedSlots.map(\.slotTime), ["08:00:00", "12:30:00"])
        XCTAssertEqual(plans[0].sortedSlots.map(\.displayLabel), ["Breakfast", "Breakfast bowl"])
        XCTAssertEqual(plans[0].sortedFoodSlots.map(\.displayLabel), ["Pre-run fruit"])
        XCTAssertEqual(plans[0].sortedEntries.map(\.kind), [.food, .meal, .meal])
        XCTAssertEqual(plans[0].sortedEntries.map(\.displayLabel), ["Pre-run fruit", "Breakfast", "Breakfast bowl"])
        XCTAssertEqual(plans[0].macroTotals.kcal, 599.7, accuracy: 0.001)
        XCTAssertEqual(plans[0].macroTotals.protein, 49.47, accuracy: 0.001)
        let requests = await fake.requestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.operationName, "PlansIndex")
        XCTAssertTrue(request.query.contains("order_by: [{ slotTime: asc }, { position: asc }, { id: asc }]"))
        XCTAssertTrue(request.query.contains("nutritionPlanFoods"))
    }

    func testEditPlanLoadsPlanAndMealPickerPayloads() async throws {
        let fake = FakeGraphQLService(replies: [
            .json(.object(["nutritionPlan": editPlanFixture])),
            .json(.object(["meals": .array([mealFixture])])),
            .json(.object(["foods": .array([foodFixture])]))
        ])
        let repository = NutritionFoodMealRepository(graphQL: fake)

        let payload = try await repository.editPlan(id: "plan-1")

        XCTAssertEqual(payload.plan?.id, "plan-1")
        XCTAssertEqual(payload.meals.map(\.name), ["Breakfast bowl"])
        XCTAssertEqual(payload.foods.map(\.name), ["Greek yogurt"])
        XCTAssertEqual(payload.plan?.nutritionPlanFoods.map(\.foodId), ["food-1"])
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.map(\.operationName), ["EditNutritionPlan", "NutritionPlanFormMeals", "MealFormFoods"])
    }

    func testCreatePlanVariablesUseNestedSlotsAndOmitOwnershipFields() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "insertNutritionPlan": .object(["id": .string("plan-new")])
        ]))])
        let repository = NutritionFoodMealRepository(graphQL: fake)
        let values = NutritionPlanFormValues(
            name: "Training day",
            description: "Prep notes",
            slots: [
                NutritionPlanSlotFormValues(mealId: "meal-1", slotTime: "08:00", label: "Breakfast", position: 1),
                NutritionPlanSlotFormValues(mealId: "meal-2", slotTime: "12:30", label: "", position: 0)
            ],
            foodSlots: [
                NutritionPlanFoodSlotFormValues(foodId: "food-1", grams: "50", slotTime: "08:00", label: "Pre-run", position: 0)
            ]
        )

        let id = try await repository.createPlan(values)

        XCTAssertEqual(id, "plan-new")
        let requests = await fake.requestsSnapshot()
        let object = try XCTUnwrap(requests.first?.variables?["object"])
        XCTAssertFalse(object.recursivelyContainsKey("userId"))
        XCTAssertFalse(object.recursivelyContainsKey("isPublic"))
        XCTAssertFalse(object.recursivelyContainsKey("meal"))
        XCTAssertEqual(object["name"], .string("Training day"))
        let slotRows = try XCTUnwrap(object["nutritionPlanMeals"]?["data"]?.arrayValue)
        XCTAssertEqual(slotRows[0]["mealId"], .string("meal-1"))
        XCTAssertEqual(slotRows[0]["slotTime"], .string("08:00"))
        XCTAssertEqual(slotRows[0]["label"], .string("Breakfast"))
        XCTAssertEqual(slotRows[0]["position"], .number(1))
        XCTAssertEqual(slotRows[1]["label"], .null)
        let foodRows = try XCTUnwrap(object["nutritionPlanFoods"]?["data"]?.arrayValue)
        XCTAssertEqual(foodRows[0]["foodId"], .string("food-1"))
        XCTAssertEqual(foodRows[0]["grams"], .string("50"))
        XCTAssertEqual(foodRows[0]["slotTime"], .string("08:00"))
        XCTAssertEqual(foodRows[0]["label"], .string("Pre-run"))
        XCTAssertEqual(foodRows[0]["position"], .number(0))
    }

    func testSavePlanVariablesDeleteAndInsertWhenMealChangesAndNeverUpdateMealId() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "updateNutritionPlan": .object(["id": .string("plan-1")]),
            "deleteNutritionPlanMeals": .object(["affected_rows": .number(1)]),
            "insertNutritionPlanMeals": .object(["affected_rows": .number(1)]),
            "update_nutritionPlanMeals_many": .array([.object(["affected_rows": .number(1)])]),
            "deleteNutritionPlanFoods": .object(["affected_rows": .number(2)]),
            "insertNutritionPlanFoods": .object(["affected_rows": .number(2)]),
            "update_nutritionPlanFoods_many": .array([.object(["affected_rows": .number(1)])])
        ]))])
        let repository = NutritionFoodMealRepository(graphQL: fake)
        let initial = NutritionPlanFormValues(
            name: "Old",
            description: "Old notes",
            slots: [
                NutritionPlanSlotFormValues(id: "slot-keep", mealId: "meal-1", slotTime: "08:00", label: "Breakfast", position: 0),
                NutritionPlanSlotFormValues(id: "slot-change", mealId: "meal-2", slotTime: "12:00", label: "Lunch", position: 1),
                NutritionPlanSlotFormValues(id: "slot-drop", mealId: "meal-3", slotTime: "18:00", label: "Dinner", position: 0)
            ],
            foodSlots: [
                NutritionPlanFoodSlotFormValues(id: "food-slot-keep", foodId: "food-1", grams: "50", slotTime: "08:00", label: "Fruit", position: 1),
                NutritionPlanFoodSlotFormValues(id: "food-slot-change", foodId: "food-2", grams: "80", slotTime: "12:00", label: "Snack", position: 0),
                NutritionPlanFoodSlotFormValues(id: "food-slot-drop", foodId: "food-3", grams: "100", slotTime: "18:00", label: "Drop", position: 1)
            ]
        )
        let next = NutritionPlanFormValues(
            name: "Updated",
            description: "",
            slots: [
                NutritionPlanSlotFormValues(id: "slot-keep", mealId: "meal-1", slotTime: "08:15", label: "", position: 0),
                NutritionPlanSlotFormValues(id: "slot-change", mealId: "meal-4", slotTime: "12:30", label: "Post-workout", position: 1),
                NutritionPlanSlotFormValues(mealId: "meal-5", slotTime: "20:00", label: "Supper", position: 0)
            ],
            foodSlots: [
                NutritionPlanFoodSlotFormValues(id: "food-slot-keep", foodId: "food-1", grams: "55", slotTime: "08:15", label: "", position: 1),
                NutritionPlanFoodSlotFormValues(id: "food-slot-change", foodId: "food-4", grams: "90", slotTime: "12:30", label: "Gel", position: 0),
                NutritionPlanFoodSlotFormValues(foodId: "food-5", grams: "120", slotTime: "20:00", label: "Shake", position: 1)
            ]
        )

        try await repository.savePlan(id: "plan-1", initialValues: initial, values: next)

        let requests = await fake.requestsSnapshot()
        let variables = try XCTUnwrap(requests.first?.variables)
        XCTAssertFalse(JSONValue.object(variables).recursivelyContainsKey("userId"))
        XCTAssertEqual(variables["set"]?["description"], .null)
        XCTAssertEqual(
            variables["deleteSlotIds"]?.arrayValue,
            [.string("slot-change"), .string("slot-drop")]
        )
        XCTAssertEqual(variables["hasDeleteSlots"], .bool(true))

        let insertRows = try XCTUnwrap(variables["insertSlots"]?.arrayValue)
        XCTAssertEqual(insertRows.map { $0["mealId"] }, [.string("meal-4"), .string("meal-5")])
        XCTAssertEqual(insertRows.map { $0["nutritionPlanId"] }, [.string("plan-1"), .string("plan-1")])

        let updates = try XCTUnwrap(variables["slotUpdates"]?.arrayValue)
        XCTAssertEqual(updates.count, 1)
        XCTAssertEqual(updates[0]["where"]?["id"]?["_eq"], .string("slot-keep"))
        XCTAssertEqual(updates[0]["_set"]?["slotTime"], .string("08:15"))
        XCTAssertEqual(updates[0]["_set"]?["label"], .null)
        XCTAssertEqual(updates[0]["_set"]?["position"], .number(0))
        XCTAssertFalse(updates[0].recursivelyContainsKey("mealId"))

        XCTAssertEqual(
            variables["deleteFoodSlotIds"]?.arrayValue,
            [.string("food-slot-change"), .string("food-slot-drop")]
        )
        let insertFoodRows = try XCTUnwrap(variables["insertFoodSlots"]?.arrayValue)
        XCTAssertEqual(insertFoodRows.map { $0["foodId"] }, [.string("food-4"), .string("food-5")])
        XCTAssertEqual(insertFoodRows.map { $0["nutritionPlanId"] }, [.string("plan-1"), .string("plan-1")])
        XCTAssertEqual(insertFoodRows.map { $0["grams"] }, [.string("90"), .string("120")])

        let foodUpdates = try XCTUnwrap(variables["foodSlotUpdates"]?.arrayValue)
        XCTAssertEqual(foodUpdates.count, 1)
        XCTAssertEqual(foodUpdates[0]["where"]?["id"]?["_eq"], .string("food-slot-keep"))
        XCTAssertEqual(foodUpdates[0]["_set"]?["grams"], .string("55"))
        XCTAssertEqual(foodUpdates[0]["_set"]?["slotTime"], .string("08:15"))
        XCTAssertEqual(foodUpdates[0]["_set"]?["label"], .null)
        XCTAssertEqual(foodUpdates[0]["_set"]?["position"], .number(1))
        XCTAssertFalse(foodUpdates[0].recursivelyContainsKey("foodId"))
    }

    func testPlanDeleteVariablesUseOnlyPrimaryKey() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "deleteNutritionPlan": .object(["id": .string("plan-1")])
        ]))])
        let repository = NutritionFoodMealRepository(graphQL: fake)

        try await repository.deletePlan(id: "plan-1")

        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.first?.operationName, "DeleteNutritionPlan")
        XCTAssertEqual(requests.first?.variables, ["id": .string("plan-1")])
    }
}

final class NutritionPlanGroupingTests: XCTestCase {
    func testGroupsPersistedPlanEntriesByTimeWithCountsTotalsAndMixedOrder() {
        let plan = NutritionPlan(
            id: "plan-grouped",
            name: "Grouped day",
            nutritionPlanMeals: [
                NutritionPlanMealSlot(
                    id: "meal-breakfast",
                    mealId: "meal-1",
                    slotTime: "08:00:00",
                    position: 1,
                    meal: mealFixtureModel
                )
            ],
            nutritionPlanFoods: [
                NutritionPlanFoodSlot(
                    id: "food-breakfast",
                    foodId: "food-2",
                    grams: .string("50"),
                    slotTime: "08:00:00",
                    position: 0,
                    food: publicFoodFixtureModel
                ),
                NutritionPlanFoodSlot(
                    id: "food-lunch",
                    foodId: "food-1",
                    grams: .string("100"),
                    slotTime: "12:30:00",
                    position: 0,
                    food: foodFixtureModel
                )
            ]
        )

        let slots = NutritionPlanGrouping.groupPlanEntriesByTimeSlot(
            plan.sortedEntries,
            locale: Locale(identifier: "en_US_POSIX")
        )

        XCTAssertEqual(slots.map(\.key), ["08:00", "12:30"])
        XCTAssertEqual(slots[0].entries.map(entryDescription), ["food:food-breakfast", "meal:meal-breakfast"])
        XCTAssertEqual(slots[0].mealCount, 1)
        XCTAssertEqual(slots[0].foodCount, 1)
        XCTAssertEqual(slots[0].totals.kcal, 314.1, accuracy: 0.001)
        XCTAssertEqual(slots[0].totals.protein, 24.91, accuracy: 0.001)
    }

    func testGroupsNoTimePlanEntriesLast() {
        let slots = NutritionPlanGrouping.groupPlanEntriesByTimeSlot([
            .meal(NutritionPlanMealSlot(
                id: "meal-no-time",
                mealId: "meal-1",
                slotTime: "",
                position: 0,
                meal: mealFixtureModel
            )),
            .food(NutritionPlanFoodSlot(
                id: "food-timed",
                foodId: "food-2",
                grams: .string("50"),
                slotTime: "07:00:00",
                position: 0,
                food: publicFoodFixtureModel
            )),
            .food(NutritionPlanFoodSlot(
                id: "food-no-time",
                foodId: "food-1",
                grams: .string("25"),
                slotTime: "",
                position: 1,
                food: foodFixtureModel
            ))
        ], locale: Locale(identifier: "en_US_POSIX"))

        XCTAssertEqual(slots.map(\.key), ["07:00", "no-time"])
        XCTAssertEqual(slots[1].label, "No time")
        XCTAssertEqual(slots[1].entries.map(entryDescription), ["meal:meal-no-time", "food:food-no-time"])
    }

    func testGroupsDraftPlanEntriesAfterStablePerSlotRenumbering() {
        let slots = NutritionPlanGrouping.groupPlanDraftEntriesByTimeSlot(
            mealSlots: [
                NutritionPlanSlotFormValues(
                    id: "meal-lunch",
                    mealId: "meal-1",
                    slotTime: "12:00",
                    label: "Lunch",
                    position: 99
                ),
                NutritionPlanSlotFormValues(
                    id: "meal-no-time",
                    mealId: "meal-2",
                    slotTime: "",
                    label: "Legacy",
                    position: 99
                )
            ],
            foodSlots: [
                NutritionPlanFoodSlotFormValues(
                    id: "food-breakfast",
                    foodId: "food-2",
                    grams: "50",
                    slotTime: "08:00",
                    label: "Fruit",
                    position: 99
                ),
                NutritionPlanFoodSlotFormValues(
                    id: "food-lunch",
                    foodId: "food-1",
                    grams: "100",
                    slotTime: "12:00",
                    label: "Yogurt",
                    position: 99
                )
            ],
            availableMeals: [mealFixtureModel, secondMealFixtureModel],
            availableFoods: [foodFixtureModel, publicFoodFixtureModel],
            locale: Locale(identifier: "en_US_POSIX")
        )

        XCTAssertEqual(slots.map(\.key), ["08:00", "12:00", "no-time"])
        XCTAssertEqual(slots.flatMap(draftEntryDescriptions), [
            "08:00:food:food-breakfast:0",
            "12:00:food:food-lunch:0",
            "12:00:meal:meal-lunch:1",
            "no-time:meal:meal-no-time:0"
        ])
        XCTAssertEqual(slots.map { [$0.mealCount, $0.foodCount] }, [[0, 1], [1, 1], [1, 0]])
        XCTAssertEqual(slots[0].totals.kcal, 28.5, accuracy: 0.001)
        XCTAssertEqual(slots[1].totals.kcal, 405.6, accuracy: 0.001)
    }

    private func entryDescription(_ entry: NutritionPlanEntry) -> String {
        "\(entry.kind.rawValue):\(entry.id)"
    }

    private func draftEntryDescriptions(_ slot: NutritionPlanTimeSlot<NutritionPlanDraftEntry>) -> [String] {
        slot.entries.map { entry in
            "\(slot.key):\(entry.kind.rawValue):\(entry.stableId):\(entry.position)"
        }
    }
}

@MainActor
final class NutritionPlanFormTests: XCTestCase {
    func testPlanFormValidationTrimsAndSortsSlotsByTimeThenPosition() {
        let meals = [mealFixtureModel, secondMealFixtureModel]
        let model = NutritionPlanFormModel(initialValues: NutritionPlanFormValues(
            name: "  Training day  ",
            description: " notes ",
            slots: [
                NutritionPlanSlotFormValues(id: "slot-dinner", mealId: "meal-2", slotTime: "18:00:00", label: " Dinner ", position: 0),
                NutritionPlanSlotFormValues(id: "slot-breakfast", mealId: "meal-1", slotTime: "08:00:00", label: "", position: 1)
            ]
        ))

        let values = model.valuesForSubmit(availableMeals: meals)

        XCTAssertEqual(values?.name, "Training day")
        XCTAssertEqual(values?.description, "notes")
        XCTAssertEqual(values?.slots.map(\.slotTime), ["08:00", "18:00"])
        XCTAssertEqual(values?.slots.map(\.position), [0, 0])
        XCTAssertEqual(values?.slots.map(\.label), ["", "Dinner"])
    }

    func testPlanFormRequiresSlotMealAndTime() {
        let model = NutritionPlanFormModel(initialValues: NutritionPlanFormValues(
            name: "Plan",
            description: "",
            slots: [NutritionPlanSlotFormValues(mealId: "missing", slotTime: "12:00", label: "", position: 0)]
        ))

        XCTAssertNil(model.valuesForSubmit(availableMeals: [mealFixtureModel]))
        XCTAssertEqual(model.errorMessage, "Every meal slot needs a selected meal.")

        model.updateSlot(stableId: model.slots[0].stableId, mealId: "meal-1", slotTime: "25:00")
        XCTAssertNil(model.valuesForSubmit(availableMeals: [mealFixtureModel]))
        XCTAssertEqual(model.errorMessage, "Every slot needs a time of day.")
    }

    func testPlanFormTotalsUseSelectedMealLiveValues() {
        let model = NutritionPlanFormModel(initialValues: NutritionPlanFormValues(
            name: "Plan",
            description: "",
            slots: [NutritionPlanSlotFormValues(mealId: "meal-1", slotTime: "08:00", label: "", position: 0)]
        ))

        let totals = model.macroTotals(availableMeals: [mealFixtureModel])

        XCTAssertEqual(totals.kcal, 285.6, accuracy: 0.001)
        XCTAssertEqual(totals.protein, 24.56, accuracy: 0.001)
    }

    func testPlanFormMovesMixedEntriesWithinSlotWithSharedPositions() {
        let model = NutritionPlanFormModel(initialValues: NutritionPlanFormValues(
            name: "Plan",
            description: "",
            slots: [
                NutritionPlanSlotFormValues(id: "meal-slot", mealId: "meal-1", slotTime: "08:00", label: "Meal", position: 0)
            ],
            foodSlots: [
                NutritionPlanFoodSlotFormValues(
                    id: "food-slot",
                    foodId: "food-2",
                    grams: "50",
                    slotTime: "08:00",
                    label: "Fruit",
                    position: 1
                ),
                NutritionPlanFoodSlotFormValues(
                    id: "lunch-food",
                    foodId: "food-1",
                    grams: "100",
                    slotTime: "12:00",
                    label: "Lunch",
                    position: 0
                )
            ]
        ))

        XCTAssertTrue(model.canMoveEntryWithinSlot(kind: .food, stableId: "food-slot", direction: -1))
        model.moveEntry(kind: .food, stableId: "food-slot", direction: -1)

        XCTAssertEqual(model.sortedDraftEntries().map(\.stableId), ["food-slot", "meal-slot", "lunch-food"])
        XCTAssertEqual(model.foodSlots.first { $0.stableId == "food-slot" }?.position, 0)
        XCTAssertEqual(model.slots.first { $0.stableId == "meal-slot" }?.position, 1)
        XCTAssertEqual(model.foodSlots.first { $0.stableId == "lunch-food" }?.position, 0)
    }

    func testPlanFormDisallowsMovesAcrossSlotBoundaries() {
        let model = NutritionPlanFormModel(initialValues: NutritionPlanFormValues(
            name: "Plan",
            description: "",
            slots: [
                NutritionPlanSlotFormValues(
                    id: "breakfast-meal",
                    mealId: "meal-1",
                    slotTime: "08:00",
                    label: "Breakfast",
                    position: 0
                ),
                NutritionPlanSlotFormValues(
                    id: "lunch-meal",
                    mealId: "meal-2",
                    slotTime: "12:00",
                    label: "Lunch",
                    position: 0
                )
            ],
            foodSlots: [
                NutritionPlanFoodSlotFormValues(
                    id: "lunch-food",
                    foodId: "food-1",
                    grams: "100",
                    slotTime: "12:00",
                    label: "Food",
                    position: 1
                )
            ]
        ))

        XCTAssertFalse(model.canMoveEntryWithinSlot(
            kind: .meal,
            stableId: "breakfast-meal",
            direction: 1
        ))
        XCTAssertFalse(model.canMoveEntryWithinSlot(
            kind: .meal,
            stableId: "lunch-meal",
            direction: -1
        ))
        model.moveEntry(kind: .meal, stableId: "breakfast-meal", direction: 1)

        XCTAssertEqual(
            model.sortedDraftEntries().map(\.stableId),
            ["breakfast-meal", "lunch-meal", "lunch-food"]
        )
        XCTAssertEqual(model.valuesForSubmit(
            availableMeals: [mealFixtureModel, secondMealFixtureModel],
            availableFoods: [foodFixtureModel]
        )?.slots.map(\.position), [0, 0])
    }

    func testPlanFormValidationRenumbersMixedEntriesPerTimeAndTotalsDirectFoods() {
        let model = NutritionPlanFormModel(initialValues: NutritionPlanFormValues(
            name: "Plan",
            description: "",
            slots: [
                NutritionPlanSlotFormValues(mealId: "meal-1", slotTime: "08:00:00", label: "Meal", position: 1)
            ],
            foodSlots: [
                NutritionPlanFoodSlotFormValues(foodId: "food-2", grams: "50,5", slotTime: "08:00:00", label: "Fruit", position: 0),
                NutritionPlanFoodSlotFormValues(foodId: "food-1", grams: "100", slotTime: "12:00:00", label: "Yogurt", position: 9)
            ]
        ))

        let values = model.valuesForSubmit(availableMeals: [mealFixtureModel], availableFoods: [foodFixtureModel, publicFoodFixtureModel])
        let totals = model.macroTotals(availableMeals: [mealFixtureModel], availableFoods: [foodFixtureModel, publicFoodFixtureModel])

        XCTAssertEqual(values?.slots.map(\.position), [1])
        XCTAssertEqual(values?.foodSlots.map(\.position), [0, 0])
        XCTAssertEqual(values?.foodSlots.map(\.grams), ["50.5", "100"])
        XCTAssertEqual(totals.kcal, 434.385, accuracy: 0.001)
        XCTAssertEqual(totals.protein, 36.9135, accuracy: 0.001)
    }
}

final class NutritionPlanErrorMappingTests: XCTestCase {
    func testMealInUseByPlanRestrictErrorKeepsFriendlyCopy() {
        let error = GraphQLDomainError.graphQLErrors([
            GraphQLErrorDetail(
                message: "update or delete on table meals violates foreign key constraint",
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

private let planFixture: JSONValue = .object([
    "id": .string("plan-1"),
    "name": .string("Training day"),
    "description": .string("Higher protein template."),
    "nutritionPlanMeals": .array([
        .object([
            "id": .string("slot-lunch"),
            "mealId": .string("meal-1"),
            "slotTime": .string("12:30:00"),
            "label": .null,
            "position": .number(0),
            "meal": mealFixture
        ]),
        .object([
            "id": .string("slot-breakfast"),
            "mealId": .string("meal-1"),
            "slotTime": .string("08:00:00"),
            "label": .string("Breakfast"),
            "position": .number(1),
            "meal": mealFixture
        ])
    ]),
    "nutritionPlanFoods": .array([
        .object([
            "id": .string("food-slot-fruit"),
            "foodId": .string("food-2"),
            "grams": .string("50"),
            "slotTime": .string("08:00:00"),
            "label": .string("Pre-run fruit"),
            "position": .number(0),
            "food": publicFoodFixture
        ])
    ])
])

private let editPlanFixture: JSONValue = .object([
    "id": .string("plan-1"),
    "name": .string("Training day"),
    "description": .string("Higher protein template."),
    "nutritionPlanMeals": .array([
        .object([
            "id": .string("slot-breakfast"),
            "mealId": .string("meal-1"),
            "slotTime": .string("08:00:00"),
            "label": .string("Breakfast"),
            "position": .number(0)
        ])
    ]),
    "nutritionPlanFoods": .array([
        .object([
            "id": .string("food-slot-1"),
            "foodId": .string("food-1"),
            "grams": .string("75"),
            "slotTime": .string("10:00:00"),
            "label": .string("Snack"),
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

private let publicFoodFixtureModel = Food(
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
)

private let mealFixtureModel = Meal(
    id: "meal-1",
    name: "Breakfast bowl",
    description: "Yogurt with berries.",
    mealIngredients: [
        MealIngredient(id: "ingredient-1", foodId: "food-1", grams: .string("200"), position: 0, food: foodFixtureModel),
        MealIngredient(id: "ingredient-2", foodId: "food-2", grams: .string("80"), position: 1, food: publicFoodFixtureModel)
    ]
)

private let secondMealFixtureModel = Meal(
    id: "meal-2",
    name: "Dinner",
    description: nil,
    mealIngredients: []
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
