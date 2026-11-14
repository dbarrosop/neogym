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
                Capsule().fill(NeoGymTheme.carbs).frame(width: width * carbs / total)
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
                NutritionSlotHeader(time: slot.label, totals: slot.totals) {
                    title
                } trailing: {
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(NeoGymTheme.textTertiary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(
                "\(slot.label), \(singleMeal.map { "\($0.displayLabel), meal" } ?? countLabel), "
                    + "\(MetricFormat.whole(slot.totals.kcal)) kilocalories. "
                    + NutritionMacroText.slotAccessibility(slot.totals)
            )
            .accessibilityHint(isExpanded ? "Collapses the slot" : "Shows the slot's entries")
            if isExpanded {
                ForEach(slot.entries) { entry in
                    RowSeparator(leadingInset: 0)
                    NutritionSlotItemRow(planEntry: entry)
                }
            }
        }
        .cardSurface()
    }

    /// A slot holding one meal and nothing else is named after the meal.
    private var singleMeal: NutritionPlanEntry? {
        guard slot.mealCount == 1, slot.foodCount == 0 else { return nil }
        return slot.entries.first
    }

    @ViewBuilder
    private var title: some View {
        if let singleMeal {
            HStack(spacing: 6) {
                Text(singleMeal.displayLabel)
                    .lineLimit(1)
                EntryKindTag(isMeal: true)
            }
        } else {
            Text(countLabel)
        }
    }

    private var countLabel: String {
        var parts: [String] = []
        if slot.mealCount > 0 { parts.append("\(slot.mealCount) \(slot.mealCount == 1 ? "meal" : "meals")") }
        if slot.foodCount > 0 { parts.append("\(slot.foodCount) \(slot.foodCount == 1 ? "food" : "foods")") }
        return parts.joined(separator: ", ")
    }
}
