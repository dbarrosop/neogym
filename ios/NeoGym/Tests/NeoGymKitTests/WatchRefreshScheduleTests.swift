import Foundation
import XCTest
@testable import NeoGymKit

final class WatchRefreshScheduleTests: XCTestCase {
    func testCoalescesHourlyRequestsAndPrefersEarlierRetry() throws {
        let now = Date(timeIntervalSince1970: 10_000)
        var schedule = WatchRefreshSchedule()
        let hourly = try XCTUnwrap(schedule.requestHourly(now: now))
        XCTAssertEqual(hourly, now.addingTimeInterval(3_600))
        XCTAssertNil(schedule.requestHourly(now: now.addingTimeInterval(10)))

        let retry = try XCTUnwrap(schedule.requestRetry(now: now.addingTimeInterval(20)))
        XCTAssertEqual(retry, now.addingTimeInterval(20 + 900))
        XCTAssertNil(schedule.requestRetry(now: now.addingTimeInterval(30)))
        XCTAssertEqual(schedule.consecutiveFailures, 1)
        // A late callback for the replaced hourly request cannot erase the retry.
        schedule.didFailToSchedule(hourly)
        XCTAssertEqual(schedule.pendingPreferredDate, retry)
        schedule.didWake()
        XCTAssertNil(schedule.pendingPreferredDate)
        XCTAssertEqual(schedule.requestRetry(now: now.addingTimeInterval(100)),
                       now.addingTimeInterval(100 + 1_800))
        schedule.didWake()
        XCTAssertEqual(schedule.requestRetry(now: now.addingTimeInterval(200)),
                       now.addingTimeInterval(200 + 3_600))
        schedule.didRefreshSuccessfully()
        XCTAssertEqual(schedule.consecutiveFailures, 0)
    }

    func testExpiredInFlightRefreshCanBeReplacedAfterResume() {
        let started = Date(timeIntervalSince1970: 100)
        XCTAssertFalse(WatchRefreshSchedule.isStaleRefresh(startedAt: started,
                                                            now: started.addingTimeInterval(29)))
        XCTAssertTrue(WatchRefreshSchedule.isStaleRefresh(startedAt: started,
                                                           now: started.addingTimeInterval(30)))
        XCTAssertTrue(WatchRefreshSchedule.isStaleRefresh(startedAt: started,
                                                           now: started.addingTimeInterval(3_300)))
    }

    func testPendingHealthEventPrefersSoonerWakeWithoutAdvancingFailureBackoff() throws {
        let now = Date(timeIntervalSince1970: 10_000)
        var schedule = WatchRefreshSchedule()
        let hourly = try XCTUnwrap(schedule.requestHourly(now: now))
        let pending = try XCTUnwrap(schedule.requestPendingHealth(now: now))
        XCTAssertEqual(pending, now.addingTimeInterval(900))
        XCTAssertNil(schedule.requestPendingHealth(now: now.addingTimeInterval(30)))
        XCTAssertEqual(schedule.consecutiveFailures, 0)
        schedule.didFailToSchedule(hourly)
        XCTAssertEqual(schedule.pendingPreferredDate, pending)
        schedule.didWake()
        XCTAssertEqual(schedule.requestPendingHealth(now: now.addingTimeInterval(40)),
                       now.addingTimeInterval(940))
    }

    func testPassedPreferredDateRearmsEvenWhenNoWakeWasRecorded() throws {
        let now = Date(timeIntervalSince1970: 10_000)
        var schedule = WatchRefreshSchedule()
        let preferred = try XCTUnwrap(schedule.requestRetry(now: now))
        let later = try XCTUnwrap(schedule.requestHourly(now: preferred.addingTimeInterval(1)))
        XCTAssertEqual(later, preferred.addingTimeInterval(3_601))
        schedule.didFailToSchedule(later)
        XCTAssertNil(schedule.pendingPreferredDate)
        XCTAssertEqual(schedule.requestRetry(now: later), later.addingTimeInterval(1_800))
    }
}
