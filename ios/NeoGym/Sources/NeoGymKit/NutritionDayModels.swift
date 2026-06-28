import Combine
import Foundation

public struct NutritionLogEntry: Decodable, Identifiable, Sendable, Equatable {
    public let id: String
    public let nutritionDayId: String?
    public let nutritionLogMealId: String?
    public let foodId: String?
    public let grams: JSONValue
    public let position: Int
    public let slotTime: String?
    public let snapshotFoodName: String
    public let snapshotKcalPer100g: JSONValue
    public let snapshotFatPer100g: JSONValue
    public let snapshotCarbsPer100g: JSONValue
    public let snapshotProteinPer100g: JSONValue
    public let snapshotFiberPer100g: JSONValue
    public let snapshotSugarPer100g: JSONValue
    public let createdAt: String?
    public let updatedAt: String?

    public init(
        id: String,
        nutritionDayId: String? = nil,
        nutritionLogMealId: String? = nil,
        foodId: String? = nil,
        grams: JSONValue,
        position: Int,
        slotTime: String? = nil,
        snapshotFoodName: String,
        snapshotKcalPer100g: JSONValue,
        snapshotFatPer100g: JSONValue,
        snapshotCarbsPer100g: JSONValue,
        snapshotProteinPer100g: JSONValue,
        snapshotFiberPer100g: JSONValue,
        snapshotSugarPer100g: JSONValue,
        createdAt: String? = nil,
        updatedAt: String? = nil
    ) {
        self.id = id
        self.nutritionDayId = nutritionDayId
        self.nutritionLogMealId = nutritionLogMealId
        self.foodId = foodId
        self.grams = grams
        self.position = position
        self.slotTime = slotTime
        self.snapshotFoodName = snapshotFoodName
        self.snapshotKcalPer100g = snapshotKcalPer100g
        self.snapshotFatPer100g = snapshotFatPer100g
        self.snapshotCarbsPer100g = snapshotCarbsPer100g
        self.snapshotProteinPer100g = snapshotProteinPer100g
        self.snapshotFiberPer100g = snapshotFiberPer100g
        self.snapshotSugarPer100g = snapshotSugarPer100g
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    public var loggedSnapshot: LoggedSnapshotEntry {
        LoggedSnapshotEntry(
            grams: grams,
            snapshotKcalPer100g: snapshotKcalPer100g,
            snapshotFatPer100g: snapshotFatPer100g,
            snapshotCarbsPer100g: snapshotCarbsPer100g,
            snapshotProteinPer100g: snapshotProteinPer100g,
            snapshotFiberPer100g: snapshotFiberPer100g,
            snapshotSugarPer100g: snapshotSugarPer100g
        )
    }

    public var intakeEntry: IntakeEntry {
        IntakeEntry(
            id: id,
            nutritionLogMealId: nutritionLogMealId,
            grams: grams,
            position: Double(position),
            slotTime: slotTime,
            snapshotFoodName: snapshotFoodName,
            snapshotKcalPer100g: snapshotKcalPer100g,
            snapshotFatPer100g: snapshotFatPer100g,
            snapshotCarbsPer100g: snapshotCarbsPer100g,
            snapshotProteinPer100g: snapshotProteinPer100g,
            snapshotFiberPer100g: snapshotFiberPer100g,
            snapshotSugarPer100g: snapshotSugarPer100g
        )
    }
}

public struct NutritionLogMeal: Decodable, Identifiable, Sendable, Equatable {
    public let id: String
    public let nutritionDayId: String?
    public let mealId: String?
    public let nutritionPlanMealId: String?
    public let name: String
    public let slotTime: String?
    public let position: Int
    public let createdAt: String?
    public let updatedAt: String?
    public let nutritionLogEntries: [NutritionLogEntry]

    public init(
        id: String,
        nutritionDayId: String? = nil,
        mealId: String? = nil,
        nutritionPlanMealId: String? = nil,
        name: String,
        slotTime: String? = nil,
        position: Int,
        createdAt: String? = nil,
        updatedAt: String? = nil,
        nutritionLogEntries: [NutritionLogEntry] = []
    ) {
        self.id = id
        self.nutritionDayId = nutritionDayId
        self.mealId = mealId
        self.nutritionPlanMealId = nutritionPlanMealId
        self.name = name
        self.slotTime = slotTime
        self.position = position
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.nutritionLogEntries = nutritionLogEntries
    }

