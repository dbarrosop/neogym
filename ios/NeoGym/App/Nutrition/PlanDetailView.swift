import NeoGymKit
import SwiftUI

struct NutritionPlanDetailView: View {
    @StateObject private var viewModel: NutritionPlanDetailViewModel
    let repository: any NutritionFoodMealRepositoryProtocol
    var onDeleted: () -> Void
    var onMutated: () -> Void

    @Environment(\.presentationMode) private var presentationMode
    @State private var isApplyingToToday = false
    @State private var applyMessage: String?
    @State private var applyFailed = false

    init(
        planId: String,
        repository: any NutritionFoodMealRepositoryProtocol,
        onDeleted: @escaping () -> Void,
        onMutated: @escaping () -> Void
    ) {
        _viewModel = StateObject(wrappedValue: NutritionPlanDetailViewModel(planId: planId, repository: repository))
        self.repository = repository
        self.onDeleted = onDeleted
        self.onMutated = onMutated
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
                content
            }
            .frame(maxWidth: NeoGymTheme.contentMaxWidth)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.bottom, NeoGymTheme.spacingXL)
            .frame(maxWidth: .infinity)
        }
        .navigationTitle("Plan")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                if let plan = viewModel.plan {
                    NavigationLink {
                        NutritionPlanEditView(
                            planId: plan.id,
                            repository: repository,
                            onSaved: {
                                onMutated()
                                Task { await viewModel.load() }
                            },
                            onDeleted: {
                                onDeleted()
                                presentationMode.wrappedValue.dismiss()
                            }
                        )
                    } label: {
                        Text("Edit")
                    }
                    .accessibilityLabel("Edit plan")
                }
            }
        }
        .task { if case .idle = viewModel.state { await viewModel.load() } }
        .refreshable { await viewModel.load() }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            AppLoadingStateView(title: "Loading plan")
        case .loading where viewModel.plan == nil:
            AppLoadingStateView(title: "Loading plan")
        case let .failed(message, _) where viewModel.plan == nil:
            AppErrorStateView(title: "Couldn't load this plan", message: message) { Task { await viewModel.load() } }
                .cardSurface()
        default:
            if let plan = viewModel.plan {
                VStack(alignment: .leading, spacing: NeoGymTheme.spacingXS) {
                    Text(plan.name)
                        .font(.title2.weight(.bold))
                        .foregroundStyle(NeoGymTheme.text)
                        .accessibilityAddTraits(.isHeader)
                    if let description = plan.description, !description.isEmpty {
                        Text(description)
                            .font(.subheadline)
                            .foregroundStyle(NeoGymTheme.textSecondary)
                    }
                }
                .padding(.horizontal, NeoGymTheme.spacingXXS)
                .padding(.top, NeoGymTheme.spacingXS)
                PlanTotalsCard(
                    totals: plan.macroTotals,
                    isApplying: isApplyingToToday,
                    message: applyMessage,
                    messageIsError: applyFailed,
                    useForToday: { useForToday(plan) }
                )
                let slots = NutritionPlanGrouping.groupPlanEntriesByTimeSlot(plan.sortedEntries)
                if slots.isEmpty {
                    AppEmptyStateView(
                        title: "No entries yet",
                        message: "Edit this plan to add meals and foods.",
                        systemImage: "fork.knife"
                    )
                    .cardSurface()
                } else {
                    ForEach(slots, id: \.key) { slot in
                        NutritionPlanSlotDetailCard(slot: slot)
                    }
                }
            }
        }
    }

    /// Selects this plan on today's nutrition day so its slots show in the Log.
    private func useForToday(_ plan: NutritionPlan) {
        guard !isApplyingToToday else { return }
        isApplyingToToday = true
        applyMessage = nil
        Task {
            defer { isApplyingToToday = false }
            let today = DailyIntakeViewModel(date: IntakeGrouping.formatLocalDate(), repository: repository)
            await today.load()
            if await today.updatePlan(nutritionPlanId: plan.id) {
                applyFailed = false
                applyMessage = "Today now follows \(plan.name)."
                onMutated()
            } else {
                applyFailed = true
                applyMessage = today.mutationState.errorMessage ?? today.state.errorMessage ?? "Couldn't update today's plan."
            }
        }
    }
}

