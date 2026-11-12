import XCTest
@testable import NeoGymKit

final class DailyEnergyProjectionTests: XCTestCase {
    private let today = "2026-11-02"
    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "America/New_York")!
        return calendar
    }

    private func row(_ date: String, active: Double? = nil, resting: Double? = nil) -> DailyEnergy {
        DailyEnergy(id: date, energyOn: date, activeKcal: active, restingKcal: resting)
    }

    private func projection(
        date: String = "2026-11-02", intake: Double = 2000, active: Double? = 400,
        resting: Double? = 1000, history: [DailyEnergy]? = nil
    ) -> DailyEnergyProjection? {
        DailyEnergyProjection(
            date: date, today: today, caloriesIn: intake,
            dailyEnergy: row(date, active: active, resting: resting),
            history: history ?? [row("2026-11-01", resting: 1700), row("2026-10-26", resting: 1900)],
            calendar: calendar
        )
    }

    func testProjectionUsesRestingAverageAndRecordedActivityWithoutChangingActuals() throws {
        let estimate = try XCTUnwrap(projection())
        XCTAssertEqual(estimate.baseline.kcal, 1800)
        XCTAssertEqual(estimate.baseline.dayCount, 2)
        XCTAssertEqual(estimate.estimatedBurnedKcal, 2200)
        XCTAssertEqual(estimate.estimatedNetKcal, -200)
        XCTAssertEqual(DailyCalorieBalance(caloriesIn: 2000,
                                           dailyEnergy: row(today, active: 400, resting: 1000)).net, 600)
        XCTAssertEqual(projection(intake: 2200)?.estimatedNetKcal, 0)
        XCTAssertEqual(projection(intake: 3000)?.estimatedNetKcal, 800)
    }

    func testPreviousSevenLocalDatesAcrossDSTAndYearBoundary() {
        let history = (26...31).map { row("2026-10-\($0)", resting: 1800) }
            + [row("2026-11-01", resting: 1800)]
        XCTAssertEqual(projection(history: history)?.baseline.dayCount, 7)
        let baseline = DailyRestingEnergyBaseline(
            today: "2027-01-01", history: [row("2026-12-25", resting: 1800)], calendar: calendar
        )
        XCTAssertEqual(baseline?.kcal, 1800)
    }

    func testMissingInvalidDuplicateAndOutOfWindowHistoryIsExcluded() throws {
        let history = [
            row(today, resting: 100), row("2026-11-03", resting: 9000), row("2026-10-25", resting: 9000),
            row("2026-10-26", resting: 0), row("2026-10-27", resting: -1), row("2026-10-28", resting: .nan),
            row("2026-10-29", resting: .infinity), row("2026-10-30", resting: 30000), row("2026-10-31"),
            row("2026-11-01", resting: 1800.5), row("2026-11-01", resting: 9000)
        ]
        let estimate = try XCTUnwrap(projection(history: history))
        XCTAssertEqual(estimate.baseline.kcal, 1800.5)
        XCTAssertEqual(estimate.baseline.dayCount, 1)
    }

    func testRecordedRestingIsAFloorAndMissingCurrentComponentsStayZero() {
        XCTAssertEqual(projection(resting: 2000)?.estimatedBurnedKcal, 2400)
        XCTAssertEqual(projection(active: nil)?.estimatedBurnedKcal, 1800)
        XCTAssertEqual(projection(resting: nil)?.estimatedBurnedKcal, 2200)
    }

    func testNoProjectionForOtherDatesMissingDataOrInvalidTodayValues() {
        XCTAssertNil(projection(date: "2026-11-01"))
        XCTAssertNil(projection(date: "2026-11-03"))
        XCTAssertNil(projection(history: []))
        XCTAssertNil(projection(intake: .nan))
        XCTAssertNil(projection(active: .infinity))
        XCTAssertNil(DailyEnergyProjection(date: today, today: today, caloriesIn: 0, dailyEnergy: nil,
                                           history: [row("2026-11-01", resting: 1800)]))
    }

    func testOverviewAndIntakeShareProjectionAndNoFoodMeansZeroLoggedCalories() throws {
        let rows = [row(today, active: 400, resting: 1000), row("2026-11-01", resting: 1800)]
        let payload = NutritionOverviewPayload(days: [], dailyEnergyEntries: rows)
        let summary = EnergyBalanceOverviewSummary(payload: payload, today: today, calendar: calendar)
        let intake = DailyIntakePayload(day: nil, dailyEnergy: rows[0], energyHistory: rows,
                                        nutritionPlans: [], meals: [], foods: [])
        XCTAssertEqual(summary.projection, intake.energyProjection(date: today, today: today))
        XCTAssertEqual(summary.projection?.estimatedNetKcal, -2200)
        XCTAssertEqual(summary.net, -1400)
        XCTAssertTrue(try XCTUnwrap(summary.projection).netValue(locale: Locale(identifier: "en_US")).hasPrefix("≈−"))
    }
}
