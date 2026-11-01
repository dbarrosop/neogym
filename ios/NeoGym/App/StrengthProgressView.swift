import NeoGymKit
import SwiftUI

struct StrengthProgressView: View {
    @ObservedObject var viewModel: StrengthProgressViewModel
    let reloadToken: Int
    let isActive: Bool

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                Text("Weekly total volume, plus session volume and estimated one-rep max for exercises logged in the last 10 days. History is available for up to one year.")
                    .font(.subheadline)
                    .foregroundStyle(NeoGymTheme.mutedText)
                content
            }
            .frame(maxWidth: 760)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.vertical, NeoGymTheme.screenVerticalPadding)
            .frame(maxWidth: .infinity)
        }
        .modifier(ProgressRefreshModifier(model: viewModel, reloadToken: reloadToken, isActive: isActive))
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle, .loading(previous: nil):
            SectionShell(title: "Strength") { AppLoadingStateView(title: "Loading strength progress") }
        case let .failed(message, _) where viewModel.rows == nil:
            SectionShell(title: "Strength") {
                AppErrorStateView(title: "Failed to load progress", message: message) {
                    Task { await viewModel.load() }
                }
            }
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
                SectionShell(title: "Weekly total volume", subtitle: "Strength · kg · first week may be partial") {
                    TimeSeriesTrendChartView(
                        series: [TimeSeriesChartSeries(
                            id: "weekly-volume", name: "Volume (kg)", color: .accentColor,
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
                if progress.recentExercises.isEmpty {
                    SectionShell(title: "Exercise progress") {
                        AppEmptyStateView(
                            title: "No recent strength exercises",
                            message: "Log a strength set to see volume and estimated 1RM here for the next 10 days.",
                            systemImage: "chart.line.uptrend.xyaxis"
                        )
                    }
                } else {
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
        GroupBox {
            TimeSeriesTrendChartView(
                series: exerciseSeries(exercise),
                emptyMessage: "No sets in this period.",
                accessibilityLabel: "\(exercise.name) volume and estimated one-rep max chart",
                initialPeriod: .last8Weeks,
                onVisibleRangeChange: { start, _ in Task { await viewModel.extendHistory(to: start) } }
            )
        } label: {
            NavigationLink(value: WorkoutsRoute.exerciseDetail(exercise.id)) {
                VStack(alignment: .leading, spacing: NeoGymTheme.spacingXXS) {
                    HStack(spacing: NeoGymTheme.spacingXS) {
                        Text(exercise.name).font(.title2.bold()).tracking(-0.4)
                        Spacer(minLength: NeoGymTheme.spacingSM)
                        Image(systemName: "chevron.right")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(NeoGymTheme.mutedText)
                    }
                    Text("Session volume & estimated 1RM · kg")
                        .font(.subheadline)
                        .foregroundStyle(NeoGymTheme.mutedText)
                }
                .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint("Opens exercise details")
        }
        .groupBoxStyle(.automatic)
    }

    private func exerciseSeries(_ exercise: StrengthExerciseTrend) -> [TimeSeriesChartSeries] {
        [
            TimeSeriesChartSeries(
                id: "\(exercise.id)-volume", name: "Volume (kg)", color: .accentColor,
                points: exercise.points.compactMap { point in
                    guard let date = point.date else { return nil }
                    return TimeSeriesChartDataPoint(id: point.id, date: date, value: point.volume)
                },
                valueFormatter: { "\($0.formatted(.number.precision(.fractionLength(0)))) kg" }
            ),
            TimeSeriesChartSeries(
                id: "\(exercise.id)-one-rep-max", name: "Est. 1RM (kg)", color: .orange, axis: .right,
                points: exercise.points.compactMap { point in
                    guard let date = point.date, let estimate = point.estimatedOneRepMax else { return nil }
                    return TimeSeriesChartDataPoint(id: point.id, date: date, value: estimate)
                },
                valueFormatter: { String(format: "%.1f kg", $0) }
            )
        ]
    }
}