    public var intakeGroup: IntakeLoggedMealGroup {
        IntakeLoggedMealGroup(
            id: id,
            mealId: mealId,
            nutritionPlanMealId: nutritionPlanMealId,
            name: name,
            slotTime: slotTime,
            position: Double(position),
            nutritionLogEntries: nutritionLogEntries.map(\.intakeEntry)
        )
    }
}

public struct NutritionDay: Decodable, Identifiable, Sendable, Equatable {
    public let id: String
    public let userId: String?
    public let logDate: String
    public let nutritionPlanId: String?
    public let createdAt: String?
    public let updatedAt: String?
    public let nutritionPlan: NutritionPlan?
    public let nutritionLogMeals: [NutritionLogMeal]
    public let nutritionLogEntries: [NutritionLogEntry]

    public init(
        id: String,
        userId: String? = nil,
        logDate: String,
        nutritionPlanId: String? = nil,
        createdAt: String? = nil,
        updatedAt: String? = nil,
        nutritionPlan: NutritionPlan? = nil,
        nutritionLogMeals: [NutritionLogMeal] = [],
        nutritionLogEntries: [NutritionLogEntry] = []
    ) {
        self.id = id
        self.userId = userId
        self.logDate = logDate
        self.nutritionPlanId = nutritionPlanId
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.nutritionPlan = nutritionPlan
        self.nutritionLogMeals = nutritionLogMeals
        self.nutritionLogEntries = nutritionLogEntries
    }

    public var allLogEntries: [NutritionLogEntry] {
        nutritionLogEntries + nutritionLogMeals.flatMap(\.nutritionLogEntries)
    }

    public var loggedTotals: MacroTotals {
        NutritionMath.loggedMacroTotals(allLogEntries.map(\.loggedSnapshot))
    }

    public var intakeSlots: [IntakeTimeSlot] {
        IntakeGrouping.groupIntakeByTimeSlot(
            mealGroups: nutritionLogMeals.map(\.intakeGroup),
            standaloneEntries: nutritionLogEntries.map(\.intakeEntry)
        )
    }
}

public struct DailyIntakePayload: Sendable, Equatable {
    public let day: NutritionDay?
    public let nutritionPlans: [NutritionPlan]
    public let meals: [Meal]
    public let foods: [Food]

    public init(day: NutritionDay?, nutritionPlans: [NutritionPlan], meals: [Meal], foods: [Food]) {
        self.day = day
        self.nutritionPlans = nutritionPlans
        self.meals = meals
        self.foods = foods
    }

    public var selectedPlan: NutritionPlan? {
        guard let planId = day?.nutritionPlanId else { return nil }
        return nutritionPlans.first { $0.id == planId }
    }

    public var loggedTotals: MacroTotals {
        day?.loggedTotals ?? .empty
    }

    public var targetTotals: MacroTotals? {
        selectedPlan?.macroTotals
    }
}

public struct LogFoodValues: Sendable, Equatable {
    public let dayId: String
    public let foodId: String
    public let grams: String
    public let slotTime: String
    public let position: Int

    public init(dayId: String, foodId: String, grams: String, slotTime: String, position: Int) {
        self.dayId = dayId
        self.foodId = foodId
        self.grams = grams
        self.slotTime = slotTime
        self.position = position
    }
}

public struct LogMealValues: Sendable, Equatable {
    public let dayId: String
    public let meal: Meal
    public let planSlot: NutritionPlanMealSlot?
    public let name: String
    public let slotTime: String
    public let position: Int

    public init(
        dayId: String,
        meal: Meal,
        planSlot: NutritionPlanMealSlot? = nil,
        name: String,
        slotTime: String,
        position: Int
    ) {
        self.dayId = dayId
        self.meal = meal
        self.planSlot = planSlot
        self.name = name
        self.slotTime = slotTime
        self.position = position
    }
}

public struct LogEntryUpdateValues: Sendable, Equatable {
    public let grams: String?
    public let position: Int?
    public let slotTime: String?

    public init(grams: String? = nil, position: Int? = nil, slotTime: String? = nil) {
        self.grams = grams
        self.position = position
        self.slotTime = slotTime
    }
}

public struct LogMealUpdateValues: Sendable, Equatable {
    public let name: String?
    public let position: Int?
    public let slotTime: String?

    public init(name: String? = nil, position: Int? = nil, slotTime: String? = nil) {
        self.name = name
        self.position = position
        self.slotTime = slotTime
    }
}
