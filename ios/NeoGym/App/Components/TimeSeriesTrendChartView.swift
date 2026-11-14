import NeoGymKit
import SwiftUI

enum TimeSeriesChartPeriod: String, CaseIterable, Identifiable {
    case last7Days
    case last14Days
    case last30Days
    case last8Weeks
    case last90Days
    case last180Days
    case custom

    var id: String { rawValue }

    var label: String {
        switch self {
        case .last7Days: "Last 7d"
        case .last14Days: "Last 14d"
        case .last30Days: "Last 30d"
        case .last8Weeks: "Last 8 weeks"
        case .last90Days: "Last 90d"
        case .last180Days: "Last 180d"
        case .custom: "Custom…"
        }
    }

    var days: Int? {
        switch self {
        case .last7Days: 7
        case .last14Days: 14
        case .last30Days: 30
        case .last8Weeks: nil
        case .last90Days: 90
        case .last180Days: 180
        case .custom: nil
        }
    }
}

/// A Period menu above one chart, or above several stacked panels that share
/// it (Consumed above Net). Changing the period filters every panel.
struct TimeSeriesTrendChartView: View {
    let panels: [TimeSeriesChartPanel]
    var maxRenderedPoints = 64
    var maxPointMarkers = 31
    /// Each panel's chart plus its legend.
    var chartHeight: CGFloat = 240
    var onVisibleRangeChange: ((Date, Date) -> Void)?

    @State private var period: TimeSeriesChartPeriod
    @State private var customStart: Date
    @State private var customEnd: Date

    init(
        series: [TimeSeriesChartSeries],
        maxRenderedPoints: Int = 64,
        maxPointMarkers: Int = 31,
        chartHeight: CGFloat = 240,
        emptyMessage: String = "No data in this range.",
        accessibilityLabel: String = "Time series chart",
        accessibilityValue: String? = nil,
        initialPeriod: TimeSeriesChartPeriod = .last90Days,
        now: Date = Date(),
        calendar: Calendar = .current,
        onVisibleRangeChange: ((Date, Date) -> Void)? = nil
    ) {
        self.init(
            panels: [TimeSeriesChartPanel(
                id: "chart",
                series: series,
                emptyMessage: emptyMessage,
                accessibilityLabel: accessibilityLabel,
                accessibilityValue: accessibilityValue
            )],
            maxRenderedPoints: maxRenderedPoints,
            maxPointMarkers: maxPointMarkers,
            chartHeight: chartHeight,
            initialPeriod: initialPeriod,
            now: now,
            calendar: calendar,
            onVisibleRangeChange: onVisibleRangeChange
        )
    }

    init(
        panels: [TimeSeriesChartPanel],
        maxRenderedPoints: Int = 64,
        maxPointMarkers: Int = 31,
        chartHeight: CGFloat = 240,
        initialPeriod: TimeSeriesChartPeriod = .last90Days,
        now: Date = Date(),
        calendar: Calendar = .current,
        onVisibleRangeChange: ((Date, Date) -> Void)? = nil
    ) {
        self.panels = panels
        self.maxRenderedPoints = maxRenderedPoints
        self.maxPointMarkers = maxPointMarkers
        self.chartHeight = chartHeight
        self.onVisibleRangeChange = onVisibleRangeChange
        _period = State(initialValue: initialPeriod)
        _customStart = State(initialValue: calendar.date(byAdding: .day, value: -30, to: now) ?? now)
        _customEnd = State(initialValue: now)
    }

    private func filtered(_ series: [TimeSeriesChartSeries]) -> [TimeSeriesChartSeries] {
        guard let dateRange else { return series }
        return series.map { singleSeries in
            singleSeries.filtered { point in
                point.date >= dateRange.start && point.date < dateRange.endExclusive
            }
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            periodControls
            ForEach(panels) { panel in
                VStack(alignment: .leading, spacing: NeoGymTheme.spacingXS) {
                    if let title = panel.title {
                        Text(title)
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(NeoGymTheme.text)
                            .padding(.top, NeoGymTheme.spacingXXS)
                            .accessibilityAddTraits(.isHeader)
                    }
                    TimeSeriesChartView(
                        series: filtered(panel.series),
                        maxRenderedPoints: maxRenderedPoints,
                        maxPointMarkers: maxPointMarkers,
                        showsAxes: true,
                        showsLegend: true,
                        emptyMessage: panel.emptyMessage,
                        accessibilityLabel: panel.accessibilityLabel,
                        accessibilityValue: panel.accessibilityValue
                    )
                    .frame(height: chartHeight)
                }
            }
        }
        .onAppear(perform: notifyVisibleRangeChange)
        .onChange(of: period) { _, _ in notifyVisibleRangeChange() }
        .onChange(of: customStart) { _, _ in notifyVisibleRangeChange() }
        .onChange(of: customEnd) { _, _ in notifyVisibleRangeChange() }
        // Refresh preset ranges if the view remains mounted across a local midnight.
        .onChange(of: Calendar.current.startOfDay(for: Date())) { _, _ in notifyVisibleRangeChange() }
    }

    private func notifyVisibleRangeChange() {
        guard let dateRange else { return }
        onVisibleRangeChange?(dateRange.start, dateRange.endExclusive)
    }

    private var periodControls: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Period")
                    .font(.caption.weight(.semibold))
                    .textCase(.uppercase)
                    .foregroundColor(NeoGymTheme.textSecondary)
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
        if period == .last8Weeks, let currentWeek = calendar.dateInterval(of: .weekOfYear, for: Date()) {
            let start = calendar.date(byAdding: .weekOfYear, value: -7, to: currentWeek.start) ?? currentWeek.start
            let endExclusive = calendar.date(byAdding: .weekOfYear, value: 1, to: currentWeek.start) ?? Date()
            return (start, endExclusive)
        }
        if let days = period.days {
            let end = calendar.startOfDay(for: Date())
            let endExclusive = calendar.dateInterval(of: .day, for: end)?.end ?? Date()
            let start = calendar.date(byAdding: .day, value: -days + 1, to: end) ?? end
            return (start, endExclusive)
        }

        let startDay = calendar.startOfDay(for: customStart)
        let endDay = calendar.startOfDay(for: customEnd)
        let start = min(startDay, endDay)
        let inclusiveEnd = max(startDay, endDay)
        let endExclusive = calendar.dateInterval(of: .day, for: inclusiveEnd)?.end ?? inclusiveEnd
        return (start, endExclusive)
    }
}

extension TimeSeriesChartView {
    /// The visible series' spoken summary: lowest, highest, average and latest
    /// over complete periods, then today's or this week's value so far
    /// (`ChartAccessibilitySummary`).
    var defaultAccessibilityValue: String {
        let formatter = Self.accessibilityDateFormatter
        return ChartAccessibilitySummary.text(
            for: effectiveVisibleSeries.map { singleSeries in
                ChartAccessibilitySummary.Series(
                    name: singleSeries.name,
                    points: singleSeries.points.map {
                        ChartAccessibilitySummary.Point(date: $0.date, value: $0.value, isPartial: $0.isPartial)
                    },
                    unit: singleSeries.periodUnit,
                    isRollingAverage: singleSeries.isRollingAverage,
                    format: singleSeries.valueFormatter
                )
            },
            formatDate: formatter.string(from:)
        )
    }

    static var accessibilityDateFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }
}
