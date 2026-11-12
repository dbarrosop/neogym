import NeoGymKit
import SwiftUI

struct EditingEntrySheetItem: Identifiable {
    let entry: IntakeEntry
    let showTime: Bool
    var id: String { entry.id }
}

struct EditingGroupSheetItem: Identifiable {
    let group: NutritionLogMeal
    var id: String { group.id }
}

/// Shared slot header: time, status line, kcal and a trailing control.
private struct SlotHeader<Trailing: View>: View {
    let time: String
    let title: String
    let kcal: Double
    let muted: Bool
    @ViewBuilder let trailing: Trailing

    var body: some View {
        HStack(spacing: 10) {
            Text(time)
                .font(.subheadline.weight(.bold))
                .monospacedDigit()
                .foregroundStyle(muted ? NeoGymTheme.textSecondary : NeoGymTheme.text)
                .frame(minWidth: 46, alignment: .leading)
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(muted ? NeoGymTheme.textSecondary : NeoGymTheme.text)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text("\(MetricFormat.whole(kcal)) kcal")
                .font(.footnote)
                .monospacedDigit()
                .foregroundStyle(NeoGymTheme.textSecondary)
            trailing
        }
        .padding(.horizontal, NeoGymTheme.spacingMD)
        .frame(minHeight: 52)
    }
}

/// One food row inside a slot: name, grams and kcal.
private struct SlotItemRow: View {
    let name: String
    let detail: String
    let kcal: Double
    let muted: Bool

