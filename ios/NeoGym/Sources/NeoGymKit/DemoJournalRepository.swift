import Foundation

public struct DemoJournalRepository: JournalRepositoryProtocol {
    let store: DemoStore
    public init(store: DemoStore) { self.store = store }

    public func listEntries(limit: Int, offset: Int, labelIds: [String]) async throws -> JournalIndexPayload {
        try await store.read { state in
            let entries = try state.records(JournalEntry.self, table: .journal).filter { entry in
                labelIds.isEmpty || entry.journalEntryLabels.contains { labelIds.contains($0.labelId) }
            }.sorted { $0.entryDate == $1.entryDate ? $0.id < $1.id : $0.entryDate > $1.entryDate }
            return JournalIndexPayload(
                entries: Array(entries.dropFirst(max(offset, 0)).prefix(max(limit, 0))),
                labels: try state.records(table: .journalLabels)
            )
        }
    }

    public func entry(id: String) async throws -> JournalEntry? {
        try await store.read { state in
            try state.tables[DemoTable.journal.rawValue]?[id].map { try state.decode(JournalEntry.self, .object($0)) }
        }
    }

    public func editEntry(id: String) async throws -> JournalEditPayload {
        JournalEditPayload(entry: try await entry(id: id), labels: try await labels())
    }

    public func labels() async throws -> [JournalLabel] { try await store.read { try $0.records(table: .journalLabels) } }
    public func createEntry(_ values: JournalEntryFormValues) async throws -> String { try await save(id: nil, values: values) }

    public func saveEntry(id: String, initialValues: JournalEntryFormValues, values: JournalEntryFormValues) async throws {
        _ = try await save(id: id, values: values)
    }

    private func save(id: String?, values: JournalEntryFormValues) async throws -> String {
        try await store.change { state in
            let links = values.labels.map { label -> JSONValue in
                let labelId = label.id ?? "demo-journal-label-\(JournalLabelNormalizer.normalize(label.name))"
                state.insert(.journalLabels, ["name": .string(label.name)], id: labelId)
                return .object(["labelId": .string(labelId), "label": .object(["id": .string(labelId), "name": .string(label.name)])])
            }
            let record: DemoRecord = [
                "entryDate": .string(values.entryDate), "title": .string(values.title), "body": .string(values.body),
                "journalEntryLabels": .array(links)
            ]
            if let id { try state.update(.journal, id, record); return id }
            return state.insert(.journal, record)
        }
    }

    public func deleteEntry(id: String) async throws {
        try await store.change { state in
            _ = try state.row(.journal, id)
            state.remove(.journal, id)
        }
    }
}
