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

    public var latestLoggedSlotTime: String? {
        let mealTimes = nutritionLogMeals.compactMap { meal in
            normalizedLoggedSlotTime(meal.slotTime)
        }
        let standaloneTimes = nutritionLogEntries.compactMap { entry in
            entry.nutritionLogMealId == nil ? normalizedLoggedSlotTime(entry.slotTime) : nil
        }
        return (mealTimes + standaloneTimes).max()
    }

    private func normalizedLoggedSlotTime(_ slotTime: String?) -> String? {
        let inputValue = IntakeGrouping.timeToInputValue(slotTime)
        return inputValue.isEmpty ? nil : inputValue
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

public struct EnergyBalanceOverviewSummary: Sendable, Equatable {
    public let date: String
    public let caloriesIn: Double
    public let activeKcal: Double?
    public let restingKcal: Double?
    public let caloriesOut: Double?
    public let net: Double?
    public let netState: DailyCalorieBalanceState
    public let sevenDayAverageNet: Double?
    public let sevenDayAverageState: DailyCalorieBalanceState?
    public let latestLoggedSlotTime: String?
    public let consumedValue: String
    public let consumedCaption: String
    public let burnedValue: String
    public let burnedCaption: String
    public let netTodayValue: String
    public let netTodayCaption: String
    public let sevenDayAverageValue: String
    public let sevenDayAverageCaption: String

    public init(
        payload: NutritionOverviewPayload,
        todayDate: Date = Date(),
        calendar: Calendar = .current,
        locale: Locale = .current
    ) {
        self.init(
            payload: payload,
            today: IntakeGrouping.formatLocalDate(todayDate, calendar: calendar),
            calendar: calendar,
            locale: locale
        )
    }

    public init(
        payload: NutritionOverviewPayload,
        today: String,
        calendar: Calendar = .current,
        locale: Locale = .current
    ) {
        date = today
        let todayDay = payload.daysByDate[today]
        let todayEnergy = payload.energyByDate[today]
        let balance = payload.balance(for: today)
        let average = payload.rollingNetAverage(endingOn: today, days: 7, calendar: calendar)

        caloriesIn = balance.caloriesIn
        activeKcal = todayEnergy?.activeKcal
        restingKcal = todayEnergy?.restingKcal
        caloriesOut = balance.caloriesOut
        net = balance.net
        netState = balance.state
        sevenDayAverageNet = average?.averageNet
        sevenDayAverageState = average?.state
        latestLoggedSlotTime = todayDay?.latestLoggedSlotTime

        consumedValue = Self.kcalValue(balance.caloriesIn, locale: locale)
        consumedCaption = latestLoggedSlotTime
            .map { "As of \(IntakeGrouping.formatTimeOfDay($0, locale: locale))" }
            ?? "No entries yet"
        burnedValue = balance.caloriesOut.map { Self.kcalValue($0, locale: locale) } ?? "No energy"
        burnedCaption = todayEnergy.map(Self.energySplitCaption) ?? "Log active/resting energy"
        netTodayValue = balance.net.map { Self.signedKcalValue($0, locale: locale) } ?? "No energy"
        netTodayCaption = Self.balanceStateCaption(for: balance.state) ?? "Needs energy"
        sevenDayAverageValue = average.map { Self.signedKcalValue($0.averageNet, locale: locale) } ?? "No data"
        sevenDayAverageCaption = average
            .flatMap { Self.balanceStateCaption(for: $0.state) }
            ?? "Log intake and energy to calculate"
    }

    public static func balanceStateCaption(for state: DailyCalorieBalanceState) -> String? {
        switch state {
        case .deficit: "Deficit"
        case .surplus: "Surplus"
        case .balanced: "Balanced"
        case .intakeOnly: nil
        }
    }

    private static func kcalValue(_ value: Double, locale: Locale) -> String {
        NutritionMath.formatMacro(value, unit: "kcal", locale: locale)
    }

    private static func signedKcalValue(_ value: Double, locale: Locale) -> String {
        if value < 0 { return "−\(kcalValue(abs(value), locale: locale))" }
        if value > 0 { return "+\(kcalValue(value, locale: locale))" }
        return kcalValue(0, locale: locale)
    }

    private static func energySplitCaption(_ energy: DailyEnergy) -> String {
        let active = DailyEnergyFormatters.roundedKcal(energy.activeKcal ?? 0)
        let resting = DailyEnergyFormatters.roundedKcal(energy.restingKcal ?? 0)
        return "\(active) + \(resting) kcal"
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

public struct PlanLogEntryInsertValues: Sendable, Equatable {
    public let dayId: String
    public let foodId: String
    public let nutritionPlanFoodId: String?
    public let grams: JSONValue
    public let position: Int
    public let slotTime: String

    public init(
        dayId: String,
        foodId: String,
        nutritionPlanFoodId: String? = nil,
        grams: JSONValue,
        position: Int,
        slotTime: String
    ) {
        self.dayId = dayId
        self.foodId = foodId
        self.nutritionPlanFoodId = nutritionPlanFoodId
        self.grams = grams
        self.position = position
        self.slotTime = slotTime
    }
}

public struct PlanLogMealInsertValues: Sendable, Equatable {
    public let dayId: String
    public let mealId: String
    public let nutritionPlanMealId: String
    public let name: String
    public let slotTime: String
    public let position: Int
    public let entries: [PlanLogEntryInsertValues]

    public init(
        dayId: String,
        mealId: String,
        nutritionPlanMealId: String,
        name: String,
        slotTime: String,
        position: Int,
        entries: [PlanLogEntryInsertValues]
    ) {
        self.dayId = dayId
        self.mealId = mealId
        self.nutritionPlanMealId = nutritionPlanMealId
        self.name = name
        self.slotTime = slotTime
        self.position = position
        self.entries = entries
    }
}

public struct PlanLogMaterialization: Sendable, Equatable {
    public let mealObjects: [PlanLogMealInsertValues]
    public let entryObjects: [PlanLogEntryInsertValues]

    public init(mealObjects: [PlanLogMealInsertValues], entryObjects: [PlanLogEntryInsertValues]) {
        self.mealObjects = mealObjects
        self.entryObjects = entryObjects
    }
}

public struct PlanLogMutationResult: Sendable, Equatable {
    public let mealRows: Int
    public let entryRows: Int

    public init(mealRows: Int, entryRows: Int) {
        self.mealRows = mealRows
        self.entryRows = entryRows
    }
}

public enum PlanLogMaterializationError: Error, Equatable, Sendable {
    case selectedPlanRequired
    case dayRequired
    case emptyPlan
    case missingMealReference
    case emptyMeal(String)
    case missingIngredientFood(String)
    case missingFoodReference
    case missingTargetTime(String)
}

extension PlanLogMaterializationError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case .selectedPlanRequired:
            return "Select a plan before logging it."
        case .dayRequired:
            return "Open the nutrition day before logging a plan."
        case .emptyPlan:
            return "The selected plan has no meals or foods to log."
        case .missingMealReference:
            return "A planned meal is missing its meal reference."
        case let .emptyMeal(name):
            return "\(name) has no ingredients to log."
        case let .missingIngredientFood(name):
            return "\(name) has an ingredient missing its food."
        case .missingFoodReference:
            return "A planned food is missing its food reference."
        case let .missingTargetTime(label):
            return "Choose a logged time for \(label)."
        }
    }
}

