import NeoGymKit
import SwiftUI

struct StrengthProgressView: View {
    @ObservedObject var viewModel: StrengthProgressViewModel
    let reloadToken: Int
    @Binding var loadedToken: Int?

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                AreaSectionHeader()
                content
            }
            .frame(maxWidth: 760)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.vertical, NeoGymTheme.screenVerticalPadding)
            .frame(maxWidth: .infinity)
        }
        .modifier(ProgressRefreshModifier(model: viewModel, reloadToken: reloadToken, loadedToken: $loadedToken))
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle, .loading(previous: nil):
            AppLoadingStateView(title: "Loading strength progress")
        case let .failed(message, _) where viewModel.rows == nil:
            AppErrorStateView(title: "Couldn't load progress", message: message) {
                Task { await viewModel.load() }
            }
            .cardSurface()
        default:
            if let progress = viewModel.progress {
                if let through = viewModel.cachedThrough {
                    FeedbackBanner(
                        message: "Showing cached strength progress through \(through); newer sessions may be missing.",
                        tone: .info
                    )
                }
                if viewModel.isShowingPartialHistory {
                    FeedbackBanner(message: "Showing partial history while the selected range refreshes.", tone: .info)
                }
                VStack(alignment: .leading, spacing: NeoGymTheme.spacingXS) {
                    HStack(alignment: .firstTextBaseline) {
                        Text("Weekly volume")
                            .font(.headline)
                            .foregroundStyle(NeoGymTheme.text)
                            .accessibilityAddTraits(.isHeader)
                        Spacer()
                        Text("First week may be partial")
                            .font(.footnote)
                            .foregroundStyle(NeoGymTheme.textSecondary)
                    }
                    if let best = progress.bestWeek {
                        MetricValueText(
                            value: Self.compactVolume(best.volume),
                            unit: "kg · best week, \(best.weekStart.formatted(.dateTime.day().month(.abbreviated)))"
                        )
                    }
                    TimeSeriesTrendChartView(
                        series: [TimeSeriesChartSeries(
                            id: "weekly-volume", name: "Volume (kg)", color: NeoGymTheme.accentText,
                            points: progress.weeklyVolume.map { week in
                                TimeSeriesChartDataPoint(
                                    id: week.weekStart.ISO8601Format(), date: week.weekStart, value: week.volume
                                )
                            },
                            valueFormatter: { "\($0.formatted(.number.precision(.fractionLength(0)))) kg" }
                        )],
                        emptyMessage: "No strength sets in this period.",
                        accessibilityLabel: "Weekly strength volume chart",
                        initialPeriod: .last8Weeks,
                        onVisibleRangeChange: { start, _ in Task { await viewModel.extendHistory(to: start) } }
                    )
                }
                .padding(NeoGymTheme.spacingMD)
                .cardSurface()
                if progress.recentExercises.isEmpty {
                    AppEmptyStateView(
                        title: "No recent strength exercises",
                        message: "Log a strength set to see volume and estimated 1RM here for the next 10 days.",
                        systemImage: "chart.line.uptrend.xyaxis"
                    )
                } else {
                    Text("Logged in the last 10 days")
                        .font(.title3.weight(.bold))
                        .foregroundStyle(NeoGymTheme.text)
                        .padding(.horizontal, NeoGymTheme.spacingXXS)
                        .padding(.top, NeoGymTheme.spacingXS)
                        .accessibilityAddTraits(.isHeader)
                    ForEach(progress.recentExercises) { exercise in
                        exerciseChart(exercise)
                    }
                }
                if case let .failed(message, _) = viewModel.state {
                    FeedbackBanner(message: "Could not refresh strength progress: \(message)")
                }
            }
        }
    }

    private func exerciseChart(_ exercise: StrengthExerciseTrend) -> some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingXS) {
            NavigationLink(value: ProgressRoute.exerciseDetail(exercise.id)) {
                ListRow(title: exercise.name, subtitle: oneRepMaxSummary(exercise))
                    .padding(.horizontal, -NeoGymTheme.spacingMD)
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens exercise details")
            TimeSeriesTrendChartView(
                series: exerciseSeries(exercise),
                emptyMessage: "No sets in this period.",
                accessibilityLabel: "\(exercise.name) volume and estimated one-rep max chart",
                initialPeriod: .last8Weeks,
                onVisibleRangeChange: { start, _ in Task { await viewModel.extendHistory(to: start) } }
            )
        }
        .padding(NeoGymTheme.spacingMD)
        .cardSurface()
    }

    private func oneRepMaxSummary(_ exercise: StrengthExerciseTrend) -> String {
        guard let latest = exercise.latestEstimatedOneRepMax else { return "Session volume · kg" }
        let best = exercise.bestEstimatedOneRepMax.map { " · best \(MetricFormat.decimal($0))" } ?? ""
        return "e1RM \(MetricFormat.decimal(latest)) kg\(best)"
    }

    private static func compactVolume(_ value: Double) -> String {
        value >= 1_000 ? "\(MetricFormat.decimal(value / 1_000))k" : MetricFormat.whole(value)
    }

    private func exerciseSeries(_ exercise: StrengthExerciseTrend) -> [TimeSeriesChartSeries] {
        [
            TimeSeriesChartSeries(
                id: "\(exercise.id)-volume", name: "Volume (kg)", color: NeoGymTheme.accentText,
                points: exercise.points.compactMap { point in
                    guard let date = point.date else { return nil }
                    return TimeSeriesChartDataPoint(id: point.id, date: date, value: point.volume)
                },
                valueFormatter: { "\($0.formatted(.number.precision(.fractionLength(0)))) kg" }
            ),
            TimeSeriesChartSeries(
                id: "\(exercise.id)-one-rep-max", name: "Est. 1RM (kg)", color: NeoGymTheme.textSecondary, axis: .right,
                points: exercise.points.compactMap { point in
                    guard let date = point.date, let estimate = point.estimatedOneRepMax else { return nil }
                    return TimeSeriesChartDataPoint(id: point.id, date: date, value: estimate)
                },
                valueFormatter: { String(format: "%.1f kg", $0) }
            )
        ]
    }
}
