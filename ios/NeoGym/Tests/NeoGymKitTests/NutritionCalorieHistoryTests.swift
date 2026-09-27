import Combine
import Foundation
import XCTest
@testable import NeoGymKit

final class NutritionCalorieHistoryTests: XCTestCase {
    func testCalorieHistoryFetchesRequestedDatesUsingOnlyLoggedSnapshots() async throws {
        let oldDay: JSONValue = .object([
            "logDate": .string("2026-02-01"),
            "nutritionLogEntries": .array([.object([
                "grams": .string("200"), "snapshotKcalPer100g": .string("150")
            ])]),
            "nutritionLogMeals": .array([.object([
                "nutritionLogEntries": .array([.object([
                    "grams": .string("50"), "snapshotKcalPer100g": .string("200")
                ])])
            ])])
        ])
        let newerDay: JSONValue = .object([
            "logDate": .string("2026-06-27"),
            "nutritionLogEntries": .array([.object([
                "grams": .number(100), "snapshotKcalPer100g": .number(250)
            ])]),
            "nutritionLogMeals": .array([])
        ])
        let fake = FakeGraphQLService(replies: [.json(.object([
            "nutritionDays": .array([oldDay, newerDay]),
            "dailyEnergyEntries": .array([
                .object([
                    "id": .string("old-energy"), "energyOn": .string("2026-02-01"),
                    "activeKcal": .string("100"), "restingKcal": .string("200")
                ]),
                .object([
                    "id": .string("new-energy"), "energyOn": .string("2026-06-27"),
                    "activeKcal": .string("50"), "restingKcal": .string("150")
                ])
            ])
        ]))])
        let repository = NutritionFoodMealRepository(graphQL: fake)
        var emissions: [NutritionCalorieHistory] = []

        for try await history in repository.nutritionCalorieHistoryUpdates(
            range: ChartHistoryRange(from: "2026-02-01", through: "2026-06-27")
        ) {
            emissions.append(history)
        }

        let history = try XCTUnwrap(emissions.last)
        XCTAssertEqual(history.consumedValues, [
            DatedCalorieIntake(date: "2026-02-01", calories: 400),
            DatedCalorieIntake(date: "2026-06-27", calories: 250)
        ])
        XCTAssertEqual(history.dailyNetValues, [
            DatedCalorieNet(date: "2026-02-01", net: 100),
            DatedCalorieNet(date: "2026-06-27", net: 50)
        ])
        XCTAssertEqual(history.rollingNetAverageValues(), history.dailyNetValues)
        let requests = await fake.requestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.operationName, "NutritionCalorieHistory")
        XCTAssertEqual(request.variables, ["from": .string("2026-02-01"), "through": .string("2026-06-27")])
        XCTAssertTrue(request.query.contains("logDate: { _gte: $from, _lte: $through }"))
        XCTAssertTrue(request.query.contains("energyOn: { _gte: $from, _lte: $through }"))
        XCTAssertTrue(request.query.contains("snapshotKcalPer100g"))
        XCTAssertTrue(request.query.contains("nutritionLogMeals"))
        XCTAssertTrue(request.query.contains("nutritionLogMealId: { _is_null: true }"))
        XCTAssertFalse(request.query.contains("nutritionPlanMeals"))
    }

    @MainActor
    func testChartKeepsPreviousRangeWhenRevalidationFails() async {
        let fake = FakeGraphQLService(replies: [
            .json(.object(["nutritionDays": .array([]), "dailyEnergyEntries": .array([])])),
            .failure(GraphQLDomainError.transport("offline"))
        ])
        let viewModel = NutritionCalorieHistoryViewModel(repository: NutritionFoodMealRepository(graphQL: fake))
        await viewModel.load(range: ChartHistoryRange(from: "2026-06-01", through: "2026-06-20"))
        XCTAssertNotNil(viewModel.history)

        await viewModel.load(range: ChartHistoryRange(from: "2026-01-01", through: "2026-06-20"))
        XCTAssertNotNil(viewModel.history)
        XCTAssertNotNil(viewModel.state.errorMessage)
    }

    @MainActor
    func testPreviousDayCacheRendersOfflineWithoutRequestingOldRange() async throws {
        let today = ChartHistoryRange(from: "2026-06-01", through: "2026-06-20")
        let yesterday = ChartHistoryRange(from: "2026-05-31", through: "2026-06-19")
        let fake = FakeGraphQLService(
            replies: [.failure(GraphQLDomainError.transport("offline"))],
            cachedOnlyReplies: [.missingData, .json(.object([
                "nutritionDays": .array([.object([
                    "logDate": .string("2026-06-19"),
                    "nutritionLogEntries": .array([.object([
                        "grams": .number(100), "snapshotKcalPer100g": .number(200)
                    ])]),
                    "nutritionLogMeals": .array([])
                ])]),
                "dailyEnergyEntries": .array([])
            ]))]
        )
        let repository = NutritionFoodMealRepository(graphQL: fake)
        let viewModel = NutritionCalorieHistoryViewModel(repository: repository)
        await viewModel.load(range: today, cacheCandidates: [today, yesterday])

        XCTAssertEqual(viewModel.history?.consumedValues, [DatedCalorieIntake(date: "2026-06-19", calories: 200)])
        XCTAssertEqual(viewModel.cachedThrough, "2026-06-19")
        XCTAssertNotNil(viewModel.state.errorMessage)
        let cacheReads = await fake.cachedOnlyRequestsSnapshot()
        XCTAssertEqual(cacheReads.count, 2)
        XCTAssertEqual(cacheReads.map(\.request.variables?["through"]), [.string("2026-06-20"), .string("2026-06-19")])
        XCTAssertTrue(cacheReads.allSatisfy { $0.namespace == "nutrition-calorie-history" })
        let network = await fake.requestsSnapshot()
        XCTAssertEqual(network.count, 1)
        XCTAssertEqual(network.first?.variables?["through"], .string("2026-06-20"))
    }

    @MainActor
    func testFreshRangeReplacesPreviousDayFallback() async throws {
        let today = ChartHistoryRange(from: "2026-06-01", through: "2026-06-20")
        let yesterday = ChartHistoryRange(from: "2026-05-31", through: "2026-06-19")
        let fake = FakeGraphQLService(
            replies: [.json(.object([
                "nutritionDays": .array([]), "dailyEnergyEntries": .array([])
            ]))],
            cachedOnlyReplies: [.missingData, .json(.object([
                "nutritionDays": .array([.object([
                    "logDate": .string("2026-06-19"),
                    "nutritionLogEntries": .array([.object([
                        "grams": .number(100), "snapshotKcalPer100g": .number(200)
                    ])]),
                    "nutritionLogMeals": .array([])
                ])]),
                "dailyEnergyEntries": .array([])
            ]))]
        )
        let viewModel = NutritionCalorieHistoryViewModel(repository: NutritionFoodMealRepository(graphQL: fake))
        var observedFallbackDates: [String] = []
        let observation = viewModel.$cachedThrough.compactMap { $0 }.sink { observedFallbackDates.append($0) }
        defer { observation.cancel() }
        await viewModel.load(range: today, cacheCandidates: [today, yesterday])

        XCTAssertEqual(observedFallbackDates, [yesterday.through])
        XCTAssertTrue(viewModel.history?.consumedValues.isEmpty == true)
        XCTAssertNil(viewModel.cachedThrough)
        XCTAssertNil(viewModel.state.errorMessage)
        let cacheReads = await fake.cachedOnlyRequestsSnapshot()
        XCTAssertEqual(cacheReads.count, 2)
    }

    @MainActor
    func testAlreadyLoadedChartDoesNotScanDefaultCandidatesForAnotherPeriod() async throws {
        let fake = FakeGraphQLService(replies: [
            .json(.object(["nutritionDays": .array([]), "dailyEnergyEntries": .array([])])),
            .failure(GraphQLDomainError.transport("offline"))
        ])
        let viewModel = NutritionCalorieHistoryViewModel(repository: NutritionFoodMealRepository(graphQL: fake))
        let selected = ChartHistoryRange(from: "2026-01-01", through: "2026-06-20")
        await viewModel.load(range: selected)
        XCTAssertNotNil(viewModel.history)

        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(secondsFromGMT: 0))
        let now = try XCTUnwrap(IntakeGrouping.localDateToDate("2026-06-20", calendar: calendar))
        let candidates = ChartHistoryRange.recentCacheCandidates(14, now: now, calendar: calendar)
        await viewModel.load(range: selected, cacheCandidates: candidates)

        let cacheReads = await fake.cachedOnlyRequestsSnapshot()
        XCTAssertTrue(cacheReads.isEmpty)
        XCTAssertNil(viewModel.cachedThrough)
        XCTAssertNotNil(viewModel.history)
        XCTAssertNotNil(viewModel.state.errorMessage)
    }

    func testChartHistoryRangeAddsSixWarmupDaysAcrossMidnightDST() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/Santiago"))
        let now = try XCTUnwrap(IntakeGrouping.localDateToDate("2025-09-07", calendar: calendar))
        let range = ChartHistoryRange.recentDays(14, now: now, calendar: calendar)

        XCTAssertEqual(range.from, "2025-08-19")
        XCTAssertEqual(range.through, "2025-09-07")
        let customEnd = try XCTUnwrap(IntakeGrouping.localDateToDate("2025-09-09", calendar: calendar))
        let custom = ChartHistoryRange(visibleStart: now, endExclusive: customEnd, calendar: calendar)
        XCTAssertEqual(custom.from, "2025-09-01")
        XCTAssertEqual(custom.through, "2025-09-08")

        let candidates = ChartHistoryRange.recentCacheCandidates(14, now: now, calendar: calendar)
        XCTAssertEqual(candidates.count, 8)
        XCTAssertEqual(candidates.first, range)
        XCTAssertEqual(candidates[1].through, "2025-09-06")
        XCTAssertEqual(candidates.last?.through, "2025-08-31")
        XCTAssertEqual(candidates.last?.from, "2025-08-12")
    }

    func testCalorieHistoryPreparesLongCalendarDaySeriesAndSparseRollingWindows() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/New_York"))
        let start = try XCTUnwrap(calendar.date(from: DateComponents(year: 2025, month: 1, day: 1)))
        let entry = NutritionCalorieHistoryEntry(grams: .number(100), snapshotKcalPer100g: .number(250))
        var days: [NutritionCalorieHistoryDay] = []
        var energy: [DailyEnergy] = []

        for index in 0..<425 {
            let date = try XCTUnwrap(calendar.date(byAdding: .day, value: index, to: start))
            let label = IntakeGrouping.formatLocalDate(date, calendar: calendar)
            if index % 17 != 0 {
                days.append(NutritionCalorieHistoryDay(logDate: label, nutritionLogEntries: [entry]))
            }
            if index >= 3, index % 11 != 0, !(120...130).contains(index) {
                energy.append(DailyEnergy(id: "energy-\(index)", energyOn: label, activeKcal: Double(index % 9) * 10))
            }
        }
        // The query is ordered, but the model must also handle unsorted fixtures/emissions.
        let history = NutritionCalorieHistory(days: days.reversed(), dailyEnergyEntries: energy, calendar: calendar)
        XCTAssertEqual(history.consumedChartPoints.count, days.count)
        XCTAssertEqual(history.consumedChartPoints.map(\.logDate), history.consumedValues.map(\.date))
        XCTAssertEqual(history.dailyNetChartPoints.map(\.logDate), history.dailyNetValues.map(\.date))
        XCTAssertEqual(history.dailyNetChartPoints.map(\.value), history.dailyNetValues.map(\.net))
        XCTAssertEqual(history.consumedChartPoints.first?.value, 250)
        XCTAssertTrue(history.rollingNetChartPoints.allSatisfy { $0.value.isFinite })

        let expected = history.rollingNetAverageValues(days: 7, calendar: calendar)
        XCTAssertEqual(history.rollingNetChartPoints.map(\.logDate), expected.map(\.date))
        for (point, value) in zip(history.rollingNetChartPoints, expected) {
            XCTAssertEqual(point.value, value.net, accuracy: 0.000_001, "Rolling net on \(value.date)")
            XCTAssertEqual(point.date, IntakeGrouping.localDateToDate(value.date, calendar: calendar))
        }
        let gapEnd = try XCTUnwrap(calendar.date(byAdding: .day, value: 130, to: start))
        let gapLabel = IntakeGrouping.formatLocalDate(gapEnd, calendar: calendar)
        XCTAssertFalse(history.rollingNetChartPoints.contains { $0.logDate == gapLabel })
        XCTAssertFalse(history.rollingNetChartPoints.contains { $0.logDate == IntakeGrouping.formatLocalDate(start, calendar: calendar) })
    }

    func testCalorieHistoryRollingWindowIncludesOldestDayAcrossMidnightDSTJump() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "America/Santiago"))
        let start = try XCTUnwrap(IntakeGrouping.localDateToDate("2025-09-01", calendar: calendar))
        let transition = try XCTUnwrap(IntakeGrouping.localDateToDate("2025-09-07", calendar: calendar))
        XCTAssertEqual(calendar.component(.hour, from: start), 0)
        XCTAssertEqual(calendar.component(.hour, from: transition), 1)

        let entry = NutritionCalorieHistoryEntry(grams: .number(100), snapshotKcalPer100g: .number(250))
        var labels: [String] = []
        for index in 0..<7 {
            let date = try XCTUnwrap(calendar.date(byAdding: .day, value: index, to: start))
            labels.append(IntakeGrouping.formatLocalDate(date, calendar: calendar))
        }
        let days = labels.map { NutritionCalorieHistoryDay(logDate: $0, nutritionLogEntries: [entry]) }
        let energy = labels.enumerated().map { index, label in
            DailyEnergy(id: "energy-\(index)", energyOn: label, activeKcal: Double(index) * 10)
        }
        let history = NutritionCalorieHistory(days: days, dailyEnergyEntries: energy, calendar: calendar)
        let expected = history.rollingNetAverageValues(days: 7, calendar: calendar)

        XCTAssertEqual(history.rollingNetChartPoints.map(\.logDate), expected.map(\.date))
        for (point, value) in zip(history.rollingNetChartPoints, expected) {
            XCTAssertEqual(point.value, value.net, accuracy: 0.000_001, "Rolling net on \(value.date)")
        }
        XCTAssertEqual(history.rollingNetChartPoints.last?.logDate, "2025-09-07")
        XCTAssertEqual(try XCTUnwrap(history.rollingNetChartPoints.last).value, 220, accuracy: 0.000_001)
    }
}
