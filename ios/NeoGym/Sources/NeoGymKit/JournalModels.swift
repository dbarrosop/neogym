import Combine
import Foundation

public let journalLabelMaxLength = 64
public let journalEntryTitleMaxLength = 200

public struct JournalLabel: Decodable, Identifiable, Sendable, Equatable, Hashable {
    public let id: String
    public let name: String

    public init(id: String, name: String) {
        self.id = id
        self.name = name
    }
}

public struct JournalEntryLabelLink: Decodable, Identifiable, Sendable, Equatable, Hashable {
    public let labelId: String
    public let label: JournalLabel

    public var id: String { labelId }

    public init(labelId: String, label: JournalLabel) {
        self.labelId = labelId
        self.label = label
    }
}

public struct JournalEntry: Decodable, Identifiable, Sendable, Equatable, Hashable {
    public let id: String
    public let entryDate: String
    public let title: String?
    public let body: String
    public let journalEntryLabels: [JournalEntryLabelLink]

    public init(
        id: String,
        entryDate: String,
        title: String? = nil,
        body: String,
        journalEntryLabels: [JournalEntryLabelLink] = []
    ) {
        self.id = id
        self.entryDate = entryDate
        self.title = title
        self.body = body
        self.journalEntryLabels = journalEntryLabels
    }

    public var displayTitle: String {
        let trimmed = title?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? "Untitled entry" : trimmed
    }

    public var previewText: String {
        MarkdownRendering.stripMarkdown(body)
    }
}

public struct JournalIndexPayload: Sendable, Equatable {
    public let entries: [JournalEntry]
    public let labels: [JournalLabel]

    public init(entries: [JournalEntry], labels: [JournalLabel]) {
        self.entries = entries
        self.labels = labels
    }
}

public struct JournalEditPayload: Sendable, Equatable {
    public let entry: JournalEntry?
    public let labels: [JournalLabel]

    public init(entry: JournalEntry?, labels: [JournalLabel]) {
        self.entry = entry
        self.labels = labels
    }
}

public struct JournalLabelSelection: Identifiable, Sendable, Equatable, Hashable {
    public let id: String?
    public let name: String

    public var stableId: String { id ?? name }

    public init(id: String? = nil, name: String) {
        self.id = id
        self.name = name
    }
}

public struct JournalEntryFormValues: Sendable, Equatable {
    public let entryDate: String
    public let title: String
    public let body: String
    public let labels: [JournalLabelSelection]

    public init(entryDate: String, title: String, body: String, labels: [JournalLabelSelection]) {
        self.entryDate = entryDate
        self.title = title
        self.body = body
        self.labels = labels
    }
}

public enum JournalLabelNormalizer {
    public static func normalize(_ raw: String) -> String {
        raw.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .lowercased()
    }
}

@MainActor
public final class JournalEntryFormModel: ObservableObject {
    @Published public var entryDate: String
    @Published public var title: String
    @Published public var body: String
    @Published public var labels: [JournalLabelSelection]
    @Published public private(set) var errorMessage: String?

    public init(initialValues: JournalEntryFormValues) {
        entryDate = initialValues.entryDate
        title = initialValues.title
        body = initialValues.body
        labels = initialValues.labels
    }

    public var trimmedTitle: String {
        title.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    public var trimmedBody: String {
        body.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    public var canSubmit: Bool {
        DateOnly.parse(entryDate) != nil && !trimmedBody.isEmpty && trimmedTitle.count <= journalEntryTitleMaxLength
    }

    public func valuesForSubmit() -> JournalEntryFormValues? {
        guard DateOnly.parse(entryDate) != nil else {
            errorMessage = "Choose a valid entry date."
            return nil
        }
        guard !trimmedBody.isEmpty else {
            errorMessage = "Entry body is required."
            return nil
        }
        guard trimmedTitle.count <= journalEntryTitleMaxLength else {
            errorMessage = "Title must be 200 characters or less."
            return nil
        }
        errorMessage = nil
        return JournalEntryFormValues(
            entryDate: entryDate,
            title: trimmedTitle,
            body: trimmedBody,
            labels: labels
        )
    }

    public func commitLabel(_ raw: String, suggestions: [JournalLabel]) {
        let normalized = JournalLabelNormalizer.normalize(raw)
        guard !normalized.isEmpty, normalized.count <= journalLabelMaxLength else { return }
        guard !labels.contains(where: { $0.name == normalized }) else { return }
        if let existing = suggestions.first(where: { $0.name == normalized }) {
            labels.append(JournalLabelSelection(id: existing.id, name: existing.name))
        } else {
            labels.append(JournalLabelSelection(name: normalized))
        }
    }

    public func addLabel(_ selection: JournalLabelSelection) {
        guard !labels.contains(where: { $0.name == selection.name }) else { return }
        labels.append(selection)
    }

    public func removeLabel(name: String) {
        labels.removeAll { $0.name == name }
    }

    public static func values(from entry: JournalEntry) -> JournalEntryFormValues {
        JournalEntryFormValues(
            entryDate: entry.entryDate,
            title: entry.title ?? "",
            body: entry.body,
            labels: entry.journalEntryLabels.map { link in
                JournalLabelSelection(id: link.label.id, name: link.label.name)
            }
        )
    }
}