public enum PlanLogSlotTimeDefaults {
    public static func build(selectedPlan: NutritionPlan?, fallbackTime: String) -> [String: String] {
        guard let selectedPlan else { return [:] }
        let normalizedFallback = IntakeGrouping.timeToInputValue(fallbackTime)
        let fallback = normalizedFallback.isEmpty ? IntakeGrouping.currentTimeInputValue() : normalizedFallback
        return Dictionary(uniqueKeysWithValues: NutritionPlanGrouping
            .groupPlanEntriesByTimeSlot(selectedPlan.sortedEntries)
            .map { slot in
                (slot.key, IntakeGrouping.timeToInputValue(slot.key).isEmpty ? fallback : slot.key)
            })
    }
}

public enum PlanLogMaterializer {
    public static func build(
        selectedPlan: NutritionPlan?,
        dayId: String,
        existingMealGroups: [NutritionLogMeal],
        existingStandaloneEntries: [NutritionLogEntry],
        slotTimeByKey: [String: String]
    ) throws -> PlanLogMaterialization {
        guard let selectedPlan else { throw PlanLogMaterializationError.selectedPlanRequired }
        guard !dayId.isEmpty else { throw PlanLogMaterializationError.dayRequired }
        let entries = selectedPlan.sortedEntries
        guard !entries.isEmpty else { throw PlanLogMaterializationError.emptyPlan }

        var maxPositionByTime = topLevelPositionsByTime(
            mealGroups: existingMealGroups,
            standaloneEntries: existingStandaloneEntries
        )
        var mealObjects: [PlanLogMealInsertValues] = []
        var entryObjects: [PlanLogEntryInsertValues] = []

        for slot in NutritionPlanGrouping.groupPlanEntriesByTimeSlot(entries) {
            let targetTime = IntakeGrouping.timeToInputValue(slotTimeByKey[slot.key])
            guard !targetTime.isEmpty else {
                throw PlanLogMaterializationError.missingTargetTime(slot.label)
            }

            for entry in slot.entries {
                let position = (maxPositionByTime[targetTime] ?? -1) + 1
                maxPositionByTime[targetTime] = position
                switch entry {
                case let .meal(mealSlot):
                    mealObjects.append(try buildMealObject(
                        mealSlot,
                        dayId: dayId,
                        slotTime: targetTime,
                        position: position
                    ))
                case let .food(foodSlot):
                    entryObjects.append(try buildFoodObject(
                        foodSlot,
                        dayId: dayId,
                        slotTime: targetTime,
                        position: position
                    ))
                }
            }
        }

        return PlanLogMaterialization(mealObjects: mealObjects, entryObjects: entryObjects)
    }

