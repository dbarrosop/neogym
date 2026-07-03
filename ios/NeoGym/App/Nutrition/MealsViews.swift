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
            VStack(alignment: .leading, spacing: 18) {
                header
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
            .frame(maxWidth: 760)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.top, NeoGymTheme.screenVerticalPadding + NeoGymTheme.topSectionBarContentClearance)
            .padding(.bottom, NeoGymTheme.screenVerticalPadding)
            .frame(maxWidth: .infinity)
        }
        .task { if case .idle = viewModel.state { await viewModel.load() } }
        .onChange(of: reloadToken) { Task { await viewModel.load() } }
        .refreshable { await viewModel.load() }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: NeoGymTheme.spacingMD) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Nutrition")
                    .font(.caption.weight(.semibold))
                    .textCase(.uppercase)
                    .foregroundColor(NeoGymTheme.mutedText)
                Text("Compose reusable private meal templates from foods.")
                    .font(.subheadline)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
            Spacer(minLength: 0)
            NavigationLink(value: NutritionRoute.mealCreate) {
                HeaderActionButtonLabel()
            }
            .accessibilityLabel("New meal")
        }
    }

    private var search: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundColor(NeoGymTheme.mutedText)
            TextField("Search meals or ingredients…", text: $viewModel.searchText)
                .textInputAutocapitalization(.never)
                .disableAutocorrection(true)
            if !viewModel.searchText.isEmpty {
                Button { viewModel.clearSearch() } label: {
                    Image(systemName: "xmark.circle.fill").foregroundColor(NeoGymTheme.mutedText)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear search")
            }
        }
        .padding(10)
        .nutritionGlassCard(cornerRadius: 12)
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            SectionShell(title: "Loading meals") { AppLoadingStateView(title: "Loading meals") }
        case .loading where viewModel.meals.isEmpty:
            SectionShell(title: "Loading meals") { AppLoadingStateView(title: "Loading meals") }
        case let .failed(message, _) where viewModel.meals.isEmpty:
            SectionShell(title: "Meals") {
                AppErrorStateView(title: "Failed to load meals", message: message) { Task { await viewModel.load() } }
            }
        default:
            if viewModel.filteredMeals.isEmpty {
                SectionShell(title: viewModel.isFiltered ? "No matching meals" : "No meals") {
                    VStack(spacing: 16) {
                        AppEmptyStateView(
                            title: viewModel.isFiltered ? "No meals match this search." : "No meal templates yet.",
                            message: viewModel.isFiltered
                                ? "Clear the search or try another ingredient."
                                : "Create a reusable meal template from your private and public foods.",
                            systemImage: "fork.knife.circle"
                        )
                        if viewModel.isFiltered {
                            Button("Clear search") { viewModel.clearSearch() }
                                .buttonStyle(NeoGymSecondaryButtonStyle())
                        } else {
                            NavigationLink(value: NutritionRoute.mealCreate) {
                                Label("Create your first meal", systemImage: "plus")
                            }
                            .buttonStyle(NeoGymPrimaryButtonStyle())
                        }
                    }
                }
            } else {
                SectionShell(title: "Meals", subtitle: viewModel.isFiltered ? "Filtered" : "Newest updated first") {
                    VStack(spacing: 0) {
                        ForEach(viewModel.filteredMeals) { meal in
                            NavigationLink(value: NutritionRoute.mealDetail(meal.id)) {
                                MealListRow(meal: meal)
                            }
                            if meal.id != viewModel.filteredMeals.last?.id { Divider() }
                        }
                    }
                }
            }
        }
    }

}

private struct MealListRow: View {
    let meal: Meal

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "fork.knife.circle")
                .font(.title3)
                .foregroundColor(.accentColor)
                .frame(width: 44, height: 44)
                .background(Color.accentColor.opacity(0.10), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 5) {
                Text(meal.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.primary)
                    .lineLimit(1)
                Text("\(meal.mealIngredients.count) ingredient\(meal.mealIngredients.count == 1 ? "" : "s") · "
                    + NutritionMath.macroTotalsSummary(meal.macroTotals))
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .lineLimit(2)
                if let description = meal.description, !description.isEmpty {
                    Text(description)
                        .font(.caption2)
                        .foregroundColor(NeoGymTheme.mutedText)
                        .lineLimit(1)
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.bold))
                .foregroundColor(NeoGymTheme.mutedText)
        }
        .padding(.vertical, 11)
    }
}
