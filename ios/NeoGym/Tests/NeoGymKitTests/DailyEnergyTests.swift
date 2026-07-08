import Foundation
import Nhost
import XCTest
@testable import NeoGymKit

final class DailyEnergyRepositoryTests: XCTestCase {
    func testDecodesDailyEnergyFixtureAndSortQueryOperation() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "dailyEnergyEntries": .array([dailyEnergyFixture])
        ]))])
        let repository = DailyEnergyRepository(graphQL: fake)

        let entries = try await repository.listEntries()

        XCTAssertEqual(entries.count, 1)
        XCTAssertEqual(entries[0].energyOn, "2026-06-25")
        XCTAssertEqual(entries[0].activeKcal, 612.5)
        XCTAssertEqual(entries[0].restingKcal, 1_642.25)
        XCTAssertEqual(entries[0].notes, "Apple Watch day")
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.first?.operationName, "DailyEnergy")
        XCTAssertTrue(requests.first?.query.contains("dailyEnergyEntries(order_by: { energyOn: desc })") ?? false)
    }

    func testDecodesDailyEnergyDetailWithUpdatedAtAndNullOptionals() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "dailyEnergyEntry": dailyEnergyUpdatedAtFixture
        ]))])
        let repository = DailyEnergyRepository(graphQL: fake)

        let entry = try await repository.entry(id: "energy-1")

        XCTAssertEqual(entry?.id, "energy-1")
        XCTAssertEqual(entry?.activeKcal, 612.5)
        XCTAssertNil(entry?.restingKcal)
        XCTAssertEqual(entry?.updatedAt, "2026-06-25T14:30:00.000Z")
        let requests = await fake.requestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.operationName, "DailyEnergyById")
        XCTAssertEqual(request.variables?["id"], .string("energy-1"))
    }

    func testInsertVariablesOmitOwnershipAndUseNullableOptionalValues() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "insertDailyEnergyEntry": .object(["id": .string("energy-new")])
        ]))])
        let repository = DailyEnergyRepository(graphQL: fake)

        let id = try await repository.createEntry(DailyEnergyFormValues(
            energyOn: "2026-06-26",
            activeKcal: "450.5",
            restingKcal: "",
            notes: ""
        ))

        XCTAssertEqual(id, "energy-new")
        let requests = await fake.requestsSnapshot()
        let object = try XCTUnwrap(requests.first?.variables?["obj"])
        XCTAssertFalse(object.recursivelyContainsKey("userId"))
        XCTAssertEqual(object["energyOn"], .string("2026-06-26"))
        XCTAssertEqual(object["activeKcal"], .string("450.5"))
        XCTAssertEqual(object["restingKcal"], .null)
        XCTAssertEqual(object["notes"], .null)
    }

    func testUpdateVariablesOmitOwnershipAndUseSetInput() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "updateDailyEnergyEntry": .object(["id": .string("energy-1")])
        ]))])
        let repository = DailyEnergyRepository(graphQL: fake)

        try await repository.updateEntry(id: "energy-1", values: DailyEnergyFormValues(
            energyOn: "2026-06-27",
            activeKcal: "500",
            restingKcal: "1550.25",
            notes: "updated"
        ))

        let requests = await fake.requestsSnapshot()
        let variables = try XCTUnwrap(requests.first?.variables)
        XCTAssertEqual(variables["id"], .string("energy-1"))
        XCTAssertFalse(JSONValue.object(variables).recursivelyContainsKey("userId"))
        let set = try XCTUnwrap(variables["set"])
        XCTAssertEqual(set["energyOn"], .string("2026-06-27"))
        XCTAssertEqual(set["activeKcal"], .string("500"))
        XCTAssertEqual(set["restingKcal"], .string("1550.25"))
        XCTAssertEqual(set["notes"], .string("updated"))
    }

    func testDeleteVariablesArePrimaryKeyOnly() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "deleteDailyEnergyEntry": .object(["id": .string("energy-1")])
        ]))])
        let repository = DailyEnergyRepository(graphQL: fake)

        try await repository.deleteEntry(id: "energy-1")

        let requests = await fake.requestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.operationName, "DeleteDailyEnergy")
        XCTAssertEqual(request.variables, ["id": .string("energy-1")])
    }
}

