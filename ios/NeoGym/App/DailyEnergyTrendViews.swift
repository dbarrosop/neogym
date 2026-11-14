import NeoGymKit
import SwiftUI

/// Active (orange) and resting (blue) energy per day; today's partial row is
/// an open dot.
struct DailyEnergyTrendChartView: View {
    let trendData: DailyEnergyTrendData
    var today = IntakeGrouping.formatLocalDate()

    private var chartSeries: [TimeSeriesChartSeries] {
        [
            TimeSeriesChartSeries(
                id: "active",
                name: "Active (kcal)",
                color: NeoGymTheme.chart2,
                includesZero: true,
                points: trendData.points.compactMap { point in
                    point.activeKcal.map {
                        TimeSeriesChartDataPoint(
                            id: "\(point.id)-active", date: point.date, value: $0, isPartial: point.energyOn == today
                        )
                    }
                },
                valueFormatter: DailyEnergyFormatters.axisKcal
            ),
            TimeSeriesChartSeries(
                id: "resting",
                name: "Resting (kcal)",
                color: NeoGymTheme.chart1,
                includesZero: true,
                points: trendData.points.compactMap { point in
                    point.restingKcal.map {
                        TimeSeriesChartDataPoint(
                            id: "\(point.id)-resting", date: point.date, value: $0, isPartial: point.energyOn == today
                        )
                    }
                },
                valueFormatter: DailyEnergyFormatters.axisKcal
            )
        ]
    }

    var body: some View {
        TimeSeriesTrendChartView(
            series: chartSeries,
            emptyMessage: "No energy entries in this range.",
            accessibilityLabel: "Active and resting energy trend chart",
            initialPeriod: .last30Days
        )
    }
}

#Preview("Daily energy") {
    NavigationStack {
        DailyEnergyListView(repository: PreviewDailyEnergyRepository(),
                            nutritionRepository: PreviewNutritionFoodMealRepository(), reloadToken: 0)
    }
}

private struct PreviewDailyEnergyRepository: DailyEnergyRepositoryProtocol {
    func listEntries() async throws -> [DailyEnergy] {
        [
            DailyEnergy(id: "1", energyOn: "2026-06-01", activeKcal: 580, restingKcal: 1_620, notes: "Baseline"),
            DailyEnergy(id: "2", energyOn: "2026-06-12", activeKcal: 740, restingKcal: 1_645),
            DailyEnergy(id: "3", energyOn: "2026-06-25", activeKcal: 690, restingKcal: 1_610, notes: "Imported")
        ]
    }

    func entry(id: String) async throws -> DailyEnergy? {
        try await listEntries().first { $0.id == id }
    }

    func editEntry(id: String) async throws -> DailyEnergy? {
        try await entry(id: id)
    }

    func createEntry(_ values: DailyEnergyFormValues) async throws -> String { "new" }
    func updateEntry(id: String, values: DailyEnergyFormValues) async throws {}
    func deleteEntry(id: String) async throws {}
}
