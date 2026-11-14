import NeoGymKit
import SwiftUI

struct CardioEntryEditorState: Identifiable {
    enum Mode {
        case add(workoutSessionExerciseId: String)
        case edit(SessionCardioEntryShell)
    }

    let id = UUID()
    let mode: Mode
    let exerciseName: String
    let schema: CardioMetricsSchema
    let nextEntryNumber: Int
    let previousMetrics: CardioMetrics?

    static func add(
        workoutSessionExerciseId: String,
        exerciseName: String,
        schema: CardioMetricsSchema,
        nextEntryNumber: Int,
        previousMetrics: CardioMetrics?
    ) -> CardioEntryEditorState {
        CardioEntryEditorState(
            mode: .add(workoutSessionExerciseId: workoutSessionExerciseId),
            exerciseName: exerciseName,
            schema: schema,
            nextEntryNumber: nextEntryNumber,
            previousMetrics: previousMetrics
        )
    }

    static func edit(
        entry: SessionCardioEntryShell,
        exerciseName: String,
        schema: CardioMetricsSchema
    ) -> CardioEntryEditorState {
        CardioEntryEditorState(
            mode: .edit(entry),
            exerciseName: exerciseName,
            schema: schema,
            nextEntryNumber: entry.entryNumber,
            previousMetrics: nil
        )
    }

    /// "Entry 2" under the exercise name in the sheet's title.
    var entryLabel: String {
        switch mode {
        case .add:
            return "Entry \(nextEntryNumber)"
        case let .edit(entry):
            return "Entry \(entry.entryNumber)"
        }
    }

    var initialMetrics: CardioMetrics? {
        if case let .edit(entry) = mode { return entry.metrics }
        return nil
    }
}

struct CardioMetricsFormView: View {
    let state: CardioEntryEditorState
    let isPending: Bool
    let onSave: (CardioMetrics) -> Void
    let onDelete: () -> Void
    let onCancel: () -> Void

    @State private var model: CardioEntryFormModel
    @State private var errorMessage: String?
    @State private var invalidKey: String?
    @FocusState private var focusedField: CardioMetricFocusedField?

    init(
        state: CardioEntryEditorState,
        isPending: Bool,
        onSave: @escaping (CardioMetrics) -> Void,
        onDelete: @escaping () -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.state = state
        self.isPending = isPending
        self.onSave = onSave
        self.onDelete = onDelete
        self.onCancel = onCancel
        _model = State(wrappedValue: CardioEntryFormModel(
            schema: state.schema,
            initialMetrics: state.initialMetrics,
            previousMetrics: state.previousMetrics
        ))
    }

    var body: some View {
        NavigationView {
            ScreenScaffold {
                FormScrollContainer {
                    let required = model.specs.filter(\.required)
                    let optional = model.specs.filter { !$0.required }
                    if !required.isEmpty {
                        FormSection(
                            header: "Required",
                            footer: optional.isEmpty ? Self.schemaFooter : nil
                        ) {
                            metricRows(required)
                        }
                    }
                    if !optional.isEmpty {
                        FormSection(header: "Optional", footer: Self.schemaFooter) {
                            metricRows(optional)
                        }
                    }
                    if let errorMessage {
                        FeedbackBanner(message: errorMessage)
                    }
                    if case .edit = state.mode {
                        FormDeleteButton(title: "Delete entry", isDisabled: isPending, action: onDelete)
                            .padding(.top, NeoGymTheme.spacingXS)
                    }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    VStack(spacing: 0) {
                        Text(state.exerciseName)
                            .font(.headline)
                            .lineLimit(1)
                        Text(state.entryLabel)
                            .font(.footnote)
                            .foregroundStyle(NeoGymTheme.textSecondary)
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityAddTraits(.isHeader)
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                        .disabled(isPending)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isPending ? "Saving…" : "Save") { save() }
                        .fontWeight(.semibold)
                        .disabled(isPending)
                }
            }
            .keyboardDoneToolbar(focusedField: $focusedField)
        }
        .navigationViewStyle(.stack)
    }

    private static let schemaFooter = "Fields, units and limits come from this exercise’s metrics schema."

    @ViewBuilder
    private func metricRows(_ specs: [CardioMetricSpec]) -> some View {
        ForEach(Array(specs.enumerated()), id: \.element.key) { index, spec in
            if index > 0 {
                RowSeparator()
            }
            MetricInputRow(
                spec: spec,
                value: binding(for: spec),
                isInvalid: invalidKey == spec.key,
                focusedField: $focusedField
            )
        }
    }

