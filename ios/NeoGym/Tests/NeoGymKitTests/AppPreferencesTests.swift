import Foundation
import XCTest
@testable import NeoGymKit

final class AppPreferencesTests: XCTestCase {
    func testAppearanceDefaultsToDarkForMissingOrUnknownValues() {
        XCTAssertEqual(AppAppearance.defaultValue, .dark)
        XCTAssertEqual(AppAppearance(storedValue: nil), .dark)
        XCTAssertEqual(AppAppearance(storedValue: "sepia"), .dark)
        XCTAssertEqual(AppAppearance(storedValue: "light"), .light)
        XCTAssertEqual(AppAppearance(storedValue: "system"), .system)
        XCTAssertEqual(AppAppearance.allCases.map(\.title), ["Dark", "Light", "System"])
    }

    func testRestPreferenceSnapsToSupportedPresets() {
        XCTAssertEqual(RestTimerPreference.presets, [30, 60, 90, 180])
        XCTAssertEqual(RestTimerPreference.sanitized(nil), 90)
        XCTAssertEqual(RestTimerPreference.sanitized(45), 90)
        XCTAssertEqual(RestTimerPreference.sanitized(180), 180)
        XCTAssertEqual(RestTimerPreference.presets.map(RestTimerPreference.title(seconds:)),
                       ["30 s", "1 min", "1:30", "3 min"])
        XCTAssertEqual(RestTimerPreference.countdown(84), "1:24")
        XCTAssertEqual(RestTimerPreference.countdown(-3), "0:00")
    }

    func testRestScheduleExtendsAndCountsDown() {
        let start = Date(timeIntervalSince1970: 1_000)
        let schedule = RestTimerSchedule.start(seconds: 90, now: start, label: "Leg Extensions · set 3 next", sessionId: "s1")
        XCTAssertEqual(schedule.duration, 90)
        XCTAssertEqual(schedule.remainingSeconds(at: start), 90)
        XCTAssertEqual(schedule.remainingSeconds(at: start.addingTimeInterval(89.2)), 1)
        XCTAssertTrue(schedule.isFinished(at: start.addingTimeInterval(90)))

        let extended = schedule.extended(by: 30)
        XCTAssertEqual(extended.duration, 120)
        XCTAssertEqual(extended.remainingSeconds(at: start.addingTimeInterval(90)), 30)
        XCTAssertEqual(extended.label, schedule.label)
        XCTAssertEqual(extended.sessionId, "s1")
    }
}

final class AgentAccessTests: XCTestCase {
    func testMCPURLMatchesBackend() {
        XCTAssertEqual(AgentAccess.mcpURL(for: .production), "https://tcruocjehgxmkwzpnshv-3000.svc.eu-central-1.nhost.run")
        XCTAssertEqual(AgentAccess.mcpURL(for: .local), "http://localhost:3000")
        XCTAssertEqual(AgentAccess.productionMCPURL, AgentAccess.mcpURL(for: NhostConfig.production))
    }
}
