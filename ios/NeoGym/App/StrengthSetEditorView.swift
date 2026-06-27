import NeoGymKit
import SwiftUI

struct StrengthSetEditorState: Identifiable {
    enum Mode {
        case add(workoutSessionExerciseId: String)
        case edit(SessionStrengthSet)
    }

    let id = UUID()
    let mode: Mode
    let exerciseName: String
    let nextSetNumber: Int
    let previousSet: SessionStrengthSet?
    let doubleWeight: Bool

    static func add(
        workoutSessionExerciseId: String,
        exerciseName: String,
        nextSetNumber: Int,
        previousSet: SessionStrengthSet?,
        doubleWeight: Bool
    ) -> StrengthSetEditorState {
        StrengthSetEditorState(
            mode: .add(workoutSessionExerciseId: workoutSessionExerciseId),
            exerciseName: exerciseName,
            nextSetNumber: nextSetNumber,
            previousSet: previousSet,
            doubleWeight: doubleWeight
        )
    }

    static func edit(set: SessionStrengthSet, exerciseName: String, doubleWeight: Bool) -> StrengthSetEditorState {
        StrengthSetEditorState(
            mode: .edit(set),
            exerciseName: exerciseName,
            nextSetNumber: set.setNumber,
            previousSet: set,
            doubleWeight: doubleWeight
        )
    }
}

struct StrengthSetEditorView: View {
    let state: StrengthSetEditorState
    let isPending: Bool
    let onSave: (Int, Double) -> Void
    let onDelete: () -> Void
    let onCancel: () -> Void

    @State private var reps: Int
    @State private var weightKilograms: Int
    @State private var weightTenths: Int

    init(
        state: StrengthSetEditorState,
        isPending: Bool,
        onSave: @escaping (Int, Double) -> Void,
        onDelete: @escaping () -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.state = state
        self.isPending = isPending
        self.onSave = onSave
        self.onDelete = onDelete
        self.onCancel = onCancel

        let seed = state.previousSet
        let initialWeight = max(0, seed?.weight ?? 0)
        let roundedTenths = Int((initialWeight * 10).rounded())
        _reps = State(initialValue: min(Self.maximumReps, max(0, seed?.reps ?? Self.defaultReps(from: seed))))
        _weightKilograms = State(initialValue: min(Self.maximumKilograms, max(0, roundedTenths / 10)))
        _weightTenths = State(initialValue: min(9, max(0, roundedTenths % 10)))
    }

    var body: some View {
        NavigationView {
            Form {
                Section {
                    wheelRow
                } header: {
                    Text(state.exerciseName)
                } footer: {
                    if state.doubleWeight {
                        Text("Enter the weight for one side. Volume still counts both sides, matching the web app.")
                    }
                }

                if case .edit = state.mode {
                    Section {
                        Button("Delete set", role: .destructive, action: onDelete)
                            .disabled(isPending)
                    }
                }
            }
            .navigationTitle(title)
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

    private var wheelRow: some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingMD) {
            HStack(alignment: .firstTextBaseline) {
                Text("Set \(state.nextSetNumber)")
                    .font(.headline)
                Spacer()
                Text(summary)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(NeoGymTheme.mutedText)
            }

            HStack(spacing: NeoGymTheme.spacingXS) {
                wheelPicker(title: "kg", selection: $weightKilograms, values: 0...Self.maximumKilograms) { value in
                    Text("\(value)").tag(value)
                }

                wheelPicker(title: "decimal", selection: $weightTenths, values: 0...9) { value in
                    Text(".\(value)").tag(value)
                }
                .frame(maxWidth: 86)

                wheelPicker(title: "reps", selection: $reps, values: 0...Self.maximumReps) { value in
                    Text("\(value)").tag(value)
                }
            }
            .frame(height: 170)
        }
        .padding(.vertical, NeoGymTheme.spacingXS)
    }

    private func wheelPicker<Content: View>(
        title: String,
        selection: Binding<Int>,
        values: ClosedRange<Int>,
        @ViewBuilder label: @escaping (Int) -> Content
    ) -> some View {
        VStack(spacing: NeoGymTheme.spacingXXS) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundColor(NeoGymTheme.mutedText)
            Picker(title, selection: selection) {
                ForEach(Array(values), id: \.self) { value in
                    label(value)
                }
            }
            .pickerStyle(.wheel)
            .labelsHidden()
            .clipped()
        }
        .frame(maxWidth: .infinity)
    }

    private var title: String {
        switch state.mode {
        case .add:
            return "Add set"
        case let .edit(set):
            return "Edit set \(set.setNumber)"
        }
    }

    private var weight: Double {
        Double(weightKilograms) + (Double(weightTenths) / 10)
    }

    private var summary: String {
        "\(Self.formatWeight(weight)) kg × \(reps)"
    }

    private func save() {
        onSave(reps, weight)
    }

    private static func formatWeight(_ weight: Double) -> String {
        weight.rounded() == weight ? String(format: "%.0f", weight) : String(format: "%.1f", weight)
    }

    private static func defaultReps(from set: SessionStrengthSet?) -> Int {
        set?.reps ?? 10
    }

    private static let maximumReps = 200
    private static let maximumKilograms = 500
}
