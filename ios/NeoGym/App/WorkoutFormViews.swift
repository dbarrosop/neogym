import NeoGymKit
import SwiftUI

struct WorkoutCreateView: View {
    @StateObject private var editor: WorkoutEditorViewModel
    @StateObject private var form = WorkoutFormModel(initialValues: WorkoutFormValues(name: "", description: "", exercises: [], labels: []))
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
        _editor = StateObject(wrappedValue: WorkoutEditorViewModel(workoutId: workoutId, repository: workoutsRepository))
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
                        title: editor.workout?.name ?? "Edit workout",
                        submitLabel: "Save changes",
                        form: form,
                        labels: editor.labels,
                        exercisesRepository: exercisesRepository,
                        isSubmitting: editor.saveState.isLoading,
                        errorMessage: form.errorMessage ?? editor.saveState.errorMessage ?? editor.deleteState.errorMessage,
                        onSubmit: submit,
                        onCancel: { presentationMode.wrappedValue.dismiss() },
                        deleteAction: { confirmDelete = true }
                    )
                } else {
                    AppLoadingStateView(title: "Preparing form")
                }
            }
        }
        .background(GridBackground())
        .task {
            if case .idle = editor.state {
                await editor.load()
                if let initialValues = editor.initialValues, form == nil {
                    form = WorkoutFormModel(initialValues: initialValues)
                }
            }
        }
        .alert("Delete this workout?", isPresented: $confirmDelete) {
            Button("Cancel", role: .cancel) {}
            Button("Delete workout", role: .destructive) { deleteWorkout() }
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
        ScrollView {
            SectionShell(title: title) {
                VStack(alignment: .leading, spacing: 18) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Name")
                            .font(.subheadline.weight(.semibold))
                        TextField("e.g. Upper / push day", text: $form.name)
                            .textInputAutocapitalization(.words)
                            .padding(12)
                            .background(NeoGymTheme.cardFill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(NeoGymTheme.border))
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Description")
                            .font(.subheadline.weight(.semibold))
                        TextEditor(text: $form.description)
                            .frame(minHeight: 120)
                            .padding(8)
                            .background(NeoGymTheme.cardFill, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(NeoGymTheme.border))
                        Text("Markdown supported for headings, lists, and emphasis.")
                            .font(.caption)
                            .foregroundColor(NeoGymTheme.mutedText)
                    }
                    LabelInputView(form: form, suggestions: labels, disabled: isSubmitting)
                    exerciseRows
                    if let errorMessage {
                        Text(errorMessage)
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                    actions
                }
            }
            .frame(maxWidth: 700)
            .padding(.horizontal, 20)
            .padding(.vertical, 24)
            .frame(maxWidth: .infinity)
        }
        .background(GridBackground())
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $pickerOpen) {
            ExercisePickerView(
                repository: exercisesRepository,
                alreadySelected: form.selectedExerciseIds,
                onConfirm: { picks in
                    form.addExercises(picks)
                    pickerOpen = false
                },
                onCancel: { pickerOpen = false }
            )
        }
    }

    private var exerciseRows: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Exercises")
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text("\(form.exercises.count) added")
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
            }
            if form.exercises.isEmpty {
                AppEmptyStateView(
                    title: "No exercises yet",
                    message: "Add one to get started.",
                    systemImage: "dumbbell"
                )
                .background(NeoGymTheme.mutedFill, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(form.exercises.enumerated()), id: \.element.rowId) { index, exercise in
                        WorkoutFormExerciseRowView(
                            exercise: exercise,
                            index: index,
                            isFirst: index == 0,
                            isLast: index == form.exercises.count - 1,
                            remove: { form.removeExercise(rowId: exercise.rowId) },
                            moveUp: { form.moveExerciseUp(rowId: exercise.rowId) },
                            moveDown: { form.moveExerciseDown(rowId: exercise.rowId) }
                        )
                        if exercise.rowId != form.exercises.last?.rowId { Divider() }
                    }
                }
                .padding(.horizontal, 10)
                .background(NeoGymTheme.cardFill, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(NeoGymTheme.border))
            }
            Button {
                pickerOpen = true
            } label: {
                Label("Add exercise", systemImage: "plus")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(NeoGymSecondaryButtonStyle())
            .disabled(isSubmitting)
        }
    }

    private var actions: some View {
        VStack(spacing: 10) {
            HStack {
                Button("Cancel", action: onCancel)
                    .buttonStyle(NeoGymSecondaryButtonStyle())
                    .disabled(isSubmitting)
                Button(isSubmitting ? "Saving…" : submitLabel, action: onSubmit)
                    .buttonStyle(NeoGymPrimaryButtonStyle())
                    .disabled(isSubmitting || !form.canSubmit)
            }
            if let deleteAction {
                Button(role: .destructive, action: deleteAction) {
                    Label("Delete workout", systemImage: "trash")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(NeoGymSecondaryButtonStyle())
                .disabled(isSubmitting)
            }
        }
    }
}

private struct WorkoutFormExerciseRowView: View {
    let exercise: WorkoutFormExerciseRow
    let index: Int
    let isFirst: Bool
    let isLast: Bool
    let remove: () -> Void
    let moveUp: () -> Void
    let moveDown: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            Text("\(index + 1)")
                .font(.caption.bold())
                .frame(width: 24, height: 24)
                .background(NeoGymTheme.mutedFill, in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text(exercise.name)
                    .font(.subheadline.weight(.semibold))
                Text(
                    ExerciseFormatters.enumValue(exercise.primaryMuscleGroup)
                        + (exercise.doubleWeight ? " · two-handed" : "")
                )
                .font(.caption)
                .foregroundColor(NeoGymTheme.mutedText)
            }
            Spacer()
            Button(action: moveUp) { Image(systemName: "chevron.up") }
                .disabled(isFirst)
            Button(action: moveDown) { Image(systemName: "chevron.down") }
                .disabled(isLast)
            Button(role: .destructive, action: remove) { Image(systemName: "xmark") }
        }
        .buttonStyle(.plain)
        .padding(.vertical, 10)
    }
}

