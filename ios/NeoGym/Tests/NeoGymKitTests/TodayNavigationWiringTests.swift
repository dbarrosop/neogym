import Foundation
import XCTest

/// Navigation lives in the SwiftUI app, not the host package. Guard its wiring
/// without moving app navigation into NeoGymKit or requiring a live backend.
final class TodayNavigationWiringTests: XCTestCase {
    private func shellSource(_ name: String) throws -> String {
        let packageRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        return try String(contentsOf: packageRoot.appendingPathComponent("App/Shell/\(name).swift"), encoding: .utf8)
    }

    func testTodayShortcutsClearTheDestinationBeforeSelectingItsTab() throws {
        let shell = try shellSource("AppShellView")
        let nutritionAction = #"openNutritionLog:\s*\{\s*nutritionSection = \.log\s*nutritionPath = \[\]\s*selection = \.nutrition\s*\}"#
        let progressAction = #"openProgress:\s*\{ section in\s*progressSection = section\s*progressPath = \[\]\s*selection = \.progress\s*\}"#

        XCTAssertNotNil(shell.range(of: nutritionAction, options: .regularExpression))
        XCTAssertNotNil(shell.range(of: progressAction, options: .regularExpression))
        // Clear on the explicit request, even if the target section is already
        // selected underneath a pushed detail; not on ordinary tab selection.
        XCTAssertTrue(shell.contains("TabView(selection: $selection)"))
        for area in ["nutrition", "progress"] {
            XCTAssertEqual(shell.components(separatedBy: "\(area)Path = []").count - 1, 1)
        }
    }

    func testDestinationStacksUseTheShellOwnedPaths() throws {
        let shell = try shellSource("AppShellView")
        for (area, route) in [("nutrition", "Nutrition"), ("progress", "Progress")] {
            XCTAssertTrue(shell.contains("@State private var \(area)Path: [\(route)Route] = []"))
            XCTAssertTrue(shell.contains("path: $\(area)Path"))
            let destination = try shellSource("\(route)NavigationView")
            XCTAssertTrue(destination.contains("@Binding var path: [\(route)Route]"))
            XCTAssertTrue(destination.contains("NavigationStack(path: $path)"))
            XCTAssertFalse(destination.contains("@State private var path:"))
        }
        let progress = try shellSource("ProgressNavigationView")
        XCTAssertTrue(progress.contains("path: Binding<[ProgressRoute]>"))
        XCTAssertTrue(progress.contains("_path = path"))
    }

    func testCreateToDetailStillAppendsAfterTheCreateViewDismisses() throws {
        for area in ["Nutrition", "Progress"] {
            let source = try shellSource("\(area)NavigationView")
            let deferredAppend = #"(?s)private func openRouteAfterCurrentTransition\(_ route: "# + area
                + #"Route\)\s*\{.*?DispatchQueue\.main\.async\s*\{\s*path\.append\(route\)\s*\}"#
            XCTAssertNotNil(source.range(of: deferredAppend, options: .regularExpression))
            XCTAssertFalse(source.contains("path.removeLast()"), "The create view already dismisses its own route")
        }
    }
}
