import Foundation
import Nhost
import XCTest
@testable import NeoGymKit

final class BodyMeasurementsRepositoryTests: XCTestCase {
    func testDecodesBodyMeasurementsFixtureAndSortQueryOperation() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "bodyMeasurements": .array([bodyMeasurementFixture])
        ]))])
        let repository = BodyMeasurementsRepository(graphQL: fake)

        let measurements = try await repository.listMeasurements()

        XCTAssertEqual(measurements.count, 1)
        XCTAssertEqual(measurements[0].measuredOn, "2026-06-25")
        XCTAssertEqual(measurements[0].weightKg, 80.75)
        XCTAssertEqual(measurements[0].bodyFatPct, 17.8)
        XCTAssertEqual(measurements[0].notes, "Morning check-in")
        let requests = await fake.requestsSnapshot()
        XCTAssertEqual(requests.first?.operationName, "BodyMeasurements")
        XCTAssertTrue(requests.first?.query.contains("order_by: { measuredOn: desc }") ?? false)
    }

    func testDecodesBodyMeasurementDetailWithUpdatedAt() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "bodyMeasurement": bodyMeasurementFixtureWithUpdatedAt
        ]))])
        let repository = BodyMeasurementsRepository(graphQL: fake)

        let measurement = try await repository.measurement(id: "measurement-1")

        XCTAssertEqual(measurement?.id, "measurement-1")
        XCTAssertEqual(measurement?.updatedAt, "2026-06-25T14:30:00.000Z")
        let requests = await fake.requestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.operationName, "BodyMeasurementById")
        XCTAssertEqual(request.variables?["id"], .string("measurement-1"))
    }

    func testInsertVariablesOmitOwnershipAndUseNullableOptionalValues() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "insertBodyMeasurement": .object(["id": .string("measurement-new")])
        ]))])
        let repository = BodyMeasurementsRepository(graphQL: fake)

        let id = try await repository.createMeasurement(BodyMeasurementFormValues(
            measuredOn: "2026-06-26",
            weightKg: "80.5",
            bodyFatPct: "",
            notes: ""
        ))

        XCTAssertEqual(id, "measurement-new")
        let requests = await fake.requestsSnapshot()
        let object = try XCTUnwrap(requests.first?.variables?["obj"])
        XCTAssertFalse(object.recursivelyContainsKey("userId"))
        XCTAssertEqual(object["measuredOn"], .string("2026-06-26"))
        XCTAssertEqual(object["weightKg"], .string("80.5"))
        XCTAssertEqual(object["bodyFatPct"], .null)
        XCTAssertEqual(object["notes"], .null)
    }

    func testUpdateVariablesOmitOwnershipAndUseSetInput() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "updateBodyMeasurement": .object(["id": .string("measurement-1")])
        ]))])
        let repository = BodyMeasurementsRepository(graphQL: fake)

        try await repository.updateMeasurement(id: "measurement-1", values: BodyMeasurementFormValues(
            measuredOn: "2026-06-27",
            weightKg: "79.25",
            bodyFatPct: "16.9",
            notes: "trimmed"
        ))

        let requests = await fake.requestsSnapshot()
        let variables = try XCTUnwrap(requests.first?.variables)
        XCTAssertEqual(variables["id"], .string("measurement-1"))
        XCTAssertFalse(JSONValue.object(variables).recursivelyContainsKey("userId"))
        let set = try XCTUnwrap(variables["set"])
        XCTAssertEqual(set["measuredOn"], .string("2026-06-27"))
        XCTAssertEqual(set["weightKg"], .string("79.25"))
        XCTAssertEqual(set["bodyFatPct"], .string("16.9"))
        XCTAssertEqual(set["notes"], .string("trimmed"))
    }

    func testDeleteVariablesArePrimaryKeyOnly() async throws {
        let fake = FakeGraphQLService(replies: [.json(.object([
            "deleteBodyMeasurement": .object(["id": .string("measurement-1")])
        ]))])
        let repository = BodyMeasurementsRepository(graphQL: fake)

        try await repository.deleteMeasurement(id: "measurement-1")

        let requests = await fake.requestsSnapshot()
        let request = try XCTUnwrap(requests.first)
        XCTAssertEqual(request.operationName, "DeleteBodyMeasurement")
        XCTAssertEqual(request.variables, ["id": .string("measurement-1")])
    }
}

