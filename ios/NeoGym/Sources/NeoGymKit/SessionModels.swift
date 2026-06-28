import Foundation

public struct SessionWorkout: Decodable, Identifiable, Sendable, Equatable, Hashable {
    public let id: String
    public let name: String

    public init(id: String, name: String) {
        self.id = id
        self.name = name
    }
}

public struct SessionCountAggregate: Decodable, Sendable, Equatable, Hashable {
    public struct Aggregate: Decodable, Sendable, Equatable, Hashable {
        public let count: Int

        public init(count: Int) {
            self.count = count
        }
    }

    public let aggregate: Aggregate?

    public init(aggregate: Aggregate? = nil) {
        self.aggregate = aggregate
    }
}

public struct SessionStrengthSetsAggregate: Decodable, Sendable, Equatable, Hashable {
    public struct Sum: Decodable, Sendable, Equatable, Hashable {
        public let reps: Int?

        public init(reps: Int? = nil) {
            self.reps = reps
        }
    }

    public struct Aggregate: Decodable, Sendable, Equatable, Hashable {
        public let count: Int
        public let sum: Sum?

        public init(count: Int, sum: Sum? = nil) {
            self.count = count
            self.sum = sum
        }
    }

    public let aggregate: Aggregate?

    public init(aggregate: Aggregate? = nil) {
        self.aggregate = aggregate
    }
}

public struct SessionListExercise: Decodable, Identifiable, Sendable, Equatable, Hashable {
    public let id: String
    public let name: String

    public init(id: String, name: String) {
        self.id = id
        self.name = name
    }
}

public struct SessionListExerciseRow: Decodable, Sendable, Equatable, Hashable {
    public let exercise: SessionListExercise
    public let workoutSessionStrengthSetsAggregate: SessionStrengthSetsAggregate
    public let workoutSessionCardioEntriesAggregate: SessionCountAggregate

    public init(
        exercise: SessionListExercise,
        workoutSessionStrengthSetsAggregate: SessionStrengthSetsAggregate = SessionStrengthSetsAggregate(),
        workoutSessionCardioEntriesAggregate: SessionCountAggregate = SessionCountAggregate()
    ) {
        self.exercise = exercise
        self.workoutSessionStrengthSetsAggregate = workoutSessionStrengthSetsAggregate
        self.workoutSessionCardioEntriesAggregate = workoutSessionCardioEntriesAggregate
    }

    private enum CodingKeys: String, CodingKey {
        case exercise
        case workoutSessionStrengthSetsAggregate = "workoutSessionStrengthSets_aggregate"
        case workoutSessionCardioEntriesAggregate = "workoutSessionCardioEntries_aggregate"
    }
}

public struct SessionListItem: Decodable, Identifiable, Sendable, Equatable, Hashable {
    public let id: String
    public let startedAt: String
    public let workout: SessionWorkout?
    public let workoutSessionExercisesAggregate: SessionCountAggregate
    public let workoutSessionExercises: [SessionListExerciseRow]

    public init(
        id: String,
        startedAt: String,
        workout: SessionWorkout? = nil,
        workoutSessionExercisesAggregate: SessionCountAggregate = SessionCountAggregate(),
        workoutSessionExercises: [SessionListExerciseRow] = []
    ) {
        self.id = id
        self.startedAt = startedAt
        self.workout = workout
        self.workoutSessionExercisesAggregate = workoutSessionExercisesAggregate
        self.workoutSessionExercises = workoutSessionExercises
    }

    public var startedAtDate: Date? { ExerciseDateParser.parseTimestamp(startedAt) }

    public var displayName: String {
        SessionDisplayName.make(
            workoutName: workout?.name,
            exerciseNames: workoutSessionExercises.map(\.exercise.name)
        )
    }

    public var exerciseCount: Int {
        workoutSessionExercisesAggregate.aggregate?.count ?? workoutSessionExercises.count
    }

    public var entryCount: Int {
        workoutSessionExercises.reduce(0) { total, row in
            total
                + (row.workoutSessionStrengthSetsAggregate.aggregate?.count ?? 0)
                + (row.workoutSessionCardioEntriesAggregate.aggregate?.count ?? 0)
        }
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case startedAt
        case workout
        case workoutSessionExercisesAggregate = "workoutSessionExercises_aggregate"
        case workoutSessionExercises
    }
}

