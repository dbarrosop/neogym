import Foundation
import XCTest
@testable import NeoGymKit

final class WatchEnergyBackgroundUploadTests: XCTestCase {
    private let now = ISO8601DateFormatter().date(from: "2026-06-25T12:00:00Z")!
    private let calendar: Calendar = {
        var result = Calendar(identifier: .gregorian)
        result.timeZone = TimeZone(secondsFromGMT: 0)!
        return result
    }()

    func testSingleMutationOnlyUploadsSevenDaysOfValidEnergyAndCannotOverwriteManualRows() throws {
        let entries = [
            HealthDailyEnergy(energyOn: "2026-06-25", activeKcal: 150, restingKcal: 1400),
            HealthDailyEnergy(energyOn: "2026-06-24", restingKcal: 1300),
            HealthDailyEnergy(energyOn: "2026-06-18", activeKcal: 50),
            HealthDailyEnergy(energyOn: "2026-06-23", activeKcal: .nan)
        ]
        let data = try XCTUnwrap(WatchEnergyBackgroundUpload.body(entries: entries, now: now, calendar: calendar))
        let body = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        let query = try XCTUnwrap(body["query"] as? String)
        XCTAssertTrue(query.contains("daily_energy_user_date_key"))
        XCTAssertTrue(query.contains("where: { notes: { _eq: \"Imported from Apple Health\" } }"))
        XCTAssertTrue(query.contains("update_columns: [activeKcal, restingKcal]"))
        XCTAssertFalse(query.contains("userId"))
        let variables = try XCTUnwrap(body["variables"] as? [String: Any])
        let rows = try XCTUnwrap(variables["objects"] as? [[String: Any]])
        XCTAssertEqual(rows.count, 2)
        XCTAssertEqual(rows[0]["energyOn"] as? String, "2026-06-25")
        XCTAssertEqual(rows[0]["activeKcal"] as? String, "150")
        XCTAssertEqual(rows[1]["energyOn"] as? String, "2026-06-24")
        XCTAssertTrue(rows[1]["activeKcal"] is NSNull)
        XCTAssertEqual(rows[1]["notes"] as? String, "Imported from Apple Health")
        XCTAssertFalse(String(decoding: data, as: UTF8.self).contains("Authorization"))
    }

    func testOutstandingUploadIsDeduplicatedOnlyWhileBearerHasEnoughLifetime() {
        let owner = "owner-a"
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let fresh = WatchEnergyUploadTaskPolicy.description(
            ownerID: owner, expiresAt: now.addingTimeInterval(700)
        )
        XCTAssertEqual(WatchEnergyUploadTaskPolicy.ownerID(in: fresh), owner)
        XCTAssertTrue(WatchEnergyUploadTaskPolicy.canDedupe(fresh, ownerID: owner, now: now))
        XCTAssertFalse(WatchEnergyUploadTaskPolicy.canDedupe(fresh, ownerID: "owner-b", now: now))
        XCTAssertFalse(WatchEnergyUploadTaskPolicy.canDedupe(
            fresh, ownerID: owner, now: now.addingTimeInterval(580)
        ))
        XCTAssertFalse(WatchEnergyUploadTaskPolicy.canDedupe(
            fresh, ownerID: owner, now: now.addingTimeInterval(701)
        ))
        // Tasks queued by older app versions have no pinned expiry to trust.
        XCTAssertEqual(WatchEnergyUploadTaskPolicy.ownerID(in: owner), owner)
        XCTAssertFalse(WatchEnergyUploadTaskPolicy.canDedupe(owner, ownerID: owner, now: now))
        XCTAssertFalse(WatchEnergyUploadTaskPolicy.canDedupe("\(owner)|invalid", ownerID: owner, now: now))
        XCTAssertFalse(WatchEnergyUploadTaskPolicy.canDedupe("\(owner)|inf", ownerID: owner, now: now))
    }

    func testUploadRequiresLongLivedBearerEvenIfSDKReturnsUnexpiredFallback() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        XCTAssertTrue(WatchEnergyUploadTaskPolicy.canPinBearer(
            expiresAt: now.addingTimeInterval(601), now: now
        ))
        XCTAssertFalse(WatchEnergyUploadTaskPolicy.canPinBearer(
            expiresAt: now.addingTimeInterval(600), now: now
        ))
        XCTAssertFalse(WatchEnergyUploadTaskPolicy.canPinBearer(
            expiresAt: now.addingTimeInterval(30), now: now
        ))
        XCTAssertFalse(WatchEnergyUploadTaskPolicy.canPinBearer(expiresAt: nil, now: now))
    }

    func testNoUploadWithoutValidValuesAndResponseMustIncludeGraphQLSuccess() throws {
        XCTAssertNil(try WatchEnergyBackgroundUpload.body(
            entries: [HealthDailyEnergy(energyOn: "2026-06-25", activeKcal: 0)],
            now: now, calendar: calendar
        ))
        let ok = Data(#"{"data":{"insertDailyEnergyEntries":{"affectedRows":0}}}"#.utf8)
        XCTAssertTrue(WatchEnergyBackgroundUpload.succeeded(status: 200, data: ok))
        XCTAssertFalse(WatchEnergyBackgroundUpload.succeeded(status: 401, data: ok))
        XCTAssertFalse(WatchEnergyBackgroundUpload.succeeded(status: 200, data: Data(#"{"errors":[{"message":"denied"}]}"#.utf8)))
        XCTAssertFalse(WatchEnergyBackgroundUpload.succeeded(status: 200, data: nil))
    }
}
