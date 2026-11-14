import Foundation

/// Spoken chart summaries (the VoiceOver value of a chart), as in the design's
/// chart rules: lowest, highest, average and latest cover complete periods
/// only. A partial current period (today, or this week) is left out of them
/// and named last ("Today so far: 1,461 kcal.", naming series only when
/// several are partial). A rolling-average series reports no average of its
/// own: an average of averages adds nothing.
public enum ChartAccessibilitySummary {
    /// What one point stands for, which names the partial period.
    public enum PeriodUnit: Sendable, Equatable {
        case day
        case week
    }

    public struct Point: Sendable, Equatable {
        public let date: Date
        public let value: Double
        public let isPartial: Bool

        public init(date: Date, value: Double, isPartial: Bool = false) {
            self.date = date
            self.value = value
            self.isPartial = isPartial
        }
    }

    public struct Series {
        public let name: String
        public let points: [Point]
        public let unit: PeriodUnit
        /// A 7-day (or other rolling) average: its summary leaves out "average".
        public let isRollingAverage: Bool
        public let format: (Double) -> String

        public init(
            name: String,
            points: [Point],
            unit: PeriodUnit = .day,
            isRollingAverage: Bool = false,
            format: @escaping (Double) -> String
        ) {
            self.name = name
            self.points = points.sorted { $0.date < $1.date }
            self.unit = unit
            self.isRollingAverage = isRollingAverage
            self.format = format
        }
    }

    /// "From 14 Oct 2026 to 11 Nov 2026. Consumed: lowest 2,140 kcal, highest
    /// 2,584 kcal, average 2,370 kcal, latest 2,310 kcal on 11 Nov 2026.
    /// Today so far: 1,461 kcal."
    public static func text(for series: [Series], formatDate: (Date) -> String) -> String {
        let complete = series.flatMap { $0.points.filter { !$0.isPartial } }.sorted { $0.date < $1.date }
        let isWeekly = !series.isEmpty && series.allSatisfy { $0.unit == .week }
        var sentences: [String] = []
        if let first = complete.first, let last = complete.last {
            let start = formatDate(first.date)
            let end = formatDate(last.date)
            if start == end {
                sentences.append(isWeekly ? "Week of \(start)." : "On \(start).")
            } else {
                sentences.append(isWeekly ? "Weeks of \(start) to \(end)." : "From \(start) to \(end).")
            }
        }
        sentences += series.compactMap { completeSummary($0, formatDate: formatDate) }
        sentences += partialSummaries(series)
        return sentences.joined(separator: " ")
    }

    private static func completeSummary(_ series: Series, formatDate: (Date) -> String) -> String? {
        let values = series.points.filter { !$0.isPartial }
        guard let latest = values.last else { return nil }
        let numbers = values.map(\.value)
        let average = numbers.reduce(0, +) / Double(numbers.count)
        let latestDate = series.unit == .week ? "the week of \(formatDate(latest.date))" : formatDate(latest.date)
        let latestText = "latest \(series.format(latest.value)) \(series.unit == .week ? "in" : "on") \(latestDate)"
        guard values.count > 1 else { return "\(series.name): \(latestText)." }
        let averageText = series.isRollingAverage ? "" : "average \(series.format(average)), "
        return "\(series.name): lowest \(series.format(numbers.min() ?? latest.value)), "
            + "highest \(series.format(numbers.max() ?? latest.value)), "
            + "\(averageText)\(latestText)."
    }

    /// One closing sentence per partial period: "Today so far: Resting 679
    /// kcal, Active 531 kcal." A lone partial series goes unnamed ("Today so
    /// far: 1,461 kcal."): the chart's label already says what it shows, and
    /// names such as "Daily" read oddly there. Only each series' last point
    /// can be partial.
    private static func partialSummaries(_ series: [Series]) -> [String] {
        [(PeriodUnit.day, "Today so far"), (PeriodUnit.week, "This week so far")].compactMap { unit, title in
            let partials = series.filter { $0.unit == unit }.compactMap {
                singleSeries -> (name: String, value: String)? in
                guard let partial = singleSeries.points.last, partial.isPartial else { return nil }
                return (singleSeries.name, singleSeries.format(partial.value))
            }
            guard let first = partials.first else { return nil }
            if partials.count == 1 { return "\(title): \(first.value)." }
            return "\(title): \(partials.map { "\($0.name) \($0.value)" }.joined(separator: ", "))."
        }
    }
}
