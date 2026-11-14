import Foundation

/// Body and Energy entry lists: the latest five entries, a count such as
/// "5 of 32", and Load more for the next five.
public struct EntryHistoryWindow: Sendable, Equatable {
    public static let pageSize = 5

    public private(set) var limit: Int

    public init(limit: Int = Self.pageSize) {
        self.limit = limit
    }

    public func visible<Item>(_ items: [Item]) -> [Item] {
        Array(items.prefix(limit))
    }

    /// More rows are loaded beyond the window, or the server has more.
    public func canShowMore(loadedCount: Int, hasMoreRemote: Bool = false) -> Bool {
        loadedCount > limit || hasMoreRemote
    }

    public mutating func showMore() {
        limit += Self.pageSize
    }

    /// "5 of 32"; nil until the total is known.
    public static func countLabel(shown: Int, total: Int?) -> String? {
        total.map { "\(shown) of \(max($0, shown))" }
    }
}

/// Progress › Overview's Muscles card: the latest day's trailing seven-day
/// weighted sets (direct plus half of secondary), the most-trained muscles,
/// and the least-trained after them. Unspecified shoulders stay out of the
/// least-trained line: that group only collects sets without a known delt.
public struct MuscleSetOverview: Sendable, Equatable {
    public let totalWeightedSets: Double
    public let mostTrained: [MuscleSetProgressRow]
    public let leastTrained: [MuscleSetProgressRow]

    public init?(rows: [MuscleSetProgressRow], mostCount: Int = 6, leastCount: Int = 3) {
        guard let latestDay = rows.map(\.day).max() else { return nil }
        let trained = rows.filter { $0.day == latestDay && $0.rollingWeightedSets > 0 }
        guard !trained.isEmpty else { return nil }
        let ranked = trained.sorted { left, right in
            if left.rollingWeightedSets != right.rollingWeightedSets {
                return left.rollingWeightedSets > right.rollingWeightedSets
            }
            return left.muscleName < right.muscleName
        }
        totalWeightedSets = trained.reduce(0) { $0 + $1.rollingWeightedSets }
        mostTrained = Array(ranked.prefix(mostCount))
        leastTrained = Array(
            ranked.dropFirst(mostCount)
                .filter { $0.muscleGroup != "shoulders" }
                .sorted { left, right in
                    if left.rollingWeightedSets != right.rollingWeightedSets {
                        return left.rollingWeightedSets < right.rollingWeightedSets
                    }
                    return left.muscleName < right.muscleName
                }
                .prefix(leastCount)
        )
    }
}

/// Weekly strength volume for Progress › Overview: the full weeks before the
/// current one and this week's partial total (drawn as an open dot), with
/// the best loaded week.
public struct StrengthWeeklyOverview: Sendable, Equatable {
    /// Full weeks, oldest first, ending with last week.
    public let fullWeeks: [StrengthWeeklyVolume]
    public let thisWeek: StrengthWeeklyVolume?
    public let bestWeek: StrengthWeeklyVolume?

    /// `weekCount` includes the current week.
    public init?(progress: StrengthProgress, now: Date = Date(), calendar: Calendar = .current, weekCount: Int = 8) {
        guard !progress.weeklyVolume.isEmpty else { return nil }
        let current = Self.currentWeekStart(now: now, calendar: calendar) ?? now
        thisWeek = progress.weeklyVolume.last { $0.weekStart == current }
        fullWeeks = Array(progress.weeklyVolume.filter { $0.weekStart < current }.suffix(max(weekCount - 1, 0)))
        bestWeek = progress.bestWeek
    }

    /// The start of the week that is still in progress, whose volume is partial.
    public static func currentWeekStart(now: Date = Date(), calendar: Calendar = .current) -> Date? {
        calendar.dateInterval(of: .weekOfYear, for: now)?.start
    }
}

/// Calories consumed and net (consumed − energy out) per day, each with a
/// trailing seven-day average, for Progress › Energy and Overview. Today is
/// partial: its consumed total is a separate point (an open dot), net leaves
/// it out, and neither average counts it. A day with no food logged has no
/// reading, so an unlogged day neither shows as zero nor drags an average.
public struct CalorieTrend: Sendable, Equatable {
    public struct Point: Sendable, Equatable, Identifiable {
        public let day: String
        public let date: Date
        public let value: Double

        public var id: String { day }

        init(_ point: CalorieHistoryChartPoint) {
            day = point.logDate
            date = point.date
            value = point.value
        }

        init(day: String, date: Date, value: Double) {
            self.day = day
            self.date = date
            self.value = value
        }
    }

    /// Full days with food logged, oldest first.
    public let consumed: [Point]
    public let consumedAverage: [Point]
    public let consumedToday: Point?
    /// Full days with food logged and energy recorded, oldest first.
    public let net: [Point]
    public let netAverage: [Point]
    /// Mean energy out per day across the days behind the latest net average.
    public let latestBurnedAverage: Double?

    public var latestConsumedAverage: Double? { consumedAverage.last?.value }
    public var latestNetAverage: Double? { netAverage.last?.value }
    public var isEmpty: Bool { consumed.isEmpty && consumedToday == nil }

    public init(history: NutritionCalorieHistory, today: String, calendar: Calendar = .current) {
        let logged = history.consumedChartPoints.filter { $0.value > 0 }
        let loggedDays = Set(logged.map(\.logDate))
        consumed = logged.filter { $0.logDate < today }.map(Point.init)
        consumedToday = logged.first { $0.logDate == today }.map(Point.init)
        net = history.dailyNetChartPoints
            .filter { $0.logDate < today && loggedDays.contains($0.logDate) }
            .map(Point.init)
        consumedAverage = Self.rolling(consumed, calendar: calendar)
        netAverage = Self.rolling(net, calendar: calendar)

        if let last = net.last {
            let consumedByDay = Dictionary(consumed.map { ($0.day, $0.value) }, uniquingKeysWith: { first, _ in first })
            let outs = Self.window(net, endingOn: last.day, calendar: calendar).compactMap { point in
                consumedByDay[point.day].map { $0 - point.value }
            }
            latestBurnedAverage = outs.isEmpty ? nil : outs.reduce(0, +) / Double(outs.count)
        } else {
            latestBurnedAverage = nil
        }
    }

    /// At each point, the mean of the points dated within the seven local
    /// days ending on it.
    static func rolling(_ points: [Point], calendar: Calendar) -> [Point] {
        points.map { point in
            let window = window(points, endingOn: point.day, calendar: calendar)
            return Point(day: point.day, date: point.date, value: window.reduce(0) { $0 + $1.value } / Double(window.count))
        }
    }

    private static func window(_ points: [Point], endingOn day: String, calendar: Calendar) -> [Point] {
        let start = IntakeGrouping.addLocalDateDays(day, days: -6, calendar: calendar)
        return points.filter { $0.day >= start && $0.day <= day }
    }
}
