import Foundation

public enum MarkdownBlock: Sendable, Equatable {
    case heading(level: Int, text: AttributedString)
    case paragraph(AttributedString)
    case unorderedList([AttributedString])
    case orderedList([AttributedString])

    public var plainText: String {
        switch self {
        case let .heading(_, text), let .paragraph(text):
            return String(text.characters)
        case let .unorderedList(items), let .orderedList(items):
            return items.map { String($0.characters) }.joined(separator: " ")
        }
    }
}

public enum MarkdownRendering {
    public static func parseBlocks(_ markdown: String) -> [MarkdownBlock] {
        var blocks: [MarkdownBlock] = []
        var paragraphLines: [String] = []
        var unorderedItems: [AttributedString] = []
        var orderedItems: [AttributedString] = []

        func flushParagraph() {
            guard !paragraphLines.isEmpty else { return }
            blocks.append(.paragraph(inline(paragraphLines.joined(separator: " "))))
            paragraphLines.removeAll()
        }

        func flushLists() {
            if !unorderedItems.isEmpty {
                blocks.append(.unorderedList(unorderedItems))
                unorderedItems.removeAll()
            }
            if !orderedItems.isEmpty {
                blocks.append(.orderedList(orderedItems))
                orderedItems.removeAll()
            }
        }

        for rawLine in removeFencedCodeBlocks(markdown).components(separatedBy: .newlines) {
            let line = rawLine.trimmingCharacters(in: .whitespaces)
            if line.isEmpty {
                flushParagraph()
                flushLists()
                continue
            }

            if let heading = headingMatch(line) {
                flushParagraph()
                flushLists()
                blocks.append(.heading(level: heading.level, text: inline(heading.text)))
                continue
            }

            if let item = unorderedListItem(line) {
                flushParagraph()
                orderedItems.removeAll()
                unorderedItems.append(inline(item))
                continue
            }

            if let item = orderedListItem(line) {
                flushParagraph()
                unorderedItems.removeAll()
                orderedItems.append(inline(item))
                continue
            }

            flushLists()
            paragraphLines.append(line.replacingOccurrences(of: #"^>\s?"#, with: "", options: .regularExpression))
        }

        flushParagraph(); flushLists()
        return blocks
    }

    public static func stripMarkdown(_ text: String) -> String {
        removeFencedCodeBlocks(text)
            .replacingOccurrences(of: #"!\[([^\]]*)\]\([^)]*\)"#, with: "$1", options: .regularExpression)
            .replacingOccurrences(of: #"\[([^\]]+)\]\([^)]*\)"#, with: "$1", options: .regularExpression)
            .replacingOccurrences(of: #"(?m)^\s{0,3}#{1,6}\s+"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"(?m)^\s{0,3}>\s?"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"(?m)^\s*([-*+]|\d+\.)\s+"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"(\*\*|__)(.+?)\1"#, with: "$2", options: .regularExpression)
            .replacingOccurrences(of: #"(\*|_)(.+?)\1"#, with: "$2", options: .regularExpression)
            .replacingOccurrences(of: #"`([^`]*)`"#, with: "$1", options: .regularExpression)
            .replacingOccurrences(of: #"<[^>]+>"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    public static func inline(_ markdown: String) -> AttributedString {
        if let rendered = try? AttributedString(markdown: markdown) {
            return rendered
        }
        return AttributedString(stripMarkdown(markdown))
    }

    private static func removeFencedCodeBlocks(_ text: String) -> String {
        text.replacingOccurrences(of: #"```[\s\S]*?```"#, with: "", options: .regularExpression)
    }

    private static func headingMatch(_ line: String) -> (level: Int, text: String)? {
        guard let match = firstMatch(pattern: #"^(#{1,6})\s+(.+)$"#, in: line), match.count == 3 else {
            return nil
        }
        return (match[1].count, match[2])
    }

    private static func unorderedListItem(_ line: String) -> String? {
        guard let match = firstMatch(pattern: #"^[-*+]\s+(.+)$"#, in: line), match.count == 2 else {
            return nil
        }
        return match[1]
    }

    private static func orderedListItem(_ line: String) -> String? {
        guard let match = firstMatch(pattern: #"^\d+\.\s+(.+)$"#, in: line), match.count == 2 else {
            return nil
        }
        return match[1]
    }

    private static func firstMatch(pattern: String, in value: String) -> [String]? {
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: value, range: NSRange(value.startIndex..., in: value))
        else {
            return nil
        }
        return (0 ..< match.numberOfRanges).compactMap { index in
            guard let range = Range(match.range(at: index), in: value) else { return nil }
            return String(value[range])
        }
    }
}
