import Foundation
import XCTest
@testable import NeoGymKit

final class CardioMetricsSchemaTests: XCTestCase {
    func testAsSchemaRejectsNonObjectsAndAcceptsValidShape() {
        XCTAssertNil(CardioMetricsSchemaHelpers.asSchema(.null))
        XCTAssertNil(CardioMetricsSchemaHelpers.asSchema(.string("foo")))
        XCTAssertNil(CardioMetricsSchemaHelpers.asSchema(.object(["type": .string("array")])) )

        XCTAssertNotNil(CardioMetricsSchemaHelpers.asSchema(runningSchemaJSON))
    }

    func testIterateMetricsSortsByOrderAndMarksRequiredFields() throws {
        let specs = CardioMetricsSchemaHelpers.iterateMetrics(try XCTUnwrap(CardioMetricsSchema(json: runningSchemaJSON)))

        XCTAssertEqual(specs.map(\.key), ["distance_km", "duration_s", "avg_hr_bpm"])
        XCTAssertTrue(try XCTUnwrap(specs.first { $0.key == "duration_s" }).required)
        XCTAssertFalse(try XCTUnwrap(specs.first { $0.key == "distance_km" }).required)
    }

    func testIterateMetricsFallsBackWhenAnnotationsAreMissing() {
        let schema = CardioMetricsSchema(properties: [
            "reps": CardioMetricPropertySchema(type: "integer"),
            "weight_kg": CardioMetricPropertySchema(type: "number"),
            "anything": CardioMetricPropertySchema()
        ])

        let specs = CardioMetricsSchemaHelpers.iterateMetrics(schema)

        XCTAssertEqual(specs.first { $0.key == "reps" }?.format, .integer)
        XCTAssertEqual(specs.first { $0.key == "reps" }?.label, "reps")
        XCTAssertEqual(specs.first { $0.key == "weight_kg" }?.format, .decimal)
        XCTAssertEqual(specs.first { $0.key == "anything" }?.format, .decimal)
    }

    func testFormatsDurations() {
        XCTAssertEqual(CardioMetricsSchemaHelpers.formatSecondsAsDuration(0), "0:00")
        XCTAssertEqual(CardioMetricsSchemaHelpers.formatSecondsAsDuration(65), "1:05")
        XCTAssertEqual(CardioMetricsSchemaHelpers.formatSecondsAsDuration(3_599), "59:59")
        XCTAssertEqual(CardioMetricsSchemaHelpers.formatSecondsAsDuration(3_600), "1:00:00")
        XCTAssertEqual(CardioMetricsSchemaHelpers.formatSecondsAsDuration(3_725), "1:02:05")
        XCTAssertEqual(CardioMetricsSchemaHelpers.formatSecondsAsDuration(.infinity), "0:00")
    }

    func testFormatsMetricValuesAndRejectsShapeDrift() throws {
        let specs = CardioMetricsSchemaHelpers.iterateMetrics(try XCTUnwrap(CardioMetricsSchema(json: runningSchemaJSON)))
        let distance = try XCTUnwrap(specs.first { $0.key == "distance_km" })
        let duration = try XCTUnwrap(specs.first { $0.key == "duration_s" })
        let heartRate = try XCTUnwrap(specs.first { $0.key == "avg_hr_bpm" })
        let locale = Locale(identifier: "en_US_POSIX")

        XCTAssertEqual(CardioMetricsSchemaHelpers.formatMetricValue(nil, spec: distance, locale: locale), "—")
        XCTAssertEqual(CardioMetricsSchemaHelpers.formatMetricValue(5.42, spec: distance, locale: locale), "5.42 km")
        XCTAssertEqual(CardioMetricsSchemaHelpers.formatMetricValue(165.7, spec: heartRate, locale: locale), "166 bpm")
        XCTAssertEqual(CardioMetricsSchemaHelpers.formatMetricValue(125, spec: duration, locale: locale), "2:05")
        XCTAssertEqual(CardioMetricsSchemaHelpers.formatMetricValue("5.0", spec: distance, locale: locale), "—")
        XCTAssertEqual(CardioMetricsSchemaHelpers.formatMetricValue(JSONValue.string("5.0"), spec: distance, locale: locale), "—")
    }

    func testAggregationForFormat() {
        XCTAssertEqual(CardioMetricsSchemaHelpers.aggregation(for: .average), .average)
        XCTAssertEqual(CardioMetricsSchemaHelpers.aggregation(for: .integer), .sum)
        XCTAssertEqual(CardioMetricsSchemaHelpers.aggregation(for: .decimal), .sum)
        XCTAssertEqual(CardioMetricsSchemaHelpers.aggregation(for: .durationSeconds), .sum)
    }

