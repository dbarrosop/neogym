import NeoGymKit
import SwiftUI

struct WorkoutProgressView: View {
    @StateObject private var viewModel: WorkoutProgressViewModel
    let reloadToken: Int

    init(repository: any SessionsRepositoryProtocol, reloadToken: Int) {
        _viewModel = StateObject(wrappedValue: WorkoutProgressViewModel(repository: repository))
        self.reloadToken = reloadToken
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                Text("Weekly total volume, plus session volume and estimated one-rep max for exercises logged in the last 10 days.")
                    .font(.subheadline)
                    .foregroundColor(NeoGymTheme.mutedText)
                content
            }
            .frame(maxWidth: 760)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.vertical, NeoGymTheme.screenVerticalPadding)
            .frame(maxWidth: .infinity)
        }
        .navigationTitle("Progress")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if case .idle = viewModel.state { await viewModel.load() }
        }
        .onChange(of: reloadToken) { Task { await viewModel.load() } }
        .refreshable { await viewModel.load() }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            SectionShell(title: "Progress") { AppLoadingStateView(title: "Loading progress") }
        case .loading where viewModel.progress == nil:
            SectionShell(title: "Progress") { AppLoadingStateView(title: "Loading progress") }
        case let .failed(message, _) where viewModel.progress == nil:
            SectionShell(title: "Progress") {
                AppErrorStateView(title: "Failed to load progress", message: message) {
                    Task { await viewModel.load() }
                }
            }
        default:
            if let progress = viewModel.progress {
                SectionShell(title: "Weekly total volume", subtitle: "Strength · kg · all exercises") {
                    TimeSeriesTrendChartView(
                        series: [TimeSeriesChartSeries(
                            id: "weekly-volume",
                            name: "Volume (kg)",
                            color: .accentColor,
                            points: progress.weeklyVolume.map { week in
                                TimeSeriesChartDataPoint(
                                    id: week.weekStart.ISO8601Format(),
                                    date: week.weekStart,
                                    value: week.volume
                                )
                            },
                            valueFormatter: { "\(Int($0.rounded()).formatted()) kg" }
                        )],
                        emptyMessage: "No strength sets in this period.",
                        accessibilityLabel: "Weekly strength volume chart",
                        initialPeriod: .last8Weeks
                    )
                }
                if progress.recentExercises.isEmpty {
                    SectionShell(title: "Exercise progress") {
                        AppEmptyStateView(
                            title: "No recent strength exercises",
                            message: "Log a strength set to see its volume and estimated 1RM progress here for the next 10 days.",
                            systemImage: "chart.line.uptrend.xyaxis"
                        )
                    }
                } else {
                    ForEach(progress.recentExercises) { exercise in
                        SectionShell(title: exercise.name, subtitle: "Session volume & estimated 1RM · kg") {
                            TimeSeriesTrendChartView(
                                series: exerciseSeries(for: exercise),
                                emptyMessage: "No sets in this period.",
                                accessibilityLabel: "\(exercise.name) volume and estimated one-rep max chart",
                                initialPeriod: .last8Weeks
                            )
                        }
                    }
                }
            }
        }
    }

    private func exerciseSeries(for exercise: WorkoutExerciseTrend) -> [TimeSeriesChartSeries] {
        let points = exercise.points.enumerated().map { index, point in
            (id: "\(exercise.id)-\(index)", point: point)
        }
        return [
            TimeSeriesChartSeries(
                id: "\(exercise.id)-volume",
                name: "Volume (kg)",
                color: .accentColor,
                points: points.map { item in
                    TimeSeriesChartDataPoint(id: item.id, date: item.point.date, value: item.point.volume)
                },
                valueFormatter: { "\(Int($0.rounded()).formatted()) kg" }
            ),
            TimeSeriesChartSeries(
                id: "\(exercise.id)-one-rep-max",
                name: "Est. 1RM (kg)",
                color: .orange,
                axis: .right,
                points: points.map { item in
                    TimeSeriesChartDataPoint(id: item.id, date: item.point.date, value: item.point.oneRepMax)
                },
                valueFormatter: { String(format: "%.1f kg", $0) }
            )
        ]
    }
}
