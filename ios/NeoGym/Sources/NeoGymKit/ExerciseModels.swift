import Foundation

public enum ExerciseVisibilityFilter: String, Sendable, Equatable, CaseIterable {
    case mine
    case `public`
}

public enum ExerciseFilterKey: String, Sendable, Equatable, CaseIterable {
    case muscle
    case category
    case equipment
    case level

    public var title: String {
        switch self {
        case .muscle: "Muscle"
        case .category: "Category"
        case .equipment: "Equipment"
        case .level: "Level"
        }
    }
}

public typealias ExerciseFilters = [ExerciseFilterKey: String]

public struct ExerciseSecondaryMuscle: Decodable, Sendable, Equatable, Hashable {
    public let muscleGroup: String

    public init(muscleGroup: String) {
        self.muscleGroup = muscleGroup
    }
}

public struct ExerciseStrengthSummary: Decodable, Sendable, Equatable, Hashable {
    public let doubleWeight: Bool

    public init(doubleWeight: Bool) {
        self.doubleWeight = doubleWeight
    }
}

public struct ExerciseListItem: Decodable, Identifiable, Sendable, Equatable, Hashable {
    public let id: String
    public let name: String
    public let strength: ExerciseStrengthSummary?
    public let primaryMuscleGroup: String
    public let category: String?
    public let equipment: String?
    public let level: String?
    public let isPublic: Bool
    public let secondaryMuscleGroups: [ExerciseSecondaryMuscle]

    public init(
        id: String,
        name: String,
        strength: ExerciseStrengthSummary? = nil,
        primaryMuscleGroup: String,
        category: String? = nil,
        equipment: String? = nil,
        level: String? = nil,
        isPublic: Bool,
        secondaryMuscleGroups: [ExerciseSecondaryMuscle] = []
    ) {
        self.id = id
        self.name = name
        self.strength = strength
        self.primaryMuscleGroup = primaryMuscleGroup
        self.category = category
        self.equipment = equipment
        self.level = level
        self.isPublic = isPublic
        self.secondaryMuscleGroups = secondaryMuscleGroups
    }
}

public struct ExerciseStrengthDetail: Decodable, Sendable, Equatable, Hashable {
    public let doubleWeight: Bool
    public let force: String?
    public let mechanic: String?

    public init(doubleWeight: Bool, force: String? = nil, mechanic: String? = nil) {
        self.doubleWeight = doubleWeight
        self.force = force
        self.mechanic = mechanic
    }
}

public struct ExerciseCardioDetail: Decodable, Sendable, Equatable {
    public let metricsSchema: JSONValue

    public init(metricsSchema: JSONValue) {
        self.metricsSchema = metricsSchema
    }
}

public struct ExerciseDetailModel: Decodable, Identifiable, Sendable, Equatable {
    public let id: String
    public let name: String
    public let instructions: [String]
    public let image1FileId: String?
    public let image2FileId: String?
    public let level: String?
    public let category: String?
    public let kind: String?
    public let equipment: String?
    public let primaryMuscleGroup: String
    public let isPublic: Bool
    public let strength: ExerciseStrengthDetail?
    public let cardio: ExerciseCardioDetail?
    public let secondaryMuscleGroups: [ExerciseSecondaryMuscle]
    public let workoutSessionExercises: [ExerciseHistoryEntry]

    public init(
        id: String,
        name: String,
        instructions: [String] = [],
        image1FileId: String? = nil,
        image2FileId: String? = nil,
        level: String? = nil,
        category: String? = nil,
        kind: String? = nil,
        equipment: String? = nil,
        primaryMuscleGroup: String,
        isPublic: Bool,
        strength: ExerciseStrengthDetail? = nil,
        cardio: ExerciseCardioDetail? = nil,
        secondaryMuscleGroups: [ExerciseSecondaryMuscle] = [],
        workoutSessionExercises: [ExerciseHistoryEntry] = []
    ) {
        self.id = id
        self.name = name
        self.instructions = instructions
        self.image1FileId = image1FileId
        self.image2FileId = image2FileId
        self.level = level
        self.category = category
        self.kind = kind
        self.equipment = equipment
        self.primaryMuscleGroup = primaryMuscleGroup
        self.isPublic = isPublic
        self.strength = strength
        self.cardio = cardio
        self.secondaryMuscleGroups = secondaryMuscleGroups
        self.workoutSessionExercises = workoutSessionExercises
    }

    public var isCardio: Bool { kind == "cardio" }
    public var cardioSchema: CardioMetricsSchema? {
        guard let cardio else { return nil }
        return CardioMetricsSchemaHelpers.asSchema(cardio.metricsSchema)
    }
}

public struct ExerciseHistoryEntry: Decodable, Identifiable, Sendable, Equatable {
    public let id: String
    public let workoutSession: ExerciseHistorySession
    public let workoutSessionStrengthSets: [ExerciseStrengthSet]
    public let workoutSessionCardioEntries: [ExerciseCardioEntry]