@MainActor
final class DailyEnergyFormModelTests: XCTestCase {
    func testValidationNormalizesDecimalSeparatorsAndTrimsNotes() {
        let model = DailyEnergyFormModel(initialValues: DailyEnergyFormValues(
            energyOn: "2026-06-26",
            activeKcal: " 450,55 ",
            restingKcal: "1600,25",
            notes: "  imported  "
        ))

        let values = model.valuesForSubmit()

        XCTAssertEqual(values, DailyEnergyFormValues(
            energyOn: "2026-06-26",
            activeKcal: "450.55",
            restingKcal: "1600.25",
            notes: "imported"
        ))
        XCTAssertNil(model.errorMessage)
    }

    func testValidationRequiresActiveOrRestingEnergy() {
        let model = DailyEnergyFormModel(initialValues: DailyEnergyFormValues(
            energyOn: "2026-06-26",
            activeKcal: " ",
            restingKcal: "",
            notes: "notes only"
        ))

        XCTAssertNil(model.valuesForSubmit())
        XCTAssertEqual(model.errorMessage, "Enter active energy, resting energy, or both.")
    }

    func testValidationMirrorsDatabaseNumericRanges() {
        let negativeActive = DailyEnergyFormModel(initialValues: DailyEnergyFormValues(
            energyOn: "2026-06-26",
            activeKcal: "-1",
            restingKcal: "1500",
            notes: ""
        ))
        let excessiveResting = DailyEnergyFormModel(initialValues: DailyEnergyFormValues(
            energyOn: "2026-06-26",
            activeKcal: "450",
            restingKcal: "30000",
            notes: ""
        ))
        let boundaryValid = DailyEnergyFormModel(initialValues: DailyEnergyFormValues(
            energyOn: "2026-06-26",
            activeKcal: "0",
            restingKcal: "29999.99",
            notes: ""
        ))

        XCTAssertNil(negativeActive.valuesForSubmit())
        XCTAssertEqual(negativeActive.errorMessage, "Use up to 5 digits and 2 decimal places.")
        XCTAssertNil(excessiveResting.valuesForSubmit())
        XCTAssertEqual(excessiveResting.errorMessage, "Resting energy must be at least 0 and less than 30000 kcal.")
        XCTAssertNotNil(boundaryValid.valuesForSubmit())
    }

    func testValidationRejectsMoreThanTwoDecimalPlaces() {
        let model = DailyEnergyFormModel(initialValues: DailyEnergyFormValues(
            energyOn: "2026-06-26",
            activeKcal: "450.123",
            restingKcal: "",
            notes: ""
        ))

        XCTAssertNil(model.valuesForSubmit())
        XCTAssertEqual(model.errorMessage, "Use up to 5 digits and 2 decimal places.")
    }

    func testValidationRejectsInvalidDateOnlyValue() {
        let model = DailyEnergyFormModel(initialValues: DailyEnergyFormValues(
            energyOn: "not-a-date",
            activeKcal: "450",
            restingKcal: "",
            notes: ""
        ))

        XCTAssertNil(model.valuesForSubmit())
        XCTAssertEqual(model.errorMessage, "Choose a valid energy date.")
    }
}

