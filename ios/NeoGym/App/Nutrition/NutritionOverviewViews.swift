import NeoGymKit
import SwiftUI

struct NutritionOverviewView: View {
    let repository: any NutritionFoodMealRepositoryProtocol
    let bodyRepository: any BodyMeasurementsRepositoryProtocol
    let bodyHealthImporter: (any BodyMeasurementsHealthImporting)?
    let energyRepository: any DailyEnergyRepositoryProtocol
    let energyHealthImporter: (any DailyEnergyHealthImporting)?

    @StateObject private var viewModel: NutritionDaysListViewModel
    @StateObject private var bodyViewModel: BodyMeasurementsListViewModel
    @StateObject private var energySyncViewModel: DailyEnergyListViewModel

    init(
        repository: any NutritionFoodMealRepositoryProtocol,
        bodyRepository: any BodyMeasurementsRepositoryProtocol,
        bodyHealthImporter: (any BodyMeasurementsHealthImporting)?,
        energyRepository: any DailyEnergyRepositoryProtocol,
        energyHealthImporter: (any DailyEnergyHealthImporting)?
    ) {
        self.repository = repository
        self.bodyRepository = bodyRepository
        self.bodyHealthImporter = bodyHealthImporter
        self.energyRepository = energyRepository
        self.energyHealthImporter = energyHealthImporter
        _viewModel = StateObject(wrappedValue: NutritionDaysListViewModel(repository: repository))
        _bodyViewModel = StateObject(wrappedValue: BodyMeasurementsListViewModel(
            repository: bodyRepository,
            healthImporter: bodyHealthImporter
        ))
        _energySyncViewModel = StateObject(wrappedValue: DailyEnergyListViewModel(
            repository: energyRepository,
            healthImporter: energyHealthImporter
        ))
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                balanceOverview
                caloriesChart
                bodyChart
            }
            .frame(maxWidth: 720)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.top, NeoGymTheme.screenVerticalPadding)
            .padding(.bottom, NeoGymTheme.screenVerticalPadding)
            .frame(maxWidth: .infinity)
        }
        .task { await loadOverview() }
        .refreshable { await loadOverview() }
    }

    private var caloriesSeries: [TimeSeriesChartSeries] {
        [
            TimeSeriesChartSeries(
                id: "calories",
                name: "Consumed",
                color: .accentColor,
                points: viewModel.days.compactMap { day in
                    IntakeGrouping.localDateToDate(day.logDate).map { date in
                        TimeSeriesChartDataPoint(id: day.id, date: date, value: day.loggedTotals.kcal)
                    }
                },
                valueFormatter: kcalValueText
            ),
            TimeSeriesChartSeries(
                id: "net",
                name: "Net",
                color: .orange,
                axis: .right,
                centersAxisOnZero: true,
                points: viewModel.overview.dailyNetValues().compactMap { value in
                    IntakeGrouping.localDateToDate(value.date).map { date in
                        TimeSeriesChartDataPoint(id: "net-\(value.date)", date: date, value: value.net)
                    }
                },
                valueFormatter: signedKcalValueText
            ),
            TimeSeriesChartSeries(
                id: "rolling-net",
                name: "7-day avg net",
                color: .purple,
                axis: .right,
                centersAxisOnZero: true,
                points: viewModel.overview.rollingNetAverageValues(days: 7).compactMap { value in
                    IntakeGrouping.localDateToDate(value.date).map { date in
                        TimeSeriesChartDataPoint(id: "rolling-net-\(value.date)", date: date, value: value.net)
                    }
                },
                valueFormatter: signedKcalValueText
            )
        ]
    }

    private var bodySeries: [TimeSeriesChartSeries] {
        let trendData = bodyViewModel.trendData
        let rollingAverages = trendData.rollingAverageValues(days: 7)
        return [
            TimeSeriesChartSeries(
                id: "weight",
                name: "Weight",
                color: .accentColor,
                points: trendData.points.compactMap { point in
                    point.weightKg.map {
                        TimeSeriesChartDataPoint(id: "\(point.id)-weight", date: point.date, value: $0)
                    }
                },
                valueFormatter: weightValueText
            ),
            TimeSeriesChartSeries(
                id: "weight-rolling",
                name: "7-day avg weight",
                color: .green,
                points: rollingAverages.compactMap { average in
                    average.averageWeightKg.map {
                        TimeSeriesChartDataPoint(id: "\(average.id)-weight-avg", date: average.date, value: $0)
                    }
                },
                valueFormatter: weightValueText
            ),
            TimeSeriesChartSeries(
                id: "body-fat",
                name: "Body fat",
                color: .red,
                axis: .right,
                points: trendData.points.compactMap { point in
                    point.bodyFatPct.map {
                        TimeSeriesChartDataPoint(id: "\(point.id)-body-fat", date: point.date, value: $0)
                    }
                },
                valueFormatter: bodyFatValueText
            ),
            TimeSeriesChartSeries(
                id: "body-fat-rolling",
                name: "7-day avg body fat",
                color: .purple,
                axis: .right,
                points: rollingAverages.compactMap { average in
                    average.averageBodyFatPct.map {
                        TimeSeriesChartDataPoint(id: "\(average.id)-body-fat-avg", date: average.date, value: $0)
                    }
                },
                valueFormatter: bodyFatValueText
            )
        ]
    }

    private func loadOverview() async {
        async let bodyLoad: Void = bodyViewModel.load(shouldSyncHealthMeasurements: true)
        await energySyncViewModel.load(shouldSyncHealthEnergy: true)
        await viewModel.load()
        await bodyLoad
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
        return signedKcalValueText(net)
    }

    private func kcalValueText(_ value: Double) -> String {
        NutritionMath.formatMacro(value, unit: "kcal")
    }

    private func signedKcalValueText(_ value: Double) -> String {
        if value < 0 { return "−\(NutritionMath.formatMacro(abs(value), unit: "kcal"))" }
        if value > 0 { return "+\(NutritionMath.formatMacro(value, unit: "kcal"))" }
        return NutritionMath.formatMacro(0, unit: "kcal")
    }

    private func weightValueText(_ value: Double) -> String {
        String(format: "%.1f kg", value)
    }

    private func bodyFatValueText(_ value: Double) -> String {
        String(format: "%.1f %%", value)
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
        SectionShell(title: "Calories consumed", subtitle: "Consumed, net, and 7-day avg net") {
            switch viewModel.state {
            case .idle, .loading:
                AppLoadingStateView(message: "Loading calories…")
            case let .failed(message, _):
                AppErrorStateView(title: "Failed to load calories", message: message) { Task { await viewModel.load() } }
            case .loaded:
                TimeSeriesTrendChartView(
                    series: caloriesSeries,
                    maxRenderedPoints: 48,
                    emptyMessage: "No calorie or net data in this range.",
                    accessibilityLabel: "Calories consumed, net, and rolling average net per day",
                    initialPeriod: .last30Days
                )
            }
        }
    }

    @ViewBuilder
    private var bodyChart: some View {
        SectionShell(title: "Body composition", subtitle: "Weight, body fat, and 7-day averages") {
            switch bodyViewModel.state {
            case .idle, .loading:
                AppLoadingStateView(message: "Loading body measurements…")
            case let .failed(message, _) where bodyViewModel.measurements.isEmpty:
                AppErrorStateView(title: "Failed to load body measurements", message: message) {
                    Task { await bodyViewModel.load() }
                }
            default:
                TimeSeriesTrendChartView(
                    series: bodySeries,
                    maxRenderedPoints: 48,
                    emptyMessage: "No body measurements in this range.",
                    accessibilityLabel: "Weight, body fat, and rolling average trend chart",
                    initialPeriod: .last30Days
                )
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
