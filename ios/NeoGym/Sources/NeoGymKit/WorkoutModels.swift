import Foundation

public enum WorkoutVisibilityFilter: String, Sendable, Equatable, CaseIterable {
    case mine
    case `public`
}

public let workoutLabelMaxLength = 64

public struct WorkoutLabel: Decodable, Identifiable, Sendable, Equatable, Hashable {
    public let id: String
    public let name: String

    public init(id: String, name: String) {
        self.id = id
        self.name = name
    }
}

public struct WorkoutLabelLink: Decodable, Identifiable, Sendable, Equatable, Hashable {
    public let labelId: String
    public let label: WorkoutLabel

    public var id: String { labelId }

    public init(labelId: String, label: WorkoutLabel) {
        self.labelId = labelId
        self.label = label
    }
}

public struct WorkoutExerciseCountAggregate: Decodable, Sendable, Equatable, Hashable {
    public struct Aggregate: Decodable, Sendable, Equatable, Hashable {
        public let count: Int

        public init(count: Int) {
            self.count = count
        }
    }

    public let aggregate: Aggregate?

    public init(aggregate: Aggregate?) {
        self.aggregate = aggregate
    }
}

public struct WorkoutListItem: Decodable, Identifiable, Sendable, Equatable, Hashable {
    public let id: String
    public let name: String
    public let description: String?
    public let isPublic: Bool
    public let workoutExercisesAggregate: WorkoutExerciseCountAggregate
    public let workoutLabels: [WorkoutLabelLink]

    public init(
        id: String,
        name: String,
        description: String? = nil,
        isPublic: Bool,
        workoutExercisesAggregate: WorkoutExerciseCountAggregate = WorkoutExerciseCountAggregate(aggregate: nil),
        workoutLabels: [WorkoutLabelLink] = []
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.isPublic = isPublic
        self.workoutExercisesAggregate = workoutExercisesAggregate
        self.workoutLabels = workoutLabels
    }

    public var exerciseCount: Int {
        workoutExercisesAggregate.aggregate?.count ?? 0
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case description
        case isPublic
        case workoutExercisesAggregate = "workoutExercises_aggregate"
        case workoutLabels
    }
}

public struct WorkoutExerciseListExercise: Decodable, Identifiable, Sendable, Equatable, Hashable {
    public let id: String
    public let name: String
    public let strength: ExerciseStrengthSummary?
    public let primaryMuscleGroup: String
    public let image1FileId: String?
    public let image2FileId: String?

    public init(
        id: String,
        name: String,
        strength: ExerciseStrengthSummary? = nil,
        primaryMuscleGroup: String,
        image1FileId: String? = nil,
        image2FileId: String? = nil
    ) {
        self.id = id
        self.name = name
        self.strength = strength
        self.primaryMuscleGroup = primaryMuscleGroup
        self.image1FileId = image1FileId
        self.image2FileId = image2FileId
    }
}

public struct WorkoutExerciseRow: Decodable, Identifiable, Sendable, Equatable, Hashable {
    public let id: String
    public let position: Int
    public let exercise: WorkoutExerciseListExercise

    public init(id: String, position: Int, exercise: WorkoutExerciseListExercise) {
        self.id = id
        self.position = position
        self.exercise = exercise
    }
}

public struct WorkoutDetailModel: Decodable, Identifiable, Sendable, Equatable, Hashable {
    public let id: String
    public let name: String
    public let description: String?
    public let isPublic: Bool
    public let userId: String?
    public let workoutExercises: [WorkoutExerciseRow]
    public let workoutLabels: [WorkoutLabelLink]

    public init(
        id: String,
        name: String,
        description: String? = nil,
        isPublic: Bool,
        userId: String? = nil,
        workoutExercises: [WorkoutExerciseRow] = [],
        workoutLabels: [WorkoutLabelLink] = []
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.isPublic = isPublic
        self.userId = userId
        self.workoutExercises = workoutExercises
        self.workoutLabels = workoutLabels
    }

    public func canEdit(currentUserId: String?) -> Bool {
        guard let currentUserId else { return false }
        return userId == currentUserId && !isPublic
    }
}

public struct WorkoutIndexPayload: Sendable, Equatable {
    public let workouts: [WorkoutListItem]
    public let labels: [WorkoutLabel]

    public init(workouts: [WorkoutListItem], labels: [WorkoutLabel]) {
        self.workouts = workouts
        self.labels = labels
    }
}

public struct WorkoutEditPayload: Sendable, Equatable {
    public let workout: WorkoutDetailModel?
    public let labels: [WorkoutLabel]

    public init(workout: WorkoutDetailModel?, labels: [WorkoutLabel]) {
        self.workout = workout
        self.labels = labels
    }
}

public struct WorkoutFormExerciseRow: Identifiable, Sendable, Equatable, Hashable {
    public let rowId: String
    public let exerciseId: String
    public let name: String
    public let primaryMuscleGroup: String
    public let doubleWeight: Bool

    public var id: String { rowId }

    public init(
        rowId: String,
        exerciseId: String,
        name: String,
        primaryMuscleGroup: String,
        doubleWeight: Bool
    ) {
        self.rowId = rowId
        self.exerciseId = exerciseId
        self.name = name
        self.primaryMuscleGroup = primaryMuscleGroup
        self.doubleWeight = doubleWeight
    }
}

public struct WorkoutLabelSelection: Identifiable, Sendable, Equatable, Hashable {
    public let id: String?
    public let name: String

    public var stableId: String { id ?? name }

    public init(id: String? = nil, name: String) {
        self.id = id
        self.name = name
    }
}

public struct WorkoutFormValues: Sendable, Equatable {
    public let name: String
    public let description: String
    public let exercises: [WorkoutFormExerciseRow]
    public let labels: [WorkoutLabelSelection]

    public init(
        name: String,
        description: String,
        exercises: [WorkoutFormExerciseRow],
        labels: [WorkoutLabelSelection]
    ) {
        self.name = name
        self.description = description
        self.exercises = exercises
        self.labels = labels
    }
}

public enum WorkoutLabelNormalizer {
    public static func normalize(_ raw: String) -> String {
        raw.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .lowercased()
    }
}

public extension WorkoutFormExerciseRow {
    init(row: WorkoutExerciseRow) {
        self.init(
            rowId: row.id,
            exerciseId: row.exercise.id,
            name: row.exercise.name,
            primaryMuscleGroup: row.exercise.primaryMuscleGroup,
            doubleWeight: row.exercise.strength?.doubleWeight ?? false
        )
    }

    init(pickerExercise: ExerciseListItem, rowId: String) {
        self.init(
            rowId: rowId,
            exerciseId: pickerExercise.id,
            name: pickerExercise.name,
            primaryMuscleGroup: pickerExercise.primaryMuscleGroup,
            doubleWeight: pickerExercise.strength?.doubleWeight ?? false
        )
    }
}
