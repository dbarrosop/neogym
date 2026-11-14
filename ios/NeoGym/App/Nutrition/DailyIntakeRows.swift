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

private extension HorizontalAlignment {
    /// The leading edge of a slot header's title, so the macro line starts
    /// under it whatever the time label's width ("No time" is wider).
    enum SlotTitle: AlignmentID {
        static func defaultValue(in context: ViewDimensions) -> CGFloat { context[.leading] }
    }

    static let slotTitle = HorizontalAlignment(SlotTitle.self)
}

/// Slot header shared by the Log timeline and plan detail: time, title, kcal
/// and a trailing control, then the slot's protein, carbs and fat in grams.
struct NutritionSlotHeader<Title: View, Trailing: View>: View {
    let time: String
    let totals: MacroTotals
    var muted = false
    @ViewBuilder let title: Title
    @ViewBuilder let trailing: Trailing

    var body: some View {
        VStack(alignment: .slotTitle, spacing: 2) {
            HStack(spacing: 10) {
                Text(time)
                    .font(.subheadline.weight(.bold))
                    .monospacedDigit()
                    .foregroundStyle(muted ? NeoGymTheme.textSecondary : NeoGymTheme.text)
                    .frame(minWidth: 46, alignment: .leading)
                title
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(muted ? NeoGymTheme.textSecondary : NeoGymTheme.text)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .alignmentGuide(.slotTitle) { $0[.leading] }
                Text("\(MetricFormat.whole(totals.kcal)) kcal")
                    .font(.footnote)
                    .monospacedDigit()
                    .foregroundStyle(NeoGymTheme.textSecondary)
                trailing
            }
            .frame(minHeight: 40)
            NutritionSlotMacroLine(totals: totals, muted: muted)
                .alignmentGuide(.slotTitle) { $0[.leading] }
        }
        .padding(.horizontal, NeoGymTheme.spacingMD)
        .padding(.top, 6)
        .padding(.bottom, NeoGymTheme.spacingSM)
    }
}

/// "● P 45 g  ● C 106 g  ● F 6 g", with the day summary's bar colours.
struct NutritionSlotMacroLine: View {
    let totals: MacroTotals
    var muted = false

    var body: some View {
        HStack(spacing: 14) {
            macro("P", totals.protein, dot: NeoGymTheme.accent)
            macro("C", totals.carbs, dot: NeoGymTheme.series2)
            macro("F", totals.fat, dot: NeoGymTheme.textSecondary)
        }
        .font(.footnote)
        .monospacedDigit()
        .foregroundStyle(NeoGymTheme.textSecondary)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(NutritionMacroText.slotAccessibility(totals))
    }

    private func macro(_ label: String, _ grams: Double, dot: Color) -> some View {
        HStack(spacing: 5) {
            Circle()
                .fill(dot)
                .frame(width: 7, height: 7)
            Text(
                "\(label) \(Text(MetricFormat.whole(grams)).fontWeight(.semibold).foregroundStyle(valueColor)) g"
            )
        }
    }

    private var valueColor: Color {
        muted ? NeoGymTheme.text.opacity(0.8) : NeoGymTheme.text
    }
}

/// One entry in a slot: the name (with a MEAL tag for meals), then its amount
/// and macros ("45 g · P 33 · C 6.8 · F 2"), and kcal on the right.
struct NutritionSlotItemRow: View {
    let name: String
    let amount: String
    let spokenAmount: String
    let totals: MacroTotals
    var isMeal = false
    var muted = false

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(name)
                        .font(.subheadline)
                        .foregroundStyle(muted ? NeoGymTheme.textSecondary : NeoGymTheme.text)
                        .lineLimit(dynamicTypeSize.isAccessibilitySize ? 3 : 1)
                    if isMeal {
                        EntryKindTag(isMeal: true)
                    }
                }
                Text(NutritionMacroText.entryCaption(amount: amount, totals: totals))
                    .font(.footnote)
                    .foregroundStyle(muted ? NeoGymTheme.textTertiary : NeoGymTheme.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Text(MetricFormat.whole(totals.kcal))
                .font(.subheadline)
                .foregroundStyle(muted ? NeoGymTheme.textSecondary : NeoGymTheme.text)
                .frame(minWidth: 44, alignment: .trailing)
        }
        .monospacedDigit()
        .padding(.horizontal, NeoGymTheme.spacingMD)
        .padding(.vertical, NeoGymTheme.spacingXS)
        .frame(minHeight: 56)
        .contentShape(Rectangle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            "\(name)\(isMeal ? ", meal" : ""), "
                + NutritionMacroText.entryAccessibility(amount: spokenAmount, totals: totals)
                + ", \(MetricFormat.whole(totals.kcal)) kilocalories"
        )
    }
}

