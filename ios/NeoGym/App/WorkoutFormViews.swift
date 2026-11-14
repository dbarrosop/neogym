import NeoGymKit
import SwiftUI

struct WorkoutCreateView: View {
    @StateObject private var editor: WorkoutEditorViewModel
    @StateObject private var form = WorkoutFormModel(
        initialValues: WorkoutFormValues(name: "", description: "", exercises: [], labels: [])
    )
    let exercisesRepository: any ExercisesRepositoryProtocol
    var onFinished: () -> Void

    @Environment(\.presentationMode) private var presentationMode

    init(
        workoutsRepository: any WorkoutsRepositoryProtocol,
        exercisesRepository: any ExercisesRepositoryProtocol,
        onFinished: @escaping () -> Void
    ) {
        _editor = StateObject(wrappedValue: WorkoutEditorViewModel(workoutId: nil, repository: workoutsRepository))
        self.exercisesRepository = exercisesRepository
        self.onFinished = onFinished
    }

    var body: some View {
        WorkoutFormScreen(
            title: "New workout",
            submitLabel: "Create workout",
            form: form,
            labels: editor.labels,
            exercisesRepository: exercisesRepository,
            isSubmitting: editor.saveState.isLoading,
            errorMessage: form.errorMessage ?? editor.saveState.errorMessage,
            onSubmit: submit,
            onCancel: { presentationMode.wrappedValue.dismiss() }
        )
        .task {
            if case .idle = editor.state {
                await editor.load()
            }
        }
    }

    private func submit() {
        guard let values = form.valuesForSubmit() else { return }
        Task {
            if await editor.create(values: values) != nil {
                onFinished()
                presentationMode.wrappedValue.dismiss()
            }
        }
    }
}

struct WorkoutEditView: View {
    @StateObject private var editor: WorkoutEditorViewModel
    let exercisesRepository: any ExercisesRepositoryProtocol
    let currentUserId: String?
    var onSaved: () -> Void
    var onDeleted: () -> Void

    @Environment(\.presentationMode) private var presentationMode
    @State private var form: WorkoutFormModel?
    @State private var confirmDelete = false

    init(
        workoutId: String,
        workoutsRepository: any WorkoutsRepositoryProtocol,
        exercisesRepository: any ExercisesRepositoryProtocol,
        currentUserId: String?,
        onSaved: @escaping () -> Void,
        onDeleted: @escaping () -> Void
    ) {
        _editor = StateObject(
            wrappedValue: WorkoutEditorViewModel(workoutId: workoutId, repository: workoutsRepository)
        )
        self.exercisesRepository = exercisesRepository
        self.currentUserId = currentUserId
        self.onSaved = onSaved
        self.onDeleted = onDeleted
    }

    var body: some View {
        Group {
            switch editor.state {
            case .idle:
                SectionShell(title: "Loading workout") {
                    AppLoadingStateView(title: "Loading workout")
                }
                .padding(20)
            case .loading where editor.workout == nil:
                SectionShell(title: "Loading workout") {
                    AppLoadingStateView(title: "Loading workout")
                }
                .padding(20)
            case let .failed(message, _) where editor.workout == nil:
                SectionShell(title: "Workout") {
                    AppErrorStateView(title: "Failed to load", message: message) {
                        Task { await editor.load() }
                    }
                }
                .padding(20)
            default:
                if let workout = editor.workout, !workout.canEdit(currentUserId: currentUserId) {
                    AppEmptyStateView(
                        title: "Workout can't be edited",
                        message: "Public or shared workouts are read-only.",
                        systemImage: "lock"
                    )
                    .padding(20)
                    .onAppear { presentationMode.wrappedValue.dismiss() }
                } else if let form {
                    WorkoutFormScreen(
                        title: "Edit workout",
                        submitLabel: "Save changes",
                        form: form,
                        labels: editor.labels,
                        exercisesRepository: exercisesRepository,
                        isSubmitting: editor.saveState.isLoading || editor.deleteState.isLoading,
                        errorMessage: form.errorMessage
                            ?? editor.saveState.errorMessage
                            ?? editor.deleteState.errorMessage,
                        onSubmit: submit,
                        onCancel: { presentationMode.wrappedValue.dismiss() },
                        deleteAction: { confirmDelete = true }
                    )
                } else {
                    AppLoadingStateView(title: "Preparing form")
                }
            }
        }
        .task {
            if case .idle = editor.state {
                await editor.load()
                if let initialValues = editor.initialValues, form == nil {
                    form = WorkoutFormModel(initialValues: initialValues)
                }
            }
        }
        .confirmationDialog("Delete this workout?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete workout", role: .destructive) { deleteWorkout() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This removes the workout and its exercise list. Past sessions you've logged with it stay intact.")
        }
    }

