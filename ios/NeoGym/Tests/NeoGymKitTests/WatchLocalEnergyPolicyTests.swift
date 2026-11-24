import Foundation
import XCTest
@testable import NeoGymKit

final class WatchLocalEnergyPolicyTests: XCTestCase {
    private let now = ISO8601DateFormatter().date(from: "2026-06-25T12:00:00Z")!
    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar
    }

    func testNewerPendingEstimateKeepsFreshServerPlanAndHistory() {
        for source: WatchEnergyRowSource in [.imported, .missing] {
            let server = snapshot(source: source, pending: false, plan: 2_243, average: -371)
            let local = snapshot(updatedAt: now.addingTimeInterval(1), consumed: 100,
                                 active: 600, resting: 900, plan: 1_200, average: -100, baseline: 1_700)
            let displayed = WatchLocalEnergyPolicy.overlay(local: local, onto: server, syncFailed: false)

            XCTAssertEqual(displayed.userID, server.userID)
            XCTAssertEqual(displayed.localDate, server.localDate)
            XCTAssertEqual(displayed.consumedKcal, server.consumedKcal)
            XCTAssertEqual(displayed.burnedKcal, local.burnedKcal)
            XCTAssertEqual(displayed.activeKcal, local.activeKcal)
            XCTAssertEqual(displayed.restingKcal, local.restingKcal)
            XCTAssertEqual(displayed.updatedAt, local.updatedAt)
            XCTAssertEqual(displayed.rowSource, source)
            XCTAssertEqual(displayed.pendingBackend, true)
            XCTAssertEqual(displayed.restingBaseline, server.restingBaseline)
            XCTAssertEqual(displayed.planKcal, 2_243)
            XCTAssertEqual(displayed.sevenDayAverageNet, -371)

            let display = EnergyBalanceDisplay(displayed.displayInput, at: now,
                                               calendar: calendar, locale: Locale(identifier: "en_US"))
            XCTAssertEqual(display.planProgress, 1_461.0 / 2_243)
            XCTAssertEqual(display.planTarget, "2,243")
            XCTAssertEqual(display.sevenDayAverage, "−371")
            let store = WatchEnergySnapshotStore(suite: "WatchLocalEnergyPolicyTests.\(UUID().uuidString)")
            defer { store.clear() }
            XCTAssertTrue(store.save(displayed))
            XCTAssertEqual(store.load(for: displayed.localDate), displayed)
        }
    }

    func testFailedSyncKeepsOlderOrSameTimePendingEnergyButRefreshesServerFields() {
        let server = snapshot(pending: false, plan: 2_243, average: -371)
        for offset: TimeInterval in [-1, 0] {
            let local = snapshot(updatedAt: now.addingTimeInterval(offset), consumed: 100,
                                 active: 600, resting: 900, plan: 1_200, average: -100, baseline: 1_700)
            let displayed = WatchLocalEnergyPolicy.overlay(local: local, onto: server, syncFailed: true)
            XCTAssertEqual(displayed.burnedKcal, 1_500)
            XCTAssertEqual(displayed.activeKcal, 600)
            XCTAssertEqual(displayed.restingKcal, 900)
            XCTAssertEqual(displayed.updatedAt, local.updatedAt)
            XCTAssertEqual(displayed.pendingBackend, true)
            XCTAssertEqual(displayed.consumedKcal, server.consumedKcal)
            XCTAssertEqual(displayed.restingBaseline, server.restingBaseline)
            XCTAssertEqual(displayed.planKcal, 2_243)
            XCTAssertEqual(displayed.sevenDayAverageNet, -371)
        }
    }

    func testOverlayUsesServerAbsenceInsteadOfStaleLocalPlanAndAverage() {
        let local = snapshot(updatedAt: now.addingTimeInterval(1), active: 600, resting: 900,
                             plan: 2_243, average: -371)
        let displayed = WatchLocalEnergyPolicy.overlay(local: local, onto: snapshot(), syncFailed: false)
        XCTAssertEqual(displayed.pendingBackend, true)
        XCTAssertEqual(displayed.burnedKcal, 1_500)
        XCTAssertNil(displayed.planKcal)
        XCTAssertNil(displayed.sevenDayAverageNet)
    }

    func testIneligibleLocalSnapshotsKeepTheWholeServerResultEvenAfterFailedSync() {
        let server = snapshot(pending: false, plan: 2_243, average: -371)
        let newer = now.addingTimeInterval(1)
        let ineligible: [WatchEnergySnapshot?] = [
            nil,
            snapshot(owner: "other", updatedAt: newer),
            snapshot(date: "2026-06-24", updatedAt: newer),
            snapshot(updatedAt: newer, pending: false),
            snapshot(updatedAt: newer, pending: nil)
        ]
        for local in ineligible {
            for syncFailed in [false, true] {
                XCTAssertEqual(WatchLocalEnergyPolicy.overlay(local: local, onto: server, syncFailed: syncFailed),
                               server)
            }
        }
    }

    func testManualServerRowWinsAndSuccessfulSyncReplacesOlderOrEqualEstimate() {
        let local = snapshot(updatedAt: now.addingTimeInterval(1), active: 600, resting: 900)
        let manual = snapshot(source: .manual, pending: false)
        for syncFailed in [false, true] {
            XCTAssertEqual(WatchLocalEnergyPolicy.overlay(local: local, onto: manual, syncFailed: syncFailed),
                           manual)
        }
        let server = snapshot(pending: false, plan: 2_243, average: -371)
        for offset: TimeInterval in [-1, 0] {
            let older = snapshot(updatedAt: now.addingTimeInterval(offset), active: 600, resting: 900)
            XCTAssertEqual(WatchLocalEnergyPolicy.overlay(local: older, onto: server, syncFailed: false), server)
        }
    }

    private func snapshot(
        owner: String = "owner", date: String = "2026-06-25", updatedAt: Date? = nil,
        consumed: Double = 1_461, active: Double = 200, resting: Double = 800,
        source: WatchEnergyRowSource = .imported, pending: Bool? = true,
        plan: Double? = nil, average: Double? = nil, baseline: Double = 1_800
    ) -> WatchEnergySnapshot {
        WatchEnergySnapshot(
            userID: owner, localDate: date, consumedKcal: consumed, burnedKcal: active + resting,
            activeKcal: active, restingKcal: resting, updatedAt: updatedAt ?? now,
            rowSource: source, pendingBackend: pending,
            restingBaseline: DailyRestingEnergyBaseline(today: date, history: [
                DailyEnergy(id: "prior", energyOn: "2026-06-23", restingKcal: baseline)
            ], calendar: calendar),
            planKcal: plan, sevenDayAverageNet: average
        )
    }
}
