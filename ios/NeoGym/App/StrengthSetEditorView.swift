import NeoGymKit
import SwiftUI
import UIKit

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

    @State private var reps: String
    @State private var weight: String
    @State private var errorMessage: String?

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
        _reps = State(initialValue: seed.map { String($0.reps) } ?? "")
        _weight = State(initialValue: seed.map { Self.formatWeight($0.weight) } ?? "")
    }

    var body: some View {
        NavigationView {
            ScreenScaffold {
                ScrollView {
                    VStack(spacing: NeoGymTheme.spacingMD) {
                        SectionShell(title: state.exerciseName, subtitle: title) {
                            VStack(spacing: NeoGymTheme.spacingSM) {
                                setField(
                                    title: "Weight",
                                    detail: "kg\(state.doubleWeight ? " · per side" : "")",
                                    placeholder: "0",
                                    text: $weight,
                                    keyboardType: .decimalPad
                                )
                                setField(
                                    title: "Reps",
                                    detail: nil,
                                    placeholder: "0",
                                    text: $reps,
                                    keyboardType: .numberPad
                                )
                            }
                        }

                        if state.doubleWeight {
                            Text("Volume counts both sides; enter the weight for one side to match the web app.")
                                .font(.caption)
                                .foregroundColor(NeoGymTheme.mutedText)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(NeoGymTheme.spacingMD)
                                .glassSurface(
                                    cornerRadius: NeoGymTheme.radiusLG,
                                    material: .ultraThin,
                                    tint: NeoGymTheme.glassSubtleFill,
                                    shadow: false
                                )
                        }
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
                        if case .edit = state.mode {
                            Button("Delete set", role: .destructive, action: onDelete)
                                .buttonStyle(NeoGymSecondaryButtonStyle())
                                .disabled(isPending)
                        }
                    }
                    .frame(maxWidth: 620)
                    .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
                    .padding(.vertical, NeoGymTheme.screenVerticalPadding)
                    .frame(maxWidth: .infinity)
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

    private func setField(
        title: String,
        detail: String?,
        placeholder: String,
        text: Binding<String>,
        keyboardType: UIKeyboardType
    ) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: NeoGymTheme.spacingSM) {
            VStack(alignment: .leading, spacing: NeoGymTheme.spacingXXS) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                if let detail {
                    Text(detail)
                        .font(.caption)
                        .foregroundColor(NeoGymTheme.mutedText)
                }
            }
            Spacer(minLength: NeoGymTheme.spacingSM)
            TextField(placeholder, text: text)
                .keyboardType(keyboardType)
                .multilineTextAlignment(.trailing)
                .textInputAutocapitalization(.never)
                .disableAutocorrection(true)
        }
        .padding(NeoGymTheme.spacingSM)
        .glassSurface(
            cornerRadius: NeoGymTheme.radiusMD,
            material: .ultraThin,
            tint: NeoGymTheme.glassSubtleFill,
            shadow: false
        )
    }

    private var title: String {
        switch state.mode {
        case .add:
            return "Add set \(state.nextSetNumber)"
        case let .edit(set):
            return "Edit set \(set.setNumber)"
        }
    }

    private func save() {
        switch SessionSetFormValidator.validate(repsText: reps, weightText: weight) {
        case let .success(reps, weight):
            errorMessage = nil
            onSave(reps, weight)
        case let .failure(message):
            errorMessage = message
        }
    }

    private static func formatWeight(_ weight: Double) -> String {
        weight.rounded() == weight ? String(format: "%.0f", weight) : String(format: "%.1f", weight)
    }
}
