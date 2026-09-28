import Foundation
import Nhost
import XCTest
@testable import NeoGymKit

private struct WatchEnergyFakeImporter: DailyEnergyHealthImporting {
    let entries: [HealthDailyEnergy]
    func dailyEnergyEntries() async throws -> [HealthDailyEnergy] { entries }
}

private struct FailingWatchEnergyImporter: DailyEnergyHealthImporting {
    func dailyEnergyEntries() async throws -> [HealthDailyEnergy] {
        throw NSError(domain: "HKErrorDomain", code: 3)
    }
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
        XCTAssertEqual(snapshot.activeKcal, 120)
        XCTAssertNil(snapshot.restingKcal)
        XCTAssertEqual(snapshot.netKcal, 230)
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

    func testSyncFailureIdentifiesHealthKitReadAndBackendReadOrWrite() async {
        let healthGraphQL = FakeGraphQLService(replies: [.json(.object(["dailyEnergyEntries": .array([])]))])
        let healthService = WatchEnergyService(
            graphQL: healthGraphQL, energy: DailyEnergyRepository(graphQL: healthGraphQL),
            importer: FailingWatchEnergyImporter(), calendar: calendar
        )
        do {
            try await healthService.syncHealth(now: now)
            XCTFail("Expected HealthKit failure")
        } catch let failure as WatchHealthSyncFailure {
            XCTAssertEqual(failure.stage, .healthRead)
            XCTAssertEqual(failure.underlyingDomain, "HKErrorDomain")
            XCTAssertEqual(failure.underlyingCode, 3)
        } catch { XCTFail("Unexpected error: \(error)") }

        let readGraphQL = FakeGraphQLService(replies: [.failure(URLError(.notConnectedToInternet))])
        let readService = WatchEnergyService(
            graphQL: readGraphQL, energy: DailyEnergyRepository(graphQL: readGraphQL),
            importer: WatchEnergyFakeImporter(entries: []), calendar: calendar
        )
        do {
            try await readService.syncHealth(now: now)
            XCTFail("Expected backend-read failure")
        } catch let failure as WatchHealthSyncFailure {
            XCTAssertEqual(failure.stage, .backendRead)
        } catch { XCTFail("Unexpected error: \(error)") }

        let writeGraphQL = FakeGraphQLService(replies: [
            .json(.object(["dailyEnergyEntries": .array([])])),
            .failure(URLError(.notConnectedToInternet))
        ])
        let writeService = WatchEnergyService(
            graphQL: writeGraphQL, energy: DailyEnergyRepository(graphQL: writeGraphQL),
            importer: WatchEnergyFakeImporter(entries: [
                HealthDailyEnergy(energyOn: "2026-06-25", activeKcal: 120)
            ]), calendar: calendar
        )
        do {
            try await writeService.syncHealth(now: now)
            XCTFail("Expected backend-write failure")
        } catch let failure as WatchHealthSyncFailure {
            XCTAssertEqual(failure.stage, .backendWrite)
        } catch { XCTFail("Unexpected error: \(error)") }
    }

