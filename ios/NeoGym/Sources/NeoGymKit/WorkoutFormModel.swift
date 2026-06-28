import Combine
import Foundation

@MainActor
public final class WorkoutFormModel: ObservableObject {
    @Published public var name: String
    @Published public var description: String
    @Published public var exercises: [WorkoutFormExerciseRow]
    @Published public var labels: [WorkoutLabelSelection]
    @Published public private(set) var errorMessage: String?

    private let rowId: @Sendable () -> String

    public init(
        initialValues: WorkoutFormValues,
        rowId: @escaping @Sendable () -> String = { "new-\(UUID().uuidString.lowercased())" }
    ) {
        name = initialValues.name
        description = initialValues.description
        exercises = initialValues.exercises
        labels = initialValues.labels
        self.rowId = rowId
    }

    public var trimmedName: String {
        name.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    public var trimmedDescription: String {
        description.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    public var selectedExerciseIds: Set<String> {
        Set(exercises.map(\.exerciseId))
    }

    public var canSubmit: Bool {
        !trimmedName.isEmpty && trimmedName.count <= 120
    }

    public func valuesForSubmit() -> WorkoutFormValues? {
        guard canSubmit else {
            errorMessage = trimmedName.isEmpty ? "Name is required." : "Name must be 120 characters or less."
            return nil
        }
        errorMessage = nil
        return WorkoutFormValues(
            name: trimmedName,
            description: trimmedDescription,
            exercises: exercises,
            labels: labels
        )
    }

    public func addExercises(_ picks: [ExerciseListItem]) {
        var seen = selectedExerciseIds
        for pick in picks where !seen.contains(pick.id) {
            seen.insert(pick.id)
            exercises.append(WorkoutFormExerciseRow(pickerExercise: pick, rowId: rowId()))
        }
    }

    public func removeExercise(rowId: String) {
        exercises.removeAll { $0.rowId == rowId }
    }

    public func moveExercise(from source: Int, to destination: Int) {
        guard source >= 0, source < exercises.count else { return }
        let boundedDestination = min(max(destination, 0), exercises.count - 1)
        guard source != boundedDestination else { return }
        let item = exercises.remove(at: source)
        exercises.insert(item, at: boundedDestination)
    }

    public func moveExerciseUp(rowId: String) {
        guard let index = exercises.firstIndex(where: { $0.rowId == rowId }), index > 0 else { return }
        moveExercise(from: index, to: index - 1)
    }

    public func moveExerciseDown(rowId: String) {
        guard let index = exercises.firstIndex(where: { $0.rowId == rowId }), index < exercises.count - 1 else { return }
        moveExercise(from: index, to: index + 1)
    }

    public func commitLabel(_ raw: String, suggestions: [WorkoutLabel]) {
        let normalized = WorkoutLabelNormalizer.normalize(raw)
        guard !normalized.isEmpty, normalized.count <= workoutLabelMaxLength else { return }
        guard !labels.contains(where: { $0.name == normalized }) else { return }
        if let existing = suggestions.first(where: { $0.name == normalized }) {
            labels.append(WorkoutLabelSelection(id: existing.id, name: existing.name))
        } else {
            labels.append(WorkoutLabelSelection(name: normalized))
        }
    }

    public func addLabel(_ selection: WorkoutLabelSelection) {
        guard !labels.contains(where: { $0.name == selection.name }) else { return }
        labels.append(selection)
    }

    public func removeLabel(name: String) {
        labels.removeAll { $0.name == name }
    }

    nonisolated public static func values(from workout: WorkoutDetailModel) -> WorkoutFormValues {
        WorkoutFormValues(
            name: workout.name,
            description: workout.description ?? "",
            exercises: workout.workoutExercises.map(WorkoutFormExerciseRow.init(row:)),
            labels: workout.workoutLabels.map { link in
                WorkoutLabelSelection(id: link.label.id, name: link.label.name)
            }
        )
    }
}
