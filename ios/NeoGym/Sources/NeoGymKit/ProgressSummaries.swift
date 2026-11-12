import Foundation

public extension StrengthExerciseTrend {
    /// Estimated 1RM from the most recent session that has one.
    var latestEstimatedOneRepMax: Double? {
        points
            .filter { $0.estimatedOneRepMax != nil }
            .max { ($0.date ?? .distantPast) < ($1.date ?? .distantPast) }?
            .estimatedOneRepMax
    }

    var bestEstimatedOneRepMax: Double? {
        points.compactMap(\.estimatedOneRepMax).max()
    }
}

public extension StrengthProgress {
    /// The loaded week with the most volume.
    var bestWeek: StrengthWeeklyVolume? {
        weeklyVolume.max { $0.volume < $1.volume }
    }
}

/// Stacked bar for a muscle's trailing seven days: direct sets plus half of
/// the secondary sets, as fractions of the largest weighted total.
public struct MuscleSetBar: Sendable, Equatable {
    public let direct: Double
    public let halfIndirect: Double

    public init(row: MuscleSetProgressRow, maxWeighted: Double) {
        let scale = maxWeighted > 0 ? maxWeighted : 1
        direct = min(Double(row.rollingDirectSets) / scale, 1)
        halfIndirect = min(Double(row.rollingIndirectSets) / 2 / scale, max(1 - direct, 0))
    }
}

/// Average daily energy out across complete days (today is partial).
public struct DailyEnergyOutAverage: Sendable, Equatable {
    public let kcalPerDay: Double
    public let dayCount: Int

    /// Uses up to `days` most recent entries before `today` with any recorded energy.
    public init?(entries: [DailyEnergy], today: String, days: Int = 14) {
        let totals = entries
            .filter { $0.energyOn < today && ($0.activeKcal != nil || $0.restingKcal != nil) }
            .sorted { $0.energyOn > $1.energyOn }
            .prefix(days)
            .map { ($0.activeKcal ?? 0) + ($0.restingKcal ?? 0) }
        guard !totals.isEmpty else { return nil }
        kcalPerDay = totals.reduce(0, +) / Double(totals.count)
        dayCount = totals.count
    }
}

public enum HealthImportMarker {
    /// Note written by the iPhone and watch importers on rows they own.
    public static let note = "Imported from Apple Health"

    public static func isImported(_ notes: String?) -> Bool {
        notes?.trimmingCharacters(in: .whitespacesAndNewlines) == note
    }
}