    private func binding(for spec: CardioMetricSpec) -> Binding<CardioFieldState> {
        Binding(
            get: { model.value(for: spec.key) ?? defaultValue(for: spec) },
            set: { next in
                model.setValue(next, for: spec.key)
                if invalidKey == spec.key {
                    invalidKey = nil
                    errorMessage = nil
                }
            }
        )
    }

    private func defaultValue(for spec: CardioMetricSpec) -> CardioFieldState {
        spec.format == .durationSeconds ? .duration(hours: "", minutes: "", seconds: "") : .text("")
    }

    private func save() {
        switch model.collectMetrics() {
        case let .success(metrics):
            errorMessage = nil
            invalidKey = nil
            onSave(metrics)
        case let .failure(key, message):
            errorMessage = message
            invalidKey = key
        }
    }
}

private enum CardioMetricFocusedField: Hashable {
    case scalar(String)
    case duration(String, CardioDurationComponent)
}

private enum CardioDurationComponent: Hashable {
    case hours
    case minutes
    case seconds
}

/// One schema metric as a grouped form row: the label on the left and a
/// recessed value well (or h/m/s wells for durations) with its unit.
private struct MetricInputRow: View {
    let spec: CardioMetricSpec
    @Binding var value: CardioFieldState
    let isInvalid: Bool
    let focusedField: FocusState<CardioMetricFocusedField?>.Binding

    var body: some View {
        FormRow {
            Text(spec.label)
                .foregroundStyle(isInvalid ? NeoGymTheme.destructive : NeoGymTheme.text)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityHidden(true)
            if spec.format == .durationSeconds {
                durationFields
            } else {
                FormNumberField(
                    accessibilityLabel: spec.unit.isEmpty ? spec.label : "\(spec.label), \(spec.unit)",
                    text: scalarBinding,
                    unit: spec.unit.isEmpty ? nil : spec.unit,
                    placeholder: placeholder,
                    keyboard: spec.format == .decimal ? .decimalPad : .numberPad,
                    isInvalid: isInvalid,
                    field: .scalar(spec.key),
                    focusedField: focusedField
                )
            }
        }
    }

    /// The schema's range ("0–15"), else a dash.
    private var placeholder: String {
        guard let minimum = spec.minimum, let maximum = spec.maximum ?? spec.exclusiveMaximum else { return "—" }
        return "\(Self.compact(minimum))–\(Self.compact(maximum))"
    }

    private static func compact(_ value: Double) -> String {
        value.formatted(.number.precision(.fractionLength(0 ... 2)).grouping(.never))
    }

    private var durationFields: some View {
        HStack(spacing: 4) {
            if CardioMetricsSchemaHelpers.shouldShowHoursInput(maximum: spec.maximum) {
                durationWell("Hours", unit: "h", binding: durationBinding(\.hours), field: .hours)
            }
            durationWell("Minutes", unit: "m", binding: durationBinding(\.minutes), field: .minutes)
            durationWell("Seconds", unit: "s", binding: durationBinding(\.seconds), field: .seconds)
        }
    }

    private var scalarBinding: Binding<String> {
        Binding(
            get: {
                if case let .text(text) = value { return text }
                return ""
            },
            set: { value = .text($0) }
        )
    }

    private func durationBinding(_ keyPath: WritableKeyPath<DurationParts, String>) -> Binding<String> {
        Binding(
            get: { durationParts()[keyPath: keyPath] },
            set: { newValue in
                var parts = durationParts()
                parts[keyPath: keyPath] = newValue
                value = .duration(hours: parts.hours, minutes: parts.minutes, seconds: parts.seconds)
            }
        )
    }

    private func durationParts() -> DurationParts {
        if case let .duration(hours, minutes, seconds) = value {
            return DurationParts(hours: hours, minutes: minutes, seconds: seconds)
        }
        return DurationParts(hours: "", minutes: "", seconds: "")
    }

    private func durationWell(
        _ name: String,
        unit: String,
        binding: Binding<String>,
        field: CardioDurationComponent
    ) -> some View {
        HStack(spacing: 2) {
            TextField("0", text: binding)
                .keyboardType(.numberPad)
                .numericFieldFocus(.duration(spec.key, field), focusedField: focusedField)
                .multilineTextAlignment(.center)
                .font(.body.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(isInvalid ? NeoGymTheme.destructive : NeoGymTheme.text)
                .frame(width: 44, height: 38)
                .formWell(isInvalid: isInvalid)
                .accessibilityLabel("\(spec.label), \(name.lowercased())")
            Text(unit)
                .font(.footnote)
                .foregroundStyle(NeoGymTheme.textSecondary)
                .accessibilityHidden(true)
        }
    }
}

private struct DurationParts {
    var hours: String
    var minutes: String
    var seconds: String
}
