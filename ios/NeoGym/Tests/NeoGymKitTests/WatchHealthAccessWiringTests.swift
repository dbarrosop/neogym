import Foundation
import XCTest

/// The host package cannot render watch SwiftUI; guard the page wiring to the
/// account retry whose failure/recovery behavior is covered by WatchAccountTests.
final class WatchHealthAccessWiringTests: XCTestCase {
    private func healthPage() throws -> String {
        let packageRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        let source = try String(contentsOf: packageRoot.appendingPathComponent("Watch/WatchTodayPages.swift"), encoding: .utf8)
        let page = try XCTUnwrap(source.range(of: "struct WatchHealthAccessPage<"))
        return String(source[page.lowerBound...])
    }

    func testProfileWarningOffersAccountRetryWithoutBypassingTheAllowGate() throws {
        let source = try healthPage()
        XCTAssertTrue(source.contains("Button(\"Allow\") { Task { await runtime.enableHealth() } }"))
        XCTAssertTrue(source.contains(".disabled(!runtime.contextReady || account.isReadingProfile || account.profileError != nil)"))
        XCTAssertTrue(source.contains("""
            if let error = account.profileError {
                            WatchNote(text: error)
                            Button("Retry") { account.refresh() }
                                .buttonStyle(.watchCapsule())
                                .disabled(!runtime.contextReady || account.isReadingProfile)
                        }
            """))
    }

    func testHealthPermissionFailuresKeepTheirSeparateNote() throws {
        let source = try healthPage()
        XCTAssertTrue(source.contains("""
            if let error = runtime.errorMessage {
                            WatchNote(text: error)
                        }
            """))
    }
}
