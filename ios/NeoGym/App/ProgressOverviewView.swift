import NeoGymKit
import SwiftUI

/// Progress › Overview, the Progress tab's first section: one card per
/// section with "See all". Muscles and Strength read the area root's view
/// models (so their sections open already loaded); Body and Energy read the
/// cached measurement list and the last 30 days of calories.
struct ProgressOverviewView: View {
    @ObservedObject var muscleModel: MuscleSetProgressViewModel
    @ObservedObject var strengthModel: StrengthProgressViewModel
    @Binding var muscleLoadedToken: Int?
    @Binding var strengthLoadedToken: Int?
    /// Bumped by the shell after training mutations.
    let trainingRevision: Int
    /// Bumped after Body and Energy edits in this tab.
    let reloadToken: Int
    let onSeeAll: (ProgressSection) -> Void

    @StateObject private var bodyModel: BodyMeasurementsListViewModel
    @StateObject private var calorieModel: NutritionCalorieHistoryViewModel
    @Environment(\.scenePhase) private var scenePhase

    init(
        muscleModel: MuscleSetProgressViewModel,
        strengthModel: StrengthProgressViewModel,
        muscleLoadedToken: Binding<Int?>,
        strengthLoadedToken: Binding<Int?>,
        trainingRevision: Int,
        reloadToken: Int,
        bodyRepository: any BodyMeasurementsRepositoryProtocol,
        nutritionRepository: any NutritionFoodMealRepositoryProtocol,
        onSeeAll: @escaping (ProgressSection) -> Void
    ) {
        self.muscleModel = muscleModel
        self.strengthModel = strengthModel
        _muscleLoadedToken = muscleLoadedToken
        _strengthLoadedToken = strengthLoadedToken
        self.trainingRevision = trainingRevision
        self.reloadToken = reloadToken
        self.onSeeAll = onSeeAll
        _bodyModel = StateObject(wrappedValue: BodyMeasurementsListViewModel(repository: bodyRepository))
        _calorieModel = StateObject(wrappedValue: NutritionCalorieHistoryViewModel(repository: nutritionRepository))
    }

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: NeoGymTheme.spacingSM) {
                AreaSectionHeader()
                musclesCard
                strengthCard
                bodyCard
                energyCard
            }
            .frame(maxWidth: NeoGymTheme.contentMaxWidth)
            .padding(.horizontal, NeoGymTheme.screenHorizontalPadding)
            .padding(.bottom, NeoGymTheme.spacingXL)
            .frame(maxWidth: .infinity)
        }
        .modifier(ProgressLoadModifier(model: muscleModel, reloadToken: trainingRevision, loadedToken: $muscleLoadedToken))
        .modifier(ProgressLoadModifier(model: strengthModel, reloadToken: trainingRevision, loadedToken: $strengthLoadedToken))
        .task(id: reloadToken) { await loadBodyAndCalories(useCache: true) }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task { await loadBodyAndCalories(useCache: false) }
        }
        .refreshable {
            async let muscles: Void = muscleModel.load()
            async let strength: Void = strengthModel.load()
            async let rest: Void = loadBodyAndCalories(useCache: false)
            _ = await (muscles, strength, rest)
        }
    }

    private func loadBodyAndCalories(useCache: Bool) async {
        async let body: Void = bodyModel.load()
        async let calories: Void = calorieModel.load(
            range: ChartHistoryRange.recentDays(Self.windowDays),
            cacheCandidates: useCache ? ChartHistoryRange.recentCacheCandidates(Self.windowDays) : []
        )
        _ = await (body, calories)
    }

    // MARK: - Muscles

    private var musclesCard: some View {
        OverviewCard(title: "Muscles") { onSeeAll(.muscles) } content: {
            if let overview = MuscleSetOverview(rows: muscleModel.rows ?? []) {
                VStack(alignment: .leading, spacing: 2) {
                    MetricValueText(value: MetricFormat.trimmed(overview.totalWeightedSets, digits: 1), unit: "weighted sets · 7 days")
                    Text("Direct sets plus half of secondary")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(NeoGymTheme.textSecondary)
                }
                .accessibilityElement(children: .combine)
                muscleBars(overview.mostTrained)
                if !overview.leastTrained.isEmpty {
                    Text("Lowest: " + overview.leastTrained.map { "\($0.muscleName) \(Self.sets($0.rollingWeightedSets))" }
                        .joined(separator: " · "))
                        .font(.footnote)
                        .monospacedDigit()
                        .foregroundStyle(NeoGymTheme.textSecondary)
                }
            } else {
                OverviewPlaceholder(
                    state: muscleModel.rows == nil ? placeholderState(muscleModel.state) : .empty,
                    emptyMessage: "No strength sets in the last 7 days."
                )
            }
        }
    }

    private func muscleBars(_ rows: [MuscleSetProgressRow]) -> some View {
        let maxSets = rows.map(\.rollingWeightedSets).max() ?? 1
        return VStack(alignment: .leading, spacing: 2) {
            ForEach(rows) { row in
                AdaptiveRow(spacing: NeoGymTheme.spacingSM) {
                    Text(row.muscleName)
                        .font(.subheadline)
                        .foregroundStyle(NeoGymTheme.text)
                        .lineLimit(1)
                        .frame(width: 104, alignment: .leading)
                    GeometryReader { proxy in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 3).fill(NeoGymTheme.fill)
                            RoundedRectangle(cornerRadius: 3).fill(NeoGymTheme.chart1)
                                .frame(width: proxy.size.width * min(row.rollingWeightedSets / maxSets, 1))
                        }
                    }
                    .frame(height: 10)
                    Text(Self.sets(row.rollingWeightedSets))
                        .font(.subheadline.weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(NeoGymTheme.text)
                        .frame(minWidth: 34, alignment: .trailing)
                }
                .frame(minHeight: 26)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Most trained muscles over the last 7 days")
        .accessibilityValue(rows.map { "\($0.muscleName) \(Self.sets($0.rollingWeightedSets))" }.joined(separator: ", "))
    }

    private static func sets(_ value: Double) -> String {
        MetricFormat.trimmed(value, digits: 1)
    }

    // MARK: - Strength

    private var strengthCard: some View {
        OverviewCard(title: "Strength") { onSeeAll(.strength) } content: {
            if let progress = strengthModel.progress, let overview = StrengthWeeklyOverview(progress: progress) {
                VStack(alignment: .leading, spacing: 2) {
                    if let best = overview.bestWeek {
                        MetricValueText(
                            value: MetricFormat.compact(best.volume),
                            unit: "kg · best week, \(best.weekStart.formatted(.dateTime.day().month(.abbreviated)))"
                        )
                    }
                    Text(thisWeekCaption(overview.thisWeek))
                        .font(.footnote.weight(.semibold))
                        .monospacedDigit()
                        .foregroundStyle(NeoGymTheme.textSecondary)
                }
                .accessibilityElement(children: .combine)
                TimeSeriesChartView(
                    series: [TimeSeriesChartSeries(
                        id: "overview-weekly-volume", name: "Volume", color: NeoGymTheme.chart1,
                        points: overview.fullWeeks.map { week in
                            TimeSeriesChartDataPoint(id: week.weekStart.ISO8601Format(), date: week.weekStart, value: week.volume)
                        } + [overview.thisWeek].compactMap { $0 }.map { week in
                            TimeSeriesChartDataPoint(
                                id: week.weekStart.ISO8601Format(), date: week.weekStart, value: week.volume, isPartial: true
                            )
                        },
                        valueFormatter: { "\(MetricFormat.compact($0)) kg" }
                    )],
                    showsAxes: false,
                    showsLegend: false,
                    accessibilityLabel: "Weekly strength volume"
                )
                .frame(height: 80)
                if let first = overview.fullWeeks.first ?? overview.thisWeek {
                    OverviewDateRange(
                        start: "Week of \(first.weekStart.formatted(.dateTime.day().month(.abbreviated)))",
                        end: overview.thisWeek == nil ? nil : "This week"
                    )
                }
            } else {
                OverviewPlaceholder(
                    state: strengthModel.rows == nil ? placeholderState(strengthModel.state) : .empty,
                    emptyMessage: "No strength sets logged yet."
                )
            }
        }
    }

    private func thisWeekCaption(_ week: StrengthWeeklyVolume?) -> String {
        guard let week, week.volume > 0 else { return "No sets this week yet" }
        return "This week so far \(MetricFormat.compact(week.volume)), dashed"
    }

    // MARK: - Body

    /// Body and Energy cover the same 30 days as their sections' charts.
    private static let windowDays = 30

    /// The 7-day averages above one chart that pairs them: weight on the left
    /// axis, body fat on the right, both starting at the same height (a
    /// summary card may pair units; the Body tab keeps one per chart).
    private var bodyCard: some View {
        OverviewCard(title: "Body") { onSeeAll(.body) } content: {
            if bodyModel.state.value == nil {
                OverviewPlaceholder(state: placeholderState(bodyModel.state), emptyMessage: "")
            } else {
                let today = IntakeGrouping.formatLocalDate()
                let firstDay = IntakeGrouping.addLocalDateDays(today, days: -(Self.windowDays - 1))
                let summary = BodyTrendSummary(points: bodyModel.trendData.points, today: today)
                let weight = summary.weight.rollingAverage.filter { $0.day >= firstDay }
                let fat = summary.bodyFat.rollingAverage.filter { $0.day >= firstDay }
                if weight.isEmpty && fat.isEmpty {
                    OverviewPlaceholder(state: .empty, emptyMessage: "No measurements in the last 30 days.")
                } else {
                    AdaptiveRow(spacing: NeoGymTheme.spacingMD, alignment: .top) {
                        if !weight.isEmpty {
                            bodyColumn("Weight", summary.weight, unit: "kg", color: NeoGymTheme.chart1)
                        }
                        if !fat.isEmpty {
                            bodyColumn("Body fat", summary.bodyFat, unit: "%", color: NeoGymTheme.chart2)
                        }
                    }
                    TimeSeriesChartView(
                        series: [
                            TimeSeriesChartSeries(
                                id: "overview-weight-average", name: "Weight · 7-day avg", color: NeoGymTheme.chart1,
                                points: BodyMetricTrendCard.points(weight),
                                valueFormatter: { "\(MetricFormat.decimal($0)) kg" }
                            ),
                            TimeSeriesChartSeries(
                                id: "overview-body-fat-average", name: "Body fat · 7-day avg", color: NeoGymTheme.chart2,
                                axis: .right, points: BodyMetricTrendCard.points(fat),
                                valueFormatter: { "\(MetricFormat.decimal($0)) %" }
                            )
                        ],
                        showsLegend: false,
                        showsMiddleDate: false,
                        accessibilityLabel: "Weight and body fat 7-day averages"
                    )
                    .frame(height: 130)
                }
            }
        }
    }

    private func bodyColumn(_ title: String, _ metric: BodyMetricTrend, unit: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 6) {
                LegendSwatch(color: color).accessibilityHidden(true)
                Text("\(title) · 7-day avg")
                    .font(.footnote)
                    .foregroundStyle(NeoGymTheme.textSecondary)
            }
            MetricValueText(
                value: metric.weekAverage.map { MetricFormat.decimal($0) } ?? "—",
                unit: unit,
                size: .title2.weight(.bold)
            )
            Text(metric.weekChange.map { "\(MetricFormat.signedDecimal($0)) vs prior 7 days" } ?? "No prior week to compare")
                .font(.footnote.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(NeoGymTheme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    // MARK: - Energy

    private var energyCard: some View {
        OverviewCard(title: "Energy") { onSeeAll(.energy) } content: {
            if let history = calorieModel.history {
                let today = IntakeGrouping.formatLocalDate()
                let firstDay = IntakeGrouping.addLocalDateDays(today, days: -(Self.windowDays - 1))
                let trend = CalorieTrend(history: history, today: today)
                let net = trend.net.filter { $0.day >= firstDay }
                let average = trend.netAverage.filter { $0.day >= firstDay }
                if let latest = trend.latestNetAverage, !net.isEmpty {
                    VStack(alignment: .leading, spacing: 2) {
                        MetricValueText(value: MetricFormat.signedWhole(latest), unit: "kcal net · 7-day avg")
                        if let consumed = trend.latestConsumedAverage, let burned = trend.latestBurnedAverage {
                            Text("Consumed \(MetricFormat.whole(consumed)) · burned \(MetricFormat.whole(burned)) per day")
                                .font(.footnote.weight(.semibold))
                                .monospacedDigit()
                                .foregroundStyle(NeoGymTheme.textSecondary)
                        }
                    }
                    .accessibilityElement(children: .combine)
                    TimeSeriesChartView(
                        series: [
                            TimeSeriesChartSeries(
                                id: "overview-net-daily", name: "Daily", color: NeoGymTheme.chart2, style: .readings,
                                points: net.map(CalorieHistorySection.point), valueFormatter: CalorieHistorySection.signedKcalText
                            ),
                            TimeSeriesChartSeries(
                                id: "overview-net-average", name: "7-day avg", color: NeoGymTheme.chart2,
                                points: average.map(CalorieHistorySection.point),
                                valueFormatter: CalorieHistorySection.signedKcalText
                            )
                        ],
                        showsAxes: false,
                        showsLegend: false,
                        accessibilityLabel: "Net calories, daily and 7-day average"
                    )
                    .frame(height: 80)
                    if let first = net.first, let last = net.last {
                        OverviewDateRange(
                            start: TodayBodyCard.dayLabel(first.day),
                            end: last.day == first.day ? nil : TodayBodyCard.dayLabel(last.day)
                        )
                    }
                } else {
                    OverviewPlaceholder(
                        state: .empty,
                        emptyMessage: "No full days with food logged and energy recorded in the last 30 days."
                    )
                }
            } else {
                OverviewPlaceholder(state: placeholderState(calorieModel.state), emptyMessage: "")
            }
        }
    }

    private func placeholderState<Value>(_ state: Loadable<Value>) -> OverviewPlaceholder.State {
        if case let .failed(message, _) = state { return .failed(message) }
        return .loading
    }
}

/// A Progress › Overview card: the section title with "See all", then content.
private struct OverviewCard<Content: View>: View {
    let title: String
    let onSeeAll: () -> Void
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: NeoGymTheme.spacingXS) {
            HStack {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(NeoGymTheme.text)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                Button(action: onSeeAll) {
                    HStack(spacing: 2) {
                        Text("See all")
                        Image(systemName: "chevron.right")
                            .font(.footnote.weight(.semibold))
                    }
                    .frame(minHeight: NeoGymTheme.minimumTapTarget)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .foregroundStyle(NeoGymTheme.accentText)
                .accessibilityLabel("See all \(title.lowercased())")
            }
            content
        }
        .padding(.horizontal, NeoGymTheme.spacingMD)
        .padding(.top, NeoGymTheme.spacingXXS)
        .padding(.bottom, NeoGymTheme.spacingMD)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardSurface()
    }
}

/// First and last labels under a sparkline.
private struct OverviewDateRange: View {
    let start: String
    let end: String?

    var body: some View {
        HStack {
            Text(start)
            Spacer()
            if let end { Text(end) }
        }
        .font(.caption2)
        .monospacedDigit()
        .foregroundStyle(NeoGymTheme.textTertiary)
        .accessibilityHidden(true)
    }
}

private struct OverviewPlaceholder: View {
    enum State {
        case loading
        case failed(String)
        case empty
    }

    let state: State
    let emptyMessage: String

    var body: some View {
        switch state {
        case .loading:
            ProgressView()
                .frame(maxWidth: .infinity, minHeight: 60)
        case let .failed(message):
            Text("Couldn't load: \(message)")
                .font(.footnote)
                .foregroundStyle(NeoGymTheme.textSecondary)
        case .empty:
            Text(emptyMessage)
                .font(.subheadline)
                .foregroundStyle(NeoGymTheme.textSecondary)
        }
    }
}
