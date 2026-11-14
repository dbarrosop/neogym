import NeoGymKit
import SwiftUI

struct MuscleSetProgressView: View {
    @ObservedObject var viewModel: MuscleSetProgressViewModel
    @State private var selectedMuscle: String?
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
            AppLoadingStateView(title: "Loading progress")
        case let .failed(message, _) where viewModel.rows == nil:
            AppErrorStateView(title: "Couldn't load progress", message: message) {
                Task { await viewModel.load() }
            }
            .cardSurface()
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
                    AppEmptyStateView(
                        title: "No strength sets",
                        message: "Log a non-stretching strength set with reps above zero to see sets by muscle here.",
                        systemImage: "chart.bar"
                    )
                } else {
                    if let muscle = activeMuscle(in: latest),
                       let current = latest.first(where: { $0.muscleGroup == muscle }) {
                        historyCard(current, rows: rows)
                    }
                    setsByMuscle(latest)
                }
                if case let .failed(message, _) = viewModel.state {
                    FeedbackBanner(message: "Could not refresh progress: \(message)")
                }
            }
        }
    }

    private func historyCard(_ current: MuscleSetProgressRow, rows: [MuscleSetProgressRow]) -> some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingXS) {
            HStack(alignment: .firstTextBaseline) {
                Text(current.muscleName)
                    .font(.headline)
                    .foregroundStyle(NeoGymTheme.text)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                Text("Up to 1 year")
                    .font(.footnote)
                    .foregroundStyle(NeoGymTheme.textSecondary)
            }
            MetricValueText(value: Self.sets(current.rollingWeightedSets), unit: "weighted sets · 7 days")
            TimeSeriesTrendChartView(
                series: [TimeSeriesChartSeries(
                    id: current.muscleGroup,
                    name: "Weighted sets",
                    color: NeoGymTheme.chart1,
                    includesZero: true,
                    points: rows.filter { $0.muscleGroup == current.muscleGroup }
                        .sorted { $0.day < $1.day }.compactMap { row in
                            guard let date = row.date(in: .current) else { return nil }
                            return TimeSeriesChartDataPoint(id: row.id, date: date, value: row.rollingWeightedSets)
                        },
                    valueFormatter: { "\(Self.sets($0)) sets" }
                )],
                emptyMessage: "No logged sets in this period.",
                accessibilityLabel: "\(current.muscleName) trailing seven-day weighted sets",
                initialPeriod: .last8Weeks,
                onVisibleRangeChange: { start, _ in
                    Task { await viewModel.extendHistory(to: start) }
                }
            )
        }
        .padding(NeoGymTheme.spacingMD)
        .cardSurface()
    }

    private func setsByMuscle(_ latest: [MuscleSetProgressRow]) -> some View {
        let maxWeighted = latest.map(\.rollingWeightedSets).max() ?? 1
        let active = activeMuscle(in: latest)
        return VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Trailing 7 days")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(NeoGymTheme.textSecondary)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                LegendItem(color: NeoGymTheme.accent, text: "Direct")
                LegendItem(color: Self.halfIndirectColor, text: "½ secondary")
            }
            .padding(.horizontal, NeoGymTheme.spacingMD)
            .padding(.vertical, NeoGymTheme.spacingXS)
            ForEach(latest) { row in
                muscleRow(row, bar: MuscleSetBar(row: row, maxWeighted: maxWeighted), isSelected: row.muscleGroup == active)
            }
        }
        .padding(.vertical, NeoGymTheme.spacingXS)
        .cardSurface()
    }

    private func muscleRow(_ row: MuscleSetProgressRow, bar: MuscleSetBar, isSelected: Bool) -> some View {
        Button {
            selectedMuscle = row.muscleGroup
        } label: {
            AdaptiveRow(spacing: NeoGymTheme.spacingSM) {
                Text(row.muscleName)
                    .font(.subheadline.weight(isSelected ? .semibold : .regular))
                    .foregroundStyle(NeoGymTheme.text)
                    .lineLimit(1)
                    .frame(width: 120, alignment: .leading)
                GeometryReader { proxy in
                    HStack(spacing: 1) {
                        UnevenRoundedRectangle(topLeadingRadius: 3, bottomLeadingRadius: 3)
                            .fill(NeoGymTheme.accent)
                            .frame(width: proxy.size.width * bar.direct)
                        UnevenRoundedRectangle(bottomTrailingRadius: 3, topTrailingRadius: 3)
                            .fill(Self.halfIndirectColor)
                            .frame(width: proxy.size.width * bar.halfIndirect)
                    }
                    .frame(maxHeight: .infinity, alignment: .center)
                }
                .frame(height: 12)
                Text(Self.sets(row.rollingWeightedSets))
                    .font(.subheadline.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(NeoGymTheme.text)
                    .frame(minWidth: 36, alignment: .trailing)
            }
            .padding(.horizontal, NeoGymTheme.spacingMD)
            .frame(minHeight: NeoGymTheme.minimumTapTarget)
            // Selected rows use the accent-soft highlight, as on the design and the web.
            .background(isSelected ? NeoGymTheme.accentSoft.opacity(0.6) : Color.clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(row.muscleName)
        .accessibilityValue(
            "\(Self.sets(row.rollingWeightedSets)) weighted sets, \(row.rollingDirectSets) direct, "
                + "\(row.rollingIndirectSets) secondary"
        )
        .accessibilityHint("Shows this muscle's history")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    private static var halfIndirectColor: Color { NeoGymTheme.accentText.opacity(0.5) }

    private static func sets(_ value: Double) -> String {
        value.rounded() == value ? String(format: "%.0f", value) : String(format: "%.1f", value)
    }

    private func activeMuscle(in rows: [MuscleSetProgressRow]) -> String? {
        if let selectedMuscle, rows.contains(where: { $0.muscleGroup == selectedMuscle }) {
            return selectedMuscle
        }
        return rows.first?.muscleGroup
    }
}
