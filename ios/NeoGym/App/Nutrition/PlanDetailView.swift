import NeoGymKit
import SwiftUI

struct NutritionPlanDetailView: View {
    @StateObject private var viewModel: NutritionPlanDetailViewModel
    let repository: any NutritionFoodMealRepositoryProtocol
    var onDeleted: () -> Void
    var onMutated: () -> Void

    @Environment(\.presentationMode) private var presentationMode

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
            content
                .frame(maxWidth: 680)
                .padding(.horizontal, 20)
                .padding(.vertical, 24)
                .frame(maxWidth: .infinity)
        }
        .navigationTitle("Plan")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
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
                    } label: { Image(systemName: "pencil") }
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
            SectionShell(title: "Loading plan") { AppLoadingStateView(title: "Loading plan") }
        case .loading where viewModel.plan == nil:
            SectionShell(title: "Loading plan") { AppLoadingStateView(title: "Loading plan") }
        case let .failed(message, _) where viewModel.plan == nil:
            SectionShell(title: "Plan") {
                AppErrorStateView(title: "Failed to load plan", message: message) { Task { await viewModel.load() } }
            }
        default:
            if let plan = viewModel.plan {
                SectionShell(
                    title: plan.name,
                    subtitle: plan.description?.isEmpty == false ? plan.description : "Daily plan template"
                ) {
                    VStack(alignment: .leading, spacing: 18) {
                        MacroSummaryView(
                            totals: plan.macroTotals,
                            title: "Daily planned totals",
                            description: "Totals use live meal and food nutrition values. "
                                + "Plans are reusable templates only, not scheduled calendar assignments."
                        )
                        slotsList(plan)
                    }
                }
            }
        }
    }

    private func slotsList(_ plan: NutritionPlan) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Timed meal slots")
                .font(.subheadline.weight(.semibold))
            Text("Slots sort by time of day, then position. Remove slots before deleting a meal that a plan uses.")
                .font(.caption)
                .foregroundColor(NeoGymTheme.mutedText)
            let slots = plan.sortedSlots
            if slots.isEmpty {
                Text("This plan does not have meal slots yet.")
                    .font(.subheadline)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
                    .nutritionGlassCard(cornerRadius: 12, tint: NeoGymTheme.glassSubtleFill)
            } else {
                VStack(spacing: 0) {
                    ForEach(slots) { slot in
                        NutritionPlanSlotDetailRow(slot: slot)
                        if slot.id != slots.last?.id { Divider() }
                    }
                }
                .nutritionGlassField()
            }
        }
    }
}

private struct NutritionPlanSlotDetailRow: View {
    let slot: NutritionPlanMealSlot

    var body: some View {
        let totals = slot.macroTotals
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                Text(IntakeGrouping.formatTimeOfDay(slot.slotTime))
                    .font(.caption.weight(.bold))
                    .textCase(.uppercase)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .monospacedDigit()
                Text(slot.displayLabel)
                    .font(.subheadline.weight(.semibold))
                if slot.label?.isEmpty == false, let mealName = slot.meal?.name {
                    Label(mealName, systemImage: "fork.knife.circle")
                        .font(.caption)
                        .foregroundColor(NeoGymTheme.mutedText)
                        .lineLimit(1)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 3) {
                Text(NutritionMath.formatMacro(totals.kcal, unit: "kcal"))
                    .font(.caption.weight(.semibold))
                Text(NutritionMath.macroTotalsSummary(totals))
                    .font(.caption2)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .multilineTextAlignment(.trailing)
            }
            .frame(maxWidth: 220, alignment: .trailing)
        }
        .padding(12)
    }
}