@MainActor
final class BodyMeasurementFormModelTests: XCTestCase {
    func testValidationNormalizesDecimalSeparatorsAndTrimsNotes() {
        let model = BodyMeasurementFormModel(initialValues: BodyMeasurementFormValues(
            measuredOn: "2026-06-26",
            weightKg: " 80,55 ",
            bodyFatPct: "17,25",
            notes: "  morning  "
        ))

        let values = model.valuesForSubmit()

        XCTAssertEqual(values, BodyMeasurementFormValues(
            measuredOn: "2026-06-26",
            weightKg: "80.55",
            bodyFatPct: "17.25",
            notes: "morning"
        ))
        XCTAssertNil(model.errorMessage)
    }

    func testValidationRequiresWeightOrBodyFat() {
        let model = BodyMeasurementFormModel(initialValues: BodyMeasurementFormValues(
            measuredOn: "2026-06-26",
            weightKg: " ",
            bodyFatPct: "",
            notes: "notes only"
        ))

        XCTAssertNil(model.valuesForSubmit())
        XCTAssertEqual(model.errorMessage, "Enter a weight, a body-fat %, or both.")
    }

    func testValidationMirrorsDatabaseNumericRanges() {
        let overweight = BodyMeasurementFormModel(initialValues: BodyMeasurementFormValues(
            measuredOn: "2026-06-26",
            weightKg: "500",
            bodyFatPct: "",
            notes: ""
        ))
        let overfat = BodyMeasurementFormModel(initialValues: BodyMeasurementFormValues(
            measuredOn: "2026-06-26",
            weightKg: "80",
            bodyFatPct: "100",
            notes: ""
        ))

        XCTAssertNil(overweight.valuesForSubmit())
        XCTAssertEqual(overweight.errorMessage, "Weight must be greater than 0 and less than 500 kg.")
        XCTAssertNil(overfat.valuesForSubmit())
        XCTAssertEqual(overfat.errorMessage, "Body fat must be at least 0 % and less than 100 %.")
    }

    func testValidationRejectsMoreThanTwoDecimalPlaces() {
        let model = BodyMeasurementFormModel(initialValues: BodyMeasurementFormValues(
            measuredOn: "2026-06-26",
            weightKg: "80.123",
            bodyFatPct: "",
            notes: ""
        ))

        XCTAssertNil(model.valuesForSubmit())
        XCTAssertEqual(model.errorMessage, "Use up to 3 digits and 2 decimal places.")
    }

    func testValidationRejectsInvalidDateOnlyValue() {
        let model = BodyMeasurementFormModel(initialValues: BodyMeasurementFormValues(
            measuredOn: "not-a-date",
            weightKg: "80",
            bodyFatPct: "",
            notes: ""
        ))

        XCTAssertNil(model.valuesForSubmit())
        XCTAssertEqual(model.errorMessage, "Choose a valid measurement date.")
    }
}

final class HealthBodyMeasurementImportTests: XCTestCase {
    func testGrouperUsesLatestSamplePerMetricPerDayAndSortsNewestFirst() throws {
        let dayOneMorning = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-06-25T07:00:00Z"))
        let dayOneEvening = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-06-25T20:00:00Z"))
        let dayTwo = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-06-26T07:00:00Z"))

        let merged = HealthBodyMeasurementGrouper.merge(
            weights: [
                (measuredOn: "2026-06-25", endDate: dayOneMorning, value: 81.2),
                (measuredOn: "2026-06-25", endDate: dayOneEvening, value: 80.9)
            ],
            bodyFats: [
                (measuredOn: "2026-06-26", endDate: dayTwo, value: 17.8),
                (measuredOn: "2026-06-25", endDate: dayOneMorning, value: 18.1)
            ]
        )

        XCTAssertEqual(merged.map(\.measuredOn), ["2026-06-26", "2026-06-25"])
        XCTAssertNil(merged[0].weightKg)
        XCTAssertEqual(merged[0].bodyFatPct, 17.8)
        XCTAssertEqual(merged[1].weightKg, 80.9)
        XCTAssertEqual(merged[1].bodyFatPct, 18.1)
    }

