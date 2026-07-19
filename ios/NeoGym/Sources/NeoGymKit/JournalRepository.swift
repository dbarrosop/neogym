import Foundation

public protocol JournalRepositoryProtocol: Sendable {
    func listEntries(limit: Int, offset: Int, labelIds: [String]) async throws -> JournalIndexPayload
    func journalListUpdates(
        limit: Int,
        offset: Int,
        labelIds: [String]
    ) -> AsyncThrowingStream<JournalIndexPayload, Error>
    func entryUpdates(id: String) -> AsyncThrowingStream<JournalEntry?, Error>
    func entry(id: String) async throws -> JournalEntry?
    func editEntry(id: String) async throws -> JournalEditPayload
    func labels() async throws -> [JournalLabel]
    func createEntry(_ values: JournalEntryFormValues) async throws -> String
    func saveEntry(id: String, initialValues: JournalEntryFormValues, values: JournalEntryFormValues) async throws
    func deleteEntry(id: String) async throws
}

public extension JournalRepositoryProtocol {
    func journalListUpdates(
        limit: Int,
        offset: Int,
        labelIds: [String]
    ) -> AsyncThrowingStream<JournalIndexPayload, Error> {
        singleValueUpdates {
            try await listEntries(limit: limit, offset: offset, labelIds: labelIds)
        }
    }

    func entryUpdates(id: String) -> AsyncThrowingStream<JournalEntry?, Error> {
        singleValueUpdates { try await entry(id: id) }
    }
}

public struct JournalRepository: JournalRepositoryProtocol {
    private let graphQL: any GraphQLServicing

    public init(graphQL: any GraphQLServicing) {
        self.graphQL = graphQL
    }

    public func listEntries(
        limit: Int = 25,
        offset: Int = 0,
        labelIds: [String] = []
    ) async throws -> JournalIndexPayload {
        let variables = GraphQLScalars.variables(
            ("limit", .number(Double(limit))),
            ("offset", .number(Double(offset))),
            ("where", Self.entriesWhere(labelIds: labelIds) ?? .object([:]))
        )
        let data: JournalEntriesData = try await graphQL.execute(
            query: Self.journalEntriesQuery,
            variables: variables,
            operationName: "JournalEntries"
        )
        return Self.indexPayload(from: data)
    }

    public func journalListUpdates(
        limit: Int,
        offset: Int,
        labelIds: [String]
    ) -> AsyncThrowingStream<JournalIndexPayload, Error> {
        graphQL.cachedValues(
            JournalEntriesData.self,
            query: Self.journalEntriesQuery,
            variables: Self.listVariables(limit: limit, offset: offset, labelIds: labelIds),
            operationName: "JournalEntries",
            namespace: "journal",
            tags: ["journal"],
            transform: Self.indexPayload
        )
    }

    private static func listVariables(limit: Int, offset: Int, labelIds: [String]) -> [String: JSONValue] {
        GraphQLScalars.variables(
            ("limit", .number(Double(limit))),
            ("offset", .number(Double(offset))),
            ("where", entriesWhere(labelIds: labelIds) ?? .object([:]))
        )
    }

    private static func indexPayload(from data: JournalEntriesData) -> JournalIndexPayload {
        JournalIndexPayload(entries: data.journalEntries, labels: data.journalLabels)
    }

    public func entryUpdates(id: String) -> AsyncThrowingStream<JournalEntry?, Error> {
        graphQL.cachedValues(
            JournalEntryByIdData.self,
            query: Self.journalEntryByIdQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "JournalEntryById",
            namespace: "journal",
            tags: ["journal"],
            transform: \JournalEntryByIdData.journalEntry
        )
    }

    public func entry(id: String) async throws -> JournalEntry? {
        let data: JournalEntryByIdData = try await graphQL.execute(
            query: Self.journalEntryByIdQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "JournalEntryById"
        )
        return data.journalEntry
    }

