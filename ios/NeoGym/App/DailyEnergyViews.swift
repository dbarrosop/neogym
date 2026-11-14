import NeoGymKit
import SwiftUI

struct DailyEnergyListView: View {
    @StateObject private var viewModel: DailyEnergyListViewModel
    @StateObject private var calorieViewModel: NutritionCalorieHistoryViewModel
    @State private var calorieRange = ChartHistoryRange.recentDays(30)
    let reloadToken: Int
    let nutritionRepository: any NutritionFoodMealRepositoryProtocol
    @State private var estimateRefreshToken = 0
    @Environment(\.energyWidgetUpdates) private var widgetUpdates
    @Environment(\.demoActions) private var demoActions

    init(repository: any DailyEnergyRepositoryProtocol,
         nutritionRepository: any NutritionFoodMealRepositoryProtocol, reloadToken: Int) {
        self.nutritionRepository = nutritionRepository
        _viewModel = StateObject(wrappedValue: DailyEnergyListViewModel(repository: repository))
        _calorieViewModel = StateObject(wrappedValue: NutritionCalorieHistoryViewModel(repository: nutritionRepository))
        self.reloadToken = reloadToken
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
                AreaSectionHeader()
                content
            }
            .frame(maxWidth: NeoGymTheme.contentMaxWidth)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.bottom, NeoGymTheme.spacingXL)
            .frame(maxWidth: .infinity)
        }
        .task {
            if case .idle = viewModel.state {
                await loadEnergyAndRefreshWidget()
            }
        }
        .task(id: calorieRange) {
            await calorieViewModel.load(
                range: calorieRange,
                cacheCandidates: calorieRange == ChartHistoryRange.recentDays(30)
                    ? ChartHistoryRange.recentCacheCandidates(30) : []
            )
        }
        .onChange(of: reloadToken) { Task { await refresh() } }
        .refreshable { await refresh() }
    }

    private func refresh() async {
        async let energy: Void = loadEnergyAndRefreshWidget()
        async let calories: Void = calorieViewModel.load(range: calorieRange)
        _ = await (energy, calories)
    }

    private func loadEnergyAndRefreshWidget() async {
        await viewModel.load()
        estimateRefreshToken += 1
        widgetUpdates.reload()
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            AppLoadingStateView(title: "Loading energy entries")
        case .loading where viewModel.entries.isEmpty:
            AppLoadingStateView(title: "Loading energy entries")
        case let .failed(message, _) where viewModel.entries.isEmpty:
            AppErrorStateView(title: "Couldn't load energy entries", message: message) {
                Task { await refresh() }
            }
            .cardSurface()
        default:
            if viewModel.trendData.shouldShowChart {
                trendCard
            }
            TodayEnergyEstimateSection(repository: nutritionRepository, refreshToken: estimateRefreshToken)
            CalorieHistorySection(viewModel: calorieViewModel, range: $calorieRange)
            if demoActions == nil {
                HealthSyncStatusRow(title: "Imported by Apple Watch", detail: "The watch refreshes the last 7 days automatically")
            } else {
                Text("Fictional demo energy · Apple Watch is not connected")
                    .font(.caption)
                    .foregroundStyle(NeoGymTheme.textSecondary)
            }
            if viewModel.entries.isEmpty {
                AppEmptyStateView(
                    title: "No energy entries yet",
                    message: "Log active or resting energy with the + button, or connect your Apple Watch under Me › Account.",
                    systemImage: "flame"
                )
            } else {
                entryList
            }
        }
    }

    private var trendCard: some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
            if let average = DailyEnergyOutAverage(entries: viewModel.entries, today: IntakeGrouping.formatLocalDate()) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Average out · \(average.dayCount) full day\(average.dayCount == 1 ? "" : "s")")
                        .font(.footnote)
                        .foregroundStyle(NeoGymTheme.textSecondary)
                    MetricValueText(value: MetricFormat.whole(average.kcalPerDay), unit: "kcal / day")
                }
                .accessibilityElement(children: .combine)
            }
            DailyEnergyTrendChartView(trendData: viewModel.trendData)
        }
        .padding(NeoGymTheme.spacingMD)
        .cardSurface()
    }

    /// The latest five entries, a "5 of 41" count and Load more, which reads
    /// the next server page when the window passes the loaded entries.
    private var entryList: some View {
        let shown = viewModel.visibleEntries
        return VStack(alignment: .leading, spacing: NeoGymTheme.spacingXS) {
            EntryListHeader(title: "Entries · resting + active", count: viewModel.countLabel)
            VStack(spacing: 0) {
                ForEach(shown) { entry in
                    NavigationLink(value: ProgressRoute.energyDetail(entry.id)) {
                        DailyEnergyListRow(entry: entry)
                    }
                    .buttonStyle(.plain)
                    if entry.id != shown.last?.id { RowSeparator() }
                }
                if viewModel.canShowMore {
                    LoadMoreRow(isLoading: viewModel.isLoadingMore) {
                        Task { await viewModel.showMore() }
                    }
                }
                if let message = viewModel.loadMoreErrorMessage {
                    Text(message)
                        .font(.footnote)
                        .foregroundStyle(NeoGymTheme.destructive)
                        .padding(NeoGymTheme.spacingSM)
                }
            }
            .cardSurface()
        }
    }
}

private struct DailyEnergyListRow: View {
    let entry: DailyEnergy

    var body: some View {
        HStack(spacing: NeoGymTheme.spacingSM) {
            HStack(spacing: 6) {
                Text(DateOnly.parse(entry.energyOn)?.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated)) ?? entry.energyOn)
                    .font(.subheadline)
                    .foregroundStyle(NeoGymTheme.text)
                if HealthImportMarker.isImported(entry.notes) {
                    HealthImportHeart()
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if let notes = entry.notes, !notes.isEmpty, !HealthImportMarker.isImported(notes) {
                Image(systemName: "note.text")
                    .font(.footnote)
                    .foregroundStyle(NeoGymTheme.textSecondary)
                    .accessibilityLabel("Has a note")
            }
            Text("\(MetricFormat.whole(entry.restingKcal ?? 0)) + \(MetricFormat.whole(entry.activeKcal ?? 0))")
                .font(.footnote)
                .foregroundStyle(NeoGymTheme.textSecondary)
                .accessibilityLabel("Resting \(MetricFormat.whole(entry.restingKcal ?? 0)), active \(MetricFormat.whole(entry.activeKcal ?? 0))")
            Text(MetricFormat.whole((entry.restingKcal ?? 0) + (entry.activeKcal ?? 0)))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(NeoGymTheme.text)
                .frame(minWidth: 52, alignment: .trailing)
            Image(systemName: "chevron.right")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(NeoGymTheme.textTertiary)
                .accessibilityHidden(true)
        }
        .monospacedDigit()
        .padding(.horizontal, NeoGymTheme.spacingMD)
        .frame(minHeight: NeoGymTheme.minimumTapTarget)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}
