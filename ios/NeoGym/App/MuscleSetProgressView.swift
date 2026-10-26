import NeoGymKit
import SwiftUI

struct MuscleSetProgressView: View {
    @ObservedObject var viewModel: MuscleSetProgressViewModel
    @State private var selectedMuscle: String?
    let reloadToken: Int
    let isActive: Bool

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                Text("Logged strength sets with reps above zero, excluding stretching. A primary muscle gets one set; a secondary muscle gets half a set. Totals cover the trailing seven local days.")
                    .font(.subheadline)
                    .foregroundColor(NeoGymTheme.mutedText)
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
            SectionShell(title: "Muscle sets") { AppLoadingStateView(title: "Loading progress") }
        case let .failed(message, _) where viewModel.rows == nil:
            SectionShell(title: "Muscle sets") {
                AppErrorStateView(title: "Failed to load progress", message: message) {
                    Task { await viewModel.load() }
                }
            }
        default:
            if let rows = viewModel.rows {
                if let through = viewModel.cachedThrough {
                    FeedbackBanner(
                        message: viewModel.isShowingPartialHistory
                            ? "Showing cached progress through \(through); "
                                + "newer sessions or selected history may be missing."
                            : "Showing cached progress through \(through); newer sessions may be missing.",
                        tone: .info
                    )
                } else if viewModel.isShowingPartialHistory {
                    FeedbackBanner(message: "Showing partial history while the selected range refreshes.", tone: .info)
                }
                let latestDay = rows.map(\.day).max()
                let latest = rows.filter { $0.day == latestDay }
                    .sorted { left, right in
                        if left.rollingWeightedSets != right.rollingWeightedSets {
                            return left.rollingWeightedSets > right.rollingWeightedSets
                        }
                        return left.muscleName < right.muscleName
                    }
                if latest.isEmpty {
                    SectionShell(title: "Muscle sets") {
                        AppEmptyStateView(
                            title: "No strength sets",
                            message: "Log a non-stretching strength set with reps above zero to see sets by muscle here.",
                            systemImage: "chart.bar"
                        )
                    }
                } else {
                    SectionShell(title: "Sets by muscle", subtitle: "Trailing 7 days · direct + half of indirect") {
                        VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
                            ForEach(latest) { row in
                                Button {
                                    selectedMuscle = row.muscleGroup
                                } label: {
                                    HStack(alignment: .firstTextBaseline) {
                                        Text(row.muscleName)
                                            .font(.body.weight(row.muscleGroup == activeMuscle(in: latest) ? .semibold : .regular))
                                        Spacer()
                                        VStack(alignment: .trailing, spacing: 2) {
                                            Text(String(format: "%.1f sets", row.rollingWeightedSets))
                                                .font(.headline.monospacedDigit())
                                            Text("\(row.rollingDirectSets) direct + \(row.rollingIndirectSets) indirect")
                                                .font(.caption)
                                                .foregroundStyle(NeoGymTheme.mutedText)
                                        }
                                    }
                                    .frame(minHeight: 44)
                                    .contentShape(Rectangle())
                                }
                                .buttonStyle(.plain)
                                .accessibilityHint("Shows \(row.muscleName) set history")
                            }
                        }
                    }
                    if let muscle = activeMuscle(in: latest),
                       let name = latest.first(where: { $0.muscleGroup == muscle })?.muscleName {
                        SectionShell(title: "\(name) history", subtitle: "Trailing 7-day weighted sets · up to 1 year") {
                            TimeSeriesTrendChartView(
                                series: [TimeSeriesChartSeries(
                                    id: muscle,
                                    name: "Weighted sets",
                                    color: .accentColor,
                                    points: rows.filter { $0.muscleGroup == muscle }
                                        .sorted { $0.day < $1.day }.compactMap { row in
                                        guard let date = row.date(in: .current) else { return nil }
                                        return TimeSeriesChartDataPoint(
                                            id: row.id, date: date, value: row.rollingWeightedSets
                                        )
                                    },
                                    valueFormatter: { String(format: "%.1f sets", $0) }
                                )],
                                emptyMessage: "No logged sets in this period.",
                                accessibilityLabel: "\(name) weighted set history",
                                initialPeriod: .last8Weeks,
                                onVisibleRangeChange: { start, _ in
                                    Task { await viewModel.extendHistory(to: start) }
                                }
                            )
                        }
                    }
                }
                if case let .failed(message, _) = viewModel.state {
                    FeedbackBanner(message: "Could not refresh progress: \(message)")
                }
            }
        }
    }

    private func activeMuscle(in rows: [MuscleSetProgressRow]) -> String? {
        if let selectedMuscle, rows.contains(where: { $0.muscleGroup == selectedMuscle }) {
            return selectedMuscle
        }
        return rows.first?.muscleGroup
    }
}
