import NeoGymKit
import SwiftUI

struct FoodsListView: View {
    @StateObject private var viewModel: FoodsListViewModel
    let repository: any NutritionFoodMealRepositoryProtocol
    let currentUserId: String?
    let reloadToken: Int

    init(repository: any NutritionFoodMealRepositoryProtocol, currentUserId: String?, reloadToken: Int) {
        _viewModel = StateObject(wrappedValue: FoodsListViewModel(repository: repository))
        self.repository = repository
        self.currentUserId = currentUserId
        self.reloadToken = reloadToken
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
                AreaSectionHeader()
                filters
                content
            }
            .frame(maxWidth: NeoGymTheme.contentMaxWidth)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.bottom, NeoGymTheme.spacingXL)
            .frame(maxWidth: .infinity)
        }
        .task {
            if case .idle = viewModel.state {
                await viewModel.load()
            }
        }
        .onChange(of: reloadToken) { Task { await viewModel.load() } }
        .refreshable { await viewModel.load() }
    }


    private var filters: some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
            SearchField(placeholder: "Search foods", text: $viewModel.searchText)
            HStack(spacing: NeoGymTheme.spacingXS) {
                ForEach(FoodVisibilityFilter.allCases, id: \.self) { visibility in
                    FilterChip(title: visibility.title, isSelected: viewModel.visibility == visibility) {
                        viewModel.toggleVisibility(visibility)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            AppLoadingStateView(title: "Loading foods")
        case .loading where viewModel.foods.isEmpty:
            AppLoadingStateView(title: "Loading foods")
        case let .failed(message, _) where viewModel.foods.isEmpty:
            AppErrorStateView(title: "Couldn't load foods", message: message) { Task { await viewModel.load() } }
                .cardSurface()
        default:
            if viewModel.filteredFoods.isEmpty {
                AppEmptyStateView(
                    title: viewModel.isFiltered ? "No foods match these filters" : "No foods yet",
                    message: viewModel.isFiltered ? "Clear a filter or try a different search." : "Create a private food with the + button.",
                    systemImage: "fork.knife",
                    actionTitle: viewModel.isFiltered ? "Clear" : nil,
                    action: viewModel.clearFilters
                )
            } else {
                VStack(spacing: 0) {
                    ForEach(viewModel.filteredFoods) { food in
                        NavigationLink(value: NutritionRoute.foodDetail(food.id)) {
                            FoodListRow(item: food)
                        }
                        .buttonStyle(.plain)
                        if food.id != viewModel.filteredFoods.last?.id { RowSeparator() }
                    }
                }
                .cardSurface()
            }
        }
    }

}

private struct FoodListRow: View {
    let item: Food

    var body: some View {
        let fields = item.macroFields
        ListRow(
            title: item.name,
            subtitle: "P \(MetricFormat.whole(NutritionMath.normalizeNumeric(fields.proteinPer100g))) · "
                + "C \(MetricFormat.whole(NutritionMath.normalizeNumeric(fields.carbsPer100g))) · "
                + "F \(MetricFormat.whole(NutritionMath.normalizeNumeric(fields.fatPer100g))) g"
                + (item.isPublic ? " · Public" : ""),
            trailingValue: MetricFormat.whole(NutritionMath.normalizeNumeric(fields.kcalPer100g)),
            trailingCaption: "kcal/100 g"
        )
    }
}
