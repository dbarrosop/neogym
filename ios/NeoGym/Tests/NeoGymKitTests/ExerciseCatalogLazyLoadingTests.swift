import Foundation
import XCTest

/// The host package does not compile SwiftUI app views. Guard the catalog's
/// row boundary here: laziness around muscle cards alone still loads every
/// thumbnail in a visible card, which can contain hundreds of exercises.
final class ExerciseCatalogLazyLoadingTests: XCTestCase {
    private var catalogSource: String {
        get throws {
            let packageRoot = URL(fileURLWithPath: #filePath)
                .deletingLastPathComponent()
                .deletingLastPathComponent()
                .deletingLastPathComponent()
            return try String(contentsOf: packageRoot.appendingPathComponent("App/ExercisesView.swift"), encoding: .utf8)
        }
    }

    func testExerciseRowsAreDirectChildrenOfLazyStack() throws {
        let source = try catalogSource
        let rows = try XCTUnwrap(source.components(separatedBy: "private struct ExerciseRowsGroup: View {").last)
        let rowStack = #"LazyVStack\(spacing: 0\)\s*\{\s*ForEach\(exercises\)\s*\{ exercise in\s*ExerciseRowLink"#

        XCTAssertNotNil(rows.range(of: rowStack, options: .regularExpression),
                        "Exercise rows, not just muscle cards, must be lazy to defer off-screen image loads")
    }

    func testGroupedAndSearchResultsUseTheSameLazyRows() throws {
        let source = try catalogSource
        let groupedResults = #"LazyVStack\(spacing: NeoGymTheme.spacingMD\)\s*\{\s*ForEach\(viewModel.groupedExercises\)"#
        XCTAssertNotNil(source.range(of: groupedResults, options: .regularExpression))
        XCTAssertTrue(source.contains("ExerciseGroupCard(group: group)"))
        XCTAssertTrue(source.contains("ExerciseFlatResultsCard(exercises: viewModel.filteredExercises)"))

        let cards = try XCTUnwrap(source.components(separatedBy: "private struct ExerciseGroupCard: View {").last)
            .components(separatedBy: "private struct ExerciseRowsGroup: View {")[0]
        XCTAssertEqual(cards.components(separatedBy: "ExerciseRowsGroup(").count - 1, 2,
                       "Grouped and flat search cards must both use the shared lazy row boundary")
    }
}
