import Combine
import Foundation

@MainActor
public final class NutritionDaysListViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<[NutritionDay]> = .idle

    private let repository: any NutritionFoodMealRepositoryProtocol

    public init(repository: any NutritionFoodMealRepositoryProtocol) {
        self.repository = repository
    }

    public var days: [NutritionDay] { state.value ?? [] }
    public var today: String { IntakeGrouping.formatLocalDate() }

    public func load() async {
        state = .loading(previous: state.value)
        do {
            state = .loaded(try await repository.listNutritionDays())
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
