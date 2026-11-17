import Foundation
import XCTest

/// SwiftUI app views are outside the host package. Keep the shared selection
/// sheet's add/choose glyph contract guarded without adding a model for it.
final class NutritionSelectionWiringTests: XCTestCase {
    func testOnlyAddModeOrTheSelectedChoiceShowsATrailingGlyph() throws {
        let packageRoot = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let source = try String(
            contentsOf: packageRoot.appendingPathComponent("App/Nutrition/NutritionSelectionSheet.swift"),
            encoding: .utf8
        )
        let row = try XCTUnwrap(source.components(separatedBy: "private func selectionRow(").last)
            .components(separatedBy: "private func isSelected(")[0]
        let glyph = try XCTUnwrap(row.components(separatedBy: "Image(systemName:").last)
            .components(separatedBy: ".accessibilityHidden(true)")[0]

        XCTAssertTrue(glyph.contains(#"isSelected(item) ? "checkmark" : "plus.circle.fill""#))
        XCTAssertTrue(glyph.contains(".opacity(selectedId == nil || isSelected(item) ? 1 : 0)"),
                      "Keep add-mode pluses and the selected checkmark, but reserve blank space for other choices")
    }
}
