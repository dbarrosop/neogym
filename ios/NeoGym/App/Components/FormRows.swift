import NeoGymKit
import SwiftUI

// Inset grouped form building blocks from the unified design's editors (New
// food, Edit meal, Edit plan): rows on the surface token separated by
// hairlines, caps section headers, footers, and numeric values in recessed
// wells. Pushed forms keep Cancel/Save in the navigation bar.

/// A titled group of form rows on one surface card.
struct FormSection<Content: View>: View {
    var header: String?
    /// Trailing header text, such as a slot's kcal.
    var headerDetail: String?
    var footer: String?
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if header != nil || headerDetail != nil {
                HStack(alignment: .firstTextBaseline) {
                    if let header {
                        Text(header)
                            .font(.footnote.weight(.semibold))
                            .textCase(.uppercase)
                    }
                    Spacer(minLength: NeoGymTheme.spacingXS)
                    if let headerDetail {
                        Text(headerDetail)
                            .font(.footnote)
                    }
                }
                .monospacedDigit()
                .foregroundStyle(NeoGymTheme.textSecondary)
                .padding(.horizontal, NeoGymTheme.spacingMD)
                .padding(.top, NeoGymTheme.spacingXS)
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isHeader)
            }
            VStack(spacing: 0) { content }
                .frame(maxWidth: .infinity, alignment: .leading)
                .cardSurface()
            if let footer {
                FormFooter(footer)
            }
        }
    }
}

/// Explanatory text under a form section.
struct FormFooter: View {
    let text: String

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(text)
            .font(.footnote)
            .foregroundStyle(NeoGymTheme.textSecondary)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, NeoGymTheme.spacingMD)
    }
}

/// One row of a `FormSection`: 16 pt gutters, at least 52 pt tall.
struct FormRow<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        HStack(spacing: NeoGymTheme.spacingSM) { content }
            .padding(.horizontal, NeoGymTheme.spacingMD)
            .padding(.vertical, NeoGymTheme.spacingXS)
            .frame(maxWidth: .infinity, minHeight: 52, alignment: .leading)
    }
}

/// Inline label and text field, such as "Name" or "Description".
struct FormLabeledTextRow: View {
    let label: String
    let placeholder: String
    @Binding var text: String
    var multiline = false
    var capitalization: TextInputAutocapitalization = .sentences

    var body: some View {
        FormRow {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(NeoGymTheme.textSecondary)
                .frame(width: 96, alignment: .leading)
                .accessibilityHidden(true)
            TextField(placeholder, text: $text, axis: multiline ? .vertical : .horizontal)
                .lineLimit(multiline ? 1 ... 5 : 1 ... 1)
                .textInputAutocapitalization(capitalization)
                .accessibilityLabel(label)
        }
    }
}

/// A right-aligned numeric value in a recessed well, followed by its unit.
struct FormNumberField<Field: Hashable>: View {
    let accessibilityLabel: String
    @Binding var text: String
    var unit: String?
    var placeholder = "0"
    var keyboard: UIKeyboardType = .decimalPad
    var isInvalid = false
    let field: Field
    let focusedField: FocusState<Field?>.Binding

    var body: some View {
        HStack(spacing: 6) {
            TextField(placeholder, text: $text)
                .keyboardType(keyboard)
                .multilineTextAlignment(.trailing)
                .font(.body.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(isInvalid ? NeoGymTheme.destructive : NeoGymTheme.text)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .numericFieldFocus(field, focusedField: focusedField)
                .padding(.horizontal, 10)
                .frame(width: 84, height: 38)
                .formWell(isInvalid: isInvalid)
                .accessibilityLabel(accessibilityLabel)
            if let unit {
                Text(unit)
                    .font(.footnote)
                    .foregroundStyle(NeoGymTheme.textSecondary)
                    .frame(minWidth: 30, alignment: .leading)
                    .accessibilityHidden(true)
            }
        }
    }
}

extension View {
    /// The recessed well behind a form value: the background token inside a
    /// surface row, outlined in the destructive colour when invalid.
    func formWell(isInvalid: Bool = false) -> some View {
        background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(NeoGymTheme.background)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(NeoGymTheme.destructive, lineWidth: isInvalid ? 1.5 : 0)
        )
    }
}

/// A labelled numeric row: "Protein  [ 4 ] g".
struct FormNumberRow<Field: Hashable>: View {
    let title: String
    @Binding var text: String
    let unit: String
    var placeholder = "0"
    let field: Field
    let focusedField: FocusState<Field?>.Binding

    var body: some View {
        FormRow {
            Text(title)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityHidden(true)
            FormNumberField(
                accessibilityLabel: "\(title), \(unit)",
                text: $text,
                unit: unit,
                placeholder: placeholder,
                field: field,
                focusedField: focusedField
            )
        }
    }
}

/// "Date  [ 12 Nov 2026 ]": a compact date picker bound to a local
/// `YYYY-MM-DD` string.
struct FormDateRow: View {
    var title = "Date"
    @Binding var isoDate: String

