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

/// Average daily energy out across the complete days of the default 30-day
/// chart (today is partial, so at most 29 days).
public struct DailyEnergyOutAverage: Sendable, Equatable {
    public let kcalPerDay: Double
    public let dayCount: Int

    /// Uses entries with any recorded energy from the `days` local dates
    /// before `today`.
    public init?(entries: [DailyEnergy], today: String, days: Int = 29, calendar: Calendar = .current) {
        let firstDay = IntakeGrouping.addLocalDateDays(today, days: -days, calendar: calendar)
        let totals = entries
            .filter { $0.energyOn >= firstDay && $0.energyOn < today && ($0.activeKcal != nil || $0.restingKcal != nil) }
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
