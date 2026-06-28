import XCTest
@testable import NeoGymKit

final class CardioEntryFormModelTests: XCTestCase {
    func testSeedsFromPreviousMetricsAndCollectsDurationAndAverageFields() {
        var model = CardioEntryFormModel(
            schema: runningSchema,
            previousMetrics: ["duration_s": 3_600, "avg_hr_bpm": 140]
        )

        XCTAssertEqual(model.value(for: "duration_s"), .duration(hours: "", minutes: "60", seconds: ""))
        XCTAssertEqual(model.value(for: "avg_hr_bpm"), .text("140"))

        model.setValue(.duration(hours: "", minutes: "45", seconds: "30"), for: "duration_s")
        model.setValue(.text("142"), for: "avg_hr_bpm")
        model.setValue(.text("5,25"), for: "distance_km")

        XCTAssertEqual(
            model.collectMetrics(),
            .success(["duration_s": 2_730, "avg_hr_bpm": 142, "distance_km": 5.25])
        )
    }

    func testBlocksRequiredInvalidAndAllEmptyMetricsBeforeMutation() {
        var model = CardioEntryFormModel(schema: runningSchema)
        XCTAssertEqual(model.collectMetrics(), .failure(key: "duration_s", message: "Duration is required."))

        model.setValue(.duration(hours: "", minutes: "nope", seconds: ""), for: "duration_s")
        XCTAssertEqual(model.collectMetrics(), .failure(key: "duration_s", message: "Duration is invalid."))

        let optionalSchema = CardioMetricsSchema(properties: [
            "calories_kcal": CardioMetricPropertySchema(type: "integer", label: "Calories", format: .integer, order: 0)
        ])
        let optionalModel = CardioEntryFormModel(schema: optionalSchema)
        XCTAssertEqual(optionalModel.collectMetrics(), .failure(key: "calories_kcal", message: "Enter at least one value."))
    }

    func testValidatesIntegerAndMaximumRules() {
        var model = CardioEntryFormModel(schema: runningSchema)
        model.setValue(.duration(hours: "", minutes: "61", seconds: ""), for: "duration_s")
        model.setValue(.text("142"), for: "avg_hr_bpm")

        XCTAssertEqual(
            model.collectMetrics(),
            .failure(key: "duration_s", message: "Duration must be at most 3600.")
        )

        model.setValue(.duration(hours: "", minutes: "30", seconds: ""), for: "duration_s")
        model.setValue(.text("142.5"), for: "avg_hr_bpm")
        XCTAssertEqual(
            model.collectMetrics(),
            .failure(key: "avg_hr_bpm", message: "Avg HR is invalid.")
        )
    }
}

private let runningSchema = CardioMetricsSchema(
    properties: [
        "distance_km": CardioMetricPropertySchema(
            type: "number",
            minimum: 0,
            label: "Distance",
            unit: "km",
            format: .decimal,
            order: 0
        ),
        "duration_s": CardioMetricPropertySchema(
            type: "integer",
            minimum: 1,
            maximum: 3_600,
            label: "Duration",
            format: .durationSeconds,
            order: 1
        ),
        "avg_hr_bpm": CardioMetricPropertySchema(
            type: "integer",
            minimum: 0,
            label: "Avg HR",
            unit: "bpm",
            format: .average,
            order: 2
        )
    ],
    required: ["duration_s"]
)