    private static func buildMealObject(
        _ slot: NutritionPlanMealSlot,
        dayId: String,
        slotTime: String,
        position: Int
    ) throws -> PlanLogMealInsertValues {
        guard !slot.mealId.isEmpty, let meal = slot.meal else {
            throw PlanLogMaterializationError.missingMealReference
        }
        guard !meal.mealIngredients.isEmpty else {
            throw PlanLogMaterializationError.emptyMeal(slot.displayLabel)
        }

        let entries = try meal.mealIngredients
            .sorted { left, right in
                if left.position != right.position { return left.position < right.position }
                return left.id < right.id
            }
            .enumerated()
            .map { index, ingredient in
                guard !ingredient.foodId.isEmpty else {
                    throw PlanLogMaterializationError.missingIngredientFood(slot.displayLabel)
                }
                return PlanLogEntryInsertValues(
                    dayId: dayId,
                    foodId: ingredient.foodId,
                    grams: ingredient.grams,
                    position: index,
                    slotTime: slotTime
                )
            }

        return PlanLogMealInsertValues(
            dayId: dayId,
            mealId: slot.mealId,
            nutritionPlanMealId: slot.id,
            name: slot.displayLabel,
            slotTime: slotTime,
            position: position,
            entries: entries
        )
    }

    private static func buildFoodObject(
        _ slot: NutritionPlanFoodSlot,
        dayId: String,
        slotTime: String,
        position: Int
    ) throws -> PlanLogEntryInsertValues {
        guard !slot.foodId.isEmpty else { throw PlanLogMaterializationError.missingFoodReference }
        return PlanLogEntryInsertValues(
            dayId: dayId,
            foodId: slot.foodId,
            nutritionPlanFoodId: slot.id,
            grams: slot.grams,
            position: position,
            slotTime: slotTime
        )
    }

    private static func topLevelPositionsByTime(
        mealGroups: [NutritionLogMeal],
        standaloneEntries: [NutritionLogEntry]
    ) -> [String: Int] {
        var positions: [String: Int] = [:]
        for meal in mealGroups {
            recordPosition(&positions, slotTime: meal.slotTime, position: meal.position)
        }
        for entry in standaloneEntries where entry.nutritionLogMealId == nil {
            recordPosition(&positions, slotTime: entry.slotTime, position: entry.position)
        }
        return positions
    }

    private static func recordPosition(_ positions: inout [String: Int], slotTime: String?, position: Int) {
        let key = IntakeGrouping.timeToInputValue(slotTime)
        guard !key.isEmpty else { return }
        positions[key] = max(positions[key] ?? -1, position)
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
