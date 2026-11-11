import Foundation
import Nhost
import XCTest
@testable import NeoGymKit

private struct ProjectionHealthImporter: DailyEnergyHealthImporting {
    func dailyEnergyEntries() async throws -> [HealthDailyEnergy] { [] }
}

final class DailyEnergyProjectionIntegrationTests: XCTestCase {
    private let today = "2026-11-02"
    private let now = ISO8601DateFormatter().date(from: "2026-11-02T12:00:00Z")!
    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar
    }

    private func energy(_ date: String, active: Double = 400, resting: Double = 1000) -> JSONValue {
        .object(["id": .string(date), "energyOn": .string(date), "activeKcal": .number(active),
                 "restingKcal": .number(resting), "notes": .string("Imported from Apple Health")])
    }

    func testWatchFetchesSevenPreviousDatesAndSelectsTodayRatherThanFirstHistoryRow() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "nutritionDays": .array([]),
            "dailyEnergyEntries": .array([energy("2026-11-01", resting: 1800), energy(today)])
        ]))])
        let service = WatchEnergyService(graphQL: fake, energy: DailyEnergyRepository(graphQL: fake),
                                         importer: ProjectionHealthImporter(), calendar: calendar)
        let snapshot = try await service.refresh(userID: "owner", syncHealth: false, now: now)
        XCTAssertEqual(snapshot.burnedKcal, 1400)
        XCTAssertEqual(snapshot.netKcal, -1400)
        XCTAssertEqual(snapshot.projection?.estimatedBurnedKcal, 2200)
        XCTAssertEqual(snapshot.projection?.estimatedNetKcal, -2200)
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests[0].variables?["since"], .string("2026-10-26"))
        XCTAssertTrue(requests[0].query.contains("_gte: $since, _lte: $date"))
    }

    func testWatchHistoryWithoutCurrentRowDoesNotInventRecordedOrProjectedBurn() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "nutritionDays": .array([]), "dailyEnergyEntries": .array([energy("2026-11-01", resting: 1800)])
        ]))])
        let service = WatchEnergyService(graphQL: fake, energy: DailyEnergyRepository(graphQL: fake),
                                         importer: ProjectionHealthImporter(), calendar: calendar)
        let snapshot = try await service.refresh(userID: "owner", syncHealth: false, now: now)
        XCTAssertNil(snapshot.burnedKcal)
        XCTAssertNil(snapshot.netKcal)
        XCTAssertNil(snapshot.projection)
    }

    func testProvisionalWatchUpdatesKeepBaselineButNeverChangeComplicationMathOrReloadIdentity() throws {
        let baseline = try XCTUnwrap(DailyRestingEnergyBaseline(today: today, history: [
            DailyEnergy(id: "prior", energyOn: "2026-11-01", restingKcal: 1800)
        ]))
        let original = WatchEnergySnapshot(userID: "owner", localDate: today, consumedKcal: 2000,
                                           burnedKcal: 1400, activeKcal: 400, restingKcal: 1000,
                                           updatedAt: now, rowSource: .imported, restingBaseline: baseline)
        let withoutBaseline = WatchEnergySnapshot(userID: "owner", localDate: today, consumedKcal: 2000,
                                                  burnedKcal: 1400, activeKcal: 400, restingKcal: 1000,
                                                  updatedAt: now, rowSource: .imported)
        XCTAssertTrue(original.hasSameDisplayValues(as: withoutBaseline))
        let local = try XCTUnwrap(WatchLocalEnergyPolicy.estimate(
            from: original, imported: [HealthDailyEnergy(energyOn: today, activeKcal: 600, restingKcal: 1100)],
            ownerID: "owner", today: today, now: now
        ))
        XCTAssertEqual(local.restingBaseline, baseline)
        XCTAssertEqual(local.burnedKcal, 1700)
        XCTAssertEqual(local.netKcal, 300)
        XCTAssertEqual(local.projection?.estimatedBurnedKcal, 2400)
        XCTAssertEqual(local.projection?.estimatedNetKcal, -400)
        XCTAssertNil(WatchLocalEnergyPolicy.estimate(from: original, imported: [], ownerID: "other",
                                                    today: today, now: now))
        XCTAssertNil(WatchLocalEnergyPolicy.estimate(from: original, imported: [], ownerID: "owner",
                                                    today: "2026-11-03", now: now))
        let encoded = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(WatchEnergySnapshot.self, from: encoded)
        XCTAssertEqual(decoded.projection, original.projection)
        let legacy = try JSONDecoder().decode(WatchEnergySnapshot.self, from: JSONEncoder().encode(withoutBaseline))
        XCTAssertNil(legacy.projection)
        XCTAssertEqual(legacy.netKcal, 600)
    }

    func testIntakeRepositoryKeepsHistorySeparateFromTodaysActualEnergy() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "nutritionDays": .array([]), "nutritionPlans": .array([]), "meals": .array([]), "foods": .array([]),
            "dailyEnergyEntries": .array([energy("2026-11-01", resting: 1800), energy(today)])
        ]))])
        let payload = try await NutritionFoodMealRepository(graphQL: fake).openDailyIntake(date: today)
        XCTAssertEqual(payload.dailyEnergy?.energyOn, today)
        XCTAssertEqual(payload.energyHistory.count, 2)
        XCTAssertEqual(payload.calorieBalance.caloriesOut, 1400)
        XCTAssertEqual(payload.energyProjection(date: today, today: today)?.estimatedBurnedKcal, 2200)
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests[0].variables?["since"], .string("2026-10-26"))
    }

    func testOverviewKeepsFutureBrowsingRowsWithoutCrowdingTodayOutOfBalance() async throws {
        let loggedFood = NutritionLogEntry(
            id: "entry", grams: .number(200), position: 0, slotTime: "12:00", snapshotFoodName: "Food",
            snapshotKcalPer100g: .number(1000), snapshotFatPer100g: .number(0),
            snapshotCarbsPer100g: .number(0), snapshotProteinPer100g: .number(0),
            snapshotFiberPer100g: .number(0), snapshotSugarPer100g: .number(0)
        )
        let future = NutritionDay(id: "future", logDate: "2026-11-03")
        let current = NutritionDay(id: "today", logDate: today, nutritionLogEntries: [loggedFood])
        let rows = [DailyEnergy(id: "current", energyOn: today, activeKcal: 400, restingKcal: 1000),
                    DailyEnergy(id: "prior", energyOn: "2026-11-01", restingKcal: 1800)]
        let payload = NutritionOverviewPayload(days: [future], dailyEnergyEntries: rows, balanceDays: [current])
        XCTAssertEqual(payload.days.map(\.id), ["future"])
        XCTAssertEqual(payload.balance(for: today).caloriesIn, 2000)
        XCTAssertEqual(payload.energyProjection(today: today)?.estimatedNetKcal, -200)
        let duplicate = NutritionOverviewPayload(days: [current], dailyEnergyEntries: rows, balanceDays: [current])
        XCTAssertEqual(duplicate.balance(for: today).caloriesIn, 2000)

        let fake = FakeGraphQLService(replies: [.json(.object([
            "nutritionDays": .array([]), "balanceDays": .array([.object([
                "id": .string("current"), "logDate": .string(today),
                "nutritionLogEntries": .array([]), "nutritionLogMeals": .array([])
            ])]), "dailyEnergyEntries": .array([])
        ]))])
        let decoded = try await NutritionFoodMealRepository(graphQL: fake).nutritionOverview()
        XCTAssertEqual(decoded.balanceDays.first?.logDate, today)
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests[0].variables?["through"], .string(DateOnly.todayLocalISO()))
        XCTAssertTrue(requests[0].query.contains("balanceDays: nutritionDays"))
    }

    func testIPhoneWidgetAddsOptionalEstimatesAndLegacySnapshotsStillDecode() throws {
        let payload = NutritionOverviewPayload(days: [], dailyEnergyEntries: [
            DailyEnergy(id: "today", energyOn: today, activeKcal: 400, restingKcal: 1000),
            DailyEnergy(id: "prior", energyOn: "2026-11-01", restingKcal: 1800)
        ])
        let summary = EnergyBalanceOverviewSummary(payload: payload, today: today)
        let snapshot = EnergyBalanceWidgetSnapshot(summary: summary, userMarker: "owner", generatedAt: now)
        XCTAssertNotNil(snapshot.estimatedBurnedValue)
        XCTAssertNotNil(snapshot.estimatedNetValue)
        XCTAssertEqual(snapshot.burnedValue, summary.burnedValue)
        XCTAssertEqual(snapshot.netValue, summary.netTodayValue)
        var json = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(snapshot)) as? [String: Any])
        json.removeValue(forKey: "estimatedBurnedValue")
        json.removeValue(forKey: "estimatedNetValue")
        let legacy = try JSONDecoder().decode(EnergyBalanceWidgetSnapshot.self,
                                              from: JSONSerialization.data(withJSONObject: json))
        XCTAssertNil(legacy.estimatedBurnedValue)
        XCTAssertNil(legacy.estimatedNetValue)
        XCTAssertEqual(legacy.netValue, snapshot.netValue)
    }
}
