import Foundation

/// One bar of Workout detail's "Volume by session" chart.
public struct WorkoutVolumeBar: Identifiable, Sendable, Equatable {
    public let id: String
    public let startedAt: String
    public let volume: Double

    public init(id: String, startedAt: String, volume: Double) {
        self.id = id
        self.startedAt = startedAt
        self.volume = volume
    }

    public var startedAtDate: Date? { ExerciseDateParser.parseTimestamp(startedAt) }
}

/// History shown on Workout detail: strength volume for the workout's latest
/// sessions (oldest first) and each exercise's last top set ("140 × 7").
public struct WorkoutDetailInsights: Sendable, Equatable {
    public let volumeBars: [WorkoutVolumeBar]
    public let lastTopSetByExercise: [String: String]

    public init(volumeBars: [WorkoutVolumeBar] = [], lastTopSetByExercise: [String: String] = [:]) {
        self.volumeBars = volumeBars
        self.lastTopSetByExercise = lastTopSetByExercise
    }

    /// Heaviest set, then most reps at that weight; bodyweight reads "BW".
    public static func topSetLabel(_ sets: [SessionStrengthSet], locale: Locale = .current) -> String? {
        guard let best = sets.max(by: { left, right in
            left.weight == right.weight ? left.reps < right.reps : left.weight < right.weight
        }) else { return nil }
        let weight = best.weight == 0
            ? "BW" : best.weight.formatted(.number.precision(.fractionLength(0 ... 2)).locale(locale))
        return "\(weight) × \(best.reps)"
    }

    /// The report's local-day window: the last 366 inclusive local dates.
    public static func reportDays(today: Date, calendar: Calendar) -> (from: String, through: String) {
        let start = calendar.date(byAdding: .day, value: -365, to: today) ?? today
        return (
            DateOnly.formatLocalISO(start, calendar: calendar),
            DateOnly.formatLocalISO(today, calendar: calendar)
        )
    }
}

public extension WorkoutsRepository {
    /// Volume comes from the owner-filtered `workoutStrengthReport` root (same
    /// local-day contract as the web); last sets from each exercise's latest
    /// logged strength occurrence in any session.
    func workoutDetailInsights(
        workoutId: String, exerciseIds: [String], today: Date
    ) async throws -> WorkoutDetailInsights {
        try await workoutDetailInsights(workoutId: workoutId, exerciseIds: exerciseIds, today: today, calendar: .current)
    }

    func workoutDetailInsights(
        workoutId: String,
        exerciseIds: [String],
        today: Date,
        calendar: Calendar
    ) async throws -> WorkoutDetailInsights {
        let days = WorkoutDetailInsights.reportDays(today: today, calendar: calendar)
        let data: WorkoutDetailInsightsData = try await graphQL.execute(
            query: Self.workoutDetailInsightsQuery,
            variables: [
                "id": GraphQLScalars.uuid(workoutId),
                "from": GraphQLScalars.date(days.from),
                "through": GraphQLScalars.date(days.through),
                "timeZone": .string(calendar.timeZone.identifier),
                "exerciseIds": .array(exerciseIds.map { GraphQLScalars.uuid($0) })
            ],
            operationName: "WorkoutDetailInsights"
        )
        let bars = data.workoutStrengthReport.reversed().map {
            WorkoutVolumeBar(id: $0.sessionId, startedAt: $0.startedAt, volume: $0.volume)
        }
        var lastTopSet: [String: String] = [:]
        for exercise in data.exercises {
            if let sets = exercise.workoutSessionExercises.first?.workoutSessionStrengthSets,
               let label = WorkoutDetailInsights.topSetLabel(sets) {
                lastTopSet[exercise.id] = label
            }
        }
        return WorkoutDetailInsights(volumeBars: Array(bars), lastTopSetByExercise: lastTopSet)
    }

    static let workoutDetailInsightsQuery = """
    query WorkoutDetailInsights(
      $id: uuid!
      $from: date!
      $through: date!
      $timeZone: String!
      $exerciseIds: [uuid!]!
    ) {
      workoutStrengthReport(
        args: { workout_id: $id, from_day: $from, through_day: $through, time_zone: $timeZone }
        where: { volume: { _gt: 0 } }
        order_by: { startedAt: desc }
        limit: 4
      ) {
        sessionId
        startedAt
        volume
      }
      exercises(where: { id: { _in: $exerciseIds } }) {
        id
        workoutSessionExercises(
          where: { workoutSessionStrengthSets: {} }
          order_by: { workoutSession: { startedAt: desc } }
          limit: 1
        ) {
          id
          workoutSessionStrengthSets(order_by: { setNumber: asc }) {
            id
            setNumber
            reps
            weight
          }
        }
      }
    }
    """
}

private struct WorkoutDetailInsightsData: Decodable, Sendable {
    struct ReportRow: Decodable, Sendable {
        let sessionId: String
        let startedAt: String
        let volume: Double

        private enum CodingKeys: String, CodingKey {
            case sessionId, startedAt, volume
        }

        init(from decoder: Decoder) throws {
            let container = try decoder.container(keyedBy: CodingKeys.self)
            sessionId = try container.decode(String.self, forKey: .sessionId)
            startedAt = try container.decode(String.self, forKey: .startedAt)
            volume = try container.decodeFlexibleDouble(forKey: .volume)
        }
    }

    struct Exercise: Decodable, Sendable {
        struct Occurrence: Decodable, Sendable {
            let workoutSessionStrengthSets: [SessionStrengthSet]
        }

        let id: String
        let workoutSessionExercises: [Occurrence]
    }

    let workoutStrengthReport: [ReportRow]
    let exercises: [Exercise]
}
