import Foundation
import Nhost
import XCTest
@testable import NeoGymKit

private struct WatchEnergyFakeImporter: DailyEnergyHealthImporting {
    let entries: [HealthDailyEnergy]
    func dailyEnergyEntries() async throws -> [HealthDailyEnergy] { entries }
}

final class WatchEnergyTests: XCTestCase {
    private let now = ISO8601DateFormatter().date(from: "2026-06-25T12:00:00Z")!
    private let calendar: Calendar = {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar
    }()

    func testSyncUpdatesOnlyImportedRowsThenReadsBothSnapshotValues() async throws {
        let fake = FakeGraphQLService(replies: [
            .json(.object(["dailyEnergyEntries": .array([
                row(date: "2026-06-25", notes: "Imported from Apple Health", active: 100),
                row(date: "2026-06-24", notes: "Manual", active: 250)
            ])])),
            .json(.object(["updateDailyEnergyEntry": .object(["id": .string("2026-06-25")])])),
            .json(.object([
                "nutritionDays": .array([.object([
                    "logDate": .string("2026-06-25"),
                    "nutritionLogEntries": .array([.object([
                        "grams": .string("150"), "snapshotKcalPer100g": .string("200")
                    ])]),
                    "nutritionLogMeals": .array([.object(["nutritionLogEntries": .array([.object([
                        "grams": .string("50"), "snapshotKcalPer100g": .string("100")
                    ])])])])
                ])]),
                "dailyEnergyEntries": .array([row(date: "2026-06-25", notes: "Imported from Apple Health", active: 120)])
            ]))
        ])
        let importer = WatchEnergyFakeImporter(entries: [
            HealthDailyEnergy(energyOn: "2026-06-25", activeKcal: 120),
            HealthDailyEnergy(energyOn: "2026-06-24", activeKcal: 500),
            HealthDailyEnergy(energyOn: "2026-06-17", activeKcal: 400)
        ])
        let service = WatchEnergyService(graphQL: fake, energy: DailyEnergyRepository(graphQL: fake),
                                         importer: importer, calendar: calendar)

        let snapshot = try await service.refresh(userID: "person-1", syncHealth: true, now: now)
        XCTAssertEqual(snapshot.consumedKcal, 350)
        XCTAssertEqual(snapshot.burnedKcal, 120)
        XCTAssertEqual(snapshot.userID, "person-1")
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.map(\.operationName), ["DailyEnergyHealthRefreshEntries", "UpdateDailyEnergy", "WatchTodayEnergy"])
        XCTAssertEqual(requests[0].variables?["since"], .string("2026-06-19"))
        XCTAssertEqual(requests[2].variables?["date"], .string("2026-06-25"))
        if case .object(let fields) = requests[1].variables?["set"] {
            XCTAssertNil(fields["userId"])
        } else {
            XCTFail("Expected energy update fields")
        }
    }

    func testMissingDayIsCreatedWithoutOwnerFieldAndComplicationUsesServerValue() async throws {
        let fake = FakeGraphQLService(replies: [
            .json(.object(["dailyEnergyEntries": .array([])])),
            .json(.object(["insertDailyEnergyEntry": .object(["id": .string("created")])])),
            .json(.object(["nutritionDays": .array([]), "dailyEnergyEntries": .array([
                row(date: "2026-06-25", notes: "Imported from Apple Health", active: 87)
            ])]))
        ])
        let service = WatchEnergyService(graphQL: fake, energy: DailyEnergyRepository(graphQL: fake),
                                         importer: WatchEnergyFakeImporter(entries: [
                                             HealthDailyEnergy(energyOn: "2026-06-25", activeKcal: 87)
                                         ]), calendar: calendar)
        let snapshot = try await service.refresh(userID: "person-1", syncHealth: true, now: now)
        XCTAssertEqual(snapshot.burnedKcal, 87)
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.map(\.operationName), ["DailyEnergyHealthRefreshEntries", "InsertDailyEnergy", "WatchTodayEnergy"])
        if case .object(let fields) = requests[1].variables?["obj"] {
            XCTAssertNil(fields["userId"])
            XCTAssertEqual(fields["notes"], .string("Imported from Apple Health"))
        } else {
            XCTFail("Expected energy insert fields")
        }
    }

    func testNoHealthValueDoesNotCreateZeroEnergyAndNoBackendRowIsUnknown() async throws {
        let fake = FakeGraphQLService(replies: [
            .json(.object(["dailyEnergyEntries": .array([])])),
            .json(.object(["nutritionDays": .array([]), "dailyEnergyEntries": .array([])]))
        ])
        let service = WatchEnergyService(graphQL: fake, energy: DailyEnergyRepository(graphQL: fake),
                                         importer: WatchEnergyFakeImporter(entries: [
                                             HealthDailyEnergy(energyOn: "2026-06-25", activeKcal: 0, restingKcal: 0)
                                         ]), calendar: calendar)
        let snapshot = try await service.refresh(userID: "person-1", syncHealth: true, now: now)
        XCTAssertEqual(snapshot.consumedKcal, 0)
        XCTAssertNil(snapshot.burnedKcal)
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.count, 2)
    }

    func testSnapshotDoesNotCrossDayAndCanBeCleared() {
        let store = WatchEnergySnapshotStore(suite: "WatchEnergyTests.\(UUID().uuidString)")
        let snapshot = WatchEnergySnapshot(userID: "person-1", localDate: "2026-06-25",
                                           consumedKcal: 350, burnedKcal: 120, updatedAt: now)
        XCTAssertTrue(store.save(snapshot))
        XCTAssertEqual(store.load(for: "2026-06-25"), snapshot)
        XCTAssertNil(store.load(for: "2026-06-26"))
        store.clear()
        XCTAssertNil(store.load(for: "2026-06-25"))
    }

    private func row(date: String, notes: String, active: Int) -> JSONValue {
        .object(["id": .string(date), "energyOn": .string(date), "activeKcal": .number(Double(active)),
                 "restingKcal": .null, "notes": .string(notes)])
    }
}