    var body: some View {
        FormRow {
            Text(title)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityHidden(true)
            DatePicker(
                title,
                selection: Binding(
                    get: { DateOnly.parse(isoDate) ?? AppClock.now() },
                    set: { isoDate = DateOnly.formatLocalISO($0) }
                ),
                displayedComponents: .date
            )
            .datePickerStyle(.compact)
            .labelsHidden()
        }
    }
}

/// A multi-line text area filling its section, such as notes or a markdown
/// body. It grows with its content from `minLines`.
struct FormTextAreaRow: View {
    let placeholder: String
    @Binding var text: String
    var accessibilityLabel: String?
    var minLines = 3
    var monospaced = false

    var body: some View {
        TextField(placeholder, text: $text, axis: .vertical)
            .lineLimit(minLines ... max(minLines, 40))
            .font(monospaced ? .body.monospaced() : .body)
            .textInputAutocapitalization(.sentences)
            .padding(.horizontal, NeoGymTheme.spacingMD)
            .padding(.vertical, NeoGymTheme.spacingSM)
            .frame(maxWidth: .infinity, alignment: .topLeading)
            .accessibilityLabel(accessibilityLabel ?? placeholder)
    }
}

/// An accent action row inside a section, such as "Add ingredient": a white
/// glyph on an accent-fill circle, then accent text.
struct FormActionRow: View {
    let title: String
    var systemImage = "plus.circle.fill"
    var isDisabled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            FormRow {
                Image(systemName: systemImage)
                    .font(.title3)
                    .symbolRenderingMode(.palette)
                    .foregroundStyle(NeoGymTheme.onFill, NeoGymTheme.accent)
                    .frame(width: 28)
                    .accessibilityHidden(true)
                Text(title)
                    .foregroundStyle(NeoGymTheme.accentText)
                Spacer(minLength: 0)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .opacity(isDisabled ? 0.5 : 1)
    }
}

/// The red minus that removes a row from an editable list.
struct FormRemoveButton: View {
    let accessibilityLabel: String
    var isDisabled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "minus.circle.fill")
                .font(.title3)
                .symbolRenderingMode(.palette)
                .foregroundStyle(NeoGymTheme.onFill, NeoGymTheme.destructiveFill)
                .frame(width: 28, height: NeoGymTheme.minimumTapTarget)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .accessibilityLabel(accessibilityLabel)
    }
}

/// Compact kcal and P · C · F strip for meal and plan editors.
struct MacroTotalsStrip: View {
    let totals: MacroTotals

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: NeoGymTheme.spacingSM) {
            MetricValueText(value: MetricFormat.whole(totals.kcal), unit: "kcal", size: .title2.weight(.bold))
            Spacer(minLength: NeoGymTheme.spacingXS)
            Text(macroLine)
                .font(.subheadline)
                .monospacedDigit()
                .foregroundStyle(NeoGymTheme.textSecondary)
        }
        .padding(.horizontal, NeoGymTheme.spacingMD)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            "Total \(MetricFormat.whole(totals.kcal)) kcal, protein \(MetricFormat.whole(totals.protein)) grams, "
                + "carbs \(MetricFormat.whole(totals.carbs)) grams, fat \(MetricFormat.whole(totals.fat)) grams"
        )
    }

    private var macroLine: AttributedString { Self.macroLine(totals) }

    /// "P 33 · C 6 · F 2": whole grams, protein first, numbers emphasised.
    static func macroLine(_ totals: MacroTotals) -> AttributedString {
        func part(_ label: String, _ value: Double) -> AttributedString {
            var number = AttributedString(MetricFormat.whole(value))
            number.font = .subheadline.weight(.semibold)
            number.foregroundColor = NeoGymTheme.text
            return AttributedString("\(label) ") + number
        }
        let separator = AttributedString(" · ")
        return part("P", totals.protein) + separator + part("C", totals.carbs) + separator + part("F", totals.fat)
    }
}

/// "FOOD" / "MEAL" tag on plan entries; meals use accent soft.
struct EntryKindTag: View {
    let isMeal: Bool

    var body: some View {
        Text(isMeal ? "MEAL" : "FOOD")
            .font(.caption2.weight(.bold))
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .foregroundStyle(isMeal ? NeoGymTheme.accentText : NeoGymTheme.textSecondary)
            .background(Capsule().fill(isMeal ? NeoGymTheme.accentSoft : NeoGymTheme.fill))
            .accessibilityLabel(isMeal ? "Meal" : "Food")
    }
}

/// Shared scroll layout for pushed editors: 16 pt gutters and a readable width.
struct FormScrollContainer<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: NeoGymTheme.spacingMD) { content }
                .frame(maxWidth: NeoGymTheme.contentMaxWidth)
                .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
                .padding(.top, NeoGymTheme.spacingXS)
                .padding(.bottom, NeoGymTheme.spacingXL)
                .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
    }
}

/// "kcal · P" caption for an entry with grams of a food.
enum EntryMacroCaption {
    static func text(_ totals: MacroTotals) -> String {
        "\(MetricFormat.whole(totals.kcal)) kcal · P \(MetricFormat.whole(totals.protein))"
    }
}
