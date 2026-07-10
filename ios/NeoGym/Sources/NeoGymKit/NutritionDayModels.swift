import Combine
import Foundation

public enum NutritionLogEntrySource: String, Codable, Sendable, Equatable {
    case food
    case adHoc = "ad_hoc"
}

public struct NutritionLogEntry: Decodable, Identifiable, Sendable, Equatable {
    public let id: String
    public let nutritionDayId: String?
    public let nutritionLogMealId: String?
    public let nutritionPlanFoodId: String?
    public let foodId: String?
    public let source: NutritionLogEntrySource
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
        nutritionPlanFoodId: String? = nil,
        foodId: String? = nil,
        source: NutritionLogEntrySource = .food,
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
        self.nutritionPlanFoodId = nutritionPlanFoodId
        self.foodId = foodId
        self.source = source
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

    public var isAdHoc: Bool { source == .adHoc }

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
            source: source,
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

    private enum CodingKeys: String, CodingKey {
        case id
        case nutritionDayId
        case nutritionLogMealId
        case nutritionPlanFoodId
        case foodId
        case source
        case grams
        case position
        case slotTime
        case snapshotFoodName
        case snapshotKcalPer100g
        case snapshotFatPer100g
        case snapshotCarbsPer100g
        case snapshotProteinPer100g
        case snapshotFiberPer100g
        case snapshotSugarPer100g
        case createdAt
        case updatedAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        nutritionDayId = try container.decodeIfPresent(String.self, forKey: .nutritionDayId)
        nutritionLogMealId = try container.decodeIfPresent(String.self, forKey: .nutritionLogMealId)
        nutritionPlanFoodId = try container.decodeIfPresent(String.self, forKey: .nutritionPlanFoodId)
        foodId = try container.decodeIfPresent(String.self, forKey: .foodId)
        source = try container.decodeIfPresent(NutritionLogEntrySource.self, forKey: .source) ?? .food
        grams = try container.decode(JSONValue.self, forKey: .grams)
        position = try container.decode(Int.self, forKey: .position)
        slotTime = try container.decodeIfPresent(String.self, forKey: .slotTime)
        snapshotFoodName = try container.decode(String.self, forKey: .snapshotFoodName)
        snapshotKcalPer100g = try container.decode(JSONValue.self, forKey: .snapshotKcalPer100g)
        snapshotFatPer100g = try container.decode(JSONValue.self, forKey: .snapshotFatPer100g)
        snapshotCarbsPer100g = try container.decode(JSONValue.self, forKey: .snapshotCarbsPer100g)
        snapshotProteinPer100g = try container.decode(JSONValue.self, forKey: .snapshotProteinPer100g)
        snapshotFiberPer100g = try container.decode(JSONValue.self, forKey: .snapshotFiberPer100g)
        snapshotSugarPer100g = try container.decode(JSONValue.self, forKey: .snapshotSugarPer100g)
        createdAt = try container.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
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

public enum DailyCalorieBalanceState: Sendable, Equatable {
    case intakeOnly
    case deficit
    case surplus
    case balanced
}

public struct DailyCalorieBalance: Sendable, Equatable {
    public let caloriesIn: Double
    public let caloriesOut: Double?
    public let net: Double?
    public let state: DailyCalorieBalanceState

    public init(caloriesIn: Double, dailyEnergy: DailyEnergy?) {
        self.caloriesIn = caloriesIn
        guard let dailyEnergy else {
            caloriesOut = nil
            net = nil
            state = .intakeOnly
            return
        }

        let output = (dailyEnergy.activeKcal ?? 0) + (dailyEnergy.restingKcal ?? 0)
        caloriesOut = output
        let computedNet = caloriesIn - output
        net = computedNet
        if computedNet < 0 {
            state = .deficit
        } else if computedNet > 0 {
            state = .surplus
        } else {
            state = .balanced
        }
    }
}

public struct NutritionOverviewPayload: Sendable, Equatable {
    public let days: [NutritionDay]
    public let dailyEnergyEntries: [DailyEnergy]

    public init(days: [NutritionDay], dailyEnergyEntries: [DailyEnergy] = []) {
        self.days = days
        self.dailyEnergyEntries = dailyEnergyEntries
    }

    public var daysByDate: [String: NutritionDay] {
        Dictionary(uniqueKeysWithValues: days.map { ($0.logDate, $0) })
    }

    public var energyByDate: [String: DailyEnergy] {
        Dictionary(uniqueKeysWithValues: dailyEnergyEntries.map { ($0.energyOn, $0) })
    }

    public func balance(for date: String) -> DailyCalorieBalance {
        DailyCalorieBalance(
            caloriesIn: daysByDate[date]?.loggedTotals.kcal ?? 0,
            dailyEnergy: energyByDate[date]
        )
    }

    public func rollingNetAverage(
        endingOn endDate: String,
        days count: Int = 7,
        calendar: Calendar = .current
    ) -> RollingCalorieNetAverage? {
        let nets = netValues(endingOn: endDate, days: count, calendar: calendar)
        guard !nets.isEmpty else { return nil }
        let average = nets.reduce(0, +) / Double(nets.count)
        return RollingCalorieNetAverage(
            averageNet: average,
            includedDayCount: nets.count,
            windowDayCount: max(count, 1)
        )
    }

