import SwiftUI

enum TimeSeriesChartPeriod: String, CaseIterable, Identifiable {
    case last7Days
    case last30Days
    case last90Days
    case last180Days
    case custom

    var id: String { rawValue }

    var label: String {
        switch self {
        case .last7Days: "Last 7d"
        case .last30Days: "Last 30d"
        case .last90Days: "Last 90d"
        case .last180Days: "Last 180d"
        case .custom: "Custom…"
        }
    }

    var days: Int? {
        switch self {
        case .last7Days: 7
        case .last30Days: 30
        case .last90Days: 90
        case .last180Days: 180
        case .custom: nil
        }
    }
}

struct TimeSeriesTrendChartView: View {
    let series: [TimeSeriesChartSeries]
    var maxRenderedPoints = 48
    var maxPointMarkers = 28
    var emptyMessage = "No data in this range."
    var accessibilityLabel = "Time series chart"
    var accessibilityValue: String?

    @State private var period: TimeSeriesChartPeriod
    @State private var customStart: Date
    @State private var customEnd: Date

    init(
        series: [TimeSeriesChartSeries],
        maxRenderedPoints: Int = 48,
        maxPointMarkers: Int = 28,
        emptyMessage: String = "No data in this range.",
        accessibilityLabel: String = "Time series chart",
        accessibilityValue: String? = nil,
        initialPeriod: TimeSeriesChartPeriod = .last90Days,
        now: Date = Date(),
        calendar: Calendar = .current
    ) {
        self.series = series
        self.maxRenderedPoints = maxRenderedPoints
        self.maxPointMarkers = maxPointMarkers
        self.emptyMessage = emptyMessage
        self.accessibilityLabel = accessibilityLabel
        self.accessibilityValue = accessibilityValue
        _period = State(initialValue: initialPeriod)
        _customStart = State(initialValue: calendar.date(byAdding: .day, value: -30, to: now) ?? now)
        _customEnd = State(initialValue: now)
    }

    private var filteredSeries: [TimeSeriesChartSeries] {
        guard let dateRange else { return series }
        return series.map { singleSeries in
            TimeSeriesChartSeries(
                id: singleSeries.id,
                name: singleSeries.name,
                color: singleSeries.color,
                axis: singleSeries.axis,
                centersAxisOnZero: singleSeries.centersAxisOnZero,
                points: singleSeries.points.filter { point in
                    point.date >= dateRange.start && point.date < dateRange.endExclusive
                },
                valueFormatter: singleSeries.valueFormatter
            )
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            periodControls
            TimeSeriesChartView(
                series: filteredSeries,
                maxRenderedPoints: maxRenderedPoints,
                maxPointMarkers: maxPointMarkers,
                showsAxes: true,
                showsLegend: true,
                emptyMessage: emptyMessage,
                accessibilityLabel: accessibilityLabel,
                accessibilityValue: accessibilityValue
            )
            .frame(height: 240)
        }
    }

    private var periodControls: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Period")
                    .font(.caption.weight(.semibold))
                    .textCase(.uppercase)
                    .foregroundColor(NeoGymTheme.mutedText)
                Spacer()
                Picker("Period", selection: $period) {
                    ForEach(TimeSeriesChartPeriod.allCases) { option in
                        Text(option.label).tag(option)
                    }
                }
                .pickerStyle(.menu)
            }

            if period == .custom {
                HStack(spacing: 12) {
                    DatePicker("From", selection: $customStart, displayedComponents: .date)
                    DatePicker("To", selection: $customEnd, displayedComponents: .date)
                }
                .datePickerStyle(.compact)
                .font(.caption)
            }
        }
    }

    private var dateRange: (start: Date, endExclusive: Date)? {
        let calendar = Calendar.current
        if let days = period.days {
            let end = calendar.startOfDay(for: Date())
            let endExclusive = calendar.date(byAdding: .day, value: 1, to: end) ?? Date()
            let start = calendar.date(byAdding: .day, value: -days + 1, to: end) ?? end
            return (start, endExclusive)
        }

        let startDay = calendar.startOfDay(for: customStart)
        let endDay = calendar.startOfDay(for: customEnd)
        let start = min(startDay, endDay)
        let inclusiveEnd = max(startDay, endDay)
        let endExclusive = calendar.date(byAdding: .day, value: 1, to: inclusiveEnd) ?? inclusiveEnd
        return (start, endExclusive)
    }
}

extension TimeSeriesChartView {
    var defaultAccessibilityValue: String {
        let visibleSeries = series.filter { !$0.points.isEmpty }
        let visiblePoints = visibleSeries.flatMap(\.points).sorted { $0.date < $1.date }
        let seriesNames = visibleSeries.map(\.name).joined(separator: ", ")
        let pointsLabel = visiblePoints.count == 1 ? "point" : "points"
        let dateRange = Self.accessibilityDateRangeDescription(for: visiblePoints)
        let overview = "\(visibleSeries.count) visible series: \(seriesNames). "
            + "\(visiblePoints.count) total \(pointsLabel)\(dateRange)."
        let seriesSummaries = visibleSeries.map(Self.accessibilitySummary(for:)).joined(separator: " ")
        return [overview, seriesSummaries].filter { !$0.isEmpty }.joined(separator: " ")
    }

    static func accessibilitySummary(for singleSeries: TimeSeriesChartSeries) -> String {
        guard let latest = singleSeries.points.last else { return "" }
        let pointCount = singleSeries.points.count
        let pointLabel = pointCount == 1 ? "point" : "points"
        let minValue = singleSeries.points.map(\.value).min() ?? latest.value
        let maxValue = singleSeries.points.map(\.value).max() ?? latest.value
        let latestDate = accessibilityDateFormatter.string(from: latest.date)

        return "\(singleSeries.name): \(pointCount) \(pointLabel), "
            + "latest \(singleSeries.valueFormatter(latest.value)) on \(latestDate), "
            + "minimum \(singleSeries.valueFormatter(minValue)), maximum \(singleSeries.valueFormatter(maxValue))."
    }

    static func accessibilityDateRangeDescription(for points: [TimeSeriesChartDataPoint]) -> String {
        guard let firstDate = points.first?.date, let lastDate = points.last?.date else { return "" }
        let first = accessibilityDateFormatter.string(from: firstDate)
        let last = accessibilityDateFormatter.string(from: lastDate)
        if Calendar.current.isDate(firstDate, inSameDayAs: lastDate) {
            return " on \(first)"
        }
        return " from \(first) to \(last)"
    }

    static var accessibilityDateFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }
}
