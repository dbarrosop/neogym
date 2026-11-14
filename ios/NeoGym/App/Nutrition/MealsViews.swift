import NeoGymKit
import SwiftUI

struct MealsListView: View {
    @StateObject private var viewModel: MealsListViewModel
    let repository: any NutritionFoodMealRepositoryProtocol
    let reloadToken: Int

    init(repository: any NutritionFoodMealRepositoryProtocol, reloadToken: Int) {
        _viewModel = StateObject(wrappedValue: MealsListViewModel(repository: repository))
        self.repository = repository
        self.reloadToken = reloadToken
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
                AreaSectionHeader()
                search
                if viewModel.isFiltered, !viewModel.filteredMeals.isEmpty {
                    MacroSummaryView(
                        totals: viewModel.filteredTotals,
                        title: "Filtered meal totals",
                        description: viewModel.filteredMeals.count == 1
                            ? "Totals for the single matching meal."
                            : "Combined totals across all \(viewModel.filteredMeals.count) matching meals.",
                        compact: true
                    )
                }
                content
            }
            .frame(maxWidth: NeoGymTheme.contentMaxWidth)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.bottom, NeoGymTheme.spacingXL)
            .frame(maxWidth: .infinity)
        }
        .task { if case .idle = viewModel.state { await viewModel.load() } }
        .onChange(of: reloadToken) { Task { await viewModel.load() } }
        .refreshable { await viewModel.load() }
    }


    private var search: some View {
        SearchField(placeholder: "Search meals or ingredients", text: $viewModel.searchText, onClear: { viewModel.clearSearch() })
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            AppLoadingStateView(title: "Loading meals")
        case .loading where viewModel.meals.isEmpty:
            AppLoadingStateView(title: "Loading meals")
        case let .failed(message, _) where viewModel.meals.isEmpty:
            AppErrorStateView(title: "Couldn't load meals", message: message) { Task { await viewModel.load() } }
                .cardSurface()
        default:
            if viewModel.filteredMeals.isEmpty {
                AppEmptyStateView(
                    title: viewModel.isFiltered ? "No meals match this search" : "No meals yet",
                    message: viewModel.isFiltered ? "Clear the search or try another ingredient." : "Create a reusable meal template with the + button.",
                    systemImage: "fork.knife",
                    actionTitle: viewModel.isFiltered ? "Clear" : nil,
                    action: viewModel.clearSearch
                )
            } else {
                VStack(spacing: 0) {
                    ForEach(viewModel.filteredMeals) { meal in
                        NavigationLink(value: NutritionRoute.mealDetail(meal.id)) {
                            MealListRow(item: meal)
                        }
                        .buttonStyle(.plain)
                        if meal.id != viewModel.filteredMeals.last?.id { RowSeparator() }
                    }
                }
                .cardSurface()
            }
        }
    }

}

private struct MealListRow: View {
    let item: Meal

    var body: some View {
        let totals = item.macroTotals
        let count = item.mealIngredients.count
        ListRow(
            title: item.name,
            subtitle: "\(count) ingredient\(count == 1 ? "" : "s") · P \(MetricFormat.whole(totals.protein)) · "
                + "C \(MetricFormat.whole(totals.carbs)) · F \(MetricFormat.whole(totals.fat)) g",
            trailingValue: MetricFormat.whole(totals.kcal),
            trailingCaption: "kcal"
        )
    }
}
