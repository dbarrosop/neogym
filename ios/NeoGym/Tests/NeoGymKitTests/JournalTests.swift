import Foundation
import XCTest
@testable import NeoGymKit

final class JournalRepositoryTests: XCTestCase {
    func testDecodesJournalEntriesAndLabelsFixtures() async throws {
        let fake = FakeGraphQLService(replies: [
            .json(.object([
                "journalEntries": .array([journalEntryFixture]),
                "journalLabels": .array([journalLabelFixture])
            ]))
        ])
        let repository = JournalRepository(graphQL: fake)

        let payload = try await repository.listEntries(limit: 25, offset: 0, labelIds: [])

        XCTAssertEqual(payload.entries.count, 1)
        XCTAssertEqual(payload.entries[0].entryDate, "2026-06-26")
        XCTAssertEqual(payload.entries[0].displayTitle, "Solid training day")
        XCTAssertEqual(payload.entries[0].previewText, "Notes Felt strong today.")
        XCTAssertEqual(payload.entries[0].journalEntryLabels.map(\.label.name), ["reflection"])
        XCTAssertEqual(payload.labels.map(\.name), ["reflection"])
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.map(\.operationName), ["JournalEntries"])
        XCTAssertEqual(requests[0].variables?["where"], .object([:]))
    }

    func testListEntriesBuildsAndLabelFilterWhereClause() async throws {
        let fake = FakeGraphQLService(replies: [
            .json(.object([
                "journalEntries": .array([]),
                "journalLabels": .array([])
            ]))
        ])
        let repository = JournalRepository(graphQL: fake)

        _ = try await repository.listEntries(limit: 10, offset: 20, labelIds: ["label-a", "label-b"])

        let requests = await fake.requestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.variables?["limit"], .number(10))
        XCTAssertEqual(request.variables?["offset"], .number(20))
        let clauses = try XCTUnwrap(request.variables?["where"]?["_and"]?.arrayValue)
        XCTAssertEqual(clauses.count, 2)
        XCTAssertEqual(clauses[0]["journalEntryLabels"]?["labelId"]?["_eq"], .string("label-a"))
        XCTAssertEqual(clauses[1]["journalEntryLabels"]?["labelId"]?["_eq"], .string("label-b"))
    }

    func testDecodesJournalEntryDetailAndEditPayload() async throws {
        let fake = FakeGraphQLService(replies: [
            .json(.object(["journalEntry": journalEntryFixture])),
            .json(.object([
                "journalEntry": journalEntryFixture,
                "journalLabels": .array([journalLabelFixture])
            ]))
        ])
        let repository = JournalRepository(graphQL: fake)

        let entry = try await repository.entry(id: "entry-1")
        let edit = try await repository.editEntry(id: "entry-1")

        XCTAssertEqual(entry?.id, "entry-1")
        XCTAssertEqual(edit.entry?.body, "# Notes\n\nFelt **strong** today.")
        XCTAssertEqual(edit.labels, [JournalLabel(id: "label-1", name: "reflection")])
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests[0].operationName, "JournalEntryById")
        XCTAssertEqual(requests[0].variables?["id"], .string("entry-1"))
        XCTAssertEqual(requests[1].operationName, "EditJournalEntry")
    }

    func testCreateEntryVariablesOmitForbiddenOwnershipAndCreateNestedLabels() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "insertJournalEntry": .object(["id": .string("entry-new")])
        ]))])
        let repository = JournalRepository(graphQL: fake)

        let id = try await repository.createEntry(JournalEntryFormValues(
            entryDate: "2026-06-27",
            title: "",
            body: "Body",
            labels: [
                JournalLabelSelection(id: "label-existing", name: "reflection"),
                JournalLabelSelection(name: "mobility")
            ]
        ))

        XCTAssertEqual(id, "entry-new")
        let requests = await fake.requestsSnapshot()
        let object = try XCTUnwrap(requests.first?.variables?["obj"])
        XCTAssertFalse(object.recursivelyContainsKey("userId"))
        XCTAssertFalse(object.recursivelyContainsKey("isPublic"))
        XCTAssertFalse(object.recursivelyContainsKey("kind"))
        XCTAssertFalse(object.recursivelyContainsKey("parentKind"))
        XCTAssertEqual(object["entryDate"], .string("2026-06-27"))
        XCTAssertEqual(object["title"], .null)
        XCTAssertEqual(object["body"], .string("Body"))
        let labelRows = try XCTUnwrap(object["journalEntryLabels"]?["data"]?.arrayValue)
        XCTAssertEqual(labelRows[0]["labelId"], .string("label-existing"))
        XCTAssertEqual(labelRows[1]["label"]?["data"]?["name"], .string("mobility"))
        XCTAssertEqual(labelRows[1]["label"]?["on_conflict"]?["constraint"], .string("journal_labels_user_name_key"))
        XCTAssertEqual(labelRows[1]["label"]?["on_conflict"]?["update_columns"]?.arrayValue, [])
    }

    func testSaveEntryVariablesDiffLabelsAndOmitForbiddenColumns() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "updateJournalEntry": .object(["id": .string("entry-1")])
        ]))])
        let repository = JournalRepository(graphQL: fake)
        let initial = JournalEntryFormValues(
            entryDate: "2026-06-26",
            title: "Old",
            body: "Old body",
            labels: [
                JournalLabelSelection(id: "label-keep", name: "reflection"),
                JournalLabelSelection(id: "label-drop", name: "old")
            ]
        )
        let next = JournalEntryFormValues(
            entryDate: "2026-06-27",
            title: "Updated",
            body: "Updated body",
            labels: [
                JournalLabelSelection(id: "label-keep", name: "reflection"),
                JournalLabelSelection(id: "label-add", name: "sleep"),
                JournalLabelSelection(name: "mobility")
            ]
        )

        try await repository.saveEntry(id: "entry-1", initialValues: initial, values: next)

        let requests = await fake.requestsSnapshot()
        let variables = try XCTUnwrap(requests.first?.variables)
        XCTAssertFalse(JSONValue.object(variables).recursivelyContainsKey("userId"))
        XCTAssertFalse(JSONValue.object(variables).recursivelyContainsKey("isPublic"))
        XCTAssertFalse(JSONValue.object(variables).recursivelyContainsKey("kind"))
        XCTAssertFalse(JSONValue.object(variables).recursivelyContainsKey("parentKind"))
        XCTAssertEqual(variables["id"], .string("entry-1"))
        XCTAssertEqual(variables["set"]?["entryDate"], .string("2026-06-27"))
        XCTAssertEqual(variables["set"]?["title"], .string("Updated"))
        XCTAssertEqual(variables["set"]?["body"], .string("Updated body"))
        XCTAssertEqual(variables["deleteLabelIds"]?.arrayValue, [.string("label-drop")])
        XCTAssertEqual(variables["hasDeleteLabels"], .bool(true))
        let insertRows = try XCTUnwrap(variables["insertLabels"]?.arrayValue)
        XCTAssertEqual(insertRows[0]["journalEntryId"], .string("entry-1"))
        XCTAssertEqual(insertRows[0]["labelId"], .string("label-add"))
        XCTAssertEqual(insertRows[1]["journalEntryId"], .string("entry-1"))
        XCTAssertEqual(insertRows[1]["label"]?["data"]?["name"], .string("mobility"))
        XCTAssertEqual(variables["hasInsertLabels"], .bool(true))
    }

    func testDeleteEntryVariablesArePrimaryKeyOnly() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "deleteJournalEntry": .object(["id": .string("entry-1")])
        ]))])
        let repository = JournalRepository(graphQL: fake)

        try await repository.deleteEntry(id: "entry-1")

        let requests = await fake.requestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.operationName, "DeleteJournalEntry")
        XCTAssertEqual(request.variables, ["id": .string("entry-1")])
    }
}

