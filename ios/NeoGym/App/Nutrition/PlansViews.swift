import NeoGymKit
import SwiftUI

struct PlansListView: View {
    @StateObject private var viewModel: NutritionPlansListViewModel
    let repository: any NutritionFoodMealRepositoryProtocol

    @State private var navigatedPlanId: String?
    @State private var isNavigatingToPlan = false

    init(repository: any NutritionFoodMealRepositoryProtocol) {
        _viewModel = StateObject(wrappedValue: NutritionPlansListViewModel(repository: repository))
        self.repository = repository
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
            .padding(.horizontal, 20)
            .padding(.vertical, 24)
            .frame(maxWidth: .infinity)
        }
        .background(GridBackground())
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                NavigationLink {
                    NutritionPlanCreateView(
                        repository: repository,
                        onCreated: { id in
                            Task { await viewModel.load() }
                            navigatedPlanId = id
                            isNavigatingToPlan = true
                        },
                        onFinished: { Task { await viewModel.load() } }
                    )
                } label: { Image(systemName: "plus") }
                    .accessibilityLabel("New plan")
            }
        }
        .background(pendingNavigationLink)
        .task { if case .idle = viewModel.state { await viewModel.load() } }
        .refreshable { await viewModel.load() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Nutrition")
                .font(.caption.weight(.semibold))
                .textCase(.uppercase)
                .foregroundColor(NeoGymTheme.mutedText)
            Text("Plans")
                .font(.largeTitle.bold())
                .tracking(-0.8)
            Text("Create reusable one-day templates made of timed meal slots. Plans are suggestions only.")
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
            }
        }
        .padding(10)
        .background(NeoGymTheme.cardFill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(NeoGymTheme.border))
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
                                ? "Clear the search or try another meal name."
                                : "Create a reusable day template from your meal library.",
                            systemImage: "list.bullet.rectangle"
                        )
                        if viewModel.isFiltered {
                            Button("Clear search") { viewModel.clearSearch() }
                                .buttonStyle(NeoGymSecondaryButtonStyle())
                        } else {
                            NavigationLink {
                                NutritionPlanCreateView(
                                    repository: repository,
                                    onCreated: { id in
                                        Task { await viewModel.load() }
                                        navigatedPlanId = id
                                        isNavigatingToPlan = true
                                    },
                                    onFinished: { Task { await viewModel.load() } }
                                )
                            } label: {
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
                            NavigationLink {
                                NutritionPlanDetailView(
                                    planId: plan.id,
                                    repository: repository,
                                    onDeleted: { Task { await viewModel.load() } },
                                    onMutated: { Task { await viewModel.load() } }
                                )
                            } label: {
                                PlanListRow(plan: plan)
                            }
                            if plan.id != viewModel.filteredPlans.last?.id { Divider() }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var pendingNavigationLink: some View {
        if let planId = navigatedPlanId {
            NavigationLink(
                destination: NutritionPlanDetailView(
                    planId: planId,
                    repository: repository,
                    onDeleted: { Task { await viewModel.load() } },
                    onMutated: { Task { await viewModel.load() } }
                ),
                isActive: $isNavigatingToPlan
            ) { EmptyView() }
            .hidden()
        }
    }
}

private struct PlanListRow: View {
    let plan: NutritionPlan

    var body: some View {
        let sortedSlots = plan.sortedSlots
        let firstSlot = sortedSlots.first
        let firstSlotSummary = firstSlot.map { slot in
            "\(IntakeGrouping.formatTimeOfDay(slot.slotTime)) · \(slot.displayLabel)"
        } ?? "No slots yet"
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
                Text("\(sortedSlots.count) slot\(sortedSlots.count == 1 ? "" : "s") · \(firstSlotSummary) · "
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
