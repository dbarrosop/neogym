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