    var body: some View {
        HStack(spacing: 10) {
            Text(name)
                .font(.subheadline)
                .foregroundStyle(muted ? NeoGymTheme.textSecondary : NeoGymTheme.text)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(detail)
                .font(.footnote)
                .foregroundStyle(NeoGymTheme.textSecondary)
            Text(MetricFormat.whole(kcal))
                .font(.subheadline)
                .foregroundStyle(muted ? NeoGymTheme.textSecondary : NeoGymTheme.text)
                .frame(minWidth: 44, alignment: .trailing)
        }
        .monospacedDigit()
        .padding(.horizontal, NeoGymTheme.spacingMD)
        .frame(minHeight: NeoGymTheme.minimumTapTarget)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

/// A logged time slot: solid card; rows open their edit sheets.
struct LoggedSlotCard: View {
    let slot: IntakeTimeSlot
    let day: NutritionDay?
    let isExpanded: Bool
    let toggle: () -> Void
    let editEntry: (EditingEntrySheetItem) -> Void
    let editGroup: (EditingGroupSheetItem) -> Void

    var body: some View {
        VStack(spacing: 0) {
            Button(action: toggle) {
                SlotHeader(
                    time: slot.label,
                    title: "Logged · \(NutritionTimeline.loggedCountLabel(slot))",
                    kcal: slot.totals.kcal,
                    muted: false
                ) {
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(NeoGymTheme.textTertiary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(slot.label), logged, \(NutritionTimeline.loggedCountLabel(slot)), \(MetricFormat.whole(slot.totals.kcal)) kilocalories")
            .accessibilityHint(isExpanded ? "Collapses the slot" : "Shows what you logged")
            if isExpanded {
                ForEach(slot.mealGroups, id: \.id) { group in
                    Divider().overlay(NeoGymTheme.separator)
                    Button {
                        editGroup(EditingGroupSheetItem(group: original(group)))
                    } label: {
                        SlotItemRow(
                            name: group.name,
                            detail: "\(group.entryCount) item\(group.entryCount == 1 ? "" : "s")",
                            kcal: slot.entries.filter { $0.mealId == group.id }
                                .reduce(0) { $0 + NutritionMath.loggedEntryMacroTotals($1.entry.loggedSnapshot).kcal },
                            muted: false
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Edit or delete this logged meal")
                }
                ForEach(slot.entries.filter { $0.kind == .standalone }, id: \.entry.id) { slotEntry in
                    Divider().overlay(NeoGymTheme.separator)
                    Button {
                        editEntry(EditingEntrySheetItem(entry: slotEntry.entry, showTime: true))
                    } label: {
                        SlotItemRow(
                            name: slotEntry.entry.snapshotFoodName,
                            detail: NutritionMath.formatMacro(slotEntry.entry.grams, unit: "g"),
                            kcal: NutritionMath.loggedEntryMacroTotals(slotEntry.entry.loggedSnapshot).kcal,
                            muted: false
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Edit or delete this entry")
                }
            }
        }
        .cardSurface()
    }

    private func original(_ group: IntakeSlotMealGroup) -> NutritionLogMeal {
        day?.nutritionLogMeals.first { $0.id == group.id } ?? NutritionLogMeal(
            id: group.id,
            mealId: group.mealId,
            nutritionPlanMealId: group.nutritionPlanMealId,
            name: group.name,
            slotTime: group.slotTime,
            position: Int(group.position)
        )
    }
}

/// A selected-plan slot not logged yet: dashed outline and one Log action.
struct PlannedSlotCard: View {
    let slot: NutritionPlanTimeSlot<NutritionPlanEntry>
    let isExpanded: Bool
    let isNext: Bool
    let isLogging: Bool
    let isDisabled: Bool
    let toggle: () -> Void
    let log: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            SlotHeader(time: slot.label, title: "Planned · \(countLabel)", kcal: slot.totals.kcal, muted: true) {
                Button(action: log) {
                    if isLogging {
                        ProgressView().controlSize(.small)
                    } else {
                        Text("Log")
                    }
                }
                .font(.subheadline.weight(.semibold))
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.capsule)
                .tint(isNext ? NeoGymTheme.accent : NeoGymTheme.accentSoft)
                .foregroundStyle(isNext ? Color.white : NeoGymTheme.accentText)
                .disabled(isDisabled || slot.entries.isEmpty)
                .accessibilityLabel("Log \(slot.label) slot")
            }
            .contentShape(Rectangle())
            .onTapGesture(perform: toggle)
            .accessibilityAction(named: isExpanded ? "Collapse" : "Show planned foods", toggle)
            if isExpanded {
                ForEach(slot.entries) { entry in
                    Divider().overlay(NeoGymTheme.separator)
                    SlotItemRow(name: entry.displayLabel, detail: detail(entry), kcal: entry.macroTotals.kcal, muted: true)
                }
            }
        }
        .background(
            RoundedRectangle(cornerRadius: NeoGymTheme.radiusXL, style: .continuous)
                .strokeBorder(NeoGymTheme.textTertiary.opacity(0.6), style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
        )
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
        case let .meal(meal): "Meal · \(meal.meal?.mealIngredients.count ?? 0) items"
        }
    }
}

/// Monday-to-Sunday day buttons with each day's logged kilocalories.
struct NutritionWeekStripView: View {
    let days: [String]
    let selected: String
    let today: String
    let kcalByDate: [String: Double]
    let onSelect: (String) -> Void

    var body: some View {
        HStack(spacing: 2) {
            ForEach(days, id: \.self) { day in
                dayButton(day)
            }
        }
        .gesture(
            DragGesture(minimumDistance: 30).onEnded { value in
                guard abs(value.translation.width) > abs(value.translation.height) else { return }
                moveWeek(value.translation.width < 0 ? 1 : -1)
            }
        )
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Week")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: onSelect(IntakeGrouping.addLocalDateDays(selected, days: 1))
            case .decrement: onSelect(IntakeGrouping.addLocalDateDays(selected, days: -1))
            @unknown default: break
            }
        }
    }

    private func moveWeek(_ weeks: Int) {
        onSelect(IntakeGrouping.addLocalDateDays(selected, days: weeks * 7))
    }

    private func dayButton(_ day: String) -> some View {
        let isSelected = day == selected
        let date = IntakeGrouping.localDateToDate(day) ?? Date()
        let kcal = kcalByDate[day]
        return Button {
            onSelect(day)
        } label: {
            VStack(spacing: 1) {
                Text(date.formatted(.dateTime.weekday(.abbreviated)))
                    .font(.caption2.weight(.semibold))
                Text(date.formatted(.dateTime.day()))
                    .font(.headline)
                    .foregroundStyle(isSelected ? Color.white : (day == today ? NeoGymTheme.accentText : NeoGymTheme.text))
                Text(kcal.map { MetricFormat.whole($0) } ?? "–")
                    .font(.caption2)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .monospacedDigit()
            .foregroundStyle(isSelected ? Color.white : NeoGymTheme.textSecondary)
            .frame(maxWidth: .infinity, minHeight: 58)
            .background(
                RoundedRectangle(cornerRadius: NeoGymTheme.radiusMD, style: .continuous)
                    .fill(isSelected ? NeoGymTheme.accent : Color.clear)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel(day: day, date: date, kcal: kcal))
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private func accessibilityLabel(day: String, date: Date, kcal: Double?) -> String {
        let name = date.formatted(.dateTime.weekday(.wide).day().month(.wide))
        let prefix = day == today ? "Today, " : ""
        let logged = kcal.map { ", \(MetricFormat.whole($0)) kilocalories logged" } ?? ", nothing logged"
        return prefix + name + logged
    }
}
