import Combine
import Foundation

@MainActor
public final class FoodsListViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<[Food]> = .idle
    @Published public var searchText = ""
    @Published public var visibility: FoodVisibilityFilter?

    private let repository: any NutritionFoodMealRepositoryProtocol

    public init(repository: any NutritionFoodMealRepositoryProtocol) {
        self.repository = repository
    }

    public var foods: [Food] { state.value ?? [] }
    public var isFiltered: Bool {
        !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || visibility != nil
    }

    public var filteredFoods: [Food] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return foods.filter { food in
            let matchesVisibility: Bool
            switch visibility {
            case .mine: matchesVisibility = !food.isPublic
            case .publicFood: matchesVisibility = food.isPublic
            case nil: matchesVisibility = true
            }
            let matchesQuery = query.isEmpty || food.name.lowercased().contains(query)
            return matchesVisibility && matchesQuery
        }
    }

    public func clearFilters() {
        searchText = ""
        visibility = nil
    }

    public func toggleVisibility(_ next: FoodVisibilityFilter) {
        visibility = visibility == next ? nil : next
    }

    public func load() async {
        state = .loading(previous: state.value)
        do {
            state = .loaded(try await repository.listFoods())
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }
}

@MainActor
public final class FoodDetailViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<Food> = .idle

    public let foodId: String
    private let repository: any NutritionFoodMealRepositoryProtocol

    public init(foodId: String, repository: any NutritionFoodMealRepositoryProtocol) {
        self.foodId = foodId
        self.repository = repository
    }

    public var food: Food? { state.value }

    public func load() async {
        state = .loading(previous: state.value)
        do {
            guard let food = try await repository.food(id: foodId) else {
                state = .failed(message: "Food not found.", previous: nil)
                return
            }
            state = .loaded(food)
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }
}

@MainActor
public final class FoodEditorViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<Food> = .idle
    @Published public private(set) var saveState: Loadable<String> = .idle
    @Published public private(set) var deleteState: Loadable<String> = .idle

    public let foodId: String?
    private let repository: any NutritionFoodMealRepositoryProtocol

    public init(foodId: String?, repository: any NutritionFoodMealRepositoryProtocol) {
        self.foodId = foodId
        self.repository = repository
    }

    public var food: Food? { state.value }
    public var initialValues: FoodFormValues? {
        if let food { return FoodFormModel.values(from: food) }
        return foodId == nil ? .empty : nil
    }

    public func load() async {
        guard let foodId else {
            state = .loaded(Food(
                id: "new",
                name: "",
                isPublic: false,
                kcalPer100g: .number(0),
                fatPer100g: .number(0),
                carbsPer100g: .number(0),
                proteinPer100g: .number(0),
                fiberPer100g: .number(0),
                sugarPer100g: .number(0)
            ))
            return
        }

        state = .loading(previous: state.value)
        do {
            guard let food = try await repository.editFood(id: foodId) else {
                state = .failed(message: "Food not found.", previous: nil)
                return
            }
            state = .loaded(food)
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }

    public func create(values: FoodFormValues) async -> String? {
        saveState = .loading(previous: saveState.value)
        do {
            let id = try await repository.createFood(values)
            saveState = .loaded(id)
            return id
        } catch {
            saveState = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: nil)
            return nil
        }
    }

    public func save(values: FoodFormValues) async -> Bool {
        guard let foodId else {
            saveState = .failed(message: "Food not loaded.", previous: nil)
            return false
        }
        saveState = .loading(previous: saveState.value)
        do {
            try await repository.updateFood(id: foodId, values: values)
            saveState = .loaded(foodId)
            return true
        } catch {
            saveState = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: nil)
            return false
        }
    }

    public func delete() async -> Bool {
        guard let foodId else { return false }
        deleteState = .loading(previous: deleteState.value)
        do {
            try await repository.deleteFood(id: foodId)
            deleteState = .loaded(foodId)
            return true
        } catch {
            deleteState = .failed(message: NutritionFoodMealErrorMapper.foodMessage(for: error), previous: nil)
            return false
        }
    }
}

