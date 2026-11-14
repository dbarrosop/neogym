import Foundation
@testable import NeoGymKit
import XCTest

final class ProgressOverviewTests: XCTestCase {
    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        calendar.firstWeekday = 2
        return calendar
    }

    private func date(_ day: String) -> Date {
        DateOnly.parse(day, calendar: calendar)!
    }

    func testEntryWindowShowsFiveAtATimeWithACount() {
        var window = EntryHistoryWindow()
        let items = Array(1 ... 12)
        XCTAssertEqual(window.visible(items), [1, 2, 3, 4, 5])
        XCTAssertTrue(window.canShowMore(loadedCount: items.count))
        window.showMore()
        XCTAssertEqual(window.visible(items).count, 10)
        window.showMore()
        XCTAssertEqual(window.visible(items).count, 12)
        XCTAssertFalse(window.canShowMore(loadedCount: items.count))
        XCTAssertTrue(window.canShowMore(loadedCount: items.count, hasMoreRemote: true))
        XCTAssertEqual(EntryHistoryWindow.countLabel(shown: 5, total: 32), "5 of 32")
        XCTAssertNil(EntryHistoryWindow.countLabel(shown: 5, total: nil))
    }

    func testMuscleOverviewRanksTheLatestDay() throws {
        func row(_ group: String, _ direct: Int, _ indirect: Int, day: String = "2026-11-12") -> MuscleSetProgressRow {
            MuscleSetProgressRow(
                day: day, muscleGroup: group, rollingDirectSets: direct, rollingIndirectSets: indirect,
                rollingWeightedSets: Double(direct) + Double(indirect) / 2
            )
        }
        let rows = [
            row("quadriceps", 15, 0), row("triceps", 6, 14), row("biceps", 6, 12), row("front_delts", 6, 11),
            row("chest", 8, 6), row("lats", 6, 9), row("middle_back", 6, 6), row("traps", 3, 0),
            row("rear_delts", 0, 9), row("lower_back", 0, 9), row("shoulders", 0, 3), row("glutes", 0, 0),
            row("calves", 40, 0, day: "2026-11-11")
        ]
        let overview = try XCTUnwrap(MuscleSetOverview(rows: rows))
        XCTAssertEqual(overview.totalWeightedSets, 95.5)
        XCTAssertEqual(
            overview.mostTrained.map(\.muscleGroup),
            ["quadriceps", "triceps", "biceps", "front_delts", "chest", "lats"]
        )
        XCTAssertEqual(overview.leastTrained.map(\.muscleGroup), ["traps", "lower_back", "rear_delts"])
        XCTAssertNil(MuscleSetOverview(rows: [row("glutes", 0, 0)]))
    }

    func testStrengthOverviewSplitsThisWeeksPartialTotal() throws {
        let weeks = (0 ..< 10).map { index in
            StrengthWeeklyVolume(
                weekStart: calendar.date(byAdding: .weekOfYear, value: index, to: date("2026-09-07"))!,
                volume: index == 7 ? 48_596 : Double(40_000 + index * 100)
            )
        }
        let progress = StrengthProgress(weeklyVolume: weeks, recentExercises: [])
        let overview = try XCTUnwrap(StrengthWeeklyOverview(progress: progress, now: date("2026-11-12"), calendar: calendar))
        XCTAssertEqual(overview.thisWeek?.weekStart, date("2026-11-09"))
        XCTAssertEqual(overview.fullWeeks.count, 7)
        XCTAssertEqual(overview.fullWeeks.first?.weekStart, date("2026-09-21"))
        XCTAssertEqual(overview.fullWeeks.last?.weekStart, date("2026-11-02"))
        XCTAssertEqual(overview.bestWeek?.volume, 48_596)
        XCTAssertNil(StrengthWeeklyOverview(progress: StrengthProgress(weeklyVolume: [], recentExercises: [])))
    }

    func testCalorieTrendKeepsTodayOutOfAveragesAndNet() throws {
        func day(_ logDate: String, _ kcal: Double) -> NutritionCalorieHistoryDay {
            NutritionCalorieHistoryDay(logDate: logDate, nutritionLogEntries: kcal > 0 ? [
                NutritionCalorieHistoryEntry(grams: .number(100), snapshotKcalPer100g: .number(kcal))
            ] : [])
        }
        func energy(_ day: String, _ out: Double) -> DailyEnergy {
            DailyEnergy(id: day, energyOn: day, activeKcal: 500, restingKcal: out - 500)
        }
        let history = NutritionCalorieHistory(
            days: [
                day("2026-11-01", 2_000), day("2026-11-05", 0), day("2026-11-08", 2_400),
                day("2026-11-10", 2_600), day("2026-11-11", 2_200), day("2026-11-12", 1_400)
            ],
            dailyEnergyEntries: [
                energy("2026-11-01", 2_500), energy("2026-11-05", 2_400), energy("2026-11-08", 2_600),
                energy("2026-11-11", 2_800), energy("2026-11-12", 1_200)
            ],
            calendar: calendar
        )
        let trend = CalorieTrend(history: history, today: "2026-11-12", calendar: calendar)

        XCTAssertEqual(trend.consumed.map(\.day), ["2026-11-01", "2026-11-08", "2026-11-10", "2026-11-11"])
        XCTAssertEqual(trend.consumedToday?.value, 1_400)
        XCTAssertEqual(trend.consumedAverage.map(\.value), [2_000, 2_400, 2_500, 2_400])
        XCTAssertEqual(trend.net.map(\.day), ["2026-11-01", "2026-11-08", "2026-11-11"])
        XCTAssertEqual(trend.latestNetAverage, -400)
        XCTAssertEqual(trend.latestConsumedAverage, 2_400)
        XCTAssertEqual(trend.latestBurnedAverage, 2_700)
    }

    func testBodyMetricRollingAverageUsesTheSevenDaysEndingAtEachReading() {
        let points = [("2026-11-01", 70.0), ("2026-11-03", 72.0), ("2026-11-09", 71.0)].map { day, weight in
            BodyMeasurementChartPoint(id: day, measuredOn: day, date: date(day), weightKg: weight, bodyFatPct: nil)
        }
        let summary = BodyTrendSummary(points: points, today: "2026-11-12", calendar: calendar)
        XCTAssertEqual(summary.weight.rollingAverage.map(\.value), [70, 71, 71.5])
        XCTAssertEqual(summary.weight.rollingAverage.map(\.day), ["2026-11-01", "2026-11-03", "2026-11-09"])
        XCTAssertTrue(summary.bodyFat.rollingAverage.isEmpty)
    }
}