    func testImportedHealthMeasurementsFormatValuesAndDropOutOfRangeMetrics() {
        let values = HealthBodyMeasurement(
            measuredOn: "2026-06-26",
            weightKg: 80.506,
            bodyFatPct: 17.804
        ).formValues(notes: "Imported from Apple Health")

        XCTAssertEqual(values, BodyMeasurementFormValues(
            measuredOn: "2026-06-26",
            weightKg: "80.51",
            bodyFatPct: "17.8",
            notes: "Imported from Apple Health"
        ))

        let partialValues = HealthBodyMeasurement(
            measuredOn: "2026-06-27",
            weightKg: 500,
            bodyFatPct: 18.0
        ).formValues()

        XCTAssertEqual(partialValues?.weightKg, "")
        XCTAssertEqual(partialValues?.bodyFatPct, "18")
    }
}

@MainActor
final class BodyMeasurementsHealthSyncViewModelTests: XCTestCase {
    func testLoadIgnoresCancellationAndPreservesPreviousMeasurements() async throws {
        let repository = FakeBodyMeasurementsRepository(measurements: [
            BodyMeasurement(id: "existing", measuredOn: "2026-06-25", weightKg: 81, bodyFatPct: nil)
        ])
        let viewModel = BodyMeasurementsListViewModel(repository: repository)

        await viewModel.load()
        await repository.setListError(GraphQLDomainError.transport(
            "The operation couldn't be completed. (Swift.CancellationError error 1.)"
        ))
        await viewModel.load()

        XCTAssertNil(viewModel.state.errorMessage)
        XCTAssertEqual(viewModel.measurements.map(\.id), ["existing"])
    }

    func testLoadSuppressesOverlappingHealthSyncs() async {
        let repository = FakeBodyMeasurementsRepository(measurements: [])
        let importer = BlockingBodyMeasurementsHealthImporter()
        let viewModel = BodyMeasurementsListViewModel(repository: repository, healthImporter: importer)

        let firstLoad = Task { await viewModel.load(shouldSyncHealthMeasurements: true) }
        await importer.waitUntilFirstCallStarts()

        XCTAssertTrue(viewModel.isRefreshing)

        let overlappingLoad = Task { await viewModel.load(shouldSyncHealthMeasurements: true) }
        await overlappingLoad.value

        let callCount = await importer.callCountSnapshot()
        XCTAssertEqual(callCount, 1)
        XCTAssertTrue(viewModel.isRefreshing)

        await importer.releaseFirstCall()
        await firstLoad.value

        XCTAssertFalse(viewModel.isRefreshing)
    }

    func testHealthSyncSkipsExistingDatesAndImportsNewDatesOnLoad() async throws {
        let repository = FakeBodyMeasurementsRepository(measurements: [
            BodyMeasurement(id: "existing", measuredOn: "2026-06-25", weightKg: 81, bodyFatPct: nil)
        ])
        let importer = FakeBodyMeasurementsHealthImporter(measurements: [
            HealthBodyMeasurement(measuredOn: "2026-06-25", weightKg: 80.5, bodyFatPct: 18.2),
            HealthBodyMeasurement(measuredOn: "2026-06-26", weightKg: 80.2, bodyFatPct: 18.0)
        ])
        let viewModel = BodyMeasurementsListViewModel(repository: repository, healthImporter: importer)

        await viewModel.load(shouldSyncHealthMeasurements: true)

        let createdValues = await repository.createdValuesSnapshot()
        XCTAssertEqual(createdValues, [BodyMeasurementFormValues(
            measuredOn: "2026-06-26",
            weightKg: "80.2",
            bodyFatPct: "18",
            notes: "Imported from Apple Health"
        )])
        XCTAssertEqual(viewModel.measurements.map { $0.measuredOn }, ["2026-06-25", "2026-06-26"])
        XCTAssertEqual(viewModel.healthSyncState.value, BodyMeasurementsHealthSyncSummary(
            importedCount: 1,
            skippedExistingCount: 1
        ))
    }

