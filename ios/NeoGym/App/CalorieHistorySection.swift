import NeoGymKit
import SwiftUI

/// Calories consumed against daily and rolling net balance. Loads the last 14
/// local days (plus warm-up days) first, from the SDK cache when available,
/// and fetches wider or custom ranges on demand.
struct CalorieHistorySection: View {
    let reloadToken: Int

    @StateObject private var viewModel: NutritionCalorieHistoryViewModel
    @State private var range = ChartHistoryRange.recentDays(14)
    @State private var series: [TimeSeriesChartSeries] = []
    @State private var hasRequested = false

    init(repository: any NutritionFoodMealRepositoryProtocol, reloadToken: Int) {
        self.reloadToken = reloadToken
        _viewModel = StateObject(wrappedValue: NutritionCalorieHistoryViewModel(repository: repository))
    }

    var body: some View {
        SectionShell(title: "Calories", subtitle: "Consumed, daily net and 7-day average net", isLoading: viewModel.state.isLoading) {
            content
        }
        .task {
            guard !hasRequested else { return }
            await viewModel.load(range: range, cacheCandidates: ChartHistoryRange.recentCacheCandidates(14))
            hasRequested = true
        }
        .task(id: range) {
            if hasRequested { await viewModel.load(range: range) }
        }
        .onChange(of: reloadToken) {
            Task { await viewModel.load(range: range) }
        }
        .onReceive(viewModel.$state) { state in
            // Loading and failed states keep the last chart, including offline cached emissions.
            if case let .loaded(history) = state {
                series = Self.makeSeries(history)
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
                TimeSeriesTrendChartView(
                    series: series,
                    maxRenderedPoints: 48,
                    emptyMessage: "No calorie or net data in this range.",
                    accessibilityLabel: "Calories consumed, net, and rolling average net per day",
                    initialPeriod: .last14Days,
                    onVisibleRangeChange: { start, end in
                        let next = ChartHistoryRange(visibleStart: start, endExclusive: end)
                        if next != range { range = next }
                    }
                )
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

    private static func makeSeries(_ history: NutritionCalorieHistory) -> [TimeSeriesChartSeries] {
        [
            TimeSeriesChartSeries(
                id: "calories",
                name: "Consumed",
                color: NeoGymTheme.accentText,
                points: history.consumedChartPoints.map { day in
                    TimeSeriesChartDataPoint(id: day.logDate, date: day.date, value: day.value)
                },
                valueFormatter: kcalText
            ),
            TimeSeriesChartSeries(
                id: "net",
                name: "Net",
                color: NeoGymTheme.textTertiary,
                axis: .right,
                centersAxisOnZero: true,
                points: history.dailyNetChartPoints.map { value in
                    TimeSeriesChartDataPoint(id: "net-\(value.logDate)", date: value.date, value: value.value)
                },
                valueFormatter: signedKcalText
            ),
            TimeSeriesChartSeries(
                id: "rolling-net",
                name: "7-day avg net",
                color: NeoGymTheme.series2,
                axis: .right,
                centersAxisOnZero: true,
                points: history.rollingNetChartPoints.map { value in
                    TimeSeriesChartDataPoint(id: "rolling-net-\(value.logDate)", date: value.date, value: value.value)
                },
                valueFormatter: signedKcalText
            )
        ]
    }

    private static func kcalText(_ value: Double) -> String {
        NutritionMath.formatMacro(value, unit: "kcal")
    }

    private static func signedKcalText(_ value: Double) -> String {
        if value < 0 { return "−\(NutritionMath.formatMacro(abs(value), unit: "kcal"))" }
        if value > 0 { return "+\(NutritionMath.formatMacro(value, unit: "kcal"))" }
        return NutritionMath.formatMacro(0, unit: "kcal")
    }
}
