import Foundation

public struct DailyEnergyChartPoint: Identifiable, Sendable, Equatable {
    public let id: String
    public let energyOn: String
    public let date: Date
    public let time: TimeInterval
    public let activeKcal: Double?
    public let restingKcal: Double?

    public init(id: String, energyOn: String, date: Date, activeKcal: Double?, restingKcal: Double?) {
        self.id = id
        self.energyOn = energyOn
        self.date = date
        time = date.timeIntervalSince1970
        self.activeKcal = activeKcal
        self.restingKcal = restingKcal
    }

    public var totalKcal: Double? {
        guard activeKcal != nil || restingKcal != nil else { return nil }
        return (activeKcal ?? 0) + (restingKcal ?? 0)
    }
}

public struct DailyEnergyTrendData: Sendable, Equatable {
    public let points: [DailyEnergyChartPoint]

    public init(points: [DailyEnergyChartPoint]) {
        self.points = points
    }

    public var activeCount: Int { points.filter { $0.activeKcal != nil }.count }
    public var restingCount: Int { points.filter { $0.restingKcal != nil }.count }
    public var shouldShowChart: Bool { activeCount >= 2 || restingCount >= 2 }
}

public enum DailyEnergyTrendBuilder {
    public static func make(
        from entries: [DailyEnergy],
        calendar: Calendar = .current
    ) -> DailyEnergyTrendData {
        let points = entries.compactMap { entry -> DailyEnergyChartPoint? in
            guard let date = DateOnly.parse(entry.energyOn, calendar: calendar) else { return nil }
            return DailyEnergyChartPoint(
                id: entry.id,
                energyOn: entry.energyOn,
                date: date,
                activeKcal: entry.activeKcal,
                restingKcal: entry.restingKcal
            )
        }
        .sorted { lhs, rhs in
            if lhs.time == rhs.time { return lhs.id < rhs.id }
            return lhs.time < rhs.time
        }
        return DailyEnergyTrendData(points: points)
    }
}

