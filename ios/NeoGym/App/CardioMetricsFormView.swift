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
                ScrollView {
                    VStack(spacing: NeoGymTheme.spacingMD) {
                        metricsPanel
                        if let errorMessage {
                            Text(errorMessage)
                                .font(.subheadline)
                                .foregroundColor(NeoGymTheme.danger)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(NeoGymTheme.spacingMD)
                                .glassSurface(
                                    cornerRadius: NeoGymTheme.radiusLG,
                                    material: .thin,
                                    tint: NeoGymTheme.danger.opacity(0.06),
                                    stroke: NeoGymTheme.danger.opacity(0.22),
                                    shadow: false
                                )
                        }
                        deleteSection
                    }
                    .frame(maxWidth: 620)
                    .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
                    .padding(.vertical, NeoGymTheme.screenVerticalPadding)
                    .frame(maxWidth: .infinity)
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
            .keyboardDoneToolbar(focusedField: $focusedField)
        }
        .navigationViewStyle(.stack)
    }

    private var metricsPanel: some View {
        SectionShell(title: state.exerciseName, subtitle: "Cardio metrics") {
            VStack(spacing: NeoGymTheme.spacingSM) {
                ForEach(model.specs, id: \.key) { spec in
                    MetricInputRow(
                        spec: spec,
                        value: binding(for: spec),
                        isInvalid: invalidKey == spec.key,
                        focusedField: $focusedField
                    )
                }
            }
        }
    }

    @ViewBuilder
    private var deleteSection: some View {
        if case .edit = state.mode {
            Button("Delete entry", role: .destructive, action: onDelete)
                .buttonStyle(NeoGymSecondaryButtonStyle())
                .disabled(isPending)
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

private struct MetricInputRow: View {
    let spec: CardioMetricSpec
    @Binding var value: CardioFieldState
    let isInvalid: Bool
    let focusedField: FocusState<CardioMetricFocusedField?>.Binding

    var body: some View {
        if spec.format == .durationSeconds {
            durationFields
        } else {
            scalarField
        }
    }

    private var scalarField: some View {
        HStack(alignment: .firstTextBaseline, spacing: NeoGymTheme.spacingSM) {
            Text(label)
                .font(.subheadline.weight(.semibold))
                .foregroundColor(isInvalid ? .red : .primary)
            Spacer(minLength: NeoGymTheme.spacingSM)
            TextField("0", text: scalarBinding)
                .keyboardType(spec.format == .decimal ? .decimalPad : .numberPad)
                .numericFieldFocus(.scalar(spec.key), focusedField: focusedField)
                .multilineTextAlignment(.trailing)
                .foregroundColor(isInvalid ? .red : .primary)
        }
        .padding(NeoGymTheme.spacingSM)
        .glassSurface(
            cornerRadius: NeoGymTheme.radiusMD,
            material: .ultraThin,
            tint: isInvalid ? NeoGymTheme.danger.opacity(0.07) : NeoGymTheme.glassSubtleFill,
            stroke: isInvalid ? NeoGymTheme.danger.opacity(0.28) : NeoGymTheme.glassStrokeSecondary,
            shadow: false
        )
    }

    private var durationFields: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label)
                .font(.caption)
                .foregroundColor(isInvalid ? .red : NeoGymTheme.mutedText)
            HStack(spacing: 8) {
                if CardioMetricsSchemaHelpers.shouldShowHoursInput(maximum: spec.maximum) {
                    durationTextField("h", binding: durationBinding(\.hours), field: .hours)
                }
                durationTextField("min", binding: durationBinding(\.minutes), field: .minutes)
                durationTextField("sec", binding: durationBinding(\.seconds), field: .seconds)
            }
        }
        .padding(NeoGymTheme.spacingSM)
        .glassSurface(
            cornerRadius: NeoGymTheme.radiusMD,
            material: .ultraThin,
            tint: isInvalid ? NeoGymTheme.danger.opacity(0.07) : NeoGymTheme.glassSubtleFill,
            stroke: isInvalid ? NeoGymTheme.danger.opacity(0.28) : NeoGymTheme.glassStrokeSecondary,
            shadow: false
        )
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

    private func durationTextField(
        _ placeholder: String,
        binding: Binding<String>,
        field: CardioDurationComponent
    ) -> some View {
        TextField(placeholder, text: binding)
            .keyboardType(.numberPad)
            .numericFieldFocus(.duration(spec.key, field), focusedField: focusedField)
            .multilineTextAlignment(.trailing)
            .foregroundColor(isInvalid ? .red : .primary)
            .padding(NeoGymTheme.spacingXS)
            .glassSurface(
                cornerRadius: NeoGymTheme.radiusSM,
                material: .ultraThin,
                tint: NeoGymTheme.glassFill,
                shadow: false
            )
    }
}

private struct DurationParts {
    var hours: String
    var minutes: String
    var seconds: String
}
