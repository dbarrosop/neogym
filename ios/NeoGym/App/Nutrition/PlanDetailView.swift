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
            ToolbarItemGroup(placement: .bottomBar) {
                Spacer()
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
                        Label("Edit plan", systemImage: "pencil")
                    }
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
            Text("Timed plan entries")
                .font(.subheadline.weight(.semibold))
            Text(
                "Entries sort by time of day, then shared position across meals and direct foods. "
                    + "Remove entries before deleting referenced foods or meals."
            )
                .font(.caption)
                .foregroundColor(NeoGymTheme.mutedText)
            let slots = NutritionPlanGrouping.groupPlanEntriesByTimeSlot(plan.sortedEntries)
            if slots.isEmpty {
                Text("This plan does not have meal or food entries yet.")
                    .font(.subheadline)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
                    .nutritionGlassCard(cornerRadius: 12, tint: NeoGymTheme.glassSubtleFill)
            } else {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(slots, id: \.key) { slot in
                        NutritionPlanSlotDetailCard(slot: slot)
                    }
                }
            }
        }
    }
}

private struct NutritionPlanSlotDetailCard: View {
    let slot: NutritionPlanTimeSlot<NutritionPlanEntry>

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(slot.label)
                        .font(.subheadline.weight(.semibold))
                        .monospacedDigit()
                    Text(planSlotCountText(mealCount: slot.mealCount, foodCount: slot.foodCount))
                        .font(.caption)
                        .foregroundColor(NeoGymTheme.mutedText)
                }
                Spacer()
                Text(NutritionMath.macroTotalsSummary(slot.totals))
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .multilineTextAlignment(.trailing)
                    .frame(maxWidth: 260, alignment: .trailing)
            }
            Divider()
            VStack(spacing: 0) {
                ForEach(slot.entries) { entry in
                    NutritionPlanEntryDetailRow(entry: entry)
                    if entry.id != slot.entries.last?.id { Divider() }
                }
            }
        }
        .padding(12)
        .nutritionGlassField()
    }
}

private func planSlotCountText(mealCount: Int, foodCount: Int) -> String {
    let mealLabel = "\(mealCount) meal\(mealCount == 1 ? "" : "s")"
    let foodLabel = "\(foodCount) food\(foodCount == 1 ? "" : "s")"
    return "\(mealLabel) · \(foodLabel)"
}

private struct NutritionPlanEntryDetailRow: View {
    let entry: NutritionPlanEntry

    var body: some View {
        let totals = entry.macroTotals
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: entry.kind == .meal ? "fork.knife.circle" : "apple.logo")
                .foregroundColor(.accentColor)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 4) {
                Text(IntakeGrouping.formatTimeOfDay(entry.slotTime))
                    .font(.caption.weight(.bold))
                    .textCase(.uppercase)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .monospacedDigit()
                Text(entry.displayLabel)
                    .font(.subheadline.weight(.semibold))
                detailLine
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

    @ViewBuilder
    private var detailLine: some View {
        switch entry {
        case let .meal(slot):
            if slot.label?.isEmpty == false, let mealName = slot.meal?.name {
                Text("Template: \(mealName)")
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .lineLimit(1)
            }
        case let .food(slot):
            Text(NutritionMath.formatMacro(slot.grams, unit: "g"))
                .font(.caption)
                .foregroundColor(NeoGymTheme.mutedText)
                .lineLimit(1)
        }
    }
}
