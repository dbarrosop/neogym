import Foundation
import XCTest

/// Host tests cannot run WidgetKit's tinted renderer. Guard the opacity at the
/// shipping view boundary; actual tinted Home Screen rendering needs acceptance.
final class EnergyWidgetAccentedWiringTests: XCTestCase {
    private func source(_ path: String) throws -> String {
        let root = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        return try String(contentsOf: root.appendingPathComponent(path), encoding: .utf8)
    }

    func testEmptyTrackIsFainterThanEitherPopulatedSegmentOnlyWhenAccented() throws {
        let bar = try source("WidgetUI/EnergySplitBar.swift")
        let empty = try XCTUnwrap(bar.range(of: "} else {"))
        XCTAssertTrue(bar[empty.upperBound...].contains(".fill(trackColor)\n                    .opacity(accented ? 0.2 : 1)"))
        XCTAssertTrue(bar[..<empty.lowerBound].contains(".opacity(accented ? 0.45 : 1)"))

        let widget = try source("Widgets/EnergyBalanceWidget.swift")
        let start = try XCTUnwrap(widget.range(of: "private struct HomeSplitBar: View"))
        let end = try XCTUnwrap(widget.range(of: "private struct SmallBalanceView: View"))
        let homeBar = widget[start.lowerBound..<end.lowerBound]
        XCTAssertTrue(homeBar.contains("accented: renderingMode == .accented"))
        XCTAssertTrue(homeBar.contains(".widgetAccentable()"))
    }

    func testSignedOutIconDimsOnlyItsBackgroundInAccentedMode() throws {
        let widget = try source("Widgets/EnergyBalanceWidget.swift")
        let start = try XCTUnwrap(widget.range(of: "private struct SignedOutBalanceView: View"))
        let end = try XCTUnwrap(widget.range(of: "// MARK: - Lock Screen"))
        let icon = widget[start.lowerBound..<end.lowerBound]
        XCTAssertTrue(icon.contains("@Environment(\\.widgetRenderingMode) private var renderingMode"))
        XCTAssertTrue(icon.contains(".foregroundStyle(.white)"))
        XCTAssertTrue(icon.contains("WidgetTheme.accentFill.opacity(renderingMode == .accented ? 0.2 : 1)"))
        XCTAssertTrue(icon.contains(".widgetAccentable()"))
        XCTAssertFalse(icon.contains("\n                .opacity("), "Do not dim the opaque glyph with its tile")
    }

    func testBothHomeScreenPreviewTimelinesIncludeMissingEnergy() throws {
        let widget = try source("Widgets/EnergyBalanceWidget.swift")
        for name in ["Small", "Medium"] {
            let start = try XCTUnwrap(widget.range(of: "#Preview(\"\(name)\""))
            // Bound by the next preview rather than another preview's no-energy entry.
            let preview = widget[start.upperBound...].components(separatedBy: "#Preview")[0]
            XCTAssertTrue(preview.contains("previewEntry(.noEnergy)"), name)
        }
    }
}
