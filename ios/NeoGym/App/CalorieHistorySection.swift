import NeoGymKit
import SwiftUI

/// Calories consumed (blue) above net (orange), each as daily values with a
/// 7-day average, under one Period menu. Today's partial intake is an open dot
/// and neither average nor net counts it (`CalorieTrend`). Loads the last 30
/// local days (plus warm-up days) first, from the SDK cache when available,
/// and fetches wider or custom ranges on demand.
struct CalorieHistorySection: View {
    /// The Energy screen owns initial loads and refreshes so pull-to-refresh
    /// awaits this chart as well as the energy list without resetting its period.
    @ObservedObject var viewModel: NutritionCalorieHistoryViewModel
    @Binding var range: ChartHistoryRange
    @State private var trend: CalorieTrend?

    var body: some View {
        SectionShell(title: "Calories", subtitle: "Daily values and 7-day averages", isLoading: viewModel.state.isLoading) {
            content
        }
        .onReceive(viewModel.$state) { state in
            // Loading and failed states keep the last chart, including offline cached emissions.
            if case let .loaded(history) = state {
                trend = CalorieTrend(history: history, today: IntakeGrouping.formatLocalDate())
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            AppLoadingStateView(message: "Loading calories…")
        case .loading where viewModel.history == nil:
            AppLoadingStateView(message: "Loading calories…")
        case let .failed(message, previous) where previous == nil:
            AppErrorStateView(title: "Failed to load calories", message: message) {
                Task { await viewModel.load(range: range) }
            }
        case .loading, .loaded, .failed:
            VStack(alignment: .leading, spacing: NeoGymTheme.spacingXS) {
                if let trend {
                    averages(trend)
                }
                TimeSeriesTrendChartView(
                    panels: trend.map(Self.panels) ?? [],
                    chartHeight: 200,
                    initialPeriod: .last30Days,
                    onVisibleRangeChange: { start, end in
                        let next = ChartHistoryRange(visibleStart: start, endExclusive: end)
                        if next != range { range = next }
                    }
                )
                Text("Today so far is the open dot after the dashed line; averages use full days only.")
                    .font(.caption)
                    .foregroundStyle(NeoGymTheme.textTertiary)
                if let through = viewModel.cachedThrough {
                    Text("Showing saved data through \(through); newer dates may be missing.")
                        .font(.footnote)
                        .foregroundStyle(NeoGymTheme.textSecondary)
                }
                if case let .failed(message, _) = viewModel.state {
                    FeedbackBanner(message: "Could not load selected period: \(message)")
                }
            }
        }
    }

    private func averages(_ trend: CalorieTrend) -> some View {
        AdaptiveRow(spacing: NeoGymTheme.spacingSM, alignment: .top) {
            average("Consumed · 7-day avg", trend.latestConsumedAverage.map(MetricFormat.whole))
            average("Net · 7-day avg", trend.latestNetAverage.map(MetricFormat.signedWhole))
        }
    }

    private func average(_ label: String, _ value: String?) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.footnote)
                .foregroundStyle(NeoGymTheme.textSecondary)
            MetricValueText(value: value ?? "—", unit: "kcal", size: .title2.weight(.bold))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    static func panels(_ trend: CalorieTrend) -> [TimeSeriesChartPanel] {
        let consumedDaily = trend.consumed.map(point) + [trend.consumedToday].compactMap { $0 }.map { today in
            TimeSeriesChartDataPoint(id: today.day, date: today.date, value: today.value, isPartial: true)
        }
        return [
            TimeSeriesChartPanel(
                id: "consumed",
                title: "Consumed",
                series: [
                    TimeSeriesChartSeries(
                        id: "consumed-daily", name: "Daily", color: NeoGymTheme.chart1, style: .readings,
                        points: consumedDaily, valueFormatter: kcalText
                    ),
                    TimeSeriesChartSeries(
                        id: "consumed-average", name: "7-day avg", color: NeoGymTheme.chart1,
                        points: trend.consumedAverage.map(point), valueFormatter: kcalText, isRollingAverage: true
                    )
                ],
                emptyMessage: "No food logged in this range.",
                accessibilityLabel: "Calories consumed, daily and 7-day average"
            ),
            TimeSeriesChartPanel(
                id: "net",
                title: "Net (consumed − burned)",
                series: [
                    TimeSeriesChartSeries(
                        id: "net-daily", name: "Daily", color: NeoGymTheme.chart2, style: .readings,
                        includesZero: true, points: trend.net.map(point), valueFormatter: signedKcalText
                    ),
                    TimeSeriesChartSeries(
                        id: "net-average", name: "7-day avg", color: NeoGymTheme.chart2,
                        includesZero: true, points: trend.netAverage.map(point), valueFormatter: signedKcalText,
                        isRollingAverage: true
                    )
                ],
                emptyMessage: "No full days with food and energy in this range.",
                accessibilityLabel: "Net calories, daily and 7-day average"
            )
        ]
    }

    static func point(_ point: CalorieTrend.Point) -> TimeSeriesChartDataPoint {
        TimeSeriesChartDataPoint(id: point.day, date: point.date, value: point.value)
    }

    static func kcalText(_ value: Double) -> String {
        NutritionMath.formatMacro(value, unit: "kcal")
    }

    static func signedKcalText(_ value: Double) -> String {
        if value < 0 { return "−\(NutritionMath.formatMacro(abs(value), unit: "kcal"))" }
        if value > 0 { return "+\(NutritionMath.formatMacro(value, unit: "kcal"))" }
        return NutritionMath.formatMacro(0, unit: "kcal")
    }
}