    func testHealthSyncRefreshesRecentImportedHealthRows() async throws {
        let repository = FakeBodyMeasurementsRepository(measurements: [
            BodyMeasurement(
                id: "today",
                measuredOn: "2026-07-09",
                weightKg: 81,
                bodyFatPct: 18,
                notes: "Imported from Apple Health"
            ),
            BodyMeasurement(
                id: "manual",
                measuredOn: "2026-07-08",
                weightKg: 80,
                bodyFatPct: 17.5,
                notes: "Manual correction"
            ),
            BodyMeasurement(
                id: "old-import",
                measuredOn: "2026-06-30",
                weightKg: 82,
                bodyFatPct: 19,
                notes: "Imported from Apple Health"
            )
        ])
        let importer = FakeBodyMeasurementsHealthImporter(measurements: [
            HealthBodyMeasurement(measuredOn: "2026-07-09", weightKg: 80.5, bodyFatPct: 17.8),
            HealthBodyMeasurement(measuredOn: "2026-07-08", weightKg: 79.5, bodyFatPct: 17.2),
            HealthBodyMeasurement(measuredOn: "2026-06-30", weightKg: 81.5, bodyFatPct: 18.7),
            HealthBodyMeasurement(measuredOn: "2026-07-07", weightKg: 80.2, bodyFatPct: nil)
        ])
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(secondsFromGMT: 0))
        let now = try XCTUnwrap(DateOnly.parse("2026-07-09", calendar: calendar))
        let viewModel = BodyMeasurementsListViewModel(
            repository: repository,
            healthImporter: importer,
            calendar: calendar,
            now: { now }
        )

        await viewModel.load(shouldSyncHealthMeasurements: true)

        let updatedValues = await repository.updatedValuesSnapshot()
        XCTAssertEqual(updatedValues, ["today": BodyMeasurementFormValues(
            measuredOn: "2026-07-09",
            weightKg: "80.5",
            bodyFatPct: "17.8",
            notes: "Imported from Apple Health"
        )])
        let createdValues = await repository.createdValuesSnapshot()
        XCTAssertEqual(createdValues, [BodyMeasurementFormValues(
            measuredOn: "2026-07-07",
            weightKg: "80.2",
            bodyFatPct: "",
            notes: "Imported from Apple Health"
        )])
        XCTAssertEqual(viewModel.healthSyncState.value, BodyMeasurementsHealthSyncSummary(
            importedCount: 1,
            updatedCount: 1,
            skippedExistingCount: 2
        ))
    }
}