    public init(
        id: String,
        workoutSession: ExerciseHistorySession,
        workoutSessionStrengthSets: [ExerciseStrengthSet] = [],
        workoutSessionCardioEntries: [ExerciseCardioEntry] = []
    ) {
        self.id = id
        self.workoutSession = workoutSession
        self.workoutSessionStrengthSets = workoutSessionStrengthSets
        self.workoutSessionCardioEntries = workoutSessionCardioEntries
    }
}

public struct ExerciseHistorySession: Decodable, Identifiable, Sendable, Equatable {
    public let id: String
    public let startedAt: String
    public let workout: ExerciseHistoryWorkout?

    public init(id: String, startedAt: String, workout: ExerciseHistoryWorkout? = nil) {
        self.id = id
        self.startedAt = startedAt
        self.workout = workout
    }

    public var startedAtDate: Date? {
        ExerciseDateParser.parseTimestamp(startedAt)
    }
}

public struct ExerciseHistoryWorkout: Decodable, Identifiable, Sendable, Equatable {
    public let id: String
    public let name: String

    public init(id: String, name: String) {
        self.id = id
        self.name = name
    }
}

public struct ExerciseStrengthSet: Decodable, Identifiable, Sendable, Equatable {
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
        weight = try container.decodeFlexibleDouble(forKey: .weight)
    }
}

public struct ExerciseCardioEntry: Decodable, Identifiable, Sendable, Equatable {
    public let id: String
    public let entryNumber: Int
    public let metrics: CardioMetrics

    public init(id: String, entryNumber: Int, metrics: CardioMetrics) {
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

public struct StrengthProgressPoint: Sendable, Equatable {
    public let date: Date
    public let volume: Double
    public let oneRepMax: Double

    public init(date: Date, volume: Double, oneRepMax: Double) {
        self.date = date
        self.volume = volume
        self.oneRepMax = oneRepMax
    }
}

public struct CardioProgressPoint: Sendable, Equatable {
    public let date: Date
    public let value: Double

    public init(date: Date, value: Double) {
        self.date = date
        self.value = value
    }
}

public enum ExerciseFormatters {
    public static func enumValue(_ value: String) -> String {
        value.split(separator: "_")
            .map { part in
                guard let first = part.first else { return "" }
                return first.uppercased() + part.dropFirst().lowercased()
            }
            .joined(separator: " ")
    }
}

public enum ExerciseProgressBuilder {
    public static func sortedHistory(_ entries: [ExerciseHistoryEntry]) -> [ExerciseHistoryEntry] {
        entries.sorted { left, right in
            let leftDate = left.workoutSession.startedAtDate ?? .distantPast
            let rightDate = right.workoutSession.startedAtDate ?? .distantPast
            return leftDate > rightDate
        }
    }

    public static func strengthPoints(entries: [ExerciseHistoryEntry], doubleWeight: Bool) -> [StrengthProgressPoint] {
        var points: [StrengthProgressPoint] = []
        for entry in entries {
            guard let date = entry.workoutSession.startedAtDate,
                  !entry.workoutSessionStrengthSets.isEmpty
            else { continue }

            var volume = 0.0
            var oneRepMax = 0.0
            for set in entry.workoutSessionStrengthSets where set.reps > 0 {
                volume += set.weight * Double(set.reps)
                oneRepMax = max(oneRepMax, set.weight * (1 + Double(set.reps) / 30))
            }
            if doubleWeight {
                volume *= 2
            }
            points.append(StrengthProgressPoint(date: date, volume: volume, oneRepMax: oneRepMax))
        }
        return points.sorted { $0.date < $1.date }
    }

    public static func cardioPoints(
        entries: [ExerciseHistoryEntry],
        primary: CardioMetricSpec
    ) -> [CardioProgressPoint] {
        let aggregation = CardioMetricsSchemaHelpers.aggregation(for: primary.format)
        var points: [CardioProgressPoint] = []
        for entry in entries {
            guard let date = entry.workoutSession.startedAtDate else { continue }
            var total = 0.0
            var seen = 0
            for cardioEntry in entry.workoutSessionCardioEntries {
                guard let value = cardioEntry.metrics[primary.key], value.isFinite else { continue }
                total += value
                seen += 1
            }
            guard seen > 0 else { continue }
            points.append(
                CardioProgressPoint(date: date, value: aggregation == .average ? total / Double(seen) : total)
            )
        }
        return points.sorted { $0.date < $1.date }
    }
}

public enum ExerciseJSONMetrics {
    public static func decode(_ raw: JSONValue) -> CardioMetrics {
        guard case let .object(object) = raw else { return [:] }
        return Dictionary(uniqueKeysWithValues: object.compactMap { key, value in
            guard let number = value.numberValue, number.isFinite else { return nil }
            return (key, number)
        })
    }
}

public enum ExerciseDateParser {
    public static func parseTimestamp(_ value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: value) { return date }

        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: value)
    }
}

private extension KeyedDecodingContainer {
    func decodeFlexibleDouble(forKey key: Key) throws -> Double {
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
