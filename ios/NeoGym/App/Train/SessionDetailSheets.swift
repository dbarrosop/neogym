import NeoGymKit
import SwiftUI

extension SessionDetailView {
    /// Pickers, editors and confirmations presented from the session screen.
    func attachSheets<Content: View>(to content: Content) -> some View {
        content
            .sheet(isPresented: $isShowingExercisePicker) {
                ExercisePickerView(
                    repository: exercisesRepository,
                    alreadySelected: Set(viewModel.session?.workoutSessionExercises.map(\.exercise.id) ?? []),
                    confirmLabel: "Add"
                ) { exercises in
                    Task {
                        if await viewModel.addExercises(exercises) {
                            isShowingExercisePicker = false
                            onMutated()
                        }
                    }
                } onCancel: {
                    isShowingExercisePicker = false
                }
            }
            .sheet(item: $editingSet) { state in
                StrengthSetEditorView(
                    state: state,
                    isPending: viewModel.mutationState.isLoading,
                    onSave: { reps, weight in saveSet(state, reps: reps, weight: weight) },
                    onDelete: { deleteSet(state) },
                    onCancel: { editingSet = nil }
                )
            }
            .sheet(item: $editingCardioEntry) { state in
                CardioMetricsFormView(
                    state: state,
                    isPending: viewModel.mutationState.isLoading,
                    onSave: { metrics in saveCardioEntry(state, metrics: metrics) },
                    onDelete: { deleteCardioEntry(state) },
                    onCancel: { editingCardioEntry = nil }
                )
            }
            .sheet(isPresented: $isEditingStartedAt) {
                SessionStartedAtEditorSheet(
                    startedAt: $draftStartedAt,
                    isSaving: viewModel.mutationState.isLoading,
                    onCancel: { isEditingStartedAt = false },
                    onSave: {
                        Task {
                            if await viewModel.updateStartedAt(draftStartedAt) {
                                isEditingStartedAt = false
                                onMutated()
                            }
                        }
                    }
                )
            }
            .confirmationDialog("Delete this session?", isPresented: $isConfirmingDelete, titleVisibility: .visible) {
                Button("Delete session", role: .destructive) {
                    Task {
                        if await viewModel.deleteSession() { onDeleted() }
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("All exercises, sets and entries in this session will be permanently removed.")
            }
            .alert(item: $pendingRemoveExercise) { row in
                Alert(
                    title: Text("Remove \(row.exercise.name)?"),
                    message: Text(Self.removeExerciseMessage(row)),
                    primaryButton: .destructive(Text("Remove")) {
                        Task {
                            if await viewModel.removeExercise(id: row.id) {
                                pendingRemoveExercise = nil
                                onMutated()
                            }
                        }
                    },
                    secondaryButton: .cancel { pendingRemoveExercise = nil }
                )
            }
    }

    private func saveSet(_ state: StrengthSetEditorState, reps: Int, weight: Double) {
        Task {
            let didSave: Bool
            switch state.mode {
            case let .add(workoutSessionExerciseId):
                didSave = await viewModel.addStrengthSet(
                    workoutSessionExerciseId: workoutSessionExerciseId,
                    reps: reps,
                    weight: weight
                )
                if didSave {
                    drafts[workoutSessionExerciseId] = nil
                    restTimer.start(
                        label: "\(state.exerciseName) · set \(state.nextSetNumber + 1) next",
                        sessionId: viewModel.sessionId
                    )
                }
            case let .edit(set):
                didSave = await viewModel.updateStrengthSet(id: set.id, reps: reps, weight: weight)
            }
            if didSave {
                editingSet = nil
                onMutated()
            }
        }
    }

    private func deleteSet(_ state: StrengthSetEditorState) {
        guard case let .edit(set) = state.mode else { return }
        Task {
            if await viewModel.deleteStrengthSet(id: set.id) {
                editingSet = nil
                onMutated()
            }
        }
    }

    private func saveCardioEntry(_ state: CardioEntryEditorState, metrics: CardioMetrics) {
        Task {
            let didSave: Bool
            switch state.mode {
            case let .add(workoutSessionExerciseId):
                didSave = await viewModel.addCardioEntry(workoutSessionExerciseId: workoutSessionExerciseId, metrics: metrics)
            case let .edit(entry):
                didSave = await viewModel.updateCardioEntry(id: entry.id, metrics: metrics)
            }
            if didSave {
                editingCardioEntry = nil
                onMutated()
            }
        }
    }

    private func deleteCardioEntry(_ state: CardioEntryEditorState) {
        guard case let .edit(entry) = state.mode else { return }
        Task {
            if await viewModel.deleteCardioEntry(id: entry.id) {
                editingCardioEntry = nil
                onMutated()
            }
        }
    }

    static func removeExerciseMessage(_ row: SessionExerciseRow) -> String {
        let childCount = row.exercise.isCardio
            ? row.workoutSessionCardioEntries.count
            : row.workoutSessionStrengthSets.count
        guard childCount > 0 else { return "It will be removed from this session only." }
        let noun = row.exercise.isCardio
            ? (childCount == 1 ? "entry" : "entries")
            : (childCount == 1 ? "set" : "sets")
        return "\(childCount) logged \(noun) will be deleted with it. This can't be undone."
    }
}

/// Sets, reps and volume under the session title.
struct SessionTotalsStrip: View {
    let totals: SessionStrengthTotals

    var body: some View {
        HStack(spacing: 0) {
            cell(value: "\(totals.sets)", label: "sets")
            Divider().overlay(NeoGymTheme.separator).padding(.vertical, NeoGymTheme.spacingXS)
            cell(value: "\(totals.reps)", label: "reps")
            Divider().overlay(NeoGymTheme.separator).padding(.vertical, NeoGymTheme.spacingXS)
            cell(value: MetricFormat.whole(totals.volume), label: "kg volume")
        }
        .padding(.vertical, NeoGymTheme.spacingSM)
        .fixedSize(horizontal: false, vertical: true)
        .cardSurface(cornerRadius: NeoGymTheme.radiusLG)
    }

    private func cell(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.title3.weight(.bold))
                .monospacedDigit()
                .foregroundStyle(NeoGymTheme.text)
            Text(label)
                .font(.footnote)
                .foregroundStyle(NeoGymTheme.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}

/// The three earlier sessions still linked to the same workout template.
struct SessionEarlierWorkoutSessions: View {
    let workoutName: String
    let sessions: [SessionDetailModel]
    let state: Loadable<[SessionDetailModel]>

    var body: some View {
        if !sessions.isEmpty {
            VStack(alignment: .leading, spacing: 0) {
                Text("Earlier \(workoutName) sessions")
                    .font(.footnote.weight(.semibold))
                    .textCase(.uppercase)
                    .foregroundStyle(NeoGymTheme.textSecondary)
                    .padding(.top, NeoGymTheme.spacingSM)
                    .padding(.bottom, NeoGymTheme.spacingXXS)
                    .accessibilityAddTraits(.isHeader)
                ForEach(sessions) { session in
                    let totals = session.strengthTotals
                    HStack {
                        Text(session.startedAtDate?.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated)) ?? "—")
                            .font(.subheadline)
                            .foregroundStyle(NeoGymTheme.text)
                        Spacer(minLength: NeoGymTheme.spacingXS)
                        Text("\(totals.sets) sets · \(MetricFormat.whole(totals.volume)) kg")
                            .font(.footnote)
                            .foregroundStyle(NeoGymTheme.textSecondary)
                    }
                    .monospacedDigit()
                    .frame(minHeight: NeoGymTheme.minimumTapTarget)
                    .accessibilityElement(children: .combine)
                    if session.id != sessions.last?.id {
                        Divider().overlay(NeoGymTheme.separator)
                    }
                }
            }
            .padding(.horizontal, NeoGymTheme.spacingMD)
            .padding(.bottom, NeoGymTheme.spacingXXS)
            .cardSurface()
        } else if case let .failed(message, _) = state {
            FeedbackBanner(message: "Could not load earlier sessions: \(message)")
        }
    }
}

struct SessionStartedAtEditorSheet: View {
    @Binding var startedAt: Date
    let isSaving: Bool
    let onCancel: () -> Void
    let onSave: () -> Void

    var body: some View {
        NavigationStack {
            Form {
                DatePicker("Started at", selection: $startedAt, displayedComponents: [.date, .hourAndMinute])
                    .datePickerStyle(.graphical)
            }
            .navigationTitle("Edit date")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSaving ? "Saving…" : "Save", action: onSave)
                        .disabled(isSaving)
                }
            }
        }
        .presentationDetents([.large])
    }
}
