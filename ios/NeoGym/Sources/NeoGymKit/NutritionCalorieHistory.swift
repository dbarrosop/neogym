import Combine
import Foundation

@MainActor
public final class NutritionCalorieHistoryViewModel: ObservableObject {
    @Published public private(set) var state: Loadable<NutritionCalorieHistory> = .idle
    private let repository: any NutritionFoodMealRepositoryProtocol

    public init(repository: any NutritionFoodMealRepositoryProtocol) {
        self.repository = repository
    }

    public var history: NutritionCalorieHistory? { state.value }

    public func load() async {
        state = .loading(previous: state.value)
        do {
            for try await history in repository.nutritionCalorieHistoryUpdates() {
                state = .loaded(history)
            }
        } catch where GraphQLDomainError.isCancellation(error) {
            state = state.cancellationFallback
        } catch {
            state = .failed(message: GraphQLDomainError.map(error).localizedDescription, previous: state.value)
        }
    }
}