    func testParsesDecimalAndIntegerInput() {
        XCTAssertEqual(CardioMetricsSchemaHelpers.parseDecimalInput("5.42"), 5.42)
        XCTAssertEqual(CardioMetricsSchemaHelpers.parseDecimalInput("5,42"), 5.42)
        XCTAssertNil(CardioMetricsSchemaHelpers.parseDecimalInput(""))
        XCTAssertNil(CardioMetricsSchemaHelpers.parseDecimalInput("abc"))
        XCTAssertNil(CardioMetricsSchemaHelpers.parseDecimalInput("1.2.3"))
        XCTAssertNil(CardioMetricsSchemaHelpers.parseDecimalInput("-5"))

        XCTAssertEqual(CardioMetricsSchemaHelpers.parseIntegerInput("5"), 5)
        XCTAssertNil(CardioMetricsSchemaHelpers.parseIntegerInput("5.0"))
        XCTAssertNil(CardioMetricsSchemaHelpers.parseIntegerInput(""))
        XCTAssertNil(CardioMetricsSchemaHelpers.parseIntegerInput("-5"))
    }

    func testDurationPartsRoundTrip() {
        XCTAssertEqual(CardioMetricsSchemaHelpers.durationPartsToSeconds(hours: "1", minutes: "2", seconds: "3"), 3_723)
        let parts = CardioMetricsSchemaHelpers.secondsToDurationParts(3_723)
        XCTAssertEqual(parts.h, 1)
        XCTAssertEqual(parts.m, 2)
        XCTAssertEqual(parts.s, 3)
        XCTAssertEqual(CardioMetricsSchemaHelpers.durationPartsToSeconds(hours: "", minutes: "5", seconds: ""), 300)
        XCTAssertNil(CardioMetricsSchemaHelpers.durationPartsToSeconds(hours: "1", minutes: "abc", seconds: "0"))
    }

    func testShouldShowHoursInputBoundary() {
        XCTAssertFalse(CardioMetricsSchemaHelpers.shouldShowHoursInput(maximum: 3_599))
        XCTAssertFalse(CardioMetricsSchemaHelpers.shouldShowHoursInput(maximum: 3_600))
        XCTAssertTrue(CardioMetricsSchemaHelpers.shouldShowHoursInput(maximum: 3_601))
        XCTAssertTrue(CardioMetricsSchemaHelpers.shouldShowHoursInput(maximum: nil))
    }

    func testSeedFieldStatesPreservesHiddenHoursBoundary() throws {
        let specs = CardioMetricsSchemaHelpers.iterateMetrics(try XCTUnwrap(CardioMetricsSchema(json: runningSchemaJSON)))
        let empty = CardioMetricsSchemaHelpers.seedFieldStates(specs: specs, seed: nil)
        XCTAssertEqual(empty["distance_km"], .text(""))
        XCTAssertEqual(empty["duration_s"], .duration(hours: "", minutes: "", seconds: ""))

        let seeded = CardioMetricsSchemaHelpers.seedFieldStates(
            specs: specs,
            seed: ["distance_km": 5.42, "duration_s": 3_723, "avg_hr_bpm": 165]
        )
        XCTAssertEqual(seeded["distance_km"], .text("5.42"))
        XCTAssertEqual(seeded["avg_hr_bpm"], .text("165"))
        XCTAssertEqual(seeded["duration_s"], .duration(hours: "1", minutes: "2", seconds: "3"))

        let shortSpecs = CardioMetricsSchemaHelpers.iterateMetrics(shortDurationSchema)
        XCTAssertEqual(
            CardioMetricsSchemaHelpers.seedFieldStates(specs: shortSpecs, seed: ["duration_s": 4_000])["duration_s"],
            .duration(hours: "", minutes: "66", seconds: "40")
        )

        let boundarySpecs = CardioMetricsSchemaHelpers.iterateMetrics(boundaryDurationSchema)
        XCTAssertEqual(
            CardioMetricsSchemaHelpers.seedFieldStates(specs: boundarySpecs, seed: ["duration_s": 3_600])["duration_s"],
            .duration(hours: "", minutes: "60", seconds: "")
        )
    }

