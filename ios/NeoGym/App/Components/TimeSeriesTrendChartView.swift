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

    @State private var period: TimeSeriesChartPeriod
    @State private var customStart: Date
    @State private var customEnd: Date

    init(
        series: [TimeSeriesChartSeries],
        maxRenderedPoints: Int = 48,
        maxPointMarkers: Int = 28,
        emptyMessage: String = "No data in this range.",
        initialPeriod: TimeSeriesChartPeriod = .last90Days,
        now: Date = Date(),
        calendar: Calendar = .current
    ) {
        self.series = series
        self.maxRenderedPoints = maxRenderedPoints
        self.maxPointMarkers = maxPointMarkers
        self.emptyMessage = emptyMessage
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
                emptyMessage: emptyMessage
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
