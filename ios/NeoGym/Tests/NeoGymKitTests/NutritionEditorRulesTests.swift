import Foundation
import XCTest
@testable import NeoGymKit

/// Rules behind the grouped Nutrition editors: one time per plan slot, new
/// empty slots, and why a meal cannot be deleted.
@MainActor
final class NutritionEditorRulesTests: XCTestCase {
    private func planModel() -> NutritionPlanFormModel {
        NutritionPlanFormModel(initialValues: NutritionPlanFormValues(
            name: "Plan",
            description: "",
            slots: [
                NutritionPlanSlotFormValues(id: "lunch-meal", mealId: "meal-1", slotTime: "12:30", label: "", position: 0)
            ],
            foodSlots: [
                NutritionPlanFoodSlotFormValues(
                    id: "bread", foodId: "food-1", grams: "110", slotTime: "07:15", label: "", position: 0
                ),
                NutritionPlanFoodSlotFormValues(
                    id: "jam", foodId: "food-2", grams: "40", slotTime: "07:15:00", label: "", position: 1
                ),
                NutritionPlanFoodSlotFormValues(
                    id: "orange", foodId: "food-3", grams: "100", slotTime: "12:30", label: "", position: 1
                )
            ]
        ))
    }

    func testAddingAFoodToAMealOnlySlotAppendsAfterItsMeals() {
        let model = NutritionPlanFormModel(initialValues: NutritionPlanFormValues(
            name: "Plan",
            description: "",
            slots: [
                NutritionPlanSlotFormValues(id: "oats", mealId: "meal-1", slotTime: "07:00", label: "", position: 0),
                NutritionPlanSlotFormValues(id: "smoothie", mealId: "meal-2", slotTime: "07:00:00", label: "", position: 1)
            ]
        ))

        model.addFoodSlot(foodId: "banana", slotTime: "07:00:00")

        let entries = model.sortedDraftEntries()
        XCTAssertEqual(entries.prefix(2).map(\.stableId), ["oats", "smoothie"])
        XCTAssertEqual(entries.map(\.kind), [.meal, .meal, .food])
        XCTAssertEqual(entries.map(\.position), [0, 1, 2])

        model.addSlot(mealId: "meal-3", slotTime: "07:00")
        XCTAssertEqual(model.sortedDraftEntries().prefix(3).map(\.stableId), entries.map(\.stableId))
        XCTAssertEqual(model.sortedDraftEntries().map(\.position), [0, 1, 2, 3])
    }

    func testAddingAMealToAFoodOnlySlotAppendsAfterItsFoods() {
        let model = NutritionPlanFormModel(initialValues: NutritionPlanFormValues(
            name: "Plan",
            description: "",
            slots: [],
            foodSlots: (0 ..< 3).map { position in
                NutritionPlanFoodSlotFormValues(
                    id: "food-\(position)", foodId: "food", grams: "100",
                    slotTime: position == 1 ? "07:15:00" : "07:15", label: "", position: position
                )
            }
        ))

        model.addSlot(mealId: "meal", slotTime: "07:15:00")

        let entries = model.sortedDraftEntries()
        XCTAssertEqual(entries.prefix(3).map(\.stableId), ["food-0", "food-1", "food-2"])
        XCTAssertEqual(entries.map(\.kind), [.food, .food, .food, .meal])
        XCTAssertEqual(entries.map(\.position), [0, 1, 2, 3])

        model.addFoodSlot(foodId: "another-food", slotTime: "07:15")
        XCTAssertEqual(model.sortedDraftEntries().prefix(4).map(\.stableId), entries.map(\.stableId))
        XCTAssertEqual(model.sortedDraftEntries().map(\.position), [0, 1, 2, 3, 4])
    }

    func testMovingAnEntryToAnotherSlotAppendsAfterMixedEntriesAndKeepsIdentity() {
        for kind in [NutritionPlanEntryKind.food, .meal] {
            let model = NutritionPlanFormModel(initialValues: NutritionPlanFormValues(
                name: "Plan",
                description: "",
                slots: [
                    NutritionPlanSlotFormValues(
                        clientId: "source-meal", mealId: "meal-1", slotTime: "07:15", label: "Breakfast", position: 0
                    ),
                    NutritionPlanSlotFormValues(
                        id: "target-meal", mealId: "meal-2", slotTime: "12:30", label: "Lunch", position: 1
                    )
                ],
                foodSlots: [
                    NutritionPlanFoodSlotFormValues(
                        id: "source-food", foodId: "food-1", grams: "110", slotTime: "07:15", label: "", position: 1
                    ),
                    NutritionPlanFoodSlotFormValues(
                        clientId: "target-food", foodId: "food-2", grams: "40", slotTime: "12:30:00", label: "", position: 0
                    )
                ]
            ))
            let mealClientIds = model.slots.map(\.clientId).sorted()
            let foodClientIds = model.foodSlots.map(\.clientId).sorted()
            let movedId = "source-\(kind.rawValue)"
            let remainingId = kind == .meal ? "source-food" : "source-meal"

            if kind == .meal {
                model.updateSlot(stableId: movedId, slotTime: "12:30:00")
            } else {
                model.updateFoodSlot(stableId: movedId, slotTime: "12:30")
            }

            XCTAssertEqual(model.sortedDraftEntries().map(\.stableId), [remainingId, "target-food", "target-meal", movedId])
            XCTAssertEqual(model.sortedDraftEntries().map(\.position), [0, 0, 1, 2])
            XCTAssertEqual(model.slots.map(\.clientId).sorted(), mealClientIds)
            XCTAssertEqual(model.foodSlots.map(\.clientId).sorted(), foodClientIds)
        }
    }

