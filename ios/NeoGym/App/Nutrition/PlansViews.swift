import NeoGymKit
import SwiftUI

struct PlansListView: View {
    @StateObject private var viewModel: NutritionPlansListViewModel
    let repository: any NutritionFoodMealRepositoryProtocol
    let reloadToken: Int

    init(repository: any NutritionFoodMealRepositoryProtocol, reloadToken: Int) {
        _viewModel = StateObject(wrappedValue: NutritionPlansListViewModel(repository: repository))
        self.repository = repository
        self.reloadToken = reloadToken
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
                AreaSectionHeader()
                search
                if viewModel.isFiltered, !viewModel.filteredPlans.isEmpty {
                    MacroSummaryView(
                        totals: viewModel.filteredTotals,
                        title: "Filtered plan totals",
                        description: viewModel.filteredPlans.count == 1
                            ? "Totals for the single matching one-day plan."
                            : "Combined totals across all \(viewModel.filteredPlans.count) matching one-day plans.",
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
        SearchField(placeholder: "Search plans or meals", text: $viewModel.searchText, onClear: { viewModel.clearSearch() })
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            AppLoadingStateView(title: "Loading plans")
        case .loading where viewModel.plans.isEmpty:
            AppLoadingStateView(title: "Loading plans")
        case let .failed(message, _) where viewModel.plans.isEmpty:
            AppErrorStateView(title: "Couldn't load plans", message: message) { Task { await viewModel.load() } }
                .cardSurface()
        default:
            if viewModel.filteredPlans.isEmpty {
                VStack(spacing: NeoGymTheme.spacingMD) {
                    AppEmptyStateView(
                        title: viewModel.isFiltered ? "No plans match this search" : "No plans yet",
                        message: viewModel.isFiltered ? "Clear the search or try another meal or food name." : "Create a reusable day template with the + button.",
                        systemImage: "fork.knife"
                    )
                    if viewModel.isFiltered {
                        Button("Clear") { viewModel.clearSearch() }
                            .buttonStyle(NeoGymSecondaryButtonStyle())
                    }
                }
                .padding(.bottom, NeoGymTheme.spacingMD)
                .cardSurface()
            } else {
                VStack(spacing: 0) {
                    ForEach(viewModel.filteredPlans) { plan in
                        NavigationLink(value: NutritionRoute.planDetail(plan.id)) {
                            PlanListRow(item: plan)
                        }
                        .buttonStyle(.plain)
                        if plan.id != viewModel.filteredPlans.last?.id { RowSeparator() }
                    }
                }
                .cardSurface()
            }
        }
    }

}

private struct PlanListRow: View {
    let item: NutritionPlan

    var body: some View {
        let totals = item.macroTotals
        let slots = NutritionPlanGrouping.groupPlanEntriesByTimeSlot(item.sortedEntries).count
        ListRow(
            title: item.name,
            subtitle: "\(slots) slot\(slots == 1 ? "" : "s") · P \(MetricFormat.whole(totals.protein)) · "
                + "C \(MetricFormat.whole(totals.carbs)) · F \(MetricFormat.whole(totals.fat)) g",
            trailingValue: MetricFormat.whole(totals.kcal),
            trailingCaption: "kcal"
        )
    }
}