    func testTotalIncludesActiveAndRestingAndNetCanBeNegative() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "nutritionDays": .array([]),
            "dailyEnergyEntries": .array([row(
                date: "2026-06-25", notes: "Manual", active: 120, resting: 580
            )])
        ]))])
        let service = WatchEnergyService(graphQL: fake, energy: DailyEnergyRepository(graphQL: fake),
                                         importer: WatchEnergyFakeImporter(entries: []), calendar: calendar)
        let snapshot = try await service.refresh(userID: "person-1", syncHealth: false, now: now)
        XCTAssertEqual(snapshot.consumedKcal, 0)
        XCTAssertEqual(snapshot.activeKcal, 120)
        XCTAssertEqual(snapshot.restingKcal, 580)
        XCTAssertEqual(snapshot.burnedKcal, 700)
        XCTAssertEqual(snapshot.netKcal, -700)
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

    func testDuplicateDateInsertSkipsConflictAndContinuesWithOlderDate() async throws {
        let fake = FakeGraphQLService(replies: [
            .json(.object(["dailyEnergyEntries": .array([])])),
            .failure(GraphQLDomainError.graphQLErrors([
                GraphQLErrorDetail(message: "Uniqueness violation", code: "constraint-violation",
                                   constraintName: "daily_energy_user_date_key")
            ])),
            .json(.object(["insertDailyEnergyEntry": .object(["id": .string("older")])])),
            .json(.object(["nutritionDays": .array([]), "dailyEnergyEntries": .array([
                row(date: "2026-06-25", notes: "Manual", active: 150)
            ])]))
        ])
        let service = WatchEnergyService(graphQL: fake, energy: DailyEnergyRepository(graphQL: fake),
                                         importer: WatchEnergyFakeImporter(entries: [
                                             HealthDailyEnergy(energyOn: "2026-06-25", activeKcal: 120),
                                             HealthDailyEnergy(energyOn: "2026-06-24", activeKcal: 90)
                                         ]), calendar: calendar)

        let snapshot = try await service.refresh(userID: "person-1", syncHealth: true, now: now)
        XCTAssertEqual(snapshot.burnedKcal, 150)
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.map(\.operationName), [
            "DailyEnergyHealthRefreshEntries", "InsertDailyEnergy", "InsertDailyEnergy", "WatchTodayEnergy"
        ])
        if case .object(let today) = requests[1].variables?["obj"],
           case .object(let older) = requests[2].variables?["obj"] {
            XCTAssertEqual(today["energyOn"], .string("2026-06-25"))
            XCTAssertEqual(older["energyOn"], .string("2026-06-24"))
        } else {
            XCTFail("Expected date-bearing energy inserts")
        }
    }

    func testUnchangedImportedRowSkipsUpdateBeforeReadingSnapshot() async throws {
        let fake = FakeGraphQLService(replies: [
            .json(.object(["dailyEnergyEntries": .array([
                row(date: "2026-06-25", notes: "Imported from Apple Health", active: 120)
            ])])),
            .json(.object(["nutritionDays": .array([]), "dailyEnergyEntries": .array([
                row(date: "2026-06-25", notes: "Imported from Apple Health", active: 120)
            ])]))
        ])
        let service = WatchEnergyService(graphQL: fake, energy: DailyEnergyRepository(graphQL: fake),
                                         importer: WatchEnergyFakeImporter(entries: [
                                             HealthDailyEnergy(energyOn: "2026-06-25", activeKcal: 120)
                                         ]), calendar: calendar)

        let snapshot = try await service.refresh(userID: "person-1", syncHealth: true, now: now)
        XCTAssertEqual(snapshot.burnedKcal, 120)
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.map(\.operationName), ["DailyEnergyHealthRefreshEntries", "WatchTodayEnergy"])
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
        XCTAssertNil(snapshot.activeKcal)
        XCTAssertNil(snapshot.restingKcal)
        XCTAssertNil(snapshot.netKcal)
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.count, 2)
    }

    func testSnapshotPolicyRetainsDuringBootstrapAndClearsOnBlockingStates() {
        let policy = WatchEnergySnapshotPolicy.self
        XCTAssertTrue(policy.keepsStoredSnapshot(in: .loading, snapshotUserID: "person-1", sessionUserID: nil))
        XCTAssertTrue(policy.keepsStoredSnapshot(
            in: .loading, snapshotUserID: "person-1", sessionUserID: "person-1"
        ))
        XCTAssertTrue(policy.keepsStoredSnapshot(
            in: .awaitingLocalContext, snapshotUserID: "person-1", sessionUserID: nil
        ))
        XCTAssertFalse(policy.keepsStoredSnapshot(in: .loading, snapshotUserID: "person-1", sessionUserID: "person-2"))
        for state: WatchAccountState in [
            .signedOut, .phoneSignedOut, .matchPhone, .clearing, .reauthenticate, .authError, .error("failed")
        ] {
            XCTAssertFalse(policy.keepsStoredSnapshot(
                in: state, snapshotUserID: "person-1", sessionUserID: "person-1"
            ))
        }
    }

    func testSnapshotDoesNotCrossDayAndCanBeCleared() {
        let store = WatchEnergySnapshotStore(suite: "WatchEnergyTests.\(UUID().uuidString)")
        let snapshot = WatchEnergySnapshot(userID: "person-1", localDate: "2026-06-25",
                                           consumedKcal: 350, burnedKcal: 120,
                                           activeKcal: 20, restingKcal: 100, updatedAt: now)
        XCTAssertEqual(snapshot.netKcal, 230)
        XCTAssertTrue(store.save(snapshot))
        XCTAssertEqual(store.load(for: "2026-06-25"), snapshot)
        XCTAssertNil(store.load(for: "2026-06-26"))
        store.clear()
        XCTAssertNil(store.load(for: "2026-06-25"))
    }

    func testSnapshotStoreReportsEncodingFailureAndKeepsLastGoodValue() {
        let store = WatchEnergySnapshotStore(suite: "WatchEnergyTests.\(UUID().uuidString)")
        let good = WatchEnergySnapshot(userID: "person-1", localDate: "2026-06-25",
                                       consumedKcal: 350, burnedKcal: 120, updatedAt: now)
        XCTAssertTrue(store.save(good))
        let invalid = WatchEnergySnapshot(userID: "person-1", localDate: "2026-06-25",
                                          consumedKcal: .nan, burnedKcal: 120, updatedAt: now)
        XCTAssertFalse(store.save(invalid))
        XCTAssertEqual(store.load(for: "2026-06-25"), good)
        store.clear()
    }

    func testOldSnapshotWithoutBreakdownStillDecodes() throws {
        let old = Data(#"{"userID":"person-1","localDate":"2026-06-25","consumedKcal":350,"burnedKcal":120,"updatedAt":0}"#.utf8)
        let snapshot = try JSONDecoder().decode(WatchEnergySnapshot.self, from: old)
        XCTAssertEqual(snapshot.netKcal, 230)
        XCTAssertNil(snapshot.activeKcal)
        XCTAssertNil(snapshot.restingKcal)
    }

    private func row(date: String, notes: String, active: Int, resting: Int? = nil) -> JSONValue {
        .object(["id": .string(date), "energyOn": .string(date), "activeKcal": .number(Double(active)),
                 "restingKcal": resting.map { .number(Double($0)) } ?? .null, "notes": .string(notes)])
    }
}
