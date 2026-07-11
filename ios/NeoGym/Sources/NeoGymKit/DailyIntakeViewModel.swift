import Combine
import Foundation

@MainActor
public final class NutritionDaysListViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<NutritionOverviewPayload> = .idle

    private let repository: any NutritionFoodMealRepositoryProtocol

    public var days: [NutritionDay] { state.value?.days ?? [] }
    public var overview: NutritionOverviewPayload { state.value ?? NutritionOverviewPayload(days: []) }
    public var today: String { IntakeGrouping.formatLocalDate(now(), calendar: calendar) }
    public var todayBalance: DailyCalorieBalance { overview.balance(for: today) }
    public var sevenDayNetAverage: RollingCalorieNetAverage? {
        overview.rollingNetAverage(endingOn: today, days: 7, calendar: calendar)
    }

    public func energyBalanceOverviewSummary(locale: Locale = .current) -> EnergyBalanceOverviewSummary {
        EnergyBalanceOverviewSummary(payload: overview, today: today, calendar: calendar, locale: locale)
    }

    private let calendar: Calendar
    private let now: @Sendable () -> Date

    public init(
        repository: any NutritionFoodMealRepositoryProtocol,
        calendar: Calendar = .current,
        now: @escaping @Sendable () -> Date = Date.init
    ) {
        self.repository = repository
        self.calendar = calendar
        self.now = now
    }

    public func load() async {
        state = .loading(previous: state.value)
        do {
            state = .loaded(try await repository.nutritionOverview())
        } catch where GraphQLDomainError.isCancellation(error) {
            state = state.cancellationFallback
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }
}