extension NutritionSlotItemRow {
    /// A plan entry: a food's grams, or a meal's item count.
    init(planEntry entry: NutritionPlanEntry, muted: Bool = false) {
        switch entry {
        case let .food(food):
            self.init(
                name: entry.displayLabel,
                amount: NutritionMath.formatMacro(food.grams, unit: "g"),
                spokenAmount: NutritionMath.formatMacro(food.grams, unit: "grams"),
                totals: entry.macroTotals,
                muted: muted
            )
        case let .meal(meal):
            let items = NutritionMacroText.itemCount(meal.meal?.mealIngredients.count ?? 0)
            self.init(
                name: entry.displayLabel,
                amount: items,
                spokenAmount: items,
                totals: entry.macroTotals,
                isMeal: true,
                muted: muted
            )
        }
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
                NutritionSlotHeader(time: slot.label, totals: slot.totals) {
                    Text("Logged · \(NutritionTimeline.loggedCountLabel(slot))")
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
                "\(slot.label), logged, \(NutritionTimeline.loggedCountLabel(slot)), "
                    + "\(MetricFormat.whole(slot.totals.kcal)) kilocalories. "
                    + NutritionMacroText.slotAccessibility(slot.totals)
            )
            .accessibilityHint(isExpanded ? "Collapses the slot" : "Shows what you logged")
            if isExpanded {
                ForEach(slot.mealGroups, id: \.id) { group in
                    Divider().overlay(NeoGymTheme.separator)
                    Button {
                        editGroup(EditingGroupSheetItem(group: original(group)))
                    } label: {
                        NutritionSlotItemRow(
                            name: group.name,
                            amount: NutritionMacroText.itemCount(group.entryCount),
                            spokenAmount: NutritionMacroText.itemCount(group.entryCount),
                            totals: groupTotals(group),
                            isMeal: true
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
                        NutritionSlotItemRow(
                            name: slotEntry.entry.snapshotFoodName,
                            amount: NutritionMath.formatMacro(slotEntry.entry.grams, unit: "g"),
                            spokenAmount: NutritionMath.formatMacro(slotEntry.entry.grams, unit: "grams"),
                            totals: NutritionMath.loggedEntryMacroTotals(slotEntry.entry.loggedSnapshot)
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Edit or delete this entry")
                }
            }
        }
        .cardSurface()
    }

    private func groupTotals(_ group: IntakeSlotMealGroup) -> MacroTotals {
        slot.entries.filter { $0.mealId == group.id }.reduce(MacroTotals.empty) { total, slotEntry in
            NutritionMath.addMacroTotals(total, NutritionMath.loggedEntryMacroTotals(slotEntry.entry.loggedSnapshot))
        }
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
            NutritionSlotHeader(time: slot.label, totals: slot.totals, muted: true) {
                Text("Planned · \(countLabel)")
            } trailing: {
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
                .foregroundStyle(isNext ? NeoGymTheme.onFill : NeoGymTheme.accentText)
                .disabled(isDisabled || slot.entries.isEmpty)
                .accessibilityLabel("Log \(slot.label) slot")
            }
            .contentShape(Rectangle())
            .onTapGesture(perform: toggle)
            .accessibilityAction(named: isExpanded ? "Collapse" : "Show planned foods", toggle)
            if isExpanded {
                ForEach(slot.entries) { entry in
                    Divider().overlay(NeoGymTheme.separator)
                    NutritionSlotItemRow(planEntry: entry, muted: true)
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
                    .foregroundStyle(isSelected ? NeoGymTheme.onFill : (day == today ? NeoGymTheme.accentText : NeoGymTheme.text))
                Text(kcal.map { MetricFormat.whole($0) } ?? "–")
                    .font(.caption2)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .monospacedDigit()
            .foregroundStyle(isSelected ? NeoGymTheme.onFill : NeoGymTheme.textSecondary)
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