    func testParseField() throws {
        let specs = CardioMetricsSchemaHelpers.iterateMetrics(try XCTUnwrap(CardioMetricsSchema(json: runningSchemaJSON)))
        let distance = try XCTUnwrap(specs.first { $0.key == "distance_km" })
        let duration = try XCTUnwrap(specs.first { $0.key == "duration_s" })
        let heartRate = try XCTUnwrap(specs.first { $0.key == "avg_hr_bpm" })

        XCTAssertEqual(CardioMetricsSchemaHelpers.parseField(spec: distance, raw: nil), .empty)
        XCTAssertEqual(CardioMetricsSchemaHelpers.parseField(spec: distance, raw: .text("   ")), .empty)
        XCTAssertEqual(CardioMetricsSchemaHelpers.parseField(spec: duration, raw: .duration(hours: "", minutes: "", seconds: "")), .empty)
        XCTAssertEqual(CardioMetricsSchemaHelpers.parseField(spec: heartRate, raw: .text("1.5")), .invalid)
        XCTAssertEqual(CardioMetricsSchemaHelpers.parseField(spec: distance, raw: .text("5,42")), .value(5.42))
        XCTAssertEqual(CardioMetricsSchemaHelpers.parseField(spec: duration, raw: .duration(hours: "1", minutes: "2", seconds: "3")), .value(3_723))
        XCTAssertEqual(CardioMetricsSchemaHelpers.parseField(spec: shortDurationSchemaSpec, raw: .duration(hours: "", minutes: "2", seconds: "5")), .value(125))
    }

    func testValidateMetricsMirrorsZodConstraints() throws {
        let schema = try XCTUnwrap(CardioMetricsSchema(json: runningSchemaJSON))

        XCTAssertTrue(CardioMetricsSchemaHelpers.validate(metrics: ["duration_s": 1_800, "distance_km": 5], against: schema).isEmpty)
        XCTAssertEqual(
            CardioMetricsSchemaHelpers.validate(metrics: ["distance_km": 5], against: schema),
            [.missingRequired("duration_s")]
        )
        XCTAssertEqual(
            CardioMetricsSchemaHelpers.validate(metrics: ["duration_s": 100, "bogus": 1], against: schema),
            [.unknownMetric("bogus")]
        )
        XCTAssertTrue(CardioMetricsSchemaHelpers.validate(metrics: ["duration_s": 100, "distance_km": 999.99], against: schema).isEmpty)
        XCTAssertEqual(
            CardioMetricsSchemaHelpers.validate(metrics: ["duration_s": 100, "distance_km": 1_000], against: schema),
            [.atOrAboveExclusiveMaximum("distance_km", 1_000)]
        )
        XCTAssertEqual(
            CardioMetricsSchemaHelpers.validate(metrics: ["duration_s": 100.5], against: schema),
            [.expectedInteger("duration_s")]
        )
    }
}

private let runningSchemaJSON = JSONValue.object([
    "type": .string("object"),
    "additionalProperties": .bool(false),
    "properties": .object([
        "distance_km": .object([
            "type": .string("number"),
            "minimum": .number(0),
            "exclusiveMaximum": .number(1_000),
            "x-label": .string("Distance"),
            "x-unit": .string("km"),
            "x-format": .string("decimal"),
            "x-order": .number(1)
        ]),
        "duration_s": .object([
            "type": .string("integer"),
            "minimum": .number(0),
            "maximum": .number(86_400),
            "x-label": .string("Duration"),
            "x-unit": .string(""),
            "x-format": .string("duration_seconds"),
            "x-order": .number(2)
        ]),
        "avg_hr_bpm": .object([
            "type": .string("integer"),
            "minimum": .number(0),
            "maximum": .number(300),
            "x-label": .string("Avg HR"),
            "x-unit": .string("bpm"),
            "x-format": .string("average"),
            "x-order": .number(4)
        ])
    ]),
    "required": .array([.string("duration_s")])
])

private let shortDurationSchema = CardioMetricsSchema(
    properties: [
        "duration_s": CardioMetricPropertySchema(
            type: "integer",
            minimum: 0,
            maximum: 3_599,
            label: "Duration",
            format: .durationSeconds
        )
    ],
    required: ["duration_s"]
)

private let boundaryDurationSchema = CardioMetricsSchema(
    properties: [
        "duration_s": CardioMetricPropertySchema(
            type: "integer",
            minimum: 0,
            maximum: 3_600,
            format: .durationSeconds
        )
    ],
    required: ["duration_s"]
)

private let shortDurationSchemaSpec = CardioMetricsSchemaHelpers.iterateMetrics(shortDurationSchema)[0]