@MainActor
public final class DailyIntakeViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<DailyIntakePayload> = .idle
    @Published public private(set) var mutationState: Loadable<String> = .idle

    public private(set) var date: String
    private let repository: any NutritionFoodMealRepositoryProtocol

    public init(date: String, repository: any NutritionFoodMealRepositoryProtocol) {
        self.date = IntakeGrouping.isValidLocalDate(date) ? date : IntakeGrouping.formatLocalDate()
        self.repository = repository
    }

    public var payload: DailyIntakePayload? { state.value }
    public var day: NutritionDay? { payload?.day }
    public var selectedPlan: NutritionPlan? { payload?.selectedPlan }
    public var intakeSlots: [IntakeTimeSlot] { day?.intakeSlots ?? [] }
    public var calorieBalance: DailyCalorieBalance {
        payload?.calorieBalance ?? DailyCalorieBalance(caloriesIn: 0, dailyEnergy: nil)
    }
    public var caloriesIn: Double { calorieBalance.caloriesIn }
    public var caloriesOut: Double? { calorieBalance.caloriesOut }
    public var netCalories: Double? { calorieBalance.net }
    public var allEntries: [NutritionLogEntry] { day?.allLogEntries ?? [] }
    public var nextEntryPosition: Int { allEntries.count }
    public var nextGroupPosition: Int { day?.nutritionLogMeals.count ?? 0 }
    public var isMutating: Bool { mutationState.isLoading }

    public func setDate(_ date: String) async {
        self.date = IntakeGrouping.isValidLocalDate(date) ? date : IntakeGrouping.formatLocalDate()
        state = .idle
        await load()
    }

    public func moveDate(days: Int) async {
        await setDate(IntakeGrouping.addLocalDateDays(date, days: days))
    }

    public func load() async {
        state = .loading(previous: state.value)
        do {
            state = .loaded(try await repository.openDailyIntake(date: date))
        } catch where GraphQLDomainError.isCancellation(error) {
            state = state.cancellationFallback
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }

    public func ensureDay() async throws -> String {
        if let id = state.value?.day?.id { return id }
        do {
            let id = try await repository.createNutritionDay(date: date, nutritionPlanId: nil)
            await load()
            return id
        } catch {
            if !Self.isUniqueConflict(error) { throw error }
            let payload = try await repository.openDailyIntake(date: date)
            state = .loaded(payload)
            if let id = payload.day?.id { return id }
            throw GraphQLDomainError.missingData(operationName: "CreateNutritionDay")
        }
    }

    public func updatePlan(nutritionPlanId: String?) async -> Bool {
        mutationState = .loading(previous: mutationState.value)
        do {
            let dayId: String
            if let existing = day?.id {
                dayId = existing
            } else if nutritionPlanId != nil {
                dayId = try await ensureDay()
            } else {
                mutationState = .loaded("No plan selected")
                return true
            }
            try await repository.updateNutritionDayPlan(dayId: dayId, nutritionPlanId: nutritionPlanId)
            mutationState = .loaded("Day plan updated")
            await load()
            return true
        } catch {
            mutationState = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: nil)
            return false
        }
    }

    public func logFood(
        foodId: String,
        grams: String,
        slotTime: String,
        position: Int? = nil,
        nutritionPlanFoodId: String? = nil
    ) async -> Bool {
        guard validatePositiveGrams(grams), !foodId.isEmpty else {
            mutationState = .failed(message: "Choose a food and enter grams greater than zero.", previous: nil)
            return false
        }
        let time = IntakeGrouping.timeToInputValue(slotTime)
        guard !time.isEmpty else {
            mutationState = .failed(message: "Choose the time eaten.", previous: nil)
            return false
        }

        mutationState = .loading(previous: mutationState.value)
        do {
            let dayId = try await ensureDay()
            _ = try await repository.logFood(LogFoodValues(
                dayId: dayId,
                foodId: foodId,
                nutritionPlanFoodId: nutritionPlanFoodId,
                grams: normalizedDecimal(grams),
                slotTime: time,
                position: position ?? nextEntryPosition
            ))
            mutationState = .loaded("Food logged")
            await load()
            return true
        } catch {
            mutationState = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: nil)
            return false
        }
    }

    public func logPlanFood(_ planSlot: NutritionPlanFoodSlot, grams: String? = nil, slotTime: String, position: Int? = nil) async -> Bool {
        await logFood(
            foodId: planSlot.foodId,
            grams: grams ?? NutritionMath.formatEditableDecimal(planSlot.grams),
            slotTime: slotTime,
            position: position,
            nutritionPlanFoodId: planSlot.id
        )
    }

    public func logAdHocFood(_ draft: AdHocFoodDraftValues, position: Int? = nil) async -> Bool {
        guard let normalizedDraft = validateAdHocDraft(draft) else { return false }

        mutationState = .loading(previous: mutationState.value)
        do {
            let dayId = try await ensureDay()
            _ = try await repository.logAdHocFood(LogAdHocFoodValues(
                dayId: dayId,
                position: position ?? nextEntryPosition,
                draft: normalizedDraft
            ))
            mutationState = .loaded("Custom food logged")
            await load()
            return true
        } catch {
            mutationState = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: nil)
            return false
        }
    }

    public func logMeal(meal: Meal, planSlot: NutritionPlanMealSlot?, slotTime: String, position: Int? = nil) async -> Bool {
        guard !meal.mealIngredients.isEmpty else {
            mutationState = .failed(message: "This meal has no ingredients to log.", previous: nil)
            return false
        }
        let time = IntakeGrouping.timeToInputValue(slotTime)
        guard !time.isEmpty else {
            mutationState = .failed(message: "Choose the time eaten.", previous: nil)
            return false
        }

        mutationState = .loading(previous: mutationState.value)
        do {
            let dayId = try await ensureDay()
            _ = try await repository.logMeal(LogMealValues(
                dayId: dayId,
                meal: meal,
                planSlot: planSlot,
                name: planSlot?.displayLabel ?? meal.name,
                slotTime: time,
                position: position ?? nextGroupPosition
            ))
            mutationState = .loaded("Meal logged")
            await load()
            return true
        } catch {
            mutationState = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: nil)
            return false
        }
    }

    public func updateEntry(id: String, grams: String, position: Int, slotTime: String?) async -> Bool {
        guard validatePositiveGrams(grams) else {
            mutationState = .failed(message: "Enter grams greater than zero.", previous: nil)
            return false
        }
        let normalizedTime = slotTime.map(IntakeGrouping.timeToInputValue)
        if let normalizedTime, normalizedTime.isEmpty {
            mutationState = .failed(message: "Choose a valid time.", previous: nil)
            return false
        }

        mutationState = .loading(previous: mutationState.value)
        do {
            try await repository.updateLogEntry(id: id, values: LogEntryUpdateValues(
                grams: normalizedDecimal(grams),
                position: position,
                slotTime: normalizedTime
            ))
            mutationState = .loaded("Entry updated")
            await load()
            return true
        } catch {
            mutationState = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: nil)
            return false
        }
    }

    public func updateAdHocEntry(
        id: String,
        draft: AdHocFoodDraftValues,
        position: Int,
        includeSlotTime: Bool
    ) async -> Bool {
        guard let normalizedDraft = validateAdHocDraft(draft) else { return false }
        let normalizedTime = includeSlotTime ? normalizedDraft.slotTime : nil

        mutationState = .loading(previous: mutationState.value)
        do {
            try await repository.updateLogEntry(id: id, values: LogEntryUpdateValues(
                grams: normalizedDraft.grams,
                position: position,
                slotTime: normalizedTime,
                adHocDraft: normalizedDraft
            ))
            mutationState = .loaded("Custom food updated")
            await load()
            return true
        } catch {
            mutationState = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: nil)
            return false
        }
    }

    public func updateMealGroup(id: String, name: String, position: Int, slotTime: String) async -> Bool {
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else {
            mutationState = .failed(message: "Meal group name is required.", previous: nil)
            return false
        }
        let time = IntakeGrouping.timeToInputValue(slotTime)
        guard !time.isEmpty else {
            mutationState = .failed(message: "Choose a valid time.", previous: nil)
            return false
        }

        mutationState = .loading(previous: mutationState.value)
        do {
            try await repository.updateLogMeal(id: id, values: LogMealUpdateValues(name: trimmedName, position: position, slotTime: time))
            mutationState = .loaded("Logged meal updated")
            await load()
            return true
        } catch {
            mutationState = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: nil)
            return false
        }
    }

    public func deleteEntry(id: String) async -> Bool {
        mutationState = .loading(previous: mutationState.value)
        do {
            try await repository.deleteLogEntry(id: id)
            mutationState = .loaded("Entry deleted")
            await load()
            return true
        } catch {
            mutationState = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: nil)
            return false
        }
    }

    public func deleteMealGroup(id: String) async -> Bool {
        mutationState = .loading(previous: mutationState.value)
        do {
            try await repository.deleteLogMeal(id: id)
            mutationState = .loaded("Logged meal deleted")
            await load()
            return true
        } catch {
            mutationState = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: nil)
            return false
        }
    }

    public func deleteDay() async -> Bool {
        guard let id = day?.id else { return true }
        mutationState = .loading(previous: mutationState.value)
        do {
            try await repository.deleteNutritionDay(id: id)
            mutationState = .loaded("Day log cleared")
            state = .loaded(DailyIntakePayload(
                day: nil,
                nutritionPlans: payload?.nutritionPlans ?? [],
                meals: payload?.meals ?? [],
                foods: payload?.foods ?? []
            ))
            return true
        } catch {
            mutationState = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: nil)
            return false
        }
    }

    private func validatePositiveGrams(_ value: String) -> Bool {
        guard let parsed = NutritionMath.parseMacroInput(value) else { return false }
        return parsed > 0
    }

    private func validateAdHocDraft(_ draft: AdHocFoodDraftValues) -> AdHocFoodDraftValues? {
        let trimmedName = draft.name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else {
            mutationState = .failed(message: "Enter a custom food name.", previous: nil)
            return nil
        }
        guard trimmedName.count <= 160 else {
            mutationState = .failed(message: "Custom food name must be 160 characters or fewer.", previous: nil)
            return nil
        }
        guard validatePositiveGrams(draft.grams) else {
            mutationState = .failed(message: "Enter grams greater than zero.", previous: nil)
            return nil
        }
        let time = IntakeGrouping.timeToInputValue(draft.slotTime)
        guard !time.isEmpty else {
            mutationState = .failed(message: "Choose a valid time.", previous: nil)
            return nil
        }
        guard
            let normalizedKcal = normalizedNonnegativeMacro(draft.macros.kcalPer100g),
            let normalizedFat = normalizedNonnegativeMacro(draft.macros.grams.fatPer100g),
            let normalizedCarbs = normalizedNonnegativeMacro(draft.macros.grams.carbsPer100g),
            let normalizedProtein = normalizedNonnegativeMacro(draft.macros.grams.proteinPer100g),
            let normalizedFiber = normalizedNonnegativeMacro(draft.macros.grams.fiberPer100g),
            let normalizedSugar = normalizedNonnegativeMacro(draft.macros.grams.sugarPer100g)
        else {
            mutationState = .failed(message: "Enter nonnegative numbers for all custom food nutrients.", previous: nil)
            return nil
        }
        return AdHocFoodDraftValues(
            name: trimmedName,
            grams: normalizedDecimal(draft.grams),
            slotTime: time,
            macros: Per100gMacroStrings(
                kcalPer100g: normalizedKcal,
                grams: GramMacroStrings(
                    fatPer100g: normalizedFat,
                    carbsPer100g: normalizedCarbs,
                    proteinPer100g: normalizedProtein,
                    fiberPer100g: normalizedFiber,
                    sugarPer100g: normalizedSugar
                )
            )
        )
    }

    private func normalizedNonnegativeMacro(_ value: String) -> String? {
        guard NutritionMath.parseMacroInput(value) != nil else { return nil }
        return normalizedDecimal(value)
    }

    private func normalizedDecimal(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ",", with: ".")
    }

    private static func isUniqueConflict(_ error: Error) -> Bool {
        let message = GraphQLDomainError.map(error).localizedDescription.lowercased()
        return message.contains("unique")
            || message.contains("duplicate key")
            || message.contains("nutrition_days_user_date_uq")
    }
}
