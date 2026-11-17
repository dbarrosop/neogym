import Foundation
import XCTest

/// The host package cannot execute SwiftUI/WatchConnectivity/WidgetKit. These guards
/// complement repository behavior tests and the actual simulator UI smoke suite.
final class DemoIsolationWiringTests: XCTestCase {
    private func source(_ relativePath: String) throws -> String {
        let root = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        return try String(contentsOf: root.appendingPathComponent(relativePath), encoding: .utf8)
    }

    func testDemoCompositionHasNoLiveClientAuthStoreOrPlatformEffects() throws {
        let app = try source("App/NeoGymApp.swift")
        let mainEnd = try XCTUnwrap(app.range(of: "final class LiveAppRuntime"))
        let entry = app[..<mainEnd.lowerBound]
        XCTAssertFalse(entry.contains("NhostClientFactory"))
        XCTAssertFalse(entry.contains("AuthStore("))
        XCTAssertTrue(app.contains("@StateObject private var runtime = LiveAppRuntime()"))
        XCTAssertTrue(app.contains("authStore.retire()"))

        let demo = try source("App/DemoModeView.swift")
        for forbidden in ["NhostClientFactory", "AuthStore(", "RestTimerSystemEffects(", "WidgetCenter", "PKCEVerifierStore", "signOut()"] {
            XCTAssertFalse(demo.contains(forbidden), forbidden)
        }
        XCTAssertTrue(demo.contains("DisabledDemoPATService(), enabled: false"))
        XCTAssertTrue(demo.contains(".defaultAppStorage(defaults)"))
        XCTAssertTrue(demo.contains("effects: DemoRestEffects()"))
        XCTAssertTrue(demo.contains("await store?.invalidate()"))
        XCTAssertTrue(demo.contains("io.nhost.neogym.demo"))

        let shell = try source("App/Shell/AppShellView.swift")
        for forbidden in ["environment.client", "environment.graphQLService", "HealthKitBodyMeasurementImporter(", "HealthKitWorkoutImporter("] {
            XCTAssertFalse(shell.contains(forbidden), forbidden)
        }
        XCTAssertTrue(shell.contains("environment.isDemo ? .disabled : .live"))
    }

    func testCaptureClockIsOptInAndClearedBeforeReturningToLiveMode() throws {
        let demo = try source("App/DemoModeView.swift")
        XCTAssertTrue(demo.contains("try DemoCaptureProfile.requested()"))
        XCTAssertTrue(demo.contains("AppClock.useDemoCapture(isDemo ? captureProfile : nil)"))
        XCTAssertTrue(demo.contains("AppClock.useDemoCapture(captureProfile)"))
        let exitStart = try XCTUnwrap(demo.range(of: "func exitDemo()"))
        let exitEnd = try XCTUnwrap(demo.range(of: "struct AppModeView"))
        let exit = demo[exitStart.lowerBound..<exitEnd.lowerBound]
        XCTAssertTrue(exit.contains("AppClock.useDemoCapture(nil)"))
        XCTAssertTrue(demo.contains("now: AppClock.now(), calendar: AppClock.calendar"))
        let driver = try source("UITests/DemoGuideCaptureUITests.swift")
        XCTAssertTrue(driver.contains("app.launchEnvironment = request[\"environment\"]"))
    }

    func testOnlyCaptureModeOverridesSwiftUIEnvironment() throws {
        let demo = try source("App/DemoModeView.swift")
        let modifierStart = try XCTUnwrap(demo.range(of: "private struct DemoCaptureEnvironment: ViewModifier"))
        let composition = demo[..<modifierStart.lowerBound]
        XCTAssertTrue(composition.contains(".modifier(DemoCaptureEnvironment())"))
        for key in ["calendar", "timeZone", "locale"] {
            XCTAssertFalse(composition.contains(".environment(\\.\(key),"), key)
        }
        let modifier = demo[modifierStart.lowerBound...]
        let captureStart = try XCTUnwrap(modifier.range(of: "if let profile = AppClock.captureProfile {"))
        let fallbackStart = try XCTUnwrap(modifier.range(of: "} else {", range: captureStart.upperBound..<modifier.endIndex))
        let capture = modifier[captureStart.upperBound..<fallbackStart.lowerBound]
        for override in [
            ".environment(\\.calendar, profile.calendar)",
            ".environment(\\.timeZone, profile.timeZone)",
            ".environment(\\.locale, profile.locale)",
            ".transaction { $0.disablesAnimations = true }"
        ] {
            XCTAssertTrue(capture.contains(override), override)
        }
        // Ordinary demo must inherit SwiftUI's updating values, not fixed .current snapshots.
        XCTAssertTrue(modifier[fallbackStart.lowerBound...].hasPrefix("} else {\n            content\n        }"))
    }

    func testInvalidLaunchOptionsRetainCaptureProfileForPublicDemoReentry() throws {
        let demo = try source("App/DemoModeView.swift")
        let profileStart = try XCTUnwrap(demo.range(of: "captureProfile = try DemoCaptureProfile.requested()"))
        let optionsStart = try XCTUnwrap(demo.range(of: "let options = try DemoLaunchOptions(arguments: arguments)"))
        let initEnd = try XCTUnwrap(demo.range(of: "func takeLaunchReset()"))
        XCTAssertLessThan(profileStart.lowerBound, optionsStart.lowerBound)
        let launchHandling = demo[optionsStart.lowerBound..<initEnd.lowerBound]
        // An invalid screen must clear the active clock, not the process's opt-in.
        XCTAssertFalse(launchHandling.contains("captureProfile ="))
        XCTAssertTrue(launchHandling.contains("options = nil"))
        XCTAssertTrue(launchHandling.contains("AppClock.useDemoCapture(nil)"))
        let entryStart = try XCTUnwrap(demo.range(of: "func enterDemo()"))
        let exitStart = try XCTUnwrap(demo.range(of: "func exitDemo()"))
        let entry = demo[entryStart.lowerBound..<exitStart.lowerBound]
        XCTAssertTrue(entry.contains("AppClock.useDemoCapture(captureProfile)"))
    }

    func testAllPhoneEnergyWidgetWritesGoThroughTheEffectBoundary() throws {
        for path in ["App/Today/TodayView.swift", "App/DailyEnergyViews.swift", "App/Shell/NutritionNavigationView.swift", "App/Shell/ProgressNavigationView.swift"] {
            let view = try source(path)
            XCTAssertTrue(view.contains("@Environment(\\.energyWidgetUpdates)"), path)
            XCTAssertFalse(view.contains("WidgetCenter.shared"), path)
            XCTAssertFalse(view.contains("EnergyBalanceWidgetSnapshotStore.shared"), path)
        }
        let effects = try source("App/Shell/AppShellEnvironment.swift")
        XCTAssertNotNil(effects.range(of: #"guard enabled else \{ return \}\s*WidgetCenter"#, options: .regularExpression))
        XCTAssertNotNil(effects.range(of: #"guard enabled else \{ return \}\s*EnergyBalanceWidgetSnapshotStore"#, options: .regularExpression))
    }

    func testDemoIllustrationsNeverReachAsyncImage() throws {
        let images = try source("App/Components/StorageImageView.swift")
        XCTAssertEqual(images.components(separatedBy: "else if let url, !url.isFileURL").count - 1, 2)
        XCTAssertTrue(images.contains("DemoStrengthIllustration"))
        XCTAssertTrue(images.contains("DemoCardioIllustration"))
        let environment = try source("App/Shell/AppShellEnvironment.swift")
        XCTAssertTrue(environment.contains("URL(fileURLWithPath: \"/neogym-demo-artwork\")"))
    }
}