@MainActor
final class DailyEnergyEntryWindowTests: XCTestCase {
    func testListShowsFiveWithTheTotalAndLoadsTheNextServerPage() async {
        let entries = (1 ... 12).map { index in
            DailyEnergy(id: "e\(index)", energyOn: String(format: "2026-11-%02d", 30 - index), activeKcal: 400, restingKcal: 1_600)
        }
        let viewModel = DailyEnergyListViewModel(repository: CountingEnergyRepository(entries: entries), pageSize: 10)

        await viewModel.load()
        XCTAssertEqual(viewModel.visibleEntries.count, 5)
        XCTAssertEqual(viewModel.countLabel, "5 of 12")
        XCTAssertTrue(viewModel.canShowMore)

        await viewModel.showMore()
        XCTAssertEqual(viewModel.entries.count, 10)
        XCTAssertEqual(viewModel.countLabel, "10 of 12")
        XCTAssertTrue(viewModel.canShowMore)

        await viewModel.showMore()
        XCTAssertEqual(viewModel.entries.count, 12)
        XCTAssertEqual(viewModel.visibleEntries.last?.id, "e12")
        XCTAssertEqual(viewModel.countLabel, "12 of 12")
        XCTAssertFalse(viewModel.canShowMore)
    }
}

private struct CountingEnergyRepository: DailyEnergyRepositoryProtocol {
    let entries: [DailyEnergy]

    func listEntries() async throws -> [DailyEnergy] { entries }

    func energyListPageUpdates(limit: Int, offset: Int) -> AsyncThrowingStream<DailyEnergyListPage, Error> {
        let page = Array(entries.dropFirst(offset).prefix(limit))
        let total = entries.count
        return singleValueUpdates { DailyEnergyListPage(entries: page, totalCount: total) }
    }

    func entry(id: String) async throws -> DailyEnergy? { entries.first { $0.id == id } }
    func editEntry(id: String) async throws -> DailyEnergy? { try await entry(id: id) }
    func createEntry(_ values: DailyEnergyFormValues) async throws -> String { "new" }
    func updateEntry(id: String, values: DailyEnergyFormValues) async throws {}
    func deleteEntry(id: String) async throws {}
}
