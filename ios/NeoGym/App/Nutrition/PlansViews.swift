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
            VStack(alignment: .leading, spacing: 18) {
                header
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
        VStack(alignment: .leading, spacing: 4) {
            Text("Nutrition")
                .font(.caption.weight(.semibold))
                .textCase(.uppercase)
                .foregroundColor(NeoGymTheme.mutedText)
            Text(
                "Create reusable one-day templates made of timed meal and food entries. "
                    + "Plans are suggestions only."
            )
            .font(.subheadline)
            .foregroundColor(NeoGymTheme.mutedText)
        }
    }

    private var search: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundColor(NeoGymTheme.mutedText)
            TextField("Search plans or meals…", text: $viewModel.searchText)
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
            SectionShell(title: "Loading plans") { AppLoadingStateView(title: "Loading plans") }
        case .loading where viewModel.plans.isEmpty:
            SectionShell(title: "Loading plans") { AppLoadingStateView(title: "Loading plans") }
        case let .failed(message, _) where viewModel.plans.isEmpty:
            SectionShell(title: "Plans") {
                AppErrorStateView(title: "Failed to load plans", message: message) { Task { await viewModel.load() } }
            }
        default:
            if viewModel.filteredPlans.isEmpty {
                SectionShell(title: viewModel.isFiltered ? "No matching plans" : "No plans") {
                    VStack(spacing: 16) {
                        AppEmptyStateView(
                            title: viewModel.isFiltered ? "No plans match this search." : "No daily plans yet.",
                            message: viewModel.isFiltered
                                ? "Clear the search or try another meal or food name."
                                : "Create a reusable day template from meals and foods.",
                            systemImage: "list.bullet.rectangle"
                        )
                        if viewModel.isFiltered {
                            Button("Clear search") { viewModel.clearSearch() }
                                .buttonStyle(NeoGymSecondaryButtonStyle())
                        } else {
                            NavigationLink(value: NutritionRoute.planCreate) {
                                Label("Create your first plan", systemImage: "plus")
                            }
                            .buttonStyle(NeoGymPrimaryButtonStyle())
                        }
                    }
                }
            } else {
                SectionShell(title: "Plans", subtitle: viewModel.isFiltered ? "Filtered" : "Newest updated first") {
                    VStack(spacing: 0) {
                        ForEach(viewModel.filteredPlans) { plan in
                            NavigationLink(value: NutritionRoute.planDetail(plan.id)) {
                                PlanListRow(plan: plan)
                            }
                            if plan.id != viewModel.filteredPlans.last?.id { Divider() }
                        }
                    }
                }
            }
        }
    }

}

private struct PlanListRow: View {
    let plan: NutritionPlan

    var body: some View {
        let sortedEntries = plan.sortedEntries
        let firstEntry = sortedEntries.first
        let firstEntrySummary = firstEntry.map { entry in
            "\(IntakeGrouping.formatTimeOfDay(entry.slotTime)) · \(entry.displayLabel)"
        } ?? "No entries yet"
        HStack(spacing: 12) {
            Image(systemName: "list.bullet.rectangle")
                .font(.title3)
                .foregroundColor(.accentColor)
                .frame(width: 44, height: 44)
                .background(Color.accentColor.opacity(0.10), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 5) {
                Text(plan.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.primary)
                    .lineLimit(1)
                Text("\(sortedEntries.count) entr\(sortedEntries.count == 1 ? "y" : "ies") · \(firstEntrySummary) · "
                    + NutritionMath.macroTotalsSummary(plan.macroTotals))
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .lineLimit(2)
                if let description = plan.description, !description.isEmpty {
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