    public func dailyNetValues() -> [DatedCalorieNet] {
        let energyByDate = energyByDate
        return days.compactMap { day in
            guard let energy = energyByDate[day.logDate],
                  let net = DailyCalorieBalance(caloriesIn: day.loggedTotals.kcal, dailyEnergy: energy).net
            else { return nil }
            return DatedCalorieNet(date: day.logDate, net: net)
        }
        .sorted { $0.date < $1.date }
    }

    public func rollingNetAverageValues(days count: Int = 7, calendar: Calendar = .current) -> [DatedCalorieNet] {
        days.compactMap { day in
            guard let average = rollingNetAverage(endingOn: day.logDate, days: count, calendar: calendar) else {
                return nil
            }
            return DatedCalorieNet(date: day.logDate, net: average.averageNet)
        }
        .sorted { $0.date < $1.date }
    }

    private func netValues(endingOn endDate: String, days count: Int, calendar: Calendar) -> [Double] {
        let daysByDate = daysByDate
        let energyByDate = energyByDate
        let dates = (0..<max(count, 1)).map { offset in
            IntakeGrouping.addLocalDateDays(endDate, days: -offset, calendar: calendar)
        }

        return dates.compactMap { date -> Double? in
            guard let day = daysByDate[date], let energy = energyByDate[date] else { return nil }
            return DailyCalorieBalance(caloriesIn: day.loggedTotals.kcal, dailyEnergy: energy).net
        }
    }
}

public struct DatedCalorieNet: Sendable, Equatable {
    public let date: String
    public let net: Double

    public init(date: String, net: Double) {
        self.date = date
        self.net = net
    }
}

public struct RollingCalorieNetAverage: Sendable, Equatable {
    public let averageNet: Double
    public let includedDayCount: Int
    public let windowDayCount: Int

    public init(averageNet: Double, includedDayCount: Int, windowDayCount: Int) {
        self.averageNet = averageNet
        self.includedDayCount = includedDayCount
        self.windowDayCount = windowDayCount
    }

    public var state: DailyCalorieBalanceState {
        if averageNet < 0 { return .deficit }
        if averageNet > 0 { return .surplus }
        return .balanced
    }
}

public struct DailyIntakePayload: Sendable, Equatable {
    public let day: NutritionDay?
    public let dailyEnergy: DailyEnergy?
    public let nutritionPlans: [NutritionPlan]
    public let meals: [Meal]
    public let foods: [Food]

    public init(
        day: NutritionDay?,
        dailyEnergy: DailyEnergy? = nil,
        nutritionPlans: [NutritionPlan],
        meals: [Meal],
        foods: [Food]
    ) {
        self.day = day
        self.dailyEnergy = dailyEnergy
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

    public var calorieBalance: DailyCalorieBalance {
        DailyCalorieBalance(caloriesIn: loggedTotals.kcal, dailyEnergy: dailyEnergy)
    }

    public var caloriesIn: Double { calorieBalance.caloriesIn }
    public var caloriesOut: Double? { calorieBalance.caloriesOut }
    public var netCalories: Double? { calorieBalance.net }
}

public struct LogFoodValues: Sendable, Equatable {
    public let dayId: String
    public let foodId: String
    public let nutritionPlanFoodId: String?
    public let grams: String
    public let slotTime: String
    public let position: Int

    public init(
        dayId: String,
        foodId: String,
        nutritionPlanFoodId: String? = nil,
        grams: String,
        slotTime: String,
        position: Int
    ) {
        self.dayId = dayId
        self.foodId = foodId
        self.nutritionPlanFoodId = nutritionPlanFoodId
        self.grams = grams
        self.slotTime = slotTime
        self.position = position
    }
}

public struct GramMacroStrings: Sendable, Equatable {
    public let fatPer100g: String
    public let carbsPer100g: String
    public let proteinPer100g: String
    public let fiberPer100g: String
    public let sugarPer100g: String

    public init(
        fatPer100g: String,
        carbsPer100g: String,
        proteinPer100g: String,
        fiberPer100g: String,
        sugarPer100g: String
    ) {
        self.fatPer100g = fatPer100g
        self.carbsPer100g = carbsPer100g
        self.proteinPer100g = proteinPer100g
        self.fiberPer100g = fiberPer100g
        self.sugarPer100g = sugarPer100g
    }
}

public struct Per100gMacroStrings: Sendable, Equatable {
    public let kcalPer100g: String
    public let grams: GramMacroStrings

    public init(kcalPer100g: String, grams: GramMacroStrings) {
        self.kcalPer100g = kcalPer100g
        self.grams = grams
    }
}

public struct AdHocFoodDraftValues: Sendable, Equatable {
    public let name: String
    public let grams: String
    public let slotTime: String
    public let macros: Per100gMacroStrings

    public init(name: String, grams: String, slotTime: String, macros: Per100gMacroStrings) {
        self.name = name
        self.grams = grams
        self.slotTime = slotTime
        self.macros = macros
    }
}

public struct LogAdHocFoodValues: Sendable, Equatable {
    public let dayId: String
    public let position: Int
    public let draft: AdHocFoodDraftValues

    public init(dayId: String, position: Int, draft: AdHocFoodDraftValues) {
        self.dayId = dayId
        self.position = position
        self.draft = draft
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
    public let adHocDraft: AdHocFoodDraftValues?

    public init(
        grams: String? = nil,
        position: Int? = nil,
        slotTime: String? = nil,
        adHocDraft: AdHocFoodDraftValues? = nil
    ) {
        self.grams = grams
        self.position = position
        self.slotTime = slotTime
        self.adHocDraft = adHocDraft
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
