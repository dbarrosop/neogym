import Foundation

/// One day's server-calculated trailing seven-day totals for a muscle, returned
/// by Postgres rather than derived from raw strength sets on the device.
public struct MuscleSetProgressRow: Decodable, Sendable, Equatable, Identifiable {
    public let day: String
    public let muscleGroup: String
    public let rollingDirectSets: Int
    public let rollingIndirectSets: Int
    public let rollingWeightedSets: Double

    public var id: String { "\(day)-\(muscleGroup)" }

    public var muscleName: String {
        if muscleGroup == "shoulders" { return "Shoulders (unspecified)" }
        return muscleGroup.split(separator: "_").map { $0.capitalized }.joined(separator: " ")
    }

    public init(
        day: String, muscleGroup: String, rollingDirectSets: Int, rollingIndirectSets: Int,
        rollingWeightedSets: Double
    ) {
        self.day = day
        self.muscleGroup = muscleGroup
        self.rollingDirectSets = rollingDirectSets
        self.rollingIndirectSets = rollingIndirectSets
        self.rollingWeightedSets = rollingWeightedSets
    }

    private enum CodingKeys: String, CodingKey {
        case day, muscleGroup
        case rollingDirectSets, rollingIndirectSets, rollingWeightedSets
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        day = try container.decode(String.self, forKey: .day)
        muscleGroup = try container.decode(String.self, forKey: .muscleGroup)
        rollingDirectSets = try container.decode(Int.self, forKey: .rollingDirectSets)
        rollingIndirectSets = try container.decode(Int.self, forKey: .rollingIndirectSets)
        rollingWeightedSets = try container.decodeFlexibleDouble(forKey: .rollingWeightedSets)
    }

    public func date(in calendar: Calendar) -> Date? {
        let parts = day.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12))
    }
}

@MainActor
public final class MuscleSetProgressViewModel: ProgressHistoryViewModel<MuscleSetProgressRow> {
    public init(
        repository: any SessionsRepositoryProtocol,
        calendar: Calendar = .current,
        clock: @escaping @Sendable () -> Date = Date.init
    ) {
        super.init(cachedSnapshot: { from, through, zone in
            try await repository.cachedMuscleSetProgress(fromDay: from, throughDay: through, timeZone: zone)
        }, updates: { from, through, zone in
            repository.muscleSetProgressUpdates(fromDay: from, throughDay: through, timeZone: zone)
        }, calendar: calendar, clock: clock)
    }
}
