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

    public func filtered(
        by timescale: DailyEnergyTrendTimescale,
        customStartISO: String? = nil,
        customEndISO: String? = nil,
        calendar: Calendar = .current,
        now: Date = Date()
    ) -> DailyEnergyTrendData {
        DailyEnergyTrendRangeFilter.filter(
            self,
            by: timescale,
            customStartISO: customStartISO,
            customEndISO: customEndISO,
            calendar: calendar,
            now: now
        )
    }
}

public enum DailyEnergyTrendTimescale: String, CaseIterable, Identifiable, Sendable {
    case last7Days
    case last30Days
    case last90Days
    case last180Days
    case custom

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .last7Days: "Last 7d"
        case .last30Days: "Last 30d"
        case .last90Days: "Last 90d"
        case .last180Days: "Last 180d"
        case .custom: "Custom…"
        }
    }

    public var days: Int? {
        switch self {
        case .last7Days: 7
        case .last30Days: 30
        case .last90Days: 90
        case .last180Days: 180
        case .custom: nil
        }
    }
}

public enum DailyEnergyTrendRangeFilter {
    public static func filter(
        _ trendData: DailyEnergyTrendData,
        by timescale: DailyEnergyTrendTimescale,
        customStartISO: String? = nil,
        customEndISO: String? = nil,
        calendar: Calendar = .current,
        now: Date = Date()
    ) -> DailyEnergyTrendData {
        guard let range = dateRange(
            for: timescale,
            customStartISO: customStartISO,
            customEndISO: customEndISO,
            calendar: calendar,
            now: now
        ) else { return trendData }

        let filteredPoints = trendData.points.filter { point in
            point.date >= range.start && point.date < range.endExclusive
        }
        return DailyEnergyTrendData(points: filteredPoints)
    }

    private static func dateRange(
        for timescale: DailyEnergyTrendTimescale,
        customStartISO: String?,
        customEndISO: String?,
        calendar: Calendar,
        now: Date
    ) -> (start: Date, endExclusive: Date)? {
        if let days = timescale.days {
            let today = calendar.startOfDay(for: now)
            let start = calendar.date(byAdding: .day, value: -(days - 1), to: today) ?? today
            let end = calendar.date(byAdding: .day, value: 1, to: today) ?? today
            return (start, end)
        }

        guard let customStartISO,
              let customEndISO,
              let parsedStart = DateOnly.parse(customStartISO, calendar: calendar),
              let parsedEnd = DateOnly.parse(customEndISO, calendar: calendar)
        else { return nil }

        let start = min(parsedStart, parsedEnd)
        let end = max(parsedStart, parsedEnd)
        let endExclusive = calendar.date(byAdding: .day, value: 1, to: end) ?? end
        return (start, endExclusive)
    }
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

