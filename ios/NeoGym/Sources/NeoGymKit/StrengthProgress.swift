import Foundation

/// One server-aggregated exercise/session point, never individual strength sets.
public struct StrengthProgressRow: Decodable, Identifiable, Sendable, Equatable {
    public let exerciseId: String
    public let sessionId: String
    public let startedAt: String
    public let exerciseName: String
    public let volume: Double
    public let estimatedOneRepMax: Double?
    public var id: String { "\(sessionId)-\(exerciseId)" }
    // Parse once, rather than allocating formatters during sorting/chart rendering.
    public let date: Date?

    public init(
        exerciseId: String, sessionId: String, startedAt: String, exerciseName: String,
        volume: Double, estimatedOneRepMax: Double?
    ) {
        self.exerciseId = exerciseId
        self.sessionId = sessionId
        self.startedAt = startedAt
        self.date = ExerciseDateParser.parseTimestamp(startedAt)
        self.exerciseName = exerciseName
        self.volume = volume
        self.estimatedOneRepMax = estimatedOneRepMax
    }

    private enum CodingKeys: String, CodingKey {
        case exerciseId, sessionId, startedAt, exercise, volume, estimatedOneRepMax
    }
    private struct ExerciseName: Decodable { let name: String }

    public init(from decoder: Decoder) throws {
        let values = try decoder.container(keyedBy: CodingKeys.self)
        exerciseId = try values.decode(String.self, forKey: .exerciseId)
        sessionId = try values.decode(String.self, forKey: .sessionId)
        startedAt = try values.decode(String.self, forKey: .startedAt)
        date = ExerciseDateParser.parseTimestamp(startedAt)
        exerciseName = try values.decodeIfPresent(ExerciseName.self, forKey: .exercise)?.name ?? "Unavailable exercise"
        volume = try values.decodeFlexibleDouble(forKey: .volume)
        estimatedOneRepMax = try values.decodeNil(forKey: .estimatedOneRepMax)
            ? nil : values.decodeFlexibleDouble(forKey: .estimatedOneRepMax)
    }
}

public struct StrengthWeeklyVolume: Identifiable, Sendable, Equatable {
    public let weekStart: Date
    public let volume: Double
    public var id: Date { weekStart }
}

public struct StrengthExerciseTrend: Identifiable, Sendable, Equatable {
    public let id: String
    public let name: String
    public let points: [StrengthProgressRow]
}

public struct StrengthProgress: Sendable, Equatable {
    public let weeklyVolume: [StrengthWeeklyVolume]
    public let recentExercises: [StrengthExerciseTrend]
}

public enum StrengthProgressBuilder {
    public static func build(
        rows: [StrengthProgressRow], now: Date = Date(), calendar: Calendar = .current
    ) -> StrengthProgress {
        let today = calendar.startOfDay(for: now)
        let recentStart = calendar.date(byAdding: .day, value: -9, to: today) ?? today
        let before = calendar.date(byAdding: .day, value: 1, to: today) ?? now
        var weeks: [Date: Double] = [:]
        var recentIds = Set<String>()
        var exercises: [String: [StrengthProgressRow]] = [:]
        for row in rows {
            guard let date = row.date, date < before,
                  let week = calendar.dateInterval(of: .weekOfYear, for: date)?.start else { continue }
            weeks[week, default: 0] += row.volume
            exercises[row.exerciseId, default: []].append(row)
            if date >= recentStart { recentIds.insert(row.exerciseId) }
        }
        var weekly: [StrengthWeeklyVolume] = []
        if var week = weeks.keys.min(), let last = calendar.dateInterval(of: .weekOfYear, for: today)?.start {
            while week <= last {
                weekly.append(StrengthWeeklyVolume(weekStart: week, volume: weeks[week] ?? 0))
                guard let next = calendar.dateInterval(of: .weekOfYear, for: week)?.end, next > week else { break }
                week = next
            }
        }
        let recent = recentIds.map { id in
            let points = (exercises[id] ?? []).sorted {
                let left = $0.date ?? .distantPast
                let right = $1.date ?? .distantPast
                return left == right ? $0.id < $1.id : left < right
            }
            return StrengthExerciseTrend(id: id, name: points.last?.exerciseName ?? "Exercise", points: points)
        }.sorted {
            let order = $0.name.localizedCaseInsensitiveCompare($1.name)
            return order == .orderedSame ? $0.id < $1.id : order == .orderedAscending
        }
        return StrengthProgress(weeklyVolume: weekly, recentExercises: recent)
    }
}

@MainActor
public final class StrengthProgressViewModel: ProgressHistoryViewModel<StrengthProgressRow> {
    public init(
        repository: any SessionsRepositoryProtocol, calendar: Calendar = .current,
        clock: @escaping @Sendable () -> Date = Date.init
    ) {
        super.init(updates: { from, through, zone in
            repository.strengthProgressUpdates(fromDay: from, throughDay: through, timeZone: zone)
        }, calendar: calendar, clock: clock)
    }

    public var progress: StrengthProgress? {
        rows.map { StrengthProgressBuilder.build(rows: $0, now: clock(), calendar: calendar) }
    }
}