    public func editEntry(id: String) async throws -> JournalEditPayload {
        let data: EditJournalEntryData = try await graphQL.execute(
            query: Self.editJournalEntryQuery,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "EditJournalEntry"
        )
        return JournalEditPayload(entry: data.journalEntry, labels: data.journalLabels)
    }

    public func labels() async throws -> [JournalLabel] {
        let data: JournalLabelsData = try await graphQL.execute(
            query: Self.journalLabelsForFormQuery,
            operationName: "JournalLabelsForForm"
        )
        return data.journalLabels
    }

    public func createEntry(_ values: JournalEntryFormValues) async throws -> String {
        let data: InsertJournalEntryData = try await graphQL.execute(
            query: Self.insertJournalEntryMutation,
            variables: ["obj": Self.createEntryObject(values)],
            operationName: "InsertJournalEntry"
        )
        guard let id = data.insertJournalEntry?.id else {
            throw GraphQLDomainError.missingData(operationName: "InsertJournalEntry")
        }
        return id
    }

    public func saveEntry(
        id: String,
        initialValues: JournalEntryFormValues,
        values: JournalEntryFormValues
    ) async throws {
        let _: SaveJournalEntryData = try await graphQL.execute(
            query: Self.saveJournalEntryMutation,
            variables: Self.saveEntryVariables(id: id, initialValues: initialValues, values: values),
            operationName: "SaveJournalEntry"
        )
    }

    public func deleteEntry(id: String) async throws {
        let _: DeleteJournalEntryData = try await graphQL.execute(
            query: Self.deleteJournalEntryMutation,
            variables: ["id": GraphQLScalars.uuid(id)],
            operationName: "DeleteJournalEntry"
        )
    }
}

private struct JournalEntriesData: Decodable, Sendable {
    let journalEntries: [JournalEntry]
    let journalLabels: [JournalLabel]
}

private struct JournalEntryByIdData: Decodable, Sendable {
    let journalEntry: JournalEntry?
}

private struct EditJournalEntryData: Decodable, Sendable {
    let journalEntry: JournalEntry?
    let journalLabels: [JournalLabel]
}

private struct JournalLabelsData: Decodable, Sendable {
    let journalLabels: [JournalLabel]
}

private struct InsertJournalEntryData: Decodable, Sendable {
    let insertJournalEntry: MutationIdPayload?
}

private struct SaveJournalEntryData: Decodable, Sendable {
    let updateJournalEntry: MutationIdPayload?
}

private struct DeleteJournalEntryData: Decodable, Sendable {
    let deleteJournalEntry: MutationIdPayload?
}

private struct MutationIdPayload: Decodable, Sendable {
    let id: String
}

public extension JournalRepository {
    static let pageSize = 25

    static let journalEntriesQuery = """
    query JournalEntries($limit: Int!, $offset: Int!, $where: journalEntries_bool_exp) {
      journalEntries(
        where: $where
        order_by: [{ entryDate: desc }, { createdAt: desc }]
        limit: $limit
        offset: $offset
      ) {
        id
        entryDate
        title
        body
        journalEntryLabels {
          labelId
          label { id name }
        }
      }
      journalLabels(order_by: { name: asc }) {
        id
        name
      }
    }
    """

    static let journalLabelsFilterQuery = """
    query JournalLabelsFilter {
      journalLabels(order_by: { name: asc }) {
        id
        name
      }
    }
    """

    static let journalEntryByIdQuery = """
    query JournalEntryById($id: uuid!) {
      journalEntry(id: $id) {
        id
        entryDate
        title
        body
        journalEntryLabels {
          labelId
          label { id name }
        }
      }
    }
    """

    static let editJournalEntryQuery = """
    query EditJournalEntry($id: uuid!) {
      journalEntry(id: $id) {
        id
        entryDate
        title
        body
        journalEntryLabels {
          labelId
          label { id name }
        }
      }
      journalLabels(order_by: { name: asc }) {
        id
        name
      }
    }
    """