public struct SessionExerciseDetail: Decodable, Identifiable, Sendable, Equatable {
    public let id: String
    public let name: String
    public let kind: String
    public let primaryMuscleGroup: String
    public let image1FileId: String?
    public let image2FileId: String?
    public let strength: ExerciseStrengthSummary?
    public let cardio: ExerciseCardioDetail?

    public init(
        id: String,
        name: String,
        kind: String,
        primaryMuscleGroup: String,
        image1FileId: String? = nil,
        image2FileId: String? = nil,
        strength: ExerciseStrengthSummary? = nil,
        cardio: ExerciseCardioDetail? = nil
    ) {
        self.id = id
        self.name = name
        self.kind = kind
        self.primaryMuscleGroup = primaryMuscleGroup
        self.image1FileId = image1FileId
        self.image2FileId = image2FileId
        self.strength = strength
        self.cardio = cardio
    }

    public var isCardio: Bool { kind == "cardio" }
    public var doubleWeight: Bool { strength?.doubleWeight ?? false }
    public var cardioSchema: CardioMetricsSchema? {
        guard let cardio else { return nil }
        return CardioMetricsSchemaHelpers.asSchema(cardio.metricsSchema)
    }
}

public struct SessionStrengthSet: Decodable, Identifiable, Sendable, Equatable, Hashable {
    public let id: String
    public let setNumber: Int
    public let reps: Int
    public let weight: Double

    public init(id: String, setNumber: Int, reps: Int, weight: Double) {
        self.id = id
        self.setNumber = setNumber
        self.reps = reps
        self.weight = weight
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case setNumber
        case reps
        case weight
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        setNumber = try container.decode(Int.self, forKey: .setNumber)
        reps = try container.decode(Int.self, forKey: .reps)
        weight = try container.decodeSessionFlexibleDouble(forKey: .weight)
    }

    public var volume: Double { weight * Double(reps) }
}

public struct SessionCardioEntryShell: Decodable, Identifiable, Sendable, Equatable {
    public let id: String
    public let entryNumber: Int
    public let metrics: CardioMetrics

    public init(id: String, entryNumber: Int, metrics: CardioMetrics = [:]) {
        self.id = id
        self.entryNumber = entryNumber
        self.metrics = metrics
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case entryNumber
        case metrics
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        entryNumber = try container.decode(Int.self, forKey: .entryNumber)
        let raw = try container.decode(JSONValue.self, forKey: .metrics)
        metrics = ExerciseJSONMetrics.decode(raw)
    }
}

public struct SessionPriorWorkoutSession: Decodable, Identifiable, Sendable, Equatable, Hashable {
    public let id: String
    public let startedAt: String

    public init(id: String, startedAt: String) {
        self.id = id
        self.startedAt = startedAt
    }

    public var startedAtDate: Date? { ExerciseDateParser.parseTimestamp(startedAt) }
}

public struct SessionPriorWorkoutSessionExercise: Decodable, Identifiable, Sendable, Equatable {
    public let id: String
    public let workoutSession: SessionPriorWorkoutSession
    public let workoutSessionStrengthSets: [SessionStrengthSet]
    public let workoutSessionCardioEntries: [SessionCardioEntryShell]

    public init(
        id: String,
        workoutSession: SessionPriorWorkoutSession,
        workoutSessionStrengthSets: [SessionStrengthSet] = [],
        workoutSessionCardioEntries: [SessionCardioEntryShell] = []
    ) {
        self.id = id
        self.workoutSession = workoutSession
        self.workoutSessionStrengthSets = workoutSessionStrengthSets
        self.workoutSessionCardioEntries = workoutSessionCardioEntries
    }
}

public struct SessionPriorExerciseHistory: Decodable, Identifiable, Sendable, Equatable {
    public let id: String
    public let workoutSessionExercises: [SessionPriorWorkoutSessionExercise]

    public init(id: String, workoutSessionExercises: [SessionPriorWorkoutSessionExercise] = []) {
        self.id = id
        self.workoutSessionExercises = workoutSessionExercises
    }
}

public struct SessionPriorStrengthEntry: Identifiable, Sendable, Equatable {
    public let id: String
    public let startedAt: String
    public let sets: [SessionStrengthSet]

    public init(id: String, startedAt: String, sets: [SessionStrengthSet]) {
        self.id = id
        self.startedAt = startedAt
        self.sets = sets
    }
}

public struct SessionPriorCardioEntry: Identifiable, Sendable, Equatable {
    public let id: String
    public let startedAt: String
    public let entries: [SessionCardioEntryShell]

