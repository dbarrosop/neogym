import NeoGymKit
import SwiftUI

struct NutritionOverviewView: View {
    let repository: any NutritionFoodMealRepositoryProtocol
    let openDay: (String) -> Void

    @StateObject private var viewModel: NutritionDaysListViewModel

    init(
        repository: any NutritionFoodMealRepositoryProtocol,
        openDay: @escaping (String) -> Void
    ) {
        self.repository = repository
        self.openDay = openDay
        _viewModel = StateObject(wrappedValue: NutritionDaysListViewModel(repository: repository))
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                SectionShell(
                    title: "Nutrition",
                    subtitle: "Dashboard"
                ) {
                    Text("Create foods, build meal and plan templates, then log what you actually ate on local calendar days.")
                        .font(.subheadline)
                        .foregroundColor(NeoGymTheme.mutedText)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                balanceOverview
                caloriesChart
                recentDays
            }
            .frame(maxWidth: 720)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.top, NeoGymTheme.screenVerticalPadding)
            .padding(.bottom, NeoGymTheme.screenVerticalPadding)
            .frame(maxWidth: .infinity)
        }
        .task { await viewModel.load() }
        .refreshable { await viewModel.load() }
    }

    private var caloriesSeries: [TimeSeriesChartSeries] {
        [
            TimeSeriesChartSeries(
                id: "calories",
                name: "Calories (kcal)",
                color: .accentColor,
                points: viewModel.days.compactMap { day in
                    IntakeGrouping.localDateToDate(day.logDate).map { date in
                        TimeSeriesChartDataPoint(id: day.id, date: date, value: day.loggedTotals.kcal)
                    }
                },
                valueFormatter: { String(format: "%.0f kcal", $0) }
            )
        ]
    }

    @ViewBuilder
    private var balanceOverview: some View {
        SectionShell(title: "Energy balance", subtitle: "Today and rolling 7-day net") {
            switch viewModel.state {
            case .idle, .loading:
                AppLoadingStateView(message: "Loading balance…")
            case let .failed(message, _):
                AppErrorStateView(title: "Failed to load balance", message: message) { Task { await viewModel.load() } }
            case .loaded:
                VStack(alignment: .leading, spacing: 12) {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: 10)], spacing: 10) {
                        overviewMetricTile(
                            label: "Consumed",
                            value: NutritionMath.formatMacro(viewModel.todayBalance.caloriesIn, unit: "kcal"),
                            caption: "Logged today"
                        )
                        overviewMetricTile(
                            label: "Burned",
                            value: viewModel.todayBalance.caloriesOut.map { NutritionMath.formatMacro($0, unit: "kcal") }
                                ?? "No energy",
                            caption: "Active + resting"
                        )
                        overviewMetricTile(
                            label: "Net today",
                            value: netValueText(viewModel.todayBalance.net),
                            caption: netCaption(for: viewModel.todayBalance.state)
                        )
                        if let average = viewModel.sevenDayNetAverage {
                            overviewMetricTile(
                                label: "7-day avg net",
                                value: netValueText(average.averageNet),
                                caption: "\(average.includedDayCount)/\(average.windowDayCount) days with intake + energy"
                            )
                        } else {
                            overviewMetricTile(
                                label: "7-day avg net",
                                value: "No data",
                                caption: "Log intake and energy to calculate"
                            )
                        }
                    }
                    Text("Net is logged intake minus active + resting energy. Negative means deficit; positive means surplus.")
                        .font(.caption)
                        .foregroundColor(NeoGymTheme.mutedText)
                }
            }
        }
    }

    private func overviewMetricTile(label: String, value: String, caption: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.caption.weight(.bold))
                .textCase(.uppercase)
                .foregroundColor(NeoGymTheme.mutedText)
            Text(value)
                .font(.title3.weight(.semibold))
                .foregroundColor(.primary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Text(caption)
                .font(.caption)
                .foregroundColor(NeoGymTheme.mutedText)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .nutritionGlassCard(cornerRadius: 14)
    }

    private func netValueText(_ net: Double?) -> String {
        guard let net else { return "No energy" }
        if net < 0 { return "−\(NutritionMath.formatMacro(abs(net), unit: "kcal"))" }
        if net > 0 { return "+\(NutritionMath.formatMacro(net, unit: "kcal"))" }
        return NutritionMath.formatMacro(0, unit: "kcal")
    }

    private func netCaption(for state: DailyCalorieBalanceState) -> String {
        switch state {
        case .deficit: "Deficit"
        case .surplus: "Surplus"
        case .balanced: "Balanced"
        case .intakeOnly: "Needs energy"
        }
    }

    @ViewBuilder
    private var caloriesChart: some View {
        SectionShell(title: "Calories consumed", subtitle: "Logged kcal per day") {
            switch viewModel.state {
            case .idle, .loading:
                AppLoadingStateView(message: "Loading calories…")
            case let .failed(message, _):
                AppErrorStateView(title: "Failed to load calories", message: message) { Task { await viewModel.load() } }
            case .loaded:
                TimeSeriesTrendChartView(
                    series: caloriesSeries,
                    maxRenderedPoints: 48,
                    emptyMessage: "No logged calories in this range.",
                    accessibilityLabel: "Calories consumed per day",
                    initialPeriod: .last30Days
                )
            }
        }
    }

    @ViewBuilder
    private var recentDays: some View {
        SectionShell(title: "Recent daily logs", subtitle: "Snapshot totals") {
            switch viewModel.state {
            case .idle, .loading:
                AppLoadingStateView(message: "Loading daily logs…")
            case let .failed(message, _):
                AppErrorStateView(title: "Failed to load daily logs", message: message) { Task { await viewModel.load() } }
            case .loaded:
                if viewModel.days.isEmpty {
                    AppEmptyStateView(
                        title: "No logged days yet",
                        message: "Open today to start logging foods and meals.",
                        systemImage: "calendar.badge.plus"
                    )
                } else {
                    VStack(spacing: 0) {
                        ForEach(viewModel.days.prefix(5)) { day in
                            Button {
                                openDay(day.logDate)
                            } label: {
                                NutritionDayRow(day: day)
                            }
                            .buttonStyle(.plain)
                            if day.id != viewModel.days.prefix(5).last?.id { Divider() }
                        }
                    }
                    .nutritionGlassCard(cornerRadius: 16)
                }
            }
        }
    }
}

struct NutritionDayRow: View {
    let day: NutritionDay

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "calendar")
                .foregroundColor(.accentColor)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 5) {
                Text(IntakeGrouping.formatLocalDateLabel(day.logDate))
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.primary)
                    .lineLimit(1)
                Text("\(day.allLogEntries.count) logged entr\(day.allLogEntries.count == 1 ? "y" : "ies")"
                    + (day.nutritionPlan.map { " · Plan: \($0.name)" } ?? ""))
                    .font(.caption)
                    .foregroundColor(NeoGymTheme.mutedText)
                MacroSummaryView(totals: day.loggedTotals, title: "", compact: true)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundColor(NeoGymTheme.mutedText)
        }
        .padding(12)
    }
}