    static let journalLabelsForFormQuery = """
    query JournalLabelsForForm {
      journalLabels(order_by: { name: asc }) {
        id
        name
      }
    }
    """

    static let insertJournalEntryMutation = """
    mutation InsertJournalEntry($obj: journalEntries_insert_input!) {
      insertJournalEntry(object: $obj) {
        id
      }
    }
    """

    static let saveJournalEntryMutation = """
    mutation SaveJournalEntry(
      $id: uuid!
      $set: journalEntries_set_input!
      $deleteLabelIds: [uuid!]!
      $hasDeleteLabels: Boolean!
      $insertLabels: [journalEntryLabels_insert_input!]!
      $hasInsertLabels: Boolean!
    ) {
      updateJournalEntry(pk_columns: { id: $id }, _set: $set) { id }
      deleteJournalEntryLabels(
        where: { journalEntryId: { _eq: $id }, labelId: { _in: $deleteLabelIds } }
      ) @include(if: $hasDeleteLabels) { affected_rows }
      insertJournalEntryLabels(
        objects: $insertLabels
        on_conflict: { constraint: journal_entry_labels_pkey, update_columns: [] }
      ) @include(if: $hasInsertLabels) { affected_rows }
    }
    """

    static let deleteJournalEntryMutation = """
    mutation DeleteJournalEntry($id: uuid!) {
      deleteJournalEntry(id: $id) {
        id
      }
    }
    """

    static func entriesWhere(labelIds: [String]) -> JSONValue? {
        guard !labelIds.isEmpty else { return nil }
        return .object([
            "_and": .array(labelIds.map { labelId in
                .object([
                    "journalEntryLabels": .object([
                        "labelId": .object(["_eq": GraphQLScalars.uuid(labelId)])
                    ])
                ])
            })
        ])
    }

    static func createEntryObject(_ values: JournalEntryFormValues) -> JSONValue {
        .object([
            "entryDate": GraphQLScalars.date(values.entryDate),
            "title": values.title.isEmpty ? .null : .string(values.title),
            "body": .string(values.body),
            "journalEntryLabels": .object([
                "data": .array(values.labels.map(labelInsertObject(journalEntryId: nil)))
            ])
        ])
    }

    static func saveEntryVariables(
        id: String,
        initialValues: JournalEntryFormValues,
        values: JournalEntryFormValues
    ) -> [String: JSONValue] {
        let originalIds = Set(initialValues.labels.compactMap(\.id))
        let nextIds = Set(values.labels.compactMap(\.id))
        let deleteLabelIds = originalIds.filter { !nextIds.contains($0) }.sorted()
        let insertLabels = values.labels
            .filter { label in
                guard let labelId = label.id else { return true }
                return !originalIds.contains(labelId)
            }
            .map(labelInsertObject(journalEntryId: id))

        return [
            "id": GraphQLScalars.uuid(id),
            "set": .object([
                "entryDate": GraphQLScalars.date(values.entryDate),
                "title": values.title.isEmpty ? .null : .string(values.title),
                "body": .string(values.body)
            ]),
            "deleteLabelIds": .array(deleteLabelIds.map(GraphQLScalars.uuid)),
            "hasDeleteLabels": .bool(!deleteLabelIds.isEmpty),
            "insertLabels": .array(insertLabels),
            "hasInsertLabels": .bool(!insertLabels.isEmpty)
        ]
    }

    private static func labelInsertObject(journalEntryId: String?) -> (JournalLabelSelection) -> JSONValue {
        { label in
            var object: [String: JSONValue] = [:]
            if let journalEntryId {
                object["journalEntryId"] = GraphQLScalars.uuid(journalEntryId)
            }
            if let id = label.id {
                object["labelId"] = GraphQLScalars.uuid(id)
            } else {
                object["label"] = .object([
                    "data": .object(["name": .string(label.name)]),
                    "on_conflict": .object([
                        "constraint": .string("journal_labels_user_name_key"),
                        "update_columns": .array([])
                    ])
                ])
            }
            return .object(object)
        }
    }
}