@MainActor
final class DailyEnergyHealthSyncViewModelTests: XCTestCase {
    func testHealthSyncSkipsExistingDatesAndImportsNewDatesOnLoad() async throws {
        let repository = FakeDailyEnergyRepository(entries: [
            DailyEnergy(id: "existing", energyOn: "2026-06-25", activeKcal: 400, restingKcal: nil)
        ])
        let importer = FakeDailyEnergyHealthImporter(entries: [
            HealthDailyEnergy(energyOn: "2026-06-25", activeKcal: 450, restingKcal: 1500),
            HealthDailyEnergy(energyOn: "2026-06-26", activeKcal: 500.25, restingKcal: 1600)
        ])
        let viewModel = DailyEnergyListViewModel(repository: repository, healthImporter: importer)

        await viewModel.load(shouldSyncHealthEnergy: true)

        let createdValues = await repository.createdValuesSnapshot()
        XCTAssertEqual(createdValues, [DailyEnergyFormValues(
            energyOn: "2026-06-26",
            activeKcal: "500.25",
            restingKcal: "1600",
            notes: "Imported from Apple Health"
        )])
        XCTAssertEqual(viewModel.entries.map(\.energyOn), ["2026-06-25", "2026-06-26"])
        XCTAssertEqual(viewModel.healthSyncState.value, DailyEnergyHealthSyncSummary(
            importedCount: 1,
            skippedExistingCount: 1
        ))
    }

    func testHealthSyncTreatsUniqueConflictOnCreateAsSkippedExisting() async throws {
        let repository = FakeDailyEnergyRepository(
            entries: [],
            duplicateOnCreateDates: ["2026-06-26"]
        )
        let importer = FakeDailyEnergyHealthImporter(entries: [
            HealthDailyEnergy(energyOn: "2026-06-26", activeKcal: 500, restingKcal: 1600)
        ])
        let viewModel = DailyEnergyListViewModel(repository: repository, healthImporter: importer)

        await viewModel.load(shouldSyncHealthEnergy: true)

        let createdValues = await repository.createdValuesSnapshot()
        XCTAssertTrue(createdValues.isEmpty)
        XCTAssertEqual(viewModel.healthSyncState.value, DailyEnergyHealthSyncSummary(
            importedCount: 0,
            skippedExistingCount: 1
        ))
        XCTAssertNil(viewModel.healthSyncState.errorMessage)
    }

    func testHealthSyncDoesNotCountUnimportableHealthRowsAsSkippedExisting() async throws {
        let repository = FakeDailyEnergyRepository(entries: [])
        let importer = FakeDailyEnergyHealthImporter(entries: [
            HealthDailyEnergy(energyOn: "2026-06-26", activeKcal: .nan, restingKcal: nil)
        ])
        let viewModel = DailyEnergyListViewModel(repository: repository, healthImporter: importer)

        await viewModel.load(shouldSyncHealthEnergy: true)

        XCTAssertEqual(viewModel.healthSyncState.value, DailyEnergyHealthSyncSummary(
            importedCount: 0,
            skippedExistingCount: 0
        ))
    }
}


final class DailyEnergyTrendBuilderTests: XCTestCase {
    func testTrendDataSortsAscendingAndDropsInvalidDatesWithoutTimezoneShift() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(secondsFromGMT: -8 * 3600))
        let entries = [
            DailyEnergy(id: "later", energyOn: "2026-06-20", activeKcal: 500, restingKcal: nil),
            DailyEnergy(id: "invalid", energyOn: "bad", activeKcal: 400, restingKcal: 1500),
            DailyEnergy(id: "earlier", energyOn: "2026-06-01", activeKcal: 450, restingKcal: 1550),
            DailyEnergy(id: "middle", energyOn: "2026-06-10", activeKcal: nil, restingKcal: 1600)
        ]

        let trend = DailyEnergyTrendBuilder.make(from: entries, calendar: calendar)

        XCTAssertEqual(trend.points.map(\.id), ["earlier", "middle", "later"])
        XCTAssertEqual(trend.activeCount, 2)
        XCTAssertEqual(trend.restingCount, 2)
        XCTAssertTrue(trend.shouldShowChart)
        XCTAssertEqual(calendar.component(.day, from: trend.points[0].date), 1)
    }
}

