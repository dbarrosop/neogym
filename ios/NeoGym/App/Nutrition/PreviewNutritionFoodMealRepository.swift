import NeoGymKit

struct PreviewNutritionFoodMealRepository: NutritionFoodMealRepositoryProtocol {
    func listFoods() async throws -> [Food] { previewFoods }
    func food(id: String) async throws -> Food? { previewFoods.first { $0.id == id } }
    func editFood(id: String) async throws -> Food? { try await food(id: id) }
    func createFood(_ values: FoodFormValues) async throws -> String { "food-new" }
    func updateFood(id: String, values: FoodFormValues) async throws {}
    func deleteFood(id: String) async throws {}
    func listMeals() async throws -> [Meal] { [previewMeal] }
    func meal(id: String) async throws -> Meal? { previewMeal }
    func editMeal(id: String) async throws -> MealEditPayload {
        MealEditPayload(meal: previewMeal, foods: previewFoods)
    }
    func foodsForMealForm() async throws -> [Food] { previewFoods }
    func createMeal(_ values: MealFormValues) async throws -> String { "meal-new" }
    func saveMeal(id: String, initialValues: MealFormValues, values: MealFormValues) async throws {}
    func deleteMeal(id: String) async throws {}
    func listPlans() async throws -> [NutritionPlan] { [previewPlan] }
    func plan(id: String) async throws -> NutritionPlan? { previewPlan }
    func editPlan(id: String) async throws -> NutritionPlanEditPayload {
        NutritionPlanEditPayload(plan: previewPlan, meals: [previewMeal], foods: previewFoods)
    }
    func mealsForPlanForm() async throws -> [Meal] { [previewMeal] }
    func createPlan(_ values: NutritionPlanFormValues) async throws -> String { "plan-new" }
    func savePlan(id: String, initialValues: NutritionPlanFormValues, values: NutritionPlanFormValues) async throws {}
    func deletePlan(id: String) async throws {}
    func listNutritionDays() async throws -> [NutritionDay] { [previewDay] }
    func openDailyIntake(date: String) async throws -> DailyIntakePayload {
        DailyIntakePayload(day: previewDay, nutritionPlans: [previewPlan], meals: [previewMeal], foods: previewFoods)
    }
    func createNutritionDay(date: String, nutritionPlanId: String?) async throws -> String { "day-1" }
    func updateNutritionDayPlan(dayId: String, nutritionPlanId: String?) async throws {}
    func deleteNutritionDay(id: String) async throws {}
    func logFood(_ values: LogFoodValues) async throws -> String { "entry-new" }
    func logAdHocFood(_ values: LogAdHocFoodValues) async throws -> String { "entry-custom" }
    func logMeal(_ values: LogMealValues) async throws -> String { "group-new" }
    func updateLogEntry(id: String, values: LogEntryUpdateValues) async throws {}
    func updateLogMeal(id: String, values: LogMealUpdateValues) async throws {}
    func deleteLogEntry(id: String) async throws {}
    func deleteLogMeal(id: String) async throws {}

    private var previewFoods: [Food] {
        [
            Food(
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
            ),
            Food(
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
        ]
    }

    private var previewMeal: Meal {
        Meal(
            id: "meal-1",
            name: "Breakfast bowl",
            description: "Yogurt with berries.",
            mealIngredients: [
                MealIngredient(
                    id: "ingredient-1",
                    foodId: "food-1",
                    grams: .string("200"),
                    position: 0,
                    food: previewFoods[0]
                ),
                MealIngredient(
                    id: "ingredient-2",
                    foodId: "food-2",
                    grams: .string("80"),
                    position: 1,
                    food: previewFoods[1]
                )
            ]
        )
    }

    private var previewDay: NutritionDay {
        NutritionDay(
            id: "day-1",
            logDate: IntakeGrouping.formatLocalDate(),
            nutritionPlanId: "plan-1",
            nutritionPlan: previewPlan,
            nutritionLogMeals: [
                NutritionLogMeal(
                    id: "log-meal-1",
                    mealId: "meal-1",
                    nutritionPlanMealId: "slot-1",
                    name: "Breakfast",
                    slotTime: "08:30:00",
                    position: 0,
                    nutritionLogEntries: [
                        NutritionLogEntry(
                            id: "entry-1",
                            nutritionDayId: "day-1",
                            nutritionLogMealId: "log-meal-1",
                            foodId: "food-1",
                            grams: .string("200"),
                            position: 0,
                            slotTime: "08:30:00",
                            snapshotFoodName: "Greek yogurt",
                            snapshotKcalPer100g: .string("120"),
                            snapshotFatPer100g: .string("3.5"),
                            snapshotCarbsPer100g: .string("5"),
                            snapshotProteinPer100g: .string("12"),
                            snapshotFiberPer100g: .string("0"),
                            snapshotSugarPer100g: .string("4")
                        )
                    ]
                )
            ],
            nutritionLogEntries: [
                NutritionLogEntry(
                    id: "entry-2",
                    nutritionDayId: "day-1",
                    source: .adHoc,
                    grams: .string("80"),
                    position: 1,
                    slotTime: "10:15:00",
                    snapshotFoodName: "Restaurant bowl",
                    snapshotKcalPer100g: .string("180"),
                    snapshotFatPer100g: .string("7"),
                    snapshotCarbsPer100g: .string("18"),
                    snapshotProteinPer100g: .string("10"),
                    snapshotFiberPer100g: .string("3"),
                    snapshotSugarPer100g: .string("4")
                )
            ]
        )
    }

    private var previewPlan: NutritionPlan {
        NutritionPlan(
            id: "plan-1",
            name: "Training day",
            description: "Higher protein template.",
            nutritionPlanMeals: [
                NutritionPlanMealSlot(
                    id: "slot-1",
                    nutritionPlanId: "plan-1",
                    mealId: "meal-1",
                    slotTime: "08:00:00",
                    label: "Breakfast",
                    position: 0,
                    meal: previewMeal
                )
            ],
            nutritionPlanFoods: [
                NutritionPlanFoodSlot(
                    id: "food-slot-1",
                    nutritionPlanId: "plan-1",
                    foodId: "food-2",
                    grams: .string("80"),
                    slotTime: "10:15:00",
                    label: "Snack",
                    position: 0,
                    food: previewFoods[1]
                )
            ]
        )
    }
}