final class BodyMeasurementTrendBuilderTests: XCTestCase {
    func testTrendDataSortsAscendingAndDropsInvalidDatesWithoutTimezoneShift() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(secondsFromGMT: -8 * 3600))
        let measurements = [
            BodyMeasurement(id: "later", measuredOn: "2026-06-20", weightKg: 80, bodyFatPct: nil),
            BodyMeasurement(id: "invalid", measuredOn: "bad", weightKg: 79, bodyFatPct: 18),
            BodyMeasurement(id: "earlier", measuredOn: "2026-06-01", weightKg: 81, bodyFatPct: 18.5),
            BodyMeasurement(id: "middle", measuredOn: "2026-06-10", weightKg: nil, bodyFatPct: 18.1)
        ]

        let trend = BodyMeasurementTrendBuilder.make(from: measurements, calendar: calendar)

        XCTAssertEqual(trend.points.map(\.id), ["earlier", "middle", "later"])
        XCTAssertEqual(trend.weightCount, 2)
        XCTAssertEqual(trend.bodyFatCount, 2)
        XCTAssertTrue(trend.shouldShowChart)
        XCTAssertEqual(calendar.component(.day, from: trend.points[0].date), 1)
    }

    func testTrendNeedsAtLeastTwoPointsForOneMetric() {
        let trend = BodyMeasurementTrendBuilder.make(from: [
            BodyMeasurement(id: "one", measuredOn: "2026-06-01", weightKg: 81, bodyFatPct: nil),
            BodyMeasurement(id: "two", measuredOn: "2026-06-10", weightKg: nil, bodyFatPct: nil)
        ])

        XCTAssertEqual(trend.weightCount, 1)
        XCTAssertFalse(trend.shouldShowChart)
    }

    func testRollingAverageValuesUseSevenDayWindowPerMetric() throws {
        let trend = BodyMeasurementTrendBuilder.make(from: [
            BodyMeasurement(id: "old", measuredOn: "2026-06-01", weightKg: 90, bodyFatPct: 25),
            BodyMeasurement(id: "start", measuredOn: "2026-06-04", weightKg: 84, bodyFatPct: nil),
            BodyMeasurement(id: "middle", measuredOn: "2026-06-08", weightKg: 82, bodyFatPct: 20),
            BodyMeasurement(id: "today", measuredOn: "2026-06-10", weightKg: 80, bodyFatPct: 18)
        ])

        let averages = trend.rollingAverageValues(days: 7)

        XCTAssertEqual(averages.map(\.measuredOn), ["2026-06-01", "2026-06-04", "2026-06-08", "2026-06-10"])
        let lastAverage = try XCTUnwrap(averages.last)
        XCTAssertEqual(try XCTUnwrap(lastAverage.averageWeightKg), 82, accuracy: 0.001)
        XCTAssertEqual(try XCTUnwrap(lastAverage.averageBodyFatPct), 19, accuracy: 0.001)
    }

    func testTrendTimescaleFiltersInclusiveLocalDayWindow() throws {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = try XCTUnwrap(TimeZone(secondsFromGMT: 0))
        let now = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-06-27T12:00:00Z"))
        let trend = BodyMeasurementTrendBuilder.make(
            from: [
                BodyMeasurement(id: "old", measuredOn: "2026-06-20", weightKg: 82),
                BodyMeasurement(id: "start", measuredOn: "2026-06-21", weightKg: 81),
                BodyMeasurement(id: "today", measuredOn: "2026-06-27", weightKg: 80)
            ],
            calendar: calendar
        )

        let filtered = trend.filtered(by: .last7Days, calendar: calendar, now: now)

        XCTAssertEqual(filtered.points.map { $0.id }, ["start", "today"])
    }

    func testTrendCustomRangeFiltersAndAcceptsReversedDates() {
        let trend = BodyMeasurementTrendBuilder.make(from: [
            BodyMeasurement(id: "before", measuredOn: "2026-06-20", weightKg: 82),
            BodyMeasurement(id: "inside", measuredOn: "2026-06-25", weightKg: 81),
            BodyMeasurement(id: "after", measuredOn: "2026-06-27", weightKg: 80)
        ])

        let filtered = trend.filtered(
            by: .custom,
            customStartISO: "2026-06-26",
            customEndISO: "2026-06-24"
        )

        XCTAssertEqual(filtered.points.map { $0.id }, ["inside"])
    }
}

final class BodyMeasurementsErrorMapperTests: XCTestCase {
    func testMapsMeasuredOnUniquenessConstraintToFriendlyCopy() {
        let error = GraphQLDomainError.graphQLErrors([
            GraphQLErrorDetail(
                message: "Uniqueness violation",
                code: "constraint-violation",
                constraintName: "body_measurements_user_date_key"
            )
        ])

        XCTAssertEqual(
            BodyMeasurementsErrorMapper.message(for: error),
            "You already have a measurement for this date. Edit that entry or choose another date."
        )
    }
}

