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

    var title: String {
        switch mode {
        case .add:
            return "Add entry \(nextEntryNumber)"
        case let .edit(entry):
            return "Edit entry \(entry.entryNumber)"
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
            Form {
                Section(header: Text(state.exerciseName)) {
                    ForEach(model.specs, id: \.key) { spec in
                        MetricInputRow(
                            spec: spec,
                            value: binding(for: spec),
                            isInvalid: invalidKey == spec.key
                        )
                    }
                }
                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundColor(.red)
                    }
                }
                if case .edit = state.mode {
                    Section {
                        Button("Delete entry", role: .destructive, action: onDelete)
                            .disabled(isPending)
                    }
                }
            }
            .navigationTitle(state.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                        .disabled(isPending)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isPending ? "Saving…" : "Save") { save() }
                        .disabled(isPending)
                }
            }
        }
        .navigationViewStyle(.stack)
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

private struct MetricInputRow: View {
    let spec: CardioMetricSpec
    @Binding var value: CardioFieldState
    let isInvalid: Bool

    var body: some View {
        if spec.format == .durationSeconds {
            durationFields
        } else {
            scalarField
        }
    }

    private var scalarField: some View {
        TextField(label, text: scalarBinding)
            .keyboardType(spec.format == .decimal ? .decimalPad : .numberPad)
            .multilineTextAlignment(.trailing)
            .foregroundColor(isInvalid ? .red : .primary)
    }

    private var durationFields: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.caption)
                .foregroundColor(isInvalid ? .red : NeoGymTheme.mutedText)
            HStack(spacing: 8) {
                if CardioMetricsSchemaHelpers.shouldShowHoursInput(maximum: spec.maximum) {
                    durationTextField("h", binding: durationBinding(\.hours))
                }
                durationTextField("min", binding: durationBinding(\.minutes))
                durationTextField("sec", binding: durationBinding(\.seconds))
            }
        }
        .padding(.vertical, 4)
    }

    private var label: String {
        let unit = spec.unit.isEmpty ? "" : " (\(spec.unit))"
        let optional = spec.required ? "" : " · optional"
        return spec.label + unit + optional
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

    private func durationTextField(_ placeholder: String, binding: Binding<String>) -> some View {
        TextField(placeholder, text: binding)
            .keyboardType(.numberPad)
            .multilineTextAlignment(.trailing)
            .foregroundColor(isInvalid ? .red : .primary)
    }
}

private struct DurationParts {
    var hours: String
    var minutes: String
    var seconds: String
}
