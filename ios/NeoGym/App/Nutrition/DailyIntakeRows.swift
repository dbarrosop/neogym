import NeoGymKit
import SwiftUI

struct TimeSlotCard: View {
    let slot: IntakeTimeSlot
    let day: NutritionDay?
    let editEntry: (EditingEntrySheetItem) -> Void
    let editGroup: (EditingGroupSheetItem) -> Void
    let deleteEntry: (String) -> Void
    let deleteGroup: (String) -> Void

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
                                edit: editGroup,
                                delete: deleteGroup
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
                                edit: editEntry,
                                delete: deleteEntry
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
    let delete: (String) -> Void

    var body: some View {
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
            Button("Edit") {
                edit(EditingGroupSheetItem(group: original ?? NutritionLogMeal(
                    id: group.id,
                    mealId: group.mealId,
                    nutritionPlanMealId: group.nutritionPlanMealId,
                    name: group.name,
                    slotTime: group.slotTime,
                    position: Int(group.position)
                )))
            }
            .font(.caption)
            Button(role: .destructive) {
                delete(group.id)
            } label: {
                Image(systemName: "trash")
            }
            .accessibilityLabel("Delete meal group")
        }
        .padding(10)
        .nutritionGlassCard(cornerRadius: 12, tint: NeoGymTheme.glassSubtleFill)
    }
}

private struct EntryRow: View {
    let slotEntry: IntakeSlotEntry
    let edit: (EditingEntrySheetItem) -> Void
    let delete: (String) -> Void

    var body: some View {
        let entry = slotEntry.entry
        let totals = NutritionMath.loggedEntryMacroTotals(entry.loggedSnapshot)
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
            Button("Edit") {
                edit(EditingEntrySheetItem(entry: entry, showTime: slotEntry.kind == .standalone))
            }
            .font(.caption)
            Button(role: .destructive) {
                delete(entry.id)
            } label: {
                Image(systemName: "trash")
            }
            .accessibilityLabel("Delete food entry")
        }
        .padding(10)
        .nutritionGlassCard(cornerRadius: 12)
    }
}

struct PlanSuggestionRow: View {
    let entry: NutritionPlanEntry
    let nextPosition: Int
    let openLogger: () -> Void

    private var isLoggable: Bool {
        switch entry {
        case let .meal(slot): slot.meal != nil
        case let .food(slot): slot.food != nil
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: entry.kind == .meal ? "fork.knife.circle" : "apple.logo")
                .foregroundColor(.accentColor)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 4) {
                Text(IntakeGrouping.formatTimeOfDay(entry.slotTime))
                    .font(.caption.weight(.bold))
                    .foregroundColor(NeoGymTheme.mutedText)
                HStack(spacing: 6) {
                    Text(entry.displayLabel)
                        .font(.subheadline.weight(.semibold))
                    Text(entry.kind == .meal ? "Meal" : "Food")
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(NeoGymTheme.accentMuted, in: Capsule())
                }
                detailText
            }
            Spacer()
            Button("Log", action: openLogger)
                .buttonStyle(.borderedProminent)
                .disabled(!isLoggable)
        }
        .padding(12)
    }

    @ViewBuilder
    private var detailText: some View {
        switch entry {
        case let .meal(slot):
            if let meal = slot.meal {
                Text(slot.label == nil
                    ? NutritionMath.macroTotalsSummary(meal.macroTotals)
                    : "Template: \(meal.name) · \(NutritionMath.macroTotalsSummary(meal.macroTotals))")
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
                    .lineLimit(2)
            }
        case let .food(slot):
            Text("\(slot.food?.name ?? "Food") · \(NutritionMath.formatMacro(slot.grams, unit: "g")) · "
                + NutritionMath.macroTotalsSummary(slot.macroTotals))
                .font(.caption)
                .foregroundColor(NeoGymTheme.mutedText)
                .lineLimit(2)
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
