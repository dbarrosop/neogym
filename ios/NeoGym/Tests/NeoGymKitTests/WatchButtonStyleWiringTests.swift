import Foundation
import XCTest

/// Host tests cannot render the watch-only SwiftUI views. Keep the environment
/// read in a rendered child, where it observes the button's disabled state.
final class WatchButtonStyleWiringTests: XCTestCase {
    private func watchComponents() throws -> String {
        let packageRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        return try String(contentsOf: packageRoot.appendingPathComponent("Watch/WatchComponents.swift"), encoding: .utf8)
    }

    func testCapsuleBodyReadsEnabledStateFromItsEnvironment() throws {
        let source = try watchComponents()
        XCTAssertTrue(source.contains("CapsuleBody(configuration: configuration, foreground: foreground, background: background)"))
        let child = try XCTUnwrap(source.range(of: "private struct CapsuleBody: View"))
        let childSource = String(source[child.lowerBound...])
        XCTAssertTrue(childSource.contains("@Environment(\\.isEnabled) private var isEnabled"))
        XCTAssertTrue(childSource.contains("let configuration: Configuration"))
    }

    func testDisabledDimmingCoversTheLabelAndCapsuleAndRetainsPressedFeedback() throws {
        let source = try watchComponents()
        let background = try XCTUnwrap(source.range(of: ".background(background, in: Capsule())"))
        let opacity = try XCTUnwrap(source.range(of: ".opacity(isEnabled ? (configuration.isPressed ? 0.7 : 1) : 0.4)"))
        XCTAssertLessThan(background.lowerBound, opacity.lowerBound, "Dim the complete control, not just its text")
    }
}