@MainActor
public final class MealsListViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<[Meal]> = .idle
    @Published public var searchText = ""

    private let repository: any NutritionFoodMealRepositoryProtocol

    public init(repository: any NutritionFoodMealRepositoryProtocol) {
        self.repository = repository
    }

    public var meals: [Meal] { state.value ?? [] }
    public var isFiltered: Bool { !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    public var filteredMeals: [Meal] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else { return meals }
        return meals.filter { meal in
            meal.name.lowercased().contains(query)
                || (meal.description?.lowercased().contains(query) ?? false)
                || meal.mealIngredients.contains { ingredient in
                    ingredient.food?.name.lowercased().contains(query) ?? false
                }
        }
    }

    public var filteredTotals: MacroTotals {
        NutritionMath.mealMacroTotals(filteredMeals.flatMap { meal in
            meal.mealIngredients.map { ingredient in
                MealTotalIngredient(grams: ingredient.grams, food: ingredient.food?.macroFields)
            }
        })
    }

    public func clearSearch() {
        searchText = ""
    }

    public func load() async {
        state = .loading(previous: state.value)
        do {
            state = .loaded(try await repository.listMeals())
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }
}

@MainActor
public final class MealDetailViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<Meal> = .idle

    public let mealId: String
    private let repository: any NutritionFoodMealRepositoryProtocol

    public init(mealId: String, repository: any NutritionFoodMealRepositoryProtocol) {
        self.mealId = mealId
        self.repository = repository
    }

    public var meal: Meal? { state.value }

    public func load() async {
        state = .loading(previous: state.value)
        do {
            guard let meal = try await repository.meal(id: mealId) else {
                state = .failed(message: "Meal not found.", previous: nil)
                return
            }
            state = .loaded(meal)
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }
}

@MainActor
public final class MealEditorViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<MealEditPayload> = .idle
    @Published public private(set) var saveState: Loadable<String> = .idle
    @Published public private(set) var deleteState: Loadable<String> = .idle

    public let mealId: String?
    private let repository: any NutritionFoodMealRepositoryProtocol

    public init(mealId: String?, repository: any NutritionFoodMealRepositoryProtocol) {
        self.mealId = mealId
        self.repository = repository
    }

    public var meal: Meal? { state.value?.meal }
    public var foods: [Food] { state.value?.foods ?? [] }
    public var initialValues: MealFormValues? {
        if let meal { return MealFormModel.values(from: meal) }
        return mealId == nil ? .empty : nil
    }

    public func load() async {
        state = .loading(previous: state.value)
        do {
            if let mealId {
                let payload = try await repository.editMeal(id: mealId)
                guard payload.meal != nil else {
                    state = .failed(message: "Meal not found.", previous: nil)
                    return
                }
                state = .loaded(payload)
            } else {
                let foods = try await repository.foodsForMealForm()
                state = .loaded(MealEditPayload(meal: nil, foods: foods))
            }
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }

    public func create(values: MealFormValues) async -> String? {
        saveState = .loading(previous: saveState.value)
        do {
            let id = try await repository.createMeal(values)
            saveState = .loaded(id)
            return id
        } catch {
            saveState = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: nil)
            return nil
        }
    }

    public func save(values: MealFormValues) async -> Bool {
        guard let mealId, let initialValues else {
            saveState = .failed(message: "Meal not loaded.", previous: nil)
            return false
        }
        saveState = .loading(previous: saveState.value)
        do {
            try await repository.saveMeal(id: mealId, initialValues: initialValues, values: values)
            saveState = .loaded(mealId)
            return true
        } catch {
            saveState = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: nil)
            return false
        }
    }

    public func delete() async -> Bool {
        guard let mealId else { return false }
        deleteState = .loading(previous: deleteState.value)
        do {
            try await repository.deleteMeal(id: mealId)
            deleteState = .loaded(mealId)
            return true
        } catch {
            deleteState = .failed(message: NutritionFoodMealErrorMapper.mealMessage(for: error), previous: nil)
            return false
        }
    }
}