/// Planned kcal, the protein/carbs/fat energy split and "Use for today".
private struct PlanTotalsCard: View {
    let totals: MacroTotals
    let isApplying: Bool
    let message: String?
    let messageIsError: Bool
    let useForToday: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
            MetricValueText(value: MetricFormat.whole(totals.kcal), unit: "kcal planned")
            splitBar
            AdaptiveRow(spacing: NeoGymTheme.spacingSM) {
                macro("Protein", totals.protein)
                Spacer(minLength: 0)
                macro("Carbs", totals.carbs)
                Spacer(minLength: 0)
                macro("Fat", totals.fat)
            }
            Button(action: useForToday) {
                HStack {
                    if isApplying { ProgressView().controlSize(.small) }
                    Text("Use for today")
                }
                .font(.body.weight(.semibold))
                .foregroundStyle(NeoGymTheme.accentText)
                .frame(maxWidth: .infinity, minHeight: NeoGymTheme.minimumTapTarget)
                .background(RoundedRectangle(cornerRadius: NeoGymTheme.radiusMD, style: .continuous).fill(NeoGymTheme.accentSoft))
            }
            .buttonStyle(.plain)
            .disabled(isApplying)
            if let message {
                FeedbackBanner(message: message, tone: messageIsError ? .error : .info)
            }
        }
        .padding(NeoGymTheme.spacingMD)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface()
    }

    private var splitBar: some View {
        let protein = totals.protein * 4, carbs = totals.carbs * 4, fat = totals.fat * 9
        let total = max(protein + carbs + fat, 1)
        return GeometryReader { proxy in
            let width = max(proxy.size.width - 4, 0)
            HStack(spacing: 2) {
                Capsule().fill(NeoGymTheme.accent).frame(width: width * protein / total)
                Capsule().fill(NeoGymTheme.series2).frame(width: width * carbs / total)
                Capsule().fill(NeoGymTheme.textSecondary)
            }
        }
        .frame(height: 10)
        .accessibilityElement()
        .accessibilityLabel(
            "Energy split: protein \(Int((protein / total * 100).rounded())) percent, "
                + "carbs \(Int((carbs / total * 100).rounded())) percent, fat \(Int((fat / total * 100).rounded())) percent"
        )
    }

    private func macro(_ label: String, _ grams: Double) -> some View {
        Text("\(label) **\(MetricFormat.whole(grams)) g**")
            .font(.subheadline)
            .monospacedDigit()
            .foregroundStyle(NeoGymTheme.text)
    }
}

private struct NutritionPlanSlotDetailCard: View {
    let slot: NutritionPlanTimeSlot<NutritionPlanEntry>
    @State private var isExpanded = true

    var body: some View {
        VStack(spacing: 0) {
            Button {
                isExpanded.toggle()
            } label: {
                HStack(spacing: 10) {
                    Text(slot.label)
                        .font(.subheadline.weight(.bold))
                        .monospacedDigit()
                        .frame(minWidth: 46, alignment: .leading)
                    Text(countLabel)
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text("\(MetricFormat.whole(slot.totals.kcal)) kcal · P \(MetricFormat.whole(slot.totals.protein))")
                        .font(.footnote)
                        .monospacedDigit()
                        .foregroundStyle(NeoGymTheme.textSecondary)
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(NeoGymTheme.textTertiary)
                }
                .foregroundStyle(NeoGymTheme.text)
                .padding(.horizontal, NeoGymTheme.spacingMD)
                .frame(minHeight: 52)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint(isExpanded ? "Collapses the slot" : "Shows the slot's entries")
            if isExpanded {
                ForEach(slot.entries) { entry in
                    RowSeparator(leadingInset: 0)
                    HStack(spacing: 10) {
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 6) {
                                Text(entry.displayLabel)
                                    .font(.subheadline)
                                    .foregroundStyle(NeoGymTheme.text)
                                if entry.kind == .meal {
                                    Text("MEAL")
                                        .font(.caption2.weight(.bold))
                                        .foregroundStyle(NeoGymTheme.accentText)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Capsule().fill(NeoGymTheme.accentSoft))
                                }
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        Text(detail(entry))
                            .font(.footnote)
                            .foregroundStyle(NeoGymTheme.textSecondary)
                        Text(MetricFormat.whole(entry.macroTotals.kcal))
                            .font(.subheadline)
                            .foregroundStyle(NeoGymTheme.text)
                            .frame(minWidth: 40, alignment: .trailing)
                    }
                    .monospacedDigit()
                    .padding(.horizontal, NeoGymTheme.spacingMD)
                    .frame(minHeight: NeoGymTheme.minimumTapTarget)
                    .accessibilityElement(children: .combine)
                }
            }
        }
        .cardSurface()
    }

    private var countLabel: String {
        var parts: [String] = []
        if slot.mealCount > 0 { parts.append("\(slot.mealCount) \(slot.mealCount == 1 ? "meal" : "meals")") }
        if slot.foodCount > 0 { parts.append("\(slot.foodCount) \(slot.foodCount == 1 ? "food" : "foods")") }
        return parts.joined(separator: ", ")
    }

    private func detail(_ entry: NutritionPlanEntry) -> String {
        switch entry {
        case let .food(food): NutritionMath.formatMacro(food.grams, unit: "g")
        case let .meal(meal): "\(meal.meal?.mealIngredients.count ?? 0) items"
        }
    }
}
