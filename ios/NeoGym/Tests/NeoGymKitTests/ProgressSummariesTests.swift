import Foundation
import XCTest
@testable import NeoGymKit

final class ProgressSummariesTests: XCTestCase {
    private func row(_ session: String, _ startedAt: String, volume: Double, oneRepMax: Double?) -> StrengthProgressRow {
        StrengthProgressRow(
            exerciseId: "rdl", sessionId: session, startedAt: startedAt, exerciseName: "RDL",
            volume: volume, estimatedOneRepMax: oneRepMax
        )
    }

    func testStrengthTrendLatestAndBestOneRepMax() {
        let trend = StrengthExerciseTrend(id: "rdl", name: "RDL", points: [
            row("b", "2026-11-12T06:00:00Z", volume: 2_500, oneRepMax: 173),
            row("a", "2026-10-21T06:00:00Z", volume: 3_000, oneRepMax: 180),
            row("c", "2026-11-13T06:00:00Z", volume: 0, oneRepMax: nil)
        ])
        XCTAssertEqual(trend.latestEstimatedOneRepMax, 173)
        XCTAssertEqual(trend.bestEstimatedOneRepMax, 180)
        XCTAssertNil(StrengthExerciseTrend(id: "x", name: "X", points: []).latestEstimatedOneRepMax)
    }

    func testBestWeekIsTheLargestVolume() {
        let weeks = [
            StrengthWeeklyVolume(weekStart: Date(timeIntervalSince1970: 0), volume: 41_938),
            StrengthWeeklyVolume(weekStart: Date(timeIntervalSince1970: 604_800), volume: 48_596),
            StrengthWeeklyVolume(weekStart: Date(timeIntervalSince1970: 1_209_600), volume: 20_530)
        ]
        let progress = StrengthProgress(weeklyVolume: weeks, recentExercises: [])
        XCTAssertEqual(progress.bestWeek?.volume, 48_596)
        XCTAssertNil(StrengthProgress(weeklyVolume: [], recentExercises: []).bestWeek)
    }

    func testMuscleBarSplitsDirectAndHalfIndirect() {
        let row = MuscleSetProgressRow(
            day: "2026-11-12", muscleGroup: "side_delts",
            rollingDirectSets: 6, rollingIndirectSets: 6, rollingWeightedSets: 9
        )
        let bar = MuscleSetBar(row: row, maxWeighted: 15)
        XCTAssertEqual(bar.direct, 0.4, accuracy: 0.0001)
        XCTAssertEqual(bar.halfIndirect, 0.2, accuracy: 0.0001)
        let empty = MuscleSetBar(row: row, maxWeighted: 0)
        XCTAssertEqual(empty.direct + empty.halfIndirect, 1, accuracy: 0.0001)
    }
}

final class DailyEnergyOutAverageTests: XCTestCase {
    func testAverageSkipsTodayAndEmptyRows() {
        let entries = [
            DailyEnergy(id: "t", energyOn: "2026-11-12", activeKcal: 300, restingKcal: 900),
            DailyEnergy(id: "a", energyOn: "2026-11-11", activeKcal: 700, restingKcal: 1_800),
            DailyEnergy(id: "b", energyOn: "2026-11-10", activeKcal: nil, restingKcal: 1_900),
            DailyEnergy(id: "c", energyOn: "2026-11-09", activeKcal: nil, restingKcal: nil)
        ]
        let average = DailyEnergyOutAverage(entries: entries, today: "2026-11-12")
        XCTAssertEqual(average?.dayCount, 2)
        XCTAssertEqual(average?.kcalPerDay ?? 0, 2_200, accuracy: 0.001)
        XCTAssertNil(DailyEnergyOutAverage(entries: [entries[0]], today: "2026-11-12"))
        XCTAssertTrue(HealthImportMarker.isImported("Imported from Apple Health "))
        XCTAssertFalse(HealthImportMarker.isImported("manual"))
    }
}
