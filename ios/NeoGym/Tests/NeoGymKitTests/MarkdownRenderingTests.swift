import Foundation
import XCTest
@testable import NeoGymKit

final class MarkdownRenderingTests: XCTestCase {
    func testStripMarkdownMirrorsWebPreviewHelper() {
        XCTAssertEqual(MarkdownRendering.stripMarkdown("A simple description."), "A simple description.")
        XCTAssertEqual(MarkdownRendering.stripMarkdown("# Title"), "Title")
        XCTAssertEqual(MarkdownRendering.stripMarkdown("###### Tiny"), "Tiny")
        XCTAssertEqual(MarkdownRendering.stripMarkdown("# Day 1\n## Warmup\nDo it"), "Day 1 Warmup Do it")
        XCTAssertEqual(MarkdownRendering.stripMarkdown("**bold** and *italic*"), "bold and italic")
        XCTAssertEqual(MarkdownRendering.stripMarkdown("__bold__ and _italic_"), "bold and italic")
        XCTAssertEqual(MarkdownRendering.stripMarkdown("***both***"), "both")
        XCTAssertEqual(MarkdownRendering.stripMarkdown("Use `npm install` first"), "Use npm install first")
        XCTAssertEqual(MarkdownRendering.stripMarkdown("Before\n```js\nconst x = 1;\n```\nAfter"), "Before After")
        XCTAssertEqual(MarkdownRendering.stripMarkdown("See [the docs](https://example.com)."), "See the docs.")
        XCTAssertEqual(MarkdownRendering.stripMarkdown("![logo](https://example.com/a.png) hi"), "logo hi")
        XCTAssertEqual(MarkdownRendering.stripMarkdown("- one\n- two\n- three"), "one two three")
        XCTAssertEqual(MarkdownRendering.stripMarkdown("* one\n+ two"), "one two")
        XCTAssertEqual(MarkdownRendering.stripMarkdown("1. first\n2. second"), "first second")
        XCTAssertEqual(MarkdownRendering.stripMarkdown("> a quote\n> across lines"), "a quote across lines")
        XCTAssertEqual(MarkdownRendering.stripMarkdown("Hello <b>world</b><br/>"), "Hello world")
        XCTAssertEqual(MarkdownRendering.stripMarkdown("  too    many\n\nspaces  "), "too many spaces")
        XCTAssertEqual(MarkdownRendering.stripMarkdown("   \n\t  "), "")
    }

    func testStripMarkdownHandlesRealisticMixedDescription() {
        let input = [
            "# Push Day",
            "",
            "Focus on **chest** and _triceps_.",
            "",
            "- Bench press",
            "- Incline dumbbell press",
            "",
            "See [program notes](https://example.com)."
        ].joined(separator: "\n")

        XCTAssertEqual(
            MarkdownRendering.stripMarkdown(input),
            "Push Day Focus on chest and triceps. Bench press Incline dumbbell press See program notes."
        )
    }

    func testParseBlocksCreatesHeadingsParagraphsAndLists() throws {
        let blocks = MarkdownRendering.parseBlocks("# Push Day\n\nFocus on **chest**.\n\n- Bench\n- Row\n\n1. Warm up\n2. Lift")

        XCTAssertEqual(blocks.count, 4)
        guard case let .heading(level, heading) = blocks[0] else {
            return XCTFail("expected heading")
        }
        XCTAssertEqual(level, 1)
        XCTAssertEqual(String(heading.characters), "Push Day")

        guard case let .paragraph(paragraph) = blocks[1] else {
            return XCTFail("expected paragraph")
        }
        XCTAssertEqual(String(paragraph.characters), "Focus on chest.")

        guard case let .unorderedList(unorderedItems) = blocks[2] else {
            return XCTFail("expected unordered list")
        }
        XCTAssertEqual(unorderedItems.map { String($0.characters) }, ["Bench", "Row"])

        guard case let .orderedList(orderedItems) = blocks[3] else {
            return XCTFail("expected ordered list")
        }
        XCTAssertEqual(orderedItems.map { String($0.characters) }, ["Warm up", "Lift"])
    }

    func testParseBlocksRemovesFencedCodeBlocksAndTreatsBlockquoteAsParagraph() throws {
        let blocks = MarkdownRendering.parseBlocks("Before\n```js\nconst x = 1;\n```\n> After")

        XCTAssertEqual(blocks.map(\.plainText), ["Before", "After"])
    }
}