    private func submit() {
        guard let values = form?.valuesForSubmit() else { return }
        Task {
            if await editor.save(values: values) {
                onSaved()
                presentationMode.wrappedValue.dismiss()
            }
        }
    }

    private func deleteWorkout() {
        Task {
            if await editor.delete() {
                onDeleted()
                presentationMode.wrappedValue.dismiss()
            }
        }
    }
}

private struct WorkoutFormScreen: View {
    let title: String
    let submitLabel: String
    @ObservedObject var form: WorkoutFormModel
    let labels: [WorkoutLabel]
    let exercisesRepository: any ExercisesRepositoryProtocol
    let isSubmitting: Bool
    let errorMessage: String?
    let onSubmit: () -> Void
    let onCancel: () -> Void
    var deleteAction: (() -> Void)?

    @State private var pickerOpen = false

    var body: some View {
        FormScrollContainer {
            FormSection(header: "Name") {
                FormRow {
                    TextField("e.g. Upper / push day", text: $form.name)
                        .textInputAutocapitalization(.words)
                        .accessibilityLabel("Name")
                }
            }
            FormSection(header: "Notes · Markdown") {
                FormTextAreaRow(placeholder: "Optional", text: $form.description, accessibilityLabel: "Notes, markdown")
            }
            LabelInputView(form: form, suggestions: labels, disabled: isSubmitting)
            exerciseRows
            if let errorMessage {
                FeedbackBanner(message: errorMessage)
            }
            if let deleteAction {
                FormDeleteButton(
                    title: "Delete workout",
                    isDisabled: isSubmitting,
                    action: deleteAction
                )
                .padding(.top, NeoGymTheme.spacingXS)
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .nativeFormActionToolbar(
            submitLabel: submitLabel,
            isSubmitting: isSubmitting,
            isSubmitEnabled: form.canSubmit,
            onCancel: onCancel,
            onSubmit: onSubmit
        )
        .sheet(isPresented: $pickerOpen) {
            ExercisePickerView(
                repository: exercisesRepository,
                alreadySelected: form.selectedExerciseIds,
                footer: "Added to the end of the workout.",
                onConfirm: { picks in
                    form.addExercises(picks)
                    pickerOpen = false
                },
                onCancel: { pickerOpen = false }
            )
        }
    }

    private var exerciseRows: some View {
        FormSection(
            header: "Exercises",
            headerDetail: form.exercises.count > 1 ? "Long-press to reorder" : nil,
            footer: form.exercises.isEmpty ? "Sessions started from this workout begin with these exercises." : nil
        ) {
            ForEach(Array(form.exercises.enumerated()), id: \.element.rowId) { index, exercise in
                WorkoutFormExerciseRowView(
                    exercise: exercise,
                    isFirst: index == 0,
                    isLast: index == form.exercises.count - 1,
                    isDisabled: isSubmitting,
                    remove: { form.removeExercise(rowId: exercise.rowId) },
                    moveUp: { form.moveExerciseUp(rowId: exercise.rowId) },
                    moveDown: { form.moveExerciseDown(rowId: exercise.rowId) }
                )
                RowSeparator(leadingInset: 52)
            }
            FormActionRow(title: "Add exercise", isDisabled: isSubmitting) {
                pickerOpen = true
            }
        }
    }
}

/// One exercise in the workout editor: red minus to remove, name and primary
/// muscle; long-press (or the VoiceOver actions) moves it up or down.
private struct WorkoutFormExerciseRowView: View {
    let exercise: WorkoutFormExerciseRow
    let isFirst: Bool
    let isLast: Bool
    let isDisabled: Bool
    let remove: () -> Void
    let moveUp: () -> Void
    let moveDown: () -> Void

    var body: some View {
        FormRow {
            FormRemoveButton(accessibilityLabel: "Remove \(exercise.name)", isDisabled: isDisabled, action: remove)
            VStack(alignment: .leading, spacing: 2) {
                Text(exercise.name)
                    .lineLimit(2)
                Text(
                    ExerciseFormatters.enumValue(exercise.primaryMuscleGroup)
                        + (exercise.doubleWeight ? " · two-handed" : "")
                )
                .font(.footnote)
                .foregroundStyle(NeoGymTheme.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .contentShape(Rectangle())
        .contextMenu { menu }
        .accessibilityElement(children: .combine)
        .accessibilityActions { menu }
    }

    @ViewBuilder
    private var menu: some View {
        Button("Move up", systemImage: "arrow.up", action: moveUp)
            .disabled(isFirst || isDisabled)
        Button("Move down", systemImage: "arrow.down", action: moveDown)
            .disabled(isLast || isDisabled)
        Button("Remove", systemImage: "minus.circle", role: .destructive, action: remove)
            .disabled(isDisabled)
    }
}