final class DailyEnergyErrorMapperTests: XCTestCase {
    func testMapsEnergyOnUniquenessConstraintToFriendlyCopy() {
        let error = GraphQLDomainError.graphQLErrors([
            GraphQLErrorDetail(
                message: "Uniqueness violation",
                code: "constraint-violation",
                constraintName: "daily_energy_user_date_key"
            )
        ])

        XCTAssertEqual(
            DailyEnergyErrorMapper.message(for: error),
            "You already have an energy entry for this date. Edit that entry or choose another date."
        )
    }
}

private actor FakeDailyEnergyRepository: DailyEnergyRepositoryProtocol {
    private var entries: [DailyEnergy]
    private var createdValues: [DailyEnergyFormValues] = []
    private let duplicateOnCreateDates: Set<String>

    init(entries: [DailyEnergy], duplicateOnCreateDates: Set<String> = []) {
        self.entries = entries
        self.duplicateOnCreateDates = duplicateOnCreateDates
    }

    func listEntries() async throws -> [DailyEnergy] {
        entries
    }

    func entry(id: String) async throws -> DailyEnergy? {
        entries.first { $0.id == id }
    }

    func editEntry(id: String) async throws -> DailyEnergy? {
        entries.first { $0.id == id }
    }

    func createEntry(_ values: DailyEnergyFormValues) async throws -> String {
        if duplicateOnCreateDates.contains(values.energyOn) {
            throw GraphQLDomainError.graphQLErrors([
                GraphQLErrorDetail(
                    message: "Uniqueness violation",
                    code: "constraint-violation",
                    constraintName: "daily_energy_user_date_key"
                )
            ])
        }
        let id = "created-\(createdValues.count + 1)"
        createdValues.append(values)
        entries.append(DailyEnergy(
            id: id,
            energyOn: values.energyOn,
            activeKcal: Double(values.activeKcal),
            restingKcal: Double(values.restingKcal),
            notes: values.notes.isEmpty ? nil : values.notes
        ))
        return id
    }

    func updateEntry(id: String, values: DailyEnergyFormValues) async throws {
        guard let index = entries.firstIndex(where: { $0.id == id }) else { return }
        entries[index] = DailyEnergy(
            id: id,
            energyOn: values.energyOn,
            activeKcal: Double(values.activeKcal),
            restingKcal: Double(values.restingKcal),
            notes: values.notes.isEmpty ? nil : values.notes
        )
    }

    func deleteEntry(id: String) async throws {
        entries.removeAll { $0.id == id }
    }

    func createdValuesSnapshot() -> [DailyEnergyFormValues] {
        createdValues
    }
}

private struct FakeDailyEnergyHealthImporter: DailyEnergyHealthImporting {
    let entries: [HealthDailyEnergy]

    func dailyEnergyEntries() async throws -> [HealthDailyEnergy] {
        entries
    }
}

private let dailyEnergyFixture: JSONValue = .object([
    "id": .string("energy-1"),
    "energyOn": .string("2026-06-25"),
    "activeKcal": .string("612.50"),
    "restingKcal": .number(1_642.25),
    "notes": .string("Apple Watch day")
])

private let dailyEnergyUpdatedAtFixture: JSONValue = .object([
    "id": .string("energy-1"),
    "energyOn": .string("2026-06-25"),
    "activeKcal": .string("612.50"),
    "restingKcal": .null,
    "notes": .string("Active-only day"),
    "updatedAt": .string("2026-06-25T14:30:00.000Z")
])

private extension JSONValue {
    subscript(key: String) -> JSONValue? {
        objectValue?[key]
    }

    func recursivelyContainsKey(_ key: String) -> Bool {
        switch self {
        case let .object(object):
            object.keys.contains(key) || object.values.contains { $0.recursivelyContainsKey(key) }
        case let .array(values):
            values.contains { $0.recursivelyContainsKey(key) }
        case .null, .bool, .number, .string:
            false
        }
    }
}