private actor FakeBodyMeasurementsRepository: BodyMeasurementsRepositoryProtocol {
    private var measurements: [BodyMeasurement]
    private var createdValues: [BodyMeasurementFormValues] = []
    private var updatedValues: [String: BodyMeasurementFormValues] = [:]
    private var listError: Error?

    init(measurements: [BodyMeasurement]) {
        self.measurements = measurements
    }

    func listMeasurements() async throws -> [BodyMeasurement] {
        if let listError { throw listError }
        return measurements
    }

    func setListError(_ error: Error?) {
        listError = error
    }

    func measurement(id: String) async throws -> BodyMeasurement? {
        measurements.first { $0.id == id }
    }

    func editMeasurement(id: String) async throws -> BodyMeasurement? {
        measurements.first { $0.id == id }
    }

    func createMeasurement(_ values: BodyMeasurementFormValues) async throws -> String {
        let id = "created-\(createdValues.count + 1)"
        createdValues.append(values)
        measurements.append(BodyMeasurement(
            id: id,
            measuredOn: values.measuredOn,
            weightKg: Double(values.weightKg),
            bodyFatPct: Double(values.bodyFatPct),
            notes: values.notes.isEmpty ? nil : values.notes
        ))
        return id
    }

    func updateMeasurement(id: String, values: BodyMeasurementFormValues) async throws {
        guard let index = measurements.firstIndex(where: { $0.id == id }) else { return }
        updatedValues[id] = values
        measurements[index] = BodyMeasurement(
            id: id,
            measuredOn: values.measuredOn,
            weightKg: Double(values.weightKg),
            bodyFatPct: Double(values.bodyFatPct),
            notes: values.notes.isEmpty ? nil : values.notes
        )
    }

    func deleteMeasurement(id: String) async throws {
        measurements.removeAll { $0.id == id }
    }

    func createdValuesSnapshot() -> [BodyMeasurementFormValues] {
        createdValues
    }

    func updatedValuesSnapshot() -> [String: BodyMeasurementFormValues] {
        updatedValues
    }
}

private actor BlockingBodyMeasurementsHealthImporter: BodyMeasurementsHealthImporting {
    private var callCount = 0
    private var firstCallStarted = false
    private var firstCallStartWaiters: [CheckedContinuation<Void, Never>] = []
    private var firstCallRelease: CheckedContinuation<Void, Never>?

    func dailyMeasurements() async throws -> [HealthBodyMeasurement] {
        callCount += 1
        guard callCount == 1 else { return [] }

        firstCallStarted = true
        let waiters = firstCallStartWaiters
        firstCallStartWaiters.removeAll()
        waiters.forEach { $0.resume() }
        await withCheckedContinuation { firstCallRelease = $0 }
        return []
    }

    func waitUntilFirstCallStarts() async {
        guard !firstCallStarted else { return }
        await withCheckedContinuation { firstCallStartWaiters.append($0) }
    }

    func releaseFirstCall() {
        firstCallRelease?.resume()
        firstCallRelease = nil
    }

    func callCountSnapshot() -> Int {
        callCount
    }
}

private struct FakeBodyMeasurementsHealthImporter: BodyMeasurementsHealthImporting {
    let measurements: [HealthBodyMeasurement]

    func dailyMeasurements() async throws -> [HealthBodyMeasurement] {
        measurements
    }
}

private let bodyMeasurementFixture: JSONValue = .object([
    "id": .string("measurement-1"),
    "measuredOn": .string("2026-06-25"),
    "weightKg": .string("80.75"),
    "bodyFatPct": .number(17.8),
    "notes": .string("Morning check-in")
])

private let bodyMeasurementFixtureWithUpdatedAt: JSONValue = .object([
    "id": .string("measurement-1"),
    "measuredOn": .string("2026-06-25"),
    "weightKg": .string("80.75"),
    "bodyFatPct": .string("17.8"),
    "notes": .string("Morning check-in"),
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
