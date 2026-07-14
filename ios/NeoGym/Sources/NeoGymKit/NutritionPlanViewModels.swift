import Combine
import Foundation

@MainActor
public final class NutritionPlansListViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<[NutritionPlan]> = .idle
    @Published public var searchText = ""

    private let repository: any NutritionFoodMealRepositoryProtocol

    public init(repository: any NutritionFoodMealRepositoryProtocol) {
        self.repository = repository
    }

    public var plans: [NutritionPlan] { state.value ?? [] }
    public var isFiltered: Bool { !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    public var filteredPlans: [NutritionPlan] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else { return plans }
        return plans.filter { plan in
            plan.name.lowercased().contains(query)
                || (plan.description?.lowercased().contains(query) ?? false)
                || plan.nutritionPlanMeals.contains { slot in
                    (slot.label?.lowercased().contains(query) ?? false)
                        || (slot.meal?.name.lowercased().contains(query) ?? false)
                        || (slot.meal?.description?.lowercased().contains(query) ?? false)
                        || (slot.meal?.mealIngredients.contains { ingredient in
                            ingredient.food?.name.lowercased().contains(query) ?? false
                        } ?? false)
                }
                || plan.nutritionPlanFoods.contains { slot in
                    (slot.label?.lowercased().contains(query) ?? false)
                        || (slot.food?.name.lowercased().contains(query) ?? false)
                }
        }
    }

    public var filteredTotals: MacroTotals {
        filteredPlans.reduce(.empty) { total, plan in
            NutritionMath.addMacroTotals(total, plan.macroTotals)
        }
    }

    public func clearSearch() { searchText = "" }

    public func load() async {
        state = .loading(previous: state.value)
        do {
            for try await plans in repository.nutritionPlanListUpdates() {
                state = .loaded(plans)
            }
        } catch where GraphQLDomainError.isCancellation(error) {
            state = state.cancellationFallback
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }
}

@MainActor
public final class NutritionPlanDetailViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<NutritionPlan> = .idle

    public let planId: String
    private let repository: any NutritionFoodMealRepositoryProtocol

    public init(planId: String, repository: any NutritionFoodMealRepositoryProtocol) {
        self.planId = planId
        self.repository = repository
    }

    public var plan: NutritionPlan? { state.value }

    public func load() async {
        state = .loading(previous: state.value)
        do {
            guard let plan = try await repository.plan(id: planId) else {
                state = .failed(message: "Plan not found.", previous: nil)
                return
            }
            state = .loaded(plan)
        } catch where GraphQLDomainError.isCancellation(error) {
            state = state.cancellationFallback
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }
}

@MainActor
public final class NutritionPlanEditorViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<NutritionPlanEditPayload> = .idle
    @Published public private(set) var saveState: Loadable<String> = .idle
    @Published public private(set) var deleteState: Loadable<String> = .idle

    public let planId: String?
    private let repository: any NutritionFoodMealRepositoryProtocol

    public init(planId: String?, repository: any NutritionFoodMealRepositoryProtocol) {
        self.planId = planId
        self.repository = repository
    }

    public var plan: NutritionPlan? { state.value?.plan }
    public var meals: [Meal] { state.value?.meals ?? [] }
    public var foods: [Food] { state.value?.foods ?? [] }
    public var initialValues: NutritionPlanFormValues? {
        if let plan { return NutritionPlanFormModel.values(from: plan) }
        return planId == nil ? .empty : nil
    }

    public func load() async {
        state = .loading(previous: state.value)
        do {
            if let planId {
                let payload = try await repository.editPlan(id: planId)
                guard payload.plan != nil else {
                    state = .failed(message: "Plan not found.", previous: nil)
                    return
                }
                state = .loaded(payload)
            } else {
                let meals = try await repository.mealsForPlanForm()
                let foods = try await repository.foodsForMealForm()
                state = .loaded(NutritionPlanEditPayload(plan: nil, meals: meals, foods: foods))
            }
        } catch where GraphQLDomainError.isCancellation(error) {
            state = state.cancellationFallback
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }

    public func create(values: NutritionPlanFormValues) async -> String? {
        saveState = .loading(previous: saveState.value)
        do {
            let id = try await repository.createPlan(values)
            saveState = .loaded(id)
            return id
        } catch {
            saveState = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: nil)
            return nil
        }
    }

    public func save(values: NutritionPlanFormValues) async -> Bool {
        guard let planId, let initialValues else {
            saveState = .failed(message: "Plan not loaded.", previous: nil)
            return false
        }
        saveState = .loading(previous: saveState.value)
        do {
            try await repository.savePlan(id: planId, initialValues: initialValues, values: values)
            saveState = .loaded(planId)
            return true
        } catch {
            saveState = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: nil)
            return false
        }
    }

    public func delete() async -> Bool {
        guard let planId else { return false }
        deleteState = .loading(previous: deleteState.value)
        do {
            try await repository.deletePlan(id: planId)
            deleteState = .loaded(planId)
            return true
        } catch {
            deleteState = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: nil)
            return false
        }
    }
}