    func testEquivalentTimeAndContentUpdatesKeepMixedEntryOrder() {
        let model = planModel()
        let entries = model.sortedDraftEntries()

        model.updateSlot(stableId: "lunch-meal", slotTime: "12:30:00")
        model.updateFoodSlot(stableId: "bread", slotTime: "07:15:00")
        model.updateSlot(stableId: "lunch-meal", mealId: "another-meal", label: "Lunch")
        model.updateFoodSlot(stableId: "bread", foodId: "another-food", grams: "120")

        XCTAssertEqual(model.sortedDraftEntries().map(\.stableId), entries.map(\.stableId))
        XCTAssertEqual(model.sortedDraftEntries().map(\.position), entries.map(\.position))
        XCTAssertEqual(model.slots.first?.mealId, "another-meal")
        XCTAssertEqual(model.foodSlots.first?.grams, "120")
    }

    func testSettingASlotTimeMovesEveryEntryInThatSlot() {
        let model = planModel()

        model.setSlotTime(from: "07:15", to: "07:45")

        XCTAssertEqual(model.foodSlots.filter { $0.id == "bread" || $0.id == "jam" }.map(\.slotTime), ["07:45", "07:45"])
        XCTAssertEqual(model.foodSlots.first { $0.id == "orange" }?.slotTime, "12:30")
        XCTAssertEqual(model.slots.first?.slotTime, "12:30")
        XCTAssertEqual(model.sortedDraftEntries().prefix(2).map(\.stableId), ["bread", "jam"])
    }

    func testMovingASlotOntoAnotherAppendsItsEntriesInOrder() {
        let model = planModel()

        model.setSlotTime(from: "07:15", to: "12:30")

        XCTAssertEqual(model.sortedDraftEntries().map(\.stableId), ["lunch-meal", "orange", "bread", "jam"])
        XCTAssertEqual(model.sortedDraftEntries().map(\.position), [0, 1, 2, 3])
    }

    func testInvalidTargetTimeLeavesTheSlotUnchanged() {
        let model = planModel()

        model.setSlotTime(from: "07:15", to: "25:00")

        XCTAssertEqual(model.foodSlots.first { $0.id == "bread" }?.slotTime, "07:15")
    }

    func testSuggestedSlotTimeIsAnHourAfterTheLatestFreeTime() {
        XCTAssertEqual(NutritionPlanFormModel.suggestedSlotTime(after: []), "12:00")
        XCTAssertEqual(NutritionPlanFormModel.suggestedSlotTime(after: ["07:15", "12:30"]), "13:30")
        XCTAssertEqual(NutritionPlanFormModel.suggestedSlotTime(after: ["23:30", "00:00"]), "00:30")
    }

    func testMealDeleteIsBlockedWhilePlansUseIt() {
        let plan = { (id: String, name: String) in
            MealPlanReference(nutritionPlan: MealPlanReference.Plan(id: id, name: name))
        }
        let used = Meal(id: "m", name: "Breakfast", nutritionPlanMeals: [
            plan("p2", "Rest day"), plan("p1", "Maintenance"), plan("p2", "Rest day")
        ])
        XCTAssertEqual(used.usedInPlanNames, ["Maintenance", "Rest day"])
        XCTAssertEqual(
            used.deleteBlockedReason,
            "Used in 2 plans (Maintenance, Rest day). Remove it from those plans before deleting."
        )

        let single = Meal(id: "m", name: "Breakfast", nutritionPlanMeals: [plan("p1", "Maintenance")])
        XCTAssertEqual(
            single.deleteBlockedReason,
            "Used in 1 plan (Maintenance). Remove it from that plan before deleting."
        )
        XCTAssertNil(Meal(id: "m", name: "Breakfast").deleteBlockedReason)
    }

    func testEditMealQueryDecodesPlanUsage() throws {
        let json = """
        {"id": "m", "name": "Breakfast", "description": null, "mealIngredients": [],
         "nutritionPlanMeals": [{"nutritionPlan": {"id": "p1", "name": "Maintenance"}}]}
        """
        let meal = try JSONDecoder().decode(Meal.self, from: Data(json.utf8))
        XCTAssertEqual(meal.usedInPlanNames, ["Maintenance"])
        XCTAssertTrue(NutritionFoodMealRepository.editMealQuery.contains("nutritionPlanMeals {"))
    }
}
