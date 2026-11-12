import NeoGymKit
import SwiftUI
import WidgetKit

struct DailyEnergyListView: View {
    @StateObject private var viewModel: DailyEnergyListViewModel
    let reloadToken: Int
    let nutritionRepository: any NutritionFoodMealRepositoryProtocol
    @State private var estimateRefreshToken = 0

    init(repository: any DailyEnergyRepositoryProtocol,
         nutritionRepository: any NutritionFoodMealRepositoryProtocol, reloadToken: Int) {
        self.nutritionRepository = nutritionRepository
        _viewModel = StateObject(wrappedValue: DailyEnergyListViewModel(repository: repository))
        self.reloadToken = reloadToken
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                AreaSectionHeader()
                TodayEnergyEstimateSection(repository: nutritionRepository, refreshToken: estimateRefreshToken)
                CalorieHistorySection(repository: nutritionRepository, reloadToken: reloadToken)
                content
            }
            .frame(maxWidth: 760)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.vertical, NeoGymTheme.screenVerticalPadding)
            .frame(maxWidth: .infinity)
        }
        .task {
            if case .idle = viewModel.state {
                await loadAndRefreshWidget()
            }
        }
        .onChange(of: reloadToken) { Task { await loadAndRefreshWidget() } }
        .refreshable { await loadAndRefreshWidget() }
    }

    private func loadAndRefreshWidget() async {
        await viewModel.load()
        estimateRefreshToken += 1
        WidgetCenter.shared.reloadTimelines(ofKind: EnergyBalanceWidgetConstants.widgetKind)
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            SectionShell(title: "Loading energy") {
                AppLoadingStateView(title: "Loading energy entries")
            }
        case .loading where viewModel.entries.isEmpty:
            SectionShell(title: "Loading energy") {
                AppLoadingStateView(title: "Loading energy entries")
            }
        case let .failed(message, _) where viewModel.entries.isEmpty:
            SectionShell(title: "Energy") {
                AppErrorStateView(title: "Failed to load energy entries", message: message) {
                    Task { await loadAndRefreshWidget() }
                }
            }
        default:
            if viewModel.entries.isEmpty {
                SectionShell(title: "No energy entries") {
                    VStack(spacing: 16) {
                        AppEmptyStateView(
                            title: "No energy entries yet",
                            message: "Log active or resting energy to start seeing trends.",
                            systemImage: "flame"
                        )
                        NavigationLink(value: ProgressRoute.energyCreate) {
                            Label("Log your first energy entry", systemImage: "plus")
                        }
                        .buttonStyle(NeoGymPrimaryButtonStyle())
                    }
                }
            } else {
                VStack(spacing: 14) {
                    if viewModel.trendData.shouldShowChart {
                        SectionShell(title: "Energy over time", subtitle: "Trend") {
                            DailyEnergyTrendChartView(trendData: viewModel.trendData)
                        }
                    }
                    SectionShell(title: "Energy", subtitle: "Newest first") {
                        VStack(spacing: 0) {
                            ForEach(viewModel.entries) { entry in
                                NavigationLink(value: ProgressRoute.energyDetail(entry.id)) {
                                    DailyEnergyListRow(entry: entry)
                                }
                                if entry.id != viewModel.entries.last?.id { Divider() }
                            }
                            if viewModel.hasMore {
                                Divider()
                                Button {
                                    Task { await viewModel.loadMore() }
                                } label: {
                                    if viewModel.isLoadingMore {
                                        ProgressView()
                                            .frame(maxWidth: .infinity)
                                    } else {
                                        Text("Load more")
                                            .frame(maxWidth: .infinity)
                                    }
                                }
                                .buttonStyle(NeoGymSecondaryButtonStyle())
                                .padding(.top, 12)
                            }
                            if let message = viewModel.loadMoreErrorMessage {
                                Text(message)
                                    .font(.caption)
                                    .foregroundStyle(NeoGymTheme.destructive)
                                    .padding(.top, 8)
                            }
                        }
                    }
                }
            }
        }
    }
}

private struct DailyEnergyListRow: View {
    let entry: DailyEnergy

    var body: some View {
        HStack(spacing: 12) {
            DailyEnergyDateBadge(energyOn: entry.energyOn)
            VStack(alignment: .leading, spacing: 4) {
                Text(DateOnly.formatLong(entry.energyOn))
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(NeoGymTheme.text)
                Text(DailyEnergyFormatters.values(activeKcal: entry.activeKcal, restingKcal: entry.restingKcal))
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.textSecondary)
                if let notes = entry.notes, !notes.isEmpty {
                    Text(notes)
                        .lineLimit(1)
                        .font(.caption2)
                        .foregroundColor(NeoGymTheme.textSecondary)
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.bold))
                .foregroundColor(NeoGymTheme.textSecondary)
        }
        .padding(.vertical, 10)
    }
}

private struct DailyEnergyDateBadge: View {
    let energyOn: String

    var body: some View {
        VStack(spacing: 0) {
            Text(month)
                .font(.caption2.weight(.bold))
                .textCase(.uppercase)
                .foregroundColor(NeoGymTheme.textSecondary)
            Text(day)
                .font(.title3.weight(.bold))
                .foregroundStyle(NeoGymTheme.text)
        }
        .frame(width: 52, height: 52)
        .cardSurface(
            cornerRadius: NeoGymTheme.radiusMD,
            fill: NeoGymTheme.inset
        )
    }

    private var date: Date? { DateOnly.parse(energyOn) }

    private var month: String {
        guard let date else { return "—" }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM"
        return formatter.string(from: date)
    }

    private var day: String {
        guard let date else { return "—" }
        return String(Calendar.current.component(.day, from: date))
    }
}
