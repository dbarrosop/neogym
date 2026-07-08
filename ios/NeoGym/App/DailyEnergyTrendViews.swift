import NeoGymKit
import SwiftUI

struct DailyEnergyTrendChartView: View {
    let trendData: DailyEnergyTrendData

    private var chartSeries: [TimeSeriesChartSeries] {
        [
            TimeSeriesChartSeries(
                id: "active",
                name: "Active (kcal)",
                color: .orange,
                points: trendData.points.compactMap { point in
                    point.activeKcal.map {
                        TimeSeriesChartDataPoint(id: "\(point.id)-active", date: point.date, value: $0)
                    }
                },
                valueFormatter: DailyEnergyFormatters.axisKcal
            ),
            TimeSeriesChartSeries(
                id: "resting",
                name: "Resting (kcal)",
                color: .blue,
                points: trendData.points.compactMap { point in
                    point.restingKcal.map {
                        TimeSeriesChartDataPoint(id: "\(point.id)-resting", date: point.date, value: $0)
                    }
                },
                valueFormatter: DailyEnergyFormatters.axisKcal
            )
        ]
    }

    var body: some View {
        TimeSeriesTrendChartView(
            series: chartSeries,
            maxRenderedPoints: 48,
            emptyMessage: "No energy entries in this range.",
            accessibilityLabel: "Active and resting energy trend chart",
            initialPeriod: .last90Days
        )
    }
}

#Preview("Daily energy") {
    DailyEnergyNavigationView(repository: PreviewDailyEnergyRepository())
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