@MainActor
final class JournalEntryFormModelTests: XCTestCase {
    func testValidationTrimsBodyAndTitleAndRequiresBody() {
        let model = JournalEntryFormModel(initialValues: JournalEntryFormValues(
            entryDate: "2026-06-26",
            title: "  Good day  ",
            body: "  **Strong** session  ",
            labels: []
        ))

        XCTAssertEqual(model.valuesForSubmit(), JournalEntryFormValues(
            entryDate: "2026-06-26",
            title: "Good day",
            body: "**Strong** session",
            labels: []
        ))

        model.body = "   "
        XCTAssertNil(model.valuesForSubmit())
        XCTAssertEqual(model.errorMessage, "Entry body is required.")
    }

    func testValidationRejectsInvalidDateAndLongTitle() {
        let invalidDate = JournalEntryFormModel(initialValues: JournalEntryFormValues(
            entryDate: "bad",
            title: "Title",
            body: "Body",
            labels: []
        ))
        XCTAssertNil(invalidDate.valuesForSubmit())
        XCTAssertEqual(invalidDate.errorMessage, "Choose a valid entry date.")

        let longTitle = JournalEntryFormModel(initialValues: JournalEntryFormValues(
            entryDate: "2026-06-26",
            title: String(repeating: "x", count: 201),
            body: "Body",
            labels: []
        ))
        XCTAssertNil(longTitle.valuesForSubmit())
        XCTAssertEqual(longTitle.errorMessage, "Title must be 200 characters or less.")
    }