    public init(id: String, startedAt: String, entries: [SessionCardioEntryShell]) {
        self.id = id
        self.startedAt = startedAt
        self.entries = entries
    }
}

public struct SessionPriorHistory: Sendable, Equatable {
    public let exercises: [SessionPriorExerciseHistory]

    public init(exercises: [SessionPriorExerciseHistory] = []) {
        self.exercises = exercises
    }

    public var strengthByExercise: [String: [SessionPriorStrengthEntry]] {
        Dictionary(uniqueKeysWithValues: exercises.map { exercise in
            (
                exercise.id,
                exercise.workoutSessionExercises.map { row in
                    SessionPriorStrengthEntry(
                        id: row.id,
                        startedAt: row.workoutSession.startedAt,
                        sets: row.workoutSessionStrengthSets
                    )
                }
            )
        })
    }

    public var cardioByExercise: [String: [SessionPriorCardioEntry]] {
        Dictionary(uniqueKeysWithValues: exercises.map { exercise in
            (
                exercise.id,
                exercise.workoutSessionExercises.map { row in
                    SessionPriorCardioEntry(
                        id: row.id,
                        startedAt: row.workoutSession.startedAt,
                        entries: row.workoutSessionCardioEntries
                    )
                }
            )
        })
    }
}

public struct SessionExerciseRow: Decodable, Identifiable, Sendable, Equatable {
    public let id: String
    public let position: Int
    public let exercise: SessionExerciseDetail
    public let workoutSessionStrengthSets: [SessionStrengthSet]
    public let workoutSessionCardioEntries: [SessionCardioEntryShell]

    public init(
        id: String,
        position: Int,
        exercise: SessionExerciseDetail,
        workoutSessionStrengthSets: [SessionStrengthSet] = [],
        workoutSessionCardioEntries: [SessionCardioEntryShell] = []
    ) {
        self.id = id
        self.position = position
        self.exercise = exercise
        self.workoutSessionStrengthSets = workoutSessionStrengthSets
        self.workoutSessionCardioEntries = workoutSessionCardioEntries
    }
}

public struct SessionDetailModel: Decodable, Identifiable, Sendable, Equatable {
    public let id: String
    public let startedAt: String
    public let workout: SessionWorkout?
    public let workoutSessionExercises: [SessionExerciseRow]

    public init(
        id: String,
        startedAt: String,
        workout: SessionWorkout? = nil,
        workoutSessionExercises: [SessionExerciseRow] = []
    ) {
        self.id = id
        self.startedAt = startedAt
        self.workout = workout
        self.workoutSessionExercises = workoutSessionExercises
    }

    public var startedAtDate: Date? { ExerciseDateParser.parseTimestamp(startedAt) }

    public var displayName: String {
        SessionDisplayName.make(
            workoutName: workout?.name,
            exerciseNames: workoutSessionExercises.map(\.exercise.name)
        )
    }

    public var maxPosition: Int {
        workoutSessionExercises.map(\.position).max() ?? 0
    }

    public var strengthTotals: SessionStrengthTotals {
        var sets = 0
        var reps = 0
        var volume = 0.0
        var hasStrength = false
        for row in workoutSessionExercises where !row.exercise.isCardio {
            hasStrength = true
            let multiplier = row.exercise.doubleWeight ? 2.0 : 1.0
            for set in row.workoutSessionStrengthSets {
                sets += 1
                reps += set.reps
                volume += set.volume * multiplier
            }
        }
        return SessionStrengthTotals(sets: sets, reps: reps, volume: volume, hasStrength: hasStrength)
    }
}

public struct SessionStrengthTotals: Sendable, Equatable, Hashable {
    public let sets: Int
    public let reps: Int
    public let volume: Double
    public let hasStrength: Bool

    public init(sets: Int, reps: Int, volume: Double, hasStrength: Bool) {
        self.sets = sets
        self.reps = reps
        self.volume = volume
        self.hasStrength = hasStrength
    }
}

private extension KeyedDecodingContainer {
    func decodeSessionFlexibleDouble(forKey key: Key) throws -> Double {
        if let double = try? decode(Double.self, forKey: key) {
            return double
        }
        if let int = try? decode(Int.self, forKey: key) {
            return Double(int)
        }
        if let string = try? decode(String.self, forKey: key), let double = Double(string) {
            return double
        }
        throw DecodingError.dataCorruptedError(forKey: key, in: self, debugDescription: "Expected numeric value")
    }
}
