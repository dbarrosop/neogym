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
            VStack(alignment: .leading, spacing: 18) {
                header
                filters
                content
            }
            .frame(maxWidth: 760)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.top, NeoGymTheme.screenVerticalPadding + NeoGymTheme.topSectionBarContentClearance)
            .padding(.bottom, NeoGymTheme.screenVerticalPadding)
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

    private var header: some View {
        HStack(alignment: .top, spacing: NeoGymTheme.spacingMD) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Nutrition")
                    .font(.caption.weight(.semibold))
                    .textCase(.uppercase)
                    .foregroundColor(NeoGymTheme.mutedText)
                Text("Foods")
                    .font(.largeTitle.bold())
                    .tracking(-0.8)
                Text("Search public foods and your private catalog.")
                    .font(.subheadline)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
            Spacer(minLength: 0)
            NavigationLink(value: NutritionRoute.foodCreate) {
                HeaderActionButtonLabel()
            }
            .accessibilityLabel("New food")
        }
    }

    private func visibilityBackground(for visibility: FoodVisibilityFilter) -> Color {
        viewModel.visibility == visibility ? NeoGymTheme.accentMuted : NeoGymTheme.glassSubtleFill
    }

    private var filters: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(NeoGymTheme.mutedText)
                TextField("Search foods…", text: $viewModel.searchText)
                    .textInputAutocapitalization(.never)
                    .disableAutocorrection(true)
                if !viewModel.searchText.isEmpty {
                    Button { viewModel.searchText = "" } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(NeoGymTheme.mutedText)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Clear search")
                }
            }
            .padding(10)
            .nutritionGlassCard(cornerRadius: 12)

            HStack(spacing: 8) {
                ForEach(FoodVisibilityFilter.allCases, id: \.self) { visibility in
                    Button {
                        viewModel.toggleVisibility(visibility)
                    } label: {
                        Label(visibility.title, systemImage: visibility == .mine ? "person.fill" : "globe")
                            .font(.caption.weight(.semibold))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .foregroundColor(viewModel.visibility == visibility ? .accentColor : NeoGymTheme.mutedText)
                            .background(visibilityBackground(for: visibility), in: Capsule())
                            .overlay(Capsule().stroke(NeoGymTheme.border))
                    }
                    .buttonStyle(.plain)
                }
                Spacer()
                if viewModel.isFiltered {
                    Button("Clear") { viewModel.clearFilters() }
                        .font(.caption.weight(.semibold))
                }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            SectionShell(title: "Loading foods") { AppLoadingStateView(title: "Loading foods") }
        case .loading where viewModel.foods.isEmpty:
            SectionShell(title: "Loading foods") { AppLoadingStateView(title: "Loading foods") }
        case let .failed(message, _) where viewModel.foods.isEmpty:
            SectionShell(title: "Foods") {
                AppErrorStateView(title: "Failed to load foods", message: message) {
                    Task { await viewModel.load() }
                }
            }
        default:
            if viewModel.filteredFoods.isEmpty {
                SectionShell(title: viewModel.isFiltered ? "No matching foods" : "No foods") {
                    VStack(spacing: 16) {
                        AppEmptyStateView(
                            title: viewModel.isFiltered ? "No foods match these filters." : "No foods yet.",
                            message: viewModel.isFiltered
                                ? "Clear a filter or try a different search."
                                : "Create a private food to use in meal templates.",
                            systemImage: "apple.logo"
                        )
                        if viewModel.isFiltered {
                            Button("Clear filters") { viewModel.clearFilters() }
                                .buttonStyle(NeoGymSecondaryButtonStyle())
                        } else {
                            NavigationLink(value: NutritionRoute.foodCreate) {
                                Label("Create your first food", systemImage: "plus")
                            }
                            .buttonStyle(NeoGymPrimaryButtonStyle())
                        }
                    }
                }
            } else {
                SectionShell(
                    title: "Foods",
                    subtitle: viewModel.isFiltered
                        ? "\(viewModel.filteredFoods.count) matches"
                        : "Private and public catalog"
                ) {
                    VStack(spacing: 0) {
                        ForEach(viewModel.filteredFoods) { food in
                            NavigationLink(value: NutritionRoute.foodDetail(food.id)) {
                                FoodListRow(food: food)
                            }
                            if food.id != viewModel.filteredFoods.last?.id { Divider() }
                        }
                    }
                }
            }
        }
    }

}

private struct FoodListRow: View {
    let food: Food

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "apple.logo")
                .font(.title3)
                .foregroundColor(.accentColor)
                .frame(width: 44, height: 44)
                .background(Color.accentColor.opacity(0.10), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 6) {
                    Text(food.name)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(.primary)
                        .lineLimit(1)
                    FoodVisibilityBadge(isPublic: food.isPublic)
                }
                Text(NutritionMath.macroSummary(food.macroFields) + " per 100g")
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .lineLimit(2)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.bold))
                .foregroundColor(NeoGymTheme.mutedText)
        }
        .padding(.vertical, 11)
    }
}
