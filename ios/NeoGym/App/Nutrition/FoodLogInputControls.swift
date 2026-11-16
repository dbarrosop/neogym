import NeoGymKit
import SwiftUI

struct NutritionGramTextField: View {
    private enum FocusedField: Hashable {
        case grams
    }

    @Binding var grams: String
    var title = "Amount"

    @FocusState private var focusedField: FocusedField?

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: NeoGymTheme.spacingSM) {
            Text(title)
            Spacer(minLength: NeoGymTheme.spacingMD)
            TextField("0", text: $grams)
                .keyboardType(.decimalPad)
                .numericFieldFocus(.grams, focusedField: $focusedField)
                .multilineTextAlignment(.trailing)
                .frame(minWidth: 72, maxWidth: 120)
            Text("g")
                .foregroundColor(NeoGymTheme.textSecondary)
        }
        .toolbar {
            if focusedField != nil { KeyboardDoneToolbar(focusedField: $focusedField) }
        }
    }
}

/// The food or meal chosen in a form: its name (wrapping as needed) over a
/// macro caption, and Change, which opens `NutritionSelectionSheet`. Replaces
/// the one-line wheel, which cut long names short.
struct NutritionChoiceRow: View {
    let name: String?
    let caption: String?
    let placeholder: String
    var isDisabled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            AdaptiveRow(spacing: NeoGymTheme.spacingSM) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(name ?? placeholder)
                        .foregroundStyle(name == nil ? NeoGymTheme.textSecondary : NeoGymTheme.text)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    if let caption {
                        Text(caption)
                            .font(.footnote)
                            .monospacedDigit()
                            .foregroundStyle(NeoGymTheme.textSecondary)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: 0)
                HStack(spacing: NeoGymTheme.spacingXS) {
                    Text(name == nil ? "Choose" : "Change")
                        .foregroundStyle(NeoGymTheme.accentText)
                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(NeoGymTheme.textTertiary)
                        .accessibilityHidden(true)
                }
            }
            .padding(.vertical, 2)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .accessibilityHint(name == nil ? "Opens the list to choose one." : "Opens the list to change it.")
    }
}

/// A form row previewing a logged amount: kcal with protein, carbs and fat
/// (whole grams, protein first, as on the log's slots), fiber and sugar on a
/// quieter line and, when editing, the saved totals it would replace
/// ("Was 110 kcal · P 14 · C 6 · F 3 at 150 g").
struct NutritionMacroPreview: View {
    struct Saved {
        let totals: MacroTotals
        /// The saved amount, such as "150 g".
        let amount: String
    }

    let totals: MacroTotals
    var saved: Saved?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            AdaptiveRow(spacing: NeoGymTheme.spacingSM, alignment: .firstTextBaseline) {
                MetricValueText(value: MetricFormat.whole(totals.kcal), unit: "kcal", size: .title2.weight(.bold))
                Spacer(minLength: 0)
                Text(MacroTotalsStrip.macroLine(totals))
                    .font(.subheadline)
                    .monospacedDigit()
                    .foregroundStyle(NeoGymTheme.textSecondary)
            }
            Text("Fiber \(NutritionMacroText.grams(totals.fiber)) g · Sugar \(NutritionMacroText.grams(totals.sugar)) g")
                .font(.footnote)
                .monospacedDigit()
                .foregroundStyle(NeoGymTheme.textSecondary)
            if let changedFrom {
                Text("Was \(MetricFormat.whole(changedFrom.totals.kcal)) kcal · \(Self.macros(changedFrom.totals)) at \(changedFrom.amount)")
                    .font(.footnote)
                    .monospacedDigit()
                    .foregroundStyle(NeoGymTheme.textTertiary)
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityText)
    }

    /// The saved totals, only once the shown (rounded) values differ from them.
    private var changedFrom: Saved? {
        guard let saved, Self.summary(saved.totals) != Self.summary(totals) else { return nil }
        return saved
    }

    private static func macros(_ totals: MacroTotals) -> String {
        "P \(MetricFormat.whole(totals.protein)) · C \(MetricFormat.whole(totals.carbs)) · F \(MetricFormat.whole(totals.fat))"
    }

    private static func summary(_ totals: MacroTotals) -> String {
        "\(MetricFormat.whole(totals.kcal)) \(macros(totals))"
    }

    private var accessibilityText: String {
        var text = "\(MetricFormat.whole(totals.kcal)) kilocalories. \(NutritionMacroText.slotAccessibility(totals)). "
            + "Fiber \(NutritionMacroText.grams(totals.fiber)) grams, sugar \(NutritionMacroText.grams(totals.sugar)) grams."
        if let changedFrom {
            text += " Was \(MetricFormat.whole(changedFrom.totals.kcal)) kilocalories at \(changedFrom.amount)."
        }
        return text
    }
}

enum NutritionLogAmount {
    static func editableNumber(_ value: JSONValue?) -> String {
        let number = NutritionMath.normalizeNumeric(value)
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 3
        formatter.usesGroupingSeparator = false
        return formatter.string(from: NSNumber(value: number)) ?? String(number)
    }
}

enum NutritionLogTime {
    static func inputValue(from date: Date) -> String {
        IntakeGrouping.currentTimeInputValue(date)
    }

    static func date(from value: String?) -> Date {
        let inputValue = IntakeGrouping.timeToInputValue(value)
        let parts = inputValue.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2 else { return AppClock.now() }
        let calendar = AppClock.calendar
        return calendar.date(
            bySettingHour: parts[0],
            minute: parts[1],
            second: 0,
            of: AppClock.now()
        ) ?? AppClock.now()
    }
}
