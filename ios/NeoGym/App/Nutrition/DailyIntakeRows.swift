import NeoGymKit
import SwiftUI

struct TimeSlotCard: View {
    let slot: IntakeTimeSlot
    let day: NutritionDay?
    let editEntry: (EditingEntrySheetItem) -> Void
    let editGroup: (EditingGroupSheetItem) -> Void

    @State private var expanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation { expanded.toggle() }
            } label: {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "clock")
                        .foregroundColor(.accentColor)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(slot.label)
                            .font(.subheadline.weight(.semibold))
                        Text(NutritionMath.macroTotalsSummary(slot.totals))
                            .font(.caption)
                            .foregroundColor(NeoGymTheme.mutedText)
                        Text("\(slot.entries.count) entries · \(slot.mealGroups.count) meal groups")
                            .font(.caption2)
                            .foregroundColor(NeoGymTheme.mutedText)
                    }
                    Spacer()
                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .foregroundColor(NeoGymTheme.mutedText)
                }
                .padding(12)
            }
            .buttonStyle(.plain)

            if expanded {
                Divider()
                VStack(alignment: .leading, spacing: 10) {
                    if !slot.mealGroups.isEmpty {
                        Text("Logged meal groups")
                            .font(.caption.weight(.bold))
                            .foregroundColor(NeoGymTheme.mutedText)
                        ForEach(slot.mealGroups, id: \.id) { group in
                            MealGroupRow(
                                group: group,
                                original: day?.nutritionLogMeals.first { $0.id == group.id },
                                edit: editGroup
                            )
                        }
                    }

                    if slot.entries.isEmpty {
                        Text("This time slot has no food entries.")
                            .font(.caption)
                            .foregroundColor(NeoGymTheme.mutedText)
                    } else {
                        Text("Food entries")
                            .font(.caption.weight(.bold))
                            .foregroundColor(NeoGymTheme.mutedText)
                        ForEach(slot.entries, id: \.entry.id) { slotEntry in
                            EntryRow(
                                slotEntry: slotEntry,
                                edit: editEntry
                            )
                        }
                    }
                }
                .padding(12)
            }
        }
        .nutritionGlassCard(cornerRadius: 16)
    }
}

private struct MealGroupRow: View {
    let group: IntakeSlotMealGroup
    let original: NutritionLogMeal?
    let edit: (EditingGroupSheetItem) -> Void

    var body: some View {
        Button {
            edit(EditingGroupSheetItem(group: original ?? NutritionLogMeal(
                id: group.id,
                mealId: group.mealId,
                nutritionPlanMealId: group.nutritionPlanMealId,
                name: group.name,
                slotTime: group.slotTime,
                position: Int(group.position)
            )))
        } label: {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: "fork.knife.circle")
                    .foregroundColor(NeoGymTheme.mutedText)
                VStack(alignment: .leading, spacing: 3) {
                    Text(group.name)
                        .font(.subheadline.weight(.semibold))
                    Text("\(group.entryCount) entr\(group.entryCount == 1 ? "y" : "ies")")
                        .font(.caption)
                        .foregroundColor(NeoGymTheme.mutedText)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
            .padding(10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityHint("Edit logged meal group")
        .nutritionGlassCard(cornerRadius: 12, tint: NeoGymTheme.glassSubtleFill)
    }
}

private struct EntryRow: View {
    let slotEntry: IntakeSlotEntry
    let edit: (EditingEntrySheetItem) -> Void

    var body: some View {
        let entry = slotEntry.entry
        let totals = NutritionMath.loggedEntryMacroTotals(entry.loggedSnapshot)
        Button {
            edit(EditingEntrySheetItem(entry: entry, showTime: slotEntry.kind == .standalone))
        } label: {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: slotEntry.kind == .meal ? "fork.knife" : "apple.logo")
                    .foregroundColor(NeoGymTheme.mutedText)
                VStack(alignment: .leading, spacing: 4) {
                    Text(entry.snapshotFoodName)
                        .font(.subheadline.weight(.semibold))
                    Text(NutritionMath.macroTotalsSummary(totals))
                        .font(.caption)
                        .foregroundColor(NeoGymTheme.mutedText)
                    Text("\(NutritionMath.formatMacro(entry.grams, unit: "g"))"
                        + (slotEntry.mealName.map { " · From \($0)" } ?? ""))
                        .font(.caption2)
                        .foregroundColor(NeoGymTheme.mutedText)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
            .padding(10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityHint("Edit food entry")
        .nutritionGlassCard(cornerRadius: 12)
    }
}

struct PlanSuggestionSlotCard: View {
    let slot: NutritionPlanTimeSlot<NutritionPlanEntry>
    let disabled: Bool
    let logSlot: (NutritionPlanTimeSlot<NutritionPlanEntry>) -> Void

    @State private var expanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 10) {
                Button {
                    withAnimation { expanded.toggle() }
                } label: {
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "clock")
                            .foregroundColor(.accentColor)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(slot.label)
                                .font(.subheadline.weight(.semibold))
                            Text(NutritionMath.macroTotalsSummary(slot.totals))
                                .font(.caption)
                                .foregroundColor(NeoGymTheme.mutedText)
                            Text("\(slot.entries.count) entr\(slot.entries.count == 1 ? "y" : "ies")")
                                .font(.caption2)
                                .foregroundColor(NeoGymTheme.mutedText)
                        }
                        Spacer()
                        Image(systemName: expanded ? "chevron.up" : "chevron.down")
                            .foregroundColor(NeoGymTheme.mutedText)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                Button("Log") { logSlot(slot) }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                    .disabled(disabled || slot.entries.isEmpty)
            }
            .padding(12)

            if expanded {
                Divider()

                VStack(alignment: .leading, spacing: 10) {
                    ForEach(slot.entries) { entry in
                        PlanSuggestionEntryRow(entry: entry)
                    }
                }
                .padding(12)
            }
        }
        .nutritionGlassCard(cornerRadius: 16)
    }
}

private struct PlanSuggestionEntryRow: View {
    let entry: NutritionPlanEntry

    var body: some View {
        let totals = entry.macroTotals
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: entry.kind == .meal ? "fork.knife" : "apple.logo")
                .foregroundColor(NeoGymTheme.mutedText)
            VStack(alignment: .leading, spacing: 4) {
                Text(entry.displayLabel)
                    .font(.subheadline.weight(.semibold))
                Text(NutritionMath.macroTotalsSummary(totals))
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
                Text(detail)
                    .font(.caption2)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
            Spacer()
        }
        .padding(10)
        .nutritionGlassCard(cornerRadius: 12, tint: NeoGymTheme.glassSubtleFill)
    }

    private var detail: String {
        switch entry {
        case let .meal(slot):
            return slot.meal?.name ?? "Meal template unavailable"
        case let .food(slot):
            return NutritionMath.formatMacro(slot.grams, unit: "g")
        }
    }
}

struct EditingEntrySheetItem: Identifiable {
    let entry: IntakeEntry
    let showTime: Bool
    var id: String { entry.id }
}

struct EditingGroupSheetItem: Identifiable {
    let group: NutritionLogMeal
    var id: String { group.id }
}