    func testLabelsNormalizeReuseSuggestionsDeduplicateAndDetach() {
        let model = JournalEntryFormModel(initialValues: JournalEntryFormValues(
            entryDate: "2026-06-26",
            title: "",
            body: "Body",
            labels: []
        ))
        let suggestions = [JournalLabel(id: "label-1", name: "training notes")]

        model.commitLabel("  Training   Notes ", suggestions: suggestions)
        model.commitLabel("training notes", suggestions: suggestions)
        model.commitLabel("Reflection", suggestions: suggestions)
        model.removeLabel(name: "training notes")

        XCTAssertEqual(model.labels, [JournalLabelSelection(name: "reflection")])
    }
}

@MainActor
final class JournalListViewModelTests: XCTestCase {
    func testToggleLabelUsesAndFilterIdsAndClearReloads() async {
        let repository = StubJournalRepository()
        let viewModel = JournalListViewModel(repository: repository, pageSize: 1)

        await viewModel.load()
        await viewModel.toggleLabel("label-1")
        await viewModel.toggleLabel("label-2")
        await viewModel.clearFilters()

        XCTAssertEqual(repository.recordedLabelIds, [[], ["label-1"], ["label-1", "label-2"], []])
        XCTAssertFalse(viewModel.isFiltered)
    }
}

private final class StubJournalRepository: JournalRepositoryProtocol, @unchecked Sendable {
    private(set) var recordedLabelIds: [[String]] = []

    func listEntries(limit: Int, offset: Int, labelIds: [String]) async throws -> JournalIndexPayload {
        recordedLabelIds.append(labelIds)
        return JournalIndexPayload(
            entries: [JournalEntry(id: "entry-\(recordedLabelIds.count)", entryDate: "2026-06-26", body: "Body")],
            labels: [JournalLabel(id: "label-1", name: "one"), JournalLabel(id: "label-2", name: "two")]
        )
    }

    func entry(id: String) async throws -> JournalEntry? { nil }
    func editEntry(id: String) async throws -> JournalEditPayload { JournalEditPayload(entry: nil, labels: []) }
    func labels() async throws -> [JournalLabel] { [] }
    func createEntry(_ values: JournalEntryFormValues) async throws -> String { "new" }
    func saveEntry(id: String, initialValues: JournalEntryFormValues, values: JournalEntryFormValues) async throws {}
    func deleteEntry(id: String) async throws {}
}

private let journalLabelFixture: JSONValue = .object([
    "id": .string("label-1"),
    "name": .string("reflection")
])

private let journalEntryFixture: JSONValue = .object([
    "id": .string("entry-1"),
    "entryDate": .string("2026-06-26"),
    "title": .string("Solid training day"),
    "body": .string("# Notes\n\nFelt **strong** today."),
    "journalEntryLabels": .array([.object([
        "labelId": .string("label-1"),
        "label": journalLabelFixture
    ])])
])

private extension JSONValue {
    subscript(key: String) -> JSONValue? {
        guard case let .object(object) = self else { return nil }
        return object[key]
    }

    func recursivelyContainsKey(_ key: String) -> Bool {
        switch self {
        case let .object(object):
            object.keys.contains(key) || object.values.contains { $0.recursivelyContainsKey(key) }
        case let .array(values):
            values.contains { $0.recursivelyContainsKey(key) }
        default:
            false
        }
    }
}
